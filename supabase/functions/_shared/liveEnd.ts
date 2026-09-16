import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { callAgora, loadAgoraCreds } from "./agoraRecording.ts";

declare const EdgeRuntime: { waitUntil?: (p: Promise<unknown>) => void } | undefined;

type EndReason =
  | "host_clicked_end"
  | "host_heartbeat_timeout"
  | "app_closed"
  | "network_lost"
  | "watchdog_cleanup"
  | "zombie_cleanup"
  | "ended_recording_active"
  | "ending_timeout";

type ForceEndParams = {
  sessionId: string;
  reason: EndReason;
  actorUserId?: string | null;
  source: "host" | "watchdog" | "cron" | "system";
  dryRun?: boolean;
};

type LiveRow = {
  id: string;
  user_id: string | null;
  host_user_id: string | null;
  owner_id: string | null;
  status: string;
  mode: string | null;
  live_mode: string | null;
  source: string | null;
  stream_provider: string | null;
  agora_channel: string | null;
  channel_name: string | null;
  recording_uid: number | null;
  recording_provider: string | null;
  recording_status: string | null;
  recording_resource_id: string | null;
  recording_sid: string | null;
  resource_id: string | null;
  sid: string | null;
  recording_retry_count: number | null;
  cleanup_attempts: number | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  live_post_id: string | null;
  post_id: string | null;
  stop_requested_at: string | null;
  recording_stop_requested_at: string | null;
  stopped_at: string | null;
  recording_stopped_at: string | null;
  rtmp_status: string | null;
  rtmp_ended_at: string | null;
  watchdog_stop_result: Record<string, unknown> | null;
  last_recording_query_result: Record<string, unknown> | null;
};

const ACTIVE_RECORDING_STATUSES = new Set(["acquiring", "starting", "started", "recording", "stopping"]);
const FINAL_LIVE_STATUSES = new Set(["ended", "ready", "posted", "failed"]);
const STOPPED_RECORDING_STATUSES = new Set(["stopped", "processing", "ready", "failed", "deleted"]);

function nowIso() {
  return new Date().toISOString();
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function log(event: string, row: Partial<LiveRow>, reason: string, extra: Record<string, unknown> = {}) {
  console.log(`[live-end] ${event}`, {
    live_session_id: row.id,
    host_user_id: row.user_id || row.host_user_id || row.owner_id || null,
    channel_name: row.agora_channel || row.channel_name || null,
    resource_id: row.recording_resource_id || row.resource_id || null,
    sid: row.recording_sid || row.sid || null,
    reason,
    timestamp: nowIso(),
    ...extra,
  });
}

function durationSeconds(row: LiveRow, endedAt: string) {
  const startMs = Date.parse(row.started_at || row.created_at);
  const endMs = Date.parse(endedAt);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return null;
  return Math.max(0, Math.round((endMs - startMs) / 1000));
}

function safeSummary(status: number | null, body: unknown, note?: string) {
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

function isAlreadyGone(status: number, body: Record<string, unknown>) {
  const message = String(body.message || body.reason || body.raw || "").toLowerCase();
  return status === 404 || body.code === 404 || message.includes("not found") || message.includes("not exist");
}

function hasAgoraRecording(row: LiveRow) {
  const provider = row.recording_provider || "agora";
  return provider === "agora"
    && !!(row.recording_resource_id || row.resource_id)
    && !!(row.recording_sid || row.sid);
}

function recordingNeedsStop(row: LiveRow) {
  if (!hasAgoraRecording(row)) return false;
  const status = String(row.recording_status || "recording");
  return ACTIVE_RECORDING_STATUSES.has(status) || !STOPPED_RECORDING_STATUSES.has(status);
}

async function queryRecording(row: LiveRow) {
  const resourceId = row.recording_resource_id || row.resource_id || "";
  const sid = row.recording_sid || row.sid || "";
  if (!resourceId || !sid) return safeSummary(null, null, "missing-identifiers");
  const creds = loadAgoraCreds();
  const res = await callAgora(creds, "GET", `/cloud_recording/resourceid/${resourceId}/sid/${sid}/mode/mix/query`);
  return safeSummary(res.status, res.body, res.status >= 200 && res.status < 300 ? "query-ok" : "query-failed");
}

async function stopRecording(row: LiveRow, reason: string) {
  const channel = row.agora_channel || row.channel_name || "";
  const recorderUid = row.recording_uid ? String(row.recording_uid) : "";
  const resourceId = row.recording_resource_id || row.resource_id || "";
  const sid = row.recording_sid || row.sid || "";
  if (!channel || !recorderUid || !resourceId || !sid) {
    log("cloud_recording_stop_failed", row, reason, { skipped: "missing-identifiers" });
    return { safe: true, stopped: false, summary: safeSummary(null, null, "missing-identifiers") };
  }

  const creds = loadAgoraCreds();
  let lastSummary = safeSummary(null, null, "not-run");
  for (let attempt = 1; attempt <= 3; attempt++) {
    log("cloud_recording_stop_requested", row, reason, { attempt });
    const res = await callAgora(creds, "POST", `/cloud_recording/resourceid/${resourceId}/sid/${sid}/mode/mix/stop`, {
      cname: channel,
      uid: recorderUid,
      clientRequest: {},
    });
    const body = res.body ?? {};
    const gone = isAlreadyGone(res.status, body);
    const ok = (res.status >= 200 && res.status < 300) || gone;
    lastSummary = safeSummary(res.status, body, ok ? (gone ? "already-stopped" : "stop-ok") : "stop-failed");
    if (ok) {
      log("cloud_recording_stop_success", row, reason, { attempt, status: res.status, alreadyGone: gone });
      return { safe: true, stopped: !gone, summary: lastSummary };
    }
    log("cloud_recording_stop_failed", row, reason, { attempt, status: res.status, body: JSON.stringify(body).slice(0, 300) });
    if (attempt < 3) await sleep(400 * attempt);
  }
  return { safe: false, stopped: false, summary: lastSummary };
}

async function mergeLivePostEnded(supabase: SupabaseClient, row: LiveRow, endedAt: string, reason: string, replayProcessing: boolean) {
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
        end_reason: reason,
        replay_status: replayProcessing ? "processing" : metadata.replay_status ?? "unavailable",
      },
    })
    .eq("id", postId);
}

async function cleanupGuests(supabase: SupabaseClient, row: LiveRow, endedAt: string) {
  const { data, error } = await supabase
    .from("live_guest_sessions")
    .update({
      status: "removed",
      ended_at: endedAt,
      end_reason: "live_ended",
      updated_at: endedAt,
    })
    .eq("live_session_id", row.id)
    .in("status", ["invited", "accepted", "joined", "disconnected"])
    .select("id");
  if (error) {
    log("guest_cleanup_failed", row, "live_ended", { error: error.message });
    return 0;
  }
  const count = data?.length || 0;
  log("guest_cleanup", row, "live_ended", { count });
  return count;
}

async function triggerReplayProcessor(sessionId: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) return;
  const task = (async () => {
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/process-live-recordings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
        },
        body: JSON.stringify({ sessionId, limit: 1 }),
      });
      const text = await res.text().catch(() => "");
      console.log("[live-end] replay_processor_triggered", { live_session_id: sessionId, status: res.status, body: text.slice(0, 300), timestamp: nowIso() });
    } catch (error) {
      console.warn("[live-end] replay_processor_trigger_failed", { live_session_id: sessionId, error });
    }
  })();
  if (typeof EdgeRuntime !== "undefined" && (EdgeRuntime as { waitUntil?: (p: Promise<unknown>) => void })?.waitUntil) {
    (EdgeRuntime as { waitUntil: (p: Promise<unknown>) => void }).waitUntil(task);
  }
}

export async function forceEndLive(supabase: SupabaseClient, params: ForceEndParams) {
  const { data: row, error } = await supabase
    .from("live_sessions")
    .select("id, user_id, host_user_id, owner_id, status, mode, live_mode, source, stream_provider, agora_channel, channel_name, recording_uid, recording_provider, recording_status, recording_resource_id, recording_sid, resource_id, sid, recording_retry_count, cleanup_attempts, started_at, ended_at, created_at, live_post_id, post_id, stop_requested_at, recording_stop_requested_at, stopped_at, recording_stopped_at, rtmp_status, rtmp_ended_at, watchdog_stop_result, last_recording_query_result")
    .eq("id", params.sessionId)
    .maybeSingle();
  if (error) throw error;
  if (!row) return { ok: false, status: "not_found", error: "Live session not found" };

  const live = row as LiveRow;
  const ownerId = live.user_id || live.host_user_id || live.owner_id;
  if (params.actorUserId && ownerId !== params.actorUserId) {
    return { ok: false, status: "forbidden", error: "Only host can end this live session" };
  }

  const needsStop = recordingNeedsStop(live);
  if (FINAL_LIVE_STATUSES.has(String(live.status)) && !needsStop) {
    return { ok: true, status: live.status, alreadyEnded: true, replayProcessing: false };
  }
  if (["ending", "stopping"].includes(String(live.status)) && live.stop_requested_at && params.source === "host") {
    return { ok: true, status: live.status, inProgress: true, replayProcessing: needsStop };
  }
  if (params.dryRun) {
    return { ok: true, dryRun: true, wouldEnd: true, status: live.status, replayProcessing: needsStop };
  }

  const startedAt = nowIso();
  log("force_end_started", live, params.reason, { source: params.source });
  await supabase
    .from("live_sessions")
    .update({
      status: "ending",
      recording_status: needsStop ? "stopping" : live.recording_status || "stopped",
      stop_requested_at: needsStop ? (live.stop_requested_at || startedAt) : live.stop_requested_at,
      recording_stop_requested_at: needsStop ? (live.recording_stop_requested_at || startedAt) : live.recording_stop_requested_at,
      host_connection_status: "offline",
      last_cleanup_at: startedAt,
      cleanup_attempts: Number(live.cleanup_attempts || live.recording_retry_count || 0) + 1,
      updated_at: startedAt,
    })
    .eq("id", live.id);

  let querySummary = live.last_recording_query_result || safeSummary(null, null, "not-run");
  let stopSummary = live.watchdog_stop_result || safeSummary(null, null, "not-run");
  let stopSafe = !needsStop;
  if (hasAgoraRecording(live)) {
    try {
      querySummary = await queryRecording(live);
      await supabase
        .from("live_sessions")
        .update({ last_recording_query_result: querySummary, recording_last_query_at: nowIso(), last_recording_query_at: nowIso(), updated_at: nowIso() })
        .eq("id", live.id);
    } catch (error) {
      querySummary = safeSummary(null, null, error instanceof Error ? error.message : "query failed");
    }
  }

  if (needsStop) {
    const stopped = await stopRecording(live, params.reason);
    stopSafe = stopped.safe;
    stopSummary = stopped.summary;
  }

  const endedAt = live.ended_at || nowIso();
  const replayProcessing = hasAgoraRecording(live);
  await cleanupGuests(supabase, live, endedAt);
  await mergeLivePostEnded(supabase, live, endedAt, params.reason, replayProcessing);

  const nextRecordingStatus = replayProcessing
    ? (stopSafe ? "processing" : "stopping")
    : live.recording_provider === "browser"
      ? "stopped"
      : live.recording_status || "stopped";

  const patch: Record<string, unknown> = {
    status: "ended",
    ended_at: endedAt,
    end_reason: params.reason,
    total_duration_seconds: durationSeconds(live, endedAt),
    host_connection_status: "offline",
    recording_status: nextRecordingStatus,
    stopped_at: stopSafe ? (live.stopped_at || endedAt) : live.stopped_at,
    recording_stopped_at: stopSafe && replayProcessing ? (live.recording_stopped_at || endedAt) : live.recording_stopped_at,
    cleanup_finished_at: stopSafe ? endedAt : null,
    watchdog_stop_result: stopSummary,
    last_recording_query_result: querySummary,
    recording_error: stopSafe ? null : JSON.stringify(stopSummary).slice(0, 500),
    recording_error_message: stopSafe ? null : JSON.stringify(stopSummary).slice(0, 500),
    rtmp_status: live.rtmp_status ? "ended" : live.rtmp_status,
    rtmp_ended_at: live.rtmp_status ? (live.rtmp_ended_at || endedAt) : live.rtmp_ended_at,
    updated_at: endedAt,
  };
  await supabase.from("live_sessions").update(patch).eq("id", live.id);
  log("live_ended_success", live, params.reason, { stopSafe, replayProcessing, nextRecordingStatus });

  if (replayProcessing && stopSafe) await triggerReplayProcessor(live.id);
  return { ok: true, status: "ended", sessionId: live.id, stopSafe, replayProcessing, recordingStatus: nextRecordingStatus };
}
