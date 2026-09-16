import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import type { Message } from '../config/types';
import { useFunChat } from './useFunChat';

async function fetchMessages(client: any, conversationId: string): Promise<Message[]> {
  const { data, error } = await client
    .from('messages')
    .select(`
      *,
      sender:profiles(id, username, avatar_url, full_name)
    `)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(200);

  if (error) throw error;
  return data || [];
}

export function useMessages(conversationId: string | null) {
  const { client, user } = useFunChat();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['fun-chat', 'messages', conversationId],
    queryFn: () => fetchMessages(client, conversationId as string),
    enabled: Boolean(conversationId),
    staleTime: 30 * 1000, // 30 seconds
  });

  useEffect(() => {
    if (!conversationId) return;

    const channel = client
      .channel(`fun-chat:messages:${conversationId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['fun-chat', 'messages', conversationId] });
          queryClient.invalidateQueries({ queryKey: ['fun-chat', 'conversations'] });
        }
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, [client, conversationId, queryClient]);

  const sendMessage = useMutation({
    mutationFn: async ({ content }: { content: string }) => {
      if (!conversationId) throw new Error('No conversation selected');
      if (!user?.id) throw new Error('Not authenticated');

      const { data, error } = await client
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          content,
          media_urls: [],
        })
        .select('*')
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fun-chat', 'messages', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['fun-chat', 'conversations'] });
    },
  });

  return {
    messages: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    sendMessage,
  };
}