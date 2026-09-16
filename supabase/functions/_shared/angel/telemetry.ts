// _shared/angel/telemetry.ts
// Sprint 1 — Foundation: log tất cả call AI xuống bảng `angel_ai_events`
// để tab admin "AI Ops" (Sprint 4) vẽ biểu đồ được.
//
// Ghi async (fire-and-forget) — không block response. Silent nếu bảng chưa có
// hoặc thiếu service key.

import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

export type AiChannel = "dm" | "group" | "web" | "inline" | "worker";
export type AiTier = "primary" | "backup" | "fallback" | "postprocess";

export interface AiEventInput {
  channel: AiChannel;
  intent: string;                 // e.g. "chat", "image", "youtube", "memory_extract"
  tier?: AiTier;
  model?: string;
  user_ref?: string | null;
  duration_ms: number;
  tokens_in?: number | null;
  tokens_out?: number | null;
  credits_est?: number | null;
  ok: boolean;
  error?: string | null;
  meta?: Record<string, unknown> | null;
}

let _client: SupabaseClient | null = null;
function svcClient(): SupabaseClient | null {
  if (_client) return _client;
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !key) return null;
  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}

/**
 * Log 1 sự kiện AI (fire-and-forget). Không throw.
 */
export function logAiEvent(evt: AiEventInput): void {
  const supa = svcClient();
  if (!supa) return;
  const payload = {
    channel: evt.channel,
    intent: evt.intent,
    tier: evt.tier ?? "primary",
    model: evt.model ?? null,
    user_ref: evt.user_ref ?? null,
    duration_ms: Math.round(evt.duration_ms),
    tokens_in: evt.tokens_in ?? null,
    tokens_out: evt.tokens_out ?? null,
    credits_est: evt.credits_est ?? null,
    ok: evt.ok,
    error: evt.error ?? null,
    meta: evt.meta ?? null,
  };
  Promise.resolve(supa.from("angel_ai_events").insert(payload))
    .then(({ error }: { error: unknown }) => {
      if (error && typeof error === "object" && "message" in error) {
        console.warn("[angel/telemetry] insert failed", (error as { message: string }).message);
      }
    })
    .catch((e: unknown) => console.warn("[angel/telemetry] exception", e));
}

/**
 * Helper wrap 1 async call AI: đo thời gian + log tự động.
 */
export async function trackAi<T>(
  base: Omit<AiEventInput, "ok" | "duration_ms" | "error">,
  fn: () => Promise<T>,
): Promise<T> {
  const t0 = Date.now();
  try {
    const result = await fn();
    logAiEvent({ ...base, ok: true, duration_ms: Date.now() - t0 });
    return result;
  } catch (e) {
    logAiEvent({
      ...base,
      ok: false,
      duration_ms: Date.now() - t0,
      error: e instanceof Error ? e.message : String(e),
    });
    throw e;
  }
}
