import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface LiveReaction {
  id: number;
  session_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

const THROTTLE_MS = 300;

export function useLiveReactions(sessionId?: string) {
  const [reactions, setReactions] = useState<LiveReaction[]>([]);
  const lastSendAtRef = useRef(0);

  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase
      .channel(`live-reactions:${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'live_reactions',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const row = payload.new as any;
          setReactions((prev) => [
            ...prev.slice(-120),
            {
              id: row.id,
              session_id: row.session_id,
              user_id: row.user_id,
              emoji: row.emoji,
              created_at: row.created_at,
            },
          ]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  const sendReaction = useCallback(
    async (emoji: string) => {
      if (!sessionId) return false;
      const now = Date.now();
      if (now - lastSendAtRef.current < THROTTLE_MS) return false;
      lastSendAtRef.current = now;

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return false;

      const { error } = await supabase.from('live_reactions').insert({
        session_id: sessionId,
        user_id: user.id,
        emoji,
      });
      if (error) throw error;
      return true;
    },
    [sessionId]
  );

  return { reactions, sendReaction };
}

