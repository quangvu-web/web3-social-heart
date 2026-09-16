import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { callAgora, loadAgoraCreds } from "../_shared/agoraRecording.ts";
import { updateRecordingLayout } from "../_shared/liveGuest.ts";
import { forceEndLive } from "../_shared/liveEnd.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const WATCHDOG_STALE_MS = 30_000;
const CLEANUP_STALE_MS = 60_000;
const FORCE_END_MS = 90_000;

type LiveRow = {
  id: string;
  user_id: string | null;
  host_user_id: string | null;
  owner_id: string | null;
  status: string;
  client_state: string | null;
  started_at: string | null;
  ended_at: string | null;
  last_heartbeat_at: string | null;
  last_host_heartbeat_at: string | null;
  last_media_activity_at: string | null;
  host_heartbeat_at: string | null;
  disconnect_detected_at: string | null;
  cleanup_started_at: string | null;
  cleanup_finished_at: string | null;
  end_reason: string | null;
  agora_channel: string | null;
  channel_name: string | null;
  recording_uid: number | null;
  recording_provider: string | null;
  recording_status: string | null;
  recording_resource_id: string | null;
  recording_sid: string | null;
  recording_retry_count: number | null;
  stop_requested_at: string | null;
  stopped_at: string | null;
  resource_id: string | null;
  sid: string | null;
  live_post_id: string | null;
  post_id: string | null;
  created_at: string;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function nowIso() {
  return new Date().toISOString();
}

function msSince(timestamp: string | null | undefined, fallback: string) {
  const value = Date.parse(timestamp || fallback);
  return Number.isFinite(value) ? Date.now() - value : Number.POSITIVE_INFINITY;
}

function durationSeconds(row: LiveRow, endedAt: string) {
  const startMs = Date.parse(row.started_at || row.created_at);
  const endMs = Date.parse(endedAt);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null;
  return Math.max(0, Math.round((endMs - startMs) / 1000));
}

function safeAgoraSummary(status: number | null, body: unknown, note?: string) {
  const payload = body && typeof body === "object" ? body as Record<string, unknown> : {};
  return {
    status,
    code: payload.code ?? null,
    message: typeof payload.message === "string" ? payload.message.slice(0, 300) : null,
    serverResponse: payload.serverResponse ?? null,
    note: note ?? null,
    at: nowIso(),
  };
}

function resolveEndReason(row: LiveRow, staleMs: number) {
  if (row.client_state === "closing") return "app_closed";
  if (row.client_state === "reconnecting" || staleMs >= FORCE_END_MS) return "network_lost";
  return "heartbeat_timeout";
}

async function mergeLivePostEnded(supabase: SupabaseClient, row: LiveRow, endedAt: string, endReason: string) {
  const postId = row.live_post_id || row.post_id;
  if (!postId) return;
  const { data: post } = await supabase
    .from("posts")
    .select("metadata")
    .eq("id", postId)
    .maybeSingle();
  const metadata = post?.metadata && typeof post.metadata === "object" ? post.metadata as Record<string, unknown> : {};
  await supabase
    .from("posts")
    .update({
      metadata: {
        ...metadata,
        live_status: "ended",
        ended_at: endedAt,
        end_reason: endReason,
        replay_status: row.recording_provider === "agora" ? "processing" : metadata.replay_status ?? "unavailable",
      },
    })
    .eq("id", postId);
}

async function queryRecording(row: LiveRow) {
  const channel = row.agora_channel || row.channel_name || "";
  const resourceId = row.recording_resource_id || row.resource_id || "";
  const sid = row.recording_sid || row.sid || "";
  if (!channel || !resourceId || !sid) return { ok: false, skipped: "missing-identifiers", body: null, status: null };
  const creds = loadAgoraCreds();
  const res = await callAgora(creds, "GET", `/cloud_recording/resourceid/${resourceId}/sid/${sid}/mode/mix/query`);
  return { ok: res.status >= 200 && res.status < 300, skipped: null, body: res.body, status: res.status };
}

async function stopRecording(row: LiveRow) {
  const channel = row.agora_channel || row.channel_name || "";
  const recorderUid = row.recording_uid ? String(row.recording_uid) : "";
  const resourceId = row.recording_resource_id || row.resource_id || "";
  const sid = row.recording_sid || row.sid || "";
  if (!channel || !recorderUid || !resourceId || !sid) {
    return { safe: true, body: { skipped: "missing-identifiers" }, status: null, stopped: false };
  }
  const creds = loadAgoraCreds();
  const res = await callAgora(creds, "POST", `/cloud_recording/resourceid/${resourceId}/sid/${sid}/mode/mix/stop`, {
    cname: channel,
    uid: recorderUid,
    clientRequest: {},
  });
  const alreadyGone = res.status === 404 || res.body?.code === 404;
  return {
    safe: (res.status >= 200 && res.status < 300) || alreadyGone,
    body: res.body,
    status: res.status,
    stopped: res.status >= 200 && res.status < 300,
  };
}

async function safeEndSession(
  supabase: SupabaseClient,
  row: LiveRow,
  params: {
    dryRun: boolean;
    endReason: string;
    querySummary?: Record<string, unknown>;
    stopSummary?: Record<string, unknown>;
    cleanupFinished?: boolean;
  },
) {
  const endedAt = nowIso();
  if (params.dryRun) {
    return { ok: true, dryRun: true, wouldEnd: true, endReason: params.endReason };
  }

  const hasAgora = row.recording_provider === "agora" && !!(row.recording_resource_id || row.resource_id) && !!(row.recording_sid || row.sid);
  const nextRecordingStatus = hasAgora ? "processing" : row.recording_provider === "browser" ? "stopped" : "failed";
  await supabase
    .from("live_sessions")
    .update({
      status: "ended",
      ended_at: row.ended_at || endedAt,
      end_reason: params.endReason,
      total_duration_seconds: durationSeconds(row, row.ended_at || endedAt),
      cleanup_finished_at: params.cleanupFinished ? endedAt : row.cleanup_finished_at,
      recording_status: nextRecordingStatus,
      stop_requested_at: row.stop_requested_at || endedAt,
      stopped_at: params.cleanupFinished ? endedAt : row.stopped_at,
      recording_stopped_at: params.cleanupFinished ? endedAt : undefined,
      last_recording_query_result: params.querySummary ?? {},
      watchdog_stop_result: params.stopSummary ?? {},
      updated_at: endedAt,
    })
    .eq("id", row.id);
  await mergeLivePostEnded(supabase, row, row.ended_at || endedAt, params.endReason);
  return { ok: true, ended: true, endReason: params.endReason, recordingStatus: nextRecordingStatus };
}

async function processRow(supabase: SupabaseClient, row: LiveRow, dryRun: boolean) {
  const heartbeatAt = row.last_host_heartbeat_at || row.last_heartbeat_at || row.host_heartbeat_at || row.started_at || row.created_at;
  const staleMs = msSince(heartbeatAt, row.created_at);
  const staleSeconds = Math.round(staleMs / 1000);
  const endReason = resolveEndReason(row, staleMs);
  const hasAgoraIdentifiers = row.recording_provider === "agora" && !!(row.recording_resource_id || row.resource_id) && !!(row.recording_sid || row.sid);
  const hasActiveRecordingStatus = ["acquiring", "starting", "started", "recording", "stopping"].includes(String(row.recording_status || ""));
  const endedButRecordingActive = ["ended", "processing", "stopping", "cleanup_pending"].includes(String(row.status)) && hasAgoraIdentifiers && hasActiveRecordingStatus;
  const endingTooLong = ["ending", "stopping"].includes(String(row.status)) && msSince(row.stop_requested_at || row.cleanup_started_at, row.created_at) > 120_000;

  if (!endedButRecordingActive && staleMs <= WATCHDOG_STALE_MS) {
    return { ok: true, skipped: "heartbeat-fresh", staleSeconds };
  }

  if (!endedButRecordingActive && staleMs > WATCHDOG_STALE_MS && staleMs <= CLEANUP_STALE_MS) {
    const nextStatus = staleMs > 45_000 ? "disconnected" : "reconnecting";
    if (!dryRun && row.status !== nextStatus) {
      await supabase
        .from("live_sessions")
        .update({
          status: nextStatus,
          host_connection_status: "offline",
          disconnect_detected_at: row.disconnect_detected_at || nowIso(),
          updated_at: nowIso(),
        })
        .eq("id", row.id);
    }
    return { ok: true, status: nextStatus, staleSeconds };
  }

  if (staleMs > CLEANUP_STALE_MS || endedButRecordingActive || endingTooLong) {
    const reason = endedButRecordingActive
      ? "ended_recording_active"
      : endingTooLong
        ? "ending_timeout"
        : "host_heartbeat_timeout";
    console.log("[live-watchdog-cleanup] zombie_cleanup_triggered", {
      live_session_id: row.id,
      host_user_id: row.user_id || row.host_user_id || row.owner_id,
      channel_name: row.agora_channel || row.channel_name,
      resource_id: row.recording_resource_id || row.resource_id,
      sid: row.recording_sid || row.sid,
      reason,
      timestamp: nowIso(),
    });
    return forceEndLive(supabase, {
      sessionId: row.id,
      reason,
      source: "watchdog",
      dryRun,
    });
  }

  if (!dryRun && !row.cleanup_started_at) {
    await supabase
      .from("live_sessions")
      .update({
        status: "cleanup_pending",
        cleanup_started_at: nowIso(),
        stop_requested_at: hasAgoraIdentifiers ? nowIso() : row.stop_requested_at,
        disconnect_detected_at: row.disconnect_detected_at || nowIso(),
        updated_at: nowIso(),
      })
      .eq("id", row.id);
  }

  let querySummary = safeAgoraSummary(null, null, "not-run");
  let stopSummary = safeAgoraSummary(null, null, "not-run");
  try {
    const query = await queryRecording(row);
    querySummary = safeAgoraSummary(query.status, query.body, query.skipped || undefined);
  } catch (error) {
    querySummary = safeAgoraSummary(null, null, error instanceof Error ? error.message : "query failed");
  }

  let stopSafe = false;
  try {
    const stop = await stopRecording(row);
    stopSafe = stop.safe;
    stopSummary = safeAgoraSummary(stop.status, stop.body, stop.safe ? "safe-ended" : "stop-failed");
  } catch (error) {
    stopSummary = safeAgoraSummary(null, null, error instanceof Error ? error.message : "stop failed");
  }

  const forceEnd = staleMs > FORCE_END_MS;
  if (stopSafe || forceEnd) {
    return safeEndSession(supabase, row, {
      dryRun,
      endReason: forceEnd && !stopSafe ? "watchdog_cleanup" : endReason,
      querySummary,
      stopSummary,
      cleanupFinished: true,
    });
  }

  if (!dryRun) {
    await supabase
      .from("live_sessions")
      .update({
        status: "cleanup_pending",
        last_recording_query_result: querySummary,
        watchdog_stop_result: stopSummary,
        recording_retry_count: Number(row.recording_retry_count || 0) + 1,
        updated_at: nowIso(),
      })
      .eq("id", row.id);
  }
  return { ok: false, status: "cleanup_pending", staleSeconds, stopSafe: false };
}

async function cleanupGuestSessions(supabase: SupabaseClient, dryRun: boolean) {
  const now = nowIso();
  const inviteCutoff = new Date(Date.now() - 60_000).toISOString();
  const heartbeatCutoff = new Date(Date.now() - 60_000).toISOString();
  const disconnectCutoff = new Date(Date.now() - 30_000).toISOString();
  const results: unknown[] = [];

  if (!dryRun) {
    const expired = await supabase
      .from("live_guest_sessions")
      .update({ status: "expired", ended_at: now, end_reason: "expired", updated_at: now })
      .eq("status", "invited")
      .lt("invited_at", inviteCutoff)
      .select("id");
    results.push({ expired: expired.data?.length || 0 });

    const acceptedExpired = await supabase
      .from("live_guest_sessions")
      .update({ status: "expired", ended_at: now, end_reason: "accepted_timeout", updated_at: now })
      .eq("status", "accepted")
      .lt("accepted_at", inviteCutoff)
      .is("joined_at", null)
      .select("id");
    results.push({ acceptedExpired: acceptedExpired.data?.length || 0 });

    const disconnected = await supabase
      .from("live_guest_sessions")
      .update({ status: "disconnected", updated_at: now })
      .eq("status", "joined")
      .lt("last_heartbeat_at", disconnectCutoff)
      .select("id");
    results.push({ disconnected: disconnected.data?.length || 0 });

    const left = await supabase
      .from("live_guest_sessions")
      .update({ status: "left", ended_at: now, end_reason: "guest_timeout", updated_at: now })
      .eq("status", "disconnected")
      .lt("last_heartbeat_at", heartbeatCutoff)
      .select("id, live_session_id");
    results.push({ timedOut: left.data?.length || 0 });
    for (const row of (left.data || []) as Array<{ live_session_id: string }>) {
      const { data: live } = await supabase
        .from("live_sessions")
        .select("agora_uid, agora_uid_host")
        .eq("id", row.live_session_id)
        .maybeSingle();
      const hostUid = live?.agora_uid || live?.agora_uid_host;
      await updateRecordingLayout(supabase, row.live_session_id, hostUid ? [hostUid] : [], "guest_timeout");
    }
  }

  return results;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const cronSecret = Deno.env.get("CRON_SECRET") ?? Deno.env.get("SCHEDULED_FUNCTION_SECRET");
    if (cronSecret) {
      const authToken = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
      const headerToken = req.headers.get("x-cron-secret");
      if (authToken !== cronSecret && headerToken !== cronSecret) return json({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) return json({ error: "Missing Supabase config" }, 500);

    const body = await req.json().catch(() => ({}));
    const dryRun = body.dryRun === true || body.dry_run === true;
    const limit = Math.min(Math.max(Number(body.limit || 25), 1), 100);
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : typeof body.live_session_id === "string" ? body.live_session_id : null;
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Trạng thái CẦN watchdog xử lý (đang chạy hoặc đang dở dang).
    // KHÔNG include 'ended' — session đã ended thì không cần đụng lại,
    // trước đây include 'ended' khiến watchdog re-process zombie rows mỗi vòng
    // → sinh ~130k UPDATE dư thừa/tuần và làm rollback tx tăng vọt.
    const ACTIVE_STATUSES = [
      "live", "starting", "recording", "reconnecting",
      "disconnected", "cleanup_pending", "ending", "stopping", "processing",
    ];

    // P0 EARLY-RETURN: nếu không có session nào ở trạng thái active thì bỏ qua toàn bộ vòng.
    // Trước đây watchdog scan + update dù không có ai live → đốt Cloud không cần thiết.
    if (!sessionId) {
      const { count: activeCount, error: countError } = await supabase
        .from("live_sessions")
        .select("id", { count: "exact", head: true })
        .in("status", ACTIVE_STATUSES)
        .in("mode", ["agora_webcam", "mobile"]);
      if (countError) throw countError;
      if (!activeCount || activeCount === 0) {
        const guestCleanup = await cleanupGuestSessions(supabase, dryRun);
        return json({ ok: true, dryRun, processed: 0, skipped: "no-active-sessions", guestCleanup });
      }
    }

    let query = supabase
      .from("live_sessions")
      .select("id, user_id, host_user_id, owner_id, status, client_state, started_at, ended_at, last_heartbeat_at, last_host_heartbeat_at, last_media_activity_at, host_heartbeat_at, disconnect_detected_at, cleanup_started_at, cleanup_finished_at, end_reason, agora_channel, channel_name, recording_uid, recording_provider, recording_status, recording_resource_id, recording_sid, recording_retry_count, stop_requested_at, stopped_at, resource_id, sid, live_post_id, post_id, created_at")
      .in("status", ACTIVE_STATUSES)
      .in("mode", ["agora_webcam", "mobile"])
      .order("last_host_heartbeat_at", { ascending: true, nullsFirst: true })
      .limit(limit);
    if (sessionId) query = query.eq("id", sessionId);

    const { data, error } = await query;
    if (error) throw error;

    const results = [];
    for (const row of (data ?? []) as LiveRow[]) {
      try {
        console.log("[live-watchdog-cleanup] scan", {
          sessionId: row.id,
          status: row.status,
          clientState: row.client_state,
          hasResourceId: !!(row.recording_resource_id || row.resource_id),
          hasSid: !!(row.recording_sid || row.sid),
        });
        results.push({ sessionId: row.id, ...(await processRow(supabase, row, dryRun)) });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("[live-watchdog-cleanup] row failed", { sessionId: row.id, message });
        results.push({ sessionId: row.id, ok: false, error: message });
      }
    }
    const guestCleanup = await cleanupGuestSessions(supabase, dryRun);

    return json({ ok: true, dryRun, processed: results.length, results, guestCleanup });
  } catch (error) {
    console.error("[live-watchdog-cleanup] failed reason", error);
    return json({ ok: false, error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});
