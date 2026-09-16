/**
 * R2 multipart upload endpoints for live recording chunks.
 * Frontend buffers MediaRecorder chunks (≥5MB each) and uploads parts in
 * parallel while the live is still going. After end-live, /complete assembles
 * a single R2 object — Cloudflare Stream then copies it via URL.
 *
 * Endpoints:
 *   POST /upload/live-part/init        body: { stream_id, content_type? } -> { key, upload_id }
 *   PUT  /upload/live-part/upload      headers: X-Stream-Id, X-Upload-Id, X-Part-Number, X-R2-Key
 *                                      body: raw bytes -> { etag, part_number }
 *   POST /upload/live-part/complete    body: { stream_id, key, upload_id, parts: [{ partNumber, etag }] }
 *                                      -> { key, url, size }
 *   POST /upload/live-part/abort       body: { stream_id, key, upload_id } -> { ok: true }
 */

import { Env, corsHeaders } from './cors';

interface SupabaseUser {
  id: string;
}

const MAX_PART_SIZE = 50 * 1024 * 1024; // 50MB cap per part (R2 allows up to 5GB)

function errorJson(message: string, status: number, origin: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

function okJson(payload: Record<string, unknown>, origin: string): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

async function verifySupabaseUser(authHeader: string, env: Env): Promise<SupabaseUser | null> {
  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    method: 'GET',
    headers: { Authorization: authHeader, apikey: env.SUPABASE_ANON_KEY },
  });
  if (!response.ok) return null;
  const user = (await response.json()) as SupabaseUser;
  return user?.id ? user : null;
}

async function isHostOfSession(streamId: string, userId: string, authHeader: string, env: Env): Promise<boolean> {
  const url = new URL(`${env.SUPABASE_URL}/rest/v1/live_sessions`);
  url.searchParams.set('select', 'id');
  url.searchParams.set('id', `eq.${streamId}`);
  url.searchParams.set('or', `(host_user_id.eq.${userId},owner_id.eq.${userId})`);
  url.searchParams.set('limit', '1');

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: { Authorization: authHeader, apikey: env.SUPABASE_ANON_KEY },
  });
  if (!res.ok) return false;
  const rows = (await res.json()) as Array<{ id: string }>;
  return Array.isArray(rows) && rows.length > 0;
}

async function authorize(req: Request, env: Env, streamId: string, origin: string): Promise<{ user: SupabaseUser } | Response> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return errorJson('Missing or invalid Authorization header', 401, origin);
  }
  if (!streamId) return errorJson('Missing stream_id', 400, origin);
  const user = await verifySupabaseUser(authHeader, env);
  if (!user) return errorJson('Invalid JWT', 401, origin);
  const ownsSession = await isHostOfSession(streamId, user.id, authHeader, env);
  if (!ownsSession) return errorJson('Forbidden: not the host of this session', 403, origin);
  return { user };
}

function buildKey(streamId: string, userId: string): string {
  const ts = Date.now();
  return `recordings/${streamId}/${userId}-${ts}.webm`;
}

export async function handleLivePartInit(
  req: Request,
  env: Env,
  requestId: string,
  origin: string,
): Promise<Response> {
  const body = await req.json().catch(() => ({})) as { stream_id?: string; content_type?: string };
  const streamId = String(body.stream_id || '');
  const contentType = String(body.content_type || 'video/webm');

  const auth = await authorize(req, env, streamId, origin);
  if (auth instanceof Response) return auth;

  const key = buildKey(streamId, auth.user.id);
  const multipart = await env.RECORDINGS_BUCKET.createMultipartUpload(key, {
    httpMetadata: { contentType },
  });

  console.log(`[${requestId}] live-part/init key=${key} uploadId=${multipart.uploadId.slice(0, 12)}`);

  return okJson({ key, upload_id: multipart.uploadId }, origin);
}

export async function handleLivePartUpload(
  req: Request,
  env: Env,
  requestId: string,
  origin: string,
): Promise<Response> {
  const streamId = req.headers.get('X-Stream-Id') || '';
  const uploadId = req.headers.get('X-Upload-Id') || '';
  const partNumberStr = req.headers.get('X-Part-Number') || '';
  const key = req.headers.get('X-R2-Key') || '';

  const partNumber = Number(partNumberStr);
  if (!uploadId || !key || !Number.isInteger(partNumber) || partNumber < 1 || partNumber > 10000) {
    return errorJson('Missing/invalid X-Upload-Id, X-R2-Key, or X-Part-Number', 400, origin);
  }

  const auth = await authorize(req, env, streamId, origin);
  if (auth instanceof Response) return auth;

  // Sanity: key must belong to this stream
  if (!key.startsWith(`recordings/${streamId}/`)) {
    return errorJson('R2 key does not belong to this stream', 403, origin);
  }

  const buffer = await req.arrayBuffer();
  if (!buffer.byteLength) return errorJson('Empty part body', 400, origin);
  if (buffer.byteLength > MAX_PART_SIZE) return errorJson('Part too large', 413, origin);

  const multipart = env.RECORDINGS_BUCKET.resumeMultipartUpload(key, uploadId);
  const uploadedPart = await multipart.uploadPart(partNumber, buffer);

  console.log(`[${requestId}] live-part/upload key=${key} part=${partNumber} bytes=${buffer.byteLength}`);

  return okJson({ part_number: partNumber, etag: uploadedPart.etag }, origin);
}

export async function handleLivePartComplete(
  req: Request,
  env: Env,
  requestId: string,
  origin: string,
): Promise<Response> {
  const body = await req.json().catch(() => ({})) as {
    stream_id?: string;
    key?: string;
    upload_id?: string;
    parts?: Array<{ partNumber: number; etag: string }>;
  };
  const streamId = String(body.stream_id || '');
  const key = String(body.key || '');
  const uploadId = String(body.upload_id || '');
  const parts = Array.isArray(body.parts) ? body.parts : [];

  if (!key || !uploadId || parts.length === 0) {
    return errorJson('key, upload_id and non-empty parts[] are required', 400, origin);
  }

  const auth = await authorize(req, env, streamId, origin);
  if (auth instanceof Response) return auth;

  if (!key.startsWith(`recordings/${streamId}/`)) {
    return errorJson('R2 key does not belong to this stream', 403, origin);
  }

  const sorted = [...parts].sort((a, b) => a.partNumber - b.partNumber);
  const multipart = env.RECORDINGS_BUCKET.resumeMultipartUpload(key, uploadId);
  await multipart.complete(sorted);

  // HEAD to get final size
  const head = await env.RECORDINGS_BUCKET.head(key);
  const size = head?.size ?? 0;
  const url = `${env.RECORDING_PLAYBACK_BASE_URL.replace(/\/+$/, '')}/${key}`;

  console.log(`[${requestId}] live-part/complete key=${key} size=${size} parts=${parts.length}`);

  return okJson({ key, url, size }, origin);
}

export async function handleLivePartAbort(
  req: Request,
  env: Env,
  requestId: string,
  origin: string,
): Promise<Response> {
  const body = await req.json().catch(() => ({})) as { stream_id?: string; key?: string; upload_id?: string };
  const streamId = String(body.stream_id || '');
  const key = String(body.key || '');
  const uploadId = String(body.upload_id || '');
  if (!key || !uploadId) return errorJson('key and upload_id are required', 400, origin);

  const auth = await authorize(req, env, streamId, origin);
  if (auth instanceof Response) return auth;

  if (!key.startsWith(`recordings/${streamId}/`)) {
    return errorJson('R2 key does not belong to this stream', 403, origin);
  }

  try {
    const multipart = env.RECORDINGS_BUCKET.resumeMultipartUpload(key, uploadId);
    await multipart.abort();
  } catch (e) {
    console.warn(`[${requestId}] abort error:`, e);
  }
  return okJson({ ok: true }, origin);
}
