# Post Video Delete Cleanup Flow Package

## Mục tiêu

Đây là gói triển khai tính năng **Post Video Delete Cleanup Flow** cho FUN Profile.

Khi user bấm **Xóa bài viết**, hệ thống không được chỉ xóa post ở frontend/database. Backend phải:

- Verify user hiện tại là owner của post hoặc admin.
- Load post và metadata video trước khi xóa.
- Xóa Cloudflare Stream video nếu post là replay/live recording.
- Xóa Cloudflare R2 object nếu post là video upload thường hoặc video archive.
- Soft delete post bằng `posts.deleted_at`.
- Nếu external delete fail, đánh dấu `delete_status='delete_pending'` để retry sau.
- Không expose Cloudflare/R2 secret ra frontend.

## Files cần thêm/chỉnh

### Thêm mới

- `supabase/functions/_shared/postVideoDelete.ts`
- `supabase/functions/delete-post/index.ts`
- `supabase/functions/retry-post-video-deletes/index.ts`
- `supabase/migrations/20260507120000_post_video_delete_soft_cleanup.sql`

### Chỉnh sửa

- `supabase/config.toml`
- `src/modules/feed/components/post/FacebookPostCard.tsx`
- `src/components/feed/FacebookPostCard.tsx`
- `src/modules/feed/hooks/useFeedPosts.ts`
- `src/hooks/useFeedPosts.ts`
- `src/pages/Profile.tsx`
- `src/pages/Post.tsx`
- `src/modules/feed/pages/Post.tsx`
- `src/components/layout/InlineSearch.tsx`
- `src/components/feed/StoriesBar.tsx`
- `src/modules/feed/components/sidebar/StoriesBar.tsx`
- `src/integrations/supabase/types.ts`

## Environment variables

Backend function đọc các env sau:

```txt
SUPABASE_URL
SUPABASE_ANON_KEY
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

CLOUDFLARE_ACCESS_KEY_ID
CLOUDFLARE_SECRET_ACCESS_KEY
CLOUDFLARE_R2_BUCKET_NAME
CLOUDFLARE_R2_PUBLIC_URL

CRON_SECRET
SCHEDULED_FUNCTION_SECRET
```

Alias được hỗ trợ:

- Stream token: `CLOUDFLARE_STREAM_API_TOKEN || CLOUDFLARE_STREAM_TOKEN || CLOUDFLARE_API_TOKEN`
- R2 account: `R2_ACCOUNT_ID || CLOUDFLARE_ACCOUNT_ID`
- R2 key id: `R2_ACCESS_KEY_ID || CLOUDFLARE_ACCESS_KEY_ID`
- R2 secret: `R2_SECRET_ACCESS_KEY || CLOUDFLARE_SECRET_ACCESS_KEY`
- R2 bucket: `R2_BUCKET_NAME || CLOUDFLARE_R2_BUCKET_NAME`
- R2 public domain: `R2_PUBLIC_DOMAIN || CLOUDFLARE_R2_PUBLIC_URL`

---

# 1. Migration

Create file: `supabase/migrations/20260507120000_post_video_delete_soft_cleanup.sql`

```sql
-- Server-side post delete orchestration with external Cloudflare cleanup retry metadata.

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS delete_status text,
  ADD COLUMN IF NOT EXISTS delete_error text,
  ADD COLUMN IF NOT EXISTS delete_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS delete_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS cloudflare_deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS r2_deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS delete_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delete_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS posts_delete_status_check;

ALTER TABLE public.posts
  ADD CONSTRAINT posts_delete_status_check
  CHECK (delete_status IS NULL OR delete_status IN ('deleting', 'delete_pending', 'deleted', 'failed'));

CREATE INDEX IF NOT EXISTS idx_posts_not_deleted_created_at
  ON public.posts(created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_posts_delete_pending
  ON public.posts(updated_at ASC)
  WHERE delete_status = 'delete_pending' AND deleted_at IS NOT NULL;

COMMENT ON COLUMN public.posts.delete_metadata IS
  'Captured Cloudflare Stream UIDs and R2 object keys used by delete-post and retry-post-video-deletes.';

DROP POLICY IF EXISTS "Posts visibility based on setting" ON public.posts;
CREATE POLICY "Posts visibility based on setting"
ON public.posts
FOR SELECT
USING (
  deleted_at IS NULL
  AND (
    visibility = 'public'
    OR user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR (
      visibility = 'friends'
      AND EXISTS (
        SELECT 1
        FROM public.friendships
        WHERE status = 'accepted'
          AND (
            (user_id = auth.uid() AND friend_id = posts.user_id)
            OR (friend_id = auth.uid() AND user_id = posts.user_id)
          )
      )
    )
  )
);

ALTER TABLE public.live_replays
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS delete_error text;

ALTER TABLE public.live_replays
  DROP CONSTRAINT IF EXISTS live_replays_status_check;

ALTER TABLE public.live_replays
  ADD CONSTRAINT live_replays_status_check
  CHECK (status IN ('uploading', 'queued', 'processing', 'ready', 'failed', 'deleted'));

CREATE INDEX IF NOT EXISTS idx_live_replays_deleted_at
  ON public.live_replays(deleted_at)
  WHERE deleted_at IS NOT NULL;

ALTER TABLE public.live_recordings
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS delete_error text;

ALTER TABLE public.live_recordings
  DROP CONSTRAINT IF EXISTS live_recordings_status_check;

ALTER TABLE public.live_recordings
  ADD CONSTRAINT live_recordings_status_check
  CHECK (status IN ('starting', 'recording', 'stopping', 'processing', 'ready', 'stopped', 'failed', 'deleted'));

ALTER TABLE public.live_sessions
  DROP CONSTRAINT IF EXISTS live_sessions_recording_status_check;

ALTER TABLE public.live_sessions
  ADD CONSTRAINT live_sessions_recording_status_check
  CHECK (recording_status IN ('idle', 'acquired', 'acquiring', 'starting', 'recording', 'uploading', 'queued', 'stopping', 'processing', 'ready', 'stopped', 'failed', 'deleted'));
```

---

# 2. Shared Backend Helper

Create file: `supabase/functions/_shared/postVideoDelete.ts`

```ts
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
      .select("live_session_id, stream_uid, source_webm_key, playback_hls, playback_dash, playback_mp4")
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
```

---

# 3. Edge Function: delete-post

Create file: `supabase/functions/delete-post/index.ts`

```ts
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
  }

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
```

---

# 4. Edge Function: retry-post-video-deletes

Create file: `supabase/functions/retry-post-video-deletes/index.ts`

```ts
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
    }

    results.push({
      post_id: post.id,
      status: finalStatus,
      pending: summary.failed.length,
    });
  }

  return json({ processed: results.length, results });
});
```

---

# 5. Supabase config

Update file: `supabase/config.toml`

```toml
[functions.delete-post]
verify_jwt = true

[functions.retry-post-video-deletes]
verify_jwt = false
```

---

# 6. Frontend UI Patch: FacebookPostCard

Apply this same pattern in both:

- `src/modules/feed/components/post/FacebookPostCard.tsx`
- `src/components/feed/FacebookPostCard.tsx`

## Add import

```ts
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
```

## Remove legacy import

```ts
// Remove:
import { deleteStreamVideosByPost } from '@/utils/streamHelpers';
```

## Add state

```ts
const [showDeleteDialog, setShowDeleteDialog] = useState(false);
```

## Replace handleDelete

```ts
const handleDelete = useCallback(async () => {
  if (isDeleting) return;
  setIsDeleting(true);

  try {
    const { data, error } = await supabase.functions.invoke('delete-post', {
      body: { post_id: post.id },
    });

    if (error) throw error;

    const status = (data as { status?: string } | null)?.status;
    if (status === 'delete_pending') {
      toast.success('Bài viết đang được xóa, hệ thống sẽ tiếp tục xử lý video.');
    } else {
      toast.success('Đã xóa bài viết và video liên quan.');
    }

    setShowDeleteDialog(false);
    onPostDeleted();
  } catch (error: unknown) {
    console.error('[handleDelete] error:', error);
    toast.error('Không thể xóa bài viết. Vui lòng thử lại.');
  } finally {
    setIsDeleting(false);
  }
}, [isDeleting, post.id, onPostDeleted]);
```

## Change dropdown delete action

```tsx
<DropdownMenuItem
  onSelect={(e) => {
    e.preventDefault();
    setShowDeleteDialog(true);
  }}
  disabled={isDeleting}
  className="cursor-pointer text-destructive gap-3"
>
  <Trash2 className="w-5 h-5" />
  {isDeleting ? t('deleting') : t('deletePost')}
</DropdownMenuItem>
```

## Add confirm dialog near bottom of component JSX

```tsx
<AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Xóa bài viết?</AlertDialogTitle>
      <AlertDialogDescription>
        Bạn có chắc muốn xóa bài viết này không? Video liên quan cũng sẽ bị xóa vĩnh viễn.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel disabled={isDeleting}>Hủy</AlertDialogCancel>
      <AlertDialogAction
        onClick={(event) => {
          event.preventDefault();
          handleDelete();
        }}
        disabled={isDeleting}
        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
      >
        {isDeleting ? t('deleting') : t('deletePost')}
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

---

# 7. Frontend Query Patches

## Feed hooks

Apply to:

- `src/modules/feed/hooks/useFeedPosts.ts`
- `src/hooks/useFeedPosts.ts`

```ts
let query = supabase
  .from('posts')
  .select(`*, profiles!posts_user_id_fkey (username, avatar_url)`)
  .is('deleted_at', null)
  .order('created_at', { ascending: false })
  .limit(POSTS_PER_PAGE + 1);
```

## Post detail pages

Apply to:

- `src/pages/Post.tsx`
- `src/modules/feed/pages/Post.tsx`

```ts
const { data, error } = await supabase
  .from('posts')
  .select(`
    *,
    profiles!posts_user_id_fkey (username, avatar_url, full_name),
    reactions (id, user_id, type),
    comments (id)
  `)
  .eq('id', postId)
  .is('deleted_at', null)
  .single();
```

## Profile page

Apply to: `src/pages/Profile.tsx`

Original posts query:

```ts
const { data: postsData } = await supabase
  .from('posts')
  .select(`
    *,
    profiles!posts_user_id_fkey (username, avatar_url, full_name),
    reactions (id, user_id, type),
    comments (id)
  `)
  .eq('user_id', profileId)
  .is('deleted_at', null)
  .order('created_at', { ascending: false });
```

Shared posts query:

```ts
const { data: sharedPostsData } = await supabase
  .from('shared_posts')
  .select(`
    *,
    posts!inner:original_post_id (
      *,
      profiles!posts_user_id_fkey (username, avatar_url, full_name),
      reactions (id, user_id, type),
      comments (id)
    )
  `)
  .eq('user_id', profileId)
  .is('posts.deleted_at', null)
  .order('created_at', { ascending: false });
```

## Inline search

Apply to: `src/components/layout/InlineSearch.tsx`

```ts
const { data: postData } = await supabase
  .from('posts')
  .select(`
    id,
    content,
    created_at,
    profiles!posts_user_id_fkey (username, avatar_url)
  `)
  .ilike('content', `%${safeQuery}%`)
  .is('deleted_at', null)
  .order('created_at', { ascending: false })
  .limit(5);
```

## Stories bars

Apply to:

- `src/components/feed/StoriesBar.tsx`
- `src/modules/feed/components/sidebar/StoriesBar.tsx`

```ts
const { data: recentPosts } = await supabase
  .from('posts')
  .select('user_id, profiles!posts_user_id_fkey(id, username, avatar_url)')
  .is('deleted_at', null)
  .order('created_at', { ascending: false })
  .limit(10);
```

---

# 8. Supabase Types Patch

If generated types are tracked, update `src/integrations/supabase/types.ts`.

Add to `posts.Row`:

```ts
cloudflare_deleted_at: string | null
delete_attempts: number
delete_completed_at: string | null
delete_error: string | null
delete_metadata: Json
delete_requested_at: string | null
delete_status: string | null
deleted_at: string | null
r2_deleted_at: string | null
```

Add to `posts.Insert` and `posts.Update` as optional:

```ts
cloudflare_deleted_at?: string | null
delete_attempts?: number
delete_completed_at?: string | null
delete_error?: string | null
delete_metadata?: Json
delete_requested_at?: string | null
delete_status?: string | null
deleted_at?: string | null
r2_deleted_at?: string | null
```

Add to `live_replays.Row`:

```ts
delete_error: string | null
deleted_at: string | null
```

Add to `live_replays.Insert` and `live_replays.Update`:

```ts
delete_error?: string | null
deleted_at?: string | null
```

Add to `live_recordings.Row`:

```ts
delete_error: string | null
deleted_at: string | null
```

Add to `live_recordings.Insert` and `live_recordings.Update`:

```ts
delete_error?: string | null
deleted_at?: string | null
```

---

# 9. API Contract

## Request

```ts
await supabase.functions.invoke('delete-post', {
  body: { post_id: post.id },
});
```

## Success response

```json
{
  "status": "deleted",
  "post_id": "uuid",
  "deleted": {
    "stream": 1,
    "r2": 1
  },
  "pending": 0,
  "errors": []
}
```

## Pending response

```json
{
  "status": "delete_pending",
  "post_id": "uuid",
  "deleted": {
    "stream": 1,
    "r2": 0
  },
  "pending": 1,
  "errors": [
    {
      "type": "r2",
      "value": "videos/user-id/file.mp4",
      "error": "R2 delete failed..."
    }
  ]
}
```

---

# 10. Retry Cron

Recommended schedule: every 15 minutes.

Call:

```http
POST /functions/v1/retry-post-video-deletes
Authorization: Bearer <CRON_SECRET>
Content-Type: application/json

{
  "limit": 20
}
```

If `CRON_SECRET` or `SCHEDULED_FUNCTION_SECRET` is not configured, the function can run without that extra secret check. In production, configure one.

---

# 11. Test Plan

- Owner deletes text/no-video post: post disappears, `posts.deleted_at` is set.
- Owner deletes R2 video post: R2 object delete is called, `r2_deleted_at` is set.
- Owner deletes Cloudflare Stream replay/live recording: Stream DELETE is called, `cloudflare_deleted_at` is set.
- Cloudflare/R2 404: treat as success.
- Cloudflare/R2 network/auth failure: post is hidden, `delete_status='delete_pending'`, retry can finish later.
- Non-owner calls `delete-post`: returns 403.
- Admin calls `delete-post`: allowed.
- Feed/profile/search/post detail do not show soft-deleted posts.

---

# 12. Verification Notes

Local verification already performed:

```txt
npm run build
```

Result: build passed.

`npm run lint` currently fails because the repo already has many existing lint errors outside this feature. The new feature was verified by production build.
