import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { deleteCloudflareStreamUid } from "./postVideoDelete.ts";

type ArchiveResult = {
  ok: boolean;
  status: "archived" | "mp4_pending" | "failed" | "skipped";
  replay_id?: string;
  live_session_id?: string;
  r2_object_key?: string | null;
  r2_video_url?: string | null;
  error?: string;
};

type R2Env = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrl: string;
  endpoint: string;
};

type StreamEnv = {
  accountId: string;
  token: string;
};

const SERVICE = "s3";
const REGION = "auto";

function nowIso() {
  return new Date().toISOString();
}

function stringFromUnknown(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function getStreamEnv(): StreamEnv {
  const accountId = Deno.env.get("CLOUDFLARE_ACCOUNT_ID") ?? "";
  const token =
    Deno.env.get("CLOUDFLARE_STREAM_API_TOKEN") ??
    Deno.env.get("CLOUDFLARE_STREAM_TOKEN") ??
    Deno.env.get("CLOUDFLARE_API_TOKEN") ??
    "";
  if (!accountId || !token) throw new Error("Missing Cloudflare Stream configuration");
  return { accountId, token };
}

function getR2Env(): R2Env {
  const accountId = Deno.env.get("R2_ACCOUNT_ID") ?? Deno.env.get("CLOUDFLARE_ACCOUNT_ID") ?? "";
  const accessKeyId = Deno.env.get("R2_ACCESS_KEY_ID") ?? Deno.env.get("CLOUDFLARE_ACCESS_KEY_ID") ?? "";
  const secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY") ?? Deno.env.get("CLOUDFLARE_SECRET_ACCESS_KEY") ?? "";
  const bucketName = Deno.env.get("R2_BUCKET_NAME") ?? Deno.env.get("CLOUDFLARE_R2_BUCKET_NAME") ?? "";
  const endpoint = (Deno.env.get("R2_ENDPOINT") ?? `https://${accountId}.r2.cloudflarestorage.com`).replace(/\/+$/, "");
  const publicUrl = (
    Deno.env.get("R2_PUBLIC_DOMAIN") ??
    Deno.env.get("CLOUDFLARE_R2_PUBLIC_URL") ??
    ""
  ).replace(/\/+$/, "");

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName || !publicUrl) {
    throw new Error("Missing Cloudflare R2 archive configuration");
  }

  return { accountId, accessKeyId, secretAccessKey, bucketName, endpoint, publicUrl };
}

function addDays(seconds: number) {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

function getBackoffSeconds(attempts: number): number {
  return Math.min(6 * 60 * 60, Math.max(60, 2 ** Math.min(attempts, 8) * 60));
}

function sanitizePath(value: string) {
  return value.replace(/[^a-zA-Z0-9._/-]/g, "-").replace(/\/+/g, "/").replace(/^\/+/, "");
}

function encodePath(key: string) {
  return key.split("/").map(encodeURIComponent).join("/");
}

async function sha256Hex(input: string) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacSha256(key: ArrayBuffer, message: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(message));
}

async function getSignatureKey(secret: string, dateStamp: string): Promise<ArrayBuffer> {
  const kDate = await hmacSha256(new TextEncoder().encode("AWS4" + secret).buffer, dateStamp);
  const kRegion = await hmacSha256(kDate, REGION);
  const kService = await hmacSha256(kRegion, SERVICE);
  return hmacSha256(kService, "aws4_request");
}

function hex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function signedR2Fetch(params: {
  method: "PUT" | "HEAD";
  key: string;
  body?: BodyInit | null;
  contentType?: string;
  contentLength?: string | null;
}) {
  const env = getR2Env();
  const host = new URL(env.endpoint).host;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const canonicalUri = `/${env.bucketName}/${encodePath(params.key)}`;
  const signedHeaders = "host";
  const canonicalHeaders = `host:${host}\n`;
  const query = new URLSearchParams({
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${env.accessKeyId}/${dateStamp}/${REGION}/${SERVICE}/aws4_request`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": "900",
    "X-Amz-SignedHeaders": signedHeaders,
  });
  query.sort();
  const canonicalRequest = [
    params.method,
    canonicalUri,
    query.toString(),
    canonicalHeaders,
    signedHeaders,
    "UNSIGNED-PAYLOAD",
  ].join("\n");
  const credentialScope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join("\n");
  const signingKey = await getSignatureKey(env.secretAccessKey, dateStamp);
  const signature = hex(await hmacSha256(signingKey, stringToSign));
  query.append("X-Amz-Signature", signature);

  const headers = new Headers();
  if (params.contentType) headers.set("content-type", params.contentType);

  return fetch(`${env.endpoint}${canonicalUri}?${query.toString()}`, {
    method: params.method,
    headers,
    body: params.body,
  });
}

async function ensureVideoPublic(uid: string): Promise<void> {
  const env = getStreamEnv();
  try {
    await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.accountId}/stream/${uid}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ requireSignedURLs: false }),
    });
  } catch (err) {
    console.warn("[archiveReplay] ensureVideoPublic failed", err);
  }
}

async function fetchOrCreateMp4(uid: string): Promise<{ url: string | null; status: string | null }> {
  const env = getStreamEnv();
  await ensureVideoPublic(uid);
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${env.accountId}/stream/${uid}/downloads`;

  for (const method of ["GET", "POST"] as const) {
    const res = await fetch(endpoint, {
      method,
      headers: {
        Authorization: `Bearer ${env.token}`,
        "Content-Type": "application/json",
      },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok && res.status !== 404) {
      throw new Error(`Cloudflare MP4 ${method} failed: ${res.status} ${JSON.stringify(body).slice(0, 300)}`);
    }
    const def = body?.result?.default;
    const status = typeof def?.status === "string" ? def.status : null;
    const url = typeof def?.url === "string" ? def.url : null;
    if (status) return { status, url: status === "ready" ? url : null };
  }

  return { status: null, url: null };
}

async function markArchiveFailure(
  supabase: SupabaseClient,
  replay: Record<string, unknown>,
  message: string,
) {
  const attempts = Number(replay.archive_attempts || 0) + 1;
  const nextRetry = addDays(getBackoffSeconds(attempts));
  const now = nowIso();

  await supabase
    .from("live_replays")
    .update({
      archive_status: "failed",
      archive_error: message,
      archive_attempts: attempts,
      next_archive_retry_at: nextRetry,
      updated_at: now,
    })
    .eq("id", replay.id);

  if (replay.live_session_id) {
    await supabase
      .from("live_sessions")
      .update({
        archive_status: "failed",
        archive_error: message,
        updated_at: now,
      })
      .eq("id", replay.live_session_id);
  }
}

export async function archiveReplayToR2(params: {
  supabase: SupabaseClient;
  replayId?: string;
  liveSessionId?: string;
}): Promise<ArchiveResult> {
  let query = params.supabase
    .from("live_replays")
    .select("*");

  if (params.replayId) query = query.eq("id", params.replayId);
  else if (params.liveSessionId) query = query.eq("live_session_id", params.liveSessionId).order("created_at", { ascending: false }).limit(1);
  else return { ok: false, status: "failed", error: "replayId or liveSessionId required" };

  let { data: replay, error: replayError } = await query.maybeSingle();
  if (replayError) throw replayError;

  // OBS/RTMP path: a live_session may finish before any live_replays row exists.
  // If we have the session's cloudflare_video_uid, lazily create the replay row
  // so the rest of the pipeline can proceed unchanged.
  if (!replay && params.liveSessionId) {
    const { data: sess, error: sessErr } = await params.supabase
      .from("live_sessions")
      .select("id, host_user_id, owner_id, cloudflare_video_uid, cloudflare_playback_url, cloudflare_mp4_download_url")
      .eq("id", params.liveSessionId)
      .maybeSingle();
    if (sessErr) throw sessErr;
    const uidFromSession = stringFromUnknown(sess?.cloudflare_video_uid);
    const ownerId = stringFromUnknown(sess?.host_user_id) || stringFromUnknown(sess?.owner_id);
    if (sess?.id && uidFromSession && ownerId) {
      const { data: inserted, error: insertErr } = await params.supabase
        .from("live_replays")
        .insert({
          user_id: ownerId,
          live_session_id: sess.id,
          stream_uid: uidFromSession,
          status: "processing",
          archive_status: "pending",
          cloudflare_playback_url: sess.cloudflare_playback_url ?? null,
          cloudflare_mp4_download_url: sess.cloudflare_mp4_download_url ?? null,
        })
        .select("*")
        .single();
      if (insertErr) throw insertErr;
      replay = inserted;
    }
  }

  if (!replay) return { ok: false, status: "failed", error: "Replay not found" };

  if (replay.archive_status === "archived" && replay.stream_deleted_at) {
    return {
      ok: true,
      status: "skipped",
      replay_id: replay.id,
      live_session_id: replay.live_session_id,
      r2_object_key: replay.r2_object_key,
      r2_video_url: replay.r2_video_url,
    };
  }

  const uid = String(replay.stream_uid || "");
  if (!uid) {
    await markArchiveFailure(params.supabase, replay, "Missing Cloudflare Stream UID");
    return { ok: false, status: "failed", replay_id: replay.id, error: "Missing Cloudflare Stream UID" };
  }

  const { data: live, error: liveError } = await params.supabase
    .from("live_sessions")
    .select("id, post_id, live_post_id, replay_post_id, host_user_id, owner_id, title, cloudflare_video_uid")
    .eq("id", replay.live_session_id)
    .maybeSingle();
  if (liveError) throw liveError;

  const userId = String(replay.user_id || live?.host_user_id || live?.owner_id || "");
  if (!userId) {
    await markArchiveFailure(params.supabase, replay, "Missing replay owner");
    return { ok: false, status: "failed", replay_id: replay.id, error: "Missing replay owner" };
  }

  const alreadyArchivedToR2 =
    replay.storage_provider === "r2" &&
    replay.playback_provider === "r2" &&
    typeof replay.r2_object_key === "string" &&
    typeof replay.r2_video_url === "string";

  if (alreadyArchivedToR2 && !replay.stream_deleted_at) {
    const head = await signedR2Fetch({ method: "HEAD", key: String(replay.r2_object_key) });
    if (!head.ok) {
      const message = `R2 verify failed before Stream cleanup: ${head.status}`;
      await markArchiveFailure(params.supabase, replay, message);
      return { ok: false, status: "failed", replay_id: replay.id, error: message };
    }

    try {
      await deleteCloudflareStreamUid(uid);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await markArchiveFailure(params.supabase, replay, message);
      return { ok: false, status: "failed", replay_id: replay.id, error: message };
    }

    const streamDeletedAt = nowIso();
    await params.supabase
      .from("live_replays")
      .update({
        archive_status: "archived",
        archive_error: null,
        stream_deleted_at: streamDeletedAt,
        updated_at: streamDeletedAt,
      })
      .eq("id", replay.id);

    if (live?.id) {
      await params.supabase
        .from("live_sessions")
        .update({
          archive_status: "archived",
          archive_error: null,
          stream_deleted_at: streamDeletedAt,
          updated_at: streamDeletedAt,
        })
        .eq("id", live.id);
    }

    if (live?.post_id) {
      const { data: post } = await params.supabase
        .from("posts")
        .select("metadata")
        .eq("id", live.post_id)
        .maybeSingle();
      const currentMeta = (post?.metadata as Record<string, unknown> | null) || {};
      const metadata = {
        ...currentMeta,
        archive_status: "archived",
        stream_deleted_at: streamDeletedAt,
      };
      // Chỉ UPDATE khi metadata thực sự đổi → tránh 100k+ UPDATE dư thừa từ cron reconcile.
      if (
        currentMeta.archive_status !== "archived" ||
        currentMeta.stream_deleted_at !== streamDeletedAt
      ) {
        await params.supabase.from("posts").update({ metadata, updated_at: streamDeletedAt }).eq("id", live.post_id);
      }
    }

    return {
      ok: true,
      status: "archived",
      replay_id: replay.id,
      live_session_id: replay.live_session_id,
      r2_object_key: String(replay.r2_object_key),
      r2_video_url: String(replay.r2_video_url),
    };
  }

  const now = nowIso();
  await params.supabase
    .from("live_replays")
    .update({
      archive_status: "archiving",
      archive_error: null,
      processing_started_at: replay.processing_started_at ?? now,
      archive_attempts: Number(replay.archive_attempts || 0) + 1,
      updated_at: now,
    })
    .eq("id", replay.id);

  if (live?.id) {
    await params.supabase
      .from("live_sessions")
      .update({
        archive_status: "archiving",
        archive_error: null,
        processing_started_at: replay.processing_started_at ?? now,
        recording_status: "processing",
        updated_at: now,
      })
      .eq("id", live.id);
  }

  let mp4: { url: string | null; status: string | null };
  try {
    mp4 = await fetchOrCreateMp4(uid);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await markArchiveFailure(params.supabase, replay, message);
    return { ok: false, status: "failed", replay_id: replay.id, error: message };
  }

  if (!mp4.url) {
    const attempts = Number(replay.archive_attempts || 0) + 1;
    const nextRetry = addDays(getBackoffSeconds(attempts));
    await params.supabase
      .from("live_replays")
      .update({
        archive_status: "mp4_pending",
        cloudflare_mp4_download_url: mp4.url,
        archive_error: null,
        next_archive_retry_at: nextRetry,
        updated_at: nowIso(),
      })
      .eq("id", replay.id);

    if (live?.id) {
      await params.supabase
        .from("live_sessions")
        .update({
          archive_status: "mp4_pending",
          cloudflare_mp4_download_url: mp4.url,
          archive_error: null,
          updated_at: nowIso(),
        })
        .eq("id", live.id);
    }

    return { ok: true, status: "mp4_pending", replay_id: replay.id, live_session_id: replay.live_session_id };
  }

  const streamEnv = getStreamEnv();
  let download = await fetch(mp4.url, {
    headers: { Authorization: `Bearer ${streamEnv.token}` },
  });
  // Some CF Stream MP4 URLs reject Authorization header; retry without it on 401/403.
  if ((download.status === 401 || download.status === 403) && download.body) {
    try { await download.body.cancel(); } catch { /* ignore */ }
  }
  if (download.status === 401 || download.status === 403) {
    download = await fetch(mp4.url);
  }
  if (!download.ok || !download.body) {
    const message = `Cloudflare MP4 download failed: ${download.status}`;
    await markArchiveFailure(params.supabase, replay, message);
    return { ok: false, status: "failed", replay_id: replay.id, error: message };
  }

  const r2Env = getR2Env();
  const key = sanitizePath(
    String(replay.r2_object_key || `videos/${userId}/live-replays/${replay.live_session_id}/${uid}.mp4`),
  );
  const contentLength = download.headers.get("content-length");

  const put = await signedR2Fetch({
    method: "PUT",
    key,
    body: download.body,
    contentType: "video/mp4",
    contentLength,
  });
  if (!put.ok) {
    const detail = await put.text().catch(() => "");
    const message = `R2 upload failed: ${put.status} ${detail.slice(0, 300)}`;
    await markArchiveFailure(params.supabase, replay, message);
    return { ok: false, status: "failed", replay_id: replay.id, error: message };
  }

  const head = await signedR2Fetch({ method: "HEAD", key });
  if (!head.ok) {
    const message = `R2 verify failed: ${head.status}`;
    await markArchiveFailure(params.supabase, replay, message);
    return { ok: false, status: "failed", replay_id: replay.id, error: message };
  }

  const r2VideoUrl = `${r2Env.publicUrl}/${key}`;
  const archivedAt = nowIso();
  const metadataPatch = {
    live_status: "ended",
    replay_status: "ready",
    playback_type: "r2",
    storage_provider: "r2",
    playback_provider: "r2",
    playback_url: r2VideoUrl,
    playback_mp4: r2VideoUrl,
    r2_video_url: r2VideoUrl,
    r2_object_key: key,
    r2_bucket: r2Env.bucketName,
    stream_uid: uid,
    cloudflare_video_uid: uid,
    cloudflare_playback_url: replay.playback_hls ?? replay.cloudflare_playback_url ?? null,
    cloudflare_mp4_download_url: mp4.url,
    archived_at: archivedAt,
    archive_status: "archived",
    thumbnail_url: replay.thumbnail_url ?? null,
    duration_seconds: replay.duration_seconds ?? null,
  };

  await params.supabase
    .from("live_replays")
    .update({
      status: "ready",
      storage_provider: "r2",
      playback_provider: "r2",
      archive_status: "posting",
      archive_error: null,
      cloudflare_playback_url: replay.playback_hls ?? replay.cloudflare_playback_url,
      cloudflare_mp4_download_url: mp4.url,
      r2_object_key: key,
      r2_bucket: r2Env.bucketName,
      r2_video_url: r2VideoUrl,
      playback_mp4: r2VideoUrl,
      archived_at: archivedAt,
      next_archive_retry_at: null,
      updated_at: archivedAt,
    })
    .eq("id", replay.id);

  if (live?.id) {
    await params.supabase
      .from("live_sessions")
      .update({
        recording_status: "ready",
        recording_ready_at: archivedAt,
        storage_provider: "r2",
        playback_provider: "r2",
        archive_status: "posting",
        archive_error: null,
        cloudflare_video_uid: uid,
        cloudflare_playback_url: replay.playback_hls ?? replay.cloudflare_playback_url,
        cloudflare_mp4_download_url: mp4.url,
        r2_object_key: key,
        r2_bucket: r2Env.bucketName,
        r2_video_url: r2VideoUrl,
        archived_at: archivedAt,
        posted_at: archivedAt,
        updated_at: archivedAt,
      })
      .eq("id", live.id);
  }

  let postId = live?.replay_post_id ?? live?.post_id ?? live?.live_post_id ?? null;
  try {
    if (!postId) {
      const { data: insertedPost, error: insertPostError } = await params.supabase
        .from("posts")
        .insert({
          user_id: userId,
          content: live?.title ?? "Live replay",
          video_url: r2VideoUrl,
          post_type: "live",
          metadata: metadataPatch,
        })
        .select("id")
        .single();
      if (insertPostError) throw insertPostError;
      postId = insertedPost.id;
      if (live?.id) {
        await params.supabase.from("live_sessions").update({ post_id: postId, replay_post_id: postId, posted_at: archivedAt }).eq("id", live.id);
      }
    }

    if (postId) {
      const { data: post } = await params.supabase
        .from("posts")
        .select("metadata")
        .eq("id", postId)
        .maybeSingle();

      const metadata = {
        ...((post?.metadata as Record<string, unknown> | null) || {}),
        ...metadataPatch,
      };

      await params.supabase
        .from("posts")
        .update({
          video_url: r2VideoUrl,
          metadata,
          updated_at: archivedAt,
        })
        .eq("id", postId);
    }

    await params.supabase
      .from("creator_library")
      .upsert({
        user_id: userId,
        post_id: postId,
        live_session_id: live?.id ?? replay.live_session_id,
        live_replay_id: replay.id,
        title: live?.title ?? "Live replay",
        media_type: "video",
        storage_provider: "r2",
        playback_provider: "r2",
        r2_object_key: key,
        r2_bucket: r2Env.bucketName,
        video_url: r2VideoUrl,
        thumbnail_url: replay.thumbnail_url ?? null,
        duration_seconds: replay.duration_seconds ?? null,
        filesize_bytes: Number(head.headers.get("content-length") || replay.filesize_bytes || 0) || null,
        source_stream_uid: uid,
        status: "ready",
        updated_at: archivedAt,
      }, { onConflict: "live_replay_id" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await markArchiveFailure(params.supabase, replay, `Replay post/library creation failed after R2 upload: ${message}`);
    return { ok: false, status: "failed", replay_id: replay.id, live_session_id: replay.live_session_id, error: message };
  }

  await params.supabase
    .from("live_replays")
    .update({ archive_status: "stream_delete_pending", auto_posted_at: archivedAt, updated_at: archivedAt })
    .eq("id", replay.id);

  if (live?.id) {
    await params.supabase
      .from("live_sessions")
      .update({ status: "archiving", archive_status: "stream_delete_pending", replay_post_id: postId, posted_at: archivedAt, updated_at: archivedAt })
      .eq("id", live.id);
  }

  try {
    await deleteCloudflareStreamUid(uid);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await markArchiveFailure(params.supabase, replay, `Cloudflare Stream delete pending: ${message}`);
    return { ok: false, status: "failed", replay_id: replay.id, live_session_id: replay.live_session_id, error: message };
  }
  const streamDeletedAt = nowIso();

  await params.supabase
    .from("live_replays")
    .update({ archive_status: "archived", stream_deleted_at: streamDeletedAt, auto_posted_at: archivedAt, updated_at: streamDeletedAt })
    .eq("id", replay.id);

  if (live?.id) {
    await params.supabase
      .from("live_sessions")
      .update({ status: "posted", archive_status: "archived", stream_deleted_at: streamDeletedAt, auto_posted_at: archivedAt, posted_at: archivedAt, updated_at: streamDeletedAt })
      .eq("id", live.id);
  }

  if (postId) {
    const { data: post } = await params.supabase
      .from("posts")
      .select("metadata")
      .eq("id", postId)
      .maybeSingle();
    const currentMeta = (post?.metadata as Record<string, unknown> | null) || {};
    const metadata = {
      ...currentMeta,
      stream_deleted_at: streamDeletedAt,
    };
    // Chỉ UPDATE khi giá trị thực sự đổi → tránh cron reconcile ghi đè lặp lại.
    if (currentMeta.stream_deleted_at !== streamDeletedAt) {
      await params.supabase.from("posts").update({ metadata, updated_at: streamDeletedAt }).eq("id", postId);
    }
  }

  return {
    ok: true,
    status: "archived",
    replay_id: replay.id,
    live_session_id: replay.live_session_id,
    r2_object_key: key,
    r2_video_url: r2VideoUrl,
  };
}
