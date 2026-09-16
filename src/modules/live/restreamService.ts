import { supabase } from '@/integrations/supabase/client';

export type RestreamPlatform = 'facebook' | 'youtube' | 'twitch' | 'custom' | 'unknown';
export type RestreamDestinationStatus = 'pending' | 'starting' | 'live' | 'failed' | 'stopped' | 'signal_lost';

export interface RestreamConnection {
  connected: boolean;
  restream_user_id?: string | null;
  expires_at?: string | null;
  scopes?: string[];
  connected_at?: string | null;
  updated_at?: string | null;
}

export interface RestreamChannel {
  restream_channel_id: string;
  platform_id?: number | null;
  platform: RestreamPlatform;
  display_name?: string | null;
  channel_url?: string | null;
  enabled?: boolean;
  last_synced_at?: string | null;
}

export interface MultistreamDestination {
  id: string;
  platform: RestreamPlatform;
  restream_channel_id?: string | null;
  display_name?: string | null;
  status: RestreamDestinationStatus | string;
  signal_status?: 'inactive' | 'healthy' | 'lost' | string;
  last_error?: string | null;
  last_signal_at?: string | null;
  started_at?: string | null;
  stopped_at?: string | null;
}

export interface RestreamSetupStatus {
  ok: boolean;
  function_reachable: boolean;
  env: {
    ok: boolean;
    missing: string[];
    restream_client_id: boolean;
    restream_client_secret: boolean;
    restream_redirect_uri: boolean;
    restream_token_encryption_secret: boolean;
    redirect_uri: string | null;
    expected_callback_url: string | null;
    agora_egress_configured: boolean;
  };
  database: {
    ok: boolean;
    tables: Record<string, boolean>;
    errors?: Record<string, string>;
  };
}

export class RestreamApiError extends Error {
  code?: string;
  setup?: RestreamSetupStatus;

  constructor(message: string, code?: string, setup?: RestreamSetupStatus) {
    super(message);
    this.name = 'RestreamApiError';
    this.code = code;
    this.setup = setup;
  }
}

function normalizeRestreamWarning(code?: string, message?: string) {
  if (code === 'missing_migration') return 'Admin cần deploy migration Restream trước khi bật multistream.';
  if (code === 'missing_restream_env') return 'Admin cần cấu hình Restream Client ID, Client Secret và Redirect URI trước.';
  if (code === 'missing_encryption_secret') return 'Admin cần cấu hình RESTREAM_TOKEN_ENCRYPTION_SECRET tối thiểu 32 ký tự.';
  if (code === 'not_connected') return '';
  if (message === 'Restream API failed') return 'Restream chưa sẵn sàng. Admin cần kiểm tra cấu hình Restream.';
  return message || 'Restream request failed';
}

async function getFunctionErrorMessage(error: unknown): Promise<string> {
  const fallback = error instanceof Error ? error.message : 'Edge Function request failed';
  const context = (error as { context?: unknown } | null)?.context;
  if (!context || typeof context !== 'object') return fallback;
  const response = context as Response;
  try {
    const body = await response.clone().json();
    return body?.error || body?.message || fallback;
  } catch {
    return fallback;
  }
}

async function getFunctionErrorPayload(error: unknown): Promise<{ message: string; code?: string; setup?: RestreamSetupStatus }> {
  const fallback = error instanceof Error ? error.message : 'Edge Function request failed';
  const context = (error as { context?: unknown } | null)?.context;
  if (!context || typeof context !== 'object') return { message: fallback };
  const response = context as Response;
  try {
    const body = await response.clone().json();
    return {
      message: normalizeRestreamWarning(body?.error_code, body?.error || body?.message || fallback),
      code: body?.error_code,
      setup: body?.setup,
    };
  } catch {
    return { message: fallback };
  }
}

async function invokeRestream<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke('restream-api', {
    body: { action, payload },
  });
  if (error) {
    const payload = await getFunctionErrorPayload(error);
    throw new RestreamApiError(payload.message, payload.code, payload.setup);
  }
  if (data?.success === false) {
    throw new RestreamApiError(
      normalizeRestreamWarning(data.error_code, data.error || 'Restream request failed'),
      data.error_code,
      data.setup,
    );
  }
  return data as T;
}

export async function getRestreamSetupStatus(): Promise<RestreamSetupStatus> {
  const data = await invokeRestream<{ success: boolean; setup: RestreamSetupStatus }>('setup_status');
  return data.setup;
}

export async function getRestreamConnection(): Promise<{ connection: RestreamConnection; channels: RestreamChannel[]; setup?: RestreamSetupStatus; warning?: string; warning_code?: string }> {
  const data = await invokeRestream<{
    success: boolean;
    connection: RestreamConnection;
    channels: RestreamChannel[];
    setup?: RestreamSetupStatus;
    warning?: string;
    warning_code?: string;
  }>('get_connection');
  return {
    connection: data.connection,
    channels: data.channels || [],
    setup: data.setup,
    warning: normalizeRestreamWarning(data.warning_code, data.warning),
    warning_code: data.warning_code,
  };
}

export async function refreshRestreamChannels(): Promise<RestreamChannel[]> {
  const data = await invokeRestream<{ success: boolean; channels: RestreamChannel[] }>('refresh_channels');
  return data.channels || [];
}

export async function disconnectRestream(): Promise<void> {
  await invokeRestream('disconnect');
}

export async function startRestreamOAuth(redirectAfter = '/live/new'): Promise<string> {
  const { data, error } = await supabase.functions.invoke('restream-oauth-start', {
    body: { redirect_after: redirectAfter },
  });
  if (error) {
    const payload = await getFunctionErrorPayload(error);
    throw new RestreamApiError(payload.message, payload.code, payload.setup);
  }
  if (data?.success === false) {
    throw new RestreamApiError(
      normalizeRestreamWarning(data.error_code, data.error || 'Restream authorization URL is missing'),
      data.error_code,
      data.setup,
    );
  }
  if (!data?.auth_url) throw new Error('Restream authorization URL is missing');
  return String(data.auth_url);
}

export async function startRestreamMultistream(input: {
  liveSessionId: string;
  channelIds: string[];
}): Promise<{ success: boolean; destinations?: MultistreamDestination[]; skipped?: boolean; reason?: string }> {
  const { data, error } = await supabase.functions.invoke('restream-multistream-start', {
    body: {
      live_session_id: input.liveSessionId,
      channel_ids: input.channelIds,
    },
  });
  if (error) throw new Error(await getFunctionErrorMessage(error));
  if (data?.success === false) throw new Error(data.error || 'Restream multistream failed');
  return data;
}

export async function stopRestreamMultistream(liveSessionId: string): Promise<void> {
  const { error } = await supabase.functions.invoke('restream-multistream-stop', {
    body: { live_session_id: liveSessionId },
  });
  if (error) throw new Error(await getFunctionErrorMessage(error));
}

export async function getRestreamLiveStatus(liveSessionId: string): Promise<MultistreamDestination[]> {
  const data = await invokeRestream<{ success: boolean; destinations: MultistreamDestination[] }>('get_live_status', {
    live_session_id: liveSessionId,
  });
  return data.destinations || [];
}
