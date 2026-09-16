import { createClient } from "npm:@supabase/supabase-js@2";
import { forceEndLive } from "../_shared/liveEnd.ts";
import { stopRestreamMultistream } from "../_shared/restreamMultistream.ts";

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
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Authorization required" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: "Supabase configuration missing" }, 500);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: "Invalid token" }, 401);

    const body = await req.json().catch(() => ({}));
    const sessionId = String(body.sessionId || body.session_id || "");
    if (!/^[0-9a-fA-F-]{36}$/.test(sessionId)) return json({ error: "Valid sessionId is required" }, 400);

    console.log("[live-webcam-stop] host_clicked_end", { live_session_id: sessionId, host_user_id: user.id, timestamp: new Date().toISOString() });
    const result = await forceEndLive(serviceClient, {
      sessionId,
      actorUserId: user.id,
      reason: "host_clicked_end",
      source: "host",
    });
    if (!result.ok) {
      const status = result.status === "forbidden" ? 403 : result.status === "not_found" ? 404 : 500;
      return json({ error: result.error || "Unable to end live session" }, status);
    }

    try {
      await stopRestreamMultistream(serviceClient, {
        userId: user.id,
        liveSessionId: sessionId,
      });
    } catch (restreamError) {
      console.warn("[live-webcam-stop] restream_stop_best_effort_failed", {
        live_session_id: sessionId,
        error: restreamError instanceof Error ? restreamError.message : restreamError,
      });
    }

    return json(result);
  } catch (error) {
    console.error("[live-webcam-stop] failed reason", error);
    return json({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});
