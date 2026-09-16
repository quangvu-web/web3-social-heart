/**
 * Agora Cloud Recording handlers for Cloudflare Worker.
 * Routes: /recording/acquire, /recording/start, /recording/stop, /recording/query
 */

import { Env, corsHeaders } from './cors';

interface AcquireRequest {
  channelName: string;
  uid: string;
  sessionId: string;
}

interface StartRequest {
  channelName: string;
  uid: string;
  token: string;
  sessionId: string;
  resourceId: string;
}

interface StopRequest {
  channelName: string;
  recordingUid: string;
  resourceId: string;
  sid: string;
  sessionId?: string;
}

type RecordingLifecycleStatus = 'ready' | 'pending' | 'failed';

interface NormalizedRecordingResult {
  status: RecordingLifecycleStatus;
  uploadingStatus: string | null;
  files: unknown[];
  mediaKey: string | null;
  mediaUrl: string | null;
  message?: string;
  rawAgoraResponse: unknown;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
}

interface RecordingRuntimeConfig {
  storageBucket: string;
  storageAccessKey: string;
  storageSecretKey: string;
  storageRegion: string;
  storageEndpoint: string;
  publicMediaBaseUrl: string;
  enableHeadFallback: boolean;
}

interface FileLike {
  fileName?: string;
  filename?: string;
  name?: string;
  objectName?: string;
  uploadingStatus?: string;
  status?: string;
}

function getEnv(env: Env, key: keyof Env): string {
  const value = env[key];
  return typeof value === 'string' ? value.trim() : '';
}

function getRuntimeConfig(env: Env): RecordingRuntimeConfig {
  const storageBucket = getEnv(env, 'REC_STORAGE_BUCKET') || getEnv(env, 'R2_BUCKET');
  const storageAccessKey = getEnv(env, 'REC_STORAGE_ACCESS_KEY') || getEnv(env, 'R2_ACCESS_KEY_ID');
  const storageSecretKey = getEnv(env, 'REC_STORAGE_SECRET_KEY') || getEnv(env, 'R2_SECRET_ACCESS_KEY');
  const storageRegion = getEnv(env, 'REC_STORAGE_REGION') || getEnv(env, 'R2_REGION') || 'auto';
  const storageEndpoint = getEnv(env, 'REC_R2_ENDPOINT') || getEnv(env, 'R2_ENDPOINT');
  const publicMediaBaseUrl = getEnv(env, 'PUBLIC_MEDIA_BASE_URL') || getEnv(env, 'RECORDING_PLAYBACK_BASE_URL');
  const enableHeadFallback = (getEnv(env, 'REC_ENABLE_HEAD_FALLBACK') || '').toLowerCase() === 'true';

  return {
    storageBucket,
    storageAccessKey,
    storageSecretKey,
    storageRegion,
    storageEndpoint,
    publicMediaBaseUrl,
    enableHeadFallback,
  };
}

function requireEnv(env: Env, requestId: string, origin: string): Response | null {
  const config = getRuntimeConfig(env);
  const required: Array<[string, string]> = [
    ['AGORA_APP_ID', getEnv(env, 'AGORA_APP_ID')],
    ['AGORA_CUSTOMER_ID', getEnv(env, 'AGORA_CUSTOMER_ID')],
    ['AGORA_CUSTOMER_SECRET', getEnv(env, 'AGORA_CUSTOMER_SECRET')],
    ['REC_STORAGE_BUCKET|R2_BUCKET', config.storageBucket],
    ['REC_STORAGE_ACCESS_KEY|R2_ACCESS_KEY_ID', config.storageAccessKey],
    ['REC_STORAGE_SECRET_KEY|R2_SECRET_ACCESS_KEY', config.storageSecretKey],
    ['REC_R2_ENDPOINT|R2_ENDPOINT', config.storageEndpoint],
    ['PUBLIC_MEDIA_BASE_URL|RECORDING_PLAYBACK_BASE_URL', config.publicMediaBaseUrl],
  ];

  for (const [name, value] of required) {
    if (!value) {
      return errorJson(requestId, 'missing_env', `Missing required env: ${name}`, 500, origin);
    }
  }
  return null;
}

function basicAuth(env: Env): string {
  return `Basic ${btoa(`${env.AGORA_CUSTOMER_ID}:${env.AGORA_CUSTOMER_SECRET}`)}`;
}

function validateApiKey(request: Request, env: Env): boolean {
  const key = request.headers.get('x-api-key');
  return !!key && key === env.API_KEY;
}

function successJson(requestId: string, data: Record<string, unknown>, origin: string): Response {
  return new Response(
    JSON.stringify({ ok: true, requestId, data }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    }
  );
}

function errorJson(
  requestId: string,
  code: string,
  message: string,
  status: number,
  origin: string,
  detail?: unknown,
  agoraCode?: unknown,
  agoraMessage?: unknown
): Response {
  return new Response(
    JSON.stringify({
      ok: false,
      requestId,
      error: {
        code,
        message,
        agoraCode,
        agoraMessage,
        detail,
      },
    }),
    {
      status,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    }
  );
}

function parseJsonSafe(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function fetchAgora(
  requestId: string,
  env: Env,
  method: 'GET' | 'POST',
  path: string,
  payload?: Record<string, unknown>
): Promise<{ status: number; body: unknown }> {
  const url = `https://api.agora.io/v1/apps/${env.AGORA_APP_ID}${path}`;
  console.log(`[${requestId}] agora ${method} ${url}`);

  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: basicAuth(env),
    },
    body: payload ? JSON.stringify(payload) : undefined,
  });

  const text = await response.text();
  const body = parseJsonSafe(text);

  const code = (body as { code?: unknown } | null)?.code;
  console.log(`[${requestId}] agora status=${response.status} code=${code ?? 'n/a'}`);
  return { status: response.status, body };
}

function parseFileList(raw: unknown): unknown[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      const trimmed = raw.trim();
      if (trimmed.length > 0) {
        return [{ fileName: trimmed }];
      }
      return [];
    }
  }
  if (typeof raw === 'object') {
    const nested = raw as Record<string, unknown>;
    const candidates = [nested.fileList, nested.files, nested.file_list];
    for (const candidate of candidates) {
      const parsed = parseFileList(candidate);
      if (parsed.length > 0) return parsed;
    }
  }
  return [];
}

function normalizeStatus(status: unknown): string | null {
  if (typeof status !== 'string') return null;
  const trimmed = status.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

function extractFileName(file: unknown): string | null {
  if (!file || typeof file !== 'object') return null;
  const candidate = file as FileLike;
  const fileName = candidate.fileName || candidate.filename || candidate.name || candidate.objectName;
  if (!fileName || typeof fileName !== 'string') return null;
  const trimmed = fileName.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function extractFileStatus(file: unknown): string | null {
  if (!file || typeof file !== 'object') return null;
  const candidate = file as FileLike;
  return normalizeStatus(candidate.uploadingStatus || candidate.status);
}

function selectPlayableFileName(fileList: unknown[]): string | null {
  const namedFiles = fileList
    .map(extractFileName)
    .filter((fileName): fileName is string => !!fileName);

  if (namedFiles.length === 0) return null;

  const lower = namedFiles.map((fileName) => ({ fileName, lower: fileName.toLowerCase() }));
  const hls = lower.find((entry) => entry.lower.endsWith('.m3u8'));
  const mp4 = lower.find((entry) => entry.lower.endsWith('.mp4'));
  return hls?.fileName || mp4?.fileName || namedFiles[0];
}

function buildMediaKey(fileName: string | null, sessionId?: string): string | null {
  if (!fileName) return null;
  const trimmed = fileName.replace(/^\/+/, '');
  if (!trimmed) return null;

  if (trimmed.includes('/')) {
    return trimmed;
  }

  if (sessionId) {
    return `funprofile/live/${sessionId}/${trimmed}`;
  }

  return trimmed;
}

function encodePath(path: string): string {
  return path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function buildMediaUrl(mediaKey: string | null, publicBaseUrl: string): string | null {
  if (!mediaKey || !publicBaseUrl) return null;
  try {
    const base = publicBaseUrl.replace(/\/+$/, '');
    const baseUrl = new URL(base);
    const basePath = baseUrl.pathname.replace(/^\/+|\/+$/g, '');
    let keyPath = mediaKey.replace(/^\/+/, '');

    if (basePath && keyPath.startsWith(`${basePath}/`)) {
      keyPath = keyPath.slice(basePath.length + 1);
    }

    return `${base}/${encodePath(keyPath)}`;
  } catch {
    return null;
  }
}

function resolveOverallStatus(globalUploadingStatus: string | null, fileStatuses: string[]): RecordingLifecycleStatus {
  if (globalUploadingStatus === 'uploaded') {
    if (fileStatuses.length === 0) return 'ready';
    return fileStatuses.every((status) => status === 'uploaded') ? 'ready' : 'pending';
  }

  if (globalUploadingStatus && globalUploadingStatus !== 'uploaded') {
    return 'pending';
  }

  if (fileStatuses.length === 0) {
    return 'pending';
  }

  return fileStatuses.every((status) => status === 'uploaded') ? 'ready' : 'pending';
}

function getDurationSeconds(body: unknown): number | null {
  if (!body || typeof body !== 'object') return null;
  const serverResponse = (body as Record<string, unknown>).serverResponse as Record<string, unknown> | undefined;
  const extensionServiceState = serverResponse?.extensionServiceState as Record<string, unknown> | undefined;
  const payload = extensionServiceState?.payload as Record<string, unknown> | undefined;
  const duration = payload?.durationMs;
  if (typeof duration === 'number') return Math.floor(duration / 1000);
  return null;
}

function getThumbnailUrl(mediaUrl: string | null): string | null {
  if (!mediaUrl) return null;
  const lastDot = mediaUrl.lastIndexOf('.');
  if (lastDot < 0) return null;
  return `${mediaUrl.slice(0, lastDot)}.jpg`;
}

async function checkMediaReadyByHead(mediaUrl: string | null): Promise<boolean> {
  if (!mediaUrl) return false;
  try {
    const response = await fetch(mediaUrl, { method: 'HEAD' });
    return response.status >= 200 && response.status < 300;
  } catch {
    return false;
  }
}

function hasStatusSignal(globalUploadingStatus: string | null, fileStatuses: string[]): boolean {
  return !!globalUploadingStatus || fileStatuses.length > 0;
}

async function normalizeRecordingResult(
  agoraBody: unknown,
  runtimeConfig: RecordingRuntimeConfig,
  sessionId?: string,
  alreadyGone = false
): Promise<NormalizedRecordingResult> {
  if (alreadyGone) {
    return {
      status: 'failed',
      uploadingStatus: null,
      files: [],
      mediaKey: null,
      mediaUrl: null,
      message: 'Recorder instance already gone before stop.',
      rawAgoraResponse: agoraBody,
      durationSeconds: null,
      thumbnailUrl: null,
    };
  }

  const root = (agoraBody && typeof agoraBody === 'object') ? (agoraBody as Record<string, unknown>) : {};
  const serverResponse = (root.serverResponse && typeof root.serverResponse === 'object')
    ? (root.serverResponse as Record<string, unknown>)
    : root;

  const files = parseFileList(serverResponse.fileList ?? root.fileList);

  const globalUploadingStatus = normalizeStatus(
    serverResponse.uploadingStatus ??
    root.uploadingStatus ??
    serverResponse.upload_status
  );

  const fileStatuses = files
    .map(extractFileStatus)
    .filter((status): status is string => !!status);

  let overallStatus = resolveOverallStatus(globalUploadingStatus, fileStatuses);

  const playableFileName = selectPlayableFileName(files);
  const mediaKey = buildMediaKey(playableFileName, sessionId);
  let mediaUrl = overallStatus === 'ready'
    ? buildMediaUrl(mediaKey, runtimeConfig.publicMediaBaseUrl)
    : null;

  const durationSeconds = getDurationSeconds(agoraBody);
  const thumbnailUrl = getThumbnailUrl(mediaUrl);

  const statusSignalPresent = hasStatusSignal(globalUploadingStatus, fileStatuses);
  if (!statusSignalPresent && runtimeConfig.enableHeadFallback) {
    const candidateUrl = buildMediaUrl(mediaKey, runtimeConfig.publicMediaBaseUrl);
    const readyByHead = await checkMediaReadyByHead(candidateUrl);
    if (readyByHead) {
      overallStatus = 'ready';
      mediaUrl = candidateUrl;
      return {
        status: 'ready',
        uploadingStatus: 'uploaded',
        files,
        mediaKey,
        mediaUrl,
        message: 'Ready detected by HEAD fallback check.',
        rawAgoraResponse: agoraBody,
        durationSeconds,
        thumbnailUrl: getThumbnailUrl(mediaUrl),
      };
    }

    return {
      status: 'pending',
      uploadingStatus: 'backuped',
      files,
      mediaKey,
      mediaUrl: null,
      message: 'Upload in progress. Poll query endpoint.',
      rawAgoraResponse: agoraBody,
      durationSeconds,
      thumbnailUrl: null,
    };
  }

  if (overallStatus === 'ready' && !mediaUrl) {
    return {
      status: 'pending',
      uploadingStatus: globalUploadingStatus,
      files,
      mediaKey,
      mediaUrl: null,
      message: 'Upload marked uploaded but playable file is not available yet.',
      rawAgoraResponse: agoraBody,
      durationSeconds,
      thumbnailUrl: null,
    };
  }

  if (overallStatus === 'pending') {
    return {
      status: 'pending',
      uploadingStatus: globalUploadingStatus || 'backuped',
      files,
      mediaKey,
      mediaUrl: null,
      message: 'Upload in progress. Poll query endpoint.',
      rawAgoraResponse: agoraBody,
      durationSeconds,
      thumbnailUrl: null,
    };
  }

  return {
    status: 'ready',
    uploadingStatus: 'uploaded',
    files,
    mediaKey,
    mediaUrl,
    rawAgoraResponse: agoraBody,
    durationSeconds,
    thumbnailUrl,
  };
}

export async function handleRecordingAcquire(request: Request, env: Env, requestId: string, origin: string): Promise<Response> {
  if (!validateApiKey(request, env)) {
    return errorJson(requestId, 'unauthorized', 'Missing or invalid API key', 401, origin);
  }

  const envErr = requireEnv(env, requestId, origin);
  if (envErr) return envErr;

  let body: AcquireRequest;
  try {
    body = await request.json() as AcquireRequest;
  } catch {
    return errorJson(requestId, 'bad_json', 'Invalid JSON payload', 400, origin);
  }

  if (!body.channelName || !body.uid || !body.sessionId) {
    return errorJson(requestId, 'invalid_input', 'channelName, uid, sessionId are required', 400, origin);
  }

  const payload = {
    cname: body.channelName,
    uid: body.uid,
    clientRequest: { resourceExpiredHour: 24 },
  };

  const agora = await fetchAgora(requestId, env, 'POST', '/cloud_recording/acquire', payload);
  const agoraBody = (agora.body && typeof agora.body === 'object') ? (agora.body as Record<string, unknown>) : {};

  if (agora.status < 200 || agora.status >= 300 || typeof agoraBody.resourceId !== 'string') {
    return errorJson(
      requestId,
      'agora_acquire_failed',
      'Agora acquire failed',
      502,
      origin,
      agora.body,
      agoraBody.code,
      agoraBody.message
    );
  }

  return successJson(requestId, {
    resourceId: agoraBody.resourceId,
    sessionId: body.sessionId,
  }, origin);
}

export async function handleRecordingStart(request: Request, env: Env, requestId: string, origin: string): Promise<Response> {
  if (!validateApiKey(request, env)) {
    return errorJson(requestId, 'unauthorized', 'Missing or invalid API key', 401, origin);
  }

  const envErr = requireEnv(env, requestId, origin);
  if (envErr) return envErr;

  let body: StartRequest;
  try {
    body = await request.json() as StartRequest;
  } catch {
    return errorJson(requestId, 'bad_json', 'Invalid JSON payload', 400, origin);
  }

  if (!body.channelName || !body.uid || !body.token || !body.sessionId || !body.resourceId) {
    return errorJson(requestId, 'invalid_input', 'channelName, uid, token, sessionId, resourceId are required', 400, origin);
  }

  const runtimeConfig = getRuntimeConfig(env);

  const storageConfig: Record<string, unknown> = {
    vendor: 11,
    region: String(runtimeConfig.storageRegion || 'auto'),
    bucket: runtimeConfig.storageBucket,
    accessKey: runtimeConfig.storageAccessKey,
    secretKey: runtimeConfig.storageSecretKey,
    fileNamePrefix: ['funprofile', 'live', body.sessionId],
    extensionParams: {
      endpoint: runtimeConfig.storageEndpoint,
    },
  };

  console.log(`[${requestId}] storageConfig vendor=11 bucket=${runtimeConfig.storageBucket} endpoint=${runtimeConfig.storageEndpoint} region=${runtimeConfig.storageRegion || 'auto'}`);

  const payload = {
    cname: body.channelName,
    uid: body.uid,
    clientRequest: {
      token: body.token,
      recordingConfig: {
        channelType: 1,
        streamTypes: 2,
        maxIdleTime: 120,
        videoStreamType: 0,
        transcodingConfig: {
          width: 1280,
          height: 720,
          fps: 15,
          bitrate: 1200,
          mixedVideoLayout: 1,
        },
      },
      storageConfig,
    },
  };

  const path = `/cloud_recording/resourceid/${body.resourceId}/mode/mix/start`;
  const agora = await fetchAgora(requestId, env, 'POST', path, payload);
  const agoraBody = (agora.body && typeof agora.body === 'object') ? (agora.body as Record<string, unknown>) : {};

  const serverResponse = (agoraBody.serverResponse && typeof agoraBody.serverResponse === 'object')
    ? (agoraBody.serverResponse as Record<string, unknown>)
    : {};

  console.log(`[${requestId}] agora start response sid=${String(agoraBody.sid || '')} uploadingStatus=${String(serverResponse.uploadingStatus || 'n/a')}`);

  if (agora.status < 200 || agora.status >= 300 || typeof agoraBody.sid !== 'string') {
    return errorJson(
      requestId,
      'agora_start_failed',
      'Agora start failed',
      502,
      origin,
      agora.body,
      agoraBody.code,
      agoraBody.message
    );
  }

  return successJson(requestId, {
    resourceId: body.resourceId,
    sid: agoraBody.sid,
    sessionId: body.sessionId,
    storageTarget: {
      bucket: runtimeConfig.storageBucket,
      endpoint: runtimeConfig.storageEndpoint,
      vendor: 11,
    },
  }, origin);
}

export async function handleRecordingStop(request: Request, env: Env, requestId: string, origin: string): Promise<Response> {
  if (!validateApiKey(request, env)) {
    return errorJson(requestId, 'unauthorized', 'Missing or invalid API key', 401, origin);
  }

  const envErr = requireEnv(env, requestId, origin);
  if (envErr) return envErr;

  let body: StopRequest;
  try {
    body = await request.json() as StopRequest;
  } catch {
    return errorJson(requestId, 'bad_json', 'Invalid JSON payload', 400, origin);
  }

  if (!body.channelName || !body.recordingUid || !body.resourceId || !body.sid) {
    return errorJson(requestId, 'invalid_input', 'channelName, recordingUid, resourceId, sid are required', 400, origin);
  }

  const payload = {
    cname: body.channelName,
    uid: body.recordingUid,
    clientRequest: {},
  };

  const path = `/cloud_recording/resourceid/${body.resourceId}/sid/${body.sid}/mode/mix/stop`;
  const agora = await fetchAgora(requestId, env, 'POST', path, payload);

  const agoraBody = (agora.body && typeof agora.body === 'object') ? (agora.body as Record<string, unknown>) : {};
  const serverResponse = (agoraBody.serverResponse && typeof agoraBody.serverResponse === 'object')
    ? (agoraBody.serverResponse as Record<string, unknown>)
    : {};

  console.log(`[${requestId}] agora stop response uploadingStatus=${String(serverResponse.uploadingStatus || 'n/a')}`);

  const alreadyGone = agora.status === 404 && agoraBody.code === 404;
  if ((agora.status < 200 || agora.status >= 300) && !alreadyGone) {
    return errorJson(
      requestId,
      'agora_stop_failed',
      'Agora stop failed',
      502,
      origin,
      agora.body,
      agoraBody.code,
      agoraBody.message
    );
  }

  const runtimeConfig = getRuntimeConfig(env);
  const normalized = await normalizeRecordingResult(agora.body, runtimeConfig, body.sessionId, alreadyGone);

  return successJson(requestId, {
    status: normalized.status,
    uploadingStatus: normalized.uploadingStatus,
    files: normalized.files,
    mediaKey: normalized.mediaKey,
    mediaUrl: normalized.mediaUrl,
    message: normalized.message,
    durationSeconds: normalized.durationSeconds,
    thumbnailUrl: normalized.thumbnailUrl,
    rawAgoraResponse: normalized.rawAgoraResponse,
  }, origin);
}

export async function handleRecordingQuery(request: Request, env: Env, requestId: string, origin: string): Promise<Response> {
  if (!validateApiKey(request, env)) {
    return errorJson(requestId, 'unauthorized', 'Missing or invalid API key', 401, origin);
  }

  const envErr = requireEnv(env, requestId, origin);
  if (envErr) return envErr;

  const url = new URL(request.url);
  const resourceId = (url.searchParams.get('resourceId') || '').trim();
  const sid = (url.searchParams.get('sid') || '').trim();
  const mode = (url.searchParams.get('mode') || 'mix').trim() || 'mix';
  const sessionId = (url.searchParams.get('sessionId') || '').trim();

  if (!resourceId || !sid) {
    return errorJson(requestId, 'invalid_input', 'resourceId and sid are required', 400, origin);
  }

  const path = `/cloud_recording/resourceid/${resourceId}/sid/${sid}/mode/${mode}/query`;
  const agora = await fetchAgora(requestId, env, 'GET', path);

  const agoraBody = (agora.body && typeof agora.body === 'object') ? (agora.body as Record<string, unknown>) : {};

  if (agora.status < 200 || agora.status >= 300) {
    return errorJson(
      requestId,
      'agora_query_failed',
      'Agora query failed',
      502,
      origin,
      agora.body,
      agoraBody.code,
      agoraBody.message
    );
  }

  const runtimeConfig = getRuntimeConfig(env);
  const normalized = await normalizeRecordingResult(agora.body, runtimeConfig, sessionId || undefined, false);

  return successJson(requestId, {
    status: normalized.status,
    uploadingStatus: normalized.uploadingStatus,
    files: normalized.files,
    mediaKey: normalized.mediaKey,
    mediaUrl: normalized.mediaUrl,
    message: normalized.message,
    durationSeconds: normalized.durationSeconds,
    thumbnailUrl: normalized.thumbnailUrl,
    rawAgoraResponse: normalized.rawAgoraResponse,
  }, origin);
}
