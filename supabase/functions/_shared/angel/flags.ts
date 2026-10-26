// _shared/angel/flags.ts
// Sprint 1 — Foundation: đọc feature flag từ bảng `angel_feature_flags`.
// Fallback: nếu bảng trống / lỗi DB → dùng `defaultValue` truyền vào (là
// hardcoded hiện tại). Cache in-memory 60s để không đánh DB mỗi request.
//
// Sprint 2+ sẽ chuyển các cờ hardcode (ANGEL_POSTPROCESS_STYLE_ENABLED,
// ANGEL_LOVABLE_FALLBACK_ENABLED, ...) sang gọi `getFlag()` ở đây.

import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

export type FlagKey =
  | "ai.provider"
  | "postprocess.style_pass"
  | "postprocess.narrative_fixup"
  | "postprocess.hard_revert"
  | "image.fallback_lovable_enabled"
  | "image.force_pro_on_heavy"
  | "image.rewrite_prompt"
  | "image.enrich_prompt"
  | "image.enrich_p1_design"
  | "image.skip_root_for_design"
  | "image.art_preset"
  | "image.stream_lovable"
  | "image.stream_telegram_preview"
  | "router.smart_fallback"
  | "router.factual_clean_mirror"
  | "router.dm_unlimited_length"
  | "router.strip_temperature_for_funcore"
  | "router.regen_creative_offramp"
  | "router.stale_fallback_on_error"
  | "memory.extract_on_dm"
  | "memory.callback_in_reply"
  | "spam.mention_bait"
  | "spam.cjk"
  | "spam.payment_laundering"
  | "image.fal_enabled"
  | "image.distill_enabled"
  | "image.no_text_guardrail"
  | "image.free_mode"
  | "image.group_enabled"
  | "image.auto_illustrate_group_posts"
  | "cost.postprocess_enabled"
  | "cost.memory_extract_enabled"
  | "cost.rolling_summary_enabled"
  | "cost.vision_describe_enabled"
  | "cost.voice_transcribe_enabled"
  | "cost.lovable_retry_enabled"
  | "cost.join_avatar_scan_enabled"
  | "discussion.auto_comment";

interface CacheEntry {
  value: boolean;
  meta: Record<string, unknown> | null;
  fetchedAt: number;
  present: boolean;
}

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, CacheEntry>();

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
 * Đọc feature flag. Trả về `defaultValue` khi bảng lỗi hoặc không có row.
 * Cache 60s per key.
 */
export type AiProviderFlag = "lovable" | "gemini";
export function getFlag(key: "ai.provider", defaultValue: AiProviderFlag, opts?: { throwOnError?: boolean }): Promise<AiProviderFlag>;
export function getFlag(key: FlagKey, defaultValue: boolean): Promise<boolean>;
export async function getFlag(
  key: FlagKey, defaultValue: boolean | AiProviderFlag, opts: { throwOnError?: boolean } = {},
): Promise<boolean | AiProviderFlag> {
  const valueOf = (entry: CacheEntry): boolean | AiProviderFlag => {
    if (typeof defaultValue === "boolean") return entry.value;
    if (!entry.present) return defaultValue;
    if (!entry.value) return "lovable";
    return entry.meta?.value === "gemini" ? "gemini" : "lovable";
  };
  const cached = cache.get(key);
  const now = Date.now();
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) return valueOf(cached);
  const supa = svcClient();
  if (!supa) {
    if (opts.throwOnError) throw new Error("flag_client_unavailable");
    return defaultValue;
  }
  try {
    const { data, error } = await supa.from("angel_feature_flags").select("enabled, meta").eq("key", key).maybeSingle();
    if (error) throw new Error("flag_read_failed");
    const entry: CacheEntry = {
      value: data?.enabled ?? (typeof defaultValue === "boolean" ? defaultValue : false),
      meta: (data?.meta as Record<string, unknown> | null) ?? null, fetchedAt: now, present: !!data,
    };
    cache.set(key, entry);
    return valueOf(entry);
  } catch {
    console.warn(`[angel/flags] getFlag(${key}) read failed`);
    if (opts.throwOnError) throw new Error("flag_read_failed");
    return defaultValue;
  }
}

export async function getFlagMeta(
  key: FlagKey,
): Promise<Record<string, unknown> | null> {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.meta;
  await getFlag(key, false);
  return cache.get(key)?.meta ?? null;
}

/** Dùng cho admin UI/khi vừa update flag để reset cache. */
export function invalidateFlagCache(key?: FlagKey): void {
  if (key) cache.delete(key);
  else cache.clear();
}
