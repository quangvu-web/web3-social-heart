import './styles/fun-chat.css';

export { FunChatProvider } from './providers/FunChatProvider';
export { FunChatApp } from './FunChatApp';

export { useFunChat, useFunChatClient } from './hooks/useFunChat';
export { useConversations } from './hooks/useConversations';
export { useMessages } from './hooks/useMessages';
export { useGroupConversations } from './hooks/useGroupConversations';
export { useAgoraCall } from './hooks/useAgoraCall';

export type {
  FunChatConfig,
  FunChatResolvedFeatures,
  Conversation,
  ConversationParticipant,
  Message,
  CallSession,
  CallStatus,
  CallType,
  UserProfile,
  AgoraTokenRequest,
  AgoraTokenResponse,
} from './config/types';