import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function callTelegram(method: string, body: Record<string, unknown>) {
  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!botToken) {
    return { ok: false, error: "TELEGRAM_BOT_TOKEN is not configured" };
  }
  const res = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok && data?.ok !== false, status: res.status, data };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";




  let body: { action?: string; bootstrap_secret?: string } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const action = body.action ?? "get_info";

  const secret = Deno.env.get("TELEGRAM_WEBHOOK_SECRET");
  if (!secret) {
    return json({ error: "TELEGRAM_WEBHOOK_SECRET is not configured" }, 500);
  }

  const adminClient = createClient(supabaseUrl, serviceKey);

  // Auth gate: admin role required, OR bootstrap window when zero admins exist yet
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) {
    return json({ error: "Unauthorized — please sign in" }, 401);
  }
  const userId = claimsData.claims.sub;

  const { data: isAdmin } = await adminClient.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });

  let authorized = Boolean(isAdmin);
  if (!authorized) {
    const { count: adminCount } = await adminClient
      .from("user_roles")
      .select("user_id", { count: "exact", head: true })
      .eq("role", "admin");
    if ((adminCount ?? 0) === 0) {
      authorized = true;
      console.log(`[telegram-webhook-admin] bootstrap mode: no admin exists, allowing user ${userId}`);
    }
  }

  if (!authorized) {
    return json({ error: "Forbidden — admin only" }, 403);
  }

  const projectUrl = supabaseUrl.replace(/\/$/, "");
  const webhookUrl = `${projectUrl}/functions/v1/telegram-webhook?secret=${encodeURIComponent(secret)}`;

  if (action === "get_info") {
    const result = await callTelegram("getWebhookInfo", {});
    return json({
      success: result.ok,
      expected_url_prefix: `${projectUrl}/functions/v1/telegram-webhook`,
      info: result.data,
    });
  }

  if (action === "register") {
    const result = await callTelegram("setWebhook", {
      url: webhookUrl,
      allowed_updates: ["message", "channel_post", "edited_channel_post"],
      drop_pending_updates: false,
    });
    if (!result.ok) {
      return json({ success: false, error: "setWebhook failed", details: result.data }, 502);
    }
    const info = await callTelegram("getWebhookInfo", {});
    return json({ success: true, registered_url_redacted: `${projectUrl}/functions/v1/telegram-webhook?secret=***`, info: info.data });
  }

  if (action === "delete") {
    const result = await callTelegram("deleteWebhook", { drop_pending_updates: true });
    return json({ success: result.ok, data: result.data });
  }

  return json({ error: `Unknown action: ${action}` }, 400);
});
