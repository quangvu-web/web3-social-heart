import { createClient } from "npm:@supabase/supabase-js@2";
import { buildRtcToken } from "../_shared/agoraToken.ts";

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

function numericUid(input: string, salt = ""): number {
  let hash = 2166136261;
  const source = `${input}:${salt}`;
  for (let i = 0; i < source.length; i++) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) || 10001;
}

function requireEnv(name: string): string {
  const value = (Deno.env.get(name) || "").trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

async function assertSchemaReady(serviceClient: ReturnType<typeof createClient>) {
  const { error: liveSchemaError } = await serviceClient
    .from("live_sessions")
    .select([
      "id",
      "user_id",
      "agora_uid",
      "recording_uid",
      "recording_resource_id",
      "recording_sid",
      "resource_id",
      "sid",
      "temp_bucket",
      "temp_object_key",
      "recording_provider",
      "recording_status",
      "recording_error_code",
      "recording_error_message",
      "recording_started_at",
      "recording_stopped_at",
      "stop_requested_at",
      "stopped_at",
      "last_heartbeat_at",
      "last_host_heartbeat_at",
      "last_viewer_activity_at",
      "last_media_activity_at",
      "heartbeat_count",
      "client_state",
      "disconnect_detected_at",
      "cleanup_started_at",
      "cleanup_finished_at",
      "end_reason",
      "total_duration_seconds",
      "recording_retry_count",
      "watchdog_stop_result",
      "last_recording_query_result",
      "browser_recording_status",
      "browser_recording_warning",
      "browser_recording_chunk_count",
      "browser_recording_total_bytes",
    ].join(","))
    .limit(1);

  if (liveSchemaError) {
    const missing = String(liveSchemaError.message || "").match(/'([^']+)' column/)?.[1];
    throw new Error(missing ? `Migration missing: live_sessions.${missing}` : `Migration missing for live_sessions: ${liveSchemaError.message}`);
  }

  const { error: postSchemaError } = await serviceClient
    .from("posts")
    .select("id, post_type, metadata")
    .limit(1);
  if (postSchemaError) {
    throw new Error(`Migration missing for posts: ${postSchemaError.message}`);
  }
}

async function cleanupRecentOrphanLivePosts(serviceClient: ReturnType<typeof createClient>, userId: string) {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: posts, error } = await serviceClient
    .from("posts")
    .select("id, metadata")
    .eq("user_id", userId)
    .eq("post_type", "live")
    .gte("created_at", cutoff)
    .not("metadata->>live_session_id", "is", null)
    .limit(20);
  if (error || !posts?.length) return;

  const candidates = posts
    .map((post: any) => ({
      postId: String(post.id),
      sessionId: typeof post.metadata?.live_session_id === "string" ? post.metadata.live_session_id : "",
    }))
    .filter((item) => item.sessionId);
  if (!candidates.length) return;

  const { data: sessions } = await serviceClient
    .from("live_sessions")
    .select("id")
    .in("id", candidates.map((item) => item.sessionId));
  const existing = new Set((sessions ?? []).map((row: any) => String(row.id)));
  const orphanIds = candidates.filter((item) => !existing.has(item.sessionId)).map((item) => item.postId);
  if (!orphanIds.length) return;

  console.log("[live-webcam-start] cleanup orphan live posts", { userId, count: orphanIds.length });
  await serviceClient.from("posts").delete().in("id", orphanIds);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let postId: string | null = null;
  let sessionId: string | null = null;
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

    try {
      requireEnv("AGORA_APP_ID");
      requireEnv("AGORA_APP_CERTIFICATE");
      await assertSchemaReady(serviceClient);
      await cleanupRecentOrphanLivePosts(serviceClient, user.id);
    } catch (preflightError) {
      const message = preflightError instanceof Error ? preflightError.message : "Preflight failed";
      console.error("[live-webcam-start] preflight failed", message);
      return json({ error: message, phase: "preflight" }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const title = typeof body.title === "string" ? body.title.trim().slice(0, 160) : "";
    const privacy = body.privacy === "friends" ? "friends" : "public";
    const visibility = privacy === "friends" ? "friends" : "public";
    sessionId = crypto.randomUUID();
    const channel = `live_${user.id.replace(/-/g, "").slice(0, 12)}_${Date.now()}`;
    const hostUid = numericUid(user.id, "host");
    const recorderUid = numericUid(sessionId, "recorder");
    const tempPrefix = `temp/live/${user.id}/${sessionId}`;
    const tempBucket = (Deno.env.get("R2_TEMP_BUCKET") || Deno.env.get("AGORA_STORAGE_BUCKET") || Deno.env.get("CLOUDFLARE_R2_BUCKET_NAME") || "").trim();
    const now = new Date().toISOString();

    console.log("[live-webcam-start] create live session without recording", { sessionId, userId: user.id, channel, recorderUid });

    const appId = requireEnv("AGORA_APP_ID");
    const appCertificate = requireEnv("AGORA_APP_CERTIFICATE");
    const hostToken = buildRtcToken({
      appId,
      appCertificate,
      channel,
      uid: hostUid,
      role: "host",
      expireSeconds: 24 * 60 * 60,
    });

    const { data: post, error: postError } = await serviceClient
      .from("posts")
      .insert({
        user_id: user.id,
        content: title || "Dang LIVE tren FUN Profile",
        visibility,
        post_type: "live",
        metadata: {
          live_title: title,
          live_status: "live",
          live_mode: "webcam",
          stream_provider: "agora",
          channel_name: channel,
          agora_channel: channel,
          live_session_id: sessionId,
          viewer_count: 0,
        },
      })
      .select("id")
      .single();
    if (postError) throw postError;
    postId = post.id;

    const { error: sessionError } = await serviceClient.from("live_sessions").insert({
      id: sessionId,
      user_id: user.id,
      host_user_id: user.id,
      owner_id: user.id,
      channel_name: channel,
      agora_channel: channel,
      agora_uid: hostUid,
      agora_uid_host: hostUid,
      recording_uid: recorderUid,
      temp_bucket: tempBucket,
      temp_object_key: tempPrefix,
      title,
      privacy,
      source: "agora",
      mode: "agora_webcam",
      live_mode: "webcam",
      stream_provider: "agora",
      status: "live",
      recording_provider: "agora",
      recording_status: "idle",
      browser_recording_status: "idle",
      archive_status: "pending",
      storage_provider: "r2",
      playback_provider: "r2",
      post_id: postId,
      live_post_id: postId,
      host_heartbeat_at: now,
      last_heartbeat_at: now,
      last_host_heartbeat_at: now,
      heartbeat_count: 0,
      client_state: "live",
      heartbeat_device_type: "desktop",
      heartbeat_source_type: "webcam",
      heartbeat_agora_channel_name: channel,
      recording_retry_count: 0,
      started_at: now,
    });
    if (sessionError) throw sessionError;

    return json({
      sessionId,
      channel,
      token: hostToken.token,
      uid: hostToken.uid,
      appId,
      expiresAt: hostToken.expireAt,
      recordingStatus: "idle",
      recordingAvailable: null,
      fallbackRecordingRecommended: false,
      fallbackProvider: null,
    });
  } catch (error) {
    console.error("[live-webcam-start] failed reason", error);
    if (postId || sessionId) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
        if (supabaseUrl && serviceRoleKey) {
          const client = createClient(supabaseUrl, serviceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false },
          });
          if (sessionId) await client.from("live_sessions").delete().eq("id", sessionId);
          if (postId) await client.from("posts").delete().eq("id", postId);
        }
      } catch {
        // Best-effort cleanup only.
      }
    }
    return json({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});
