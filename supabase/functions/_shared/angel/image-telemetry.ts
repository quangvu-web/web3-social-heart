// _shared/angel/image-telemetry.ts
// Fire-and-forget telemetry cho pipeline vẽ ảnh (P1/P2/P3).
// Ghi 1 row / lần thử tier → admin xem "Image pipeline last 24h".

import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

let _client: SupabaseClient | null = null;
function svc(): SupabaseClient | null {
  if (_client) return _client;
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !key) return null;
  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}

export interface ImagePipelineLog {
  user_ref?: string | null;
  tier: string;                // "P1_spiritual" | "P1_fast" | "P2_fast" | "P3_lovable" | "jump_pro"
  model?: string | null;
  topic?: string | null;
  design_heavy?: boolean;
  heavy?: boolean;
  force_hd?: boolean;
  ok: boolean;
  duration_ms?: number | null;
  prompt_len?: number | null;
  final_prompt_len?: number | null;
  error_status?: number | null;
  error_msg?: string | null;
  fallback_stage?: string | null;
  meta?: Record<string, unknown> | null;
}

/** Ghi log không chặn caller. Fail-silent nếu DB lỗi. */
export function logImagePipeline(row: ImagePipelineLog): void {
  const supa = svc();
  if (!supa) return;
  const payload = {
    user_ref: row.user_ref ?? null,
    tier: row.tier,
    model: row.model ?? null,
    topic: row.topic ?? null,
    design_heavy: !!row.design_heavy,
    heavy: !!row.heavy,
    force_hd: !!row.force_hd,
    ok: !!row.ok,
    duration_ms: row.duration_ms ?? null,
    prompt_len: row.prompt_len ?? null,
    final_prompt_len: row.final_prompt_len ?? null,
    error_status: row.error_status ?? null,
    error_msg: row.error_msg ? String(row.error_msg).slice(0, 500) : null,
    fallback_stage: row.fallback_stage ?? null,
    meta: row.meta ?? null,
  };
  // Fire-and-forget.
  void supa.from("angel_image_pipeline_logs").insert(payload).then(({ error }) => {
    if (error) console.warn("[image-telemetry] insert failed", error.message);
  });
}
