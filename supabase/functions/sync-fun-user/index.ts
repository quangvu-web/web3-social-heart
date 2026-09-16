// Sync the current Lovable Cloud user to FUN Core API and persist the returned fun_id.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const FUN_API_URL = Deno.env.get("FUN_API_URL");
  const FUN_PROFILE_APP_KEY = Deno.env.get("FUN_PROFILE_APP_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY || !FUN_API_URL || !FUN_PROFILE_APP_KEY) {
    console.error("[sync-fun-user] missing env", {
      hasUrl: !!SUPABASE_URL, hasService: !!SERVICE_KEY,
      hasFunUrl: !!FUN_API_URL, hasFunKey: !!FUN_PROFILE_APP_KEY,
    });
    return json({ error: "Server misconfigured" }, 500);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "Unauthorized" }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userResp, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userResp?.user) {
    console.warn("[sync-fun-user] invalid jwt", userErr);
    return json({ error: "Unauthorized" }, 401);
  }
  const user = userResp.user;

  // Fetch profile
  const { data: profile, error: profErr } = await admin
    .from("profiles")
    .select("id, fun_id, email, display_name, full_name, username, avatar_url, country, language")
    .eq("id", user.id)
    .maybeSingle();
  if (profErr) {
    console.error("[sync-fun-user] profile fetch error", profErr);
    return json({ error: "Profile lookup failed" }, 500);
  }
  if (!profile) return json({ error: "Profile not found" }, 404);

  // Already synced → return cached
  if (profile.fun_id) {
    return json({ success: true, fun_id: profile.fun_id, cached: true });
  }

  const email = profile.email ?? user.email ?? null;
  if (!email) {
    return json({ error: "Email required to sync" }, 400);
  }

  const payload: Record<string, unknown> = {
    email,
    username: profile.username ?? undefined,
    display_name: profile.display_name ?? profile.full_name ?? undefined,
    avatar_url: profile.avatar_url ?? undefined,
    country: profile.country ?? undefined,
    language: profile.language ?? "vi",
  };

  const url = `${FUN_API_URL.replace(/\/+$/, "")}/api/v1/fun-profile/sync-user`;

  async function callOnce(): Promise<{ ok: boolean; status: number; body: unknown }> {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-App-Key": FUN_PROFILE_APP_KEY,
        },
        body: JSON.stringify(payload),
      });
      let body: unknown = null;
      try { body = await res.json(); } catch { body = await res.text(); }
      return { ok: res.ok, status: res.status, body };
    } catch (e) {
      return { ok: false, status: 0, body: { network_error: e instanceof Error ? e.message : String(e) } };
    }
  }

  let result = await callOnce();
  if (!result.ok && result.status === 0) {
    await new Promise((r) => setTimeout(r, 500));
    result = await callOnce();
  }

  if (!result.ok) {
    await admin.from("fun_api_sync_log").insert({
      user_id: user.id,
      status: "error",
      error_message: `HTTP ${result.status}`,
      request_payload: payload,
      response_payload: result.body as object,
    });
    console.error("[sync-fun-user] FUN API error", result.status, result.body);
    return json({ error: "FUN API call failed", status: result.status, body: result.body }, 502);
  }

  const respBody = (result.body ?? {}) as { fun_id?: string; success?: boolean };
  const funId = respBody.fun_id;
  if (!funId) {
    await admin.from("fun_api_sync_log").insert({
      user_id: user.id,
      status: "error",
      error_message: "Missing fun_id in response",
      request_payload: payload,
      response_payload: result.body as object,
    });
    return json({ error: "FUN API did not return fun_id", body: result.body }, 502);
  }

  const { error: updErr } = await admin
    .from("profiles")
    .update({ fun_id: funId, synced_with_fun_api_at: new Date().toISOString() })
    .eq("id", user.id);
  if (updErr) {
    await admin.from("fun_api_sync_log").insert({
      user_id: user.id,
      status: "error",
      error_message: `Profile update failed: ${updErr.message}`,
      request_payload: payload,
      response_payload: result.body as object,
    });
    return json({ error: "Failed to persist fun_id" }, 500);
  }

  await admin.from("fun_api_sync_log").insert({
    user_id: user.id,
    status: "success",
    request_payload: payload,
    response_payload: result.body as object,
  });

  return json({ success: true, fun_id: funId, cached: false });
});
