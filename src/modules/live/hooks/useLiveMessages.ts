import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface LiveMessage {
  id: number;
  session_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profile?: {
    username: string | null;
    avatar_url: string | null;
  };
}

async function enrichProfiles(rows: Array<{ user_id: string }>) {
  const ids = [...new Set(rows.map((r) => r.user_id))];
  if (ids.length === 0) return new Map<string, { username: string | null; avatar_url: string | null }>();

  const { data } = await supabase
    .from('profiles')
    .select('id, username, avatar_url')
    .in('id', ids);

  return new Map((data || []).map((p: any) => [p.id, { username: p.username, avatar_url: p.avatar_url }]));
}

export function useLiveMessages(sessionId?: string) {
  const [messages, setMessages] = useState<LiveMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const channelSuffix = useRef(Math.random().toString(36).slice(2));

  useEffect(() => {
    if (!sessionId) return;
    let active = true;

    const load = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('live_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true })
        .limit(200);

      if (!active) return;
      if (error || !data) {
        setMessages([]);
        setIsLoading(false);
        return;
      }

      const profileMap = await enrichProfiles(data as any[]);
      if (!active) return;

      setMessages(
        (data as any[]).map((row) => ({
          id: row.id,
          session_id: row.session_id,
          user_id: row.user_id,
          content: row.content,
          created_at: row.created_at,
          profile: profileMap.get(row.user_id),
        }))
      );
      setIsLoading(false);
    };

    load().catch(() => setIsLoading(false));

    return () => {
      active = false;
    };
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase
      .channel(`live-messages:${sessionId}:${channelSuffix.current}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'live_messages',
          filter: `session_id=eq.${sessionId}`,
        },
        async (payload) => {
          const row = payload.new as any;

          const { data: profile } = await supabase
            .from('profiles')
            .select('username, avatar_url')
            .eq('id', row.user_id)
            .maybeSingle();

          const newMsg: LiveMessage = {
            id: row.id,
            session_id: row.session_id,
            user_id: row.user_id,
            content: row.content,
            created_at: row.created_at,
            profile: profile ?? undefined,
          };

          setMessages((prev) => {
            // Skip if already exists (by real id)
            if (prev.some((m) => m.id === row.id)) return prev;
            // Replace optimistic message (negative id, same user + content)
            const withoutOptimistic = prev.filter(
              (m) => !(m.id < 0 && m.user_id === row.user_id && m.content === row.content)
            );
            return [...withoutOptimistic, newMsg];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  const sendMessage = useCallback(
    async (content: string) => {
      const value = content.trim();
      if (!sessionId || !value) return;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Optimistic update with negative id
      const optimisticMsg: LiveMessage = {
        id: -Date.now(),
        session_id: sessionId,
        user_id: user.id,
        content: value,
        created_at: new Date().toISOString(),
        profile: undefined,
      };
      setMessages((prev) => [...prev, optimisticMsg]);

      const { error } = await supabase.from('live_messages').insert({
        session_id: sessionId,
        user_id: user.id,
        content: value,
      });
      if (error) {
        // Rollback optimistic message on error
        setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
        throw error;
      }
    },
    [sessionId]
  );

  return { messages, isLoading, sendMessage };
}
