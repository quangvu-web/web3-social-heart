import type {
  AgoraTokenParams,
  AgoraTokenResult,
  MessageCursorPage,
  MessagePayload,
  RealtimeSubscription,
} from '../config/types';

export interface ChatCallAuth {
  userId: string | null;
  accessToken?: string | null;
}

export interface ChatCallAdapter {
  getAuth: () => Promise<ChatCallAuth> | ChatCallAuth;
  fetchAgoraToken: (params: AgoraTokenParams) => Promise<AgoraTokenResult>;
  fetchChatHistory: <TMessage = unknown>(
    conversationId: string,
    cursor?: string | null
  ) => Promise<MessageCursorPage<TMessage>>;
  sendMessage: (conversationId: string, payload: MessagePayload) => Promise<unknown>;
  subscribeRealtime?: (
    conversationId: string,
    handlers: {
      onMessage?: (message: unknown) => void;
      onMessageUpdated?: (message: unknown) => void;
      onMessageDeleted?: (messageId: string) => void;
      onTyping?: (payload: unknown) => void;
    }
  ) => RealtimeSubscription;
  uploadAttachment?: (file: File) => Promise<{ url: string; type?: string }>;
}
