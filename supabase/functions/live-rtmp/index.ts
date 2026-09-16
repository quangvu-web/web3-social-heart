import { createClient } from "npm:@supabase/supabase-js@2";
import {
  buildStreamPlaybackUrls,
  isCloudflareVideoLive,
  isLiveInputConnected,
  isLiveInputDisconnected,
  isLiveInputStatusKnown,
  listLiveInputVideos,
  createLiveInput,
  disableLiveInput,
  enableLiveInput,
  getLiveInput,
} from "../_shared/cloudflareStreamService.ts";
import { decryptStreamKey, encryptStreamKey, maskStreamKey } from "../_shared/streamKeyCrypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type SupabaseAdmin = ReturnType<typeof createClient>;
type RtmpStatus = "idle" | "waiting" | "live" | "ended";
type ProducerStatus =
  | "waiting_for_obs"
  | "source_connected"
  | "ready_to_go_live"
  | "live"
  | "ended"
  | "processing"
  | "archiving"
  | "posted"
  | "failed";

const PRODUCER_STALE_MS = 45_000;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function error(message: string, status = 400) {
  return json({ error: message }, status);
}

function config() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw new Error("Missing Supabase RTMP configuration");
  }
  return { supabaseUrl, anonKey, serviceRoleKey };
}

async function readBody(req: Request): Promise<Record<string, unknown>> {
  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return await req.json().catch(() => ({}));
  const text = await req.text();
  return text ? Object.fromEntries(new URLSearchParams(text).entries()) : {};
}

async function getUser(req: Request, supabaseUrl: string, anonKey: string, body: Record<string, unknown>) {
  const bodyToken = typeof body.access_token === "string" ? body.access_token : "";
  const authHeader = req.headers.get("Authorization") || (bodyToken ? `Bearer ${bodyToken}` : "");
  if (!authHeader) return null;
  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await client.auth.getUser();
  return user ?? null;
}

async function mergePostMetadata(
  admin: SupabaseAdmin,
  postId: string,
  patch: Record<string, unknown>,
  extra: Record<string, unknown> = {},
) {
  const { data: post } = await admin.from("posts").select("metadata").eq("id", postId).maybeSingle();
  await admin
    .from("posts")
    .update({
      ...extra,
      metadata: {
        ...((post?.metadata || {}) as Record<string, unknown>),
        ...patch,
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", postId);
}

function toResponse(row: Record<string, unknown>, options: { streamKey?: string | null; reveal?: boolean } = {}) {
  const liveInputId = String(row.cloudflare_live_input_id || "");
  const hlsUrl = String(
    row.hls_url ||
    row.hls_playback_url ||
    row.playback_url ||
    (liveInputId ? buildStreamPlaybackUrls(liveInputId).hls : ""),
  );
  const rawStatus = String(row.rtmp_status || "waiting") as RtmpStatus;

  return {
    live_session_id: row.id,
    status: rawStatus,
    app_status: row.status,
    rtmp_url: row.rtmps_url ?? null,
    rtmps_url: row.rtmps_url ?? null,
    stream_key: options.reveal ? options.streamKey : maskStreamKey(options.streamKey),
    hls_url: hlsUrl || null,
    playback_url: hlsUrl || null,
    live_mode: "rtmp_obs",
    mode: "rtmp_obs",
    stream_provider: "cloudflare_stream",
    cloudflare_live_input_id: liveInputId || null,
    title: row.title ?? "",
    description: row.description ?? "",
    source_connected_at: row.source_connected_at ?? null,
    go_live_clicked_at: row.go_live_clicked_at ?? null,
    live_post_id: row.live_post_id ?? row.post_id ?? null,
    replay_post_id: row.replay_post_id ?? null,
    rtmp_started_at: row.rtmp_started_at ?? null,
    started_at: row.started_at ?? null,
    recording_status: row.recording_status ?? null,
    archive_status: row.archive_status ?? null,
  };
}

function detailsAreValid(row: Record<string, unknown>) {
  return String(row.title || "").trim().length > 0 && String(row.description || "").trim().length > 0;
}

function producerStatusFor(row: Record<string, unknown>, connected: boolean): ProducerStatus {
  if (["live", "ended", "processing", "archiving", "posted", "failed"].includes(String(row.status))) {
    return String(row.status) as ProducerStatus;
  }
  if (!connected) return "waiting_for_obs";
  return detailsAreValid(row) ? "ready_to_go_live" : "source_connected";
}

function isProducerStale(row: Record<string, unknown>, now = Date.now()) {
  const activeAt = String(row.producer_active_at || "");
  if (!activeAt) return true;
  const activeMs = Date.parse(activeAt);
  return !Number.isFinite(activeMs) || now - activeMs > PRODUCER_STALE_MS;
}

async function enableProducerInput(admin: SupabaseAdmin, row: Record<string, unknown>, sessionId: string) {
  const now = new Date().toISOString();
  if (row.cloudflare_live_input_id) {
    await enableLiveInput(String(row.cloudflare_live_input_id)).catch((err) => {
      console.warn("[live-rtmp] enable Live Input failed", err);
    });
  }
  await admin
    .from("live_sessions")
    .update({
      producer_active_at: now,
      producer_disconnected_at: null,
      producer_input_enabled: true,
      updated_at: now,
    })
    .eq("id", sessionId);
  row.producer_active_at = now;
  row.producer_disconnected_at = null;
  row.producer_input_enabled = true;
}

async function disableProducerInput(admin: SupabaseAdmin, row: Record<string, unknown>, sessionId: string, reason: string) {
  const now = new Date().toISOString();
  if (row.cloudflare_live_input_id) {
    await disableLiveInput(String(row.cloudflare_live_input_id)).catch((err) => {
      console.warn(`[live-rtmp] disable Live Input failed (${reason})`, err);
    });
  }
  // Only reset recording_status if it's still "recording" — preserve transient
  // states like uploading/processing that the archive pipeline may have set.
  const currentRecording = String(row.recording_status || "");
  const shouldResetRecording = currentRecording === "" || currentRecording === "recording" || currentRecording === "idle";
  const patch: Record<string, unknown> = {
    producer_disconnected_at: now,
    producer_input_enabled: false,
    rtmp_status: row.status === "live" ? row.rtmp_status : "waiting",
    status: row.status === "live" ? "live" : "waiting_for_obs",
    updated_at: now,
  };
  if (row.status !== "live" && shouldResetRecording) {
    patch.recording_status = "idle";
  }
  await admin.from("live_sessions").update(patch).eq("id", sessionId);
  row.producer_disconnected_at = now;
  row.producer_input_enabled = false;
  if (row.status !== "live") {
    row.rtmp_status = "waiting";
    row.status = "waiting_for_obs";
    if (shouldResetRecording) row.recording_status = "idle";
  }
}

// Mark the producer page as closed without disabling ingest (used when the
// stream is already public live, or when another producer tab is still active).
async function markProducerClosed(admin: SupabaseAdmin, sessionId: string) {
  const now = new Date().toISOString();
  await admin
    .from("live_sessions")
    .update({ producer_disconnected_at: now, updated_at: now })
    .eq("id", sessionId);
}

async function syncCloudflareProducerState(admin: SupabaseAdmin, row: Record<string, unknown>, sessionId: string) {
  const inputId = String(row.cloudflare_live_input_id || "");
  if (!inputId || row.status === "ended" || row.status === "posted") return;

  const liveInput = await getLiveInput(inputId);
  const videos = await listLiveInputVideos(inputId).catch((err) => {
    console.warn("[live-rtmp] listLiveInputVideos failed", err);
    return [];
  });
  const liveVideo = videos.find(isCloudflareVideoLive) || null;
  const latestVideo = videos[0] || null;
  const inputConnected = isLiveInputConnected(liveInput.status);
  const inputDisconnected = isLiveInputDisconnected(liveInput.status);
  const inputStatusKnown = isLiveInputStatusKnown(liveInput.status);
  // Cloudflare's video list can remain "Live" briefly after OBS stops. Treat
  // the Live Input state as authoritative whenever Cloudflare reports it.
  // The video list is only a fallback when the input status is blank/unknown.
  const connected = inputConnected || (!inputStatusKnown && !!liveVideo);
  const disconnected = inputDisconnected || (!connected && row.rtmp_status === "live");
  const playbackHls =
    liveInput.playback?.hls ||
    (liveVideo?.uid ? buildStreamPlaybackUrls(liveVideo.uid).hls : "") ||
    (latestVideo?.uid && connected ? buildStreamPlaybackUrls(latestVideo.uid).hls : "") ||
    buildStreamPlaybackUrls(inputId).hls;
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { updated_at: now };

  if (playbackHls && playbackHls !== row.hls_url) {
    patch.hls_url = playbackHls;
    patch.hls_playback_url = playbackHls;
    patch.playback_url = playbackHls;
    row.hls_url = playbackHls;
    row.hls_playback_url = playbackHls;
    row.playback_url = playbackHls;
  }

  const videoUid = liveVideo?.uid || latestVideo?.uid || null;
  if (videoUid && videoUid !== row.cloudflare_video_uid) {
    patch.cloudflare_video_uid = videoUid;
    row.cloudflare_video_uid = videoUid;
  }

  if (connected) {
    const nextStatus = producerStatusFor(row, true);
    patch.status = nextStatus;
    patch.rtmp_status = "live";
    patch.rtmp_started_at = row.rtmp_started_at ?? now;
    patch.source_connected_at = row.source_connected_at ?? now;
    patch.recording_status = "recording";
    row.status = nextStatus;
    row.rtmp_status = "live";
    row.rtmp_started_at = row.rtmp_started_at ?? now;
    row.source_connected_at = row.source_connected_at ?? now;
    row.recording_status = "recording";
  } else if (disconnected || row.rtmp_status === "live") {
    if (row.status === "live") {
      patch.status = "ended";
      patch.rtmp_status = "ended";
      patch.ended_at = row.ended_at ?? now;
      patch.rtmp_ended_at = row.rtmp_ended_at ?? now;
      patch.recording_status = "processing";
      row.status = "ended";
      row.rtmp_status = "ended";
      row.recording_status = "processing";
    } else {
      patch.status = "waiting_for_obs";
      patch.rtmp_status = "waiting";
      patch.recording_status = "idle";
      row.status = "waiting_for_obs";
      row.rtmp_status = "waiting";
      row.recording_status = "idle";
    }
  }

  if (Object.keys(patch).length > 1) {
    await admin.from("live_sessions").update(patch).eq("id", sessionId);
  }
}

async function createOrUpdateLivePost(params: {
  admin: SupabaseAdmin;
  live: Record<string, unknown>;
  userId: string;
  hlsUrl: string;
}) {
  const { admin, live, userId, hlsUrl } = params;
  const now = new Date().toISOString();
  const metadata = {
    live_session_id: live.id,
    live_title: String(live.title || "").trim(),
    title: String(live.title || "").trim(),
    description: String(live.description || "").trim(),
    live_status: "live",
    badge: "LIVE",
    media_type: "live_video",
    live_mode: "rtmp_obs",
    mode: "rtmp_obs",
    stream_provider: "cloudflare_stream",
    playback_provider: "cloudflare_stream",
    playback_url: hlsUrl,
    hls_url: hlsUrl,
    hls_playback_url: hlsUrl,
    cloudflare_live_input_id: live.cloudflare_live_input_id,
    viewer_count: live.viewer_count ?? 0,
    go_live_clicked_at: now,
  };

  const existingPostId = String(live.live_post_id || live.post_id || "");
  if (existingPostId) {
    await mergePostMetadata(admin, existingPostId, metadata, {
      content: String(live.title || "").trim(),
      video_url: hlsUrl,
      post_type: "live",
    });
    return existingPostId;
  }

  const { data: post, error: postError } = await admin
    .from("posts")
    .insert({
      user_id: userId,
      content: String(live.title || "").trim(),
      visibility: live.privacy === "friends" ? "friends" : "public",
      post_type: "live",
      video_url: hlsUrl,
      metadata,
    })
    .select("id")
    .single();
  if (postError) throw postError;
  return post.id as string;
}

async function requireOwnedRtmpSession(admin: SupabaseAdmin, sessionId: string, userId: string) {
  const { data, error: sessionError } = await admin
    .from("live_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError) throw sessionError;
  if (!data) throw new Error("Live session not found");
  if (data.host_user_id !== userId && data.owner_id !== userId) throw new Error("Only host can manage this live session");
  if (data.mode !== "rtmp_obs" && data.live_mode !== "rtmp_obs" && data.stream_provider !== "cloudflare_stream") {
    throw new Error("Not a Cloudflare OBS live session");
  }
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return error("Method not allowed", 405);

  try {
    const cfg = config();
    const body = await readBody(req);
    const action = String(body.action || "");
    const admin = createClient(cfg.supabaseUrl, cfg.serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const user = await getUser(req, cfg.supabaseUrl, cfg.anonKey, body);
    if (!user) return error("Authorization required", 401);

    if (action === "create") {
      const { data: existing, error: existingError } = await admin
        .from("live_sessions")
        .select("*")
        .eq("host_user_id", user.id)
        .eq("mode", "rtmp_obs")
        .in("status", ["waiting_for_obs", "source_connected", "ready_to_go_live", "live"])
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existingError) throw existingError;
      if (existing) {
        const encryptedExistingKey = typeof existing.stream_key_encrypted === "string" ? existing.stream_key_encrypted : "";
        const existingKey = encryptedExistingKey ? await decryptStreamKey(encryptedExistingKey) : null;
        await enableProducerInput(admin, existing, String(existing.id));
        return json(toResponse(existing, { streamKey: existingKey, reveal: true }));
      }

      const title = String(body.title || "").trim();
      const description = String(body.description || "").trim();
      const privacy = body.privacy === "friends" ? "friends" : "public";
      const liveSessionId = crypto.randomUUID();
      const channelName = `obs_${user.id}_${Date.now()}`;
      const liveInput = await createLiveInput({
        liveSessionId,
        userId: user.id,
        title,
        description,
      });
      const streamKey = liveInput.rtmps?.streamKey ?? "";
      const rtmpsUrl = liveInput.rtmps?.url ?? "";
      const playback = liveInput.playback?.hls || buildStreamPlaybackUrls(liveInput.uid).hls;
      const now = new Date().toISOString();

      const { data, error: insertError } = await admin
        .from("live_sessions")
        .insert({
          id: liveSessionId,
          host_user_id: user.id,
          owner_id: user.id,
          channel_name: channelName,
          source: "rtmp",
          mode: "rtmp_obs",
          live_mode: "rtmp_obs",
          stream_provider: "cloudflare_stream",
          cloudflare_live_input_id: liveInput.uid,
          rtmps_url: rtmpsUrl,
          stream_key: null,
          stream_key_encrypted: await encryptStreamKey(streamKey),
          stream_key_last_shown_at: now,
          stream_key_last_reset_at: now,
          rtmp_status: "waiting",
          hls_url: playback,
          hls_playback_url: playback,
          playback_url: playback,
          storage_provider: "cloudflare_stream",
          playback_provider: "cloudflare_stream",
          title,
          description,
          privacy,
          status: "waiting_for_obs",
          recording_status: "idle",
          archive_status: "pending",
          producer_active_at: now,
          producer_disconnected_at: null,
          producer_input_enabled: true,
        })
        .select("*")
        .single();

      if (insertError) throw insertError;
      return json(toResponse(data, { streamKey, reveal: true }));
    }

    const sessionId = String(body.live_session_id || body.session_id || "");
    if (!sessionId) return error("live_session_id is required", 400);
    const row = await requireOwnedRtmpSession(admin, sessionId, user.id);
    const encryptedKey = typeof row.stream_key_encrypted === "string" ? row.stream_key_encrypted : "";
    const streamKey = encryptedKey ? await decryptStreamKey(encryptedKey) : null;

    if (action === "host-session" || action === "credentials" || action === "stream-credentials") {
      await enableProducerInput(admin, row, sessionId);
      await admin
        .from("live_sessions")
        .update({ stream_key_last_shown_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", sessionId);
      return json(toResponse(row, { streamKey, reveal: true }));
    }

    if (action === "producer-heartbeat" || action === "heartbeat" || action === "producer-open") {
      if (row.status === "ended" || row.status === "posted") return json(toResponse(row, { streamKey, reveal: false }));
      await enableProducerInput(admin, row, sessionId);
      await syncCloudflareProducerState(admin, row, sessionId).catch((err) => {
        console.warn("[live-rtmp] producer heartbeat sync failed", err);
      });
      return json({ ok: true, ...toResponse(row, { streamKey, reveal: false }) });
    }

    if (action === "producer-disconnect" || action === "producer-close") {
      await markProducerClosed(admin, sessionId);
      return json({ ok: true, ...toResponse(row, { streamKey, reveal: false }) });
    }

    if (action === "copy-stream-key") {
      await admin
        .from("live_sessions")
        .update({ stream_key_last_shown_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", sessionId);
      return json({ stream_key_with_password: streamKey });
    }

    if (action === "status" || action === "start") {
      if (body.producer_active !== false && row.status !== "ended" && row.status !== "posted") {
        await enableProducerInput(admin, row, sessionId);
      }
      if (row.status !== "live" && row.status !== "ended" && isProducerStale(row) && row.producer_input_enabled !== false) {
        await disableProducerInput(admin, row, sessionId, "producer-stale");
        return json(toResponse(row, { streamKey, reveal: false }));
      }
      if (row.cloudflare_live_input_id && row.status !== "ended") {
        await syncCloudflareProducerState(admin, row, sessionId).catch((err) => {
          console.warn("[live-rtmp] Cloudflare producer sync failed", err);
        });
      }
      return json(toResponse(row, { streamKey, reveal: false }));
    }

    if (action === "save-details" || action === "update-details") {
      if (row.status === "ended" || row.status === "posted") return error("Cannot update details after live ended", 409);
      const title = String(body.title || "").trim();
      const description = String(body.description || "").trim();
      if (!title) return error("Title is required", 400);
      if (!description) return error("Description is required", 400);
      const connected = row.rtmp_status === "live" || row.status === "source_connected" || row.status === "ready_to_go_live" || row.status === "live";
      const nextStatus = row.status === "live" ? "live" : connected ? "ready_to_go_live" : "waiting_for_obs";
      const now = new Date().toISOString();
      const { data: updated, error: updateError } = await admin
        .from("live_sessions")
        .update({
          title,
          description,
          status: nextStatus,
          updated_at: now,
        })
        .eq("id", sessionId)
        .select("*")
        .single();
      if (updateError) throw updateError;
      return json(toResponse(updated, { streamKey, reveal: false }));
    }

    if (action === "go-live" || action === "go_live") {
      const title = String(row.title || "").trim();
      const description = String(row.description || "").trim();
      if (!title) return error("Title is required before going live", 400);
      if (!description) return error("Description is required before going live", 400);
      if (row.rtmp_status !== "live" && row.status !== "source_connected" && row.status !== "ready_to_go_live") {
        return error("OBS source is not connected", 409);
      }
      const hlsUrl = String(row.hls_url || row.hls_playback_url || row.playback_url || "");
      if (!hlsUrl) return error("Playback URL is not ready yet", 409);

      const now = new Date().toISOString();
      const livePostId = await createOrUpdateLivePost({ admin, live: row, userId: user.id, hlsUrl });
      const { data: updated, error: updateError } = await admin
        .from("live_sessions")
        .update({
          status: "live",
          rtmp_status: "live",
          started_at: row.started_at ?? now,
          go_live_clicked_at: row.go_live_clicked_at ?? now,
          source_connected_at: row.source_connected_at ?? now,
          live_post_id: livePostId,
          post_id: livePostId,
          playback_url: hlsUrl,
          hls_url: hlsUrl,
          hls_playback_url: hlsUrl,
          recording_status: "recording",
          updated_at: now,
        })
        .eq("id", sessionId)
        .select("*")
        .single();
      if (updateError) throw updateError;
      return json({ ...toResponse(updated, { streamKey, reveal: false }), live_post_id: livePostId });
    }

    if (action === "regenerate" || action === "reset-stream-key") {
      if (row.status === "live" || row.rtmp_status === "live" || row.status === "source_connected" || row.status === "ready_to_go_live") {
        return error("Cannot reset stream key while OBS is connected or live", 409);
      }
      if (row.status === "ended") return error("Cannot reset stream key after live ended", 409);

      if (row.cloudflare_live_input_id) {
        await disableLiveInput(row.cloudflare_live_input_id).catch((err) => {
          console.warn("[live-rtmp] disable old Live Input failed", err);
        });
      }

      const liveInput = await createLiveInput({
        liveSessionId: sessionId,
        userId: user.id,
        title: String(row.title || ""),
        description: String(row.description || ""),
      });
      const nextKey = liveInput.rtmps?.streamKey ?? "";
      const rtmpsUrl = liveInput.rtmps?.url ?? "";
      const playback = liveInput.playback?.hls || buildStreamPlaybackUrls(liveInput.uid).hls;
      const now = new Date().toISOString();

      const { data: updated, error: updateError } = await admin
        .from("live_sessions")
        .update({
          cloudflare_live_input_id: liveInput.uid,
          rtmps_url: rtmpsUrl,
          stream_key: null,
          stream_key_encrypted: await encryptStreamKey(nextKey),
          stream_key_last_shown_at: now,
          stream_key_last_reset_at: now,
          rtmp_status: "waiting",
          status: "waiting_for_obs",
          source_connected_at: null,
          go_live_clicked_at: null,
          cloudflare_video_uid: null,
          hls_url: playback,
          hls_playback_url: playback,
          playback_url: playback,
          updated_at: now,
        })
        .eq("id", sessionId)
        .select("*")
        .single();
      if (updateError) throw updateError;
      return json(toResponse(updated, { streamKey: nextKey, reveal: true }));
    }

    if (action === "end") {
      const now = new Date().toISOString();
      if (row.cloudflare_live_input_id) {
        await disableLiveInput(row.cloudflare_live_input_id).catch((err) => {
          console.warn("[live-rtmp] disable Live Input failed", err);
        });
      }

      await admin
        .from("live_sessions")
        .update({
          status: "ended",
          rtmp_status: "ended",
          ended_at: row.ended_at ?? now,
          rtmp_ended_at: row.rtmp_ended_at ?? now,
          recording_status: row.cloudflare_video_uid ? "processing" : "processing",
          archive_status: row.archive_status ?? "pending",
          updated_at: now,
        })
        .eq("id", sessionId);

      if (row.post_id) {
        await mergePostMetadata(admin, row.post_id, {
          live_session_id: row.id,
          live_status: "ended",
          live_mode: "rtmp_obs",
          mode: "rtmp_obs",
          stream_provider: "cloudflare_stream",
          replay_status: "processing",
          archive_status: row.archive_status ?? "pending",
          ended_at: row.ended_at ?? now,
        });
      }

      return json({ ok: true, status: "ended", live_session_id: sessionId });
    }

    return error("Unknown RTMP live action", 404);
  } catch (err) {
    console.error("[live-rtmp]", err);
    return error(err instanceof Error ? err.message : "Unknown error", 500);
  }
});

