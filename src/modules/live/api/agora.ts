import { supabase } from '@/integrations/supabase/client';

export type LiveRtcRole = 'host' | 'audience' | 'recorder' | 'guest';

export interface GetRtcTokenInput {
  sessionId?: string;
  channelName?: string;
  uid?: string | number;
  role: LiveRtcRole;
  expireSeconds?: number;
  inviteId?: string;
}

export interface RtcTokenResult {
  appId: string;
  token: string;
  uid: string | number;
  channel: string;
  expiresAt?: number;
}

export interface StartRecordingInput {
  sessionId: string;
  channelName: string;
  recorderUid: string | number;
  mode?: 'mix' | 'individual';
}

export interface StartRecordingResult {
  resourceId: string;
  sid: string;
}

export interface StopRecordingInput {
  sessionId: string;
  channelName: string;
  recorderUid: string | number;
  resourceId: string;
  sid: string;
}

export interface StopRecordingResult {
  status?: 'ready' | 'pending' | 'failed';
  uploadingStatus?: string | null;
  files?: unknown[];
  mediaKey?: string | null;
  mediaUrl?: string | null;
  message?: string;
  durationSeconds?: number | null;
  thumbnailUrl?: string | null;
  rawAgoraResponse?: Record<string, unknown>;
  serverResponse: {
    status?: 'ready' | 'pending' | 'failed';
    uploadingStatus?: string | null;
    files?: unknown[];
    mediaKey?: string | null;
    mediaUrl?: string | null;
    message?: string;
    durationSeconds?: number | null;
    thumbnailUrl?: string | null;
    rawAgoraResponse?: Record<string, unknown>;
    [key: string]: unknown;
  };
}

export async function getRtcToken(input: GetRtcTokenInput): Promise<RtcTokenResult> {
  const { data, error } = await supabase.functions.invoke('live-token', {
    body: {
      sessionId: input.sessionId,
      channelName: input.channelName,
      uid: input.uid,
      role: input.role,
      expireSeconds: input.expireSeconds,
      inviteId: input.inviteId,
      invite_id: input.inviteId,
    },
  });

  if (error) throw error;
  if (!data?.token || !data?.appId || !data?.channel) {
    throw new Error('Invalid live-token response');
  }

  return {
    appId: data.appId,
    token: data.token,
    uid: data.uid,
    channel: data.channel,
    expiresAt: data.expiresAt,
  };
}

export async function startRecording(input: StartRecordingInput): Promise<StartRecordingResult> {
  const { data, error } = await supabase.functions.invoke('live-recording-start', {
    body: {
      sessionId: input.sessionId,
      channelName: input.channelName,
      recorderUid: String(input.recorderUid),
      mode: input.mode || 'mix',
    },
  });

  if (error) throw error;
  if (!data?.resourceId || !data?.sid) {
    throw new Error('Invalid live-recording-start response');
  }

  return {
    resourceId: data.resourceId,
    sid: data.sid,
  };
}

export async function stopRecording(input: StopRecordingInput): Promise<StopRecordingResult> {
  const { data, error } = await supabase.functions.invoke('live-recording-stop', {
    body: {
      sessionId: input.sessionId,
      channelName: input.channelName,
      recorderUid: String(input.recorderUid),
      resourceId: input.resourceId,
      sid: input.sid,
    },
  });

  if (error) throw error;

  const serverResponse = (data?.serverResponse || data || {}) as StopRecordingResult['serverResponse'];
  return {
    status: typeof data?.status === 'string' ? data.status : serverResponse.status,
    uploadingStatus: typeof data?.uploadingStatus === 'string' ? data.uploadingStatus : serverResponse.uploadingStatus,
    files: Array.isArray(data?.files) ? data.files : serverResponse.files,
    mediaKey: typeof data?.mediaKey === 'string' ? data.mediaKey : serverResponse.mediaKey,
    mediaUrl: typeof data?.mediaUrl === 'string' ? data.mediaUrl : serverResponse.mediaUrl,
    message: typeof data?.message === 'string' ? data.message : serverResponse.message,
    durationSeconds: typeof data?.durationSeconds === 'number' ? data.durationSeconds : serverResponse.durationSeconds,
    thumbnailUrl: typeof data?.thumbnailUrl === 'string' ? data.thumbnailUrl : serverResponse.thumbnailUrl,
    rawAgoraResponse: (data?.rawAgoraResponse || serverResponse.rawAgoraResponse) as Record<string, unknown> | undefined,
    serverResponse,
  };
}
