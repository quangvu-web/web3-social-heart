// _shared/ai-gateway-retry.ts
// Gọi Lovable AI Gateway với retry CÓ GIỚI HẠN đúng ngữ nghĩa lỗi:
//   - 400 / 401 / 402 / 403 → lỗi vĩnh viễn, KHÔNG retry (ví dụ media URL không
//     fetch được, schema sai, hết credit).
//   - 429 / 5xx / lỗi mạng / timeout → retry backoff mũ có giới hạn.
//
// Trả về { ok, status, data, error } thay vì throw, để caller ghi nhận trạng thái
// "failed vĩnh viễn" mà không lặp lại.

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MAX_ATTEMPTS = 3;
const DEFAULT_TIMEOUT_MS = 60_000;

export interface GatewayResult {
  ok: boolean;
  status: number;
  data: any;
  /** Thông điệp lỗi đã an toàn để log */
  error?: string;
  /** true nếu lỗi có thể thử lại ở lần chạy sau */
  retryable?: boolean;
}

export async function callAiGateway(
  body: Record<string, unknown>,
  // OCR disables upstream error details to keep provider bodies out of logs.
  opts: { apiKey?: string | null; label?: string; timeoutMs?: number; maxAttempts?: number; logResponseDetails?: boolean } = {},
): Promise<GatewayResult> {
  const apiKey = opts.apiKey ?? Deno.env.get("LOVABLE_API_KEY");
  const label = opts.label ?? "ai-gateway";
  if (!apiKey) return { ok: false, status: 0, data: null, error: "LOVABLE_API_KEY missing", retryable: false };

  const maxAttempts = opts.maxAttempts ?? MAX_ATTEMPTS;
  let last: GatewayResult = { ok: false, status: 0, data: null, error: "no attempt", retryable: true };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    try {
      const res = await fetch(GATEWAY_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (!data || !Array.isArray(data?.choices)) {
          return { ok: false, status: res.status, data, error: "malformed AI response", retryable: false };
        }
        return { ok: true, status: res.status, data };
      }
      const text = (await res.text().catch(() => "")).slice(0, 400);
      const retryable = res.status === 408 || res.status === 429 || res.status >= 500;
      last = { ok: false, status: res.status, data: null, error: `${label} HTTP ${res.status}: ${text}`, retryable };
      if (!retryable) {
        console.warn(`[ai-gateway] ${label} permanent failure`, { status: res.status, ...(opts.logResponseDetails !== false ? { body: text } : {}) });
        return last;
      }
      const retryAfter = Number(res.headers.get("retry-after"));
      const delay = Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.min(retryAfter * 1000, 8000)
        : 500 * 2 ** (attempt - 1) + Math.floor(Math.random() * 250);
      if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, delay));
    } catch (err) {
      last = {
        ok: false,
        status: 0,
        data: null,
        error: `${label} network error: ${err instanceof Error ? err.message : String(err)}`,
        retryable: true,
      };
      if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, 500 * 2 ** (attempt - 1)));
    } finally {
      clearTimeout(timer);
    }
  }
  console.warn(`[ai-gateway] ${label} exhausted retries`, { status: last.status, ...(opts.logResponseDetails !== false ? { error: last.error } : {}) });
  return last;
}

export function gatewayText(result: GatewayResult): string {
  return (result.data?.choices?.[0]?.message?.content ?? "").toString().trim();
}
