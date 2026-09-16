import { supabase } from '@/integrations/supabase/client';
import type { RtmpStatus } from './types';

export type RtmpProducerStatus =
  | 'waiting_for_obs'
  | 'source_connected'
  | 'ready_to_go_live'
  | 'live'
  | 'ended'
  | 'processing'
  | 'archiving'
  | 'posted'
  | 'failed';

type RtmpLiveResponse = {
  live_session_id: string;
  stream_key: string | null;
  rtmp_url: string | null;
  rtmps_url?: string | null;
  hls_url: string;
  status: RtmpStatus;
  app_status?: RtmpProducerStatus;
  live_mode?: 'rtmp' | 'rtmp_obs';
  mode?: 'rtmp_obs';
  stream_provider?: 'nginx_rtmp' | 'cloudflare_stream';
  cloudflare_live_input_id?: string | null;
  title?: string | null;
  description?: string | null;
  source_connected_at?: string | null;
  go_live_clicked_at?: string | null;
  live_post_id?: string | null;
  replay_post_id?: string | null;
  rtmp_started_at?: string | null;
  started_at?: string | null;
  recording_status?: string | null;
  archive_status?: string | null;
};

export type RtmpLiveStatus = {
  live_session_id: string;
  stream_key?: string | null;
  status: RtmpStatus;
  hls_url: string | null;
  app_status: RtmpProducerStatus;
  title?: string | null;
  description?: string | null;
  source_connected_at?: string | null;
  go_live_clicked_at?: string | null;
  live_post_id?: string | null;
  rtmp_started_at?: string | null;
  started_at?: string | null;
  recording_status?: string | null;
  archive_status?: string | null;
};

type RtmpStreamCredentials = {
  stream_key_with_password: string;
};

async function invokeRtmp<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('live-rtmp', { body });
  if (error) throw error;
  const payload = data as { error?: string } & T;
  if (payload?.error) throw new Error(payload.error);
  return payload as T;
}

export async function createRtmpLiveSession(input: {
  title?: string;
  description?: string;
  privacy?: 'public' | 'friends';
} = {}): Promise<RtmpLiveResponse> {
  return invokeRtmp<RtmpLiveResponse>({
    action: 'create',
    title: input.title,
    description: input.description,
    privacy: input.privacy || 'public',
  });
}

export async function getRtmpLiveStatus(sessionId: string): Promise<RtmpLiveStatus> {
  return invokeRtmp<RtmpLiveStatus>({
    action: 'status',
    live_session_id: sessionId,
    producer_active: true,
  });
}

export async function getRtmpLiveSession(sessionId: string): Promise<RtmpLiveResponse> {
  return invokeRtmp<RtmpLiveResponse>({
    action: 'host-session',
    live_session_id: sessionId,
  });
}

export async function heartbeatRtmpProducer(sessionId: string): Promise<RtmpLiveStatus> {
  return invokeRtmp<RtmpLiveStatus>({
    action: 'producer-heartbeat',
    live_session_id: sessionId,
  });
}

export async function disconnectRtmpProducer(sessionId: string): Promise<void> {
  await invokeRtmp<{ ok: true }>({
    action: 'producer-disconnect',
    live_session_id: sessionId,
  });
}

export function sendRtmpProducerDisconnectBeacon(sessionId: string, accessToken?: string | null): boolean {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl || !accessToken || !navigator.sendBeacon) return false;
  const body = new Blob([
    JSON.stringify({
      action: 'producer-disconnect',
      live_session_id: sessionId,
      access_token: accessToken,
    }),
  ], { type: 'application/json' });
  return navigator.sendBeacon(`${supabaseUrl}/functions/v1/live-rtmp`, body);
}

export async function endRtmpLiveSession(sessionId: string): Promise<void> {
  await invokeRtmp<{ ok: true }>({
    action: 'end',
    live_session_id: sessionId,
  });
}

export async function saveRtmpLiveDetails(sessionId: string, input: {
  title: string;
  description: string;
}): Promise<RtmpLiveResponse> {
  return invokeRtmp<RtmpLiveResponse>({
    action: 'save-details',
    live_session_id: sessionId,
    title: input.title,
    description: input.description,
  });
}

export async function goLiveRtmpSession(sessionId: string): Promise<RtmpLiveResponse> {
  return invokeRtmp<RtmpLiveResponse>({
    action: 'go-live',
    live_session_id: sessionId,
  });
}

export async function startRtmpLiveSession(sessionId: string): Promise<RtmpLiveResponse> {
  return invokeRtmp<RtmpLiveResponse>({
    action: 'start',
    live_session_id: sessionId,
  });
}

export async function getRtmpStreamKeyForCopy(sessionId: string): Promise<string> {
  const credentials = await invokeRtmp<RtmpStreamCredentials>({
    action: 'copy-stream-key',
    live_session_id: sessionId,
  });
  return credentials.stream_key_with_password;
}

export async function regenerateRtmpStreamKey(sessionId: string): Promise<RtmpLiveResponse> {
  return invokeRtmp<RtmpLiveResponse>({
    action: 'reset-stream-key',
    live_session_id: sessionId,
  });
}
