import type { SupabaseClient, User } from '@supabase/supabase-js';

export type FunStorageConfig = {
  provider: 'supabase' | 'r2';
  bucket?: string;
};

export type FunFeatureFlags = {
  calls?: boolean;
  attachments?: boolean;
  reactions?: boolean;
  readReceipts?: boolean;
};

export type FunChatConfig = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  supabaseClient?: SupabaseClient;
  agoraAppId?: string;
  tokenEndpoint?: string;
  tokenEndpointHeaders?: Record<string, string>;
  storage?: FunStorageConfig;
  features?: FunFeatureFlags;
  ui?: {
    className?: string;
    emptyStateText?: string;
  };
  callbacks?: {
    onRequireAuth?: () => void;
    onOpenConversation?: (conversationId: string) => void;
    onError?: (error: unknown) => void;
  };
};

export type FunChatResolvedFeatures = {
  calls: boolean;
  attachments: boolean;
  reactions: boolean;
  readReceipts: boolean;
};

export type UserProfile = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  full_name: string | null;
};

export type ConversationType = 'direct' | 'group';

export type Conversation = {
  id: string;
  type: ConversationType;
  name: string | null;
  avatar_url: string | null;
  created_by: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  created_at: string | null;
  updated_at: string | null;
  participants?: ConversationParticipant[];
};

export type ConversationParticipant = {
  id: string;
  conversation_id: string;
  user_id: string;
  role: string | null;
  nickname: string | null;
  joined_at: string | null;
  left_at: string | null;
  profile?: UserProfile;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  media_urls: unknown;
  reply_to_id: string | null;
  is_deleted: boolean | null;
  deleted_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  sender?: UserProfile;
};

export type CallType = 'voice' | 'video';
export type CallStatus = 'idle' | 'ringing' | 'connected' | 'ended';

export type CallSession = {
  id: string;
  conversation_id: string;
  initiator_id: string;
  call_type: CallType;
  status: string;
  channel_name: string;
  started_at?: string | null;
  ended_at?: string | null;
};

export type AgoraTokenRequest = {
  channel: string;
  userAccount: string;
  role: 'publisher' | 'subscriber';
  expireSeconds?: number;
};

export type AgoraTokenResponse = {
  token: string;
  appId: string;
  channel: string;
  userAccount: string;
  role: 'publisher' | 'subscriber';
  expireAt?: number;
};

export type FunChatContextValue = {
  config: FunChatConfig;
  client: SupabaseClient;
  user: User | null;
  features: FunChatResolvedFeatures;
};