// angel-quota-status — admin endpoint: trả quota/keystatus từ Angel gốc.
// Gọi cả key chat (ANGEL_ROOT_API_KEY) và key ảnh (ANGEL_AI_API_KEY_IMAGE nếu có),
// để AI Ops tab hiển thị 2 hàng riêng.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_BASE = "https://zghvgxwdpsapvuvvdgjl.supabase.co/functions/v1";

function getBase(): string {
  const raw = Deno.env.get("ANGEL_ROOT_BASE_URL")
    || Deno.env.get("ANGEL_AI_BASE_URL")
    || "";
  if (raw) return raw.replace(/\/$/, "");
  const chatUrl = Deno.env.get("ANGEL_AI_CHAT_URL");
  if (chatUrl) return chatUrl.replace(/\/angel-(?:chat|router)\/?$/i, "").replace(/\/$/, "");
  return DEFAULT_BASE;
}

async function fetchStatus(key: string) {
  const t0 = Date.now();
  try {
    const res = await fetch(`${getBase()}/api-key-status`, {
      method: "GET",
      headers: { "x-api-key": key, Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    const text = await res.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { /* ignore */ }
    return {
      ok: res.ok && !!data,
      status: res.status,
      duration_ms: Date.now() - t0,
      key_name: data?.key_name ?? null,
      daily_limit: data?.daily_limit ?? null,
      image_daily_limit: data?.image_daily_limit ?? null,
      today_usage: data?.today_usage ?? null,
      today_image_usage: data?.today_image_usage ?? null,
      raw_preview: text.slice(0, 200),
    };
  } catch (e) {
    return { ok: false, status: 0, duration_ms: Date.now() - t0, error: (e as Error).message };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ error: "Missing auth" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: auth } }, auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data: u } = await supabase.auth.getUser();
    if (!u?.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });

    // Check admin role
    const { data: role } = await supabase.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
    if (!role) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...cors, "Content-Type": "application/json" } });

    const chatKey = Deno.env.get("ANGEL_ROOT_API_KEY") || Deno.env.get("ANGEL_AI_API_KEY") || "";
    const imageKey = Deno.env.get("ANGEL_AI_API_KEY_IMAGE") || Deno.env.get("ANGEL_ROOT_API_KEY_IMAGE") || "";

    const [chat, image] = await Promise.all([
      chatKey ? fetchStatus(chatKey) : Promise.resolve({ ok: false, missing: true }),
      imageKey ? fetchStatus(imageKey) : Promise.resolve({ ok: false, missing: true, fallback_to_chat: true }),
    ]);

    return new Response(JSON.stringify({ chat, image, base: getBase(), ts: Date.now() }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
