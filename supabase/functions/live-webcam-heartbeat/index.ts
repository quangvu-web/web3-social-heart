import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const VALID_CLIENT_STATES = new Set(["live", "reconnecting", "background", "closing"]);
const VALID_DEVICE_TYPES = new Set(["desktop", "mobile"]);
const VALID_SOURCE_TYPES = new Set(["webcam", "mobile", "obs"]);
const RECOVERABLE_STATUSES = new Set(["live", "reconnecting", "disconnected"]);
const ENDED_STATUSES = new Set(["cleanup_pending", "ended", "processing", "ready", "posted", "failed"]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeEnum(value: unknown, allowed: Set<string>, fallback: string) {
  const raw = stringOrNull(value);
  return raw && allowed.has(raw) ? raw : fallback;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const accessToken = stringOrNull(body.access_token);
    const authHeader = req.headers.get("Authorization") || (accessToken ? `Bearer ${accessToken}` : "");
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

    const sessionId = String(body.live_session_id || body.sessionId || body.session_id || "");
    if (!/^[0-9a-fA-F-]{36}$/.test(sessionId)) return json({ error: "Valid live_session_id is required" }, 400);

    const clientState = normalizeEnum(body.client_state, VALID_CLIENT_STATES, "live");
    const deviceType = normalizeEnum(body.device_type, VALID_DEVICE_TYPES, "desktop");
    const sourceType = normalizeEnum(body.source_type, VALID_SOURCE_TYPES, "webcam");
    const channelName = stringOrNull(body.agora_channel_name);
    const mediaActive = body.media_active === true || body.has_audio === true || body.has_video === true;
    const now = new Date().toISOString();

    const { data: live, error: liveError } = await serviceClient
      .from("live_sessions")
      .select("id, user_id, host_user_id, owner_id, status, cleanup_started_at, end_reason, heartbeat_count, agora_channel, channel_name")
      .eq("id", sessionId)
      .maybeSingle();
    if (liveError) throw liveError;
    if (!live) return json({ error: "Live session not found" }, 404);

    const ownerId = live.user_id || live.host_user_id || live.owner_id;
    if (ownerId !== user.id) return json({ error: "Only host can heartbeat this live session" }, 403);

    if (ENDED_STATUSES.has(String(live.status)) || live.cleanup_started_at) {
      return json({
        ok: true,
        status: live.status,
        client_state: clientState,
        ended: true,
        end_reason: live.end_reason || (live.cleanup_started_at ? "watchdog_cleanup" : null),
      });
    }

    const nextStatus = RECOVERABLE_STATUSES.has(String(live.status)) ? "live" : live.status;
    const heartbeatCount = Number(live.heartbeat_count || 0) + 1;
    const resolvedChannel = channelName || live.agora_channel || live.channel_name || null;

    const { error: updateError } = await serviceClient
      .from("live_sessions")
      .update({
        status: nextStatus,
        host_heartbeat_at: now,
        last_heartbeat_at: now,
        last_host_heartbeat_at: now,
        last_seen_at: now,
        host_connection_status: "online",
        ...(mediaActive ? { last_media_activity_at: now } : {}),
        heartbeat_count: heartbeatCount,
        client_state: clientState,
        heartbeat_device_type: deviceType,
        heartbeat_source_type: sourceType,
        heartbeat_agora_channel_name: resolvedChannel,
        disconnect_detected_at: null,
        updated_at: now,
      })
      .eq("id", sessionId);
    if (updateError) return json({ error: updateError.message }, 400);

    console.log("[live-webcam-heartbeat] heartbeat_received", {
      live_session_id: sessionId,
      host_user_id: ownerId,
      channel_name: resolvedChannel,
      reason: clientState,
      timestamp: now,
    });
    if (clientState === "closing") {
      console.log("[live-webcam-heartbeat] beforeunload_end_attempt", {
        live_session_id: sessionId,
        host_user_id: ownerId,
        channel_name: resolvedChannel,
        reason: clientState,
        timestamp: now,
      });
    }

    return json({
      ok: true,
      status: nextStatus,
      client_state: clientState,
      ended: false,
    });
  } catch (error) {
    console.error("[live-webcam-heartbeat] failed reason", error);
    return json({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});
