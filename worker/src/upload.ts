import { Env, corsHeaders } from './cors';

const MAX_UPLOAD_SIZE_BYTES = 100 * 1024 * 1024; // 100MB
const ALLOWED_VIDEO_TYPES = new Set([
  'video/webm',
  'video/webm;codecs=vp8,opus',
  'video/mp4',
]);

interface SupabaseUser {
  id: string;
}

function errorJson(message: string, status: number, origin: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin),
    },
  });
}

function okJson(payload: Record<string, unknown>, origin: string): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin),
    },
  });
}

async function verifySupabaseUser(authHeader: string, env: Env): Promise<SupabaseUser | null> {
  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    method: 'GET',
    headers: {
      Authorization: authHeader,
      apikey: env.SUPABASE_ANON_KEY,
    },
  });

  if (!response.ok) return null;
  const user = (await response.json()) as SupabaseUser;
  if (!user?.id) return null;
  return user;
}

async function isHostOfSession(streamId: string, userId: string, authHeader: string, env: Env): Promise<boolean> {
  const query = new URL(`${env.SUPABASE_URL}/rest/v1/live_sessions`);
  query.searchParams.set('select', 'id');
  query.searchParams.set('id', `eq.${streamId}`);
  query.searchParams.set('or', `(host_user_id.eq.${userId},owner_id.eq.${userId})`);
  query.searchParams.set('limit', '1');

  const response = await fetch(query.toString(), {
    method: 'GET',
    headers: {
      Authorization: authHeader,
      apikey: env.SUPABASE_ANON_KEY,
    },
  });

  if (!response.ok) return false;
  const rows = (await response.json()) as Array<{ id: string }>;
  return Array.isArray(rows) && rows.length > 0;
}

function sanitizeFilename(raw: string | null): string {
  const fallback = 'recording.webm';
  if (!raw) return fallback;
  const safe = raw.replace(/[^a-zA-Z0-9._-]/g, '_');
  if (!safe || safe.startsWith('.')) return fallback;
  return safe;
}

function isSupportedVideoType(contentType: string): boolean {
  const normalized = contentType.toLowerCase();
  if (ALLOWED_VIDEO_TYPES.has(normalized)) return true;
  return normalized.startsWith('video/webm') || normalized.startsWith('video/mp4');
}

export async function handleLiveRecordingUpload(
  request: Request,
  env: Env,
  requestId: string,
  origin: string
): Promise<Response> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return errorJson('Missing or invalid Authorization header', 401, origin);
  }

  const streamId = request.headers.get('X-Stream-Id');
  if (!streamId) {
    return errorJson('Missing X-Stream-Id', 400, origin);
  }

  const contentType = request.headers.get('Content-Type') || '';
  if (!contentType || !isSupportedVideoType(contentType)) {
    return errorJson('Unsupported Content-Type', 400, origin);
  }

  const user = await verifySupabaseUser(authHeader, env);
  if (!user) {
    return errorJson('Invalid JWT', 401, origin);
  }

  const ownsSession = await isHostOfSession(streamId, user.id, authHeader, env);
  if (!ownsSession) {
    return errorJson('Forbidden: session does not belong to user', 403, origin);
  }

  const bodyBuffer = await request.arrayBuffer();
  if (!bodyBuffer.byteLength) {
    return errorJson('Empty upload body', 400, origin);
  }
  if (bodyBuffer.byteLength > MAX_UPLOAD_SIZE_BYTES) {
    return errorJson('Uploaded file too large', 413, origin);
  }

  const filename = sanitizeFilename(request.headers.get('X-Filename'));
  const key = `recordings/${streamId}/${Date.now()}-${filename}`;
  await env.RECORDINGS_BUCKET.put(key, bodyBuffer, {
    httpMetadata: {
      contentType,
    },
  });

  const url = `${env.RECORDING_PLAYBACK_BASE_URL.replace(/\/+$/, '')}/${key}`;
  console.log(`[${requestId}] upload/live-recording stored key=${key} user=${user.id}`);

  return okJson({ ok: true, key, url }, origin);
}
