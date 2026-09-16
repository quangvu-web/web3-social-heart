import { createClient } from "npm:@supabase/supabase-js@2";
import { buildRtcToken } from "../_shared/agoraToken.ts";
import { callAgora, getStorageConfig, loadAgoraCreds } from "../_shared/agoraRecording.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type Body = {
  sessionId?: string;
  channelName?: string;
  recorderUid?: string | number;
  mode?: "mix" | "individual";
  mediaReady?: boolean;
  hasAudio?: boolean;
  hasVideo?: boolean;
};

const ACTIVE_RECORDING_STATUSES = ["acquiring", "starting", "started", "recording", "stopping"];

function maxActiveRecordings(): number {
  const configured = Number(Deno.env.get("AGORA_CLOUD_RECORDING_MAX_ACTIVE") || "20");
  return Number.isFinite(configured) && configured >= 0 ? configured : 20;
}

function maxIdleTimeSeconds(): number {
  const configured = Number(Deno.env.get("AGORA_RECORDING_MAX_IDLE_TIME") || "60");
  if (!Number.isFinite(configured)) return 60;
  return Math.min(60, Math.max(30, Math.round(configured)));
}

async function activeAgoraRecordingCount(client: ReturnType<typeof createClient>) {
  const { count, error } = await client
    .from("live_sessions")
    .select("id", { count: "exact", head: true })
    .eq("recording_provider", "agora")
    .in("recording_status", ACTIVE_RECORDING_STATUSES);
  if (error) throw error;
  return count ?? 0;
}

async function markFallback(
  client: ReturnType<typeof createClient>,
  sessionId: string,
  code: string,
  message: string,
) {
  console.warn("[live-recording-start] fallback recording", { sessionId, code, message });
  await client
    .from("live_sessions")
    .update({
      recording_provider: "browser",
      recording_status: "failed",
      recording_error_code: code,
      recording_error_message: message,
      recording_error: message,
      error_message: message,
      browser_recording_status: "idle",
      browser_recording_warning: "Agora Cloud Recording unavailable; browser fallback recommended.",
      recording_retry_count: (await nextRetryCount(client, sessionId)),
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId);
}

async function nextRetryCount(client: ReturnType<typeof createClient>, sessionId: string) {
  const { data } = await client
    .from("live_sessions")
    .select("recording_retry_count")
    .eq("id", sessionId)
    .maybeSingle();
  return Number(data?.recording_retry_count || 0) + 1;
}

async function queryExistingRecording(creds: ReturnType<typeof loadAgoraCreds>, params: {
  channelName: string;
  recorderUid: string;
  resourceId: string;
  sid: string;
  mode: "mix" | "individual";
}) {
  return callAgora(
    creds,
    "GET",
    `/cloud_recording/resourceid/${params.resourceId}/sid/${params.sid}/mode/${params.mode}/query`,
    undefined,
  );
}

async function stopExistingRecording(creds: ReturnType<typeof loadAgoraCreds>, params: {
  channelName: string;
  recorderUid: string;
  resourceId: string;
  sid: string;
  mode: "mix" | "individual";
  reason: string;
}) {
  console.warn("[live-recording-start] stop stale recording before restart", {
    channelName: params.channelName,
    resourceId: params.resourceId,
    sid: params.sid,
    reason: params.reason,
  });
  return callAgora(creds, "POST", `/cloud_recording/resourceid/${params.resourceId}/sid/${params.sid}/mode/${params.mode}/stop`, {
    cname: params.channelName,
    uid: params.recorderUid,
    clientRequest: {},
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Authorization required" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return jsonResponse({ error: "Supabase configuration missing" }, 500);
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return jsonResponse({ error: "Invalid token" }, 401);

    const body = (await req.json().catch(() => null)) as Body | null;
    const sessionId = body?.sessionId;
    const mode = body?.mode || "mix";
    if (!sessionId) return jsonResponse({ error: "sessionId is required" }, 400);
    if (body?.mediaReady !== true || (!body?.hasAudio && !body?.hasVideo)) {
      return jsonResponse({
        recordingAvailable: false,
        fallbackRecordingRecommended: true,
        fallbackProvider: "browser",
        recordingErrorCode: "HOST_MEDIA_NOT_READY",
        recordingErrorMessage: "Host audio/video tracks are not published yet.",
      }, 409);
    }

    const { data: liveSession, error: sessionError } = await serviceClient
      .from("live_sessions")
      .select([
        "id",
        "user_id",
        "host_user_id",
        "owner_id",
        "channel_name",
        "agora_channel",
        "recording_uid",
        "status",
        "recording_provider",
        "recording_status",
        "recording_resource_id",
        "recording_sid",
        "resource_id",
        "sid",
        "recording_retry_count",
      ].join(","))
      .eq("id", sessionId)
      .maybeSingle();

    if (sessionError) return jsonResponse({ error: sessionError.message }, 400);
    if (!liveSession) return jsonResponse({ error: "Live session not found" }, 404);
    const ownerId = liveSession.user_id || liveSession.host_user_id || liveSession.owner_id;
    if (ownerId !== user.id) {
      return jsonResponse({ error: "Only host can start recording" }, 403);
    }
    if (!["live", "reconnecting", "disconnected"].includes(String(liveSession.status))) {
      return jsonResponse({ error: "Live session has ended" }, 409);
    }

    const channelName = (body?.channelName || liveSession.agora_channel || liveSession.channel_name || "").trim();
    if (!channelName) return jsonResponse({ error: "channelName is required" }, 400);

    const recorderUid = String(body?.recorderUid || liveSession.recording_uid || "");
    if (!recorderUid) return jsonResponse({ error: "recorderUid is required" }, 400);

    const existingResourceId = String(liveSession.recording_resource_id || liveSession.resource_id || "");
    const existingSid = String(liveSession.recording_sid || liveSession.sid || "");
    const existingStatus = String(liveSession.recording_status || "idle");
    const creds = loadAgoraCreds();

    if (existingResourceId && existingSid && ACTIVE_RECORDING_STATUSES.includes(existingStatus)) {
      const queryRes = await queryExistingRecording(creds, {
        channelName,
        recorderUid,
        resourceId: existingResourceId,
        sid: existingSid,
        mode,
      }).catch((error) => ({ status: 0, rawText: String(error?.message || error), body: { error: String(error?.message || error) } }));
      await serviceClient
        .from("live_sessions")
        .update({
          last_recording_query_at: new Date().toISOString(),
          last_recording_query_result: {
            status: queryRes.status,
            body: queryRes.body,
            duplicate_guard: true,
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", sessionId);

      if (queryRes.status >= 200 && queryRes.status < 300) {
        console.log("[live-recording-start] duplicate active recording refused", {
          liveSessionId: sessionId,
          channelName,
          resourceId: existingResourceId,
          sid: existingSid,
        });
        return jsonResponse({
          resourceId: existingResourceId,
          sid: existingSid,
          recordingAvailable: true,
          fallbackRecordingRecommended: false,
          fallbackProvider: null,
          duplicate: true,
        });
      }

      const stopRes = await stopExistingRecording(creds, {
        channelName,
        recorderUid,
        resourceId: existingResourceId,
        sid: existingSid,
        mode,
        reason: "duplicate_start_stale_identifier",
      }).catch((error) => ({ status: 0, rawText: String(error?.message || error), body: { error: String(error?.message || error) } }));
      const alreadyGone = stopRes.status === 404 || stopRes.body?.code === 404;
      await serviceClient
        .from("live_sessions")
        .update({
          stop_requested_at: new Date().toISOString(),
          stopped_at: (stopRes.status >= 200 && stopRes.status < 300) || alreadyGone ? new Date().toISOString() : null,
          watchdog_stop_result: {
            status: stopRes.status,
            body: stopRes.body,
            reason: "duplicate_start_stale_identifier",
          },
          recording_retry_count: Number(liveSession.recording_retry_count || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sessionId);

      if (!((stopRes.status >= 200 && stopRes.status < 300) || alreadyGone)) {
        const message = `Could not stop stale Agora recording before restart: ${JSON.stringify(stopRes.body).slice(0, 300)}`;
        await markFallback(serviceClient, sessionId, "AGORA_STALE_STOP_FAILED", message);
        return jsonResponse({
          recordingAvailable: false,
          fallbackRecordingRecommended: true,
          fallbackProvider: "browser",
          recordingErrorCode: "AGORA_STALE_STOP_FAILED",
          recordingErrorMessage: "Agora stale recording stop failed; browser fallback recommended.",
        });
      }
    }

    const activeCount = await activeAgoraRecordingCount(serviceClient);
    const maxActive = maxActiveRecordings();
    if (activeCount >= maxActive) {
      const message = `Agora Cloud Recording local active guard reached (${activeCount}/${maxActive}).`;
      await markFallback(serviceClient, sessionId, "AGORA_PCW_LIMIT_LOCAL_GUARD", message);
      return jsonResponse({
        recordingAvailable: false,
        fallbackRecordingRecommended: true,
        fallbackProvider: "browser",
        recordingErrorCode: "AGORA_PCW_LIMIT_LOCAL_GUARD",
        recordingErrorMessage: message,
      });
    }

    const now = new Date().toISOString();
    await serviceClient
      .from("live_sessions")
      .update({
        recording_provider: "agora",
        recording_status: "starting",
        browser_recording_status: "idle",
        last_media_activity_at: now,
        updated_at: now,
      })
      .eq("id", sessionId);

    const { token: recorderToken } = buildRtcToken({
      appId: creds.appId,
      appCertificate: Deno.env.get("AGORA_APP_CERTIFICATE")!,
      channel: channelName,
      uid: recorderUid,
      role: "recorder",
      expireSeconds: 24 * 60 * 60,
    });

    // IMPORTANT: must match the temp_object_key written by live-webcam-start
    // (`temp/live/{ownerId}/{sessionId}`) so process-live-recordings can find
    // the files Agora writes into R2 TEMP.
    const storageConfig = getStorageConfig(sessionId, ["temp", "live", ownerId, sessionId]);
    const maxIdleTime = maxIdleTimeSeconds();
    console.log("[live-recording-start] recording config", {
      channelName,
      liveSessionId: sessionId,
      recordingUid: recorderUid,
      streamTypes: 2,
      subscribeVideoUids: "all",
      subscribeAudioUids: "all",
      storagePath: sessionId,
      storageVendor: storageConfig.vendor,
      storageBucket: storageConfig.bucket,
      activeCount,
      maxActive,
      maxIdleTime,
      hasAudio: body.hasAudio,
      hasVideo: body.hasVideo,
    });

    try {
      const acquireRes = await callAgora(creds, "POST", "/cloud_recording/acquire", {
        cname: channelName,
        uid: recorderUid,
        clientRequest: { resourceExpiredHour: 24 },
      });
      console.log("[live-recording-start] acquire recording", {
        liveSessionId: sessionId,
        channelName,
        recordingUid: recorderUid,
        status: acquireRes.status,
        response: acquireRes.rawText.slice(0, 300),
      });
      const resourceId = acquireRes.body?.resourceId;
      if (acquireRes.status < 200 || acquireRes.status >= 300 || typeof resourceId !== "string") {
        const message = `Agora acquire failed: ${JSON.stringify(acquireRes.body).slice(0, 300)}`;
        await markFallback(serviceClient, sessionId, "AGORA_ACQUIRE_FAILED", message);
        return jsonResponse({
          recordingAvailable: false,
          fallbackRecordingRecommended: true,
          fallbackProvider: "browser",
          recordingErrorCode: "AGORA_ACQUIRE_FAILED",
          recordingErrorMessage: "Agora Cloud Recording acquire failed.",
        });
      }

      await serviceClient
        .from("live_sessions")
        .update({
          recording_resource_id: resourceId,
          resource_id: resourceId,
          recording_acquired_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", sessionId);

      const startRes = await callAgora(
        creds,
        "POST",
        `/cloud_recording/resourceid/${resourceId}/mode/${mode}/start`,
        {
          cname: channelName,
          uid: recorderUid,
          clientRequest: {
            token: recorderToken,
            recordingConfig: {
              channelType: 1,
              streamTypes: 2,
              maxIdleTime,
              videoStreamType: 0,
              transcodingConfig: {
                width: 1280,
                height: 720,
                fps: 15,
                bitrate: 1200,
                mixedVideoLayout: 1,
              },
            },
            recordingFileConfig: {
              avFileType: ["hls", "mp4"],
            },
            storageConfig,
          },
        },
      );
      console.log("[live-recording-start] start recording", {
        liveSessionId: sessionId,
        channelName,
        resourceId,
        status: startRes.status,
        response: startRes.rawText.slice(0, 400),
      });

      const sid = startRes.body?.sid;
      if (startRes.status < 200 || startRes.status >= 300 || typeof sid !== "string") {
        const message = `Agora start failed: ${JSON.stringify(startRes.body).slice(0, 300)}`;
        await markFallback(serviceClient, sessionId, "AGORA_START_FAILED", message);
        return jsonResponse({
          recordingAvailable: false,
          fallbackRecordingRecommended: true,
          fallbackProvider: "browser",
          recordingErrorCode: "AGORA_START_FAILED",
          recordingErrorMessage: "Agora Cloud Recording start failed.",
        });
      }

      await serviceClient
        .from("live_sessions")
        .update({
          recording_provider: "agora",
          recording_status: "recording",
          recording_resource_id: resourceId,
          recording_sid: sid,
          resource_id: resourceId,
          sid,
          stopped_at: null,
          stop_requested_at: null,
          recording_started_at: new Date().toISOString(),
          last_media_activity_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", sessionId);

      console.log("[live-recording-start] recording started", {
        liveSessionId: sessionId,
        channelName,
        resourceId,
        sid,
        reason: "host_joined_and_media_published",
      });

      return jsonResponse({
        resourceId,
        sid,
        recordingAvailable: true,
        fallbackRecordingRecommended: false,
        fallbackProvider: null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Agora recording start exception";
      await markFallback(serviceClient, sessionId, "AGORA_START_EXCEPTION", message);
      return jsonResponse({
        recordingAvailable: false,
        fallbackRecordingRecommended: true,
        fallbackProvider: "browser",
        recordingErrorCode: "AGORA_START_EXCEPTION",
        recordingErrorMessage: message,
      });
    }
  } catch (error: any) {
    console.error("[live-recording-start] error:", error?.message || error);
    return jsonResponse({ error: error?.message || "Unexpected error" }, 500);
  }
});
