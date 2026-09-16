// _shared/angel-api-status.ts
// Client cho Angel gốc GET /api-key-status.
// Trả về quota chat + image còn lại hôm nay. Cache 60s để tránh gọi thừa.

const DEFAULT_BASE = "https://ssjoetiitctqzapymtzl.supabase.co/functions/v1";

export type AngelApiKeyStatus = {
  ok: boolean;
  key_name?: string | null;
  daily_limit?: number;
  image_daily_limit?: number;
  today_usage?: number;
  today_image_usage?: number;
  fetched_at: number; // epoch ms
};

function getBase(): string {
  const raw = Deno.env.get("ANGEL_ROOT_BASE_URL")
    || Deno.env.get("ANGEL_AI_BASE_URL")
    || "";
  if (raw) return raw.replace(/\/$/, "");
  const chatUrl = Deno.env.get("ANGEL_AI_CHAT_URL");
  if (chatUrl) return chatUrl.replace(/\/angel-(?:chat|router)\/?$/i, "").replace(/\/$/, "");
  return DEFAULT_BASE;
}

function getApiKey(): string {
  return Deno.env.get("ANGEL_AI_API_KEY")
    || Deno.env.get("ANGEL_ROOT_API_KEY")
    || "";
}

let _cache: AngelApiKeyStatus | null = null;
const CACHE_TTL_MS = 60_000;

export async function fetchAngelApiKeyStatus(force = false): Promise<AngelApiKeyStatus> {
  if (!force && _cache && Date.now() - _cache.fetched_at < CACHE_TTL_MS) {
    return _cache;
  }
  const key = getApiKey();
  if (!key) {
    const empty: AngelApiKeyStatus = { ok: false, fetched_at: Date.now() };
    _cache = empty;
    return empty;
  }

  const url = `${getBase()}/api-key-status`;
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { "x-api-key": key, "Accept": "application/json" },
    });
    const rawText = await res.text();
    let data: any = null;
    try { data = rawText ? JSON.parse(rawText) : null; } catch { /* ignore */ }
    if (!res.ok || !data) {
      console.warn(`[angel-api-status] status=${res.status} body=${rawText.slice(0, 200)}`);
      const failed: AngelApiKeyStatus = { ok: false, fetched_at: Date.now() };
      _cache = failed;
      return failed;
    }
    const out: AngelApiKeyStatus = {
      ok: data.ok !== false,
      key_name: data.key_name ?? null,
      daily_limit: typeof data.daily_limit === "number" ? data.daily_limit : undefined,
      image_daily_limit: typeof data.image_daily_limit === "number" ? data.image_daily_limit : undefined,
      today_usage: typeof data.today_usage === "number" ? data.today_usage : undefined,
      today_image_usage: typeof data.today_image_usage === "number" ? data.today_image_usage : undefined,
      fetched_at: Date.now(),
    };
    _cache = out;
    return out;
  } catch (e) {
    console.warn(`[angel-api-status] fetch failed: ${(e as Error).message}`);
    const failed: AngelApiKeyStatus = { ok: false, fetched_at: Date.now() };
    _cache = failed;
    return failed;
  }
}

export function invalidateAngelApiKeyStatusCache(): void {
  _cache = null;
}
