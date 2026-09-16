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
