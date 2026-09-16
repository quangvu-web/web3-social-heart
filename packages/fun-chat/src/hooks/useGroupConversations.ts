import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useFunChat } from './useFunChat';

export function useGroupConversations() {
  const { client, user } = useFunChat();
  const queryClient = useQueryClient();

  const createGroupConversation = useMutation({
    mutationFn: async ({ name, memberIds }: { name: string; memberIds: string[] }) => {
      if (!user?.id) throw new Error('Not authenticated');

      const uniqueMembers = Array.from(new Set([user.id, ...memberIds])).filter(Boolean);

      const { data: conversation, error } = await client
        .from('conversations')
        .insert({
          type: 'group',
          name: name.trim() || 'New group',
          created_by: user.id,
        })
        .select('id')
        .single();

      if (error) throw error;

      const participants = uniqueMembers.map((memberId) => ({
        conversation_id: conversation.id,
        user_id: memberId,
        role: memberId === user.id ? 'admin' : 'member',
      }));

      const { error: participantsError } = await client.from('conversation_participants').insert(participants);
      if (participantsError) throw participantsError;

      return conversation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fun-chat', 'conversations'] });
    },
  });

  return { createGroupConversation };
}