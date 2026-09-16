import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Conversation } from '../config/types';
import { useFunChat } from './useFunChat';

async function getConversations(client: SupabaseClient, userId: string): Promise<Conversation[]> {
  const { data, error } = await client
    .from('conversations')
    .select(`
      *,
      participants:conversation_participants(
        id,
        conversation_id,
        user_id,
        role,
        nickname,
        joined_at,
        left_at,
        profile:profiles(id, username, avatar_url, full_name)
      )
    `)
    .order('last_message_at', { ascending: false });

  if (error) throw error;

  return (data || []).filter((conversation: any) =>
    (conversation.participants || []).some((p: any) => p.user_id === userId && !p.left_at)
  ) as Conversation[];
}

export function useConversations() {
  const { client, user } = useFunChat();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['fun-chat', 'conversations', user?.id],
    queryFn: () => getConversations(client, user!.id),
    enabled: Boolean(user?.id),
    staleTime: 60 * 1000, // 1 minute
  });

  const createDirectConversation = useMutation({
    mutationFn: async (otherUserId: string) => {
      if (!user?.id) throw new Error('Not authenticated');

      const { data: existing, error: findError } = await client
        .from('conversation_participants')
        .select('conversation_id, conversations!inner(id, type)')
        .eq('user_id', user.id);

      if (findError) throw findError;

      const candidateIds = (existing || [])
        .map((row: any) => row.conversation_id)
        .filter(Boolean);

      if (candidateIds.length) {
        const { data: participants } = await client
          .from('conversation_participants')
          .select('conversation_id, user_id, left_at')
          .in('conversation_id', candidateIds)
          .is('left_at', null);

        const direct = (participants || []).reduce<Record<string, string[]>>((acc, row: any) => {
          acc[row.conversation_id] = acc[row.conversation_id] || [];
          acc[row.conversation_id].push(row.user_id);
          return acc;
        }, {});

        const matched = Object.entries(direct).find(([, users]) => {
          return users.length === 2 && users.includes(user.id) && users.includes(otherUserId);
        });

        if (matched?.[0]) {
          return { id: matched[0] };
        }
      }

      const { data: created, error: createError } = await client
        .from('conversations')
        .insert({ type: 'direct', created_by: user.id })
        .select('id')
        .single();

      if (createError) throw createError;

      const { error: insertParticipantsError } = await client.from('conversation_participants').insert([
        { conversation_id: created.id, user_id: user.id, role: 'admin' },
        { conversation_id: created.id, user_id: otherUserId, role: 'member' },
      ]);

      if (insertParticipantsError) throw insertParticipantsError;

      return created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fun-chat', 'conversations'] });
    },
  });

  return {
    conversations: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    createDirectConversation,
  };
}
