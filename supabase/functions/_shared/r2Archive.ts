const SERVICE = "s3";
const REGION = "auto";

export type R2Object = {
  key: string;
  size: number;
  lastModified?: string | null;
};

export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  tempBucket: string;
  archiveBucket: string;
  publicBaseUrl: string;
  endpoint: string;
};

export function getR2Config(): R2Config {
  const accountId = (Deno.env.get("R2_ACCOUNT_ID") || Deno.env.get("CLOUDFLARE_ACCOUNT_ID") || "").trim();
  const accessKeyId = (
    Deno.env.get("R2_ACCESS_KEY_ID") ||
    Deno.env.get("AGORA_STORAGE_ACCESS_KEY") ||
    Deno.env.get("CLOUDFLARE_ACCESS_KEY_ID") ||
    ""
  ).trim();
  const secretAccessKey = (
    Deno.env.get("R2_SECRET_ACCESS_KEY") ||
    Deno.env.get("AGORA_STORAGE_SECRET_KEY") ||
    Deno.env.get("CLOUDFLARE_SECRET_ACCESS_KEY") ||
    ""
  ).trim();
  const tempBucket = (
    Deno.env.get("R2_TEMP_BUCKET") ||
    Deno.env.get("AGORA_STORAGE_BUCKET") ||
    Deno.env.get("CLOUDFLARE_R2_BUCKET_NAME") ||
    ""
  ).trim();
  const archiveBucket = (
    Deno.env.get("R2_ARCHIVE_BUCKET") ||
    Deno.env.get("R2_BUCKET_NAME") ||
    Deno.env.get("AGORA_STORAGE_BUCKET") ||
    Deno.env.get("CLOUDFLARE_R2_BUCKET_NAME") ||
    ""
  ).trim();
  const publicBaseUrl = (
    Deno.env.get("R2_PUBLIC_BASE_URL") ||
    Deno.env.get("R2_PUBLIC_DOMAIN") ||
    Deno.env.get("CLOUDFLARE_R2_PUBLIC_URL") ||
    Deno.env.get("AGORA_RECORDING_PLAYBACK_BASE_URL") ||
    ""
  ).replace(/\/+$/, "");
  const endpoint = (
    Deno.env.get("R2_ENDPOINT") ||
    Deno.env.get("AGORA_STORAGE_ENDPOINT") ||
    Deno.env.get("CLOUDFLARE_R2_ENDPOINT") ||
    (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "")
  ).replace(/\/+$/, "");

  if (!accountId || !accessKeyId || !secretAccessKey || !tempBucket || !archiveBucket || !publicBaseUrl || !endpoint) {
    throw new Error("Missing R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_TEMP_BUCKET / R2_ARCHIVE_BUCKET / R2_PUBLIC_BASE_URL");
  }

  console.log(`[r2Archive] config temp=${tempBucket} archive=${archiveBucket} endpoint=${endpoint} publicBase=${publicBaseUrl}`);
  return { accountId, accessKeyId, secretAccessKey, tempBucket, archiveBucket, publicBaseUrl, endpoint };
}

export function sanitizeR2Key(value: string): string {
  return value.replace(/[^a-zA-Z0-9._/-]/g, "-").replace(/\/+/g, "/").replace(/^\/+/, "");
}

export function encodeR2Path(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

export function publicR2Url(config: R2Config, key: string): string {
  return `${config.publicBaseUrl}/${encodeR2Path(key.replace(/^\/+/, ""))}`;
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

async function signatureKey(secret: string, dateStamp: string): Promise<ArrayBuffer> {
  const kDate = await hmacSha256(new TextEncoder().encode("AWS4" + secret).buffer, dateStamp);
  const kRegion = await hmacSha256(kDate, REGION);
  const kService = await hmacSha256(kRegion, SERVICE);
  return hmacSha256(kService, "aws4_request");
}

function hex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function signedR2Fetch(params: {
  config?: R2Config;
  method: "GET" | "PUT" | "HEAD" | "DELETE";
  bucket: string;
  key?: string;
  query?: URLSearchParams;
  body?: BodyInit | null;
  headers?: HeadersInit;
}) {
  const config = params.config ?? getR2Config();
  const host = new URL(config.endpoint).host;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const canonicalUri = params.key
    ? `/${params.bucket}/${encodeR2Path(params.key)}`
    : `/${params.bucket}`;

  const headers = new Headers(params.headers);
  headers.set("host", host);
  const signedHeaderNames = Array.from(headers.keys()).map((h) => h.toLowerCase()).sort();
  const signedHeaders = signedHeaderNames.join(";");
  const canonicalHeaders = signedHeaderNames.map((name) => `${name}:${headers.get(name)?.trim() ?? ""}\n`).join("");

  const query = new URLSearchParams(params.query);
  query.set("X-Amz-Algorithm", "AWS4-HMAC-SHA256");
  query.set("X-Amz-Credential", `${config.accessKeyId}/${dateStamp}/${REGION}/${SERVICE}/aws4_request`);
  query.set("X-Amz-Date", amzDate);
  query.set("X-Amz-Expires", "900");
  query.set("X-Amz-SignedHeaders", signedHeaders);
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
  const key = await signatureKey(config.secretAccessKey, dateStamp);
  query.set("X-Amz-Signature", hex(await hmacSha256(key, stringToSign)));

  headers.delete("host");
  return fetch(`${config.endpoint}${canonicalUri}?${query.toString()}`, {
    method: params.method,
    headers,
    body: params.body,
  });
}

function readTag(block: string, tag: string): string | null {
  const match = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return match ? match[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">") : null;
}

export async function listR2Objects(config: R2Config, bucket: string, prefix: string): Promise<R2Object[]> {
  const query = new URLSearchParams({ "list-type": "2", prefix });
  const res = await signedR2Fetch({ config, method: "GET", bucket, query });
  if (!res.ok) {
    throw new Error(`R2 list failed for ${bucket}/${prefix}: ${res.status} ${(await res.text()).slice(0, 300)}`);
  }
  const xml = await res.text();
  const blocks = xml.match(/<Contents>[\s\S]*?<\/Contents>/g) ?? [];
  return blocks
    .map((block) => ({
      key: readTag(block, "Key") ?? "",
      size: Number(readTag(block, "Size") ?? 0),
      lastModified: readTag(block, "LastModified"),
    }))
    .filter((obj) => obj.key && obj.size > 0);
}

export async function headR2Object(config: R2Config, bucket: string, key: string): Promise<Response> {
  return signedR2Fetch({ config, method: "HEAD", bucket, key });
}

export async function copyR2Object(config: R2Config, sourceBucket: string, sourceKey: string, destBucket: string, destKey: string): Promise<Response> {
  return signedR2Fetch({
    config,
    method: "PUT",
    bucket: destBucket,
    key: destKey,
    headers: {
      "x-amz-copy-source": `/${sourceBucket}/${encodeR2Path(sourceKey)}`,
    },
  });
}

export async function deleteR2Object(config: R2Config, bucket: string, key: string): Promise<Response> {
  return signedR2Fetch({ config, method: "DELETE", bucket, key });
}

export async function putR2Object(
  config: R2Config,
  bucket: string,
  key: string,
  body: Uint8Array | ArrayBuffer | Blob,
  contentType = "application/octet-stream",
): Promise<Response> {
  return signedR2Fetch({
    config,
    method: "PUT",
    bucket,
    key,
    body: body as BodyInit,
    headers: { "content-type": contentType },
  });
}
