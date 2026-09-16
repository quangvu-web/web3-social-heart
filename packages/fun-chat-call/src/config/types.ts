import type { ReactElement } from 'react';

export interface FunChatUiText {
  emptyStateTitle?: string;
  loadingText?: string;
}

export interface FunChatRendererProps {
  className?: string;
}

export interface FunChatRenderers {
  ChatPanel?: (props?: FunChatRendererProps) => ReactElement;
  CallOverlay?: (props?: FunChatRendererProps) => ReactElement;
}

export interface FunChatConfig {
  appName?: string;
  basePath?: string;
  debug?: boolean;
  uiText?: FunChatUiText;
  renderers?: FunChatRenderers;
  onError?: (error: unknown) => void;
  onNavigate?: (path: string) => void;
}

export interface AgoraTokenParams {
  channelName: string;
  role: 'host' | 'audience' | 'publisher' | 'subscriber';
  uid?: string | number;
}

export interface AgoraTokenResult {
  token: string;
  appId: string;
  uid: string | number;
  channelName: string;
  expiresAt?: number;
}

export interface RealtimeSubscription {
  unsubscribe: () => void;
}

export interface MessagePayload {
  content?: string;
  mediaUrls?: Array<{ url: string; type: 'image' | 'video' | 'audio' | 'file' }>;
  replyToId?: string;
  metadata?: Record<string, unknown>;
}

export interface MessageCursorPage<TMessage = unknown> {
  items: TMessage[];
  nextCursor: string | null;
}
