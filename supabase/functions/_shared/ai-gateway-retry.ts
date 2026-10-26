import { recordAiAttempt } from "./ai-usage-context.ts";
import { resolveAiProvider, GEMINI_TEXT_MODELS, type AiProvider } from "./ai-provider.ts";
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
  provider?: AiProvider;
  model?: string;
}

export async function callAiGateway(
  body: Record<string, unknown>,
  // OCR disables upstream error details to keep provider bodies out of logs.
  opts: { apiKey?: string | null; label?: string; timeoutMs?: number; maxAttempts?: number; logResponseDetails?: boolean } = {},
): Promise<GatewayResult> {
  const label = opts.label ?? "ai-gateway";
  const gatewayModel = typeof body.model === "string" ? body.model : "unspecified";
  const configured = await resolveAiProvider();
  const hasImage = JSON.stringify(body.messages ?? []).includes('"image_url"');
  const nativeModel = Object.hasOwn(GEMINI_TEXT_MODELS, gatewayModel) ? GEMINI_TEXT_MODELS[gatewayModel] : undefined;
  const directEligible = configured === "gemini" && label === "caption-translate" && !hasImage && body.stream !== true;
  const fallback = (reason: string, status = 0) => console.warn("[ai-gateway] provider_fallback", {
    provider: "gemini", model: nativeModel ?? gatewayModel, label,
    fallback_provider: "lovable", fallback_model: gatewayModel, reason, status,
  });
  const execute = async (provider: AiProvider, requestBody: Record<string, unknown>, apiKey: string | null | undefined): Promise<GatewayResult> => {
    const model = String(requestBody.model ?? "unspecified");
    const context = { provider, model, label };
    const url = provider === "gemini" ? "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions" : GATEWAY_URL;
    if (!apiKey) {
      console.warn("[ai-gateway] missing_key", context);
      return { ok: false, status: 0, data: null, error: provider === "gemini" ? "GEMINI_API_KEY missing" : "LOVABLE_API_KEY missing", retryable: false, provider, model };
    }
    const maxAttempts = opts.maxAttempts ?? MAX_ATTEMPTS;
    let last: GatewayResult = { ok: false, status: 0, data: null, error: "no attempt", retryable: true };

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      recordAiAttempt(provider);
      console.info("[ai-gateway] ai_call", { ...context, attempt });
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });
        if (res.ok) {
          const data = await res.json().catch(() => null);
          if (!data || !Array.isArray(data?.choices) || (provider === "gemini" && (typeof data.choices[0]?.message?.content !== "string" || !data.choices[0].message.content.trim()))) {
            return { ok: false, status: res.status, data, error: "malformed AI response", retryable: false, provider, model };
          }
          return { ok: true, status: res.status, data, provider, model };
        }
        const raw = await res.text().catch(() => "");
        const text = provider === "gemini" ? "direct provider error" : raw.slice(0, 400);
        const retryable = res.status === 408 || res.status === 429 || res.status >= 500;
        last = { ok: false, status: res.status, data: null, error: `${label} HTTP ${res.status}: ${text}`, retryable, provider, model };
        if (!retryable) {
          console.warn(`[ai-gateway] ${label} permanent failure`, { ...context, status: res.status, ...(provider === "lovable" && opts.logResponseDetails !== false ? { body: text } : {}) });
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
          error: provider === "gemini" ? `${label} direct network error` : `${label} network error: ${err instanceof Error ? err.message : String(err)}`,
          provider, model,
          retryable: true,
        };
        if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, 500 * 2 ** (attempt - 1)));
      } finally {
        clearTimeout(timer);
      }
    }
    console.warn(`[ai-gateway] ${label} exhausted retries`, { ...context, status: last.status, ...(provider === "lovable" && opts.logResponseDetails !== false ? { error: last.error } : {}) });
    return last;
  };
  if (directEligible) {
    const key = Deno.env.get("GEMINI_API_KEY");
    if (!key) fallback("missing_key");
    else if (!nativeModel) fallback("unmapped_model");
    else {
      const result = await execute("gemini", { ...body, model: nativeModel }, key);
      if (result.ok) return result;
      fallback("direct_failed", result.status);
    }
  }
  return await execute("lovable", body, opts.apiKey ?? Deno.env.get("LOVABLE_API_KEY"));
}

export function gatewayText(result: GatewayResult): string {
  return (result.data?.choices?.[0]?.message?.content ?? "").toString().trim();
}
