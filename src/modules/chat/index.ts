/**
 * Chat Module
 * 
 * Provides messaging and video/voice calling functionality.
 */

// Page
export { default as ChatPage } from './pages/Chat';

// Components
export { CallRoom } from './components/CallRoom';
export { CallControls } from './components/CallControls';
export { ChatInput } from './components/ChatInput';
export { ChatSettingsDialog } from './components/ChatSettingsDialog';
export { ConversationList } from './components/ConversationList';
export { CreateGroupDialog } from './components/CreateGroupDialog';
export { CryptoGiftButton } from './components/CryptoGiftButton';
export { GroupSettingsDialog } from './components/GroupSettingsDialog';
export { IncomingCallDialog } from './components/IncomingCallDialog';
export { MessageBubble } from './components/MessageBubble';
export { MessageSearch } from './components/MessageSearch';
export { MessageThread } from './components/MessageThread';
export { NewConversationDialog } from './components/NewConversationDialog';
export { PreCallSettings } from './components/PreCallSettings';
export { SendCryptoModal } from './components/SendCryptoModal';
export { TypingIndicator } from './components/TypingIndicator';
export { VideoGrid } from './components/VideoGrid';

// Hooks
export { useAgoraCall } from './hooks/useAgoraCall';
export { useChatNotifications } from './hooks/useChatNotifications';
export { useChatSettings, canSendMessage } from './hooks/useChatSettings';
export { useConversations, useConversation } from './hooks/useConversations';
export { useGroupConversations } from './hooks/useGroupConversations';
export { useMediaDevices } from './hooks/useMediaDevices';
export { useMessages } from './hooks/useMessages';
export { useTypingIndicator } from './hooks/useTypingIndicator';

// Types
export type {
  Conversation,
  ConversationParticipant,
  Message,
  MessageReaction,
  CallState,
  CallType,
  CallSession,
  RemoteUser,
  MediaDevice,
  NetworkQuality,
  ChatSettings,
  TypingUser,
  UserProfile,
} from './types';
