import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { callAgora, loadAgoraCreds } from "../_shared/agoraRecording.ts";
import {
  copyR2Object,
  deleteR2Object,
  getR2Config,
  headR2Object,
  listR2Objects,
  publicR2Url,
  sanitizeR2Key,
  type R2Config,
  type R2Object,
} from "../_shared/r2Archive.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type LiveRow = {
  id: string;
  user_id: string | null;
  host_user_id: string | null;
  owner_id: string | null;
  title: string | null;
  status: string;
  agora_channel: string | null;
  channel_name: string | null;
  recording_uid: number | null;
  recording_provider: string | null;
  recording_status: string | null;
  recording_resource_id: string | null;
  recording_sid: string | null;
  resource_id: string | null;
  sid: string | null;
  temp_bucket: string | null;
  temp_object_key: string | null;
  archive_bucket: string | null;
  archive_object_key: string | null;
  replay_post_id: string | null;
  ended_at: string | null;
  created_at: string;
  host_heartbeat_at: string | null;
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

function basename(key: string) {
  return key.split("/").filter(Boolean).pop() || "recording";
}

function pickPlayable(files: { archiveKey: string; size: number }[]) {
  const lower = files.map((file) => ({ ...file, lower: file.archiveKey.toLowerCase() }));
  return (
    lower.find((file) => file.lower.endsWith(".m3u8")) ||
    lower.find((file) => file.lower.endsWith(".mp4")) ||
    lower.find((file) => file.lower.endsWith(".webm")) ||
    lower[0]
  );
}

function pickThumbnail(files: { archiveKey: string; size: number }[]) {
  return files.find((file) => /\.(jpe?g|png|webp)$/i.test(file.archiveKey));
}

function extractDurationSeconds(body: unknown): number | null {
  if (!body || typeof body !== "object") return null;
  const root = body as Record<string, unknown>;
  const serverResponse = root.serverResponse && typeof root.serverResponse === "object"
    ? root.serverResponse as Record<string, unknown>
    : root;
  const extensionServiceState = serverResponse.extensionServiceState && typeof serverResponse.extensionServiceState === "object"
    ? serverResponse.extensionServiceState as Record<string, unknown>
    : null;
  const payload = extensionServiceState?.payload && typeof extensionServiceState.payload === "object"
    ? extensionServiceState.payload as Record<string, unknown>
    : null;
  const durationMs = payload?.durationMs;
  if (typeof durationMs === "number" && Number.isFinite(durationMs)) return Math.round(durationMs / 1000);
  const duration = serverResponse.duration ?? root.duration;
  return typeof duration === "number" && Number.isFinite(duration) ? Math.round(duration) : null;
}

function archiveKeyFor(row: LiveRow, userId: string, tempPrefix: string, object: R2Object) {
  const date = new Date(row.ended_at || row.created_at || Date.now());
  const yyyy = String(date.getUTCFullYear());
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const prefix = tempPrefix.replace(/\/+$/, "");
  const relative = object.key.startsWith(`${prefix}/`)
    ? object.key.slice(prefix.length + 1)
    : basename(object.key);
  return sanitizeR2Key(`replays/${userId}/${yyyy}/${mm}/${row.id}/${relative}`);
}

async function markFailed(supabase: SupabaseClient, sessionId: string, message: string) {
  console.error("[process-live-recordings] failed reason", { sessionId, message });
  await supabase
    .from("live_sessions")
    .update({
      status: "failed",
      recording_status: "failed",
      error_message: message,
      recording_error: message,
      updated_at: nowIso(),
    })
    .eq("id", sessionId);
}

async function stopStaleRecording(supabase: SupabaseClient, row: LiveRow) {
  const channel = row.agora_channel || row.channel_name || "";
  const recorderUid = row.recording_uid ? String(row.recording_uid) : "";
  const resourceId = row.recording_resource_id || row.resource_id || "";
  const sid = row.recording_sid || row.sid || "";
  if (!channel || !recorderUid || !resourceId || !sid) {
    const now = nowIso();
    await supabase
      .from("live_sessions")
      .update({
        status: "processing",
        recording_provider: row.recording_provider === "browser" ? "browser" : "none",
        recording_status: row.recording_provider === "browser" ? "stopped" : "failed",
        browser_recording_status: row.recording_provider === "browser" ? "uploaded" : "idle",
        ended_at: row.ended_at || now,
        producer_disconnected_at: now,
        updated_at: now,
      })
      .eq("id", row.id);
    return { ok: true, stopped: false, fallback: "missing-agora-identifiers" };
  }

  console.log("[process-live-recordings] auto stop stale live", { sessionId: row.id });
  const creds = loadAgoraCreds();
  const stopRes = await callAgora(creds, "POST", `/cloud_recording/resourceid/${resourceId}/sid/${sid}/mode/mix/stop`, {
    cname: channel,
    uid: recorderUid,
    clientRequest: {},
  });
  const alreadyGone = stopRes.status === 404 || stopRes.body?.code === 404;
  if ((stopRes.status < 200 || stopRes.status >= 300) && !alreadyGone) {
    await markFailed(supabase, row.id, `Auto stop recording failed: ${JSON.stringify(stopRes.body).slice(0, 300)}`);
    return { ok: false, stopped: false };
  }

  const now = nowIso();
  await supabase
    .from("live_sessions")
    .update({
      status: "processing",
      recording_status: "processing",
      ended_at: row.ended_at || now,
      recording_stopped_at: now,
      producer_disconnected_at: now,
      last_worker_response: stopRes.body ?? {},
      updated_at: now,
    })
    .eq("id", row.id);
  return { ok: true, stopped: true };
}

async function createReplayPostOnce(
  supabase: SupabaseClient,
  row: LiveRow,
  userId: string,
  replayUrl: string,
  thumbnailUrl: string | null,
  durationSeconds: number | null,
  mp4Parts: { url: string; index: number; size: number; key: string }[],
) {
  if (row.replay_post_id) return row.replay_post_id;

  const { data: existing } = await supabase
    .from("posts")
    .select("id")
    .eq("post_type", "live_replay")
    .eq("metadata->>live_session_id", row.id)
    .maybeSingle();
  if (existing?.id) {
    await supabase
      .from("live_sessions")
      .update({ replay_post_id: existing.id, replay_post_created_at: nowIso() })
      .eq("id", row.id);
    return existing.id;
  }

  console.log("[process-live-recordings] replay post created", { sessionId: row.id });
  const isHls = /\.m3u8(\?|$)/i.test(replayUrl);
  const isMp4 = /\.mp4(\?|$)/i.test(replayUrl);
  const firstMp4 = mp4Parts[0]?.url ?? (isMp4 ? replayUrl : null);
  const metadata: Record<string, unknown> = {
    live_session_id: row.id,
    sessionId: row.id,
    live_status: "ended",
    replay_status: "ready",
    playback_type: "r2",
    playback_kind: isHls ? "hls" : isMp4 ? "mp4" : "unknown",
    storage_provider: "r2",
    playback_provider: "r2",
    playback_url: replayUrl,
    replay_url: replayUrl,
    thumbnail_url: thumbnailUrl,
    duration_seconds: durationSeconds,
    live_title: row.title || "Replay livestream",
    download_mp4_parts: mp4Parts,
  };
  if (isHls) metadata.playback_hls = replayUrl;
  if (firstMp4) metadata.playback_mp4 = firstMp4;

  const { data: post, error } = await supabase
    .from("posts")
    .insert({
      user_id: userId,
      content: "🎥 Replay livestream",
      visibility: "public",
      video_url: replayUrl,
      post_type: "live_replay",
      metadata,
      download_mp4_parts: mp4Parts,
    })
    .select("id")
    .single();
  if (error) throw error;
  return post.id as string;
}

async function queryAgora(row: LiveRow) {
  const channel = row.agora_channel || row.channel_name || "";
  const resourceId = row.recording_resource_id || row.resource_id || "";
  const sid = row.recording_sid || row.sid || "";
  if (!channel || !resourceId || !sid) return null;
  try {
    const creds = loadAgoraCreds();
    const res = await callAgora(creds, "GET", `/cloud_recording/resourceid/${resourceId}/sid/${sid}/mode/mix/query`);
    console.log("[process-live-recordings] query recording", row.id, res.status, res.rawText.slice(0, 300));
    return res.body ?? null;
  } catch (error) {
    console.warn("[process-live-recordings] query failed", row.id, error);
    return null;
  }
}

async function processRow(supabase: SupabaseClient, r2: R2Config, row: LiveRow) {
  if (row.status === "live") {
    return { ok: true, skipped: "live-session-owned-by-watchdog" };
  }

  if (row.status === "stopping") {
    const updatedCutoff = Date.now() - new Date(row.ended_at || row.created_at).getTime();
    if (updatedCutoff > 2 * 60 * 1000) {
      await supabase.from("live_sessions").update({ status: "processing", recording_status: "processing", updated_at: nowIso() }).eq("id", row.id);
    }
  }

  const userId = row.user_id || row.host_user_id || row.owner_id || "";
  if (!userId) {
    await markFailed(supabase, row.id, "Missing live session owner");
    return { ok: false };
  }

  if (row.recording_provider === "browser" || row.recording_status === "stopped") {
    await supabase
      .from("live_sessions")
      .update({
        status: "processing",
        recording_provider: "browser",
        browser_recording_status: "uploaded",
        updated_at: nowIso(),
      })
      .eq("id", row.id);
    return { ok: true, skipped: "browser-fallback-chunks-only" };
  }

  const tempBucket = row.temp_bucket || r2.tempBucket;
  const primaryPrefix = (row.temp_object_key || `temp/live/${userId}/${row.id}`).replace(/^\/+/, "").replace(/\/+$/, "");
  // Legacy / alternate prefixes Agora may have written to before we standardized on temp/live/{user}/{session}.
  const fallbackPrefixes = [
    `funprofile/live/${row.id}`,
    `live/${row.id}`,
    `temp/live/${row.id}`,
  ];
  const candidatePrefixes = [primaryPrefix, ...fallbackPrefixes.filter((p) => p !== primaryPrefix)];

  const agoraBody = await queryAgora(row);
  await supabase
    .from("live_sessions")
    .update({
      last_recording_query_at: nowIso(),
      last_worker_response: agoraBody ?? {},
      updated_at: nowIso(),
    })
    .eq("id", row.id);

  let tempPrefix = primaryPrefix;
  let readyObjects: R2Object[] = [];
  for (const candidate of candidatePrefixes) {
    const objects = await listR2Objects(r2, tempBucket, candidate);
    const ready = objects.filter((object) => object.size > 0);
    if (ready.length > 0) {
      tempPrefix = candidate;
      readyObjects = ready;
      if (candidate !== primaryPrefix) {
        console.log("[process-live-recordings] using fallback prefix", { sessionId: row.id, prefix: candidate, count: ready.length });
      }
      break;
    }
  }
  console.log("[process-live-recordings] temp file detected", { sessionId: row.id, prefix: tempPrefix, count: readyObjects.length });

  if (readyObjects.length === 0) {
    const ageMs = Date.now() - new Date(row.ended_at || row.created_at).getTime();
    if (ageMs > 60 * 60 * 1000) {
      await markFailed(supabase, row.id, "Recording file was not found in R2 TEMP within 60 minutes");
      return { ok: false };
    }
    return { ok: true, skipped: "waiting-for-temp-file" };
  }

  // Parallel copy with concurrency limit; skip if archive object already exists
  // so re-invocations (e.g. after timeout) resume quickly instead of redoing work.
  const archived: { tempKey: string; archiveKey: string; size: number }[] = [];
  const CONCURRENCY = 12;
  let cursor = 0;
  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= readyObjects.length) return;
      const object = readyObjects[i];
      const archiveKey = archiveKeyFor(row, userId, tempPrefix, object);
      const existing = await headR2Object(r2, r2.archiveBucket, archiveKey);
      if (!existing.ok) {
        const copy = await copyR2Object(r2, tempBucket, object.key, r2.archiveBucket, archiveKey);
        if (!copy.ok) {
          throw new Error(`R2 copy failed for ${object.key}: ${copy.status} ${(await copy.text()).slice(0, 300)}`);
        }
        const verify = await headR2Object(r2, r2.archiveBucket, archiveKey);
        if (!verify.ok) throw new Error(`R2 archive verify failed for ${archiveKey}: ${verify.status}`);
      }
      archived.push({ tempKey: object.key, archiveKey, size: object.size });
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, readyObjects.length) }, () => worker()));
  console.log("[process-live-recordings] archive batch done", { sessionId: row.id, count: archived.length });

  const playable = pickPlayable(archived);
  if (!playable) throw new Error("No playable archive object was produced");

  const replayUrl = publicR2Url(r2, playable.archiveKey);
  const thumbnail = pickThumbnail(archived);
  const thumbnailUrl = thumbnail ? publicR2Url(r2, thumbnail.archiveKey) : null;
  const durationSeconds = extractDurationSeconds(agoraBody);

  // Gather all MP4 parts (sorted by key for stable order) for download UI.
  const mp4Parts = archived
    .filter((f) => /\.mp4$/i.test(f.archiveKey))
    .sort((a, b) => a.archiveKey.localeCompare(b.archiveKey))
    .map((f, index) => ({
      index,
      key: f.archiveKey,
      url: publicR2Url(r2, f.archiveKey),
      size: f.size,
    }));

  const now = nowIso();
  const replayPostId = await createReplayPostOnce(supabase, row, userId, replayUrl, thumbnailUrl, durationSeconds, mp4Parts);

  await supabase
    .from("live_sessions")
    .update({
      status: "ready",
      recording_status: "ready",
      archive_status: "archived",
      archive_bucket: r2.archiveBucket,
      archive_object_key: playable.archiveKey,
      r2_bucket: r2.archiveBucket,
      r2_object_key: playable.archiveKey,
      r2_video_url: replayUrl,
      replay_url: replayUrl,
      playback_url: replayUrl,
      thumbnail_url: thumbnailUrl,
      duration_seconds: durationSeconds,
      recording_files: archived,
      download_mp4_parts: mp4Parts,
      replay_post_id: replayPostId,
      replay_post_created_at: now,
      recording_ready_at: now,
      archived_at: now,
      error_message: null,
      recording_error: null,
      updated_at: now,
    })
    .eq("id", row.id);

  for (const object of readyObjects) {
    const del = await deleteR2Object(r2, tempBucket, object.key);
    if (del.ok || del.status === 404) {
      console.log("[process-live-recordings] temp cleanup completed", { sessionId: row.id, key: object.key });
    } else {
      console.warn("[process-live-recordings] temp cleanup failed", row.id, object.key, del.status);
    }
  }

  return { ok: true, status: "ready", replayUrl };
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
    const limit = Math.min(Math.max(Number(body.limit || 10), 1), 25);
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : null;
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const r2 = getR2Config();

    let query = supabase
      .from("live_sessions")
      .select("id, user_id, host_user_id, owner_id, title, status, agora_channel, channel_name, recording_uid, recording_provider, recording_status, recording_resource_id, recording_sid, resource_id, sid, temp_bucket, temp_object_key, archive_bucket, archive_object_key, replay_post_id, ended_at, created_at, host_heartbeat_at")
      .eq("mode", "agora_webcam")
      .in("status", ["live", "stopping", "ended", "processing"])
      .order("updated_at", { ascending: true })
      .limit(limit);
    if (sessionId) query = query.eq("id", sessionId);

    const { data, error } = await query;
    if (error) throw error;

    const results = [];
    for (const row of (data ?? []) as LiveRow[]) {
      try {
        results.push({ sessionId: row.id, ...(await processRow(supabase, r2, row)) });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await markFailed(supabase, row.id, message);
        results.push({ sessionId: row.id, ok: false, error: message });
      }
    }

    return json({ ok: true, processed: results.length, results });
  } catch (error) {
    console.error("[process-live-recordings] failed reason", error);
    return json({ ok: false, error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});
