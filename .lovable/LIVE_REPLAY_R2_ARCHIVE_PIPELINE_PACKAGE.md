# Live Replay Archive to R2 Pipeline Package

> Package generated for Lovable. This feature makes Cloudflare Stream a temporary processing/transcoding layer only. Final replay storage and playback are moved to Cloudflare R2 MP4.

## Feature Name

**Live Replay Archive to R2 Pipeline**

## Architecture

```text
Agora realtime live
  -> Cloudflare Stream temporary processing / transcoding
  -> Stream video READY
  -> Create / poll MP4 downloadable file
  -> Download MP4
  -> Upload MP4 to Cloudflare R2
  -> Verify R2 object with HEAD
  -> Update DB to storage_provider=r2 and playback_provider=r2
  -> Create/update replay feed post and creator_library item
  -> Delete Cloudflare Stream video only after R2 verify succeeds
```

## Goals

- Keep Agora for realtime interactive livestream.
- Use Cloudflare Stream only as a temporary encoder/transcoder.
- Archive replay MP4 immediately to Cloudflare R2.
- Serve feed replay from R2, not Cloudflare Stream.
- Delete Cloudflare Stream video after successful R2 upload and HEAD verification.
- Keep retry/idempotency metadata so failed archive/delete can resume safely.

## Important Safety Rules

- Never delete Cloudflare Stream before R2 upload succeeds and R2 HEAD verify succeeds.
- If R2 upload/verify fails, keep Cloudflare Stream video and set archive_status=failed for retry.
- Retry jobs must not duplicate posts or re-delete resources already marked deleted.
- Secrets stay inside Supabase Edge Functions only.

## Environment Variables

Required or supported aliases:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_STREAM_API_TOKEN
CLOUDFLARE_STREAM_TOKEN
CLOUDFLARE_API_TOKEN
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
R2_ENDPOINT
R2_PUBLIC_DOMAIN
CLOUDFLARE_R2_PUBLIC_URL
CRON_SECRET
SCHEDULED_FUNCTION_SECRET
```

## Deployment Notes

1. Apply the migration first.
2. Deploy/update the Supabase Edge Functions in this package.
3. Configure Cloudflare Stream webhook to call `stream-webhook`.
4. Schedule `retry-archive-replays` every 10-15 minutes.
5. Keep `retry-post-video-deletes` scheduled for delete cleanup.
6. Confirm R2 public domain or signed playback strategy is configured before production replay.

## Test Plan

- Host Agora live, end live, confirm `live_replays.archive_status` moves through pending/mp4_pending/archiving/archived.
- Confirm final feed replay uses `metadata.r2_video_url` and `playback_provider=r2`.
- Confirm `creator_library` receives a ready video item with R2 URL.
- Confirm Cloudflare Stream video is deleted only after R2 HEAD succeeds.
- Break R2 credentials temporarily: archive should fail, Stream video should remain, retry should recover after env is fixed.
- Delete replay post: R2 object should be deleted and library metadata should be marked deleted.

## Source Code

### `supabase/migrations/20260507133000_live_replay_archive_to_r2.sql`

````sql
-- Archive Cloudflare Stream live replays to R2 and remove Stream as long-term storage.

ALTER TABLE public.live_replays
  ADD COLUMN IF NOT EXISTS cloudflare_playback_url text,
  ADD COLUMN IF NOT EXISTS cloudflare_mp4_download_url text,
  ADD COLUMN IF NOT EXISTS r2_object_key text,
  ADD COLUMN IF NOT EXISTS r2_bucket text,
  ADD COLUMN IF NOT EXISTS r2_video_url text,
  ADD COLUMN IF NOT EXISTS storage_provider text NOT NULL DEFAULT 'cloudflare_stream',
  ADD COLUMN IF NOT EXISTS playback_provider text NOT NULL DEFAULT 'cloudflare_stream',
  ADD COLUMN IF NOT EXISTS archive_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS archive_error text,
  ADD COLUMN IF NOT EXISTS archive_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_archive_retry_at timestamptz,
  ADD COLUMN IF NOT EXISTS processing_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS stream_deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS auto_posted_at timestamptz;

ALTER TABLE public.live_replays
  DROP CONSTRAINT IF EXISTS live_replays_archive_status_check;

ALTER TABLE public.live_replays
  ADD CONSTRAINT live_replays_archive_status_check
  CHECK (archive_status IN ('pending', 'mp4_pending', 'archiving', 'archived', 'failed'));

ALTER TABLE public.live_replays
  DROP CONSTRAINT IF EXISTS live_replays_storage_provider_check;

ALTER TABLE public.live_replays
  ADD CONSTRAINT live_replays_storage_provider_check
  CHECK (storage_provider IN ('cloudflare_stream', 'r2'));

ALTER TABLE public.live_replays
  DROP CONSTRAINT IF EXISTS live_replays_playback_provider_check;

ALTER TABLE public.live_replays
  ADD CONSTRAINT live_replays_playback_provider_check
  CHECK (playback_provider IN ('cloudflare_stream', 'r2'));

CREATE INDEX IF NOT EXISTS idx_live_replays_archive_retry
  ON public.live_replays(next_archive_retry_at ASC, updated_at ASC)
  WHERE archive_status IN ('pending', 'mp4_pending', 'failed') AND stream_deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_live_replays_r2_object_key
  ON public.live_replays(r2_object_key)
  WHERE r2_object_key IS NOT NULL;

ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS storage_provider text,
  ADD COLUMN IF NOT EXISTS playback_provider text,
  ADD COLUMN IF NOT EXISTS cloudflare_playback_url text,
  ADD COLUMN IF NOT EXISTS cloudflare_mp4_download_url text,
  ADD COLUMN IF NOT EXISTS r2_object_key text,
  ADD COLUMN IF NOT EXISTS r2_bucket text,
  ADD COLUMN IF NOT EXISTS r2_video_url text,
  ADD COLUMN IF NOT EXISTS archive_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS archive_error text,
  ADD COLUMN IF NOT EXISTS processing_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS stream_deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS auto_posted_at timestamptz;

ALTER TABLE public.live_sessions
  DROP CONSTRAINT IF EXISTS live_sessions_archive_status_check;

ALTER TABLE public.live_sessions
  ADD CONSTRAINT live_sessions_archive_status_check
  CHECK (archive_status IN ('pending', 'mp4_pending', 'archiving', 'archived', 'failed'));

CREATE TABLE IF NOT EXISTS public.creator_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id uuid REFERENCES public.posts(id) ON DELETE SET NULL,
  live_session_id uuid REFERENCES public.live_sessions(id) ON DELETE SET NULL,
  live_replay_id uuid REFERENCES public.live_replays(id) ON DELETE SET NULL,
  title text,
  media_type text NOT NULL DEFAULT 'video',
  storage_provider text NOT NULL DEFAULT 'r2',
  playback_provider text NOT NULL DEFAULT 'r2',
  r2_object_key text NOT NULL,
  r2_bucket text,
  video_url text NOT NULL,
  thumbnail_url text,
  duration_seconds integer,
  filesize_bytes bigint,
  source_stream_uid text,
  status text NOT NULL DEFAULT 'ready',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT creator_library_media_type_check CHECK (media_type IN ('video')),
  CONSTRAINT creator_library_status_check CHECK (status IN ('ready', 'deleted', 'failed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_creator_library_live_replay_unique
  ON public.creator_library(live_replay_id)
  WHERE live_replay_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_creator_library_user_created
  ON public.creator_library(user_id, created_at DESC)
  WHERE deleted_at IS NULL;

ALTER TABLE public.creator_library ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Creator library owners can read" ON public.creator_library;
CREATE POLICY "Creator library owners can read"
ON public.creator_library
FOR SELECT
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Service role manages creator library" ON public.creator_library;
CREATE POLICY "Service role manages creator library"
ON public.creator_library
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

````

### `supabase/functions/_shared/archiveReplay.ts`

````ts
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

async function fetchOrCreateMp4(uid: string): Promise<{ url: string | null; status: string | null }> {
  const env = getStreamEnv();
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

  const { data: replay, error: replayError } = await query.maybeSingle();
  if (replayError) throw replayError;
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
    .select("id, post_id, host_user_id, owner_id, title, cloudflare_video_uid")
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
      const metadata = {
        ...((post?.metadata as Record<string, unknown> | null) || {}),
        archive_status: "archived",
        stream_deleted_at: streamDeletedAt,
      };
      await params.supabase.from("posts").update({ metadata, updated_at: streamDeletedAt }).eq("id", live.post_id);
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

  const download = await fetch(mp4.url);
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
      archive_status: "archived",
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
        archive_status: "archived",
        archive_error: null,
        cloudflare_video_uid: uid,
        cloudflare_playback_url: replay.playback_hls ?? replay.cloudflare_playback_url,
        cloudflare_mp4_download_url: mp4.url,
        r2_object_key: key,
        r2_bucket: r2Env.bucketName,
        r2_video_url: r2VideoUrl,
        archived_at: archivedAt,
        updated_at: archivedAt,
      })
      .eq("id", live.id);
  }

  let postId = live?.post_id ?? null;
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
      await params.supabase.from("live_sessions").update({ post_id: postId }).eq("id", live.id);
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

  await deleteCloudflareStreamUid(uid);
  const streamDeletedAt = nowIso();

  await params.supabase
    .from("live_replays")
    .update({ stream_deleted_at: streamDeletedAt, auto_posted_at: archivedAt, updated_at: streamDeletedAt })
    .eq("id", replay.id);

  if (live?.id) {
    await params.supabase
      .from("live_sessions")
      .update({ stream_deleted_at: streamDeletedAt, auto_posted_at: archivedAt, updated_at: streamDeletedAt })
      .eq("id", live.id);
  }

  if (postId) {
    const { data: post } = await params.supabase
      .from("posts")
      .select("metadata")
      .eq("id", postId)
      .maybeSingle();
    const metadata = {
      ...((post?.metadata as Record<string, unknown> | null) || {}),
      stream_deleted_at: streamDeletedAt,
    };
    await params.supabase.from("posts").update({ metadata, updated_at: streamDeletedAt }).eq("id", postId);
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

````

### `supabase/functions/archive-replay-to-r2/index.ts`

````ts
import { createClient } from "npm:@supabase/supabase-js@2";
import { archiveReplayToR2 } from "../_shared/archiveReplay.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) return json({ error: "Missing Supabase config" }, 500);

    const cronSecret = Deno.env.get("CRON_SECRET") ?? Deno.env.get("SCHEDULED_FUNCTION_SECRET");
    if (cronSecret) {
      const authToken = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
      const headerToken = req.headers.get("x-cron-secret");
      if (authToken !== cronSecret && headerToken !== cronSecret) {
        return json({ error: "Unauthorized" }, 401);
      }
    }

    const body = await req.json().catch(() => ({}));
    const replayId = typeof body.replay_id === "string" ? body.replay_id : undefined;
    const liveSessionId = typeof body.live_session_id === "string" ? body.live_session_id : undefined;

    if (!replayId && !liveSessionId) {
      return json({ error: "replay_id or live_session_id required" }, 400);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const result = await archiveReplayToR2({ supabase, replayId, liveSessionId });
    return json(result, result.ok ? 200 : 500);
  } catch (error) {
    console.error("[archive-replay-to-r2]", error);
    return json({ ok: false, status: "failed", error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});

````

### `supabase/functions/retry-archive-replays/index.ts`

````ts
import { createClient } from "npm:@supabase/supabase-js@2";
import { archiveReplayToR2 } from "../_shared/archiveReplay.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
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
    const cronSecret = Deno.env.get("CRON_SECRET") ?? Deno.env.get("SCHEDULED_FUNCTION_SECRET");
    if (cronSecret) {
      const authToken = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
      const headerToken = req.headers.get("x-cron-secret");
      if (authToken !== cronSecret && headerToken !== cronSecret) {
        return json({ error: "Unauthorized" }, 401);
      }
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) return json({ error: "Missing Supabase config" }, 500);

    const body = await req.json().catch(() => ({}));
    const limit = typeof body.limit === "number" && body.limit > 0 ? Math.min(body.limit, 20) : 10;
    const now = new Date().toISOString();

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: replays, error } = await supabase
      .from("live_replays")
      .select("id")
      .in("archive_status", ["pending", "mp4_pending", "failed"])
      .is("stream_deleted_at", null)
      .or(`next_archive_retry_at.is.null,next_archive_retry_at.lte.${now}`)
      .order("updated_at", { ascending: true })
      .limit(limit);

    if (error) throw error;

    const results = [];
    for (const replay of replays ?? []) {
      results.push(await archiveReplayToR2({ supabase, replayId: replay.id }));
    }

    return json({ ok: true, processed: results.length, results });
  } catch (error) {
    console.error("[retry-archive-replays]", error);
    return json({ ok: false, error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});

````

### `supabase/functions/live-replay-create-upload/index.ts`

````ts
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BASIC_UPLOAD_LIMIT_BYTES = 200 * 1024 * 1024;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function b64(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization header" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const accountId = Deno.env.get("CLOUDFLARE_ACCOUNT_ID") ?? "";
    const streamToken =
      Deno.env.get("CLOUDFLARE_STREAM_TOKEN") ??
      Deno.env.get("CLOUDFLARE_STREAM_API_TOKEN") ??
      "";

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return json({ error: "Missing Supabase configuration" }, 500);
    }
    if (!accountId || !streamToken) {
      return json({ error: "Missing Cloudflare Stream configuration" }, 500);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const liveSessionId = String(body.live_session_id || "");
    const chunkedRecordingId = body.chunked_recording_id ? String(body.chunked_recording_id) : null;
    const expectedSize = Number(body.expected_size || 0);
    const sourceWebmKey = body.source_webm_key ? String(body.source_webm_key) : null;

    if (!liveSessionId || !Number.isFinite(expectedSize) || expectedSize <= 0) {
      return json({ error: "live_session_id and expected_size are required" }, 400);
    }

    const { data: live, error: liveError } = await serviceClient
      .from("live_sessions")
      .select("id, host_user_id, owner_id, post_id, title")
      .eq("id", liveSessionId)
      .maybeSingle();

    if (liveError) throw liveError;
    if (!live) return json({ error: "Live session not found" }, 404);

    const { data: isAdmin } = await userClient.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    const isHost = live.host_user_id === user.id || live.owner_id === user.id;
    if (!isHost && !isAdmin) return json({ error: "Forbidden" }, 403);

    const safeName = `fun-live-replay-${liveSessionId}.webm`;
    const useTus = expectedSize > BASIC_UPLOAD_LIMIT_BYTES;

    let uploadURL = "";
    let streamUid = "";
    const uploadMethod: "form" | "tus" = useTus ? "tus" : "form";

    if (useTus) {
      const metadata = [
        `maxDurationSeconds ${b64("36000")}`,
        `requiresignedurls ${b64("false")}`,
        `name ${b64(safeName)}`,
        `filename ${b64(safeName)}`,
        `filetype ${b64("video/webm")}`,
      ].join(",");

      const cfResponse = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream?direct_user=true`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${streamToken}`,
            "Tus-Resumable": "1.0.0",
            "Upload-Length": String(expectedSize),
            "Upload-Metadata": metadata,
          },
        },
      );

      if (!cfResponse.ok) {
        const detail = await cfResponse.text();
        return json({ error: "Cloudflare TUS upload URL failed", detail }, 502);
      }

      uploadURL = cfResponse.headers.get("Location") || "";
      streamUid = cfResponse.headers.get("stream-media-id") || "";
    } else {
      const cfResponse = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/direct_upload`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${streamToken}`,
            "Content-Type": "application/json",
            "Upload-Creator": user.id,
          },
          body: JSON.stringify({
            maxDurationSeconds: 36000,
            requireSignedURLs: false,
            allowedOrigins: ["*"],
            meta: {
              replay_id: "",
              live_session_id: liveSessionId,
              user_id: user.id,
              filename: safeName,
              filetype: "video/webm",
            },
          }),
        },
      );

      if (!cfResponse.ok) {
        const detail = await cfResponse.text();
        return json({ error: "Cloudflare direct upload URL failed", detail }, 502);
      }

      const cfData = await cfResponse.json();
      uploadURL = cfData.result?.uploadURL || "";
      streamUid = cfData.result?.uid || "";
    }

    if (!uploadURL || !streamUid) {
      return json({ error: "Cloudflare did not return upload URL or UID" }, 502);
    }

    const { data: replay, error: replayError } = await serviceClient
      .from("live_replays")
      .insert({
        user_id: user.id,
        live_session_id: liveSessionId,
        chunked_recording_id: chunkedRecordingId,
        source_webm_key: sourceWebmKey,
        stream_uid: streamUid,
        filesize_bytes: expectedSize,
        status: "uploading",
      })
      .select("id")
      .single();

    if (replayError) throw replayError;

    await serviceClient
      .from("live_sessions")
      .update({
        recording_status: "uploading",
        archive_status: "pending",
        cloudflare_video_uid: streamUid,
        recording_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", liveSessionId);

    return json({
      uploadURL,
      stream_uid: streamUid,
      replay_id: replay.id,
      upload_method: uploadMethod,
    });
  } catch (error) {
    console.error("[live-replay-create-upload]", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});

````

### `supabase/functions/stream-webhook/index.ts`

````ts
import { createClient } from "npm:@supabase/supabase-js@2";
import { archiveReplayToR2 } from "../_shared/archiveReplay.ts";

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

/**
 * Enable MP4 downloads on a Cloudflare Stream video.
 * Returns { url, ready } â€” `url` is the MP4 download URL when status is "ready",
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
    const webhookSecret = Deno.env.get("CLOUDFLARE_STREAM_WEBHOOK_SECRET") ?? "";

    // Bootstrap mode: secret chua duoc cau hinh -> tra 200 de Cloudflare reveal secret.
    // KHONG ghi DB vi payload chua duoc xac thuc.
    if (!webhookSecret) {
      console.warn("[stream-webhook] BOOTSTRAP MODE: CLOUDFLARE_STREAM_WEBHOOK_SECRET is not set. Skipping signature verification and DB writes.");
      return json({ ok: true, bootstrap: true, message: "Set CLOUDFLARE_STREAM_WEBHOOK_SECRET to enable processing." });
    }

    const ok = await verifySignature(rawBody, req.headers.get("Webhook-Signature"), webhookSecret);
    if (!ok) return json({ error: "Invalid webhook signature" }, 401);

    const payload = JSON.parse(rawBody);
    const uid = String(payload.uid || "");
    if (!uid) return json({ error: "Missing uid" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const customerCode = Deno.env.get("CLOUDFLARE_STREAM_CUSTOMER_CODE") ?? "";
    if (!supabaseUrl || !serviceRoleKey) return json({ error: "Missing Supabase configuration" }, 500);

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

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

      if (!liveSessionId || !userId) return json({ ok: true, ignored: "unknown uid" });

      const { data: insertedReplay, error: insertReplayError } = await supabase
        .from("live_replays")
        .insert({
          user_id: userId,
          live_session_id: liveSessionId,
          stream_uid: uid,
          status: "processing",
        })
        .select("id, live_session_id")
        .single();
      if (insertReplayError) throw insertReplayError;
      replay = insertedReplay;
    }

    const state = payload.status?.state || "";
    const errorText =
      payload.status?.errorReasonText ||
      payload.status?.errReasonText ||
      payload.status?.errorReasonCode ||
      payload.status?.errReasonCode ||
      "";

    if (payload.readyToStream === true && state === "ready") {
      const urls = buildUrls(uid, customerCode);
      const playbackHls = payload.playback?.hls || urls.hls;
      const playbackDash = payload.playback?.dash || urls.dash;
      const thumbnailUrl = payload.thumbnail || urls.thumbnail;
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
        .select("id, post_id")
        .eq("id", updatedReplay.live_session_id)
        .maybeSingle();

      if (live?.post_id) {
        const { data: post } = await supabase
          .from("posts")
          .select("metadata")
          .eq("id", live.post_id)
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
          .eq("id", live.post_id);
      }


      await supabase
        .from("live_sessions")
        .update({
          recording_status: "ready",
          archive_status: "pending",
          cloudflare_playback_url: playbackHls,
          cloudflare_mp4_download_url: playbackMp4,
          recording_ready_at: new Date().toISOString(),
          cloudflare_video_uid: uid,
          recording_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", updatedReplay.live_session_id);

      await archiveReplayToR2({ supabase, replayId: replay.id });
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

````

### `supabase/functions/reconcile-pending-replays/index.ts`

````ts
import { createClient } from "npm:@supabase/supabase-js@2";
import { archiveReplayToR2 } from "../_shared/archiveReplay.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function buildUrls(uid: string, customerCode: string) {
  const base = customerCode
    ? `https://customer-${customerCode}.cloudflarestream.com/${uid}`
    : `https://videodelivery.net/${uid}`;
  return {
    hls: `${base}/manifest/video.m3u8`,
    dash: `${base}/manifest/video.mpd`,
    thumbnail: `${base}/thumbnails/thumbnail.jpg?time=3s`,
  };
}

async function enableMp4Download(
  accountId: string,
  apiToken: string,
  uid: string,
): Promise<string | null> {
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
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return null;
    const def = j?.result?.default;
    return def?.status === "ready" && typeof def?.url === "string" ? def.url : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const accountId = Deno.env.get("CLOUDFLARE_ACCOUNT_ID") ?? "";
    const apiToken =
      Deno.env.get("CLOUDFLARE_STREAM_API_TOKEN") ??
      Deno.env.get("CLOUDFLARE_STREAM_TOKEN") ??
      "";
    const customerCode = Deno.env.get("CLOUDFLARE_STREAM_CUSTOMER_CODE") ?? "";

    if (!supabaseUrl || !serviceRoleKey) return json({ error: "Missing Supabase config" }, 500);
    if (!accountId || !apiToken) return json({ error: "Missing Cloudflare config" }, 500);

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: pending, error: pendErr } = await supabase
      .from("live_replays")
      .select("id, live_session_id, stream_uid, status, created_at")
      .in("status", ["uploading", "queued", "processing"])
      .gte("created_at", cutoff)
      .order("created_at", { ascending: true })
      .limit(20);

    if (pendErr) throw pendErr;

    const result = { checked: 0, promoted: 0, failed: 0, still_processing: 0, not_found: 0 };

    for (const row of pending ?? []) {
      result.checked += 1;
      const uid = row.stream_uid as string | null;
      if (!uid) continue;

      const cfRes = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${uid}`,
        { headers: { Authorization: `Bearer ${apiToken}` } },
      );

      // 404 â€” UID not on Cloudflare. If old enough, mark failed.
      if (cfRes.status === 404) {
        const ageMs = Date.now() - new Date(row.created_at as string).getTime();
        if (ageMs > 30 * 60 * 1000) {
          await supabase
            .from("live_replays")
            .update({
              status: "failed",
              error_message: "Stream UID not found on Cloudflare",
              updated_at: new Date().toISOString(),
            })
            .eq("id", row.id);
          await supabase
            .from("live_sessions")
            .update({
              recording_status: "failed",
              recording_error: "Stream UID not found on Cloudflare",
              updated_at: new Date().toISOString(),
            })
            .eq("id", row.live_session_id);
          result.failed += 1;
        } else {
          result.not_found += 1;
        }
        continue;
      }

      if (!cfRes.ok) {
        console.warn(`[reconcile] CF ${cfRes.status} for uid=${uid}`);
        continue;
      }

      const cfJson = await cfRes.json().catch(() => null);
      const v = cfJson?.result;
      if (!v) continue;

      const state = v.status?.state || "";
      const ready = v.readyToStream === true && state === "ready";

      if (ready) {
        const urls = buildUrls(uid, customerCode);
        const playbackHls = v.playback?.hls || urls.hls;
        const playbackDash = v.playback?.dash || urls.dash;
        const thumbnailUrl = v.thumbnail || urls.thumbnail;
        const durationSeconds = Number.isFinite(Number(v.duration))
          ? Math.round(Number(v.duration))
          : null;
        const size = Number.isFinite(Number(v.size)) ? Number(v.size) : null;

        const playbackMp4 = await enableMp4Download(accountId, apiToken, uid);

        await supabase
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
          .eq("id", row.id);

        const { data: live } = await supabase
          .from("live_sessions")
          .select("id, post_id")
          .eq("id", row.live_session_id)
          .maybeSingle();

        if (live?.post_id) {
          const { data: post } = await supabase
            .from("posts")
            .select("metadata")
            .eq("id", live.post_id)
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
            .eq("id", live.post_id);
        }

        await supabase
          .from("live_sessions")
          .update({
            recording_status: "ready",
            archive_status: "pending",
            cloudflare_playback_url: playbackHls,
            cloudflare_mp4_download_url: playbackMp4,
            recording_ready_at: new Date().toISOString(),
            recording_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.live_session_id);

        await archiveReplayToR2({ supabase, replayId: row.id });

        result.promoted += 1;
      } else if (state === "error") {
        const errText =
          v.status?.errorReasonText ||
          v.status?.errReasonText ||
          v.status?.errorReasonCode ||
          "Cloudflare Stream processing failed";
        await supabase
          .from("live_replays")
          .update({
            status: "failed",
            error_message: errText,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        await supabase
          .from("live_sessions")
          .update({
            recording_status: "failed",
            recording_error: errText,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.live_session_id);
        result.failed += 1;
      } else {
        // still processing â€” just bump status to 'processing'
        await supabase
          .from("live_replays")
          .update({ status: "processing", updated_at: new Date().toISOString() })
          .eq("id", row.id)
          .in("status", ["uploading", "queued"]);
        result.still_processing += 1;
      }
    }

    return json({ ok: true, ...result });
  } catch (error) {
    console.error("[reconcile-pending-replays]", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});

````

### `supabase/functions/stream-mp4-finalize/index.ts`

````ts
import { createClient } from "npm:@supabase/supabase-js@2";
import { archiveReplayToR2 } from "../_shared/archiveReplay.ts";

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

/**
 * GET (or POST to create) the MP4 download for a Cloudflare Stream video.
 * If the MP4 has not been requested yet, POST kicks off the render.
 * Returns { url, status } where status is "ready" | "inprogress" | null.
 */
async function fetchOrCreateMp4(uid: string): Promise<{ url: string | null; status: string | null }> {
  const accountId = Deno.env.get("CLOUDFLARE_ACCOUNT_ID") ?? "";
  const apiToken = Deno.env.get("CLOUDFLARE_STREAM_API_TOKEN") ?? "";
  if (!accountId || !apiToken) return { url: null, status: null };

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/${uid}/downloads`;

  // Try GET first (cheap when render already started).
  let res = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${apiToken}` },
  });
  let body = await res.json().catch(() => ({} as Record<string, unknown>));
  let def = (body as { result?: { default?: { url?: string; status?: string } } })?.result?.default;

  // If no render exists yet, POST to create one.
  if (!def?.status) {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
    });
    body = await res.json().catch(() => ({} as Record<string, unknown>));
    def = (body as { result?: { default?: { url?: string; status?: string } } })?.result?.default;
  }

  const status = def?.status ?? null;
  const mp4Url = typeof def?.url === "string" ? def.url : null;
  return {
    url: status === "ready" ? mp4Url : null,
    status,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ error: "Missing Supabase configuration" }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const replayId = typeof body?.replay_id === "string" ? body.replay_id : null;
    const sessionId = typeof body?.live_session_id === "string" ? body.live_session_id : null;
    if (!replayId && !sessionId) {
      return json({ error: "replay_id or live_session_id required" }, 400);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let q = supabase
      .from("live_replays")
      .select("id, live_session_id, stream_uid, playback_mp4, status");
    if (replayId) q = q.eq("id", replayId);
    else if (sessionId) q = q.eq("live_session_id", sessionId).order("created_at", { ascending: false }).limit(1);
    const { data: replay, error: replayErr } = await q.maybeSingle();
    if (replayErr) throw replayErr;
    if (!replay) return json({ error: "Replay not found" }, 404);

    if (!replay.stream_uid) {
      return json({ ok: true, status: replay.status, mp4_ready: false, message: "No stream_uid yet" });
    }

    if (replay.playback_mp4) {
      const archive = await archiveReplayToR2({ supabase, replayId: replay.id });
      return json({ ok: true, status: archive.status, mp4_ready: archive.status === "archived", playback_mp4: archive.r2_video_url ?? replay.playback_mp4, archive });
    }

    const result = await fetchOrCreateMp4(replay.stream_uid);

    if (result.url) {
      // Update live_replays
      const { error: updErr } = await supabase
        .from("live_replays")
        .update({ playback_mp4: result.url, updated_at: new Date().toISOString() })
        .eq("id", replay.id);
      if (updErr) console.warn("[stream-mp4-finalize] live_replays update", updErr);

      // Update posts.metadata.playback_mp4 if linked
      const { data: live } = await supabase
        .from("live_sessions")
        .select("post_id")
        .eq("id", replay.live_session_id)
        .maybeSingle();

      if (live?.post_id) {
        const { data: post } = await supabase
          .from("posts")
          .select("metadata")
          .eq("id", live.post_id)
          .maybeSingle();
        const metadata = {
          ...((post?.metadata as Record<string, unknown> | null) || {}),
          playback_mp4: result.url,
        };
        await supabase
          .from("posts")
          .update({ metadata })
          .eq("id", live.post_id);
      }

      const archive = await archiveReplayToR2({ supabase, replayId: replay.id });
      return json({ ok: true, status: archive.status, mp4_ready: archive.status === "archived", playback_mp4: archive.r2_video_url ?? result.url, archive });
    }

    return json({
      ok: true,
      status: result.status ?? "inprogress",
      mp4_ready: false,
      message: "MP4 still rendering on Cloudflare Stream",
    });
  } catch (error) {
    console.error("[stream-mp4-finalize]", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});

````

### `supabase/functions/_shared/postVideoDelete.ts`

````ts
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export type DeleteTarget = {
  id: string;
  type: "cloudflare_stream" | "r2";
  value: string;
  source?: string;
  status?: "pending" | "deleted" | "failed" | "skipped";
  deleted_at?: string;
  error?: string;
};

export type DeleteMetadata = {
  version: 1;
  post_id: string;
  live_session_ids: string[];
  targets: DeleteTarget[];
  updated_at: string;
};

type CloudflareEnv = {
  streamAccountId?: string;
  streamToken?: string;
  r2AccountId?: string;
  r2AccessKeyId?: string;
  r2SecretAccessKey?: string;
  r2BucketName?: string;
  r2Endpoint?: string;
  r2PublicDomain?: string;
};

const STREAM_UID_RE = /^[a-f0-9]{32}$/i;
const ALLOWED_KEY_BUCKETS = new Set(["avatars", "covers", "posts", "videos", "comment-media"]);
const STREAM_HOST_HINTS = [
  "cloudflarestream.com",
  "videodelivery.net",
  "watch.cloudflarestream.com",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function nowIso(): string {
  return new Date().toISOString();
}

function sanitizeKey(key: string): string {
  return key.replace(/\\/g, "/").replace(/^\/+/, "");
}

function isValidR2Key(key: string): boolean {
  const clean = sanitizeKey(key);
  if (!clean || clean.includes("..") || clean.includes("//")) return false;
  const bucket = clean.split("/").filter(Boolean)[0];
  return !!bucket && ALLOWED_KEY_BUCKETS.has(bucket);
}

function addUniqueTarget(targets: Map<string, DeleteTarget>, target: Omit<DeleteTarget, "id">) {
  const key = `${target.type}:${target.value}`;
  if (targets.has(key)) return;
  targets.set(key, { ...target, id: key, status: target.status ?? "pending" });
}

function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") {
    out.push(value);
    return out;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectStrings(item, out));
    return out;
  }

  if (isRecord(value)) {
    Object.values(value).forEach((item) => collectStrings(item, out));
  }

  return out;
}

export function getCloudflareEnv(): CloudflareEnv {
  const accountId = Deno.env.get("CLOUDFLARE_ACCOUNT_ID") ?? undefined;
  return {
    streamAccountId: accountId,
    streamToken:
      Deno.env.get("CLOUDFLARE_STREAM_API_TOKEN") ??
      Deno.env.get("CLOUDFLARE_STREAM_TOKEN") ??
      Deno.env.get("CLOUDFLARE_API_TOKEN") ??
      undefined,
    r2AccountId: Deno.env.get("R2_ACCOUNT_ID") ?? accountId,
    r2AccessKeyId:
      Deno.env.get("R2_ACCESS_KEY_ID") ??
      Deno.env.get("CLOUDFLARE_ACCESS_KEY_ID") ??
      undefined,
    r2SecretAccessKey:
      Deno.env.get("R2_SECRET_ACCESS_KEY") ??
      Deno.env.get("CLOUDFLARE_SECRET_ACCESS_KEY") ??
      undefined,
    r2BucketName:
      Deno.env.get("R2_BUCKET_NAME") ??
      Deno.env.get("CLOUDFLARE_R2_BUCKET_NAME") ??
      undefined,
    r2Endpoint: Deno.env.get("R2_ENDPOINT") ?? undefined,
    r2PublicDomain:
      Deno.env.get("R2_PUBLIC_DOMAIN") ??
      Deno.env.get("CLOUDFLARE_R2_PUBLIC_URL") ??
      undefined,
  };
}

export function extractStreamUid(value: string): string | null {
  const trimmed = value.trim();
  if (STREAM_UID_RE.test(trimmed)) return trimmed;

  try {
    const url = new URL(trimmed);
    if (!STREAM_HOST_HINTS.some((host) => url.hostname.includes(host))) return null;
    const candidate = url.pathname.split("/").filter(Boolean).find((part) => STREAM_UID_RE.test(part));
    return candidate ?? null;
  } catch {
    return null;
  }
}

export function extractR2Key(value: string, env = getCloudflareEnv()): string | null {
  const trimmed = sanitizeKey(value.trim());
  if (isValidR2Key(trimmed)) return trimmed;

  try {
    const url = new URL(value);
    const publicDomain = env.r2PublicDomain
      ? env.r2PublicDomain.replace(/^https?:\/\//, "").replace(/\/+$/, "")
      : null;
    const hostMatchesPublicDomain = publicDomain && url.hostname === publicDomain;
    const hostLooksLikeR2 =
      url.hostname.includes(".r2.cloudflarestorage.com") ||
      url.hostname.includes(".r2.dev") ||
      !!hostMatchesPublicDomain;

    if (!hostLooksLikeR2) return null;

    const pathParts = url.pathname.split("/").filter(Boolean);
    if (pathParts.length === 0) return null;

    const bucketName = env.r2BucketName;
    const keyParts = bucketName && pathParts[0] === bucketName ? pathParts.slice(1) : pathParts;
    const key = sanitizeKey(decodeURIComponent(keyParts.join("/")));
    return isValidR2Key(key) ? key : null;
  } catch {
    return null;
  }
}

export async function buildDeleteMetadata(params: {
  supabase: SupabaseClient;
  post: Record<string, unknown>;
}): Promise<DeleteMetadata> {
  const targets = new Map<string, DeleteTarget>();
  const liveSessionIds = new Set<string>();
  const env = getCloudflareEnv();
  const metadata = isRecord(params.post.metadata) ? params.post.metadata : {};

  const directStreamKeys = [
    "cloudflare_video_uid",
    "cloudflare_stream_uid",
    "stream_video_id",
    "stream_uid",
  ];

  for (const key of directStreamKeys) {
    const uid = asString(metadata[key]);
    if (uid && STREAM_UID_RE.test(uid)) {
      addUniqueTarget(targets, {
        type: "cloudflare_stream",
        value: uid,
        source: `posts.metadata.${key}`,
      });
    }
  }

  const directR2Keys = ["r2_object_key", "r2_key", "source_webm_key"];
  for (const key of directR2Keys) {
    const r2Key = asString(metadata[key]);
    if (r2Key) {
      const cleanKey = extractR2Key(r2Key, env);
      if (cleanKey) {
        addUniqueTarget(targets, {
          type: "r2",
          value: cleanKey,
          source: `posts.metadata.${key}`,
        });
      }
    }
  }

  const sessionId = asString(metadata.live_session_id);
  if (sessionId) liveSessionIds.add(sessionId);

  const strings = [
    ...collectStrings(params.post.video_url),
    ...collectStrings(params.post.media_urls),
    ...collectStrings(metadata),
  ];

  for (const value of strings) {
    const streamUid = extractStreamUid(value);
    if (streamUid) {
      addUniqueTarget(targets, {
        type: "cloudflare_stream",
        value: streamUid,
        source: "posts.url_or_metadata",
      });
    }

    const r2Key = extractR2Key(value, env);
    if (r2Key) {
      addUniqueTarget(targets, {
        type: "r2",
        value: r2Key,
        source: "posts.url_or_metadata",
      });
    }
  }

  const postId = asString(params.post.id);
  if (postId) {
    const { data: sessions } = await params.supabase
      .from("live_sessions")
      .select("id, cloudflare_video_uid")
      .eq("post_id", postId);

    for (const session of sessions ?? []) {
      if (session.id) liveSessionIds.add(session.id);
      if (session.cloudflare_video_uid) {
        addUniqueTarget(targets, {
          type: "cloudflare_stream",
          value: session.cloudflare_video_uid,
          source: "live_sessions.cloudflare_video_uid",
        });
      }
    }
  }

  if (liveSessionIds.size > 0) {
    const ids = [...liveSessionIds];

    const { data: replays } = await params.supabase
      .from("live_replays")
      .select("live_session_id, stream_uid, source_webm_key, playback_hls, playback_dash, playback_mp4, r2_object_key, r2_video_url")
      .in("live_session_id", ids);

    for (const replay of replays ?? []) {
      if (replay.stream_uid) {
        addUniqueTarget(targets, {
          type: "cloudflare_stream",
          value: replay.stream_uid,
          source: "live_replays.stream_uid",
        });
      }

      for (const value of collectStrings(replay)) {
        const r2Key = extractR2Key(value, env);
        if (r2Key) {
          addUniqueTarget(targets, {
            type: "r2",
            value: r2Key,
            source: "live_replays",
          });
        }
      }
    }

    const { data: recordings } = await params.supabase
      .from("live_recordings")
      .select("live_id, media_url, file_list_json")
      .in("live_id", ids);

    for (const recording of recordings ?? []) {
      for (const value of collectStrings(recording)) {
        const streamUid = extractStreamUid(value);
        if (streamUid) {
          addUniqueTarget(targets, {
            type: "cloudflare_stream",
            value: streamUid,
            source: "live_recordings",
          });
        }

        const r2Key = extractR2Key(value, env);
        if (r2Key) {
          addUniqueTarget(targets, {
            type: "r2",
            value: r2Key,
            source: "live_recordings",
          });
        }
      }
    }
  }

  return {
    version: 1,
    post_id: String(params.post.id),
    live_session_ids: [...liveSessionIds],
    targets: [...targets.values()],
    updated_at: nowIso(),
  };
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

async function getSignatureKey(
  key: string,
  dateStamp: string,
  region: string,
  service: string,
): Promise<ArrayBuffer> {
  const kDate = await hmacSha256(new TextEncoder().encode("AWS4" + key).buffer, dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  return hmacSha256(kService, "aws4_request");
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function createPresignedUrlForDelete(params: {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  key: string;
  endpoint?: string;
  expiresInSeconds?: number;
}): Promise<string> {
  const expiresIn = params.expiresInSeconds ?? 300;
  const region = "auto";
  const service = "s3";
  const endpoint = (params.endpoint ?? `https://${params.accountId}.r2.cloudflarestorage.com`).replace(/\/+$/, "");
  const host = new URL(endpoint).host;
  const cleanKey = sanitizeKey(params.key);

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const canonicalUri = `/${params.bucketName}/${cleanKey}`;
  const signedHeaders = "host";
  const algorithm = "AWS4-HMAC-SHA256";
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const credential = `${params.accessKeyId}/${credentialScope}`;

  const queryParams = new URLSearchParams({
    "X-Amz-Algorithm": algorithm,
    "X-Amz-Credential": credential,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": expiresIn.toString(),
    "X-Amz-SignedHeaders": signedHeaders,
  });
  queryParams.sort();

  const canonicalRequest = [
    "DELETE",
    canonicalUri,
    queryParams.toString(),
    `host:${host}\n`,
    signedHeaders,
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const canonicalRequestHash = toHex(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalRequest)),
  );

  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    canonicalRequestHash,
  ].join("\n");

  const signingKey = await getSignatureKey(params.secretAccessKey, dateStamp, region, service);
  const signature = toHex(await hmacSha256(signingKey, stringToSign));
  queryParams.append("X-Amz-Signature", signature);

  return `${endpoint}${canonicalUri}?${queryParams.toString()}`;
}

export async function deleteCloudflareStreamUid(uid: string, env = getCloudflareEnv()): Promise<void> {
  if (!env.streamAccountId || !env.streamToken) {
    throw new Error("Missing Cloudflare Stream configuration");
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.streamAccountId}/stream/${uid}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${env.streamToken}` },
    },
  );

  if (!response.ok && response.status !== 404) {
    const body = await response.text().catch(() => "");
    throw new Error(`Cloudflare Stream delete failed: ${response.status} ${body.slice(0, 300)}`);
  }
}

export async function deleteR2Object(key: string, env = getCloudflareEnv()): Promise<void> {
  if (!env.r2AccountId || !env.r2AccessKeyId || !env.r2SecretAccessKey || !env.r2BucketName) {
    throw new Error("Missing Cloudflare R2 configuration");
  }

  const cleanKey = sanitizeKey(key);
  if (!isValidR2Key(cleanKey)) {
    throw new Error("Invalid R2 key");
  }

  const deleteUrl = await createPresignedUrlForDelete({
    accountId: env.r2AccountId,
    accessKeyId: env.r2AccessKeyId,
    secretAccessKey: env.r2SecretAccessKey,
    bucketName: env.r2BucketName,
    key: cleanKey,
    endpoint: env.r2Endpoint,
  });

  const response = await fetch(deleteUrl, { method: "DELETE" });
  if (!response.ok && response.status !== 404) {
    const body = await response.text().catch(() => "");
    if (!body.includes("NoSuchKey")) {
      throw new Error(`R2 delete failed: ${response.status} ${response.statusText} ${body.slice(0, 300)}`);
    }
  }
}

export async function processDeleteTargets(targets: DeleteTarget[]): Promise<DeleteTarget[]> {
  const processed: DeleteTarget[] = [];

  for (const target of targets) {
    if (target.status === "deleted" && target.deleted_at) {
      processed.push(target);
      continue;
    }

    try {
      if (target.type === "cloudflare_stream") {
        await deleteCloudflareStreamUid(target.value);
      } else {
        await deleteR2Object(target.value);
      }

      processed.push({
        ...target,
        status: "deleted",
        deleted_at: target.deleted_at ?? nowIso(),
        error: undefined,
      });
    } catch (error) {
      processed.push({
        ...target,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return processed;
}

export function summarizeTargets(targets: DeleteTarget[]) {
  const failed = targets.filter((target) => target.status === "failed");
  const deleted = targets.filter((target) => target.status === "deleted");
  const hasStream = targets.some((target) => target.type === "cloudflare_stream");
  const hasR2 = targets.some((target) => target.type === "r2");
  const streamDone = !targets.some((target) => target.type === "cloudflare_stream" && target.status !== "deleted");
  const r2Done = !targets.some((target) => target.type === "r2" && target.status !== "deleted");

  return {
    allDone: failed.length === 0,
    failed,
    deleted,
    hasStream,
    hasR2,
    streamDone,
    r2Done,
    error: failed.map((target) => `${target.type}:${target.value}: ${target.error ?? "failed"}`).join("; "),
  };
}

export function updateDeleteMetadata(metadata: DeleteMetadata, targets: DeleteTarget[]): DeleteMetadata {
  return {
    ...metadata,
    targets,
    updated_at: nowIso(),
  };
}

````

### `supabase/functions/delete-post/index.ts`

````ts
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  buildDeleteMetadata,
  processDeleteTargets,
  summarizeTargets,
  updateDeleteMetadata,
} from "../_shared/postVideoDelete.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: "Missing Supabase function configuration" }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const serviceClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: userData, error: authError } = await userClient.auth.getUser();
  const user = userData.user;
  if (authError || !user) return json({ error: "Unauthorized" }, 401);

  const body = await req.json().catch(() => ({}));
  const postId = typeof body.post_id === "string" ? body.post_id : typeof body.postId === "string" ? body.postId : null;
  if (!postId) return json({ error: "Missing post_id" }, 400);

  const { data: post, error: postError } = await serviceClient
    .from("posts")
    .select("*")
    .eq("id", postId)
    .maybeSingle();

  if (postError) return json({ error: postError.message }, 500);
  if (!post) return json({ error: "Post not found" }, 404);

  const { data: isAdmin, error: roleError } = await userClient.rpc("has_role", {
    _user_id: user.id,
    _role: "admin",
  });

  if (roleError) console.warn("[delete-post] has_role failed:", roleError.message);

  if (post.user_id !== user.id && !isAdmin) {
    return json({ error: "Forbidden" }, 403);
  }

  if (post.delete_status === "deleted") {
    return json({ status: "deleted", post_id: postId, already_deleted: true });
  }

  const deleteMetadata = await buildDeleteMetadata({ supabase: serviceClient, post });
  const requestedAt = new Date().toISOString();

  await serviceClient
    .from("posts")
    .update({
      delete_status: "deleting",
      delete_requested_at: post.delete_requested_at ?? requestedAt,
      delete_attempts: (post.delete_attempts ?? 0) + 1,
      delete_metadata: deleteMetadata,
      delete_error: null,
      updated_at: requestedAt,
    })
    .eq("id", postId);

  const processedTargets = await processDeleteTargets(deleteMetadata.targets);
  const summary = summarizeTargets(processedTargets);
  const finalMetadata = updateDeleteMetadata(deleteMetadata, processedTargets);
  const completedAt = new Date().toISOString();
  const finalStatus = summary.allDone ? "deleted" : "delete_pending";

  const updatePayload: Record<string, unknown> = {
    deleted_at: post.deleted_at ?? completedAt,
    delete_status: finalStatus,
    delete_error: summary.allDone ? null : summary.error,
    delete_completed_at: summary.allDone ? completedAt : null,
    delete_metadata: finalMetadata,
    cloudflare_deleted_at: summary.hasStream && summary.streamDone ? completedAt : post.cloudflare_deleted_at,
    r2_deleted_at: summary.hasR2 && summary.r2Done ? completedAt : post.r2_deleted_at,
    updated_at: completedAt,
  };

  const { error: updateError } = await serviceClient.from("posts").update(updatePayload).eq("id", postId);
  if (updateError) return json({ error: updateError.message }, 500);

  if (deleteMetadata.live_session_ids.length > 0) {
    await serviceClient
      .from("live_replays")
      .update({
        status: "deleted",
        deleted_at: summary.allDone ? completedAt : null,
        delete_error: summary.allDone ? null : summary.error,
        updated_at: completedAt,
      })
      .in("live_session_id", deleteMetadata.live_session_ids);

    await serviceClient
      .from("live_recordings")
      .update({
        status: "deleted",
        deleted_at: summary.allDone ? completedAt : null,
        delete_error: summary.allDone ? null : summary.error,
      })
      .in("live_id", deleteMetadata.live_session_ids);

    await serviceClient
      .from("live_sessions")
      .update({
        recording_status: "deleted",
        recording_error: summary.allDone ? null : summary.error,
        updated_at: completedAt,
      })
      .in("id", deleteMetadata.live_session_ids);

    await serviceClient
      .from("creator_library")
      .update({
        status: "deleted",
        deleted_at: summary.allDone ? completedAt : null,
        updated_at: completedAt,
      })
      .in("live_session_id", deleteMetadata.live_session_ids);
  }

  await serviceClient
    .from("creator_library")
    .update({
      status: "deleted",
      deleted_at: summary.allDone ? completedAt : null,
      updated_at: completedAt,
    })
    .eq("post_id", postId);

  return json({
    status: finalStatus,
    post_id: postId,
    deleted: {
      stream: processedTargets.filter((target) => target.type === "cloudflare_stream" && target.status === "deleted").length,
      r2: processedTargets.filter((target) => target.type === "r2" && target.status === "deleted").length,
    },
    pending: processedTargets.filter((target) => target.status === "failed").length,
    errors: summary.failed.map((target) => ({
      type: target.type,
      value: target.value,
      error: target.error,
    })),
  }, summary.allDone ? 200 : 202);
});

````

### `supabase/functions/retry-post-video-deletes/index.ts`

````ts
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  processDeleteTargets,
  summarizeTargets,
  updateDeleteMetadata,
} from "../_shared/postVideoDelete.ts";
import type { DeleteMetadata } from "../_shared/postVideoDelete.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const cronSecret = Deno.env.get("CRON_SECRET") ?? Deno.env.get("SCHEDULED_FUNCTION_SECRET");
  if (cronSecret) {
    const authToken = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    const headerToken = req.headers.get("x-cron-secret");
    if (authToken !== cronSecret && headerToken !== cronSecret) {
      return json({ error: "Unauthorized" }, 401);
    }
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "Missing Supabase function configuration" }, 500);
  }

  const body = await req.json().catch(() => ({}));
  const limit = typeof body.limit === "number" && body.limit > 0 ? Math.min(body.limit, 50) : 20;
  const serviceClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: posts, error } = await serviceClient
    .from("posts")
    .select("id, delete_attempts, delete_metadata, cloudflare_deleted_at, r2_deleted_at")
    .eq("delete_status", "delete_pending")
    .not("deleted_at", "is", null)
    .order("updated_at", { ascending: true })
    .limit(limit);

  if (error) return json({ error: error.message }, 500);

  const results: Array<Record<string, unknown>> = [];

  for (const post of posts ?? []) {
    const metadata = post.delete_metadata as DeleteMetadata | null;
    if (!metadata?.targets?.length) {
      results.push({ post_id: post.id, status: "skipped", reason: "missing delete metadata" });
      continue;
    }

    const startedAt = new Date().toISOString();
    await serviceClient
      .from("posts")
      .update({
        delete_status: "deleting",
        delete_attempts: (post.delete_attempts ?? 0) + 1,
        updated_at: startedAt,
      })
      .eq("id", post.id);

    const processedTargets = await processDeleteTargets(metadata.targets);
    const summary = summarizeTargets(processedTargets);
    const finalMetadata = updateDeleteMetadata(metadata, processedTargets);
    const completedAt = new Date().toISOString();
    const finalStatus = summary.allDone ? "deleted" : "delete_pending";

    await serviceClient
      .from("posts")
      .update({
        delete_status: finalStatus,
        delete_error: summary.allDone ? null : summary.error,
        delete_completed_at: summary.allDone ? completedAt : null,
        delete_metadata: finalMetadata,
        cloudflare_deleted_at: summary.hasStream && summary.streamDone ? completedAt : post.cloudflare_deleted_at,
        r2_deleted_at: summary.hasR2 && summary.r2Done ? completedAt : post.r2_deleted_at,
        updated_at: completedAt,
      })
      .eq("id", post.id);

    if (metadata.live_session_ids.length > 0) {
      await serviceClient
        .from("live_replays")
        .update({
          status: "deleted",
          deleted_at: summary.allDone ? completedAt : null,
          delete_error: summary.allDone ? null : summary.error,
          updated_at: completedAt,
        })
        .in("live_session_id", metadata.live_session_ids);

      await serviceClient
        .from("live_recordings")
        .update({
          status: "deleted",
          deleted_at: summary.allDone ? completedAt : null,
          delete_error: summary.allDone ? null : summary.error,
        })
        .in("live_id", metadata.live_session_ids);

      await serviceClient
        .from("live_sessions")
        .update({
          recording_status: "deleted",
          recording_error: summary.allDone ? null : summary.error,
          updated_at: completedAt,
        })
        .in("id", metadata.live_session_ids);

      await serviceClient
        .from("creator_library")
        .update({
          status: "deleted",
          deleted_at: summary.allDone ? completedAt : null,
          updated_at: completedAt,
        })
        .in("live_session_id", metadata.live_session_ids);
    }

    await serviceClient
      .from("creator_library")
      .update({
        status: "deleted",
        deleted_at: summary.allDone ? completedAt : null,
        updated_at: completedAt,
      })
      .eq("post_id", post.id);

    results.push({
      post_id: post.id,
      status: finalStatus,
      pending: summary.failed.length,
    });
  }

  return json({ processed: results.length, results });
});

````

### `src/modules/feed/components/post/LivePostCard.tsx`

````tsx
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Eye, Video, CameraOff, Radio, Download, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { StreamPlayer } from '@/components/ui/StreamPlayer';
import { ReplayPlayer } from '@/modules/live/components/ReplayPlayer';
import { LiveChatReplay } from '@/modules/live/components/LiveChatReplay';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface LivePostCardProps {
  liveMetadata: Record<string, unknown>;
  videoUrl?: string | null;
  liveStatus: 'live' | 'ended';
  liveSessionId: string | null;
  postContent: string;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function LivePostCard({ liveMetadata, videoUrl, liveStatus, liveSessionId, postContent }: LivePostCardProps) {
  const navigate = useNavigate();
  const [playerOpen, setPlayerOpen] = useState(false);
  const finalizeTriggered = useRef(false);

  const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
  const title: string = str(liveMetadata.live_title) || postContent || 'PhĂ¡t trá»±c tiáº¿p trĂªn FUN Profile';
  const viewerCount = Number(liveMetadata.viewer_count || 0);
  const thumbnailUrl: string | null = str(liveMetadata.thumbnail_url);
  const durationSeconds = liveMetadata.duration_seconds ? Number(liveMetadata.duration_seconds) : null;
  const endedAt: string | null = str(liveMetadata.ended_at);
  const replayStatus: string | null = str(liveMetadata.replay_status) || str(liveMetadata.recording_status);
  const archiveStatus: string | null = str(liveMetadata.archive_status);
  const playbackProvider: string | null = str(liveMetadata.playback_provider);
  const playbackType: string = playbackProvider || str(liveMetadata.playback_type) || (liveMetadata.playback_hls ? 'cloudflare_stream' : 'chunked');

  // Production replay is archived to R2 MP4. Cloudflare Stream is temporary processing only.
  const r2VideoUrl: string | null = str(liveMetadata.r2_video_url);
  const playbackMp4: string | null = str(liveMetadata.playback_mp4) || r2VideoUrl;
  const playbackUrl: string | null = playbackProvider === 'r2'
    ? (r2VideoUrl || playbackMp4 || str(liveMetadata.playback_url) || videoUrl || null)
    : (str(liveMetadata.playback_hls) || str(liveMetadata.playback_url) || videoUrl || null);
  const hasVideo = !!playbackUrl;
  const archivePending =
    liveStatus === 'ended' &&
    playbackProvider !== 'r2' &&
    ['pending', 'mp4_pending', 'archiving', 'failed'].includes(String(archiveStatus || replayStatus || ''));
  // MP4 chÆ°a cĂ³ nhÆ°ng replay Ä‘Ă£ ready â†’ Ä‘ang Ä‘Æ°á»£c Cloudflare render
  const mp4Pending = !playbackMp4 && hasVideo && playbackType === 'cloudflare_stream' && liveStatus === 'ended';

  // When replay is ready (HLS available) but MP4 not yet rendered by Cloudflare,
  // ask the backend to start/poll the MP4 render. Page reload (or feed refresh)
  // will then pick up the playback_mp4 URL from posts.metadata.
  useEffect(() => {
    if (finalizeTriggered.current) return;
    if (liveStatus !== 'ended') return;
    if (!liveSessionId) return;
    if (playbackProvider === 'r2') return;
    finalizeTriggered.current = true;
    supabase.functions
      .invoke('archive-replay-to-r2', { body: { live_session_id: liveSessionId } })
      .catch((err) => console.warn('[LivePostCard] archive trigger failed', err));
  }, [liveStatus, liveSessionId, playbackProvider]);


  // Currently LIVE
  if (liveStatus === 'live') {
    const handleGoLive = () => {
      if (liveSessionId) navigate(`/live/${liveSessionId}`);
    };

    return (
      <div className="mb-3 overflow-hidden">
        {/* Preview area */}
        <button
          onClick={handleGoLive}
          className="relative w-full block group focus:outline-none"
          aria-label="Xem trá»±c tiáº¿p"
        >
          <div className="w-full aspect-video relative overflow-hidden bg-black">
            {thumbnailUrl ? (
              <img
                src={thumbnailUrl}
                alt={title}
                className="w-full h-full object-cover opacity-90 group-hover:opacity-80 transition-opacity"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-red-950 via-gray-900 to-red-900">
                <div
                  className="absolute inset-0 opacity-40 animate-pulse"
                  style={{ backgroundImage: 'radial-gradient(circle at 30% 40%, hsl(0 80% 40% / 0.7) 0%, transparent 60%), radial-gradient(circle at 70% 70%, hsl(0 60% 25% / 0.6) 0%, transparent 55%)' }}
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
                  <div className="w-16 h-16 rounded-full bg-red-600/40 border-2 border-red-500/50 flex items-center justify-center backdrop-blur-sm animate-pulse">
                    <Radio className="w-8 h-8 text-red-300" />
                  </div>
                  <div className="text-center px-8">
                    <p className="text-white font-semibold text-sm line-clamp-2 drop-shadow">{title}</p>
                    <p className="text-white/50 text-xs mt-1">Äang phĂ¡t trá»±c tiáº¿p</p>
                  </div>
                </div>
              </div>
            )}

            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />

            {/* ÄANG LIVE badge - top left */}
            <div className="absolute top-3 left-3">
              <span className="inline-flex items-center gap-1.5 bg-red-600 text-white text-[11px] font-bold px-2 py-0.5 rounded">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                ÄANG LIVE
              </span>
            </div>

            {/* Viewer count - top right */}
            <div className="absolute top-3 right-3">
              <span className="inline-flex items-center gap-1 bg-black/70 text-white text-[11px] px-2 py-0.5 rounded">
                <Eye className="w-3 h-3" />
                {viewerCount}
              </span>
            </div>

            {/* Big play button - center */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-white/90 shadow-2xl flex items-center justify-center group-hover:scale-105 transition-transform">
                <Play className="w-8 h-8 text-gray-900 ml-1" fill="currentColor" />
              </div>
            </div>
          </div>
        </button>

        {/* Info bar below */}
        <div className="px-4 py-3 flex items-center justify-between border-t border-border bg-card">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate">{title}</p>
            <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
              <Eye className="w-3 h-3" />
              <span>{viewerCount} ngÆ°á»i Ä‘ang xem</span>
            </div>
          </div>
          {liveSessionId && (
            <Button size="sm" variant="destructive" className="ml-3 shrink-0" onClick={handleGoLive}>
              <Radio className="w-3.5 h-3.5 mr-1" />
              Xem LIVE
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (
    liveStatus === 'ended' &&
    (archivePending || (!hasVideo && ['uploading', 'queued', 'processing'].includes(String(replayStatus))))
  ) {
    return (
      <div className="mx-4 mb-3 rounded-xl border border-border overflow-hidden bg-card">
        <div className="px-4 py-5 flex items-center gap-3 text-muted-foreground">
          <Radio className="w-8 h-8 shrink-0 opacity-60 animate-pulse" />
          <div>
            <p className="text-sm font-medium text-foreground">Replay is processing</p>
            <p className="text-xs mt-0.5">Video dang duoc tao MP4 va luu tru len R2.</p>
          </div>
          <span className="ml-auto shrink-0 inline-flex items-center bg-muted text-muted-foreground text-[11px] font-bold px-2 py-0.5 rounded">
            {archiveStatus === 'failed' ? 'RETRYING' : 'PROCESSING'}
          </span>
        </div>
      </div>
    );
  }

  // ENDED - No video available
  if (!hasVideo) {
    return (
      <div className="mx-4 mb-3 rounded-xl border border-border overflow-hidden bg-card">
        <div className="px-4 py-5 flex items-center gap-3 text-muted-foreground">
          <CameraOff className="w-8 h-8 shrink-0 opacity-50" />
          <div>
            <p className="text-sm font-medium text-foreground">PhiĂªn live Ä‘Ă£ káº¿t thĂºc</p>
            <p className="text-xs mt-0.5">Video replay chÆ°a Ä‘Æ°á»£c lÆ°u cho phiĂªn nĂ y</p>
          </div>
          {liveSessionId && (
            <Button
              size="sm"
              variant="outline"
              className="ml-auto shrink-0"
              onClick={() => navigate(`/live/${liveSessionId}`)}
            >
              Xem thĂ´ng tin
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ENDED - Has video replay
  return (
    <>
      <div className="mb-3 overflow-hidden">
        {/* Thumbnail / Preview area */}
        <button
          onClick={() => setPlayerOpen(true)}
          className="relative w-full block group focus:outline-none"
          aria-label="Xem láº¡i video"
        >
          {/* Background */}
          <div
            className={cn(
              'w-full aspect-video relative overflow-hidden',
              'bg-black'
            )}
          >
            {thumbnailUrl ? (
              <img
                src={thumbnailUrl}
                alt={title}
                className="w-full h-full object-cover opacity-90 group-hover:opacity-80 transition-opacity"
              />
            ) : (
              /* Beautiful gradient fallback when no thumbnail */
              <div className="absolute inset-0 bg-gradient-to-br from-red-950 via-gray-900 to-purple-950">
                <div className="absolute inset-0 opacity-30"
                  style={{ backgroundImage: 'radial-gradient(circle at 30% 40%, hsl(0 80% 40% / 0.6) 0%, transparent 60%), radial-gradient(circle at 70% 70%, hsl(270 60% 30% / 0.5) 0%, transparent 55%)' }}
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
                  <div className="w-16 h-16 rounded-full bg-red-600/30 border-2 border-red-500/40 flex items-center justify-center backdrop-blur-sm">
                    <Radio className="w-8 h-8 text-red-300" />
                  </div>
                  <div className="text-center px-8">
                    <p className="text-white font-semibold text-sm line-clamp-2 drop-shadow">{title}</p>
                    <p className="text-white/50 text-xs mt-1">Video Replay</p>
                  </div>
                </div>
              </div>
            )}

            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />

            {/* VIDEO REPLAY badge - top left */}
            <div className="absolute top-3 left-3">
              <span className="inline-flex items-center gap-1 bg-red-600 text-white text-[11px] font-bold px-2 py-0.5 rounded">
                <Video className="w-3 h-3" />
                REPLAY
              </span>
            </div>

            {/* Duration badge - top right */}
            {durationSeconds !== null && (
              <div className="absolute top-3 right-3">
                <span className="inline-flex items-center bg-black/70 text-white text-[11px] font-mono px-2 py-0.5 rounded">
                  {formatDuration(durationSeconds)}
                </span>
              </div>
            )}

            {/* Big play button - center */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-white/90 shadow-2xl flex items-center justify-center group-hover:scale-105 transition-transform">
                <Play className="w-8 h-8 text-gray-900 ml-1" fill="currentColor" />
              </div>
            </div>

          </div>
        </button>

        {/* Info bar below */}
        <div className="px-4 py-3 flex items-center justify-between border-t border-border bg-card">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate">{title}</p>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <Eye className="w-3 h-3" />
                {viewerCount} ngÆ°á»i xem
              </span>
              {endedAt && (
                <>
                  <span>Â·</span>
                  <span>
                    ÄĂ£ káº¿t thĂºc{' '}
                    {formatDistanceToNow(new Date(endedAt), { addSuffix: true, locale: vi })}
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="ml-3 shrink-0 flex items-center gap-2">
            {playbackMp4 ? (
              <a
                href={playbackMp4}
                download={`live-${liveSessionId || 'replay'}.mp4`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                <Button size="sm" variant="outline">
                  <Download className="w-3.5 h-3.5 mr-1" />
                  Táº£i MP4
                </Button>
              </a>
            ) : mp4Pending ? (
              <Button
                size="sm"
                variant="outline"
                disabled
                onClick={(e) => e.stopPropagation()}
                title="Cloudflare Ä‘ang táº¡o file MP4, vui lĂ²ng quay láº¡i sau vĂ i phĂºt"
              >
                <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                Äang táº¡o MP4...
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="default"
              onClick={() => setPlayerOpen(true)}
            >
              <Play className="w-3.5 h-3.5 mr-1" />
              Xem láº¡i
            </Button>
          </div>
        </div>
      </div>

      {/* Dialog player */}
      <Dialog open={playerOpen} onOpenChange={setPlayerOpen}>
        <DialogContent className="max-w-5xl w-full p-0 overflow-hidden bg-black border-border">
          <DialogHeader className="px-4 py-3 bg-card/90 border-b border-border flex flex-row items-center justify-between gap-3">
            <DialogTitle className="text-sm font-semibold truncate pr-8 flex-1">{title}</DialogTitle>
            {playbackMp4 ? (
              <a
                href={playbackMp4}
                download={`live-${liveSessionId || 'replay'}.mp4`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 mr-6"
              >
                <Button size="sm" variant="outline">
                  <Download className="w-3.5 h-3.5 mr-1" />
                  Táº£i MP4
                </Button>
              </a>
            ) : mp4Pending ? (
              <Button size="sm" variant="outline" disabled className="shrink-0 mr-6">
                <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                Äang táº¡o MP4...
              </Button>
            ) : null}
          </DialogHeader>
          <div className={cn(
            'flex flex-col',
            liveSessionId ? 'md:flex-row' : ''
          )}>
            {/* Video */}
            <div className={cn(
              'w-full bg-black',
              liveSessionId ? 'md:flex-[3]' : '',
              'aspect-video'
            )}>
              {playbackType === 'cloudflare_stream' ? (
                <ReplayPlayer
                  src={playbackUrl}
                  poster={thumbnailUrl || undefined}
                  className="w-full h-full"
                  autoPlay
                  muted={false}
                />
              ) : (
                <StreamPlayer
                  src={playbackUrl}
                  poster={thumbnailUrl || undefined}
                  className="w-full h-full"
                  autoPlay
                  muted={false}
                  enableStatusCheck={false}
                />
              )}
            </div>
            {/* Chat Replay */}
            {liveSessionId && (
              <div className="md:flex-[2] border-t md:border-t-0 md:border-l border-border h-72 md:h-auto md:max-h-[60vh]">
                <LiveChatReplay sessionId={liveSessionId} />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

````

### `src/integrations/supabase/types.ts`

````ts
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      account_merge_requests: {
        Row: {
          admin_note: string | null
          auto_provisioned: boolean | null
          created_at: string
          email: string
          id: string
          merge_type: string
          platform_data: Json | null
          provision_status: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_platform: string
          source_user_id: string | null
          source_username: string | null
          status: string
          target_platform: string
          target_user_id: string | null
          updated_at: string
          webhook_sent: boolean | null
          webhook_sent_at: string | null
        }
        Insert: {
          admin_note?: string | null
          auto_provisioned?: boolean | null
          created_at?: string
          email: string
          id?: string
          merge_type: string
          platform_data?: Json | null
          provision_status?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_platform: string
          source_user_id?: string | null
          source_username?: string | null
          status?: string
          target_platform?: string
          target_user_id?: string | null
          updated_at?: string
          webhook_sent?: boolean | null
          webhook_sent_at?: string | null
        }
        Update: {
          admin_note?: string | null
          auto_provisioned?: boolean | null
          created_at?: string
          email?: string
          id?: string
          merge_type?: string
          platform_data?: Json | null
          provision_status?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_platform?: string
          source_user_id?: string | null
          source_username?: string | null
          status?: string
          target_platform?: string
          target_user_id?: string | null
          updated_at?: string
          webhook_sent?: boolean | null
          webhook_sent_at?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          details: Json | null
          id: string
          reason: string | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          details?: Json | null
          id?: string
          reason?: string | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          reason?: string | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      blacklisted_wallets: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_permanent: boolean
          reason: string
          user_id: string | null
          wallet_address: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_permanent?: boolean
          reason?: string
          user_id?: string | null
          wallet_address: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_permanent?: boolean
          reason?: string
          user_id?: string | null
          wallet_address?: string
        }
        Relationships: []
      }
      call_participants: {
        Row: {
          call_session_id: string | null
          created_at: string | null
          id: string
          is_muted: boolean | null
          is_video_off: boolean | null
          joined_at: string | null
          left_at: string | null
          user_id: string
        }
        Insert: {
          call_session_id?: string | null
          created_at?: string | null
          id?: string
          is_muted?: boolean | null
          is_video_off?: boolean | null
          joined_at?: string | null
          left_at?: string | null
          user_id: string
        }
        Update: {
          call_session_id?: string | null
          created_at?: string | null
          id?: string
          is_muted?: boolean | null
          is_video_off?: boolean | null
          joined_at?: string | null
          left_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_participants_call_session_id_fkey"
            columns: ["call_session_id"]
            isOneToOne: false
            referencedRelation: "call_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      call_sessions: {
        Row: {
          call_type: string
          channel_name: string
          conversation_id: string | null
          created_at: string | null
          duration_seconds: number | null
          ended_at: string | null
          id: string
          initiator_id: string
          started_at: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          call_type: string
          channel_name: string
          conversation_id?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          initiator_id: string
          started_at?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          call_type?: string
          channel_name?: string
          conversation_id?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          initiator_id?: string
          started_at?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_sessions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_settings: {
        Row: {
          created_at: string | null
          id: string
          show_read_receipts: boolean | null
          show_typing_indicator: boolean | null
          updated_at: string | null
          user_id: string
          who_can_message: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          show_read_receipts?: boolean | null
          show_typing_indicator?: boolean | null
          updated_at?: string | null
          user_id: string
          who_can_message?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          show_read_receipts?: boolean | null
          show_typing_indicator?: boolean | null
          updated_at?: string | null
          user_id?: string
          who_can_message?: string | null
        }
        Relationships: []
      }
      comments: {
        Row: {
          content: string
          created_at: string
          id: string
          image_url: string | null
          parent_comment_id: string | null
          post_id: string
          user_id: string
          video_url: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          image_url?: string | null
          parent_comment_id?: string | null
          post_id: string
          user_id: string
          video_url?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          image_url?: string | null
          parent_comment_id?: string | null
          post_id?: string
          user_id?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          id: string
          joined_at: string | null
          last_read_at: string | null
          left_at: string | null
          muted_until: string | null
          nickname: string | null
          role: string | null
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          joined_at?: string | null
          last_read_at?: string | null
          left_at?: string | null
          muted_until?: string | null
          nickname?: string | null
          role?: string | null
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          joined_at?: string | null
          last_read_at?: string | null
          left_at?: string | null
          muted_until?: string | null
          nickname?: string | null
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          created_by: string | null
          id: string
          last_message_at: string | null
          last_message_preview: string | null
          name: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          name?: string | null
          type?: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          name?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      cross_platform_tokens: {
        Row: {
          access_token: string
          access_token_expires_at: string
          client_id: string
          created_at: string
          device_info: Json | null
          id: string
          is_revoked: boolean
          last_used_at: string | null
          refresh_token: string
          refresh_token_expires_at: string
          scope: string[]
          user_id: string
        }
        Insert: {
          access_token: string
          access_token_expires_at: string
          client_id: string
          created_at?: string
          device_info?: Json | null
          id?: string
          is_revoked?: boolean
          last_used_at?: string | null
          refresh_token: string
          refresh_token_expires_at: string
          scope?: string[]
          user_id: string
        }
        Update: {
          access_token?: string
          access_token_expires_at?: string
          client_id?: string
          created_at?: string
          device_info?: Json | null
          id?: string
          is_revoked?: boolean
          last_used_at?: string | null
          refresh_token?: string
          refresh_token_expires_at?: string
          scope?: string[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cross_platform_tokens_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "oauth_clients"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "cross_platform_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cross_platform_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crypto_gifts: {
        Row: {
          amount_numeric: number
          chain_id: number
          conversation_id: string | null
          created_at: string
          error: string | null
          from_user_id: string
          id: string
          message_id: string | null
          status: string
          to_address: string
          to_user_id: string
          token: string
          tx_hash: string | null
        }
        Insert: {
          amount_numeric: number
          chain_id?: number
          conversation_id?: string | null
          created_at?: string
          error?: string | null
          from_user_id: string
          id?: string
          message_id?: string | null
          status?: string
          to_address: string
          to_user_id: string
          token: string
          tx_hash?: string | null
        }
        Update: {
          amount_numeric?: number
          chain_id?: number
          conversation_id?: string | null
          created_at?: string
          error?: string | null
          from_user_id?: string
          id?: string
          message_id?: string | null
          status?: string
          to_address?: string
          to_user_id?: string
          token?: string
          tx_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crypto_gifts_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crypto_gifts_from_user_id_fkey"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crypto_gifts_from_user_id_fkey"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crypto_gifts_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crypto_gifts_to_user_id_fkey"
            columns: ["to_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crypto_gifts_to_user_id_fkey"
            columns: ["to_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      custodial_wallets: {
        Row: {
          chain_id: number
          created_at: string
          encrypted_private_key: string
          encryption_version: number
          id: string
          is_active: boolean
          last_activity_at: string | null
          updated_at: string
          user_id: string
          wallet_address: string
        }
        Insert: {
          chain_id?: number
          created_at?: string
          encrypted_private_key: string
          encryption_version?: number
          id?: string
          is_active?: boolean
          last_activity_at?: string | null
          updated_at?: string
          user_id: string
          wallet_address: string
        }
        Update: {
          chain_id?: number
          created_at?: string
          encrypted_private_key?: string
          encryption_version?: number
          id?: string
          is_active?: boolean
          last_activity_at?: string | null
          updated_at?: string
          user_id?: string
          wallet_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "custodial_wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custodial_wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_link_otps: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          otp_hash: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at: string
          id?: string
          otp_hash: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          otp_hash?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      feed_posts: {
        Row: {
          author_id: string | null
          caption: string | null
          created_at: string | null
          id: string
          media_key: string | null
          media_url: string | null
          recording_id: string | null
          source: string | null
          title: string | null
          type: string | null
        }
        Insert: {
          author_id?: string | null
          caption?: string | null
          created_at?: string | null
          id?: string
          media_key?: string | null
          media_url?: string | null
          recording_id?: string | null
          source?: string | null
          title?: string | null
          type?: string | null
        }
        Update: {
          author_id?: string | null
          caption?: string | null
          created_at?: string | null
          id?: string
          media_key?: string | null
          media_url?: string | null
          recording_id?: string | null
          source?: string | null
          title?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feed_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feed_posts_recording_id_fkey"
            columns: ["recording_id"]
            isOneToOne: false
            referencedRelation: "live_recordings"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_transactions: {
        Row: {
          action: string
          amount: number
          client_id: string
          created_at: string
          currency: string
          id: string
          metadata: Json | null
          transaction_id: string
          user_id: string
        }
        Insert: {
          action: string
          amount: number
          client_id: string
          created_at?: string
          currency?: string
          id?: string
          metadata?: Json | null
          transaction_id: string
          user_id: string
        }
        Update: {
          action?: string
          amount?: number
          client_id?: string
          created_at?: string
          currency?: string
          id?: string
          metadata?: Json | null
          transaction_id?: string
          user_id?: string
        }
        Relationships: []
      }
      friendships: {
        Row: {
          created_at: string
          friend_id: string
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          friend_id: string
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          friend_id?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      live_comments: {
        Row: {
          created_at: string
          id: string
          live_session_id: string
          message: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          live_session_id: string
          message: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          live_session_id?: string
          message?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_comments_live_session_id_fkey"
            columns: ["live_session_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      live_messages: {
        Row: {
          content: string
          created_at: string
          id: number
          session_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: never
          session_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: never
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      live_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: number
          session_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji?: string
          id?: never
          session_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: never
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_reactions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      live_recordings: {
        Row: {
          created_at: string | null
          delete_error: string | null
          deleted_at: string | null
          duration_seconds: number | null
          file_list_json: Json | null
          id: string
          live_id: string | null
          media_url: string | null
          mode: string | null
          raw_response: Json | null
          recorder_uid: string | null
          resource_id: string | null
          sid: string | null
          status: string | null
          stopped_at: string | null
          storage_region: number | null
          storage_vendor: number | null
          thumbnail_url: string | null
        }
        Insert: {
          created_at?: string | null
          delete_error?: string | null
          deleted_at?: string | null
          duration_seconds?: number | null
          file_list_json?: Json | null
          id?: string
          live_id?: string | null
          media_url?: string | null
          mode?: string | null
          raw_response?: Json | null
          recorder_uid?: string | null
          resource_id?: string | null
          sid?: string | null
          status?: string | null
          stopped_at?: string | null
          storage_region?: number | null
          storage_vendor?: number | null
          thumbnail_url?: string | null
        }
        Update: {
          created_at?: string | null
          delete_error?: string | null
          deleted_at?: string | null
          duration_seconds?: number | null
          file_list_json?: Json | null
          id?: string
          live_id?: string | null
          media_url?: string | null
          mode?: string | null
          raw_response?: Json | null
          recorder_uid?: string | null
          resource_id?: string | null
          sid?: string | null
          status?: string | null
          stopped_at?: string | null
          storage_region?: number | null
          storage_vendor?: number | null
          thumbnail_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "live_recordings_live_id_fkey"
            columns: ["live_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      live_replays: {
        Row: {
          archive_attempts: number
          archive_error: string | null
          archive_status: string
          archived_at: string | null
          auto_posted_at: string | null
          chunked_recording_id: string | null
          cloudflare_mp4_download_url: string | null
          cloudflare_playback_url: string | null
          created_at: string
          delete_error: string | null
          deleted_at: string | null
          duration_seconds: number | null
          error_message: string | null
          filesize_bytes: number | null
          id: string
          live_session_id: string
          next_archive_retry_at: string | null
          playback_dash: string | null
          playback_hls: string | null
          playback_mp4: string | null
          playback_provider: string
          processing_started_at: string | null
          r2_bucket: string | null
          r2_object_key: string | null
          r2_video_url: string | null
          source_webm_key: string | null
          status: string
          storage_provider: string
          stream_deleted_at: string | null
          stream_uid: string
          thumbnail_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          archive_attempts?: number
          archive_error?: string | null
          archive_status?: string
          archived_at?: string | null
          auto_posted_at?: string | null
          chunked_recording_id?: string | null
          cloudflare_mp4_download_url?: string | null
          cloudflare_playback_url?: string | null
          created_at?: string
          delete_error?: string | null
          deleted_at?: string | null
          duration_seconds?: number | null
          error_message?: string | null
          filesize_bytes?: number | null
          id?: string
          live_session_id: string
          next_archive_retry_at?: string | null
          playback_dash?: string | null
          playback_hls?: string | null
          playback_mp4?: string | null
          playback_provider?: string
          processing_started_at?: string | null
          r2_bucket?: string | null
          r2_object_key?: string | null
          r2_video_url?: string | null
          source_webm_key?: string | null
          status?: string
          storage_provider?: string
          stream_deleted_at?: string | null
          stream_uid: string
          thumbnail_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          archive_attempts?: number
          archive_error?: string | null
          archive_status?: string
          archived_at?: string | null
          auto_posted_at?: string | null
          chunked_recording_id?: string | null
          cloudflare_mp4_download_url?: string | null
          cloudflare_playback_url?: string | null
          created_at?: string
          delete_error?: string | null
          deleted_at?: string | null
          duration_seconds?: number | null
          error_message?: string | null
          filesize_bytes?: number | null
          id?: string
          live_session_id?: string
          next_archive_retry_at?: string | null
          playback_dash?: string | null
          playback_hls?: string | null
          playback_mp4?: string | null
          playback_provider?: string
          processing_started_at?: string | null
          r2_bucket?: string | null
          r2_object_key?: string | null
          r2_video_url?: string | null
          source_webm_key?: string | null
          status?: string
          storage_provider?: string
          stream_deleted_at?: string | null
          stream_uid?: string
          thumbnail_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      live_sessions: {
        Row: {
          agora_channel: string | null
          agora_uid_host: number | null
          archive_error: string | null
          archive_status: string
          archived_at: string | null
          auto_posted_at: string | null
          channel_name: string
          cloudflare_live_input_id: string | null
          cloudflare_mp4_download_url: string | null
          cloudflare_playback_url: string | null
          cloudflare_video_uid: string | null
          created_at: string
          ended_at: string | null
          hls_playback_url: string | null
          hls_url: string | null
          host_user_id: string
          id: string
          last_worker_response: Json | null
          live_mode: string
          owner_id: string | null
          post_id: string | null
          privacy: string
          playback_provider: string | null
          processing_started_at: string | null
          r2_bucket: string | null
          r2_object_key: string | null
          r2_video_url: string | null
          recording_acquired_at: string | null
          recording_error: string | null
          recording_ready_at: string | null
          recording_started_at: string | null
          recording_status: string | null
          recording_stopped_at: string | null
          recording_uid: number | null
          resource_id: string | null
          rtmp_ended_at: string | null
          rtmp_started_at: string | null
          rtmp_status: string | null
          sid: string | null
          source: string | null
          started_at: string
          status: string
          storage_provider: string | null
          stream_deleted_at: string | null
          stream_key: string | null
          stream_provider: string
          title: string
          updated_at: string
          viewer_count: number
        }
        Insert: {
          agora_channel?: string | null
          agora_uid_host?: number | null
          archive_error?: string | null
          archive_status?: string
          archived_at?: string | null
          auto_posted_at?: string | null
          channel_name: string
          cloudflare_live_input_id?: string | null
          cloudflare_mp4_download_url?: string | null
          cloudflare_playback_url?: string | null
          cloudflare_video_uid?: string | null
          created_at?: string
          ended_at?: string | null
          hls_playback_url?: string | null
          hls_url?: string | null
          host_user_id: string
          id?: string
          last_worker_response?: Json | null
          live_mode?: string
          owner_id?: string | null
          post_id?: string | null
          privacy?: string
          playback_provider?: string | null
          processing_started_at?: string | null
          r2_bucket?: string | null
          r2_object_key?: string | null
          r2_video_url?: string | null
          recording_acquired_at?: string | null
          recording_error?: string | null
          recording_ready_at?: string | null
          recording_started_at?: string | null
          recording_status?: string | null
          recording_stopped_at?: string | null
          recording_uid?: number | null
          resource_id?: string | null
          rtmp_ended_at?: string | null
          rtmp_started_at?: string | null
          rtmp_status?: string | null
          sid?: string | null
          source?: string | null
          started_at?: string
          status?: string
          storage_provider?: string | null
          stream_deleted_at?: string | null
          stream_key?: string | null
          stream_provider?: string
          title?: string
          updated_at?: string
          viewer_count?: number
        }
        Update: {
          agora_channel?: string | null
          agora_uid_host?: number | null
          archive_error?: string | null
          archive_status?: string
          archived_at?: string | null
          auto_posted_at?: string | null
          channel_name?: string
          cloudflare_live_input_id?: string | null
          cloudflare_mp4_download_url?: string | null
          cloudflare_playback_url?: string | null
          cloudflare_video_uid?: string | null
          created_at?: string
          ended_at?: string | null
          hls_playback_url?: string | null
          hls_url?: string | null
          host_user_id?: string
          id?: string
          last_worker_response?: Json | null
          live_mode?: string
          owner_id?: string | null
          post_id?: string | null
          privacy?: string
          playback_provider?: string | null
          processing_started_at?: string | null
          r2_bucket?: string | null
          r2_object_key?: string | null
          r2_video_url?: string | null
          recording_acquired_at?: string | null
          recording_error?: string | null
          recording_ready_at?: string | null
          recording_started_at?: string | null
          recording_status?: string | null
          recording_stopped_at?: string | null
          recording_uid?: number | null
          resource_id?: string | null
          rtmp_ended_at?: string | null
          rtmp_started_at?: string | null
          rtmp_status?: string | null
          sid?: string | null
          source?: string | null
          started_at?: string
          status?: string
          storage_provider?: string | null
          stream_deleted_at?: string | null
          stream_key?: string | null
          stream_provider?: string
          title?: string
          updated_at?: string
          viewer_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "live_sessions_host_user_id_fkey"
            columns: ["host_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_sessions_host_user_id_fkey"
            columns: ["host_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_sessions_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_sessions_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_sessions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      livestreams: {
        Row: {
          created_at: string | null
          duration_minutes: number | null
          ended_at: string | null
          id: string
          is_eligible: boolean | null
          started_at: string
          stream_id: string | null
          title: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          duration_minutes?: number | null
          ended_at?: string | null
          id?: string
          is_eligible?: boolean | null
          started_at?: string
          stream_id?: string | null
          title?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          duration_minutes?: number | null
          ended_at?: string | null
          id?: string
          is_eligible?: boolean | null
          started_at?: string
          stream_id?: string | null
          title?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "livestreams_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "livestreams_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          created_at: string | null
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reads: {
        Row: {
          id: string
          message_id: string
          read_at: string | null
          user_id: string
        }
        Insert: {
          id?: string
          message_id: string
          read_at?: string | null
          user_id: string
        }
        Update: {
          id?: string
          message_id?: string
          read_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reads_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string | null
          deleted_at: string | null
          edited_at: string | null
          id: string
          is_deleted: boolean | null
          media_urls: Json | null
          message_type: string
          metadata: Json
          pinned_at: string | null
          pinned_by: string | null
          reply_to_id: string | null
          sender_id: string
          updated_at: string | null
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string | null
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          is_deleted?: boolean | null
          media_urls?: Json | null
          message_type?: string
          metadata?: Json
          pinned_at?: string | null
          pinned_by?: string | null
          reply_to_id?: string | null
          sender_id: string
          updated_at?: string | null
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string | null
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          is_deleted?: boolean | null
          media_urls?: Json | null
          message_type?: string
          metadata?: Json
          pinned_at?: string | null
          pinned_by?: string | null
          reply_to_id?: string | null
          sender_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_pinned_by_fkey"
            columns: ["pinned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_pinned_by_fkey"
            columns: ["pinned_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string
          created_at: string
          id: string
          post_id: string | null
          read: boolean
          type: string
          user_id: string
        }
        Insert: {
          actor_id: string
          created_at?: string
          id?: string
          post_id?: string | null
          read?: boolean
          type: string
          user_id: string
        }
        Update: {
          actor_id?: string
          created_at?: string
          id?: string
          post_id?: string | null
          read?: boolean
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_clients: {
        Row: {
          allowed_scopes: string[]
          client_id: string
          client_name: string
          client_secret: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          platform_name: string | null
          redirect_uris: string[]
          updated_at: string
          webhook_url: string | null
          website_url: string | null
        }
        Insert: {
          allowed_scopes?: string[]
          client_id: string
          client_name: string
          client_secret: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          platform_name?: string | null
          redirect_uris?: string[]
          updated_at?: string
          webhook_url?: string | null
          website_url?: string | null
        }
        Update: {
          allowed_scopes?: string[]
          client_id?: string
          client_name?: string
          client_secret?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          platform_name?: string | null
          redirect_uris?: string[]
          updated_at?: string
          webhook_url?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      oauth_codes: {
        Row: {
          client_id: string
          code: string
          code_challenge: string | null
          code_challenge_method: string | null
          created_at: string
          expires_at: string
          id: string
          is_used: boolean
          redirect_uri: string
          scope: string[]
          user_id: string
        }
        Insert: {
          client_id: string
          code: string
          code_challenge?: string | null
          code_challenge_method?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          is_used?: boolean
          redirect_uri: string
          scope?: string[]
          user_id: string
        }
        Update: {
          client_id?: string
          code?: string
          code_challenge?: string | null
          code_challenge_method?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          is_used?: boolean
          redirect_uri?: string
          scope?: string[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oauth_codes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "oauth_clients"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "oauth_codes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "oauth_codes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      otp_codes: {
        Row: {
          attempts: number
          code: string
          created_at: string
          expires_at: string
          id: string
          identifier: string
          is_used: boolean
          max_attempts: number
          type: string
        }
        Insert: {
          attempts?: number
          code: string
          created_at?: string
          expires_at: string
          id?: string
          identifier: string
          is_used?: boolean
          max_attempts?: number
          type?: string
        }
        Update: {
          attempts?: number
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          identifier?: string
          is_used?: boolean
          max_attempts?: number
          type?: string
        }
        Relationships: []
      }
      pending_provisions: {
        Row: {
          completed_at: string | null
          created_at: string | null
          email: string
          fun_profile_id: string | null
          id: string
          merge_request_id: string | null
          password_token_hash: string
          platform_data: Json | null
          platform_id: string
          platform_user_id: string | null
          status: string | null
          token_expires_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          email: string
          fun_profile_id?: string | null
          id?: string
          merge_request_id?: string | null
          password_token_hash: string
          platform_data?: Json | null
          platform_id: string
          platform_user_id?: string | null
          status?: string | null
          token_expires_at: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          email?: string
          fun_profile_id?: string | null
          id?: string
          merge_request_id?: string | null
          password_token_hash?: string
          platform_data?: Json | null
          platform_id?: string
          platform_user_id?: string | null
          status?: string | null
          token_expires_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_provisions_merge_request_id_fkey"
            columns: ["merge_request_id"]
            isOneToOne: false
            referencedRelation: "account_merge_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_financial_data: {
        Row: {
          client_id: string
          client_timestamp: string | null
          created_at: string
          id: string
          last_sync_at: string
          sync_count: number
          total_bet: number
          total_deposit: number
          total_loss: number
          total_profit: number
          total_win: number
          total_withdraw: number
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id: string
          client_timestamp?: string | null
          created_at?: string
          id?: string
          last_sync_at?: string
          sync_count?: number
          total_bet?: number
          total_deposit?: number
          total_loss?: number
          total_profit?: number
          total_win?: number
          total_withdraw?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string
          client_timestamp?: string | null
          created_at?: string
          id?: string
          last_sync_at?: string
          sync_count?: number
          total_bet?: number
          total_deposit?: number
          total_loss?: number
          total_profit?: number
          total_win?: number
          total_withdraw?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_user_data: {
        Row: {
          client_id: string
          client_timestamp: string | null
          created_at: string
          data: Json
          id: string
          last_sync_mode: string | null
          sync_count: number
          synced_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id: string
          client_timestamp?: string | null
          created_at?: string
          data?: Json
          id?: string
          last_sync_mode?: string | null
          sync_count?: number
          synced_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string
          client_timestamp?: string | null
          created_at?: string
          data?: Json
          id?: string
          last_sync_mode?: string | null
          sync_count?: number
          synced_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      post_tags: {
        Row: {
          created_at: string
          id: string
          post_id: string
          tagged_user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          tagged_user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          tagged_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_tags_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          cloudflare_deleted_at: string | null
          content: string
          created_at: string
          delete_attempts: number
          delete_completed_at: string | null
          delete_error: string | null
          delete_metadata: Json
          delete_requested_at: string | null
          delete_status: string
          deleted_at: string | null
          id: string
          image_url: string | null
          location: string | null
          media_urls: Json | null
          metadata: Json
          post_type: string
          r2_deleted_at: string | null
          updated_at: string
          user_id: string
          video_url: string | null
          visibility: string
        }
        Insert: {
          cloudflare_deleted_at?: string | null
          content: string
          created_at?: string
          delete_attempts?: number
          delete_completed_at?: string | null
          delete_error?: string | null
          delete_metadata?: Json
          delete_requested_at?: string | null
          delete_status?: string
          deleted_at?: string | null
          id?: string
          image_url?: string | null
          location?: string | null
          media_urls?: Json | null
          metadata?: Json
          post_type?: string
          r2_deleted_at?: string | null
          updated_at?: string
          user_id: string
          video_url?: string | null
          visibility?: string
        }
        Update: {
          cloudflare_deleted_at?: string | null
          content?: string
          created_at?: string
          delete_attempts?: number
          delete_completed_at?: string | null
          delete_error?: string | null
          delete_metadata?: Json
          delete_requested_at?: string | null
          delete_status?: string
          deleted_at?: string | null
          id?: string
          image_url?: string | null
          location?: string | null
          media_urls?: Json | null
          metadata?: Json
          post_type?: string
          r2_deleted_at?: string | null
          updated_at?: string
          user_id?: string
          video_url?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      price_cache: {
        Row: {
          data: Json
          id: string
          updated_at: string
        }
        Insert: {
          data?: Json
          id?: string
          updated_at?: string
        }
        Update: {
          data?: Json
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          admin_notes: string | null
          approved_reward: number
          avatar_url: string | null
          ban_reason: string | null
          banned_at: string | null
          bio: string | null
          cover_url: string | null
          created_at: string
          cross_platform_data: Json | null
          custodial_wallet_address: string | null
          default_wallet_type: string | null
          email_claimed: string | null
          email_verified_at: string | null
          external_wallet_address: string | null
          financial_updated_at: string | null
          full_name: string | null
          fun_id: string | null
          grand_total_bet: number
          grand_total_deposit: number
          grand_total_loss: number
          grand_total_profit: number
          grand_total_win: number
          grand_total_withdraw: number
          has_password_set: boolean | null
          id: string
          is_banned: boolean
          is_restricted: boolean
          last_login_platform: string | null
          last_wallet_changed_at: string | null
          law_of_light_accepted: boolean
          law_of_light_accepted_at: string | null
          oauth_provider: string | null
          pending_reward: number
          pinned_post_id: string | null
          registered_from: string | null
          reward_status: string
          soul_level: number
          total_rewards: number
          trust_level: number
          updated_at: string
          username: string
          wallet_address: string | null
          wallet_verified_at: string | null
        }
        Insert: {
          admin_notes?: string | null
          approved_reward?: number
          avatar_url?: string | null
          ban_reason?: string | null
          banned_at?: string | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string
          cross_platform_data?: Json | null
          custodial_wallet_address?: string | null
          default_wallet_type?: string | null
          email_claimed?: string | null
          email_verified_at?: string | null
          external_wallet_address?: string | null
          financial_updated_at?: string | null
          full_name?: string | null
          fun_id?: string | null
          grand_total_bet?: number
          grand_total_deposit?: number
          grand_total_loss?: number
          grand_total_profit?: number
          grand_total_win?: number
          grand_total_withdraw?: number
          has_password_set?: boolean | null
          id: string
          is_banned?: boolean
          is_restricted?: boolean
          last_login_platform?: string | null
          last_wallet_changed_at?: string | null
          law_of_light_accepted?: boolean
          law_of_light_accepted_at?: string | null
          oauth_provider?: string | null
          pending_reward?: number
          pinned_post_id?: string | null
          registered_from?: string | null
          reward_status?: string
          soul_level?: number
          total_rewards?: number
          trust_level?: number
          updated_at?: string
          username: string
          wallet_address?: string | null
          wallet_verified_at?: string | null
        }
        Update: {
          admin_notes?: string | null
          approved_reward?: number
          avatar_url?: string | null
          ban_reason?: string | null
          banned_at?: string | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string
          cross_platform_data?: Json | null
          custodial_wallet_address?: string | null
          default_wallet_type?: string | null
          email_claimed?: string | null
          email_verified_at?: string | null
          external_wallet_address?: string | null
          financial_updated_at?: string | null
          full_name?: string | null
          fun_id?: string | null
          grand_total_bet?: number
          grand_total_deposit?: number
          grand_total_loss?: number
          grand_total_profit?: number
          grand_total_win?: number
          grand_total_withdraw?: number
          has_password_set?: boolean | null
          id?: string
          is_banned?: boolean
          is_restricted?: boolean
          last_login_platform?: string | null
          last_wallet_changed_at?: string | null
          law_of_light_accepted?: boolean
          law_of_light_accepted_at?: string | null
          oauth_provider?: string | null
          pending_reward?: number
          pinned_post_id?: string | null
          registered_from?: string | null
          reward_status?: string
          soul_level?: number
          total_rewards?: number
          trust_level?: number
          updated_at?: string
          username?: string
          wallet_address?: string | null
          wallet_verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_pinned_post_id_fkey"
            columns: ["pinned_post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_state: {
        Row: {
          count: number
          expires_at: string
          key: string
          window_start: string
        }
        Insert: {
          count?: number
          expires_at: string
          key: string
          window_start?: string
        }
        Update: {
          count?: number
          expires_at?: string
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      reactions: {
        Row: {
          comment_id: string | null
          created_at: string
          id: string
          post_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          comment_id?: string | null
          created_at?: string
          id?: string
          post_id?: string | null
          type?: string
          user_id: string
        }
        Update: {
          comment_id?: string | null
          created_at?: string
          id?: string
          post_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reactions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reconciliation_logs: {
        Row: {
          auto_adjusted: boolean | null
          discrepancies: Json | null
          id: string
          level: number
          notes: string | null
          run_at: string
          run_by: string | null
          status: string
          total_checked: number | null
          total_mismatched: number | null
        }
        Insert: {
          auto_adjusted?: boolean | null
          discrepancies?: Json | null
          id?: string
          level?: number
          notes?: string | null
          run_at?: string
          run_by?: string | null
          status?: string
          total_checked?: number | null
          total_mismatched?: number | null
        }
        Update: {
          auto_adjusted?: boolean | null
          discrepancies?: Json | null
          id?: string
          level?: number
          notes?: string | null
          run_at?: string
          run_by?: string | null
          status?: string
          total_checked?: number | null
          total_mismatched?: number | null
        }
        Relationships: []
      }
      red_envelope_claims: {
        Row: {
          amount: number
          claimed_at: string
          claimer_id: string
          envelope_id: string
          id: string
        }
        Insert: {
          amount: number
          claimed_at?: string
          claimer_id: string
          envelope_id: string
          id?: string
        }
        Update: {
          amount?: number
          claimed_at?: string
          claimer_id?: string
          envelope_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "red_envelope_claims_claimer_id_fkey"
            columns: ["claimer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "red_envelope_claims_claimer_id_fkey"
            columns: ["claimer_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "red_envelope_claims_envelope_id_fkey"
            columns: ["envelope_id"]
            isOneToOne: false
            referencedRelation: "red_envelopes"
            referencedColumns: ["id"]
          },
        ]
      }
      red_envelopes: {
        Row: {
          conversation_id: string
          created_at: string
          creator_id: string
          expires_at: string
          greeting: string | null
          id: string
          message_id: string | null
          remaining_amount: number
          remaining_count: number
          status: string
          token: string
          total_amount: number
          total_count: number
        }
        Insert: {
          conversation_id: string
          created_at?: string
          creator_id: string
          expires_at?: string
          greeting?: string | null
          id?: string
          message_id?: string | null
          remaining_amount: number
          remaining_count: number
          status?: string
          token?: string
          total_amount: number
          total_count: number
        }
        Update: {
          conversation_id?: string
          created_at?: string
          creator_id?: string
          expires_at?: string
          greeting?: string | null
          id?: string
          message_id?: string | null
          remaining_amount?: number
          remaining_count?: number
          status?: string
          token?: string
          total_amount?: number
          total_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "red_envelopes_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "red_envelopes_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "red_envelopes_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "red_envelopes_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          conversation_id: string | null
          created_at: string
          details: string | null
          id: string
          message_id: string | null
          reason: string
          reported_user_id: string | null
          reporter_id: string
          status: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          details?: string | null
          id?: string
          message_id?: string | null
          reason: string
          reported_user_id?: string | null
          reporter_id: string
          status?: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          details?: string | null
          id?: string
          message_id?: string | null
          reason?: string
          reported_user_id?: string | null
          reporter_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reported_user_id_fkey"
            columns: ["reported_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reported_user_id_fkey"
            columns: ["reported_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_adjustments: {
        Row: {
          admin_id: string
          amount: number
          created_at: string
          id: string
          reason: string
          user_id: string
        }
        Insert: {
          admin_id: string
          amount: number
          created_at?: string
          id?: string
          reason: string
          user_id: string
        }
        Update: {
          admin_id?: string
          amount?: number
          created_at?: string
          id?: string
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      reward_approvals: {
        Row: {
          admin_id: string
          admin_note: string | null
          amount: number
          created_at: string
          id: string
          reviewed_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          admin_id: string
          admin_note?: string | null
          amount?: number
          created_at?: string
          id?: string
          reviewed_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          admin_id?: string
          admin_note?: string | null
          amount?: number
          created_at?: string
          id?: string
          reviewed_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      reward_claims: {
        Row: {
          amount: number
          created_at: string
          id: string
          user_id: string
          wallet_address: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          user_id: string
          wallet_address: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          user_id?: string
          wallet_address?: string
        }
        Relationships: []
      }
      reward_pending: {
        Row: {
          action_type: string
          amount: number
          created_at: string
          id: string
          processed_at: string | null
          status: string
          unlock_at: string
          user_id: string
        }
        Insert: {
          action_type: string
          amount?: number
          created_at?: string
          id?: string
          processed_at?: string | null
          status?: string
          unlock_at?: string
          user_id: string
        }
        Update: {
          action_type?: string
          amount?: number
          created_at?: string
          id?: string
          processed_at?: string | null
          status?: string
          unlock_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reward_pending_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_pending_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      search_logs: {
        Row: {
          created_at: string
          id: string
          search_query: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          search_query: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          search_query?: string
          user_id?: string
        }
        Relationships: []
      }
      shared_posts: {
        Row: {
          created_at: string
          id: string
          original_post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          original_post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          original_post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_posts_original_post_id_fkey"
            columns: ["original_post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      siwe_nonces: {
        Row: {
          address: string
          created_at: string
          expires_at: string
          id: string
          nonce: string
          used_at: string | null
        }
        Insert: {
          address: string
          created_at?: string
          expires_at: string
          id?: string
          nonce: string
          used_at?: string | null
        }
        Update: {
          address?: string
          created_at?: string
          expires_at?: string
          id?: string
          nonce?: string
          used_at?: string | null
        }
        Relationships: []
      }
      soul_nfts: {
        Row: {
          chain_id: number
          contract_address: string | null
          created_at: string
          experience_points: number
          id: string
          is_minted: boolean
          metadata_uri: string | null
          minted_at: string | null
          soul_element: string | null
          soul_level: number
          soul_name: string | null
          token_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          chain_id?: number
          contract_address?: string | null
          created_at?: string
          experience_points?: number
          id?: string
          is_minted?: boolean
          metadata_uri?: string | null
          minted_at?: string | null
          soul_element?: string | null
          soul_level?: number
          soul_name?: string | null
          token_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          chain_id?: number
          contract_address?: string | null
          created_at?: string
          experience_points?: number
          id?: string
          is_minted?: boolean
          metadata_uri?: string | null
          minted_at?: string | null
          soul_element?: string | null
          soul_level?: number
          soul_name?: string | null
          token_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "soul_nfts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "soul_nfts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sticker_packs: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_free: boolean
          name: string
          preview_url: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_free?: boolean
          name: string
          preview_url: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_free?: boolean
          name?: string
          preview_url?: string
          sort_order?: number
        }
        Relationships: []
      }
      stickers: {
        Row: {
          created_at: string
          id: string
          is_animated: boolean
          name: string
          pack_id: string
          sort_order: number
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_animated?: boolean
          name: string
          pack_id: string
          sort_order?: number
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          is_animated?: boolean
          name?: string
          pack_id?: string
          sort_order?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "stickers_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "sticker_packs"
            referencedColumns: ["id"]
          },
        ]
      }
      streams: {
        Row: {
          created_at: string
          duration: number | null
          id: string
          status: string
          title: string | null
          updated_at: string
          user_id: string
          video_path: string | null
        }
        Insert: {
          created_at?: string
          duration?: number | null
          id?: string
          status?: string
          title?: string | null
          updated_at?: string
          user_id: string
          video_path?: string | null
        }
        Update: {
          created_at?: string
          duration?: number | null
          id?: string
          status?: string
          title?: string | null
          updated_at?: string
          user_id?: string
          video_path?: string | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: string
          chain_id: number
          created_at: string
          from_address: string
          id: string
          status: string
          to_address: string
          token_address: string | null
          token_symbol: string
          tx_hash: string
          user_id: string
        }
        Insert: {
          amount: string
          chain_id: number
          created_at?: string
          from_address: string
          id?: string
          status?: string
          to_address: string
          token_address?: string | null
          token_symbol: string
          tx_hash: string
          user_id: string
        }
        Update: {
          amount?: string
          chain_id?: number
          created_at?: string
          from_address?: string
          id?: string
          status?: string
          to_address?: string
          token_address?: string | null
          token_symbol?: string
          tx_hash?: string
          user_id?: string
        }
        Relationships: []
      }
      user_action_log: {
        Row: {
          action_type: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          action_type: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          action_type?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_action_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_action_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_device_fingerprint: {
        Row: {
          created_at: string
          device_hash: string
          id: string
          ip_hash: string
          user_agent_hash: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_hash: string
          id?: string
          ip_hash: string
          user_agent_hash: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_hash?: string
          id?: string
          ip_hash?: string
          user_agent_hash?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_device_fingerprint_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_device_fingerprint_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_stake_status: {
        Row: {
          created_at: string
          fun_balance: number
          last_checked_at: string | null
          meets_requirement: boolean
          user_id: string
          wallet_address: string | null
        }
        Insert: {
          created_at?: string
          fun_balance?: number
          last_checked_at?: string | null
          meets_requirement?: boolean
          user_id: string
          wallet_address?: string | null
        }
        Update: {
          created_at?: string
          fun_balance?: number
          last_checked_at?: string | null
          meets_requirement?: boolean
          user_id?: string
          wallet_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_stake_status_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_stake_status_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_trust: {
        Row: {
          account_age_score: number
          engagement_score: number
          fingerprint_penalty: number
          flag_reason: string | null
          is_flagged: boolean
          report_penalty: number
          trust_score: number
          updated_at: string
          user_id: string
        }
        Insert: {
          account_age_score?: number
          engagement_score?: number
          fingerprint_penalty?: number
          flag_reason?: string | null
          is_flagged?: boolean
          report_penalty?: number
          trust_score?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          account_age_score?: number
          engagement_score?: number
          fingerprint_penalty?: number
          flag_reason?: string | null
          is_flagged?: boolean
          report_penalty?: number
          trust_score?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_trust_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_trust_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_wallets: {
        Row: {
          address: string
          chain_id: number | null
          created_at: string
          id: string
          is_primary: boolean
          user_id: string
          verified_at: string | null
          wallet_network: string
        }
        Insert: {
          address: string
          chain_id?: number | null
          created_at?: string
          id?: string
          is_primary?: boolean
          user_id: string
          verified_at?: string | null
          wallet_network?: string
        }
        Update: {
          address?: string
          chain_id?: number | null
          created_at?: string
          id?: string
          is_primary?: boolean
          user_id?: string
          verified_at?: string | null
          wallet_network?: string
        }
        Relationships: []
      }
      wallet_auth_attempts: {
        Row: {
          address: string | null
          attempt_type: string
          created_at: string
          id: string
          ip_hash: string | null
          reason: string | null
          success: boolean
          ua_hash: string | null
          user_id: string | null
        }
        Insert: {
          address?: string | null
          attempt_type: string
          created_at?: string
          id?: string
          ip_hash?: string | null
          reason?: string | null
          success: boolean
          ua_hash?: string | null
          user_id?: string | null
        }
        Update: {
          address?: string | null
          attempt_type?: string
          created_at?: string
          id?: string
          ip_hash?: string | null
          reason?: string | null
          success?: boolean
          ua_hash?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      wallet_links: {
        Row: {
          address: string
          chain_id: number
          created_at: string
          id: string
          label: string | null
          last_seen_at: string | null
          user_id: string
          verified_at: string
        }
        Insert: {
          address: string
          chain_id: number
          created_at?: string
          id?: string
          label?: string | null
          last_seen_at?: string | null
          user_id: string
          verified_at?: string
        }
        Update: {
          address?: string
          chain_id?: number
          created_at?: string
          id?: string
          label?: string | null
          last_seen_at?: string | null
          user_id?: string
          verified_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_links_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_links_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_nonces: {
        Row: {
          address: string
          chain_id: number
          created_at: string
          expires_at: string
          id: string
          issued_at: string
          nonce: string
          purpose: string | null
          requested_by_user_id: string | null
          used_at: string | null
          user_id: string | null
        }
        Insert: {
          address: string
          chain_id: number
          created_at?: string
          expires_at: string
          id?: string
          issued_at?: string
          nonce: string
          purpose?: string | null
          requested_by_user_id?: string | null
          used_at?: string | null
          user_id?: string | null
        }
        Update: {
          address?: string
          chain_id?: number
          created_at?: string
          expires_at?: string
          id?: string
          issued_at?: string
          nonce?: string
          purpose?: string | null
          requested_by_user_id?: string | null
          used_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wallet_nonces_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_nonces_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_rate_limits: {
        Row: {
          count: number
          created_at: string
          expires_at: string
          key: string
          updated_at: string
          window_start: string
        }
        Insert: {
          count?: number
          created_at?: string
          expires_at: string
          key: string
          updated_at?: string
          window_start: string
        }
        Update: {
          count?: number
          created_at?: string
          expires_at?: string
          key?: string
          updated_at?: string
          window_start?: string
        }
        Relationships: []
      }
    }
    Views: {
      public_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          cover_url: string | null
          created_at: string | null
          full_name: string | null
          id: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string | null
          username?: string | null
        }
        Relationships: []
      }
      user_custodial_wallets: {
        Row: {
          chain_id: number | null
          created_at: string | null
          id: string | null
          is_active: boolean | null
          last_activity_at: string | null
          updated_at: string | null
          user_id: string | null
          wallet_address: string | null
        }
        Insert: {
          chain_id?: number | null
          created_at?: string | null
          id?: string | null
          is_active?: boolean | null
          last_activity_at?: string | null
          updated_at?: string | null
          user_id?: string | null
          wallet_address?: string | null
        }
        Update: {
          chain_id?: number | null
          created_at?: string | null
          id?: string | null
          is_active?: boolean | null
          last_activity_at?: string | null
          updated_at?: string | null
          user_id?: string | null
          wallet_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custodial_wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custodial_wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      approve_user_reward: {
        Args: { p_admin_id: string; p_note?: string; p_user_id: string }
        Returns: number
      }
      attach_live_replay_to_post: {
        Args: {
          _duration_seconds?: number
          _playback_url: string
          _session_id: string
          _thumbnail_url?: string
        }
        Returns: {
          agora_channel: string | null
          agora_uid_host: number | null
          channel_name: string
          cloudflare_live_input_id: string | null
          cloudflare_video_uid: string | null
          created_at: string
          ended_at: string | null
          hls_playback_url: string | null
          hls_url: string | null
          host_user_id: string
          id: string
          last_worker_response: Json | null
          live_mode: string
          owner_id: string | null
          post_id: string | null
          privacy: string
          recording_acquired_at: string | null
          recording_error: string | null
          recording_ready_at: string | null
          recording_started_at: string | null
          recording_status: string | null
          recording_stopped_at: string | null
          recording_uid: number | null
          resource_id: string | null
          rtmp_ended_at: string | null
          rtmp_started_at: string | null
          rtmp_status: string | null
          sid: string | null
          source: string | null
          started_at: string
          status: string
          stream_key: string | null
          stream_provider: string
          title: string
          updated_at: string
          viewer_count: number
        }
        SetofOptions: {
          from: "*"
          to: "live_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      ban_user_permanently: {
        Args: { p_admin_id: string; p_reason?: string; p_user_id: string }
        Returns: boolean
      }
      calculate_engagement_quality: {
        Args: { p_user_id: string }
        Returns: number
      }
      calculate_trust_score: { Args: { p_user_id: string }; Returns: number }
      check_action_rate_limit: {
        Args: { p_action_type: string; p_user_id: string }
        Returns: Json
      }
      check_rate_limit: {
        Args: { p_key: string; p_limit: number; p_window_ms?: number }
        Returns: Json
      }
      claim_red_envelope: { Args: { p_envelope_id: string }; Returns: number }
      cleanup_expired_oauth_data: { Args: never; Returns: undefined }
      decrement_live_viewer_count: {
        Args: { session_id: string }
        Returns: undefined
      }
      delete_storage_object: {
        Args: { bucket_name: string; object_path: string }
        Returns: undefined
      }
      detect_device_clusters: {
        Args: never
        Returns: {
          device_hash: string
          user_count: number
          user_ids: string[]
          usernames: string[]
        }[]
      }
      end_livestream: { Args: { p_livestream_id: string }; Returns: boolean }
      find_user_id_by_email: { Args: { p_email: string }; Returns: string }
      generate_secure_token: { Args: { length?: number }; Returns: string }
      get_app_stats: {
        Args: never
        Returns: {
          total_photos: number
          total_posts: number
          total_rewards: number
          total_users: number
          total_videos: number
        }[]
      }
      get_live_recording_context: {
        Args: { _session_id: string }
        Returns: {
          agora_channel: string
          channel_name: string
          host_user_id: string
          id: string
          last_worker_response: Json
          post_id: string
          recording_error: string
          recording_ready_at: string
          recording_started_at: string
          recording_status: string
          recording_stopped_at: string
          recording_uid: number
          resource_id: string
          sid: string
        }[]
      }
      get_user_rewards: {
        Args: { limit_count?: number }
        Returns: {
          avatar_url: string
          comments_count: number
          friends_count: number
          id: string
          posts_count: number
          reactions_count: number
          reactions_on_posts: number
          shares_count: number
          total_reward: number
          username: string
        }[]
      }
      get_user_rewards_v2: {
        Args: { limit_count?: number }
        Returns: {
          avatar_url: string
          comments_count: number
          friends_count: number
          id: string
          livestreams_count: number
          posts_count: number
          reactions_count: number
          reactions_on_posts: number
          shares_count: number
          today_reward: number
          total_reward: number
          username: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_live_viewer_count: {
        Args: { session_id: string }
        Returns: undefined
      }
      is_conversation_admin: {
        Args: { check_user_id: string; conv_id: string }
        Returns: boolean
      }
      is_conversation_participant: {
        Args: { check_user_id: string; conv_id: string }
        Returns: boolean
      }
      log_user_action: {
        Args: { p_action_type: string; p_user_id: string }
        Returns: Json
      }
      mark_live_replay_uploaded: {
        Args: { _replay_id: string }
        Returns: undefined
      }
      normalize_username: { Args: { input_text: string }; Returns: string }
      pin_message: { Args: { p_message_id: string }; Returns: undefined }
      recalculate_user_financial:
        | { Args: { p_client_id?: string; p_user_id: string }; Returns: Json }
        | {
            Args: {
              p_admin_id?: string
              p_client_id?: string
              p_user_id: string
            }
            Returns: Json
          }
      reject_user_reward: {
        Args: { p_admin_id: string; p_note?: string; p_user_id: string }
        Returns: number
      }
      run_financial_reconciliation: {
        Args: { p_admin_id?: string }
        Returns: Json
      }
      set_live_recording_state: {
        Args: {
          _last_worker_response?: Json
          _recording_error?: string
          _recording_ready_at?: string
          _recording_started_at?: string
          _recording_status?: string
          _recording_stopped_at?: string
          _recording_uid?: number
          _resource_id?: string
          _session_id: string
          _sid?: string
        }
        Returns: {
          agora_channel: string | null
          agora_uid_host: number | null
          channel_name: string
          cloudflare_live_input_id: string | null
          cloudflare_video_uid: string | null
          created_at: string
          ended_at: string | null
          hls_playback_url: string | null
          hls_url: string | null
          host_user_id: string
          id: string
          last_worker_response: Json | null
          live_mode: string
          owner_id: string | null
          post_id: string | null
          privacy: string
          recording_acquired_at: string | null
          recording_error: string | null
          recording_ready_at: string | null
          recording_started_at: string | null
          recording_status: string | null
          recording_stopped_at: string | null
          recording_uid: number | null
          resource_id: string | null
          rtmp_ended_at: string | null
          rtmp_started_at: string | null
          rtmp_status: string | null
          sid: string | null
          source: string | null
          started_at: string
          status: string
          stream_key: string | null
          stream_provider: string
          title: string
          updated_at: string
          viewer_count: number
        }
        SetofOptions: {
          from: "*"
          to: "live_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_live_recording_stopped: {
        Args: { _file_list?: Json; _media_url?: string; _session_id: string }
        Returns: undefined
      }
      sync_profiles_legacy_wallet_fields: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      unpin_message: { Args: { p_message_id: string }; Returns: undefined }
      upsert_live_recording_row: {
        Args: {
          _duration_seconds?: number
          _file_list_json?: Json
          _media_url?: string
          _raw_response?: Json
          _recorder_uid?: string
          _resource_id?: string
          _session_id: string
          _sid?: string
          _status?: string
          _stopped_at?: string
          _thumbnail_url?: string
        }
        Returns: {
          created_at: string | null
          delete_error: string | null
          deleted_at: string | null
          duration_seconds: number | null
          file_list_json: Json | null
          id: string
          live_id: string | null
          media_url: string | null
          mode: string | null
          raw_response: Json | null
          recorder_uid: string | null
          resource_id: string | null
          sid: string | null
          status: string | null
          stopped_at: string | null
          storage_region: number | null
          storage_vendor: number | null
          thumbnail_url: string | null
        }
        SetofOptions: {
          from: "*"
          to: "live_recordings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const

````

### `supabase/config.toml`

````toml
project_id = "lramftbsjrqyysdqlfdg"

[functions.wallet-nonce]
verify_jwt = false

[functions.wallet-link]
verify_jwt = false

[functions.wallet-login]
verify_jwt = false

[functions.wallet-verify]
verify_jwt = true

[functions.siwe-nonce]
verify_jwt = false

[functions.siwe-verify]
verify_jwt = false

[functions.email-link-start]
verify_jwt = false

[functions.email-link-verify]
verify_jwt = false

[functions.me-unified]
verify_jwt = true

[functions.connect-external-wallet]
verify_jwt = true

[functions.disconnect-external-wallet]
verify_jwt = true

[functions.price-proxy]
verify_jwt = false

[functions.live-replay-create-upload]
verify_jwt = true

[functions.stream-webhook]
verify_jwt = false

[functions.stream-mp4-finalize]
verify_jwt = false

[functions.reconcile-pending-replays]
verify_jwt = false

[functions.delete-post]
verify_jwt = true

[functions.retry-post-video-deletes]
verify_jwt = false

[functions.archive-replay-to-r2]
verify_jwt = false

[functions.retry-archive-replays]
verify_jwt = false


````

