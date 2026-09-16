export type LivePrivacy = 'public' | 'friends';
export type LiveStatus =
  | 'created'
  | 'connecting'
  | 'waiting_for_obs'
  | 'source_connected'
  | 'ready_to_go_live'
  | 'live'
  | 'reconnecting'
  | 'disconnected'
  | 'cleanup_pending'
  | 'stopping'
  | 'ended'
  | 'processing'
  | 'ready'
  | 'archiving'
  | 'posted'
  | 'failed';
export type LiveSource = 'agora' | 'rtmp';
export type LiveMode = 'webcam' | 'rtmp' | 'rtmp_obs';
export type StreamProvider = 'agora' | 'nginx_rtmp' | 'cloudflare_stream';
export type RtmpStatus = 'idle' | 'waiting' | 'live' | 'ended';

export interface LiveHostProfile {
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

export interface LiveSession {
  id: string;
  host_user_id: string;
  agora_channel?: string | null;
  channel_name: string;
  source?: LiveSource;
  mode?: 'agora' | 'agora_webcam' | 'rtmp_obs' | null;
  live_mode?: LiveMode;
  stream_provider?: StreamProvider;
  stream_key?: string | null;
  rtmps_url?: string | null;
  playback_url?: string | null;
  cloudflare_live_input_id?: string | null;
  cloudflare_video_uid?: string | null;
  replay_url?: string | null;
  thumbnail_url?: string | null;
  error_message?: string | null;
  duration_seconds?: number | null;
  rtmp_status?: RtmpStatus | null;
  rtmp_started_at?: string | null;
  rtmp_ended_at?: string | null;
  hls_url?: string | null;
  hls_playback_url?: string | null;
  agora_uid_host?: number | null;
  recording_uid?: number | null;
  recording_status?:
    | 'idle'
    | 'acquired'
    | 'acquiring'
    | 'starting'
    | 'recording'
    | 'stopping'
    | 'uploading'
    | 'queued'
    | 'processing'
    | 'ready'
    | 'stopped'
    | 'failed'
    | 'deleted'
    | null;
  archive_status?: 'pending' | 'ready' | 'mp4_pending' | 'archiving' | 'archived' | 'posting' | 'posted' | 'stream_delete_pending' | 'failed' | null;
  storage_provider?: 'cloudflare_stream' | 'r2' | null;
  playback_provider?: 'cloudflare_stream' | 'r2' | null;
  r2_video_url?: string | null;
  title: string | null;
  description?: string | null;
  privacy: LivePrivacy;
  status: LiveStatus;
  viewer_count: number;
  started_at: string;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
  post_id: string | null;
  host_profile?: LiveHostProfile | null;
}

export interface CreateLiveSessionInput {
  title?: string;
  privacy: LivePrivacy;
}
