import { supabase } from '@/integrations/supabase/client';
import { uploadVideoToR2 } from '@/utils/r2Upload';
import type { CreateLiveSessionInput, LiveSession } from './types';

const db = supabase;

const LIVE_POST_DEFAULT_CONTENT = 'Dang LIVE tren FUN Profile';
const WORKER_URL = import.meta.env.VITE_AGORA_WORKER_URL || 'https://fun-agora-rtc-token.hieu-le-010.workers.dev';

const buildChannelName = (userId: string) => `live_${userId}_${Date.now()}`;

const uuidToNumericUid = (uuid: string) => {
  let hash = 0;
  for (let i = 0; i < uuid.length; i++) {
    const char = uuid.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash) || 10001;
};

interface UploadLiveRecordingResult {
  key: string;
  url: string;
}

export type RecordingStatus =
  | 'idle'
  | 'acquiring'
  | 'starting'
  | 'recording'
  | 'stopping'
  | 'uploading'
  | 'queued'
  | 'processing'
  | 'ready'
  | 'failed'
  | 'stopped';

export interface FinalizeLiveSessionOptions {
  playbackUrl?: string | null;
  recordingStatus?: RecordingStatus;
}

type LivePostMetadata = {
  live_title?: string | null;
  live_status?: 'live' | 'ended';
  channel_name?: string | null;
  agora_channel?: string | null;
  live_session_id?: string | null;
  viewer_count?: number;
  ended_at?: string | null;
  playback_url?: string | null;
  [key: string]: unknown;
};

type RawLiveSessionRow = {
  id: string;
  user_id?: string | null;
  host_user_id?: string | null;
  owner_id?: string | null;
  agora_channel?: string | null;
  channel_name: string;
  mode?: string | null;
  source?: string | null;
  live_mode?: string | null;
  stream_provider?: string | null;
  stream_key?: string | null;
  rtmps_url?: string | null;
  playback_url?: string | null;
  cloudflare_live_input_id?: string | null;
  cloudflare_video_uid?: string | null;
  replay_url?: string | null;
  thumbnail_url?: string | null;
  error_message?: string | null;
  duration_seconds?: number | null;
  rtmp_status?: string | null;
  rtmp_started_at?: string | null;
  rtmp_ended_at?: string | null;
  hls_url?: string | null;
  hls_playback_url?: string | null;
  agora_uid_host?: number | null;
  recording_uid?: number | null;
  recording_status?: string | null;
  archive_status?: string | null;
  storage_provider?: string | null;
  playback_provider?: string | null;
  r2_video_url?: string | null;
  title?: string | null;
  description?: string | null;
  privacy: string;
  status: string;
  viewer_count?: number | null;
  started_at: string;
  ended_at?: string | null;
  created_at: string;
  updated_at: string;
  post_id?: string | null;
  host_profile?: LiveSession['host_profile'];
};

export interface WebcamLiveStartResult {
  sessionId: string;
  channel: string;
  token: string;
  uid: string | number;
  appId: string;
  expiresAt?: number;
  recordingStatus?: RecordingStatus;
  recordingAvailable?: boolean;
  fallbackRecordingRecommended?: boolean;
  fallbackProvider?: 'browser' | null;
  recordingErrorCode?: string | null;
  recordingErrorMessage?: string | null;
}

export interface WebcamRecordingStartResult {
  resourceId?: string | null;
  sid?: string | null;
  recordingAvailable: boolean;
  fallbackRecordingRecommended?: boolean;
  fallbackProvider?: 'browser' | null;
  recordingErrorCode?: string | null;
  recordingErrorMessage?: string | null;
  duplicate?: boolean;
}

export interface WebcamLiveStatus {
  sessionId: string;
  status: LiveSession['status'];
  replay_url: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  error_message: string | null;
  ended?: boolean;
  end_reason?: string | null;
  recording_provider?: 'agora' | 'browser' | 'none' | null;
  recording_status?: string | null;
  recording_error_code?: string | null;
  browser_recording_status?: string | null;
  browser_recording_chunk_count?: number;
  browser_recording_total_bytes?: number;
}

export type LiveHeartbeatClientState = 'live' | 'reconnecting' | 'background' | 'closing';
export type LiveHeartbeatDeviceType = 'desktop' | 'mobile';
export type LiveHeartbeatSourceType = 'webcam' | 'mobile' | 'obs';

export interface LiveHeartbeatInput {
  sessionId: string;
  userId?: string | null;
  agoraChannelName?: string | null;
  clientState?: LiveHeartbeatClientState;
  deviceType?: LiveHeartbeatDeviceType;
  sourceType?: LiveHeartbeatSourceType;
  timestamp?: string;
  mediaActive?: boolean;
  hasAudio?: boolean;
  hasVideo?: boolean;
}

export interface LiveHeartbeatResult {
  ok: boolean;
  status: LiveSession['status'];
  client_state: LiveHeartbeatClientState;
  ended: boolean;
  end_reason?: string | null;
}

async function getFunctionErrorMessage(error: unknown): Promise<string> {
  const fallback = error instanceof Error ? error.message : 'Edge Function request failed';
  const context = (error as { context?: unknown } | null)?.context;
  if (!context || typeof context !== 'object') return fallback;

  const response = context as Response;
  try {
    const cloned = typeof response.clone === 'function' ? response.clone() : response;
    if (typeof cloned.json === 'function') {
      const body = await cloned.json();
      const message =
        typeof body?.error === 'string' ? body.error :
        typeof body?.message === 'string' ? body.message :
        typeof body?.detail === 'string' ? body.detail :
        '';
      if (message) return message;
    }
  } catch {
    // Try text fallback below.
  }

  try {
    const cloned = typeof response.clone === 'function' ? response.clone() : response;
    if (typeof cloned.text === 'function') {
      const text = await cloned.text();
      if (text) return text.slice(0, 500);
    }
  } catch {
    // Use fallback.
  }

  return fallback;
}

async function throwFunctionError(error: unknown): Promise<never> {
  throw new Error(await getFunctionErrorMessage(error));
}

function ensureWorkerUrl(): string {
  if (!WORKER_URL) {
    throw new Error('VITE_AGORA_WORKER_URL is missing');
  }
  return WORKER_URL.replace(/\/+$/, '');
}

async function mergeLivePostMetadata(postId: string, patch: Partial<LivePostMetadata>): Promise<void> {
  const { data: existingPost } = await db
    .from('posts')
    .select('metadata')
    .eq('id', postId)
    .maybeSingle();

  const existing = (existingPost?.metadata || {}) as LivePostMetadata;

  await db
    .from('posts')
    .update({
      metadata: {
        ...existing,
        ...patch,
      } as never,
    })
    .eq('id', postId);
}

function normalizeLiveSession(row: RawLiveSessionRow): LiveSession {
  return {
    id: row.id,
    host_user_id: row.host_user_id || row.user_id || row.owner_id,
    agora_channel: row.agora_channel || row.channel_name,
    channel_name: row.channel_name,
    mode: ((row.mode === 'agora' ? 'agora_webcam' : row.mode) ?? null) as LiveSession['mode'],
    source: (row.source || 'agora') as LiveSession['source'],
    live_mode: (row.live_mode || (row.source === 'rtmp' ? 'rtmp' : 'webcam')) as LiveSession['live_mode'],
    stream_provider: (row.stream_provider || (row.source === 'rtmp' ? 'nginx_rtmp' : 'agora')) as LiveSession['stream_provider'],
    stream_key: row.stream_key ?? null,
    rtmps_url: row.rtmps_url ?? null,
    playback_url: row.playback_url ?? null,
    cloudflare_live_input_id: row.cloudflare_live_input_id ?? null,
    cloudflare_video_uid: row.cloudflare_video_uid ?? null,
    replay_url: row.replay_url ?? null,
    thumbnail_url: row.thumbnail_url ?? null,
    error_message: row.error_message ?? null,
    duration_seconds: row.duration_seconds ?? null,
    rtmp_status: (row.rtmp_status ?? null) as LiveSession['rtmp_status'],
    rtmp_started_at: row.rtmp_started_at ?? null,
    rtmp_ended_at: row.rtmp_ended_at ?? null,
    hls_url: row.hls_url ?? null,
    hls_playback_url: row.hls_playback_url ?? null,
    agora_uid_host: row.agora_uid_host ?? null,
    recording_uid: row.recording_uid ?? null,
    recording_status: (row.recording_status ?? null) as LiveSession['recording_status'],
    archive_status: (row.archive_status ?? null) as LiveSession['archive_status'],
    storage_provider: (row.storage_provider ?? null) as LiveSession['storage_provider'],
    playback_provider: (row.playback_provider ?? null) as LiveSession['playback_provider'],
    r2_video_url: row.r2_video_url ?? null,
    title: row.title ?? null,
    description: row.description ?? null,
    privacy: row.privacy as LiveSession['privacy'],
    status: row.status as LiveSession['status'],
    viewer_count: row.viewer_count ?? 0,
    started_at: row.started_at,
    ended_at: row.ended_at ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    post_id: row.post_id ?? null,
    host_profile: row.host_profile
      ? {
          username: row.host_profile.username ?? null,
          full_name: row.host_profile.full_name ?? null,
          avatar_url: row.host_profile.avatar_url ?? null,
        }
      : null,
  };
}

export async function startWebcamLiveSession(input: CreateLiveSessionInput): Promise<WebcamLiveStartResult> {
  const { data, error } = await supabase.functions.invoke('live-webcam-start', {
    body: {
      title: input.title ?? '',
      privacy: input.privacy,
    },
  });
  if (error) await throwFunctionError(error);
  if (!data?.sessionId || !data?.channel || !data?.token || !data?.appId) {
    throw new Error('Invalid live-webcam-start response');
  }
  return data as WebcamLiveStartResult;
}

export async function stopWebcamLiveSession(sessionId: string): Promise<void> {
  const { error } = await supabase.functions.invoke('live-webcam-stop', {
    body: { sessionId },
  });
  if (error) await throwFunctionError(error);
}

export async function startWebcamCloudRecording(input: {
  sessionId: string;
  channelName?: string | null;
  hasAudio: boolean;
  hasVideo: boolean;
}): Promise<WebcamRecordingStartResult> {
  const { data, error } = await supabase.functions.invoke('live-recording-start', {
    body: {
      sessionId: input.sessionId,
      channelName: input.channelName ?? undefined,
      mediaReady: input.hasAudio || input.hasVideo,
      hasAudio: input.hasAudio,
      hasVideo: input.hasVideo,
      mode: 'mix',
    },
  });
  if (error) await throwFunctionError(error);
  return data as WebcamRecordingStartResult;
}

export async function getWebcamLiveStatus(sessionId: string): Promise<WebcamLiveStatus> {
  const { data, error } = await supabase.functions.invoke('live-webcam-status', {
    body: { sessionId },
  });
  if (error) await throwFunctionError(error);
  return data as WebcamLiveStatus;
}

export async function sendWebcamLiveHeartbeat(input: string | LiveHeartbeatInput): Promise<LiveHeartbeatResult> {
  const payload: LiveHeartbeatInput = typeof input === 'string' ? { sessionId: input } : input;
  const { data, error } = await supabase.functions.invoke('live-webcam-heartbeat', {
    body: {
      live_session_id: payload.sessionId,
      user_id: payload.userId ?? undefined,
      agora_channel_name: payload.agoraChannelName ?? undefined,
      timestamp: payload.timestamp ?? new Date().toISOString(),
      client_state: payload.clientState ?? 'live',
      device_type: payload.deviceType ?? 'desktop',
      source_type: payload.sourceType ?? 'webcam',
      media_active: payload.mediaActive ?? undefined,
      has_audio: payload.hasAudio ?? undefined,
      has_video: payload.hasVideo ?? undefined,
    },
  });
  if (error) await throwFunctionError(error);
  return data as LiveHeartbeatResult;
}

export async function sendWebcamLiveHeartbeatBeacon(input: LiveHeartbeatInput): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl || !accessToken) return false;

  const body = JSON.stringify({
    live_session_id: input.sessionId,
    user_id: input.userId ?? undefined,
    agora_channel_name: input.agoraChannelName ?? undefined,
    timestamp: input.timestamp ?? new Date().toISOString(),
    client_state: input.clientState ?? 'closing',
    device_type: input.deviceType ?? 'desktop',
    source_type: input.sourceType ?? 'webcam',
    media_active: input.mediaActive ?? undefined,
    has_audio: input.hasAudio ?? undefined,
    has_video: input.hasVideo ?? undefined,
    access_token: accessToken,
  });
  const url = `${supabaseUrl.replace(/\/+$/, '')}/functions/v1/live-webcam-heartbeat`;

  try {
    const keepalive = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '',
      },
      body,
      keepalive: true,
    });
    if (keepalive.ok) return true;
  } catch {
    // Try sendBeacon below.
  }

  if (!navigator.sendBeacon) return false;
  return navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
}

export interface BrowserRecordingUploadInput {
  liveSessionId: string;
  postId?: string | null;
  chunkIndex: number;
  chunk: Blob;
  mimeType: string;
  durationMs?: number | null;
}

export interface BrowserRecordingUploadResult {
  success: boolean;
  r2_key: string;
  size_bytes: number;
  chunk_index: number;
}

export async function uploadBrowserRecordingChunk(input: BrowserRecordingUploadInput): Promise<BrowserRecordingUploadResult> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Bạn cần đăng nhập để upload replay dự phòng.');

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) throw new Error('VITE_SUPABASE_URL is missing');

  const headers = new Headers({
    Authorization: `Bearer ${token}`,
    apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '',
    'Content-Type': input.mimeType || input.chunk.type || 'video/webm',
    'x-live-session-id': input.liveSessionId,
    'x-chunk-index': String(input.chunkIndex),
    'x-mime-type': input.mimeType || input.chunk.type || 'video/webm',
  });
  if (input.postId) headers.set('x-post-id', input.postId);
  if (typeof input.durationMs === 'number') headers.set('x-duration-ms', String(Math.max(0, Math.round(input.durationMs))));

  const response = await fetch(`${supabaseUrl.replace(/\/+$/, '')}/functions/v1/live-browser-recording-upload`, {
    method: 'PUT',
    headers,
    body: input.chunk,
  });

  if (!response.ok) {
    let message = `Browser recording upload failed (${response.status})`;
    try {
      const body = await response.json();
      if (typeof body?.error === 'string') message = body.error;
    } catch {
      const text = await response.text().catch(() => '');
      if (text) message = text.slice(0, 500);
    }
    throw new Error(message);
  }

  return response.json() as Promise<BrowserRecordingUploadResult>;
}

export async function updateBrowserRecordingStatus(input: {
  liveSessionId: string;
  status: 'recording' | 'uploading' | 'uploaded' | 'failed';
  warning?: string | null;
  errorMessage?: string | null;
}): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Bạn cần đăng nhập để cập nhật trạng thái ghi dự phòng.');

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) throw new Error('VITE_SUPABASE_URL is missing');

  const response = await fetch(`${supabaseUrl.replace(/\/+$/, '')}/functions/v1/live-browser-recording-upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      live_session_id: input.liveSessionId,
      browser_recording_status: input.status,
      warning: input.warning ?? null,
      error_message: input.errorMessage ?? null,
    }),
  });

  if (!response.ok) {
    let message = `Browser recording status update failed (${response.status})`;
    try {
      const body = await response.json();
      if (typeof body?.error === 'string') message = body.error;
    } catch {
      // Keep fallback message.
    }
    throw new Error(message);
  }
}

export async function uploadLiveThumbnail(
  thumbnailBlob: Blob,
  liveSessionId: string
): Promise<string | null> {
  try {
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData?.user?.id;
    if (!userId) {
      console.warn('[liveService] uploadLiveThumbnail: no authenticated user');
      return null;
    }
    const path = `${userId}/${liveSessionId}/thumbnail.jpg`;
    const { error } = await supabase.storage
      .from('live-thumbnails')
      .upload(path, thumbnailBlob, {
        contentType: 'image/jpeg',
        upsert: true,
      });
    if (error) {
      console.warn('[liveService] uploadLiveThumbnail error:', error);
      return null;
    }
    const { data } = supabase.storage.from('live-thumbnails').getPublicUrl(path);
    return data.publicUrl;
  } catch (err) {
    console.warn('[liveService] uploadLiveThumbnail exception:', err);
    return null;
  }
}

export async function attachLiveReplayToPost(
  sessionId: string,
  playbackUrl: string,
  durationSeconds?: number,
  thumbnailUrl?: string | null
): Promise<void> {
  const { error } = await db.rpc('attach_live_replay_to_post', {
    _session_id: sessionId,
    _playback_url: playbackUrl,
    _duration_seconds: durationSeconds,
    _thumbnail_url: thumbnailUrl,
  });
  if (error) throw error;
}

export async function createLiveSession(input: CreateLiveSessionInput): Promise<LiveSession> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    throw new Error('Ban can dang nhap de bat dau live');
  }

  const userId = session.user.id;
  const hostUid = uuidToNumericUid(userId);
  const title = input.title?.trim() || '';
  const channelName = buildChannelName(userId);
  const visibility = input.privacy === 'friends' ? 'friends' : 'public';

  let postId: string | null = null;

  try {
    const { data: post, error: postError } = await db
      .from('posts')
      .insert({
        user_id: userId,
        content: title || LIVE_POST_DEFAULT_CONTENT,
        visibility,
        post_type: 'live',
        metadata: {
          live_title: title,
          live_status: 'live',
          live_mode: 'webcam',
          stream_provider: 'agora',
          channel_name: channelName,
          agora_channel: channelName,
          viewer_count: 0,
        },
      })
      .select('id')
      .single();

    if (postError) throw postError;
    postId = post.id;

    const { data, error } = await db
      .from('live_sessions')
      .insert({
        host_user_id: userId,
        owner_id: userId,
        channel_name: channelName,
        agora_channel: channelName,
        source: 'agora',
        mode: 'agora_webcam',
        live_mode: 'webcam',
        stream_provider: 'agora',
        agora_uid_host: hostUid,
        title,
        privacy: input.privacy,
        status: 'live',
        recording_status: 'idle',
        archive_status: 'pending',
        post_id: postId,
      })
      .select(
        `
        id, host_user_id, agora_channel, channel_name, mode, source, live_mode, stream_provider,
        playback_url, cloudflare_live_input_id, cloudflare_video_uid, rtmp_status,
        rtmp_started_at, rtmp_ended_at, hls_url, hls_playback_url, recording_status, archive_status,
        storage_provider, playback_provider, r2_video_url, title, description, privacy, status, viewer_count,
        started_at, ended_at, created_at, updated_at, post_id,
        host_profile:profiles!live_sessions_host_user_id_fkey(username, full_name, avatar_url)
      `
      )
      .single();

    if (error) throw error;

    await db
      .from('posts')
      .update({
        metadata: {
          live_title: title,
          live_status: 'live',
          live_mode: 'webcam',
          stream_provider: 'agora',
          channel_name: channelName,
          agora_channel: channelName,
          live_session_id: data.id,
          viewer_count: 0,
        },
      })
      .eq('id', postId);

    return normalizeLiveSession(data);
  } catch (error) {
    if (postId) {
      await db.from('posts').delete().eq('id', postId);
    }
    throw error;
  }
}

export async function getLiveSession(sessionId: string): Promise<LiveSession | null> {
  const { data, error } = await db
    .from('live_sessions')
    .select(
      `
      id, host_user_id, agora_channel, channel_name, mode, source, live_mode, stream_provider,
      playback_url, cloudflare_live_input_id, cloudflare_video_uid, rtmp_status,
      rtmp_started_at, rtmp_ended_at, hls_url, hls_playback_url, recording_uid, recording_status, archive_status,
      storage_provider, playback_provider, r2_video_url, replay_url, thumbnail_url, error_message, duration_seconds,
      title, description, privacy, status, viewer_count,
      started_at, ended_at, created_at, updated_at, post_id,
      host_profile:profiles!live_sessions_host_user_id_fkey(username, full_name, avatar_url)
    `
    )
    .eq('id', sessionId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return normalizeLiveSession(data);
}

export async function listActiveLiveSessions(): Promise<LiveSession[]> {
  const { data, error } = await db
    .from('live_sessions')
    .select(
      `
      id, host_user_id, agora_channel, channel_name, mode, source, live_mode, stream_provider,
      playback_url, cloudflare_live_input_id, cloudflare_video_uid, rtmp_status,
      rtmp_started_at, rtmp_ended_at, hls_url, hls_playback_url, recording_status, archive_status,
      storage_provider, playback_provider, r2_video_url, replay_url, thumbnail_url, error_message, duration_seconds,
      title, description, privacy, status, viewer_count,
      started_at, ended_at, created_at, updated_at, post_id,
      host_profile:profiles!live_sessions_host_user_id_fkey(username, full_name, avatar_url)
    `
    )
    .eq('status', 'live')
    .order('started_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(normalizeLiveSession);
}

export async function endLiveSession(sessionId: string): Promise<void> {
  await finalizeLiveSession(sessionId, { recordingStatus: 'failed' });
}

export async function updateLiveRecordingStatus(
  sessionId: string,
  recordingStatus: RecordingStatus,
  recordingError?: string | null
): Promise<void> {
  const nowIso = new Date().toISOString();
  const { error } = await db
    .from('live_sessions')
    .update({
      recording_status: recordingStatus,
      recording_error: recordingError ?? null,
      updated_at: nowIso,
    })
    .eq('id', sessionId);

  if (error) throw error;
}

export async function finalizeLiveSession(
  sessionId: string,
  options: FinalizeLiveSessionOptions = {}
): Promise<void> {
  const { playbackUrl = null, recordingStatus = playbackUrl ? 'ready' : 'failed' } = options;
  const nowIso = new Date().toISOString();

  // Step 1: update only — do NOT chain .select() (memory rule)
  const { error: updErr } = await db
    .from('live_sessions')
    .update({
      status: 'ended',
      ended_at: nowIso,
      recording_status: recordingStatus,
      updated_at: nowIso,
    })
    .eq('id', sessionId);

  if (updErr) throw updErr;

  // Step 2: fetch row separately with maybeSingle to handle race conditions
  // (e.g. webhook may have already advanced the row, or row may not exist)
  const { data } = await db
    .from('live_sessions')
    .select('id, post_id, title, agora_channel, channel_name, ended_at')
    .eq('id', sessionId)
    .maybeSingle();

  if (!data) return; // session not found — exit gracefully, no error

  if (data.post_id) {
    await mergeLivePostMetadata(data.post_id, {
      live_session_id: data.id,
      live_title: data.title,
      channel_name: data.agora_channel || data.channel_name,
      agora_channel: data.agora_channel || data.channel_name,
      live_status: 'ended',
      live_mode: 'webcam',
      stream_provider: 'agora',
      ended_at: data.ended_at,
      playback_url: playbackUrl,
      replay_status: recordingStatus,
      playback_type: playbackUrl ? 'chunked' : 'cloudflare_stream',
    });

    if (playbackUrl) {
      await db.from('posts')
        .update({ video_url: playbackUrl })
        .eq('id', data.post_id);
    }
  }
}

export async function updateLiveViewerCount(sessionId: string, viewerCount: number): Promise<void> {
  const nextCount = Math.max(0, viewerCount);
  // CHỈ update live_sessions.viewer_count (source of truth).
  // KHÔNG rewrite posts.metadata mỗi lần viewer đổi — trước đây điều này tạo ~140k
  // UPDATE posts trong 7 ngày → phát broadcast realtime + đốt băng thông Cloud.
  // posts.metadata (live_status, channel_name...) chỉ đổi khi status live/ended thay đổi,
  // và đã được ghi ở start (startWebcamLiveSession) và end (finalizeLiveSession).
  // Viewer count trên feed nên đọc từ live_sessions.viewer_count qua join, không đọc metadata.
  await db
    .from('live_sessions')
    .update({ viewer_count: nextCount })
    .eq('id', sessionId);
}

export async function incrementLiveViewerCount(sessionId: string): Promise<void> {
  await db.rpc('increment_live_viewer_count', { session_id: sessionId });
}

export async function decrementLiveViewerCount(sessionId: string): Promise<void> {
  await db.rpc('decrement_live_viewer_count', { session_id: sessionId });
}

export async function uploadLiveRecording(
  blob: Blob,
  liveSessionId: string,
  mimeType: string,
  onProgress?: (percent: number) => void
): Promise<UploadLiveRecordingResult> {
  const extension = mimeType.includes('webm') ? 'webm' : 'mp4';
  const filename = `live-${liveSessionId}-${Date.now()}.${extension}`;
  const file = new File([blob], filename, { type: mimeType });

  const result = await uploadVideoToR2(
    file,
    onProgress
      ? (p) => onProgress(p.percentage)
      : undefined
  );

  return { key: result.key, url: result.publicUrl };
}

export async function saveLiveReplay(liveSessionId: string, playbackUrl?: string | null): Promise<void> {
  await finalizeLiveSession(liveSessionId, {
    playbackUrl: playbackUrl || null,
    recordingStatus: playbackUrl ? 'ready' : 'failed',
  });
}
