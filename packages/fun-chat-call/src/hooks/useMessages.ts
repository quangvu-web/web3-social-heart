import { useQuery } from '@tanstack/react-query';
import { useFunChat } from './useFunChat';

export function useMessages<TMessage = unknown>(conversationId: string | null, cursor?: string | null) {
  const { adapter } = useFunChat();

  return useQuery({
    queryKey: ['fun-chat-call', 'messages', conversationId, cursor ?? null],
    enabled: Boolean(conversationId),
    queryFn: async () => {
      if (!conversationId) {
        return { items: [] as TMessage[], nextCursor: null as string | null };
      }
      return adapter.fetchChatHistory<TMessage>(conversationId, cursor ?? null);
    },
  });
}

