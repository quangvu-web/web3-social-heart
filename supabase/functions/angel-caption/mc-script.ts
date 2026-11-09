import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { callAiGateway, gatewayText, type GatewayResult } from "../_shared/ai-gateway-retry.ts";
import { MODELS } from "../_shared/angel/models.ts";
import { buildMcScriptMessages, hasUnclearSpeech, validMcText, type McStage } from "./mc-script-policy.ts";

type RateClient = { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> };
type McDependencies = {
  userId: (request: Request) => Promise<string | null>;
  rateClient: () => RateClient | null;
  generate: (stage: McStage, text: string) => Promise<GatewayResult>;
};
const json = (status: number, payload: unknown) => new Response(JSON.stringify(payload), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json" },
});

async function readBody(req: Request): Promise<string | null> {
  const reader = req.body?.getReader();
  if (!reader) return "";
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 32768) { await reader.cancel(); return null; }
      parts.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const part of parts) { bytes.set(part, offset); offset += part.length; }
    return new TextDecoder().decode(bytes);
  } finally { reader.releaseLock(); }
}

export async function enforceMcRate(client: RateClient, userId: string, ip: string) {
  if (!ip || ip === "unknown") return "unavailable";
  try {
    const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip)))].map(b => b.toString(16).padStart(2, "0")).join("");
    const results = await Promise.all([`user:${userId}`, `ip:${hash}`].flatMap(key => [
      client.rpc("check_rate_limit", { p_key: `caption-mc:minute:${key}`, p_limit: 3, p_window_ms: 60000 }),
      client.rpc("check_rate_limit", { p_key: `caption-mc:day:${key}`, p_limit: 30, p_window_ms: 86400000 }),
    ]));
    if (results.some(r => r.error || typeof (r.data as { allowed?: unknown } | null)?.allowed !== "boolean")) return "unavailable";
    return results.every(r => (r.data as { allowed: boolean }).allowed) ? "allowed" : "limited";
  } catch { return "unavailable"; }
}

export function createMcScriptHandler(deps: McDependencies) {
  return async (req: Request): Promise<Response> => {
    if (req.method !== "POST") return json(405, { error: "Bé dùng POST để tạo bản MC nhé." });
    try {
      const userId = await deps.userId(req);
      if (!userId) return json(401, { error: "Bé đăng nhập FUN Profile để tạo bản MC nhé." });
      const raw = await readBody(req);
      if (raw === null) return json(413, { error: "Nội dung quá dài. Bé chia thành các đoạn nhỏ nhé." });
      let body: { stage?: unknown; text?: unknown };
      try { body = JSON.parse(raw); } catch { return json(400, { error: "Nội dung yêu cầu chưa hợp lệ." }); }
      if (!body || (body.stage !== "edit-vi" && body.stage !== "translate-en") || !validMcText(body.text)) {
        return json(400, { error: "Bé nhập 20–6.000 ký tự tiếng Việt và chọn đúng bước tạo bản MC nhé." });
      }
      if (body.stage === "translate-en" && hasUnclearSpeech(body.text)) {
        return json(400, { error: "Bé sửa các đoạn [chưa rõ: ...] trước khi dịch sang tiếng Anh nhé." });
      }
      const client = deps.rateClient();
      if (!client) return json(503, { error: "Angel chưa kiểm tra được giới hạn. Bé thử lại sau nhé." });
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "";
      const rate = await enforceMcRate(client, userId, ip);
      if (rate !== "allowed") return json(rate === "limited" ? 429 : 503, { error: rate === "limited"
        ? "Bé đã đạt giới hạn tạo bản MC: 3 lượt/phút và 30 lượt/24 giờ cho mỗi tài khoản và IP. Bé thử lại sau nhé."
        : "Angel chưa kiểm tra được giới hạn. Bé thử lại sau nhé." });
      const result = await deps.generate(body.stage as McStage, body.text.trim());
      const finish = result.data?.choices?.[0]?.finish_reason;
      const text = gatewayText(result)?.trim();
      if (!result.ok || finish !== "stop" || !text || text.length > (body.stage === "edit-vi" ? 6000 : 12000)) {
        return json(502, { error: "Angel chưa tạo được bản MC hoàn chỉnh. Bé giữ bản gốc và thử một đoạn ngắn hơn nhé." });
      }
      return json(200, { text, stage: body.stage });
    } catch {
      // No transcript, JWT, provider body or private speech is logged/stored.
      console.warn("[angel-caption] mc_script_unavailable");
      return json(503, { error: "Angel chưa tạo được bản MC. Nội dung đang soạn của bé vẫn được giữ trên trang." });
    }
  };
}

export const handleMcScript = createMcScriptHandler({
  async userId(req) {
    const authorization = req.headers.get("authorization");
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_ANON_KEY");
    if (!authorization?.startsWith("Bearer ") || !url || !key) return null;
    const client = createClient(url, key, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await client.auth.getUser();
    return error ? null : data.user?.id ?? null;
  },
  rateClient() {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    return url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
  },
  generate(stage, text) {
    return callAiGateway({ model: MODELS.style_pass.id, messages: buildMcScriptMessages(stage, text), temperature: 0.2, max_tokens: 6000 },
      { label: "caption-translate", timeoutMs: 30000, maxAttempts: 1, logResponseDetails: false });
  },
});
