// angel-health-check — cron mỗi 5 phút, ping /api-key-status Angel gốc.
// Ghi kết quả vào angel_ai_events (channel=health, intent=root.ping) để AI Ops
// tab hiển thị uptime/latency của Angel gốc.
import { createClient } from "npm:@supabase/supabase-js@2";

const DEFAULT_BASE = "https://ssjoetiitctqzapymtzl.supabase.co/functions/v1";

function getBase(): string {
  const raw = Deno.env.get("ANGEL_ROOT_BASE_URL") || Deno.env.get("ANGEL_AI_BASE_URL") || "";
  if (raw) return raw.replace(/\/$/, "");
  const chatUrl = Deno.env.get("ANGEL_AI_CHAT_URL");
  if (chatUrl) return chatUrl.replace(/\/angel-(?:chat|router)\/?$/i, "").replace(/\/$/, "");
  return DEFAULT_BASE;
}

async function pingOnce(key: string, label: "chat" | "image") {
  const t0 = Date.now();
  let ok = false;
  let status = 0;
  let err: string | null = null;
  try {
    const res = await fetch(`${getBase()}/api-key-status`, {
      method: "GET",
      headers: { "x-api-key": key, Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    status = res.status;
    ok = res.ok;
    if (!ok) err = `HTTP ${status}`;
    await res.text().catch(() => "");
  } catch (e) {
    err = (e as Error).message;
  }
  return { ok, status, duration_ms: Date.now() - t0, err, label };
}

Deno.serve(async () => {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const admin = createClient(url, svc, { auth: { persistSession: false, autoRefreshToken: false } });

  const chatKey = Deno.env.get("ANGEL_ROOT_API_KEY") || Deno.env.get("ANGEL_AI_API_KEY") || "";
  const imageKey = Deno.env.get("ANGEL_AI_API_KEY_IMAGE") || Deno.env.get("ANGEL_ROOT_API_KEY_IMAGE") || "";

  const jobs: Promise<any>[] = [];
  if (chatKey) jobs.push(pingOnce(chatKey, "chat"));
  if (imageKey && imageKey !== chatKey) jobs.push(pingOnce(imageKey, "image"));

  const results = await Promise.all(jobs);
  const rows = results.map((r) => ({
    channel: "health",
    intent: `root.ping.${r.label}`,
    tier: "primary",
    model: "api-key-status",
    user_ref: null,
    duration_ms: r.duration_ms,
    ok: r.ok,
    error: r.err,
    meta: { status: r.status },
  }));

  if (rows.length) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (admin as any).from("angel_ai_events").insert(rows);
    if (error) console.error("[angel-health-check] insert error", error);
  }
  return new Response(JSON.stringify({ ok: true, results }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
