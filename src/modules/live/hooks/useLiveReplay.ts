import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface LiveReplayInfo {
  id: string;
  status: string;
  playback_hls: string | null;
  playback_mp4: string | null;
  r2_video_url?: string | null;
  playback_provider?: string | null;
  archive_status?: string | null;
  duration_seconds: number | null;
}

/**
 * Fetch the most recent replay for a given live session.
 * - Polls every 5s while replay status is not "ready"/"failed".
 * - When status is "ready" but `playback_mp4` is missing, polls every 10s
 *   AND triggers `stream-mp4-finalize` once to kick off (or pick up) the
 *   Cloudflare MP4 render.
 */
export function useLiveReplay(liveSessionId: string | undefined, enabled: boolean) {
  const finalizeTriggeredRef = useRef<Set<string>>(new Set());

  const query = useQuery<LiveReplayInfo | null>({
    queryKey: ['live-replay', liveSessionId],
    enabled: !!liveSessionId && enabled,
    queryFn: async () => {
      if (!liveSessionId) return null;
      const { data, error } = await supabase
        .from('live_replays')
        .select('id, status, playback_hls, playback_mp4, r2_video_url, playback_provider, archive_status, duration_seconds')
        .eq('live_session_id', liveSessionId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) {
        console.warn('[useLiveReplay] fetch failed:', error);
        return null;
      }
      return (data as LiveReplayInfo) ?? null;
    },
    refetchInterval: (query) => {
      const data = query.state.data as LiveReplayInfo | null | undefined;
      if (!data) return 5000;
      if (data.status === 'failed') return false;
      if (data.status !== 'ready') return 5000;
      // Status ready but waiting for MP4 — poll slower.
      if (data.archive_status !== 'archived' || !data.playback_mp4) return 10000;
      return false;
    },
    staleTime: 0,
  });

  // Trigger MP4 finalize when replay is ready but MP4 not yet stored.
  useEffect(() => {
    const replay = query.data;
    if (!replay || replay.status !== 'ready' || replay.playback_mp4) return;
    if (finalizeTriggeredRef.current.has(replay.id)) return;
    finalizeTriggeredRef.current.add(replay.id);
    supabase.functions
      .invoke('archive-replay-to-r2', { body: { replay_id: replay.id } })
      .catch((err) => console.warn('[useLiveReplay] finalize invoke failed', err));
  }, [query.data]);

  return query;
}
