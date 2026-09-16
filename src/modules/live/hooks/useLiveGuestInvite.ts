import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type LiveGuestStatus =
  | 'invited'
  | 'accepted'
  | 'joined'
  | 'declined'
  | 'removed'
  | 'left'
  | 'disconnected'
  | 'expired';

export type LiveGuestSession = {
  id: string;
  live_session_id: string;
  host_user_id: string;
  guest_user_id: string;
  agora_channel_name: string;
  agora_uid: number;
  status: LiveGuestStatus;
  muted_by_host: boolean;
  invited_at: string;
  accepted_at: string | null;
  joined_at: string | null;
  ended_at: string | null;
  last_heartbeat_at: string | null;
  guest_profile?: {
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
  host_profile?: {
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
};

export type LiveViewerPresence = {
  user_id: string;
  last_seen_at: string;
  client_state: string;
  device_type: string;
  profile?: {
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
};

async function functionError(error: unknown) {
  const fallback = error instanceof Error ? error.message : 'Edge Function request failed';
  const response = (error as { context?: Response } | null)?.context;
  if (!response?.clone) return fallback;
  try {
    const body = await response.clone().json();
    return body?.error || body?.message || fallback;
  } catch {
    return fallback;
  }
}

async function enrichProfiles<T extends { user_id?: string; guest_user_id?: string; host_user_id?: string }>(
  rows: T[],
) {
  const ids = [
    ...new Set(rows.flatMap((row) => [row.user_id, row.guest_user_id, row.host_user_id]).filter(Boolean) as string[]),
  ];
  if (!ids.length) return new Map<string, any>();
  const { data } = await supabase.from('profiles').select('id, username, full_name, avatar_url').in('id', ids);
  return new Map((data || []).map((profile: any) => [profile.id, profile]));
}

export function useLiveViewerPresence(sessionId?: string, enabled = true) {
  const [viewers, setViewers] = useState<LiveViewerPresence[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    if (!sessionId || !enabled) return;
    setIsLoading(true);
    const cutoff = new Date(Date.now() - 30_000).toISOString();
    const { data, error } = await (supabase as any)
      .from('live_viewer_presence')
      .select('user_id, last_seen_at, client_state, device_type')
      .eq('live_session_id', sessionId)
      .gte('last_seen_at', cutoff)
      .order('last_seen_at', { ascending: false });
    if (!error && data) {
      const profiles = await enrichProfiles(data);
      setViewers((data as any[]).map((row) => ({ ...row, profile: profiles.get(row.user_id) || null })));
    }
    setIsLoading(false);
  }, [enabled, sessionId]);

  useEffect(() => {
    load().catch(() => setIsLoading(false));
    if (!sessionId || !enabled) return;
    // Realtime subscription là nguồn chính. Polling fallback 30s, bỏ qua khi tab ẩn.
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      load().catch(() => undefined);
    }, 30_000);
    const channel = supabase
      .channel(`live-viewer-presence:${sessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_viewer_presence', filter: `live_session_id=eq.${sessionId}` }, () => {
        load().catch(() => undefined);
      })
      .subscribe();
    return () => {
      window.clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [enabled, load, sessionId]);

  return { viewers, isLoading, refresh: load };
}

export function useLiveGuestSession(sessionId?: string) {
  const [guestSession, setGuestSession] = useState<LiveGuestSession | null>(null);

  const load = useCallback(async () => {
    if (!sessionId) return;
    const { data } = await (supabase as any)
      .from('live_guest_sessions')
      .select('*')
      .eq('live_session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) {
      setGuestSession(null);
      return;
    }
    const profiles = await enrichProfiles([data]);
    setGuestSession({
      ...(data as LiveGuestSession),
      guest_profile: profiles.get(data.guest_user_id) || null,
      host_profile: profiles.get(data.host_user_id) || null,
    });
  }, [sessionId]);

  useEffect(() => {
    load().catch(() => undefined);
    if (!sessionId) return;
    const channel = supabase
      .channel(`live-guest-session:${sessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_guest_sessions', filter: `live_session_id=eq.${sessionId}` }, () => {
        load().catch(() => undefined);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load, sessionId]);

  return { guestSession, refresh: load };
}

export function useIncomingLiveGuestInvite(userId?: string | null) {
  const [invite, setInvite] = useState<LiveGuestSession | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    const { data } = await (supabase as any)
      .from('live_guest_sessions')
      .select('*')
      .eq('guest_user_id', userId)
      .in('status', ['invited', 'accepted', 'joined', 'disconnected'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return setInvite(null);
    const profiles = await enrichProfiles([data]);
    setInvite({
      ...(data as LiveGuestSession),
      guest_profile: profiles.get(data.guest_user_id) || null,
      host_profile: profiles.get(data.host_user_id) || null,
    });
  }, [userId]);

  useEffect(() => {
    load().catch(() => undefined);
    if (!userId) return;
    const channel = supabase
      .channel(`live-guest-invite:${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_guest_sessions', filter: `guest_user_id=eq.${userId}` }, () => {
        load().catch(() => undefined);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load, userId]);

  return { invite, refresh: load, clear: () => setInvite(null) };
}

export async function upsertViewerPresence(input: {
  liveSessionId: string;
  userId: string;
  clientState?: 'watching' | 'background' | 'left';
  deviceType?: 'desktop' | 'mobile';
}) {
  const now = new Date().toISOString();
  await (supabase as any).from('live_viewer_presence').upsert({
    live_session_id: input.liveSessionId,
    user_id: input.userId,
    last_seen_at: now,
    left_at: input.clientState === 'left' ? now : null,
    client_state: input.clientState || 'watching',
    device_type: input.deviceType || 'desktop',
    updated_at: now,
  }, { onConflict: 'live_session_id,user_id' });
}

export async function inviteLiveGuest(liveSessionId: string, guestUserId: string) {
  const { data, error } = await supabase.functions.invoke('live-guest-invite', {
    body: { live_session_id: liveSessionId, guest_user_id: guestUserId },
  });
  if (error) throw new Error(await functionError(error));
  return data as { inviteId: string; status: LiveGuestStatus };
}

export async function respondLiveGuestInvite(inviteId: string, response: 'accept' | 'decline') {
  const { data, error } = await supabase.functions.invoke('live-guest-respond', {
    body: { invite_id: inviteId, response },
  });
  if (error) throw new Error(await functionError(error));
  return data as { inviteId: string; status: LiveGuestStatus };
}

export async function controlLiveGuest(inviteId: string, action: 'cancel' | 'remove' | 'mute' | 'unmute' | 'leave') {
  const { data, error } = await supabase.functions.invoke('live-guest-control', {
    body: { invite_id: inviteId, action },
  });
  if (error) throw new Error(await functionError(error));
  return data as { inviteId: string; status: LiveGuestStatus; muted_by_host?: boolean };
}

export async function sendLiveGuestHeartbeat(inviteId: string, clientState: 'live' | 'reconnecting' | 'background' | 'closing' = 'live') {
  const { data, error } = await supabase.functions.invoke('live-guest-heartbeat', {
    body: { invite_id: inviteId, client_state: clientState, has_audio: true, has_video: true },
  });
  if (error) throw new Error(await functionError(error));
  return data as { ok: boolean; status: LiveGuestStatus; muted_by_host?: boolean; ended?: boolean };
}
