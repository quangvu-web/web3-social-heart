import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface LiveFriend {
  sessionId: string;
  title: string;
  viewerCount: number;
  startedAt: string;
  host: {
    id: string;
    username: string;
    avatar_url: string | null;
  };
}

/**
 * Returns live sessions from friends/accepted connections of the current user.
 * Subscribes to realtime changes in live_sessions so the badge updates automatically.
 */
export function useFollowingLiveStatus() {
  const [liveFriends, setLiveFriends] = useState<LiveFriend[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchLiveFriends = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLiveFriends([]);
      setIsLoading(false);
      return;
    }

    // Get accepted friendships (both directions)
    const { data: friendships } = await supabase
      .from('friendships')
      .select('user_id, friend_id')
      .eq('status', 'accepted')
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

    if (!friendships || friendships.length === 0) {
      setLiveFriends([]);
      setIsLoading(false);
      return;
    }

    // Collect friend IDs
    const friendIds = friendships.map((f) =>
      f.user_id === user.id ? f.friend_id : f.user_id
    );

    // Query active live sessions hosted by friends
    const { data: sessions } = await supabase
      .from('live_sessions')
      .select(
        `id, title, viewer_count, started_at,
         host_profile:profiles!live_sessions_host_user_id_fkey(id, username, avatar_url)`
      )
      .eq('status', 'live')
      .in('host_user_id', friendIds);

    if (!sessions) {
      setLiveFriends([]);
      setIsLoading(false);
      return;
    }

    const mapped: LiveFriend[] = sessions.map((s: any) => ({
      sessionId: s.id,
      title: s.title || 'Phát trực tiếp',
      viewerCount: s.viewer_count || 0,
      startedAt: s.started_at,
      host: {
        id: s.host_profile?.id || '',
        username: s.host_profile?.username || 'User',
        avatar_url: s.host_profile?.avatar_url || null,
      },
    }));

    setLiveFriends(mapped);
    setIsLoading(false);
  };

  useEffect(() => {
    setIsLoading(true);
    fetchLiveFriends();

    // Subscribe to live_sessions changes — any status change triggers a refresh
    const channel = supabase
      .channel('following-live-status')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'live_sessions' },
        () => {
          fetchLiveFriends();
        }
      )
      .subscribe();

    // Also listen to auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      fetchLiveFriends();
    });

    return () => {
      supabase.removeChannel(channel);
      authListener.subscription.unsubscribe();
    };
  }, []);

  return {
    liveFriends,
    isLoading,
    count: liveFriends.length,
    hasLive: liveFriends.length > 0,
  };
}
