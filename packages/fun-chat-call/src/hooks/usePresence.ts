import { useEffect, useState } from 'react';
import { useFunChat } from './useFunChat';

interface PresenceState {
  typingPayload: unknown | null;
  lastMessage: unknown | null;
  lastUpdatedMessage: unknown | null;
  lastDeletedMessageId: string | null;
}

export function usePresence(conversationId: string | null) {
  const { adapter } = useFunChat();
  const [state, setState] = useState<PresenceState>({
    typingPayload: null,
    lastMessage: null,
    lastUpdatedMessage: null,
    lastDeletedMessageId: null,
  });

  useEffect(() => {
    if (!conversationId || !adapter.subscribeRealtime) return;
    const sub = adapter.subscribeRealtime(conversationId, {
      onTyping: (typingPayload) => setState((prev) => ({ ...prev, typingPayload })),
      onMessage: (lastMessage) => setState((prev) => ({ ...prev, lastMessage })),
      onMessageUpdated: (lastUpdatedMessage) =>
        setState((prev) => ({ ...prev, lastUpdatedMessage })),
      onMessageDeleted: (lastDeletedMessageId) =>
        setState((prev) => ({ ...prev, lastDeletedMessageId })),
    });

    return () => sub.unsubscribe();
  }, [adapter, conversationId]);

  return state;
}

