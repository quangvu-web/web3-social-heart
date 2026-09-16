import { createClient } from "npm:@supabase/supabase-js@2";
import { archiveReplayToR2 } from "../_shared/archiveReplay.ts";
import { disableLiveInput, resolveLatestVideoUidForLiveInput } from "../_shared/cloudflareStreamService.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, webhook-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function parseSignature(header: string): { time: string; sig1: string } | null {
  const parts = Object.fromEntries(
    header.split(",").map((part) => {
      const [key, ...rest] = part.trim().split("=");
      return [key, rest.join("=")];
    }),
  );
  if (!parts.time || !parts.sig1) return null;
  return { time: parts.time, sig1: parts.sig1 };
}

function hex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

async function verifySignature(rawBody: string, header: string | null, secret: string): Promise<boolean> {
  if (!header || !secret) return false;
  const parsed = parseSignature(header);
  if (!parsed) return false;

  const timestamp = Number(parsed.time);
  if (!Number.isFinite(timestamp)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > 300) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const expected = hex(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${parsed.time}.${rawBody}`)),
  );
  return constantTimeEqual(expected, parsed.sig1);
}

function buildUrls(uid: string, customerCode: string) {
  const base = customerCode
    ? `https://customer-${customerCode}.cloudflarestream.com/${uid}`
    : `https://videodelivery.net/${uid}`;
  return {
    hls: `${base}/manifest/video.m3u8`,
    dash: `${base}/manifest/video.mpd`,
    mp4: `${base}/downloads/default.mp4`,
    thumbnail: `${base}/thumbnails/thumbnail.jpg?time=3s`,
  };
}

function stringFrom(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function liveInputIdFromPayload(payload: Record<string, unknown>): string {
  const direct = [
    payload.liveInput,
    payload.live_input,
    payload.liveInputUID,
    payload.liveInputUid,
    payload.live_input_uid,
  ].map(stringFrom).find(Boolean);
  if (direct) return direct;

  const input = payload.input && typeof payload.input === "object" ? payload.input as Record<string, unknown> : null;
  const nested = input ? [input.uid, input.id].map(stringFrom).find(Boolean) : "";
  if (nested) return nested;

  const meta = payload.meta && typeof payload.meta === "object" ? payload.meta as Record<string, unknown> : null;
  return meta ? [meta.live_input_id, meta.cloudflare_live_input_id].map(stringFrom).find(Boolean) || "" : "";
}

function eventNameFromPayload(payload: Record<string, unknown>): string {
  return [
    payload.event,
    payload.type,
    payload.name,
    payload.eventType,
    payload.event_type,
    payload.status && typeof payload.status === "object" ? (payload.status as Record<string, unknown>).state : "",
  ].map(stringFrom).find(Boolean)?.toLowerCase() || "";
}

async function mergePostMetadata(
  supabase: ReturnType<typeof createClient>,
  postId: string,
  patch: Record<string, unknown>,
  extra: Record<string, unknown> = {},
) {
  const { data: post } = await supabase.from("posts").select("metadata").eq("id", postId).maybeSingle();
  await supabase
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

async function ensureLivePostForObs(
  supabase: ReturnType<typeof createClient>,
  live: Record<string, unknown>,
  playbackHls: string,
) {
  const now = new Date().toISOString();
  const metadata = {
    live_session_id: live.id,
    live_title: live.title,
    live_status: "live",
    live_mode: "rtmp_obs",
    mode: "rtmp_obs",
    stream_provider: "cloudflare_stream",
    cloudflare_live_input_id: live.cloudflare_live_input_id,
    hls_url: playbackHls,
    hls_playback_url: playbackHls,
    playback_url: playbackHls,
    viewer_count: live.viewer_count ?? 0,
  };

  if (live.post_id) {
    await mergePostMetadata(supabase, String(live.post_id), metadata, { video_url: null });
    return String(live.post_id);
  }

  const { data: post, error } = await supabase
    .from("posts")
    .insert({
      user_id: live.host_user_id || live.owner_id,
      content: live.title || "Dang LIVE bang OBS tren FUN Profile",
      visibility: live.privacy === "friends" ? "friends" : "public",
      post_type: "live",
      video_url: null,
      metadata,
    })
    .select("id")
    .single();
  if (error) throw error;

  await supabase
    .from("live_sessions")
    .update({ post_id: post.id, posted_at: now, updated_at: now })
    .eq("id", live.id);
  return post.id;
}

async function handleObsLiveEvent(params: {
  supabase: ReturnType<typeof createClient>;
  payload: Record<string, unknown>;
  liveInputId: string;
  eventName: string;
  customerCode: string;
}) {
  const { supabase, payload, liveInputId, eventName, customerCode } = params;
  const isConnected =
    eventName.includes("connected") ||
    eventName.includes("live_input.connected") ||
    eventName.includes("live.connected");
  const isDisconnected =
    eventName.includes("disconnected") ||
    eventName.includes("live_input.disconnected") ||
    eventName.includes("live.disconnected");

  if (!liveInputId || (!isConnected && !isDisconnected)) return false;

  const { data: live, error } = await supabase
    .from("live_sessions")
    .select("*")
    .eq("cloudflare_live_input_id", liveInputId)
    .maybeSingle();
  if (error) throw error;
  if (!live) return true;

  const now = new Date().toISOString();
  const playbackHls =
    stringFrom(payload.playback && typeof payload.playback === "object" ? (payload.playback as Record<string, unknown>).hls : "") ||
    buildUrls(liveInputId, customerCode).hls;

  if (isConnected) {
    // Producer presence gate: if the Live Producer page isn't open (no recent
    // heartbeat), refuse to mark the session as connected and defensively
    // disable the Cloudflare Live Input again so OBS stops pushing.
    if (live.status !== "live" && live.producer_input_enabled === false) {
      await disableLiveInput(liveInputId).catch((err) => {
        console.warn("[stream-webhook] defensive disableLiveInput failed", err);
      });
      console.log("[stream-webhook] connected event gated: producer offline", { liveInputId, sessionId: live.id });
      return true;
    }
    const hasDetails = String(live.title || "").trim().length > 0 && String(live.description || "").trim().length > 0;
    const nextStatus = live.status === "live" ? "live" : hasDetails ? "ready_to_go_live" : "source_connected";
    await supabase
      .from("live_sessions")
      .update({
        status: nextStatus,
        rtmp_status: "live",
        rtmp_started_at: live.rtmp_started_at ?? now,
        source_connected_at: live.source_connected_at ?? now,
        recording_status: "recording",
        playback_url: playbackHls,
        hls_url: playbackHls,
        hls_playback_url: playbackHls,
        updated_at: now,
      })
      .eq("id", live.id);
    if (live.status === "live" && (live.live_post_id || live.post_id)) {
      await mergePostMetadata(supabase, String(live.live_post_id || live.post_id), {
        live_session_id: live.id,
        live_status: "live",
        replay_status: null,
        archive_status: "pending",
        hls_url: playbackHls,
        hls_playback_url: playbackHls,
        playback_url: playbackHls,
      });
    }
    return true;
  }

  if (isDisconnected) {
    // Try to link the recorded video UID immediately so archive pipeline can run.
    let resolvedVideoUid: string | null = stringFrom(live.cloudflare_video_uid);
    if (!resolvedVideoUid) {
      resolvedVideoUid = await resolveLatestVideoUidForLiveInput(liveInputId);
    }

    const wasPublic = live.status === "live" || !!live.go_live_clicked_at || !!live.live_post_id || !!live.post_id;
    await supabase
      .from("live_sessions")
      .update({
        status: wasPublic ? "ended" : "waiting_for_obs",
        rtmp_status: "ended",
        rtmp_ended_at: live.rtmp_ended_at ?? now,
        ended_at: wasPublic ? live.ended_at ?? now : live.ended_at,
        recording_status: wasPublic ? "processing" : "idle",
        archive_status: "pending",
        cloudflare_video_uid: resolvedVideoUid ?? live.cloudflare_video_uid ?? null,
        updated_at: now,
      })
      .eq("id", live.id);

    if (wasPublic && (live.live_post_id || live.post_id)) {
      await mergePostMetadata(supabase, String(live.live_post_id || live.post_id), {
        live_session_id: live.id,
        live_status: "ended",
        live_mode: "rtmp_obs",
        mode: "rtmp_obs",
        stream_provider: "cloudflare_stream",
        replay_status: "processing",
        archive_status: "pending",
        ended_at: live.ended_at ?? now,
        cloudflare_video_uid: resolvedVideoUid ?? live.cloudflare_video_uid ?? null,
      });
    }

    // Kick off archive pipeline ASAP (non-blocking on failure — retry-archive-replays will catch up).
    if (wasPublic && resolvedVideoUid) {
      archiveReplayToR2({ supabase, liveSessionId: String(live.id) }).catch((err) => {
        console.warn("[stream-webhook] archiveReplayToR2 (disconnected) failed", err);
      });
    }
    return true;
  }

  return false;
}

/**
 * Enable MP4 downloads on a Cloudflare Stream video.
 * Returns { url, ready } — `url` is the MP4 download URL when status is "ready",
 * otherwise null. Cloudflare may take a few minutes to render.
 */
async function enableMp4Download(uid: string): Promise<{ url: string | null; ready: boolean }> {
  const accountId = Deno.env.get("CLOUDFLARE_ACCOUNT_ID") ?? "";
  const apiToken = Deno.env.get("CLOUDFLARE_STREAM_API_TOKEN") ?? "";
  if (!accountId || !apiToken) {
    console.warn("[enableMp4Download] Missing CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_STREAM_API_TOKEN");
    return { url: null, ready: false };
  }
  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${uid}/downloads`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
      },
    );
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.warn(`[enableMp4Download] HTTP ${res.status}`, json);
      return { url: null, ready: false };
    }
    const def = json?.result?.default;
    const url = typeof def?.url === "string" ? def.url : null;
    const ready = def?.status === "ready";
    return { url: ready ? url : null, ready };
  } catch (err) {
    console.warn("[enableMp4Download] error", err);
    return { url: null, ready: false };
  }
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const rawBody = await req.text();
    const webhookSecret =
      Deno.env.get("CLOUDFLARE_WEBHOOK_SECRET") ??
      Deno.env.get("CLOUDFLARE_STREAM_WEBHOOK_SECRET") ??
      "";

    // Bootstrap mode: secret chua duoc cau hinh -> tra 200 de Cloudflare reveal secret.
    // KHONG ghi DB vi payload chua duoc xac thuc.
    if (!webhookSecret) {
      console.warn("[stream-webhook] BOOTSTRAP MODE: CLOUDFLARE_STREAM_WEBHOOK_SECRET is not set. Skipping signature verification and DB writes.");
      return json({ ok: true, bootstrap: true, message: "Set CLOUDFLARE_STREAM_WEBHOOK_SECRET to enable processing." });
    }

    const ok = await verifySignature(rawBody, req.headers.get("Webhook-Signature"), webhookSecret);
    if (!ok) return json({ error: "Invalid webhook signature" }, 401);

    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    const liveInputId = liveInputIdFromPayload(payload);
    const eventName = eventNameFromPayload(payload);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const customerCode = Deno.env.get("CLOUDFLARE_STREAM_CUSTOMER_CODE") ?? "";
    if (!supabaseUrl || !serviceRoleKey) return json({ error: "Missing Supabase configuration" }, 500);

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const handledLiveEvent = await handleObsLiveEvent({
      supabase,
      payload,
      liveInputId,
      eventName,
      customerCode,
    });
    if (handledLiveEvent) return json({ ok: true, event: eventName || "live_input" });

    const uid = String(payload.uid || "");
    if (!uid) return json({ error: "Missing uid" }, 400);

    const { data: existingReplay, error: replayError } = await supabase
      .from("live_replays")
      .select("id, live_session_id")
      .eq("stream_uid", uid)
      .maybeSingle();
    if (replayError) throw replayError;
    let replay = existingReplay;
    if (!replay) {
      const meta = (payload.meta && typeof payload.meta === "object")
        ? payload.meta as Record<string, unknown>
        : {};
      const liveSessionId = typeof meta.live_session_id === "string" ? meta.live_session_id : "";
      const userId = typeof meta.user_id === "string" ? meta.user_id : "";

      if (!liveSessionId || !userId) {
        if (!liveInputId) return json({ ok: true, ignored: "unknown uid" });
        const { data: liveByInput, error: liveByInputError } = await supabase
          .from("live_sessions")
          .select("id, host_user_id, owner_id")
          .eq("cloudflare_live_input_id", liveInputId)
          .maybeSingle();
        if (liveByInputError) throw liveByInputError;
        if (!liveByInput?.id || (!liveByInput.host_user_id && !liveByInput.owner_id)) {
          return json({ ok: true, ignored: "unknown uid" });
        }
        meta.live_session_id = liveByInput.id;
        meta.user_id = liveByInput.host_user_id || liveByInput.owner_id;
      }

      const resolvedLiveSessionId = typeof meta.live_session_id === "string" ? meta.live_session_id : "";
      const resolvedUserId = typeof meta.user_id === "string" ? meta.user_id : "";

      const { data: insertedReplay, error: insertReplayError } = await supabase
        .from("live_replays")
        .insert({
          user_id: resolvedUserId,
          live_session_id: resolvedLiveSessionId,
          stream_uid: uid,
          status: "processing",
        })
        .select("id, live_session_id")
        .single();
      if (insertReplayError) throw insertReplayError;
      replay = insertedReplay;
    }

    const statusPayload = payload.status && typeof payload.status === "object"
      ? payload.status as Record<string, unknown>
      : {};
    const playbackPayload = payload.playback && typeof payload.playback === "object"
      ? payload.playback as Record<string, unknown>
      : {};
    const state = String(statusPayload.state || "");
    const errorText =
      statusPayload.errorReasonText ||
      statusPayload.errReasonText ||
      statusPayload.errorReasonCode ||
      statusPayload.errReasonCode ||
      "";

    const isVideoReady =
      payload.readyToStream === true &&
      (!state || ["ready", "live-inprogress"].includes(state.toLowerCase()));

    if (isVideoReady) {
      const urls = buildUrls(uid, customerCode);
      const playbackHls = String(playbackPayload.hls || urls.hls);
      const playbackDash = String(playbackPayload.dash || urls.dash);
      const thumbnailUrl = String(payload.thumbnail || urls.thumbnail);
      const durationSeconds = Number.isFinite(Number(payload.duration))
        ? Math.round(Number(payload.duration))
        : null;
      const size = Number.isFinite(Number(payload.size)) ? Number(payload.size) : null;

      // Kick off MP4 render. URL only stored when CF reports status === "ready".
      const mp4 = await enableMp4Download(uid);
      const playbackMp4: string | null = mp4.url;

      const { data: updatedReplay, error: updateError } = await supabase
        .from("live_replays")
        .update({
          status: "ready",
          archive_status: "pending",
          cloudflare_playback_url: playbackHls,
          cloudflare_mp4_download_url: playbackMp4,
          playback_hls: playbackHls,
          playback_dash: playbackDash,
          playback_mp4: playbackMp4,
          thumbnail_url: thumbnailUrl,
          duration_seconds: durationSeconds,
          filesize_bytes: size,
          error_message: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", replay.id)
        .select("live_session_id")
        .single();
      if (updateError) throw updateError;

      const { data: live } = await supabase
        .from("live_sessions")
        .select("id, post_id, live_post_id, status, go_live_clicked_at")
        .eq("id", updatedReplay.live_session_id)
        .maybeSingle();
      const wasPublic = live?.status === "live" || live?.status === "ended" || !!live?.go_live_clicked_at || !!live?.live_post_id || !!live?.post_id;

      if (wasPublic && (live?.live_post_id || live?.post_id)) {
        const livePostId = live.live_post_id || live.post_id;
        const { data: post } = await supabase
          .from("posts")
          .select("metadata")
          .eq("id", livePostId)
          .maybeSingle();
        const metadata = {
          ...((post?.metadata as Record<string, unknown> | null) || {}),
          live_status: "ended",
          replay_status: "ready",
          replay_ready_at: new Date().toISOString(),
          archive_status: "pending",
          playback_type: "cloudflare_stream",
          playback_url: playbackHls,
          playback_hls: playbackHls,
          playback_dash: playbackDash,
          playback_mp4: playbackMp4,
          stream_uid: uid,
          thumbnail_url: thumbnailUrl,
          duration_seconds: durationSeconds,
        };

        await supabase
          .from("posts")
          .update({ video_url: playbackHls, metadata })
          .eq("id", livePostId);
      }


      await supabase
        .from("live_sessions")
        .update({
          recording_status: "ready",
          status: wasPublic ? "processing" : "waiting_for_obs",
          archive_status: "pending",
          cloudflare_playback_url: playbackHls,
          cloudflare_mp4_download_url: playbackMp4,
          recording_ready_at: new Date().toISOString(),
          cloudflare_video_uid: uid,
          recording_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", updatedReplay.live_session_id);

      if (wasPublic) {
        await archiveReplayToR2({ supabase, replayId: replay.id });
      }
    } else if (state === "error") {
      await supabase
        .from("live_replays")
        .update({
          status: "failed",
          error_message: errorText || "Cloudflare Stream processing failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", replay.id);

      await supabase
        .from("live_sessions")
        .update({
          recording_status: "failed",
          cloudflare_video_uid: uid,
          recording_error: errorText || "Cloudflare Stream processing failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", replay.live_session_id);
    } else {
      await supabase
        .from("live_replays")
        .update({ status: "processing", updated_at: new Date().toISOString() })
        .eq("id", replay.id)
        .in("status", ["uploading", "queued", "processing"]);
    }

    return json({ ok: true });
  } catch (error) {
    console.error("[stream-webhook]", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
