# FUN CHAT FULL SOURCE BUNDLE

Ngay tao: 2026-02-17
Pham vi: Chat/messaging/call (Agora) + Supabase lien quan + Worker lien quan.
Quy tac copy-restore: Tao lai file dung duong dan sau moi FILE block, paste nguyen van noi dung trong code fence.

## MUC LUC

### App
- src/contexts/CallContext.tsx
- src/integrations/funChatCallAdapter.ts
- src/integrations/funChatCallRenderers.tsx
- src/lib/agoraRtc.ts
- src/modules/chat/components/BlockUserDialog.tsx
- src/modules/chat/components/CallControls.tsx
- src/modules/chat/components/CallRoom.tsx
- src/modules/chat/components/ChatInput.tsx
- src/modules/chat/components/ChatSettingsDialog.tsx
- src/modules/chat/components/ConversationList.tsx
- src/modules/chat/components/CreateGroupDialog.tsx
- src/modules/chat/components/CryptoGiftButton.tsx
- src/modules/chat/components/EditMessageDialog.tsx
- src/modules/chat/components/GroupSettingsDialog.tsx
- src/modules/chat/components/IncomingCallDialog.tsx
- src/modules/chat/components/MessageBubble.tsx
- src/modules/chat/components/MessageSearch.tsx
- src/modules/chat/components/MessageThread.tsx
- src/modules/chat/components/NewConversationDialog.tsx
- src/modules/chat/components/PreCallSettings.tsx
- src/modules/chat/components/RedEnvelopeCard.tsx
- src/modules/chat/components/RedEnvelopeClaimDialog.tsx
- src/modules/chat/components/RedEnvelopeDialog.tsx
- src/modules/chat/components/ReportDialog.tsx
- src/modules/chat/components/SendCryptoModal.tsx
- src/modules/chat/components/StickerPicker.tsx
- src/modules/chat/components/TypingIndicator.tsx
- src/modules/chat/components/VideoGrid.tsx
- src/modules/chat/hooks/useAgoraCall.ts
- src/modules/chat/hooks/useAngelInline.ts
- src/modules/chat/hooks/useBlocks.ts
- src/modules/chat/hooks/useChatNotifications.ts
- src/modules/chat/hooks/useChatSettings.ts
- src/modules/chat/hooks/useConversations.ts
- src/modules/chat/hooks/useGroupConversations.ts
- src/modules/chat/hooks/useMediaDevices.ts
- src/modules/chat/hooks/useMessages.ts
- src/modules/chat/hooks/usePins.ts
- src/modules/chat/hooks/useRedEnvelope.ts
- src/modules/chat/hooks/useReports.ts
- src/modules/chat/hooks/useStickers.ts
- src/modules/chat/hooks/useTypingIndicator.ts
- src/modules/chat/index.ts
- src/modules/chat/pages/Chat.tsx
- src/modules/chat/types/index.ts

### Packages
- packages/fun-chat/docs/BACKEND_REQUIREMENTS.md
- packages/fun-chat/package.json
- packages/fun-chat/postcss.config.cjs
- packages/fun-chat/README.md
- packages/fun-chat/scripts/copy-css.mjs
- packages/fun-chat/src/config/types.ts
- packages/fun-chat/src/context/FunChatContext.ts
- packages/fun-chat/src/FunChatApp.tsx
- packages/fun-chat/src/hooks/useAgoraCall.ts
- packages/fun-chat/src/hooks/useConversations.ts
- packages/fun-chat/src/hooks/useFunChat.ts
- packages/fun-chat/src/hooks/useGroupConversations.ts
- packages/fun-chat/src/hooks/useMessages.ts
- packages/fun-chat/src/index.ts
- packages/fun-chat/src/providers/FunChatProvider.tsx
- packages/fun-chat/src/services/tokenFetcher.ts
- packages/fun-chat/src/styles/fun-chat.css
- packages/fun-chat/src/ui/CallPanel.tsx
- packages/fun-chat/src/ui/ChatInput.tsx
- packages/fun-chat/src/ui/ConversationList.tsx
- packages/fun-chat/src/ui/CreateGroupDialog.tsx
- packages/fun-chat/src/ui/index.ts
- packages/fun-chat/src/ui/MessageThread.tsx
- packages/fun-chat/src/ui/NewConversationDialog.tsx
- packages/fun-chat/supabase/migrations/0001_fun_chat_core.sql
- packages/fun-chat/tsconfig.json
- packages/fun-chat/tsup.config.ts
- packages/fun-chat-call/examples/host-app-snippet.tsx
- packages/fun-chat-call/examples/vite-smoke/index.html
- packages/fun-chat-call/examples/vite-smoke/package.json
- packages/fun-chat-call/examples/vite-smoke/src/App.tsx
- packages/fun-chat-call/examples/vite-smoke/src/main.tsx
- packages/fun-chat-call/examples/vite-smoke/tsconfig.json
- packages/fun-chat-call/examples/vite-smoke/vite.config.ts
- packages/fun-chat-call/package.json
- packages/fun-chat-call/PLAN.md
- packages/fun-chat-call/README.md
- packages/fun-chat-call/src/adapters/ChatCallAdapter.ts
- packages/fun-chat-call/src/config/types.ts
- packages/fun-chat-call/src/hooks/useCall.ts
- packages/fun-chat-call/src/hooks/useFunChat.ts
- packages/fun-chat-call/src/hooks/useMessages.ts
- packages/fun-chat-call/src/hooks/usePresence.ts
- packages/fun-chat-call/src/index.ts
- packages/fun-chat-call/src/provider/FunChatProvider.tsx
- packages/fun-chat-call/src/services/agoraClient.ts
- packages/fun-chat-call/src/services/rtcState.ts
- packages/fun-chat-call/src/services/tokenFetcher.ts
- packages/fun-chat-call/src/ui/CallOverlay.tsx
- packages/fun-chat-call/src/ui/ChatPanel.tsx
- packages/fun-chat-call/tsconfig.json
- packages/fun-chat-call/tsup.config.ts

### Supabase
- supabase/config.toml
- supabase/functions/_shared/jwt.ts
- supabase/functions/agora-token/index.ts
- supabase/functions/angel-inline/index.ts
- supabase/functions/live-token/index.ts
- supabase/migrations/20260210120000_chat_pins_search.sql
- supabase/migrations/20260210120500_chat_block_report.sql
- supabase/migrations/20260210121000_chat_stickers_edit.sql
- supabase/migrations/20260210121500_chat_red_envelope.sql
- supabase/migrations/20260210121800_chat_message_preview.sql
- supabase/migrations/20260211103000_live_sessions_mvp.sql
- supabase/migrations/20260211114000_live_recording_e2e.sql
- supabase/migrations/20260211120000_chat_preview_on_update.sql
- supabase/migrations/20260211121000_live_recording_alignment.sql
- supabase/migrations/20260215010000_live_stream_mvp_phase0.sql
- supabase/migrations/20260215173000_live_replay_backfill.sql
- supabase/migrations/20260215194000_live_recording_rpc_no_service_role.sql

### Worker
- worker/package.json
- worker/README.md
- worker/src/cors.ts
- worker/src/index.ts
- worker/src/recording.ts
- worker/src/upload.ts
- worker/src/validate.ts
- worker/tsconfig.json
- worker/wrangler.toml

## SOURCE DUMP

### FILE: src/contexts/CallContext.tsx
~~~tsx
/**
 * Global Call Context
 * Listens for incoming calls across all pages, not just the chat page.
 * Wraps the entire app to enable receiving calls from anywhere.
 */

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { IncomingCallDialog } from '@/modules/chat/components/IncomingCallDialog';
import type { CallSession, CallType } from '@/modules/chat/types';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

interface CallContextValue {
  incomingCall: CallSession | null;
  answerCall: () => void;
  declineCall: () => void;
}

const CallContext = createContext<CallContextValue | undefined>(undefined);

export function useGlobalCall() {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useGlobalCall must be used within a CallProvider');
  }
  return context;
}

interface CallProviderProps {
  children: ReactNode;
  renderIncomingDialog?: boolean;
}

export function CallProvider({ children, renderIncomingDialog = true }: CallProviderProps) {
  const [userId, setUserId] = useState<string | null>(null);
  const [incomingCall, setIncomingCall] = useState<CallSession | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Get current user ID
  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUserId(session?.user?.id || null);
    };
    
    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUserId(session?.user?.id || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Handle answer call - navigate to chat and let the chat page handle the actual connection
  const answerCall = useCallback(() => {
    if (!incomingCall) return;
    
    const callId = incomingCall.id;
    const conversationId = incomingCall.conversation_id;
    
    // Navigate to the conversation with answer parameter
    navigate(`/chat/${conversationId}?answer=${callId}`);
    
    // Delay clearing the incoming call to ensure navigation completes
    setTimeout(() => {
      setIncomingCall(null);
    }, 500);
  }, [incomingCall, navigate]);

  // Handle decline call
  const declineCall = useCallback(async () => {
    if (!incomingCall) return;

    try {
      await supabase
        .from('call_sessions')
        .update({ status: 'declined', ended_at: new Date().toISOString() })
        .eq('id', incomingCall.id);

      setIncomingCall(null);
    } catch (error) {
      console.error('Failed to decline call:', error);
    }
  }, [incomingCall]);

  // Subscribe to incoming calls globally
  useEffect(() => {
    if (!userId) return;

    console.log('[CallContext] Setting up global call listener for user:', userId);

    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    (async () => {
      // Scope the subscription to conversations the user is currently a member of.
      const { data: rows, error } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', userId)
        .is('left_at', null);

      if (cancelled) return;
      if (error) {
        console.error('[CallContext] Failed to load conversation ids:', error);
        return;
      }

      const conversationIds = (rows || []).map((r: any) => r.conversation_id).filter(Boolean);
      if (!conversationIds.length) return;

      const inFilter = `conversation_id=in.(${conversationIds.join(',')})`;

      channel = supabase
        .channel(`global-incoming-calls:${userId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'call_sessions', filter: inFilter },
          (payload) => {
            const session = payload.new as any;

            // Skip if we're the initiator
            if (session.initiator_id === userId) return;

            // Only show ringing calls
            if (session.status !== 'ringing') return;

            console.log('[CallContext] Incoming call detected:', session.id);

            const typedSession: CallSession = {
              ...session,
              call_type: session.call_type as CallType,
            };
            setIncomingCall(typedSession);
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'call_sessions', filter: inFilter },
          (payload) => {
            const session = payload.new as any;

            // If the incoming call was cancelled/ended by caller
            if (incomingCall?.id === session.id && ['ended', 'declined', 'missed'].includes(session.status)) {
              console.log('[CallContext] Incoming call cancelled:', session.status);
              setIncomingCall(null);

              if (session.status === 'missed') {
                toast({
                  title: 'Cuộc gọi nhỡ',
                  description: 'Bạn đã bỏ lỡ một cuộc gọi',
                });
              }
            }
          }
        )
        .subscribe();
    })();

    return () => {
      console.log('[CallContext] Cleaning up global call listener');
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [userId, incomingCall, toast]);

  return (
    <CallContext.Provider value={{ incomingCall, answerCall, declineCall }}>
      {children}
      {renderIncomingDialog ? (
        <IncomingCallDialog
          callSession={incomingCall}
          onAnswer={answerCall}
          onDecline={declineCall}
        />
      ) : null}
    </CallContext.Provider>
  );
}

~~~

### FILE: src/integrations/funChatCallAdapter.ts
~~~ts
import type { ChatCallAdapter } from '@fun/chat-call';
import { supabase } from '@/integrations/supabase/client';
import { getAgoraRtcToken } from '@/lib/agoraRtc';

const PAGE_SIZE = 30;

export const funChatCallAdapter: ChatCallAdapter = {
  getAuth: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    return {
      userId: session?.user?.id ?? null,
      accessToken: session?.access_token ?? null,
    };
  },

  fetchAgoraToken: async ({ channelName, role, uid }) => {
    const token = await getAgoraRtcToken(channelName, role);
    return {
      token: token.token,
      appId: token.appId,
      uid: uid ?? token.userAccount,
      channelName,
      expiresAt: token.expiresAt,
    };
  },

  fetchChatHistory: async (conversationId, cursor) => {
    const pageIndex = Number(cursor ?? 0);
    const from = pageIndex * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    return {
      items: (data ?? []) as any[],
      nextCursor: (data?.length ?? 0) === PAGE_SIZE ? String(pageIndex + 1) : null,
    };
  },

  sendMessage: async (conversationId, payload) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('messages')
      .insert([{
        conversation_id: conversationId,
        sender_id: user.id,
        content: payload.content?.trim() || null,
        media_urls: payload.mediaUrls?.map((m) => m.url) ?? [],
        reply_to_id: payload.replyToId ?? null,
        metadata: (payload.metadata ?? {}) as any,
      }])
      .select('*')
      .single();

    if (error) throw error;
    return data;
  },

  subscribeRealtime: (conversationId, handlers) => {
    const channel = supabase
      .channel(`fun-chat-call:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          handlers.onMessage?.(payload.new);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          handlers.onMessageUpdated?.(payload.new);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const oldRow = payload.old as { id?: string };
          if (oldRow?.id) handlers.onMessageDeleted?.(oldRow.id);
        }
      )
      .subscribe();

    return {
      unsubscribe: () => {
        void supabase.removeChannel(channel);
      },
    };
  },

  uploadAttachment: async (file) => {
    const sanitizedName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
    const path = `chat/${sanitizedName}`;

    const { error } = await supabase.storage.from('chat-media').upload(path, file, {
      upsert: false,
      contentType: file.type,
    });

    if (error) throw error;

    const { data } = supabase.storage.from('chat-media').getPublicUrl(path);

    return {
      url: data.publicUrl,
      type: file.type,
    };
  },
};
~~~

### FILE: src/integrations/funChatCallRenderers.tsx
~~~tsx
import Chat from '@/modules/chat/pages/Chat';
import { IncomingCallDialog } from '@/modules/chat/components/IncomingCallDialog';
import { useGlobalCall } from '@/contexts/CallContext';

export function HostChatPanelRenderer() {
  return <Chat />;
}

export function HostCallOverlayRenderer() {
  const { incomingCall, answerCall, declineCall } = useGlobalCall();

  return (
    <IncomingCallDialog
      callSession={incomingCall}
      onAnswer={answerCall}
      onDecline={declineCall}
    />
  );
}
~~~

### FILE: src/lib/agoraRtc.ts
~~~ts
import AgoraRTC, { IAgoraRTCClient } from 'agora-rtc-sdk-ng';
import { supabase } from '@/integrations/supabase/client';

export type AgoraRtcRole = 'host' | 'audience' | 'publisher' | 'subscriber';

interface AgoraTokenResponse {
  appId: string;
  token: string;
  userAccount: string | number;
  expiresAt: number;
}

interface AgoraEdgeTokenResponse {
  token: string;
  app_id: string;
  uid: number;
  channel: string;
  expires_at: number;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function ensureAgoraEdgePayload(payload: any): asserts payload is AgoraEdgeTokenResponse {
  if (!payload?.token || !payload?.app_id || payload?.uid === undefined) {
    throw new Error('Invalid Agora token response');
  }
}

export async function getAgoraRtcToken(
  channelName: string,
  _role: AgoraRtcRole
): Promise<AgoraTokenResponse> {
  const { data, error } = await withTimeout(
    supabase.functions.invoke('agora-token', {
      body: { channel_name: channelName },
    }),
    8000,
    'agora-token timeout'
  );
  if (error) throw error;
  const payload = data as AgoraEdgeTokenResponse;
  ensureAgoraEdgePayload(payload);
  return {
    appId: payload.app_id,
    token: payload.token,
    userAccount: payload.uid,
    expiresAt: payload.expires_at,
  };
}

export function createAgoraRtcClient(mode: 'rtc' | 'live' = 'rtc'): IAgoraRTCClient {
  return AgoraRTC.createClient({ mode, codec: 'vp8' });
}

export async function getAgoraRtcTokenFromEdge(channelName: string): Promise<{
  token: string;
  appId: string;
  uid: number;
}> {
  const { data, error } = await withTimeout(
    supabase.functions.invoke('agora-token', {
      body: { channel_name: channelName },
    }),
    8000,
    'agora-token timeout'
  );
  if (error) throw error;
  const payload = data as AgoraEdgeTokenResponse;
  ensureAgoraEdgePayload(payload);
  return {
    token: payload.token,
    appId: payload.app_id,
    uid: payload.uid,
  };
}

export async function getAgoraRtcTokenForLive(
  channelName: string,
  role: AgoraRtcRole = 'host'
): Promise<{ token: string; appId: string; userAccount: string | number }> {
  return getAgoraRtcToken(channelName, role);
}

export async function getLiveToken(
  sessionId: string,
  role: 'host' | 'audience'
): Promise<{ token: string; channel: string; uid: string; appId: string; expiresAt: number }> {
  try {
    const { data, error } = await withTimeout(
      supabase.functions.invoke('live-token', {
        body: { session_id: sessionId, role },
      }),
      8000,
      'live-token timeout'
    );
    if (error) throw error;

    const payload = data as {
      token?: string;
      channel?: string;
      uid?: string;
      appId?: string;
      expiresAt?: number;
    };

    if (!payload?.token || !payload?.channel || !payload?.uid || !payload?.appId) {
      throw new Error('Invalid live token response');
    }

    return {
      token: payload.token,
      channel: payload.channel,
      uid: payload.uid,
      appId: payload.appId,
      expiresAt: payload.expiresAt ?? Math.floor(Date.now() / 1000) + 3600,
    };
  } catch (error) {
    console.warn('[live-token] fallback -> agora-token', error);

    const { data: liveSession, error: sessionError } = await withTimeout(
      supabase
        .from('live_sessions')
        .select('channel_name, agora_channel, status, host_user_id')
        .eq('id', sessionId)
        .maybeSingle() as unknown as Promise<{ data: any; error: any }>,
      5000,
      'live session lookup timeout'
    );

    if (sessionError || !liveSession) {
      throw sessionError || new Error('Live session not found');
    }
    if (liveSession.status !== 'live') {
      throw new Error('Live session has ended');
    }

    const channel = liveSession.agora_channel || liveSession.channel_name;
    if (!channel) {
      throw new Error('Live channel not found');
    }
    if (role === 'host') {
      const {
        data: { session },
      } = await withTimeout(supabase.auth.getSession(), 5000, 'auth session timeout');
      if (!session?.user?.id) {
        throw new Error('Not authenticated');
      }
      if (liveSession.host_user_id !== session.user.id) {
        throw new Error('Only host can start this live');
      }
    }

    const fallback = await withTimeout(getAgoraRtcTokenFromEdge(channel), 8000, 'agora-token timeout');
    return {
      token: fallback.token,
      channel,
      uid: String(fallback.uid),
      appId: fallback.appId,
      expiresAt: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
    };
  }
}

export function secondsUntilExpiry(expiresAt?: number): number {
  if (!expiresAt) return 0;
  return Math.max(0, expiresAt - Math.floor(Date.now() / 1000));
}
~~~

### FILE: src/modules/chat/components/BlockUserDialog.tsx
~~~tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface BlockUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  username: string;
  isBlocking: boolean;
  onConfirm: () => void;
  mode: 'block' | 'unblock';
}

export function BlockUserDialog({
  open,
  onOpenChange,
  username,
  isBlocking,
  onConfirm,
  mode,
}: BlockUserDialogProps) {
  const title = mode === 'block' ? 'Tạm ngừng kết nối' : 'Kết nối lại';
  const body =
    mode === 'block'
      ? `Bạn có chắc muốn tạm ngừng kết nối với ${username}? Bạn sẽ không thể nhắn tin trực tiếp với nhau.`
      : `Bạn có muốn kết nối lại với ${username}?`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="text-sm text-muted-foreground">{body}</div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isBlocking}>
            Hủy
          </Button>
          <Button
            variant={mode === 'block' ? 'destructive' : 'default'}
            onClick={onConfirm}
            disabled={isBlocking}
          >
            {isBlocking ? 'Đang xử lý...' : mode === 'block' ? 'Tạm ngừng' : 'Kết nối lại'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

~~~

### FILE: src/modules/chat/components/CallControls.tsx
~~~tsx
import { Button } from '@/components/ui/button';
import { 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  PhoneOff,
  Camera,
  SwitchCamera,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/shared/hooks/use-mobile';

interface CallControlsProps {
  isMuted: boolean;
  isCameraOff: boolean;
  isVideoCall: boolean;
  hasMultipleCameras?: boolean;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onSwitchToVideo?: () => void;
  onFlipCamera?: () => void;
  onOpenSettings?: () => void;
  onEndCall: () => void;
}

export function CallControls({
  isMuted,
  isCameraOff,
  isVideoCall,
  hasMultipleCameras = false,
  onToggleMute,
  onToggleCamera,
  onSwitchToVideo,
  onFlipCamera,
  onOpenSettings,
  onEndCall,
}: CallControlsProps) {
  const isMobile = useIsMobile();

  return (
    <div className="flex items-center justify-center gap-3 sm:gap-4 p-3 sm:p-4 bg-background/80 backdrop-blur-sm rounded-full">
      {/* Mute button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggleMute}
        className={cn(
          'h-11 w-11 sm:h-12 sm:w-12 rounded-full',
          isMuted && 'bg-destructive/20 text-destructive hover:bg-destructive/30'
        )}
      >
        {isMuted ? <MicOff className="h-5 w-5 sm:h-6 sm:w-6" /> : <Mic className="h-5 w-5 sm:h-6 sm:w-6" />}
      </Button>

      {/* Camera toggle (for video calls) */}
      {isVideoCall && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleCamera}
          className={cn(
            'h-11 w-11 sm:h-12 sm:w-12 rounded-full',
            isCameraOff && 'bg-destructive/20 text-destructive hover:bg-destructive/30'
          )}
        >
          {isCameraOff ? <VideoOff className="h-5 w-5 sm:h-6 sm:w-6" /> : <Video className="h-5 w-5 sm:h-6 sm:w-6" />}
        </Button>
      )}

      {/* Flip camera button (only on mobile with multiple cameras) */}
      {isVideoCall && !isCameraOff && hasMultipleCameras && isMobile && onFlipCamera && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onFlipCamera}
          className="h-11 w-11 sm:h-12 sm:w-12 rounded-full"
        >
          <SwitchCamera className="h-5 w-5 sm:h-6 sm:w-6" />
        </Button>
      )}

      {/* Settings button (on desktop or when multiple cameras available) */}
      {onOpenSettings && (!isMobile || (hasMultipleCameras && !isMobile)) && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenSettings}
          className="h-11 w-11 sm:h-12 sm:w-12 rounded-full"
        >
          <Settings className="h-5 w-5 sm:h-6 sm:w-6" />
        </Button>
      )}

      {/* Switch to video (for voice calls) */}
      {!isVideoCall && onSwitchToVideo && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onSwitchToVideo}
          className="h-11 w-11 sm:h-12 sm:w-12 rounded-full"
        >
          <Camera className="h-5 w-5 sm:h-6 sm:w-6" />
        </Button>
      )}

      {/* End call button */}
      <Button
        variant="destructive"
        size="icon"
        onClick={onEndCall}
        className="h-12 w-12 sm:h-14 sm:w-14 rounded-full"
      >
        <PhoneOff className="h-5 w-5 sm:h-6 sm:w-6" />
      </Button>
    </div>
  );
}
~~~

### FILE: src/modules/chat/components/CallRoom.tsx
~~~tsx
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CallControls } from './CallControls';
import { VideoGrid } from './VideoGrid';
import { ICameraVideoTrack } from 'agora-rtc-sdk-ng';
import { Phone, Video, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CallState, CallType, RemoteUser } from '../types';

interface CallRoomProps {
  isOpen: boolean;
  callState: CallState;
  callType: CallType;
  callDuration: number;
  localVideoTrack: ICameraVideoTrack | null;
  remoteUsers: RemoteUser[];
  isMuted: boolean;
  isCameraOff: boolean;
  hasMultipleCameras?: boolean;
  localUserInfo?: {
    username?: string;
    avatarUrl?: string;
  };
  remoteUserInfo?: {
    username?: string;
    avatarUrl?: string;
  };
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onSwitchToVideo?: () => void;
  onFlipCamera?: () => void;
  onOpenSettings?: () => void;
  onEndCall: () => void;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function CallRoom({
  isOpen,
  callState,
  callType,
  callDuration,
  localVideoTrack,
  remoteUsers,
  isMuted,
  isCameraOff,
  hasMultipleCameras = false,
  localUserInfo,
  remoteUserInfo,
  onToggleMute,
  onToggleCamera,
  onSwitchToVideo,
  onFlipCamera,
  onOpenSettings,
  onEndCall,
}: CallRoomProps) {
  const isConnected = callState === 'connected';
  const isConnecting = callState === 'connecting' || callState === 'calling' || callState === 'ringing';
  const isVideoCall = callType === 'video';

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent 
        className="max-w-none w-screen h-screen p-0 border-none bg-background [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <div className="relative w-full h-full flex flex-col">
          {/* Top bar with call info */}
          <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-background/70 to-transparent">
            <div className="flex items-center gap-3">
              <div className={cn(
                'px-3 py-1 rounded-full text-sm font-medium',
                isConnected ? 'bg-primary/20 text-primary' : 'bg-secondary text-secondary-foreground'
              )}>
                {isConnected ? (
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                    {formatDuration(callDuration)}
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {callState === 'ringing' ? 'Đang đổ chuông...' : 'Đang kết nối...'}
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2 text-foreground">
              {isVideoCall ? <Video className="h-5 w-5" /> : <Phone className="h-5 w-5" />}
              <span className="text-sm">{isVideoCall ? 'Video Call' : 'Voice Call'}</span>
            </div>
          </div>

          {/* Main content area */}
          <div className="flex-1 relative">
            {isVideoCall && isConnected ? (
              <VideoGrid
                localVideoTrack={localVideoTrack}
                remoteUsers={remoteUsers}
                isLocalCameraOff={isCameraOff}
                isLocalMuted={isMuted}
                localUserInfo={localUserInfo}
                remoteUserInfo={remoteUserInfo}
              />
            ) : (
              // Voice call or connecting state - show avatars
              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-muted to-background">
                {/* Remote user avatar */}
                <div className="relative">
                  {isConnecting && (
                    <div className="absolute inset-0 animate-ping rounded-full bg-primary/30" style={{ width: '160px', height: '160px', margin: '-8px' }} />
                  )}
                  <Avatar className="h-36 w-36 ring-4 ring-background shadow-2xl">
                    <AvatarImage src={remoteUserInfo?.avatarUrl} />
                    <AvatarFallback className="text-5xl bg-primary text-primary-foreground">
                      {(remoteUserInfo?.username || 'U')[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </div>

                <h2 className="mt-6 text-2xl font-semibold text-foreground">
                  {remoteUserInfo?.username || 'Người dùng'}
                </h2>

                <p className="mt-2 text-muted-foreground">
                  {isConnected ? (
                    formatDuration(callDuration)
                  ) : callState === 'ringing' ? (
                    'Đang đổ chuông...'
                  ) : (
                    'Đang kết nối...'
                  )}
                </p>

                {/* Show local user small avatar */}
                <div className="absolute bottom-32 right-6">
                  <Avatar className="h-20 w-20 ring-2 ring-background shadow-lg">
                    <AvatarImage src={localUserInfo?.avatarUrl} />
                    <AvatarFallback className="text-xl">
                      {(localUserInfo?.username || 'Me')[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-xs bg-background/50 text-foreground px-2 py-0.5 rounded">
                    Bạn
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Bottom controls */}
          <div className="absolute bottom-8 left-0 right-0 flex justify-center">
            <CallControls
              isMuted={isMuted}
              isCameraOff={isCameraOff}
              isVideoCall={isVideoCall}
              hasMultipleCameras={hasMultipleCameras}
              onToggleMute={onToggleMute}
              onToggleCamera={onToggleCamera}
              onSwitchToVideo={!isVideoCall ? onSwitchToVideo : undefined}
              onFlipCamera={onFlipCamera}
              onOpenSettings={onOpenSettings}
              onEndCall={onEndCall}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
~~~

### FILE: src/modules/chat/components/ChatInput.tsx
~~~tsx
import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { FileText, Paperclip, Send, X, Gift } from 'lucide-react';
import { cn } from '@/lib/utils';
import { uploadCommentMedia } from '@/utils/mediaUpload';
import { toast } from 'sonner';
import { EmojiPicker } from '@/components/feed/EmojiPicker';
import { CryptoGiftButton } from './CryptoGiftButton';
import { rewriteChatAttachmentUrl } from '@/lib/urlFix';
import type { Message } from '../types';
import type { Sticker } from '../types';
import { StickerPicker } from './StickerPicker';
import { RedEnvelopeDialog } from './RedEnvelopeDialog';

interface ChatInputProps {
  onSend: (content: string, mediaUrls?: string[]) => Promise<void>;
  onSendSticker?: (sticker: Sticker) => Promise<void>;
  onCreateRedEnvelope?: (input: { token: 'CAMLY' | 'BNB'; totalAmount: number; totalCount: number }) => Promise<void>;
  onTyping: (isTyping: boolean) => void;
  replyTo: Message | null;
  onCancelReply: () => void;
  isSending: boolean;
  recipientWalletAddress?: string | null;
  recipientUserId?: string | null;
  recipientName?: string | null;
  recipientAvatar?: string | null;
  conversationId?: string | null;
  isGroup?: boolean;
  disabled?: boolean;
  disabledReason?: string;
}

export function ChatInput({
  onSend,
  onSendSticker,
  onCreateRedEnvelope,
  onTyping,
  replyTo,
  onCancelReply,
  isSending,
  recipientWalletAddress,
  recipientUserId,
  recipientName,
  recipientAvatar,
  conversationId,
  isGroup = false,
  disabled = false,
  disabledReason,
}: ChatInputProps) {
  const [content, setContent] = useState('');
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [mediaPreviews, setMediaPreviews] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showRedEnvelope, setShowRedEnvelope] = useState(false);
  const [isCreatingEnvelope, setIsCreatingEnvelope] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isImageFile = (file: File | undefined) => {
    if (!file) return false;
    if (file.type.startsWith('image/')) return true;
    const ext = file.name.split('.').pop()?.toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'heic'].includes(ext || '');
  };

  const isVideoFile = (file: File | undefined) => {
    if (!file) return false;
    if (file.type.startsWith('video/')) return true;
    const ext = file.name.split('.').pop()?.toLowerCase();
    return ['mp4', 'webm', 'mov', 'm4v'].includes(ext || '');
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    onTyping(true);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Limit to 4 files
    const newFiles = files.slice(0, 4 - mediaFiles.length);
    if (files.length > newFiles.length) {
      toast.warning('Tối đa 4 file mỗi tin nhắn');
    }

    // Create previews for images/videos only
    const newPreviews = newFiles.map((file) =>
      isImageFile(file) || isVideoFile(file)
        ? URL.createObjectURL(file)
        : ''
    );
    
    setMediaFiles((prev) => [...prev, ...newFiles]);
    setMediaPreviews((prev) => [...prev, ...newPreviews]);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeMedia = (index: number) => {
    if (mediaPreviews[index]) {
      URL.revokeObjectURL(mediaPreviews[index]);
    }
    setMediaFiles((prev) => prev.filter((_, i) => i !== index));
    setMediaPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    const trimmedContent = content.trim();
    if (!trimmedContent && mediaFiles.length === 0) return;

    try {
      setIsUploading(true);

      // Upload media files
      let uploadedUrls: string[] = [];
      if (mediaFiles.length > 0) {
        const uploadPromises = mediaFiles.map((file) => uploadCommentMedia(file));
        const results = await Promise.all(uploadPromises);
        uploadedUrls = results.map((r) => rewriteChatAttachmentUrl(r.url));
      }

      await onSend(trimmedContent, uploadedUrls.length > 0 ? uploadedUrls : undefined);

      // Clear input
      setContent('');
      setMediaFiles([]);
      mediaPreviews.forEach((url) => URL.revokeObjectURL(url));
      setMediaPreviews([]);
      onTyping(false);

    } catch (error) {
      console.error('Error sending message:', error);
      if (error instanceof Error && error.message === 'FILE_TYPE_NOT_SUPPORTED') {
        toast.error('File này chưa được hỗ trợ hoặc thiếu MIME. Vui lòng thử lại hoặc đổi định dạng.');
      } else {
        toast.error('Không thể gửi tin nhắn');
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEmojiSelect = useCallback((emoji: string) => {
    setContent((prev) => prev + emoji);
    textareaRef.current?.focus();
  }, []);

  const isDisabled = isSending || isUploading;
  const canSend = (content.trim() || mediaFiles.length > 0) && !isDisabled && !disabled;
  const isGiftDisabled = isGroup || !recipientWalletAddress;

  return (
    <div className="border-t bg-card p-3">
      {disabled && disabledReason && (
        <div className="mb-2 text-xs text-destructive">{disabledReason}</div>
      )}
      {!isGroup && !recipientWalletAddress && (
        <div className="mb-2 text-xs text-muted-foreground">
          Người dùng chưa cập nhật ví Web3. Không thể tặng tiền.
        </div>
      )}
      {/* Reply preview */}
      {replyTo && (
        <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-muted rounded-lg">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">
              Trả lời {replyTo.sender?.username}
            </p>
            <p className="text-sm truncate">{replyTo.content}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onCancelReply}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Media previews */}
      {mediaPreviews.length > 0 && (
        <div className="flex gap-2 mb-2 overflow-x-auto pb-2">
          {mediaPreviews.map((preview, index) => {
            const file = mediaFiles[index];
            const isImage = isImageFile(file);
            const isVideo = isVideoFile(file);
            return (
              <div key={index} className="relative flex-shrink-0">
                {isImage && preview ? (
                  <img
                    src={preview}
                    alt=""
                    className="h-16 w-16 object-cover rounded-lg"
                  />
                ) : isVideo && preview ? (
                  <video
                    src={preview}
                    className="h-16 w-16 object-cover rounded-lg"
                    muted
                    playsInline
                  />
                ) : (
                  <div className="h-16 w-32 rounded-lg border bg-muted flex items-center gap-2 px-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs truncate">{file?.name || 'File'}</span>
                  </div>
                )}
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute -top-1 -right-1 h-5 w-5 rounded-full"
                  onClick={() => removeMedia(index)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Input area */}
      <div className="flex items-end gap-2">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar,.apk"
          multiple
          className="hidden"
        />

        <Button
          variant="ghost"
          size="icon"
          className="flex-shrink-0 border border-[#C9A84C]/30 hover:border-[#C9A84C]/60 rounded-full"
          onClick={() => fileInputRef.current?.click()}
          disabled={isDisabled || disabled || mediaFiles.length >= 4}
        >
          <Paperclip className="h-5 w-5" />
        </Button>

        <EmojiPicker onEmojiSelect={handleEmojiSelect} />

        <StickerPicker
          disabled={isDisabled || disabled}
          onSelect={async (sticker) => {
            if (!onSendSticker) return;
            await onSendSticker(sticker);
          }}
        />

        <Button
          variant="ghost"
          size="icon"
          className="flex-shrink-0 border border-[#C9A84C]/30 hover:border-[#C9A84C]/60 rounded-full"
          onClick={() => setShowRedEnvelope(true)}
          disabled={isDisabled || disabled}
          title="Lì xì"
        >
          <Gift className="h-5 w-5 text-[#C9A84C]" />
        </Button>

        <CryptoGiftButton
          recipientAddress={recipientWalletAddress}
          recipientUserId={recipientUserId}
          recipientName={recipientName}
          recipientAvatar={recipientAvatar}
          conversationId={conversationId}
          disabled={isGiftDisabled}
        />

        <Textarea
          ref={textareaRef}
          value={content}
          onChange={handleContentChange}
          onKeyDown={handleKeyDown}
          placeholder="Nhập tin nhắn..."
          className="min-h-[40px] max-h-[120px] resize-none flex-1"
          rows={1}
          disabled={isDisabled || disabled}
        />

        <Button
          size="icon"
          onClick={handleSend}
          disabled={!canSend}
          className={cn(
            'flex-shrink-0 transition-colors',
            canSend && 'bg-primary hover:bg-primary/90'
          )}
        >
          <Send className="h-5 w-5" />
        </Button>
      </div>

      <RedEnvelopeDialog
        open={showRedEnvelope}
        onOpenChange={setShowRedEnvelope}
        isCreating={isCreatingEnvelope}
        onCreate={async (input) => {
          if (!onCreateRedEnvelope) return;
          try {
            setIsCreatingEnvelope(true);
            await onCreateRedEnvelope(input);
            setShowRedEnvelope(false);
          } finally {
            setIsCreatingEnvelope(false);
          }
        }}
      />
    </div>
  );
}



~~~

### FILE: src/modules/chat/components/ChatSettingsDialog.tsx
~~~tsx
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Settings, Eye, Keyboard, Users } from 'lucide-react';
import { useChatSettings, type ChatSettings } from '../hooks/useChatSettings';
import { toast } from 'sonner';

interface ChatSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
}

export function ChatSettingsDialog({
  open,
  onOpenChange,
  userId,
}: ChatSettingsDialogProps) {
  const { settings, updateSettings, isLoading } = useChatSettings(userId);

  const handleUpdate = async (updates: Partial<ChatSettings>) => {
    try {
      await updateSettings.mutateAsync(updates);
      toast.success('Đã cập nhật cài đặt');
    } catch (error) {
      console.error('Error updating settings:', error);
      toast.error('Không thể cập nhật cài đặt');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Cài đặt tin nhắn
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Who can message */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <Label>Ai có thể nhắn tin cho bạn</Label>
            </div>
            <Select
              value={settings?.who_can_message || 'friends'}
              onValueChange={(value) => handleUpdate({ who_can_message: value })}
              disabled={isLoading || updateSettings.isPending}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="everyone">Mọi người</SelectItem>
                <SelectItem value="friends">Chỉ bạn bè</SelectItem>
                <SelectItem value="nobody">Không ai</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Người ngoài danh sách sẽ không thể gửi tin nhắn mới cho bạn
            </p>
          </div>

          <Separator />

          {/* Read receipts */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="read-receipts">Xác nhận đã đọc</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Hiển thị khi bạn đã xem tin nhắn
              </p>
            </div>
            <Switch
              id="read-receipts"
              checked={settings?.show_read_receipts ?? true}
              onCheckedChange={(checked) => handleUpdate({ show_read_receipts: checked })}
              disabled={isLoading || updateSettings.isPending}
            />
          </div>

          <Separator />

          {/* Typing indicator */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Keyboard className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="typing-indicator">Trạng thái đang nhập</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Cho người khác biết khi bạn đang nhập
              </p>
            </div>
            <Switch
              id="typing-indicator"
              checked={settings?.show_typing_indicator ?? true}
              onCheckedChange={(checked) => handleUpdate({ show_typing_indicator: checked })}
              disabled={isLoading || updateSettings.isPending}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
~~~

### FILE: src/modules/chat/components/ConversationList.tsx
~~~tsx
import { useEffect, useRef } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { vi, enUS, zhCN, ja, ko, th, id, fr, es, de, pt, ru, ar } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/i18n/LanguageContext';
import { Users } from 'lucide-react';
import type { Locale } from 'date-fns';
import type { Conversation, ConversationParticipant } from '../types';

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  currentUserId: string | null;
  onSelect: (id: string) => void;
  isLoading: boolean;
}

const dateLocales: Record<string, Locale> = {
  vi, en: enUS, zh: zhCN, ja, ko, th, id, fr, es, de, pt, ru, ar
};
const conversationListScrollByUser = new Map<string, number>();

export function ConversationList({
  conversations,
  selectedId,
  currentUserId,
  onSelect,
  isLoading,
}: ConversationListProps) {
  const scrollRootRef = useRef<HTMLDivElement>(null);
  const { t, language } = useLanguage();
  const dateLocale = dateLocales[language] || enUS;

  useEffect(() => {
    const root = scrollRootRef.current as any;
    if (!root) return;

    const viewport = root.querySelector?.('[data-radix-scroll-area-viewport]') as HTMLDivElement | null;
    if (!viewport) return;

    const key = currentUserId || 'anonymous';
    const cachedTop = conversationListScrollByUser.get(key);
    if (typeof cachedTop === 'number') {
      viewport.scrollTop = cachedTop;
    }

    const onScroll = () => {
      conversationListScrollByUser.set(key, viewport.scrollTop);
    };

    viewport.addEventListener('scroll', onScroll);
    return () => {
      conversationListScrollByUser.set(key, viewport.scrollTop);
      viewport.removeEventListener('scroll', onScroll);
    };
  }, [currentUserId]);

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-3 w-40" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 text-muted-foreground">
        <p>{t('noConversations')}</p>
      </div>
    );
  }

  return (
    <ScrollArea ref={scrollRootRef} className="flex-1">
      <div className="p-2">
        {conversations.map((conversation) => {
          const isGroup = conversation.type === 'group';
          const otherParticipant = conversation.participants?.find(
            (p: ConversationParticipant) => p.user_id !== currentUserId && !p.left_at
          );
          const profile = otherParticipant?.profile;
          const participantCount = conversation.participants?.filter(
            (p: ConversationParticipant) => !p.left_at
          ).length || 0;

          const displayName = isGroup
            ? conversation.name
            : profile?.full_name || profile?.username || t('user');

          const avatarUrl = isGroup
            ? conversation.avatar_url
            : profile?.avatar_url;

          return (
            <button
              key={conversation.id}
              onClick={() => onSelect(conversation.id)}
              className={cn(
                'w-full flex items-center gap-3 p-3 rounded-full text-left transition-all duration-300 border hover:bg-white hover:shadow-[0_0_12px_rgba(34,197,94,0.5)]',
                selectedId === conversation.id ? 'bg-primary/10 border-[#C9A84C]/60' : 'border-transparent hover:border-[#C9A84C]/40'
              )}
            >
              <div className="relative">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={avatarUrl || undefined} alt={displayName || ''} />
                  <AvatarFallback>
                    {isGroup ? (
                      <Users className="h-5 w-5" />
                    ) : (
                      (displayName || 'U')[0].toUpperCase()
                    )}
                  </AvatarFallback>
                </Avatar>
                {isGroup && (
                  <div className="absolute -bottom-1 -right-1 bg-primary rounded-full p-0.5">
                    <Users className="h-3 w-3 text-primary-foreground" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium truncate">{displayName}</span>
                    {isGroup && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {participantCount}
                      </Badge>
                    )}
                  </div>
                  {conversation.last_message_at && (
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {formatDistanceToNow(new Date(conversation.last_message_at), {
                        addSuffix: false,
                        locale: dateLocale,
                      })}
                    </span>
                  )}
                </div>
                {conversation.last_message_preview && (
                  <p className="text-sm text-muted-foreground truncate">
                    {conversation.last_message_preview}
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </ScrollArea>
  );
}
~~~

### FILE: src/modules/chat/components/CreateGroupDialog.tsx
~~~tsx
import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Search, Loader2, X, Users } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import { cn } from '@/lib/utils';

interface CreateGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId: string | null;
  onCreateGroup: (name: string, memberIds: string[]) => void;
  isCreating?: boolean;
}

interface User {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
}

export function CreateGroupDialog({
  open,
  onOpenChange,
  currentUserId,
  onCreateGroup,
  isCreating = false,
}: CreateGroupDialogProps) {
  const [groupName, setGroupName] = useState('');
  const [search, setSearch] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const debouncedSearch = useDebounce(search, 300);

  // Fetch friends
  const { data: friends, isLoading: friendsLoading } = useQuery({
    queryKey: ['friends-for-group', currentUserId],
    queryFn: async () => {
      if (!currentUserId) return [];

      const { data: friendships, error } = await supabase
        .from('friendships')
        .select('user_id, friend_id')
        .or(`user_id.eq.${currentUserId},friend_id.eq.${currentUserId}`)
        .eq('status', 'accepted');

      if (error) throw error;

      const friendIds = friendships?.map((f) =>
        f.user_id === currentUserId ? f.friend_id : f.user_id
      ) || [];

      if (friendIds.length === 0) return [];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .in('id', friendIds);

      return profiles || [];
    },
    enabled: open && !!currentUserId,
  });

  // Search users
  const { data: searchResults, isLoading: searchLoading } = useQuery({
    queryKey: ['search-users-group', debouncedSearch],
    queryFn: async () => {
      if (!debouncedSearch || debouncedSearch.length < 2) return [];

      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .neq('id', currentUserId)
        .or(`username.ilike.%${debouncedSearch}%,full_name.ilike.%${debouncedSearch}%`)
        .limit(10);

      if (error) throw error;
      return data || [];
    },
    enabled: open && debouncedSearch.length >= 2,
  });

  const displayUsers = useMemo(() => {
    const users = debouncedSearch.length >= 2 ? searchResults || [] : friends || [];
    return users.filter((u) => !selectedUsers.some((s) => s.id === u.id));
  }, [debouncedSearch, friends, searchResults, selectedUsers]);

  const isLoading = friendsLoading || searchLoading;

  const handleSelectUser = (user: User) => {
    setSelectedUsers((prev) => [...prev, user]);
    setSearch('');
  };

  const handleRemoveUser = (userId: string) => {
    setSelectedUsers((prev) => prev.filter((u) => u.id !== userId));
  };

  const handleCreate = () => {
    if (groupName.trim() && selectedUsers.length >= 1) {
      onCreateGroup(groupName.trim(), selectedUsers.map((u) => u.id));
      // Reset state
      setGroupName('');
      setSelectedUsers([]);
      setSearch('');
    }
  };

  const canCreate = groupName.trim().length > 0 && selectedUsers.length >= 1 && !isCreating;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Tạo nhóm mới
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Group name */}
          <Input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Tên nhóm..."
          />

          {/* Selected members */}
          {selectedUsers.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedUsers.map((user) => (
                <Badge
                  key={user.id}
                  variant="secondary"
                  className="flex items-center gap-1 pr-1"
                >
                  <Avatar className="h-4 w-4">
                    <AvatarImage src={user.avatar_url || undefined} />
                    <AvatarFallback className="text-[8px]">
                      {user.username[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span>{user.full_name || user.username}</span>
                  <button
                    onClick={() => handleRemoveUser(user.id)}
                    className="ml-1 hover:bg-muted rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Thêm thành viên..."
              className="pl-9"
            />
          </div>

          {/* User list */}
          <ScrollArea className="h-[200px]">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : displayUsers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                {debouncedSearch.length >= 2
                  ? 'Không tìm thấy người dùng'
                  : 'Chọn bạn bè để thêm vào nhóm'}
              </div>
            ) : (
              <div className="space-y-1">
                {displayUsers.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleSelectUser(user)}
                    className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors text-left"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.avatar_url || undefined} alt={user.username} />
                      <AvatarFallback>
                        {user.username[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{user.full_name || user.username}</p>
                      <p className="text-xs text-muted-foreground">@{user.username}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button onClick={handleCreate} disabled={!canCreate}>
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Đang tạo...
              </>
            ) : (
              'Tạo nhóm'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
~~~

### FILE: src/modules/chat/components/CryptoGiftButton.tsx
~~~tsx
import React, { useState } from 'react';
import { Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { SendCryptoModal } from './SendCryptoModal';

interface CryptoGiftButtonProps {
  recipientAddress?: string | null;
  recipientUserId?: string | null;
  recipientName?: string | null;
  recipientAvatar?: string | null;
  conversationId?: string | null;
  disabled?: boolean;
}

class CryptoGiftErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch() {
    toast.error('Wallet system not ready. Please refresh or reconnect.');
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

export function CryptoGiftButton({ 
  recipientAddress, 
  recipientUserId,
  recipientName,
  recipientAvatar,
  conversationId,
  disabled,
}: CryptoGiftButtonProps) {
  const [open, setOpen] = useState(false);
  const isDisabled = disabled || !recipientAddress;

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <Button
              variant="ghost"
              size="icon"
              className="flex-shrink-0 border border-[#C9A84C]/30 hover:border-[#C9A84C]/60 rounded-full"
              onClick={() => setOpen(true)}
              disabled={isDisabled}
            >
              <Wallet className="h-5 w-5 text-gold" />
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>Send crypto gift</TooltipContent>
      </Tooltip>

      <CryptoGiftErrorBoundary>
        <SendCryptoModal
          open={open}
          onOpenChange={setOpen}
          recipientAddress={recipientAddress}
          recipientUserId={recipientUserId}
          recipientName={recipientName}
          recipientAvatar={recipientAvatar}
          conversationId={conversationId}
        />
      </CryptoGiftErrorBoundary>
    </>
  );
}
~~~

### FILE: src/modules/chat/components/EditMessageDialog.tsx
~~~tsx
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface EditMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialValue: string;
  isSaving: boolean;
  onSave: (next: string) => void;
}

export function EditMessageDialog({
  open,
  onOpenChange,
  initialValue,
  isSaving,
  onSave,
}: EditMessageDialogProps) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (open) setValue(initialValue);
  }, [open, initialValue]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sửa tin nhắn</DialogTitle>
        </DialogHeader>
        <Textarea value={value} onChange={(e) => setValue(e.target.value)} className="min-h-[100px]" />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Hủy
          </Button>
          <Button onClick={() => onSave(value)} disabled={isSaving || !value.trim()}>
            {isSaving ? 'Đang lưu...' : 'Lưu'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

~~~

### FILE: src/modules/chat/components/GroupSettingsDialog.tsx
~~~tsx
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Settings, 
  UserMinus, 
  UserPlus, 
  LogOut, 
  Crown, 
  Loader2,
  ImagePlus,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import type { Conversation, ConversationParticipant } from '../types';

interface GroupSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversation: Conversation;
  currentUserId: string | null;
  onUpdate: () => void;
  onLeave: () => void;
}

export function GroupSettingsDialog({
  open,
  onOpenChange,
  conversation,
  currentUserId,
  onUpdate,
  onLeave,
}: GroupSettingsDialogProps) {
  const [groupName, setGroupName] = useState(conversation.name || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const participants = conversation.participants?.filter((p) => !p.left_at) || [];
  const currentParticipant = participants.find((p) => p.user_id === currentUserId);
  const isAdmin = currentParticipant?.role === 'admin';

  const handleUpdateName = async () => {
    if (!groupName.trim() || groupName === conversation.name) return;

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('conversations')
        .update({ name: groupName.trim() })
        .eq('id', conversation.id);

      if (error) throw error;
      toast.success('Đã cập nhật tên nhóm');
      onUpdate();
    } catch (error) {
      console.error('Error updating group name:', error);
      toast.error('Không thể cập nhật tên nhóm');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('conversation_participants')
        .update({ left_at: new Date().toISOString() })
        .eq('conversation_id', conversation.id)
        .eq('user_id', userId);

      if (error) throw error;
      toast.success('Đã xóa thành viên');
      onUpdate();
    } catch (error) {
      console.error('Error removing member:', error);
      toast.error('Không thể xóa thành viên');
    }
  };

  const handleLeaveGroup = async () => {
    setIsLeaving(true);
    try {
      const { error } = await supabase
        .from('conversation_participants')
        .update({ left_at: new Date().toISOString() })
        .eq('conversation_id', conversation.id)
        .eq('user_id', currentUserId);

      if (error) throw error;
      toast.success('Đã rời nhóm');
      onLeave();
      onOpenChange(false);
    } catch (error) {
      console.error('Error leaving group:', error);
      toast.error('Không thể rời nhóm');
    } finally {
      setIsLeaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Cài đặt nhóm
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Group avatar */}
          <div className="flex justify-center">
            <div className="relative">
              <Avatar className="h-20 w-20">
                <AvatarImage src={conversation.avatar_url || undefined} />
                <AvatarFallback className="text-2xl">
                  {(conversation.name || 'G')[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {isAdmin && (
                <button className="absolute bottom-0 right-0 p-1 bg-primary rounded-full text-primary-foreground hover:bg-primary/90">
                  <ImagePlus className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Group name */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Tên nhóm</label>
            <div className="flex gap-2">
              <Input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                disabled={!isAdmin}
              />
              {isAdmin && (
                <Button
                  onClick={handleUpdateName}
                  disabled={isUpdating || !groupName.trim() || groupName === conversation.name}
                >
                  {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Lưu'}
                </Button>
              )}
            </div>
          </div>

          <Separator />

          {/* Members */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Thành viên ({participants.length})</span>
              {isAdmin && (
                <Button variant="ghost" size="sm">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Thêm
                </Button>
              )}
            </div>

            <ScrollArea className="h-[200px]">
              <div className="space-y-2">
                {participants.map((participant) => {
                  const profile = participant.profile;
                  const isCurrentUser = participant.user_id === currentUserId;
                  const isMemberAdmin = participant.role === 'admin';

                  return (
                    <div
                      key={participant.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50"
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={profile?.avatar_url || undefined} />
                        <AvatarFallback>
                          {(profile?.username || 'U')[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">
                            {profile?.full_name || profile?.username || 'Người dùng'}
                          </span>
                          {isCurrentUser && (
                            <Badge variant="outline" className="text-xs">Bạn</Badge>
                          )}
                          {isMemberAdmin && (
                            <Crown className="h-4 w-4 text-yellow-500" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          @{profile?.username}
                        </p>
                      </div>

                      {isAdmin && !isCurrentUser && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleRemoveMember(participant.user_id)}
                        >
                          <UserMinus className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          <Separator />

          {/* Leave group */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full">
                <LogOut className="h-4 w-4 mr-2" />
                Rời nhóm
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Rời khỏi nhóm?</AlertDialogTitle>
                <AlertDialogDescription>
                  Bạn sẽ không thể xem tin nhắn mới trong nhóm này sau khi rời đi.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Hủy</AlertDialogCancel>
                <AlertDialogAction onClick={handleLeaveGroup} disabled={isLeaving}>
                  {isLeaving ? 'Đang rời...' : 'Rời nhóm'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </DialogContent>
    </Dialog>
  );
}
~~~

### FILE: src/modules/chat/components/IncomingCallDialog.tsx
~~~tsx
import { useEffect, useState, useRef } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Phone, PhoneOff, Video } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import type { CallSession, CallType } from '../types';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

interface CallerInfo {
  username: string;
  full_name?: string;
  avatar_url?: string;
}

interface IncomingCallDialogProps {
  callSession: CallSession | null;
  onAnswer: () => void;
  onDecline: () => void;
}

export function IncomingCallDialog({
  callSession,
  onAnswer,
  onDecline,
}: IncomingCallDialogProps) {
  const [callerInfo, setCallerInfo] = useState<CallerInfo | null>(null);
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);

  // Fetch caller info
  useEffect(() => {
    if (!callSession) {
      setCallerInfo(null);
      return;
    }

    const fetchCaller = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('username, full_name, avatar_url')
        .eq('id', callSession.initiator_id)
        .single();

      if (data) {
        setCallerInfo(data);
      }
    };

    fetchCaller();
  }, [callSession]);

  // Play ringtone
  useEffect(() => {
    if (!callSession) {
      // Stop and cleanup ringtone
      if (ringtoneRef.current) {
        ringtoneRef.current.pause();
        ringtoneRef.current.currentTime = 0;
        ringtoneRef.current = null;
      }
      return;
    }

    // Create and play ringtone
    const ringtone = new Audio('/sounds/ringtone.mp3');
    ringtone.loop = true;
    ringtone.volume = 0.7;
    ringtoneRef.current = ringtone;
    
    // Try to play (may fail if no user interaction yet)
    ringtone.play().catch(err => {
      console.log('[Ringtone] Autoplay blocked:', err.message);
    });

    return () => {
      ringtone.pause();
      ringtone.currentTime = 0;
      ringtoneRef.current = null;
    };
  }, [callSession]);

  // Vibrate on mobile
  useEffect(() => {
    if (!callSession) return;

    if (navigator.vibrate) {
      const pattern = [200, 100, 200, 100, 200];
      navigator.vibrate(pattern);
      
      const interval = setInterval(() => {
        navigator.vibrate(pattern);
      }, 2000);

      return () => {
        clearInterval(interval);
        navigator.vibrate(0);
      };
    }
  }, [callSession]);

  if (!callSession) return null;

  const isVideoCall = callSession.call_type === 'video';

  return (
    <Dialog open={!!callSession} onOpenChange={() => {}}>
      <DialogContent 
        className="sm:max-w-md bg-gradient-to-b from-background to-muted border-none [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        aria-describedby="incoming-call-description"
      >
        <VisuallyHidden>
          <DialogTitle>Cuộc gọi đến</DialogTitle>
          <DialogDescription id="incoming-call-description">
            {callerInfo?.full_name || callerInfo?.username || 'Người dùng'} đang gọi cho bạn
          </DialogDescription>
        </VisuallyHidden>
        <div className="flex flex-col items-center py-8 space-y-6">
          {/* Animated ring effect */}
          <div className="relative">
            <div className="absolute inset-0 animate-ping rounded-full bg-primary/30 h-28 w-28" />
            <div className="absolute inset-2 animate-ping animation-delay-150 rounded-full bg-primary/20 h-24 w-24" />
            <Avatar className="h-24 w-24 relative z-10 ring-4 ring-background">
              <AvatarImage src={callerInfo?.avatar_url} alt={callerInfo?.full_name || callerInfo?.username} />
              <AvatarFallback className="text-3xl bg-primary text-primary-foreground">
                {(callerInfo?.full_name || callerInfo?.username || 'U')[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>

          {/* Caller info */}
          <div className="text-center space-y-2">
            <h3 className="text-xl font-semibold">
              {callerInfo?.full_name || callerInfo?.username || 'Người dùng'}
            </h3>
            <p className="text-muted-foreground flex items-center justify-center gap-2">
              {isVideoCall ? (
                <>
                  <Video className="h-4 w-4" />
                  Cuộc gọi video đến...
                </>
              ) : (
                <>
                  <Phone className="h-4 w-4" />
                  Cuộc gọi thoại đến...
                </>
              )}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-8 pt-4">
            {/* Decline button */}
            <div className="flex flex-col items-center gap-2">
              <Button
                type="button"
                variant="destructive"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onDecline();
                }}
                className="h-16 w-16 rounded-full shadow-lg hover:scale-105 transition-transform"
              >
                <PhoneOff className="h-7 w-7" />
              </Button>
              <span className="text-sm text-muted-foreground">Từ chối</span>
            </div>

            {/* Answer button */}
            <div className="flex flex-col items-center gap-2">
              <Button
                type="button"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onAnswer();
                }}
                className={cn(
                  'h-16 w-16 rounded-full shadow-lg hover:scale-105 transition-transform',
                  'bg-green-500 hover:bg-green-600'
                )}
              >
                {isVideoCall ? (
                  <Video className="h-7 w-7" />
                ) : (
                  <Phone className="h-7 w-7" />
                )}
              </Button>
              <span className="text-sm text-muted-foreground">Trả lời</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
~~~

### FILE: src/modules/chat/components/MessageBubble.tsx
~~~tsx
import { useState, useRef, useCallback, memo } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LazyImage } from '@/components/ui/LazyImage';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { FileText, Reply, SmilePlus, Check, CheckCheck, MoreHorizontal, Pin, PinOff, Pencil, Trash2, Flag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { R2_NEW_PUBLIC_URL, rewriteChatAttachmentUrl } from '@/lib/urlFix';
import type { Message } from '../types';
import { RedEnvelopeCard } from './RedEnvelopeCard';

const REACTION_EMOJIS = ['❤️', '😂', '😮', '😢', '😡', '👍'];
interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  showAvatar: boolean;
  currentUserId: string | null;
  onReply: () => void;
  onReaction: (emoji: string, hasReacted: boolean) => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onTogglePin?: () => void;
  onReport?: () => void;
}

export const MessageBubble = memo(function MessageBubble({
  message,
  isOwn,
  showAvatar,
  currentUserId,
  onReply,
  onReaction,
  onEdit,
  onDelete,
  onTogglePin,
  onReport,
}: MessageBubbleProps) {
  const [showActions, setShowActions] = useState(false);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTouchStart = useCallback(() => {
    longPressRef.current = setTimeout(() => {
      setShowActions(true);
    }, 500);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  }, []);
  const mediaUrls = Array.isArray(message.media_urls) ? message.media_urls as string[] : [];
  const normalizedMediaUrls = mediaUrls.map((url) => rewriteChatAttachmentUrl(url));

  const getExtension = (url: string) => {
    try {
      const pathname = new URL(url).pathname;
      const name = pathname.split('/').pop() || '';
      const ext = name.split('.').pop() || '';
      return ext.toLowerCase();
    } catch {
      const name = url.split('?')[0].split('#')[0].split('/').pop() || '';
      return name.split('.').pop()?.toLowerCase() || '';
    }
  };

  const isImageUrl = (url: string) => {
    const ext = getExtension(url);
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'heic'].includes(ext);
  };

  const isVideoUrl = (url: string) => {
    const ext = getExtension(url);
    return ['mp4', 'webm', 'mov', 'm4v'].includes(ext);
  };

  const getFilename = (url: string) => {
    try {
      const pathname = new URL(url).pathname;
      return decodeURIComponent(pathname.split('/').pop() || 'file');
    } catch {
      return decodeURIComponent(url.split('?')[0].split('#')[0].split('/').pop() || 'file');
    }
  };
  
  // Group reactions by emoji
  const reactionCounts = message.reactions?.reduce((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  const userReactions = message.reactions
    ?.filter((r) => r.user_id === currentUserId)
    .map((r) => r.emoji) || [];

  const isRead = message.read_by && message.read_by.length > 0;
  const isPinned = !!message.pinned_at;
  const isDeleted = !!message.is_deleted;
  const messageType = (message.message_type || 'text') as string;
  const metadata: any = message.metadata && typeof message.metadata === 'object' ? message.metadata : {};

  const createdAt = message.created_at ? new Date(message.created_at) : null;
  const canEditByTime = createdAt ? (Date.now() - createdAt.getTime()) <= 15 * 60 * 1000 : false;
  const canEdit = isOwn && !isDeleted && messageType === 'text' && canEditByTime;

  return (
    <div
      className={cn('flex gap-2 group', isOwn ? 'flex-row-reverse' : '')}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {/* Avatar */}
      <div className="w-8 flex-shrink-0">
        {showAvatar && !isOwn && message.sender && (
          <Avatar className="h-8 w-8">
            <AvatarImage
              src={message.sender.avatar_url || undefined}
              alt={message.sender.username}
            />
            <AvatarFallback>
              {message.sender.username[0].toUpperCase()}
            </AvatarFallback>
          </Avatar>
        )}
      </div>

      {/* Message content */}
      <div className={cn('flex flex-col max-w-[70%]', isOwn ? 'items-end' : 'items-start')}>
        {/* Reply preview */}
        {message.reply_to && (
          <div className={cn(
            'text-xs px-3 py-1 rounded-t-lg bg-muted/50 border-l-2',
            isOwn ? 'border-primary' : 'border-muted-foreground'
          )}>
            <span className="text-muted-foreground">
              Trả lời {message.reply_to.sender?.username || 'tin nhắn'}
            </span>
            <p className="truncate">{message.reply_to.content}</p>
          </div>
        )}

        {/* Bubble */}
        <div
          className={cn(
            'px-4 py-2 rounded-2xl relative',
            messageType === 'system'
              ? 'bg-amber-50 text-foreground border border-amber-200'
              : isOwn
                ? 'bg-primary text-primary-foreground rounded-br-md'
                : 'bg-muted rounded-bl-md',
            message.reply_to && 'rounded-t-none'
          )}
        >
          {isDeleted ? (
            <p className="text-sm italic opacity-80">Tin nhắn đã được thu hồi / xóa</p>
          ) : messageType === 'sticker' ? (
            <div className="flex flex-col items-center">
              <img
                src={metadata?.sticker?.url || metadata?.stickerUrl || ''}
                alt={metadata?.sticker?.name || 'sticker'}
                className="w-32 h-32 object-contain"
              />
            </div>
          ) : messageType === 'red_envelope' ? (
            (metadata?.envelopeId || metadata?.envelope_id) ? (
              <RedEnvelopeCard
                envelopeId={metadata?.envelopeId || metadata?.envelope_id}
                conversationId={message.conversation_id}
                currentUserId={currentUserId}
                compact
              />
            ) : (
              <p className="text-sm">[Red Envelope]</p>
            )
          ) : (
            <>
              {/* Text content */}
              {message.content && (
                <p className="whitespace-pre-wrap break-words">{message.content}</p>
              )}

              {/* Media */}
              {normalizedMediaUrls.length > 0 && (
                <div className={cn('mt-2 grid gap-1', normalizedMediaUrls.length > 1 ? 'grid-cols-2' : '')}>
                  {normalizedMediaUrls.map((url, i) => {
                    if (isImageUrl(url)) {
                      const skipTransform = url.startsWith(R2_NEW_PUBLIC_URL);
                      return (
                        <LazyImage
                          key={i}
                          src={url}
                          alt=""
                          skipTransform={skipTransform}
                          className="rounded-lg max-w-full h-auto cursor-pointer hover:opacity-90"
                        />
                      );
                    }

                    if (isVideoUrl(url)) {
                      return (
                        <video
                          key={i}
                          src={url}
                          controls
                          playsInline
                          preload="metadata"
                          className="rounded-lg max-w-full h-auto"
                        />
                      );
                    }

                    const filename = getFilename(url);
                    return (
                      <div key={i} className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm truncate">{filename}</div>
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            download
                            className="text-xs text-primary hover:underline"
                          >
                            Download
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* Reactions display */}
          {Object.keys(reactionCounts).length > 0 && (
            <div className={cn(
              'absolute -bottom-3 flex gap-0.5 bg-card rounded-full px-1 py-0.5 shadow-sm border',
              isOwn ? 'right-2' : 'left-2'
            )}>
              {Object.entries(reactionCounts).map(([emoji, count]) => (
                <span key={emoji} className="text-xs">
                  {emoji}{count > 1 && <span className="text-muted-foreground">{count}</span>}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Timestamp & read status */}
        <div className="flex items-center gap-1 mt-1 px-2">
          <span className="text-[10px] text-muted-foreground">
            {message.created_at && format(new Date(message.created_at), 'HH:mm', { locale: vi })}
          </span>
          {!isDeleted && message.edited_at && (
            <span className="text-[10px] text-muted-foreground">(đã sửa)</span>
          )}
          {!isDeleted && isPinned && (
            <span className="text-[10px] text-muted-foreground">(ghim)</span>
          )}
          {isOwn && (
            <span className="text-muted-foreground">
              {isRead ? (
                <CheckCheck className="h-3 w-3 text-primary" />
              ) : (
                <Check className="h-3 w-3" />
              )}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div
        className={cn(
          'flex items-center gap-1 opacity-0 transition-opacity',
          showActions && 'opacity-100'
        )}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onReply}
            >
              <Reply className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Trả lời</TooltipContent>
        </Tooltip>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <SmilePlus className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" side="top">
            <div className="flex gap-1">
              {REACTION_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => onReaction(emoji, userReactions.includes(emoji))}
                  className={cn(
                    'text-xl p-1 rounded hover:bg-accent transition-colors',
                    userReactions.includes(emoji) && 'bg-accent'
                  )}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={isOwn ? 'end' : 'start'}>
            <DropdownMenuItem onClick={onTogglePin} disabled={!onTogglePin}>
              {isPinned ? <PinOff className="h-4 w-4 mr-2" /> : <Pin className="h-4 w-4 mr-2" />}
              {isPinned ? 'Bỏ ghim' : 'Ghim tin nhắn'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onEdit} disabled={!canEdit || !onEdit}>
              <Pencil className="h-4 w-4 mr-2" />
              Sửa tin nhắn
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} disabled={!isOwn || isDeleted || !onDelete}>
              <Trash2 className="h-4 w-4 mr-2" />
              Thu hồi / Xóa
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onReport} disabled={!onReport}>
              <Flag className="h-4 w-4 mr-2" />
              Gửi phản hồi
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
});

~~~

### FILE: src/modules/chat/components/MessageSearch.tsx
~~~tsx
import { useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, X, Loader2, MessageSquare } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';

interface MessageSearchProps {
  conversationId: string;
  onSelectMessage?: (messageId: string) => void;
  onClose?: () => void;
  participants?: Array<{ id: string; username: string }>;
  excludedSenderIds?: string[];
}

interface SearchResult {
  id: string;
  content: string | null;
  created_at: string | null;
  sender_id: string;
  sender: {
    id: string;
    username: string;
    avatar_url: string | null;
  } | null;
}

export function MessageSearch({
  conversationId,
  onSelectMessage,
  onClose,
  participants,
  excludedSenderIds = [],
}: MessageSearchProps) {
  const [search, setSearch] = useState('');
  const [senderId, setSenderId] = useState<string>('all');
  const debouncedSearch = useDebounce(search, 400);
  const normalizedSearch = debouncedSearch.trim();
  const excludedSenderIdsKey = excludedSenderIds.slice().sort().join(',');

  const { data: results, isLoading } = useQuery({
    queryKey: ['message-search', conversationId, normalizedSearch, senderId, excludedSenderIdsKey],
    queryFn: async () => {
      if (!normalizedSearch || normalizedSearch.length < 2) return [];

      const escapeIlikePattern = (value: string) => value.replace(/[%_]/g, '\\$&');
      const pattern = `%${escapeIlikePattern(normalizedSearch)}%`;

      let query = supabase
        .from('messages')
        .select('id, content, created_at, sender_id')
        .eq('conversation_id', conversationId)
        .ilike('content', pattern);

      if (senderId !== 'all') {
        query = query.eq('sender_id', senderId);
      }

      const { data: messages, error } = await query
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      if (!messages?.length) return [];

      const excluded = new Set(excludedSenderIds);
      const filteredMessages = messages.filter((m) => !excluded.has(m.sender_id));
      if (!filteredMessages.length) return [];

      // Fetch sender profiles
      const senderIds = [...new Set(filteredMessages.map((m) => m.sender_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', senderIds);

      const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);

      return filteredMessages.map((m) => ({
        ...m,
        sender: profileMap.get(m.sender_id) || null,
      })) as SearchResult[];
    },
    enabled: normalizedSearch.length >= 2,
  });

  const handleSelect = useCallback(
    (messageId: string) => {
      onSelectMessage?.(messageId);
    },
    [onSelectMessage]
  );

  const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const highlightMatch = (text: string | null, query: string) => {
    if (!text) return null;
    const safe = escapeRegExp(query);
    const parts = text.split(new RegExp(`(${safe})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={i} className="bg-primary/30 text-foreground rounded-sm px-0.5">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search header */}
      <div className="flex items-center gap-2 p-3 border-b">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm kiếm tin nhắn..."
            className="pl-9"
            autoFocus
          />
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Sender filter */}
      <div className="flex items-center gap-2 p-3 border-b bg-card">
        <span className="text-xs text-muted-foreground whitespace-nowrap">Người gửi</span>
        <Select value={senderId} onValueChange={setSenderId}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Tất cả" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả</SelectItem>
            {participants?.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.username}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Results */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !normalizedSearch || normalizedSearch.length < 2 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mb-4 opacity-50" />
            <p>Nhập từ khóa để tìm kiếm</p>
          </div>
        ) : results?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Search className="h-12 w-12 mb-4 opacity-50" />
            <p>Không tìm thấy kết quả</p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {results?.map((result) => (
              <button
                key={result.id}
                onClick={() => handleSelect(result.id)}
                className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-accent text-left transition-colors"
              >
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarImage src={result.sender?.avatar_url || undefined} />
                  <AvatarFallback>{(result.sender?.username || 'U')[0].toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm">{result.sender?.username}</span>
                    {result.created_at && (
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(result.created_at), 'dd/MM/yyyy HH:mm', { locale: vi })}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {result.content
                      ? highlightMatch(result.content, normalizedSearch)
                      : '[Tin nhắn không có văn bản]'}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
~~~

### FILE: src/modules/chat/components/MessageThread.tsx
~~~tsx
import { useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMessages } from '../hooks/useMessages';
import { useTypingIndicator } from '../hooks/useTypingIndicator';
import { useConversation } from '../hooks/useConversations';
import { useAgoraCall } from '../hooks/useAgoraCall';
import { usePins } from '../hooks/usePins';
import { useBlocks } from '../hooks/useBlocks';
import { useReports } from '../hooks/useReports';
import { useAngelInline } from '../hooks/useAngelInline';
import { MessageBubble } from './MessageBubble';
import { ChatInput } from './ChatInput';
import { TypingIndicator } from './TypingIndicator';
import { MessageSearch } from './MessageSearch';
import { GroupSettingsDialog } from './GroupSettingsDialog';
import { IncomingCallDialog } from './IncomingCallDialog';
import { CallRoom } from './CallRoom';
import { EditMessageDialog } from './EditMessageDialog';
import { ReportDialog } from './ReportDialog';
import { BlockUserDialog } from './BlockUserDialog';

import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Search, Settings, Users, Phone, Video, MoreHorizontal, Pin, Trash2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import type { Message, ConversationParticipant } from '../types';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface MessageThreadProps {
  conversationId: string;
  userId: string | null;
  username: string | null;
}

export function MessageThread({ conversationId, userId, username }: MessageThreadProps) {
  const scrollRootRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRafRef = useRef<number | null>(null);
  const isAtBottomRef = useRef(true);
  const didInitialScrollRef = useRef(false);
  const previousMessageCountRef = useRef(0);
  const pendingReadIdsRef = useRef<Set<string>>(new Set());
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [reportTarget, setReportTarget] = useState<Message | null>(null);
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [highlightMessageId, setHighlightMessageId] = useState<string | null>(null);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const [newMessagesCount, setNewMessagesCount] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false)
  const { data: conversation, refetch: refetchConversation } = useConversation(conversationId);
  const {
    messages,
    isLoading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    sendMessage,
    markAsRead,
    addReaction,
    removeReaction,
    editMessage,
    softDeleteMessage,
  } = useMessages(conversationId, userId);

  const { typingUsers, sendTyping } = useTypingIndicator(conversationId, userId, username);

  // Agora call hook
  const {
    callState,
    callType,
    remoteUsers,
    isMuted,
    isCameraOff,
    incomingCall,
    callDuration,
    localVideoTrack,
    startCall,
    answerCall,
    declineCall,
    endCall,
    toggleMute,
    toggleCamera,
    switchToVideo,
  } = useAgoraCall({ conversationId, userId });

  // Get other participant for header
  const otherParticipant = conversation?.participants?.find(
    (p: ConversationParticipant) => p.user_id !== userId && !p.left_at
  );
  const headerProfile = otherParticipant?.profile;
  const isGroup = conversation?.type === 'group';
  const participantCount = conversation?.participants?.filter((p: ConversationParticipant) => !p.left_at).length || 0;

  const { pinnedMessage, pinMessage, unpinMessage } = usePins(conversationId);
  const { blockedIds, blockedByIds, blockUser, unblockUser } = useBlocks(userId);
  const { createReport } = useReports(userId);
  const { invokeAngel } = useAngelInline();
  
  const headerName = isGroup
    ? conversation?.name
    : headerProfile?.full_name || headerProfile?.username || 'Người dùng';
  const headerAvatar = isGroup
    ? conversation?.avatar_url
    : headerProfile?.avatar_url;
  const recipientUserId = !isGroup ? otherParticipant?.user_id || null : null;
  // Chat gift should only read the single source of truth from Profile (web3_wallet_address).
  const recipientWalletAddress = !isGroup ? headerProfile?.wallet_address || null : null;

  const dmOtherUserId = !isGroup ? recipientUserId : null;
  const isDmBlockedByMe = !!dmOtherUserId && blockedIds.has(dmOtherUserId);
  const isDmBlockedMe = !!dmOtherUserId && blockedByIds.has(dmOtherUserId);
  const isDmBlocked = isDmBlockedByMe || isDmBlockedMe;

  const visibleMessages = messages.filter((m) => {
    if (!userId) return true;
    if (m.sender_id === userId) return true;
    return !blockedIds.has(m.sender_id);
  });

  const getViewportEl = () => scrollRootRef.current;
  const scheduleScrollToBottom = (behavior: ScrollBehavior = 'auto') => {
    if (scrollRafRef.current) {
      cancelAnimationFrame(scrollRafRef.current);
    }
    scrollRafRef.current = requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior, block: 'end' });
      scrollRafRef.current = null;
    });
  };

  // Track whether the user is near the bottom; used to avoid yanking scroll when loading older messages.
  useEffect(() => {
    const viewport = getViewportEl();
    if (!viewport) return;

    const onScroll = () => {
      const thresholdPx = 80;
      const distanceFromBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
      isAtBottomRef.current = distanceFromBottom <= thresholdPx;
      setShowJumpToLatest(!isAtBottomRef.current);
      if (isAtBottomRef.current) {
        setNewMessagesCount(0);
      }
    };

    onScroll();
    viewport.addEventListener('scroll', onScroll);
    return () => viewport.removeEventListener('scroll', onScroll);
  }, []);

  // Scroll to bottom on initial load, and when new messages arrive while user is at bottom.
  useEffect(() => {
    if (isLoading) return;
    if (!bottomRef.current) return;
    const previousCount = previousMessageCountRef.current;
    const incomingCount = Math.max(messages.length - previousCount, 0);
    previousMessageCountRef.current = messages.length;

    if (!didInitialScrollRef.current) {
      didInitialScrollRef.current = true;
      scheduleScrollToBottom();
      setShowJumpToLatest(false);
      setNewMessagesCount(0);
      return;
    }
    if (isAtBottomRef.current) {
      scheduleScrollToBottom();
      setShowJumpToLatest(false);
      setNewMessagesCount(0);
    } else {
      if (incomingCount > 0) {
        setShowJumpToLatest(true);
        setNewMessagesCount((prev) => prev + incomingCount);
      }
    }
  }, [isLoading, messages.length]);

  useEffect(() => {
    return () => {
      if (scrollRafRef.current) {
        cancelAnimationFrame(scrollRafRef.current);
      }
    };
  }, []);

  // Mark messages as read
  useEffect(() => {
    if (!userId || messages.length === 0) return;

    const unreadIds = messages
      .filter(
      (m) => m.sender_id !== userId && !m.read_by?.includes(userId)
      )
      .map((m) => m.id)
      .filter((id) => !pendingReadIdsRef.current.has(id));

    if (!unreadIds.length) return;

    unreadIds.forEach((id) => pendingReadIdsRef.current.add(id));
    markAsRead(unreadIds)
      .catch(() => undefined)
      .finally(() => {
        unreadIds.forEach((id) => pendingReadIdsRef.current.delete(id));
      });
  }, [messages, userId, markAsRead]);

  const handleSend = async (content: string, mediaUrls?: string[]) => {
    const trimmed = (content || '').trim();
    await sendMessage.mutateAsync({
      content,
      mediaUrls,
      replyToId: replyTo?.id,
    });
    setReplyTo(null);

    if (trimmed.toLowerCase().startsWith('@angel')) {
      const prompt = trimmed.replace(/^@angel\s*/i, '').trim();
      if (!prompt) return;
      invokeAngel.mutate(
        { conversationId, prompt },
        {
          onError: (e: any) => {
            toast.error(e?.message || 'Angel AI phản hồi thất bại');
          },
        }
      );
    }
  };

  const handleSendSticker = async (sticker: any) => {
    await sendMessage.mutateAsync({
      content: '[Sticker]',
      mediaUrls: [],
      replyToId: replyTo?.id,
      messageType: 'sticker',
      metadata: { sticker },
    });
    setReplyTo(null);
  };

  const handleCreateRedEnvelope = async (input: { token: 'CAMLY' | 'BNB'; totalAmount: number; totalCount: number }) => {
    if (!userId) throw new Error('Not authenticated');
    // Create envelope row
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { data: envelope, error: envErr } = await supabase
      .from('red_envelopes')
      .insert({
        creator_id: userId,
        conversation_id: conversationId,
        token: input.token,
        total_amount: input.totalAmount,
        total_count: input.totalCount,
        remaining_amount: input.totalAmount,
        remaining_count: input.totalCount,
        expires_at: expiresAt,
        status: 'active',
      })
      .select('id')
      .single();
    if (envErr) throw envErr;

    // Send envelope message
    const msg = await sendMessage.mutateAsync({
      content: '[Red Envelope]',
      mediaUrls: [],
      replyToId: replyTo?.id,
      messageType: 'red_envelope',
      metadata: { envelopeId: envelope.id },
    });
    setReplyTo(null);

    // Best-effort link message_id back to envelope
    if ((msg as any)?.id) {
      supabase.from('red_envelopes').update({ message_id: (msg as any).id }).eq('id', envelope.id).then(() => undefined);
    }
  };

  const handleReaction = (messageId: string, emoji: string, hasReacted: boolean) => {
    if (hasReacted) {
      removeReaction.mutate({ messageId, emoji });
    } else {
      addReaction.mutate({ messageId, emoji });
    }
  };

  const handleGroupUpdate = () => {
    refetchConversation();
    queryClient.invalidateQueries({ queryKey: ['conversations', userId] });
  };

  const handleLeaveGroup = () => {
    navigate('/chat');
  };

  const scrollToMessage = async (messageId: string) => {
    // Best-effort: try to locate the message in DOM; if not loaded, fetch older pages.
    const tryScroll = () => {
      const el = document.getElementById(`msg-${messageId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlightMessageId(messageId);
        window.setTimeout(() => {
          setHighlightMessageId((current) => (current === messageId ? null : current));
        }, 1800);
        return true;
      }
      return false;
    };

    if (tryScroll()) return true;

    // Try fetching older pages a few times.
    for (let i = 0; i < 8; i++) {
      if (!hasNextPage || isFetchingNextPage) break;
      await fetchNextPage();
      // Let React render.
      await new Promise((r) => setTimeout(r, 50));
      if (tryScroll()) return true;
    }

    toast.warning('Không tìm thấy tin nhắn trong lịch sử đã tải.');
    return false;
  };

  const handleJumpToLatest = () => {
    scheduleScrollToBottom('smooth');
    setShowJumpToLatest(false);
    setNewMessagesCount(0);
  };

  if (isLoading) {
    return (
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="p-4 border-b flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-5 w-32" />
        </div>
        <div className="flex-1 p-4 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : ''}`}>
              <Skeleton className={`h-12 ${i % 2 === 0 ? 'w-48' : 'w-64'} rounded-2xl`} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (showSearch) {
    const participants =
      conversation?.participants
        ?.filter((p: ConversationParticipant) => !p.left_at)
        .map((p: ConversationParticipant) => ({
          id: p.user_id,
          username: p.profile?.full_name || p.profile?.username || 'Người dùng',
        })) || [];
    return (
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <MessageSearch
          conversationId={conversationId}
          participants={participants}
          excludedSenderIds={Array.from(blockedIds)}
          onClose={() => setShowSearch(false)}
          onSelectMessage={async (messageId) => {
            await scrollToMessage(messageId);
            setShowSearch(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="relative flex-1 min-h-0 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between bg-card">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={headerAvatar || undefined} alt={headerName || ''} />
            <AvatarFallback>{(headerName || 'U')[0].toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{headerName}</p>
            {isGroup ? (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Users className="h-3 w-3" />
                {participantCount} thành viên
              </p>
            ) : typingUsers.length > 0 ? (
              <p className="text-xs text-muted-foreground">Đang nhập...</p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Call buttons */}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => startCall('voice')}
            disabled={callState !== 'idle' || (!isGroup && isDmBlocked)}
            title="Gọi thoại"
          >
            <Phone className="h-5 w-5" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => startCall('video')}
            disabled={callState !== 'idle' || (!isGroup && isDmBlocked)}
            title="Gọi video"
          >
            <Video className="h-5 w-5" />
          </Button>
          
          <Button variant="ghost" size="icon" onClick={() => setShowSearch(true)}>
            <Search className="h-5 w-5" />
          </Button>
          {isGroup && (
            <Button variant="ghost" size="icon" onClick={() => setShowGroupSettings(true)}>
              <Settings className="h-5 w-5" />
            </Button>
          )}
          {!isGroup && dmOtherUserId && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setShowBlockDialog(true)} disabled={isDmBlockedMe && !isDmBlockedByMe}>
                  {isDmBlockedMe && !isDmBlockedByMe
                    ? 'Bạn đã bị tạm ngừng kết nối'
                    : isDmBlockedByMe
                      ? 'Kết nối lại'
                      : 'Tạm ngừng kết nối'}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Xóa cuộc trò chuyện
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Pinned banner */}
      {pinnedMessage && (
        <div className="px-4 py-2 border-b bg-card flex items-center justify-between gap-2">
          <button
            onClick={() => scrollToMessage(pinnedMessage.id)}
            className="flex items-center gap-2 min-w-0 text-left"
            title="Đi đến tin nhắn đã ghim"
          >
            <Pin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="text-sm truncate">
              {pinnedMessage.content || '(Tin nhắn đã ghim)'}
            </span>
          </button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => unpinMessage.mutate(pinnedMessage.id)}
            disabled={unpinMessage.isPending}
          >
            {unpinMessage.isPending ? '...' : 'Bỏ ghim'}
          </Button>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRootRef} className="flex-1 min-h-0 overflow-y-auto p-4">
        <div className="space-y-4">
          {hasNextPage && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? 'Đang tải...' : 'Tải tin nhắn cũ hơn'}
              </Button>
            </div>
          )}

          {visibleMessages.map((message, index) => {
            const isOwn = message.sender_id === userId;
            const showAvatar = !isOwn && (
              index === 0 || visibleMessages[index - 1]?.sender_id !== message.sender_id
            );

            return (
              <div
                key={message.id}
                id={`msg-${message.id}`}
                className={cn(
                  'rounded-md transition-colors',
                  highlightMessageId === message.id && 'bg-primary/10 ring-1 ring-primary/30'
                )}
              >
                <MessageBubble
                message={message}
                isOwn={isOwn}
                showAvatar={showAvatar}
                currentUserId={userId}
                onReply={() => setReplyTo(message)}
                onReaction={(emoji, hasReacted) => handleReaction(message.id, emoji, hasReacted)}
                onTogglePin={() => {
                  if (message.pinned_at) {
                    unpinMessage.mutate(message.id);
                  } else {
                    pinMessage.mutate(message.id);
                  }
                }}
                onEdit={() => setEditingMessage(message)}
                onDelete={() => {
                  if (!isOwn) return;
                  if (window.confirm('Thu hồi / xóa tin nhắn này?')) {
                    softDeleteMessage.mutate({ messageId: message.id });
                  }
                }}
                onReport={() => {
                  setReportTarget(message);
                  setShowReport(true);
                }}
              />
              </div>
            );
          })}

          {typingUsers.length > 0 && (
            <TypingIndicator users={typingUsers} />
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {showJumpToLatest && (
        <div className="absolute right-4 z-20 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] md:bottom-24">
          <Button size="sm" onClick={handleJumpToLatest} className="rounded-full shadow-lg">
            {newMessagesCount > 0 ? `Tin mới nhất (${newMessagesCount})` : 'Tin mới nhất'}
          </Button>
        </div>
      )}

      {/* Input */}
      <div className="sticky bottom-0 z-10 bg-card pb-[env(safe-area-inset-bottom)]">
        <ChatInput
          onSend={handleSend}
          onSendSticker={handleSendSticker}
          onCreateRedEnvelope={handleCreateRedEnvelope}
          onTyping={sendTyping}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          isSending={sendMessage.isPending}
          recipientWalletAddress={recipientWalletAddress}
          recipientUserId={recipientUserId}
          recipientName={headerName}
          recipientAvatar={headerAvatar}
          conversationId={conversationId}
          isGroup={isGroup}
          disabled={!isGroup && isDmBlocked}
          disabledReason={
            !isGroup && isDmBlocked
              ? isDmBlockedByMe
                ? 'Bạn đã tạm ngừng kết nối. Không thể nhắn tin trực tiếp.'
                : 'Người dùng này đã tạm ngừng kết nối với bạn. Không thể nhắn tin trực tiếp.'
              : undefined
          }
        />
      </div>

      <EditMessageDialog
        open={!!editingMessage}
        onOpenChange={(open) => {
          if (!open) setEditingMessage(null);
        }}
        initialValue={editingMessage?.content || ''}
        isSaving={editMessage.isPending}
        onSave={async (next) => {
          if (!editingMessage) return;
          try {
            await editMessage.mutateAsync({ messageId: editingMessage.id, content: next });
            setEditingMessage(null);
            toast.success('Đã cập nhật');
          } catch (e: any) {
            toast.error(e?.message || 'Không thể sửa tin nhắn');
          }
        }}
      />

      <ReportDialog
        open={showReport}
        onOpenChange={(open) => {
          setShowReport(open);
          if (!open) setReportTarget(null);
        }}
        isSubmitting={createReport.isPending}
        onSubmit={async ({ reason, details }) => {
          if (!reportTarget) return;
          try {
            await createReport.mutateAsync({
              reportedUserId: reportTarget.sender_id,
              conversationId,
              messageId: reportTarget.id,
              reason,
              details,
            });
            toast.success('Đã gửi phản hồi');
            setShowReport(false);
            setReportTarget(null);
          } catch (e: any) {
            toast.error(e?.message || 'Không thể gửi phản hồi');
          }
        }}
      />

      {!isGroup && dmOtherUserId && (
        <BlockUserDialog
          open={showBlockDialog}
          onOpenChange={setShowBlockDialog}
          username={headerName}
          mode={isDmBlockedByMe ? 'unblock' : 'block'}
          isBlocking={blockUser.isPending || unblockUser.isPending}
          onConfirm={async () => {
            try {
              if (isDmBlockedByMe) {
                await unblockUser.mutateAsync(dmOtherUserId);
                toast.success('Đã kết nối lại');
              } else {
                await blockUser.mutateAsync(dmOtherUserId);
                toast.success('Đã tạm ngừng kết nối');
              }
              setShowBlockDialog(false);
            } catch (e: any) {
              toast.error(e?.message || 'Không thể thực hiện');
            }
          }}
        />
      )}

      {/* Group Settings Dialog */}
      {isGroup && conversation && (
        <GroupSettingsDialog
          open={showGroupSettings}
          onOpenChange={setShowGroupSettings}
          conversation={conversation}
          currentUserId={userId}
          onUpdate={handleGroupUpdate}
          onLeave={handleLeaveGroup}
        />
      )}

      {/* Incoming Call Dialog */}
      <IncomingCallDialog
        callSession={incomingCall}
        onAnswer={answerCall}
        onDecline={declineCall}
      />

      {/* Active Call Room */}
      <CallRoom
        isOpen={callState !== 'idle' && !incomingCall}
        callState={callState}
        callType={callType}
        callDuration={callDuration}
        localVideoTrack={localVideoTrack}
        remoteUsers={remoteUsers}
        isMuted={isMuted}
        isCameraOff={isCameraOff}
        localUserInfo={{
          username: username || undefined,
          avatarUrl: undefined,
        }}
        remoteUserInfo={{
          username: headerProfile?.full_name || headerProfile?.username,
          avatarUrl: headerProfile?.avatar_url,
        }}
        onToggleMute={toggleMute}
        onToggleCamera={toggleCamera}
        onSwitchToVideo={switchToVideo}
        onEndCall={endCall}
      />

      {/* Delete Conversation Confirm */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa cuộc trò chuyện?</AlertDialogTitle>
            <AlertDialogDescription>
              Cuộc trò chuyện sẽ bị xóa khỏi danh sách của bạn. Bạn có thể bắt đầu cuộc trò chuyện mới bất cứ lúc nào.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Hủy</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async (e) => {
                e.preventDefault();
                if (!userId) return;
                setIsDeleting(true);
                try {
                  const { error } = await supabase
                    .from('conversation_participants')
                    .update({ left_at: new Date().toISOString() })
                    .eq('conversation_id', conversationId)
                    .eq('user_id', userId);
                  if (error) throw error;
                  queryClient.invalidateQueries({ queryKey: ['conversations', userId] });
                  toast.success('Đã xóa cuộc trò chuyện');
                  navigate('/chat');
                } catch (err: any) {
                  toast.error(err?.message || 'Không thể xóa cuộc trò chuyện');
                } finally {
                  setIsDeleting(false);
                  setShowDeleteConfirm(false);
                }
              }}
            >
              {isDeleting ? 'Đang xóa...' : 'Xóa'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

~~~

### FILE: src/modules/chat/components/NewConversationDialog.tsx
~~~tsx
import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Search, Loader2 } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';

interface NewConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId: string | null;
  onSelectUser: (userId: string) => void;
}

export function NewConversationDialog({
  open,
  onOpenChange,
  currentUserId,
  onSelectUser,
}: NewConversationDialogProps) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  // Fetch friends first
  const { data: friends, isLoading: friendsLoading } = useQuery({
    queryKey: ['friends-for-chat', currentUserId],
    queryFn: async () => {
      if (!currentUserId) return [];

      const { data: friendships, error } = await supabase
        .from('friendships')
        .select('user_id, friend_id')
        .or(`user_id.eq.${currentUserId},friend_id.eq.${currentUserId}`)
        .eq('status', 'accepted');

      if (error) throw error;

      const friendIds = friendships?.map((f) =>
        f.user_id === currentUserId ? f.friend_id : f.user_id
      ) || [];

      if (friendIds.length === 0) return [];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .in('id', friendIds);

      return profiles || [];
    },
    enabled: open && !!currentUserId,
  });

  // Search all users
  const { data: searchResults, isLoading: searchLoading } = useQuery({
    queryKey: ['search-users-chat', debouncedSearch],
    queryFn: async () => {
      if (!debouncedSearch || debouncedSearch.length < 2) return [];

      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .neq('id', currentUserId)
        .or(`username.ilike.%${debouncedSearch}%,full_name.ilike.%${debouncedSearch}%`)
        .limit(10);

      if (error) throw error;
      return data || [];
    },
    enabled: open && debouncedSearch.length >= 2,
  });

  const displayUsers = useMemo(() => {
    if (debouncedSearch.length >= 2) {
      return searchResults || [];
    }
    return friends || [];
  }, [debouncedSearch, friends, searchResults]);

  const isLoading = friendsLoading || (debouncedSearch.length >= 2 && searchLoading);

  const handleSelect = (userId: string) => {
    onSelectUser(userId);
    setSearch('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cuộc trò chuyện mới</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm kiếm người dùng..."
            className="pl-9"
          />
        </div>

        <ScrollArea className="h-[300px]">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : displayUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {debouncedSearch.length >= 2
                ? 'Không tìm thấy người dùng'
                : 'Bạn chưa có bạn bè nào'}
            </div>
          ) : (
            <div className="space-y-1">
              {!debouncedSearch && friends && friends.length > 0 && (
                <p className="text-xs text-muted-foreground px-3 py-2">Bạn bè</p>
              )}
              {displayUsers.map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleSelect(user.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors text-left"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={user.avatar_url || undefined} alt={user.username} />
                    <AvatarFallback>
                      {user.username[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{user.full_name || user.username}</p>
                    <p className="text-sm text-muted-foreground">@{user.username}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
~~~

### FILE: src/modules/chat/components/PreCallSettings.tsx
~~~tsx
/**
 * Pre-Call Settings Dialog
 * Allows users to select camera, microphone, and preview video before joining a call
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Mic, MicOff, Video, VideoOff, Phone, RefreshCw, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import AgoraRTC, { ICameraVideoTrack, IMicrophoneAudioTrack } from 'agora-rtc-sdk-ng';
import { useMediaDevices, MediaDevice } from '../hooks/useMediaDevices';
import type { CallType } from '../types';

interface PreCallSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onStartCall: (type: CallType) => void;
  callType: CallType;
  userInfo?: {
    username?: string;
    avatarUrl?: string;
  };
  recipientInfo?: {
    username?: string;
    avatarUrl?: string;
  };
}

export function PreCallSettings({
  isOpen,
  onClose,
  onStartCall,
  callType,
  userInfo,
  recipientInfo,
}: PreCallSettingsProps) {
  const [previewVideoTrack, setPreviewVideoTrack] = useState<ICameraVideoTrack | null>(null);
  const [previewAudioTrack, setPreviewAudioTrack] = useState<IMicrophoneAudioTrack | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const videoContainerRef = useRef<HTMLDivElement>(null);

  const {
    devices,
    isEnumerating,
    audioLevel,
    hasMultipleCameras,
    selectCamera,
    selectMicrophone,
    flipCamera,
    startAudioLevelMonitor,
    stopAudioLevelMonitor,
  } = useMediaDevices({
    videoTrack: previewVideoTrack,
    audioTrack: previewAudioTrack,
  });

  // Create preview tracks when dialog opens
  useEffect(() => {
    if (!isOpen) return;

    const createTracks = async () => {
      setIsLoading(true);
      try {
        if (callType === 'video') {
          const [audio, video] = await AgoraRTC.createMicrophoneAndCameraTracks();
          setPreviewAudioTrack(audio);
          setPreviewVideoTrack(video);
        } else {
          const audio = await AgoraRTC.createMicrophoneAudioTrack();
          setPreviewAudioTrack(audio);
        }
      } catch (error) {
        console.error('[PreCallSettings] Failed to create tracks:', error);
      } finally {
        setIsLoading(false);
      }
    };

    createTracks();

    return () => {
      // Cleanup tracks when dialog closes
      previewVideoTrack?.close();
      previewAudioTrack?.close();
      setPreviewVideoTrack(null);
      setPreviewAudioTrack(null);
      stopAudioLevelMonitor();
    };
  }, [isOpen, callType]);

  // Play video in container
  useEffect(() => {
    if (previewVideoTrack && videoContainerRef.current && !isCameraOff) {
      previewVideoTrack.play(videoContainerRef.current);
    }
    return () => {
      previewVideoTrack?.stop();
    };
  }, [previewVideoTrack, isCameraOff]);

  // Start audio level monitoring
  useEffect(() => {
    if (previewAudioTrack && !isMuted) {
      startAudioLevelMonitor();
    }
    return () => {
      stopAudioLevelMonitor();
    };
  }, [previewAudioTrack, isMuted, startAudioLevelMonitor, stopAudioLevelMonitor]);

  const handleToggleMute = useCallback(async () => {
    if (previewAudioTrack) {
      await previewAudioTrack.setEnabled(isMuted);
      setIsMuted(!isMuted);
    }
  }, [previewAudioTrack, isMuted]);

  const handleToggleCamera = useCallback(async () => {
    if (previewVideoTrack) {
      await previewVideoTrack.setEnabled(isCameraOff);
      setIsCameraOff(!isCameraOff);
    }
  }, [previewVideoTrack, isCameraOff]);

  const handleStartCall = useCallback(() => {
    // Close preview tracks before starting real call
    previewVideoTrack?.close();
    previewAudioTrack?.close();
    setPreviewVideoTrack(null);
    setPreviewAudioTrack(null);
    onStartCall(callType);
    onClose();
  }, [previewVideoTrack, previewAudioTrack, onStartCall, callType, onClose]);

  const handleCameraChange = useCallback(async (deviceId: string) => {
    await selectCamera(deviceId);
  }, [selectCamera]);

  const handleMicrophoneChange = useCallback(async (deviceId: string) => {
    await selectMicrophone(deviceId);
  }, [selectMicrophone]);

  const handleClose = useCallback(() => {
    previewVideoTrack?.close();
    previewAudioTrack?.close();
    setPreviewVideoTrack(null);
    setPreviewAudioTrack(null);
    onClose();
  }, [previewVideoTrack, previewAudioTrack, onClose]);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Cài đặt cuộc gọi
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Recipient info */}
          {recipientInfo && (
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <Avatar className="h-10 w-10">
                <AvatarImage src={recipientInfo.avatarUrl} />
                <AvatarFallback>
                  {(recipientInfo.username || 'U')[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{recipientInfo.username || 'Người dùng'}</p>
                <p className="text-sm text-muted-foreground">
                  {callType === 'video' ? 'Video call' : 'Voice call'}
                </p>
              </div>
            </div>
          )}

          {/* Video Preview */}
          {callType === 'video' && (
            <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
              {isLoading ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : isCameraOff ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={userInfo?.avatarUrl} />
                    <AvatarFallback className="text-2xl">
                      {(userInfo?.username || 'Me')[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <p className="mt-2 text-sm text-muted-foreground">Camera đã tắt</p>
                </div>
              ) : (
                <div ref={videoContainerRef} className="w-full h-full" />
              )}

              {/* Overlay controls */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleToggleMute}
                  className={cn(
                    'h-10 w-10 rounded-full bg-background/80 backdrop-blur-sm',
                    isMuted && 'bg-destructive/20 text-destructive'
                  )}
                >
                  {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleToggleCamera}
                  className={cn(
                    'h-10 w-10 rounded-full bg-background/80 backdrop-blur-sm',
                    isCameraOff && 'bg-destructive/20 text-destructive'
                  )}
                >
                  {isCameraOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
                </Button>

                {hasMultipleCameras && !isCameraOff && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={flipCamera}
                    className="h-10 w-10 rounded-full bg-background/80 backdrop-blur-sm"
                  >
                    <RefreshCw className="h-5 w-5" />
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Audio only preview */}
          {callType === 'voice' && (
            <div className="flex items-center justify-center p-6 bg-muted rounded-lg">
              <Avatar className="h-20 w-20">
                <AvatarImage src={userInfo?.avatarUrl} />
                <AvatarFallback className="text-3xl">
                  {(userInfo?.username || 'Me')[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>
          )}

          {/* Device Selection */}
          <div className="space-y-3">
            {/* Camera Selection */}
            {callType === 'video' && devices.cameras.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-sm">Camera</Label>
                <Select
                  value={devices.selectedCamera || undefined}
                  onValueChange={handleCameraChange}
                  disabled={isEnumerating}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn camera" />
                  </SelectTrigger>
                  <SelectContent>
                    {devices.cameras.map((camera) => (
                      <SelectItem key={camera.deviceId} value={camera.deviceId}>
                        {camera.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Microphone Selection */}
            {devices.microphones.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-sm">Microphone</Label>
                <Select
                  value={devices.selectedMicrophone || undefined}
                  onValueChange={handleMicrophoneChange}
                  disabled={isEnumerating}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn microphone" />
                  </SelectTrigger>
                  <SelectContent>
                    {devices.microphones.map((mic) => (
                      <SelectItem key={mic.deviceId} value={mic.deviceId}>
                        {mic.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Audio Level Indicator */}
            {!isMuted && (
              <div className="space-y-1.5">
                <Label className="text-sm">Kiểm tra micro</Label>
                <div className="flex items-center gap-2">
                  <Mic className="h-4 w-4 text-muted-foreground" />
                  <Progress value={audioLevel} className="flex-1 h-2" />
                </div>
                <p className="text-xs text-muted-foreground">
                  Nói để kiểm tra microphone
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose}>
            Huỷ
          </Button>
          <Button onClick={handleStartCall} disabled={isLoading}>
            <Phone className="h-4 w-4 mr-2" />
            {callType === 'video' ? 'Gọi Video' : 'Gọi thoại'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
~~~

### FILE: src/modules/chat/components/RedEnvelopeCard.tsx
~~~tsx
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useRedEnvelope } from '../hooks/useRedEnvelope';
import { RedEnvelopeClaimDialog } from './RedEnvelopeClaimDialog';

interface RedEnvelopeCardProps {
  envelopeId: string;
  conversationId: string;
  currentUserId: string | null;
  compact?: boolean;
}

export function RedEnvelopeCard({
  envelopeId,
  conversationId,
  currentUserId,
  compact,
}: RedEnvelopeCardProps) {
  const [openDetails, setOpenDetails] = useState(false);
  const { envelope, claims, isLoading, claim } = useRedEnvelope(envelopeId, conversationId);

  const hasClaimed = useMemo(() => {
    if (!currentUserId) return false;
    return claims.some((c) => c.claimer_id === currentUserId);
  }, [claims, currentUserId]);

  const isActive = envelope?.status === 'active' && new Date(envelope.expires_at) > new Date();
  const canClaim = !!currentUserId && isActive && !hasClaimed && (envelope?.remaining_count || 0) > 0;

  return (
    <>
      <div
        className={cn(
          'rounded-xl border bg-gradient-to-br from-[#C62828] via-[#B71C1C] to-[#7f1d1d] text-white p-3 shadow-sm',
          compact && 'p-2'
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="font-semibold truncate">Lì xì</div>
            <div className="text-xs text-white/80">
              {isLoading || !envelope
                ? 'Đang tải...'
                : `${envelope.remaining_count}/${envelope.total_count} còn lại`}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setOpenDetails(true)}
              className="bg-white/15 hover:bg-white/20 text-white border-white/20"
            >
              Xem
            </Button>
            <Button
              size="sm"
              onClick={() => claim.mutate()}
              disabled={!canClaim || claim.isPending}
              className="bg-[#FFD700] hover:bg-[#FFC107] text-[#2E2A1F]"
            >
              {claim.isPending ? '...' : hasClaimed ? 'Đã nhận' : 'Nhận'}
            </Button>
          </div>
        </div>
        {!isLoading && envelope && (
          <div className="mt-2 text-xs text-white/80">
            Còn lại: {envelope.remaining_amount} {envelope.token}
          </div>
        )}
        {!isLoading && envelope && !isActive && (
          <div className="mt-2 text-xs text-white/80">Đã hết hạn hoặc đã hết.</div>
        )}
      </div>

      <RedEnvelopeClaimDialog
        open={openDetails}
        onOpenChange={setOpenDetails}
        envelope={envelope}
        claims={claims}
      />
    </>
  );
}

~~~

### FILE: src/modules/chat/components/RedEnvelopeClaimDialog.tsx
~~~tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { RedEnvelope, RedEnvelopeClaim } from '../types';

interface RedEnvelopeClaimDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  envelope: RedEnvelope | null;
  claims: RedEnvelopeClaim[];
}

export function RedEnvelopeClaimDialog({
  open,
  onOpenChange,
  envelope,
  claims,
}: RedEnvelopeClaimDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Chi tiết lì xì</DialogTitle>
        </DialogHeader>

        {!envelope ? (
          <div className="text-sm text-muted-foreground">Không tìm thấy lì xì.</div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-lg border bg-card p-3 text-sm">
              <div className="flex justify-between">
                <span>Tổng</span>
                <span className="font-medium">
                  {envelope.total_amount} {envelope.token}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Đã nhận</span>
                <span className="font-medium">
                  {envelope.total_count - envelope.remaining_count}/{envelope.total_count}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Còn lại</span>
                <span className="font-medium">
                  {envelope.remaining_amount} {envelope.token}
                </span>
              </div>
            </div>

            <div className="text-sm font-medium">Danh sách nhận</div>
            <ScrollArea className="h-48 rounded-md border">
              <div className="p-2 space-y-1">
                {claims.length === 0 ? (
                  <div className="text-sm text-muted-foreground p-2">Chưa có ai nhận.</div>
                ) : (
                  claims.map((c) => (
                    <div key={c.id} className="flex justify-between text-sm rounded-md px-2 py-1 hover:bg-accent">
                      <span className="font-mono text-xs">{c.claimer_id.slice(0, 8)}...</span>
                      <span className="font-medium">
                        {c.amount} {envelope.token}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

~~~

### FILE: src/modules/chat/components/RedEnvelopeDialog.tsx
~~~tsx
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface RedEnvelopeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isCreating: boolean;
  onCreate: (input: { token: 'CAMLY' | 'BNB'; totalAmount: number; totalCount: number }) => void;
}

export function RedEnvelopeDialog({ open, onOpenChange, isCreating, onCreate }: RedEnvelopeDialogProps) {
  const [token, setToken] = useState<'CAMLY' | 'BNB'>('CAMLY');
  const [amount, setAmount] = useState('10');
  const [count, setCount] = useState('5');

  useEffect(() => {
    if (open) {
      setToken('CAMLY');
      setAmount('10');
      setCount('5');
    }
  }, [open]);

  const handleCreate = () => {
    const totalAmount = Number(amount);
    const totalCount = Number(count);
    if (!totalAmount || totalAmount <= 0) return;
    if (!totalCount || totalCount <= 0) return;
    onCreate({ token, totalAmount, totalCount });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Lì xì</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Token</Label>
            <Select value={token} onValueChange={(v) => setToken(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CAMLY">CAMLY</SelectItem>
                <SelectItem value="BNB">BNB</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Tổng số tiền</Label>
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" min="0" step="0.0001" />
          </div>

          <div className="space-y-2">
            <Label>Số người nhận</Label>
            <Input value={count} onChange={(e) => setCount(e.target.value)} type="number" min="1" step="1" />
          </div>

          <div className="text-xs text-muted-foreground">
            Phân phối ngẫu nhiên, hết hạn sau 24 giờ.
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isCreating}>
            Hủy
          </Button>
          <Button onClick={handleCreate} disabled={isCreating}>
            {isCreating ? 'Đang tạo...' : 'Tạo lì xì'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

~~~

### FILE: src/modules/chat/components/ReportDialog.tsx
~~~tsx
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const REASONS = [
  { value: 'spam', label: 'Spam / Quảng cáo' },
  { value: 'harassment', label: 'Quấy rối / xúc phạm' },
  { value: 'scam', label: 'Lừa đảo' },
  { value: 'hate', label: 'Kích động thù ghét' },
  { value: 'other', label: 'Khác' },
];

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSubmitting: boolean;
  onSubmit: (input: { reason: string; details: string | null }) => void;
}

export function ReportDialog({ open, onOpenChange, isSubmitting, onSubmit }: ReportDialogProps) {
  const [reason, setReason] = useState<string>('spam');
  const [details, setDetails] = useState('');

  const handleSubmit = () => {
    onSubmit({ reason, details: details.trim() ? details.trim() : null });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Gửi phản hồi</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Lý do</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Chọn lý do" />
              </SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Chi tiết (tùy chọn)</Label>
            <Textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Mô tả thêm để đội ngũ hiểu rõ hơn..."
              className="min-h-[90px]"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Hủy
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Đang gửi...' : 'Gửi'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

~~~

### FILE: src/modules/chat/components/SendCryptoModal.tsx
~~~tsx
import { useState } from 'react';
import { useAccount, useChainId, useSendTransaction, useSwitchChain, useWriteContract } from 'wagmi';
import { waitForTransactionReceipt } from 'wagmi/actions';
import { bsc } from 'wagmi/chains';
import { parseEther, parseUnits } from 'viem';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CheckCircle2, Wallet, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { config as wagmiConfig } from '@/config/web3';
import { TOKEN_META } from '@/config/tokens';
import { ERC20_ABI } from '@/lib/erc20';
import { validateEvmAddress } from '@/utils/walletValidation';

// Token logos
import bnbLogo from '@/assets/tokens/bnb-logo.webp';
import camlyLogo from '@/assets/tokens/camly-logo.webp';
import usdtLogo from '@/assets/tokens/usdt-logo.webp';

type TokenSymbol = 'BNB' | 'CAMLY' | 'USDT';

interface SendCryptoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipientAddress?: string | null;
  recipientUserId?: string | null;
  recipientName?: string | null;
  recipientAvatar?: string | null;
  conversationId?: string | null;
}

const TOKEN_LOGOS: Record<TokenSymbol, string> = {
  BNB: bnbLogo,
  CAMLY: camlyLogo,
  USDT: usdtLogo,
};

const TOKEN_LABEL: Record<TokenSymbol, string> = {
  BNB: 'BNB',
  CAMLY: 'CAMLY',
  USDT: 'USDT',
};

const TokenOption = ({ token }: { token: TokenSymbol }) => (
  <div className="flex items-center gap-2">
    <img src={TOKEN_LOGOS[token]} alt={token} className="h-6 w-6 rounded-full" />
    <span className="font-medium text-[#2E2A1F]">{TOKEN_LABEL[token]}</span>
  </div>
);

// Helper to shorten wallet address
const shortenAddress = (address: string) => {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

const getErrorMessage = (error: unknown): string => {
  if (!error) return 'Unknown error';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  const e = error as any;
  return (
    e?.shortMessage ||
    e?.details ||
    e?.message ||
    'Unknown error'
  );
};

// Decorative SVG Components
const ApricotFlower = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="30" cy="12" rx="8" ry="12" fill="#FFD54F" opacity="0.9" />
    <ellipse cx="30" cy="48" rx="8" ry="12" fill="#FFD54F" opacity="0.9" />
    <ellipse cx="12" cy="30" rx="8" ry="12" fill="#FFD54F" opacity="0.9" transform="rotate(90 12 30)" />
    <ellipse cx="48" cy="30" rx="8" ry="12" fill="#FFD54F" opacity="0.9" transform="rotate(90 48 30)" />
    <ellipse cx="17" cy="17" rx="7" ry="11" fill="#FFD54F" opacity="0.85" transform="rotate(45 17 17)" />
    <ellipse cx="43" cy="43" rx="7" ry="11" fill="#FFD54F" opacity="0.85" transform="rotate(45 43 43)" />
    <ellipse cx="43" cy="17" rx="7" ry="11" fill="#FFD54F" opacity="0.85" transform="rotate(-45 43 17)" />
    <ellipse cx="17" cy="43" rx="7" ry="11" fill="#FFD54F" opacity="0.85" transform="rotate(-45 17 43)" />
    <circle cx="30" cy="30" r="6" fill="#D32F2F" />
    <circle cx="28" cy="28" r="1.5" fill="#FFEB3B" />
    <circle cx="32" cy="28" r="1.5" fill="#FFEB3B" />
    <circle cx="30" cy="32" r="1.5" fill="#FFEB3B" />
  </svg>
);

const PeachBlossom = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="40" cy="15" rx="10" ry="14" fill="#F8BBD9" opacity="0.9" />
    <ellipse cx="40" cy="65" rx="10" ry="14" fill="#F8BBD9" opacity="0.9" />
    <ellipse cx="15" cy="40" rx="10" ry="14" fill="#F8BBD9" opacity="0.9" transform="rotate(90 15 40)" />
    <ellipse cx="65" cy="40" rx="10" ry="14" fill="#F8BBD9" opacity="0.9" transform="rotate(90 65 40)" />
    <ellipse cx="22" cy="22" rx="9" ry="13" fill="#F8BBD9" opacity="0.85" transform="rotate(45 22 22)" />
    <ellipse cx="58" cy="58" rx="9" ry="13" fill="#F8BBD9" opacity="0.85" transform="rotate(45 58 58)" />
    <ellipse cx="58" cy="22" rx="9" ry="13" fill="#F8BBD9" opacity="0.85" transform="rotate(-45 58 22)" />
    <ellipse cx="22" cy="58" rx="9" ry="13" fill="#F8BBD9" opacity="0.85" transform="rotate(-45 22 58)" />
    <circle cx="40" cy="40" r="8" fill="#EC407A" />
    <circle cx="37" cy="37" r="2" fill="#FFEB3B" />
    <circle cx="43" cy="37" r="2" fill="#FFEB3B" />
    <circle cx="40" cy="43" r="2" fill="#FFEB3B" />
  </svg>
);

const RedEnvelope = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 120 140" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Main envelope body */}
    <rect x="10" y="20" width="100" height="110" rx="8" fill="#C62828" />
    <rect x="10" y="20" width="100" height="110" rx="8" stroke="#FFD700" strokeWidth="2" />
    
    {/* Top flap */}
    <path d="M10 28 L60 60 L110 28" fill="#B71C1C" />
    <path d="M10 28 L60 60 L110 28" stroke="#FFD700" strokeWidth="2" fill="none" />
    
    {/* Gold circle decoration */}
    <circle cx="60" cy="85" r="25" fill="#FFD700" />
    <circle cx="60" cy="85" r="20" fill="#FFC107" />
    <circle cx="60" cy="85" r="15" fill="#FFD700" />
    
    {/* Inner square hole pattern */}
    <rect x="52" y="77" width="16" height="16" rx="2" fill="#C62828" />
    
    {/* Decorative patterns */}
    <circle cx="35" cy="50" r="4" fill="#FFD700" opacity="0.6" />
    <circle cx="85" cy="50" r="4" fill="#FFD700" opacity="0.6" />
  </svg>
);

const Firecracker = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 40 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* String */}
    <path d="M20 0 C20 10, 15 15, 20 20" stroke="#8B4513" strokeWidth="2" fill="none" />
    
    {/* Firecracker body */}
    <rect x="8" y="20" width="24" height="35" rx="3" fill="#C62828" />
    <rect x="8" y="20" width="24" height="35" rx="3" stroke="#FFD700" strokeWidth="1" />
    
    {/* Gold bands */}
    <rect x="8" y="25" width="24" height="4" fill="#FFD700" />
    <rect x="8" y="46" width="24" height="4" fill="#FFD700" />
    
    {/* Second firecracker */}
    <rect x="12" y="58" width="20" height="30" rx="2" fill="#D32F2F" />
    <rect x="12" y="62" width="20" height="3" fill="#FFD700" />
    <rect x="12" y="81" width="20" height="3" fill="#FFD700" />
    
    {/* Small decorative dots */}
    <circle cx="20" cy="37" r="2" fill="#FFD700" />
    <circle cx="22" cy="73" r="1.5" fill="#FFD700" />
  </svg>
);

const Sparkle = ({ className, delay = 0 }: { className?: string; delay?: number }) => (
  <div 
    className={`absolute ${className}`}
    style={{
      animation: `sparkle 2s ease-in-out infinite`,
      animationDelay: `${delay}s`,
    }}
  >
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 0 L7 4.5 L12 6 L7 7.5 L6 12 L5 7.5 L0 6 L5 4.5 Z" fill="#FFD700" />
    </svg>
  </div>
);

export function SendCryptoModal({ 
  open, 
  onOpenChange, 
  recipientAddress,
  recipientUserId,
  recipientName,
  recipientAvatar,
  conversationId,
}: SendCryptoModalProps) {
  const { isConnected, address: senderAddress } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const { sendTransactionAsync, isPending: isSendingNative } = useSendTransaction();
  const { writeContractAsync, isPending: isWritingContract } = useWriteContract();
  const [token, setToken] = useState<TokenSymbol>('BNB');
  const [amount, setAmount] = useState('');
  const [isConfirming, setIsConfirming] = useState(false);

  const isBusy = isConfirming || isSendingNative || isWritingContract;
  const hasRecipientWallet = !!recipientAddress;

  const resetForm = () => {
    setToken('BNB');
    setAmount('');
  };

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetForm();
    }
    onOpenChange(nextOpen);
  };

  const handleConfirm = async () => {
    if (!recipientAddress) {
      toast.error('Thiếu địa chỉ ví người nhận.');
      return;
    }

    if (!validateEvmAddress(recipientAddress)) {
      return;
    }

    if (!recipientUserId) {
      toast.error('Thiếu thông tin người nhận.');
      return;
    }

    const normalizedAmount = amount.trim();
    if (!normalizedAmount || Number(normalizedAmount) <= 0) {
      toast.error('Vui lòng nhập số lượng hợp lệ.');
      return;
    }

    if (!isConnected) {
      toast.error('Vui lòng kết nối ví trước.');
      return;
    }

    if (chainId && chainId !== bsc.id) {
      // Ask user to switch then retry.
      switchChain(
        { chainId: bsc.id },
        {
          onSuccess: () => toast.success('Đã chuyển sang BNB Smart Chain. Vui lòng xác nhận lại.'),
          onError: () => toast.error('Vui lòng chuyển sang BNB Smart Chain để tiếp tục.'),
        }
      );
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const currentUserId = sessionData?.session?.user?.id;
    if (!currentUserId) {
      toast.error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
      return;
    }

    let giftId: string | null = null;
    try {
      setIsConfirming(true);

      const { data: giftRow, error: insertError } = await supabase
        .from('crypto_gifts')
        .insert({
          from_user_id: currentUserId,
          to_user_id: recipientUserId,
          to_address: recipientAddress,
          token,
          amount_numeric: Number(normalizedAmount),
          conversation_id: conversationId ?? null,
          status: 'pending',
        })
        .select('id')
        .single();

      if (insertError || !giftRow?.id) {
        throw new Error(insertError?.message || 'Không thể tạo bản ghi tặng quà.');
      }

      giftId = giftRow.id as string;

      const updateGift = async (patch: Record<string, any>) => {
        await supabase
          .from('crypto_gifts')
          .update(patch)
          .eq('id', giftId);
      };

      let hash: `0x${string}`;

      if (token === 'BNB') {
        hash = await sendTransactionAsync({
          to: recipientAddress as `0x${string}`,
          value: parseEther(normalizedAmount),
          chainId: bsc.id,
        });
      } else {
        const meta = token === 'CAMLY' ? TOKEN_META.CAMLY : TOKEN_META.USDT;
        let value: bigint;
        try {
          value = parseUnits(normalizedAmount, meta.decimals);
        } catch {
          throw new Error(`Số lượng không hợp lệ cho ${token}. Tối đa ${meta.decimals} chữ số thập phân.`);
        }

        hash = await writeContractAsync({
          address: meta.address,
          abi: ERC20_ABI,
          functionName: 'transfer',
          args: [recipientAddress as `0x${string}`, value],
          chainId: bsc.id,
          account: senderAddress,
          chain: bsc,
        });
      }

      await updateGift({ tx_hash: hash, status: 'pending', error: null });
      toast.success('Đã gửi giao dịch.');

      try {
        const receipt = await waitForTransactionReceipt(wagmiConfig, {
          hash,
          chainId: bsc.id,
          confirmations: 1,
        });

        const receiptStatus = (receipt as any)?.status;
        if (receiptStatus && receiptStatus !== 'success') {
          await updateGift({ status: 'failed', error: 'Giao dịch bị revert.' });
          toast.error('Giao dịch bị revert.');
          return;
        }

        await updateGift({ status: 'confirmed', error: null });
        toast.success('Tặng quà thành công.');
        handleClose(false);
      } catch (e) {
        // If we already have a hash but can't confirm, keep it pending.
        await updateGift({ status: 'pending', error: getErrorMessage(e) });
        toast.warning('Giao dịch đã gửi. Đang chờ xác nhận.');
        handleClose(false);
      }
    } catch (error) {
      const message = getErrorMessage(error);
      if (giftId) {
        await supabase
          .from('crypto_gifts')
          .update({ status: 'failed', error: message || 'Không thể tặng quà.' })
          .eq('id', giftId);
      }
      toast.error(message || 'Không thể tặng quà.');
    }
    finally {
      setIsConfirming(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md p-0 border-2 border-[#E7C76A]/60 bg-gradient-to-br from-[#FFFBF3] via-[#FFF7E6] to-[#FFF3DA] shadow-2xl overflow-hidden">
        {/* Sparkle animation keyframes */}
        <style>{`
          @keyframes sparkle {
            0%, 100% { opacity: 0; transform: scale(0.5); }
            50% { opacity: 1; transform: scale(1); }
          }
        `}</style>

        {/* Decorative elements */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {/* Hoa mai - góc trái trên */}
          <ApricotFlower className="absolute -top-2 -left-2 w-16 h-16 opacity-80" />
          <ApricotFlower className="absolute top-8 left-6 w-10 h-10 opacity-60" />
          
          {/* Hoa đào - góc phải trên */}
          <PeachBlossom className="absolute -top-4 -right-4 w-20 h-20 opacity-70" />
          <PeachBlossom className="absolute top-10 right-8 w-12 h-12 opacity-50" />
          
          {/* Hoa mai - góc trái dưới */}
          <ApricotFlower className="absolute -bottom-3 -left-3 w-14 h-14 opacity-70" />
          <ApricotFlower className="absolute bottom-10 left-4 w-8 h-8 opacity-50" />
          
          {/* Pháo - góc phải dưới */}
          <Firecracker className="absolute -bottom-2 right-4 w-8 h-20 opacity-80" />
          <Firecracker className="absolute bottom-8 -right-1 w-6 h-16 opacity-60" />
          
          {/* Sparkles */}
          <Sparkle className="top-16 left-20" delay={0} />
          <Sparkle className="top-24 right-16" delay={0.5} />
          <Sparkle className="bottom-20 left-16" delay={1} />
          <Sparkle className="bottom-28 right-20" delay={1.5} />
          <Sparkle className="top-1/2 left-8" delay={0.8} />
          <Sparkle className="top-1/3 right-10" delay={1.2} />
          
          {/* Gradient overlays */}
          <div className="absolute -top-10 -left-12 h-28 w-28 rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(255,213,79,0.25),transparent_70%)]" />
          <div className="absolute -bottom-10 -right-10 h-32 w-32 rounded-full bg-[radial-gradient(circle_at_70%_70%,rgba(255,182,193,0.25),transparent_70%)]" />
          
          {/* Top border gradient */}
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#FFD54F] via-[#E7C76A] to-[#FFD54F]" />
        </div>

        {/* Close button */}
        <button
          onClick={() => handleClose(false)}
          className="absolute right-4 top-4 z-10 rounded-full p-1 hover:bg-[#E7C76A]/20 transition-colors"
        >
          <X className="h-5 w-5 text-[#5A4F3B]" />
        </button>

        {/* Content */}
        <div className="relative z-10 p-6 pt-8">
          {/* Header */}
          <div className="text-center mb-4">
            <h2 className="text-xl font-bold text-[#2E2A1F] mb-1">Tặng quà crypto</h2>
            <p className="text-sm text-[#5A4F3B]">
              Chia sẻ món quà token với hương vị Tết ấm áp.
            </p>
          </div>

          {/* Red Envelope Icon */}
          <div className="flex justify-center mb-5">
            <RedEnvelope className="w-20 h-24" />
          </div>

          {/* Recipient Card */}
          <div className="bg-white/60 backdrop-blur-sm rounded-xl p-3 mb-5 border border-[#E7C76A]/40 shadow-sm">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12 ring-2 ring-[#E7C76A]/50">
                <AvatarImage src={recipientAvatar || undefined} alt={recipientName || 'Recipient'} />
                <AvatarFallback className="bg-gradient-to-br from-[#FFD54F] to-[#E7C76A] text-[#2E2A1F] font-semibold">
                  {(recipientName || 'U')[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[#8B7355] font-medium">Người nhận</p>
                <div className="flex items-center gap-1.5">
                  <p className="font-semibold text-[#2E2A1F] truncate">
                    {recipientName || 'User'}
                  </p>
                  <span className="text-[#8B7355]">›</span>
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                  {hasRecipientWallet ? (
                    <span className="text-xs text-[#8B7355] font-mono">
                      {shortenAddress(recipientAddress || '')}
                    </span>
                  ) : (
                    <span className="text-xs text-rose-700">
                      Người dùng chưa cập nhật ví Web3
                    </span>
                  )}
                </div>
              </div>
              <div className="flex-shrink-0">
                <div className="w-8 h-8 rounded-full bg-[#E7C76A]/20 flex items-center justify-center">
                  <Wallet className="h-4 w-4 text-[#8B7355]" />
                </div>
              </div>
            </div>
          </div>

          {/* Token Selection */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-[#4E4433]">Token</Label>
              <Select value={token} onValueChange={(value) => setToken(value as TokenSymbol)}>
                <SelectTrigger className="h-12 border-[#E7C76A]/60 bg-white/70 text-[#2E2A1F] focus-visible:ring-[#E7C76A]/60">
                  <SelectValue placeholder="Select token">
                    <div className="flex items-center justify-between w-full">
                      <TokenOption token={token} />
                      <span className="text-[#8B7355] text-sm ml-auto mr-2">0.0 {token}</span>
                    </div>
                  </SelectValue>
                </SelectTrigger>
              <SelectContent className="z-[9999]">
                <SelectItem value="BNB">
                  <TokenOption token="BNB" />
                </SelectItem>
                  <SelectItem value="CAMLY">
                    <TokenOption token="CAMLY" />
                  </SelectItem>
                  <SelectItem value="USDT">
                    <TokenOption token="USDT" />
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Amount Input */}
            <div className="space-y-2">
              <Label htmlFor="crypto-amount" className="text-sm font-semibold text-[#4E4433]">
                Số lượng
              </Label>
              <Input
                id="crypto-amount"
                type="number"
                step="0.0001"
                min="0"
                placeholder="0.0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-12 border-[#E7C76A]/60 bg-white/70 text-base font-semibold text-[#2E2A1F] focus-visible:ring-[#E7C76A]/60"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mt-6">
            <Button 
              variant="outline" 
              onClick={() => handleClose(false)} 
              disabled={isBusy} 
              className="flex-1 h-11 border-2 border-[#D9C184] text-[#4E4433] bg-white/50 hover:bg-[#E7C76A]/20 font-semibold"
            >
              Hủy
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={isBusy || !hasRecipientWallet}
              className="flex-1 h-11 bg-[#1B5E20] hover:bg-[#2E7D32] text-white font-semibold shadow-lg transition-all duration-150 hover:shadow-[0_0_16px_rgba(27,94,32,0.4)]"
            >
              {isBusy ? 'Đang gửi...' : 'Xác nhận'}
            </Button>
          </div>
          {!hasRecipientWallet && (
            <div className="mt-2 text-xs text-rose-700 text-center">
              Người nhận chưa cập nhật ví Web3, nên chưa thể thực hiện tặng tiền.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
~~~

### FILE: src/modules/chat/components/StickerPicker.tsx
~~~tsx
import { useMemo } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { useStickers } from '../hooks/useStickers';
import type { Sticker, StickerPack } from '../types';

interface StickerPickerProps {
  onSelect: (sticker: Sticker) => void;
  disabled?: boolean;
}

export function StickerPicker({ onSelect, disabled }: StickerPickerProps) {
  const { packs, stickersByPack, isLoading } = useStickers();

  const defaultPackId = useMemo(() => packs[0]?.id || 'default', [packs]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          className="flex-shrink-0 border border-[#C9A84C]/30 hover:border-[#C9A84C]/60 rounded-full px-3"
          title="Stickers"
        >
          Stickers
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" side="top" align="start">
        <div className="border-b px-3 py-2 text-sm font-medium">Stickers</div>
        {isLoading ? (
          <div className="p-4 text-sm text-muted-foreground">Loading...</div>
        ) : packs.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">ChÆ°a cĂ³ bá»™ sticker</div>
        ) : (
          <Tabs defaultValue={defaultPackId} className="w-full">
            <TabsList className="w-full justify-start overflow-x-auto">
              {packs.map((p: StickerPack) => (
                <TabsTrigger key={p.id} value={p.id} className="text-xs">
                  {p.name}
                </TabsTrigger>
              ))}
            </TabsList>
            {packs.map((p: StickerPack) => {
              const stickers = stickersByPack.get(p.id) || [];
              return (
                <TabsContent key={p.id} value={p.id} className="m-0">
                  <ScrollArea className="h-64">
                    <div className="grid grid-cols-3 gap-2 p-3">
                      {stickers.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => onSelect(s)}
                          className="rounded-lg border bg-card hover:bg-accent transition-colors p-2"
                          title={s.name}
                        >
                          <img src={s.url} alt={s.name} className="w-full h-20 object-contain" />
                        </button>
                      ))}
                      {stickers.length === 0 && (
                        <div className="col-span-3 text-sm text-muted-foreground">Bá»™ nĂ y chÆ°a cĂ³ sticker</div>
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>
              );
            })}
          </Tabs>
        )}
      </PopoverContent>
    </Popover>
  );
}
~~~

### FILE: src/modules/chat/components/TypingIndicator.tsx
~~~tsx
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { TypingUser } from '../types';

interface TypingIndicatorProps {
  users: TypingUser[];
}

export function TypingIndicator({ users }: TypingIndicatorProps) {
  if (users.length === 0) return null;

  const displayText = users.length === 1
    ? `${users[0].username} đang nhập...`
    : users.length === 2
    ? `${users[0].username} và ${users[1].username} đang nhập...`
    : `${users[0].username} và ${users.length - 1} người khác đang nhập...`;

  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-2">
        {users.slice(0, 3).map((user) => (
          <Avatar key={user.userId} className="h-6 w-6 border-2 border-background">
            <AvatarImage src={user.avatar_url} alt={user.username} />
            <AvatarFallback className="text-xs">
              {user.username[0].toUpperCase()}
            </AvatarFallback>
          </Avatar>
        ))}
      </div>
      
      <div className="bg-muted rounded-2xl px-4 py-2 flex items-center gap-1">
        <span className="text-sm text-muted-foreground">{displayText}</span>
        <div className="flex gap-0.5 ml-1">
          <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}
~~~

### FILE: src/modules/chat/components/VideoGrid.tsx
~~~tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ICameraVideoTrack } from 'agora-rtc-sdk-ng';
import { cn } from '@/lib/utils';
import { MicOff, VideoOff, Maximize2, Minimize2 } from 'lucide-react';
import type { RemoteUser } from '../types';

interface VideoGridProps {
  localVideoTrack: ICameraVideoTrack | null;
  remoteUsers: RemoteUser[];
  isLocalCameraOff: boolean;
  isLocalMuted?: boolean;
  localUserInfo?: {
    username?: string;
    avatarUrl?: string;
  };
  remoteUserInfo?: {
    username?: string;
    avatarUrl?: string;
  };
}

function VideoPlayer({ videoTrack, className }: { videoTrack: any; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current && videoTrack) {
      videoTrack.play(containerRef.current);
    }
    return () => {
      videoTrack?.stop();
    };
  }, [videoTrack]);

  return <div ref={containerRef} className={cn('w-full h-full', className)} />;
}

export function VideoGrid({
  localVideoTrack,
  remoteUsers,
  isLocalCameraOff,
  isLocalMuted = false,
  localUserInfo,
  remoteUserInfo,
}: VideoGridProps) {
  // State for swapping main and PiP views
  const [isSwapped, setIsSwapped] = useState(false);
  
  const totalParticipants = remoteUsers.length + 1; // +1 for local user
  
  // Determine grid layout based on participant count
  const getGridClass = () => {
    if (totalParticipants === 1) return 'grid-cols-1';
    if (totalParticipants === 2) return 'grid-cols-1 md:grid-cols-2';
    if (totalParticipants <= 4) return 'grid-cols-2';
    if (totalParticipants <= 6) return 'grid-cols-2 md:grid-cols-3';
    return 'grid-cols-3 md:grid-cols-4';
  };

  // For 1-on-1 calls, show remote user full screen and local as PiP
  const isOneOnOne = remoteUsers.length === 1;

  // Handle tap on PiP to swap views
  const handleSwap = useCallback(() => {
    setIsSwapped(prev => !prev);
  }, []);

  if (isOneOnOne) {
    const remoteUser = remoteUsers[0];
    
    // Determine which video goes where based on swap state
    const mainVideoTrack = isSwapped ? localVideoTrack : (remoteUser.hasVideo ? remoteUser.videoTrack : null);
    const mainCameraOff = isSwapped ? isLocalCameraOff : !remoteUser.hasVideo;
    const mainUserInfo = isSwapped ? localUserInfo : remoteUserInfo;
    const mainLabel = isSwapped ? 'Bạn' : (remoteUserInfo?.username || 'User');
    const mainMuted = isSwapped ? isLocalMuted : !remoteUser.hasAudio;
    
    const pipVideoTrack = isSwapped ? (remoteUser.hasVideo ? remoteUser.videoTrack : null) : localVideoTrack;
    const pipCameraOff = isSwapped ? !remoteUser.hasVideo : isLocalCameraOff;
    const pipUserInfo = isSwapped ? remoteUserInfo : localUserInfo;
    const pipLabel = isSwapped ? (remoteUserInfo?.username || 'User') : 'Bạn';
    const pipMuted = isSwapped ? !remoteUser.hasAudio : isLocalMuted;
    
    return (
      <div className="relative w-full h-full bg-muted">
        {/* Main video - full screen */}
        {!mainCameraOff && mainVideoTrack ? (
          <VideoPlayer videoTrack={mainVideoTrack} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted">
            <Avatar className="h-32 w-32">
              <AvatarImage src={mainUserInfo?.avatarUrl} />
              <AvatarFallback className="text-4xl">
                {(mainUserInfo?.username || 'U')[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
        )}
        
        {/* Main user indicators */}
        <div className="absolute top-4 left-4 flex items-center gap-2">
          <span className="text-sm text-primary-foreground bg-background/50 px-2 py-1 rounded backdrop-blur-sm">
            {mainLabel}
          </span>
          {mainMuted && (
            <div className="bg-destructive/80 p-1 rounded-full">
              <MicOff className="h-4 w-4 text-destructive-foreground" />
            </div>
          )}
        </div>

        {/* Swap indicator */}
        <div className="absolute top-4 right-4">
          <div 
            onClick={handleSwap}
            className="p-2 rounded-full bg-background/50 backdrop-blur-sm cursor-pointer hover:bg-background/70 transition-colors"
          >
            {isSwapped ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </div>
        </div>

        {/* PiP video - Picture in Picture (tap to swap) */}
        <div 
          onClick={handleSwap}
          className="absolute bottom-4 right-4 w-28 h-40 sm:w-32 sm:h-44 md:w-40 md:h-56 rounded-lg overflow-hidden shadow-lg border-2 border-background cursor-pointer hover:border-primary/50 transition-colors group"
        >
          {!pipCameraOff && pipVideoTrack ? (
            <VideoPlayer videoTrack={pipVideoTrack} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-muted">
              <Avatar className="h-12 w-12 sm:h-16 sm:w-16">
                <AvatarImage src={pipUserInfo?.avatarUrl} />
                <AvatarFallback>
                  {(pipUserInfo?.username || 'Me')[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>
          )}
          
          {/* PiP overlay info */}
          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
            <span className="text-xs text-primary-foreground bg-background/50 px-1 py-0.5 rounded">
              {pipLabel}
            </span>
            <div className="flex items-center gap-1">
              {pipCameraOff && (
                <div className="bg-destructive/80 p-0.5 rounded-full">
                  <VideoOff className="h-3 w-3 text-destructive-foreground" />
                </div>
              )}
              {pipMuted && (
                <div className="bg-destructive/80 p-0.5 rounded-full">
                  <MicOff className="h-3 w-3 text-destructive-foreground" />
                </div>
              )}
            </div>
          </div>

          {/* Tap to swap hint */}
          <div className="absolute inset-0 bg-background/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <span className="text-xs text-foreground font-medium">Chạm để swap</span>
          </div>
        </div>
      </div>
    );
  }

  // Grid layout for group calls or when no remote users
  return (
    <div className={cn('w-full h-full grid gap-2 p-2', getGridClass())}>
      {/* Local user */}
      <div className="relative rounded-lg overflow-hidden bg-muted aspect-video">
        {!isLocalCameraOff && localVideoTrack ? (
          <VideoPlayer videoTrack={localVideoTrack} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Avatar className="h-20 w-20">
              <AvatarImage src={localUserInfo?.avatarUrl} />
              <AvatarFallback className="text-2xl">
                {(localUserInfo?.username || 'Me')[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
        )}
        <div className="absolute bottom-2 left-2 flex items-center gap-1">
          <span className="text-xs text-primary-foreground bg-background/50 px-2 py-1 rounded">
            Bạn
          </span>
          {isLocalMuted && (
            <div className="bg-destructive/80 p-0.5 rounded-full">
              <MicOff className="h-3 w-3 text-destructive-foreground" />
            </div>
          )}
        </div>
      </div>

      {/* Remote users */}
      {remoteUsers.map((user) => (
        <div key={String(user.uid)} className="relative rounded-lg overflow-hidden bg-muted aspect-video">
          {user.hasVideo && user.videoTrack ? (
            <VideoPlayer videoTrack={user.videoTrack} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Avatar className="h-20 w-20">
                <AvatarFallback className="text-2xl">U</AvatarFallback>
              </Avatar>
            </div>
          )}
          <div className="absolute bottom-2 left-2 flex items-center gap-1">
            <span className="text-xs text-primary-foreground bg-background/50 px-2 py-1 rounded">
              User {user.uid}
            </span>
            {!user.hasAudio && (
              <div className="bg-destructive/80 p-0.5 rounded-full">
                <MicOff className="h-3 w-3 text-destructive-foreground" />
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
~~~

### FILE: src/modules/chat/hooks/useAgoraCall.ts
~~~ts
import { useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import AgoraRTC, {
  IAgoraRTCClient,
  IMicrophoneAudioTrack,
  ICameraVideoTrack,
  IAgoraRTCRemoteUser,
  UID,
} from 'agora-rtc-sdk-ng';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { createAgoraRtcClient, getAgoraRtcToken } from '@/lib/agoraRtc';

export type CallState = 'idle' | 'calling' | 'ringing' | 'connecting' | 'connected' | 'ended';
export type CallType = 'voice' | 'video';

export interface CallSession {
  id: string;
  conversation_id: string;
  initiator_id: string;
  call_type: CallType;
  status: string;
  channel_name: string;
  started_at?: string;
  ended_at?: string;
  duration_seconds?: number;
}

export interface RemoteUser {
  uid: UID;
  audioTrack?: any;
  videoTrack?: any;
  hasAudio: boolean;
  hasVideo: boolean;
}

interface UseAgoraCallOptions {
  conversationId?: string;
  userId: string | null;
}

// Call timeout in milliseconds (45 seconds)
const CALL_TIMEOUT_MS = 45000;

export function useAgoraCall({ conversationId, userId }: UseAgoraCallOptions) {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // State
  const [callState, setCallState] = useState<CallState>('idle');
  const [callType, setCallType] = useState<CallType>('voice');
  const [currentSession, setCurrentSession] = useState<CallSession | null>(null);
  const [remoteUsers, setRemoteUsers] = useState<RemoteUser[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [incomingCall, setIncomingCall] = useState<CallSession | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isAutoAnswering, setIsAutoAnswering] = useState(false);

  // Refs
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const localAudioTrackRef = useRef<IMicrophoneAudioTrack | null>(null);
  const callInProgressRef = useRef(false);
  const localVideoTrackRef = useRef<ICameraVideoTrack | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const callTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const autoAnswerProcessedRef = useRef<string | null>(null);
  
  // Refs to avoid closure issues in event handlers
  const callStateRef = useRef<CallState>('idle');
  const endCallRef = useRef<(() => Promise<void>) | null>(null);

  // Generate unique channel name
  const generateChannelName = useCallback(() => {
    return `call_${conversationId}_${Date.now()}`;
  }, [conversationId]);

  // Get Agora token from Cloudflare Worker
  const getToken = useCallback(async (channelName: string) => {
    return getAgoraRtcToken(channelName, 'host');
  }, []);

  // Initialize Agora client
  const initClient = useCallback(() => {
    if (!clientRef.current) {
      clientRef.current = createAgoraRtcClient('rtc');
      
      // Event handlers
      clientRef.current.on('user-published', async (user, mediaType) => {
        await clientRef.current?.subscribe(user, mediaType);
        
        setRemoteUsers(prev => {
          const existing = prev.find(u => u.uid === user.uid);
          if (existing) {
            return prev.map(u => 
              u.uid === user.uid 
                ? { 
                    ...u, 
                    [mediaType === 'audio' ? 'audioTrack' : 'videoTrack']: user[mediaType === 'audio' ? 'audioTrack' : 'videoTrack'],
                    [mediaType === 'audio' ? 'hasAudio' : 'hasVideo']: true 
                  }
                : u
            );
          }
          return [...prev, {
            uid: user.uid,
            audioTrack: mediaType === 'audio' ? user.audioTrack : undefined,
            videoTrack: mediaType === 'video' ? user.videoTrack : undefined,
            hasAudio: mediaType === 'audio',
            hasVideo: mediaType === 'video',
          }];
        });

        // Play audio track
        if (mediaType === 'audio' && user.audioTrack) {
          user.audioTrack.play();
        }
      });

      clientRef.current.on('user-unpublished', (user, mediaType) => {
        setRemoteUsers(prev => 
          prev.map(u => 
            u.uid === user.uid 
              ? { 
                  ...u, 
                  [mediaType === 'audio' ? 'audioTrack' : 'videoTrack']: undefined,
                  [mediaType === 'audio' ? 'hasAudio' : 'hasVideo']: false 
                }
              : u
          )
        );
      });

      clientRef.current.on('user-left', (user, reason) => {
        console.log('[Agora] Remote user left:', user.uid, 'reason:', reason);
        
        setRemoteUsers(prev => {
          const newUsers = prev.filter(u => u.uid !== user.uid);
          
          // In 1-on-1 calls, if no remote users left, auto-end the call
          if (newUsers.length === 0) {
            // Use setTimeout to avoid state update during render
            setTimeout(() => {
              if (callStateRef.current === 'connected') {
                console.log('[Agora] All remote users left, auto-ending call');
                endCallRef.current?.();
              }
            }, 100);
          }
          
          return newUsers;
        });
      });

      // Listen for connection state changes
      clientRef.current.on('connection-state-change', (curState, prevState, reason) => {
        console.log('[Agora] Connection state:', prevState, '->', curState, 'reason:', reason);
        
        if (curState === 'DISCONNECTED' && reason === 'LEAVE') {
          // Already disconnected, ensure cleanup
          if (callStateRef.current !== 'idle') {
            console.log('[Agora] Disconnected via LEAVE, cleaning up');
            endCallRef.current?.();
          }
        }
      });
    }
    return clientRef.current;
  }, []);

  // Start a call
  const startCall = useCallback(async (type: CallType) => {
    if (!conversationId || !userId) return;
    if (callInProgressRef.current) return;
    callInProgressRef.current = true;

    try {
      // Check DB for existing ringing/active call from the other user
      const { data: existingCall } = await supabase
        .from('call_sessions')
        .select('*')
        .eq('conversation_id', conversationId)
        .in('status', ['ringing', 'active'])
        .neq('initiator_id', userId)
        .maybeSingle();

      if (existingCall) {
        // The other person already called us - answer their call instead
        const typedSession: CallSession = { ...existingCall, call_type: existingCall.call_type as CallType };
        setIncomingCall(typedSession);
        callInProgressRef.current = false;
        return;
      }

      setCallState('calling');
      setCallType(type);

      // CRITICAL: Request media FIRST - must be in direct user gesture context
      let audioTrack: IMicrophoneAudioTrack;
      let videoTrack: ICameraVideoTrack | null = null;
      
      if (type === 'video') {
        const tracks = await AgoraRTC.createMicrophoneAndCameraTracks();
        audioTrack = tracks[0];
        videoTrack = tracks[1];
      } else {
        audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
      }
      
      localAudioTrackRef.current = audioTrack;
      localVideoTrackRef.current = videoTrack;

      const channelName = generateChannelName();

      // Create call session in database
      const { data: session, error: sessionError } = await supabase
        .from('call_sessions')
        .insert({
          conversation_id: conversationId,
          initiator_id: userId,
          call_type: type,
          status: 'ringing',
          channel_name: channelName,
        })
        .select()
        .single();

      if (sessionError) throw sessionError;
      
      // Type assertion for the session
      const typedSession: CallSession = {
        ...session,
        call_type: session.call_type as CallType,
      };
      setCurrentSession(typedSession);

      // Add self as participant
      await supabase.from('call_participants').insert({
        call_session_id: session.id,
        user_id: userId,
        joined_at: new Date().toISOString(),
        is_video_off: type === 'voice',
      });

      // Get token and join channel
      const tokenData = await getToken(channelName);
      
      // Cleanup existing client before joining
      if (clientRef.current) {
        try { await clientRef.current.leave(); } catch {}
        clientRef.current = null;
      }
      const client = initClient();
      await client.join(tokenData.appId, channelName, tokenData.token, tokenData.userAccount);

      // Publish pre-created tracks
      if (videoTrack) {
        await client.publish([audioTrack, videoTrack]);
      } else {
        await client.publish(audioTrack);
      }

      setCallState('ringing');

      // Set auto-timeout for missed call
      callTimeoutRef.current = setTimeout(async () => {
        console.log('[Agora] Call timeout - marking as missed');
        try {
          await supabase
            .from('call_sessions')
            .update({ status: 'missed', ended_at: new Date().toISOString() })
            .eq('id', session.id);
          
          toast({
            title: 'Không có phản hồi',
            description: 'Người nhận không trả lời cuộc gọi',
          });
          
          // Cleanup
          localAudioTrackRef.current?.close();
          localVideoTrackRef.current?.close();
          localAudioTrackRef.current = null;
          localVideoTrackRef.current = null;
          await clientRef.current?.leave();
          clientRef.current = null;
          
          setCallState('idle');
          setCurrentSession(null);
        } catch (err) {
          console.error('[Agora] Failed to mark call as missed:', err);
        }
      }, CALL_TIMEOUT_MS);

    } catch (error: any) {
      console.error('Failed to start call:', error);
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể bắt đầu cuộc gọi',
        variant: 'destructive',
      });
      // Clean up any created tracks on error
      localAudioTrackRef.current?.close();
      localVideoTrackRef.current?.close();
      localAudioTrackRef.current = null;
      localVideoTrackRef.current = null;
      setCallState('idle');
    } finally {
      callInProgressRef.current = false;
    }
  }, [conversationId, userId, generateChannelName, getToken, initClient, toast]);

  // Answer incoming call
  const answerCall = useCallback(async () => {
    if (!incomingCall || !userId) return;

    try {
      setCallState('connecting');
      setCallType(incomingCall.call_type);
      setCurrentSession(incomingCall);

      // CRITICAL: Request media FIRST - must be in direct user gesture context
      // Browser security requires getUserMedia to be called immediately on user interaction
      let audioTrack: IMicrophoneAudioTrack;
      let videoTrack: ICameraVideoTrack | null = null;
      
      if (incomingCall.call_type === 'video') {
        const tracks = await AgoraRTC.createMicrophoneAndCameraTracks();
        audioTrack = tracks[0];
        videoTrack = tracks[1];
      } else {
        audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
      }
      
      localAudioTrackRef.current = audioTrack;
      localVideoTrackRef.current = videoTrack;

      // Now perform async operations (token fetch, join channel)
      const tokenData = await getToken(incomingCall.channel_name);
      
      // Cleanup existing client before joining
      if (clientRef.current) {
        try { await clientRef.current.leave(); } catch {}
        clientRef.current = null;
      }
      const client = initClient();
      await client.join(tokenData.appId, incomingCall.channel_name, tokenData.token, tokenData.userAccount);

      // Publish pre-created tracks
      if (videoTrack) {
        await client.publish([audioTrack, videoTrack]);
      } else {
        await client.publish(audioTrack);
      }

      // Add self as participant
      await supabase.from('call_participants').insert({
        call_session_id: incomingCall.id,
        user_id: userId,
        joined_at: new Date().toISOString(),
        is_video_off: incomingCall.call_type === 'voice',
      });

      // Update session status
      await supabase
        .from('call_sessions')
        .update({ 
          status: 'active',
          started_at: new Date().toISOString()
        })
        .eq('id', incomingCall.id);

      setCallState('connected');
      setIncomingCall(null);

      // Start duration timer
      durationIntervalRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);

    } catch (error: any) {
      console.error('Failed to answer call:', error);
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể trả lời cuộc gọi',
        variant: 'destructive',
      });
      // Clean up any created tracks on error
      localAudioTrackRef.current?.close();
      localVideoTrackRef.current?.close();
      localAudioTrackRef.current = null;
      localVideoTrackRef.current = null;
      setCallState('idle');
    }
  }, [incomingCall, userId, getToken, initClient, toast]);

  // Decline incoming call
  const declineCall = useCallback(async () => {
    if (!incomingCall) return;

    try {
      await supabase
        .from('call_sessions')
        .update({ status: 'declined', ended_at: new Date().toISOString() })
        .eq('id', incomingCall.id);

      setIncomingCall(null);
    } catch (error) {
      console.error('Failed to decline call:', error);
    }
  }, [incomingCall]);

  // End call
  const endCall = useCallback(async () => {
    try {
      // Clear call timeout if exists
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }

      // Stop tracks
      localAudioTrackRef.current?.close();
      localVideoTrackRef.current?.close();
      localAudioTrackRef.current = null;
      localVideoTrackRef.current = null;

      // Leave channel
      await clientRef.current?.leave();
      clientRef.current = null;

      // Update database
      if (currentSession) {
        const endTime = new Date().toISOString();
        await supabase
          .from('call_sessions')
          .update({ 
            status: 'ended',
            ended_at: endTime,
            duration_seconds: callDuration
          })
          .eq('id', currentSession.id);

        await supabase
          .from('call_participants')
          .update({ left_at: endTime })
          .eq('call_session_id', currentSession.id)
          .eq('user_id', userId);
      }

      // Clear timer
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }

      // Reset state
      setCallState('idle');
      setCurrentSession(null);
      setRemoteUsers([]);
      setCallDuration(0);
      setIsMuted(false);
      setIsCameraOff(false);

    } catch (error) {
      console.error('Failed to end call:', error);
    }
  }, [currentSession, callDuration, userId]);

  // Sync refs to avoid closure issues
  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  useEffect(() => {
    endCallRef.current = endCall;
  }, [endCall]);

  // Toggle mute
  const toggleMute = useCallback(async () => {
    if (localAudioTrackRef.current) {
      const newMuted = !isMuted;
      await localAudioTrackRef.current.setEnabled(!newMuted);
      setIsMuted(newMuted);

      // Update participant status
      if (currentSession && userId) {
        await supabase
          .from('call_participants')
          .update({ is_muted: newMuted })
          .eq('call_session_id', currentSession.id)
          .eq('user_id', userId);
      }
    }
  }, [isMuted, currentSession, userId]);

  // Toggle camera
  const toggleCamera = useCallback(async () => {
    if (localVideoTrackRef.current) {
      const newOff = !isCameraOff;
      await localVideoTrackRef.current.setEnabled(!newOff);
      setIsCameraOff(newOff);

      // Update participant status
      if (currentSession && userId) {
        await supabase
          .from('call_participants')
          .update({ is_video_off: newOff })
          .eq('call_session_id', currentSession.id)
          .eq('user_id', userId);
      }
    }
  }, [isCameraOff, currentSession, userId]);

  // Switch to video (during voice call)
  const switchToVideo = useCallback(async () => {
    if (callType === 'video' || !clientRef.current) return;

    try {
      const videoTrack = await AgoraRTC.createCameraVideoTrack();
      localVideoTrackRef.current = videoTrack;
      await clientRef.current.publish(videoTrack);
      setCallType('video');
      setIsCameraOff(false);
    } catch (error) {
      console.error('Failed to switch to video:', error);
    }
  }, [callType]);

  // Handle auto-answer from URL parameter (when accepting call from another page)
  useEffect(() => {
    const answerCallId = searchParams.get('answer');
    
    // Skip if no answer param, no user, already processing, or already answered this call
    if (!answerCallId || !userId || !conversationId || isAutoAnswering) return;
    if (autoAnswerProcessedRef.current === answerCallId) return;
    if (callState !== 'idle') return;

    console.log('[Agora] Auto-answer triggered for call:', answerCallId);
    autoAnswerProcessedRef.current = answerCallId;
    
    const autoAnswerCall = async () => {
      try {
        setIsAutoAnswering(true);
        
        // Fetch the call session from database
        const { data: session, error } = await supabase
          .from('call_sessions')
          .select('*')
          .eq('id', answerCallId)
          .eq('conversation_id', conversationId)
          .eq('status', 'ringing')
          .single();

        if (error || !session) {
          console.log('[Agora] Call session not found or not ringing:', error?.message);
          // Clear the URL parameter
          setSearchParams({}, { replace: true });
          setIsAutoAnswering(false);
          return;
        }

        console.log('[Agora] Found call session, auto-answering:', session.id);
        
        // Set the incoming call and trigger answer
        const typedSession: CallSession = {
          ...session,
          call_type: session.call_type as CallType,
        };
        
        // Set incoming call first
        setIncomingCall(typedSession);
        
        // Clear the URL parameter
        setSearchParams({}, { replace: true });
        
        // Small delay to ensure state is updated, then answer
        setTimeout(async () => {
          // Now manually trigger the answer logic since we have the session
          try {
            setCallState('connecting');
            setCallType(typedSession.call_type);
            setCurrentSession(typedSession);

            // Request media
            let audioTrack: IMicrophoneAudioTrack;
            let videoTrack: ICameraVideoTrack | null = null;
            
            if (typedSession.call_type === 'video') {
              const tracks = await AgoraRTC.createMicrophoneAndCameraTracks();
              audioTrack = tracks[0];
              videoTrack = tracks[1];
            } else {
              audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
            }
            
            localAudioTrackRef.current = audioTrack;
            localVideoTrackRef.current = videoTrack;

            // Get token and join
            const tokenData = await getToken(typedSession.channel_name);
            // Cleanup existing client before joining
            if (clientRef.current) {
              try { await clientRef.current.leave(); } catch {}
              clientRef.current = null;
            }
            const client = initClient();
            await client.join(tokenData.appId, typedSession.channel_name, tokenData.token, tokenData.userAccount);

            // Publish tracks
            if (videoTrack) {
              await client.publish([audioTrack, videoTrack]);
            } else {
              await client.publish(audioTrack);
            }

            // Add self as participant
            await supabase.from('call_participants').insert({
              call_session_id: typedSession.id,
              user_id: userId,
              joined_at: new Date().toISOString(),
              is_video_off: typedSession.call_type === 'voice',
            });

            // Update session status
            await supabase
              .from('call_sessions')
              .update({ 
                status: 'active',
                started_at: new Date().toISOString()
              })
              .eq('id', typedSession.id);

            setCallState('connected');
            setIncomingCall(null);
            setIsAutoAnswering(false);

            // Start duration timer
            durationIntervalRef.current = setInterval(() => {
              setCallDuration(prev => prev + 1);
            }, 1000);

            console.log('[Agora] Auto-answer successful, connected!');
          } catch (err: any) {
            console.error('[Agora] Auto-answer failed:', err);
            toast({
              title: 'Lỗi',
              description: err.message || 'Không thể trả lời cuộc gọi',
              variant: 'destructive',
            });
            // Cleanup
            localAudioTrackRef.current?.close();
            localVideoTrackRef.current?.close();
            localAudioTrackRef.current = null;
            localVideoTrackRef.current = null;
            setCallState('idle');
            setIsAutoAnswering(false);
          }
        }, 100);
        
      } catch (err) {
        console.error('[Agora] Auto-answer error:', err);
        setSearchParams({}, { replace: true });
        setIsAutoAnswering(false);
      }
    };

    autoAnswerCall();
  }, [searchParams, userId, conversationId, callState, isAutoAnswering, getToken, initClient, toast, setSearchParams]);

  // Subscribe to incoming calls via realtime
  useEffect(() => {
    if (!userId || !conversationId) return;

    const channel = supabase
      .channel(`calls-${conversationId}-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'call_sessions',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const session = payload.new as any;
          // Don't show incoming call if we initiated it
          if (session.initiator_id !== userId && session.status === 'ringing') {
            const typedSession: CallSession = {
              ...session,
              call_type: session.call_type as CallType,
            };
            setIncomingCall(typedSession);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'call_sessions',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const session = payload.new as any;
          console.log('[Agora] Realtime session update:', session.id, session.status);
          
          // If call became active and we're the caller, update state
          if (currentSession?.id === session.id) {
            if (session.status === 'active' && callState === 'ringing') {
              // Clear the timeout since call was answered
              if (callTimeoutRef.current) {
                clearTimeout(callTimeoutRef.current);
                callTimeoutRef.current = null;
              }
              
              setCallState('connected');
              durationIntervalRef.current = setInterval(() => {
                setCallDuration(prev => prev + 1);
              }, 1000);
            }
            // If call was declined/missed/ended
            if (['declined', 'missed', 'ended'].includes(session.status) && callState !== 'idle') {
              console.log('[Agora] Session ended via realtime, cleaning up');
              // Clear the timeout
              if (callTimeoutRef.current) {
                clearTimeout(callTimeoutRef.current);
                callTimeoutRef.current = null;
              }
              endCall();
            }
          }

          // If incoming call was cancelled
          if (incomingCall?.id === session.id && ['ended', 'declined', 'missed'].includes(session.status)) {
            setIncomingCall(null);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, conversationId, currentSession, callState, incomingCall, endCall]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      localAudioTrackRef.current?.close();
      localVideoTrackRef.current?.close();
      clientRef.current?.leave();
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
      }
    };
  }, []);

  // Flip camera (switch between front/back)
  const flipCamera = useCallback(async () => {
    if (!localVideoTrackRef.current) return false;

    try {
      const cameras = await AgoraRTC.getCameras();
      if (cameras.length < 2) return false;

      const currentLabel = localVideoTrackRef.current.getTrackLabel();
      const currentIndex = cameras.findIndex(c => c.label === currentLabel);
      const nextIndex = (currentIndex + 1) % cameras.length;
      const nextDevice = cameras[nextIndex];

      await localVideoTrackRef.current.setDevice(nextDevice.deviceId);
      return true;
    } catch (error) {
      console.error('[Agora] Failed to flip camera:', error);
      return false;
    }
  }, []);

  return {
    // State
    callState,
    callType,
    currentSession,
    remoteUsers,
    isMuted,
    isCameraOff,
    incomingCall,
    callDuration,
    localVideoTrack: localVideoTrackRef.current,
    localAudioTrack: localAudioTrackRef.current,
    
    // Actions
    startCall,
    answerCall,
    declineCall,
    endCall,
    toggleMute,
    toggleCamera,
    switchToVideo,
    flipCamera,
  };
}
~~~

### FILE: src/modules/chat/hooks/useAngelInline.ts
~~~ts
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useAngelInline() {
  const invokeAngel = useMutation({
    mutationFn: async (input: { conversationId: string; prompt: string }) => {
      const { data, error } = await supabase.functions.invoke('angel-inline', {
        body: {
          conversation_id: input.conversationId,
          prompt: input.prompt,
        },
      });
      if (error) throw error;
      return data;
    },
  });

  return { invokeAngel };
}

~~~

### FILE: src/modules/chat/hooks/useBlocks.ts
~~~ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { UserBlock } from '../types';

export function useBlocks(currentUserId: string | null) {
  const queryClient = useQueryClient();

  const myBlocksQuery = useQuery({
    queryKey: ['chat-blocks', currentUserId],
    queryFn: async () => {
      if (!currentUserId) return [] as UserBlock[];
      const { data, error } = await supabase
        .from('user_blocks')
        .select('id, blocker_id, blocked_id, created_at')
        .eq('blocker_id', currentUserId);
      if (error) throw error;
      return (data || []) as UserBlock[];
    },
    enabled: !!currentUserId,
    staleTime: 30 * 1000,
  });

  const blockedByOthersQuery = useQuery({
    queryKey: ['chat-blocked-by-others', currentUserId],
    queryFn: async () => {
      if (!currentUserId) return [] as UserBlock[];
      const { data, error } = await supabase
        .from('user_blocks')
        .select('id, blocker_id, blocked_id, created_at')
        .eq('blocked_id', currentUserId);
      if (error) throw error;
      return (data || []) as UserBlock[];
    },
    enabled: !!currentUserId,
    staleTime: 30 * 1000,
  });

  const blockedIds = new Set((myBlocksQuery.data || []).map((b) => b.blocked_id));
  const blockedByIds = new Set((blockedByOthersQuery.data || []).map((b) => b.blocker_id));

  const blockUser = useMutation({
    mutationFn: async (blockedId: string) => {
      if (!currentUserId) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('user_blocks')
        .insert({ blocker_id: currentUserId, blocked_id: blockedId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-blocks', currentUserId] });
      queryClient.invalidateQueries({ queryKey: ['chat-blocked-by-others', currentUserId] });
    },
  });

  const unblockUser = useMutation({
    mutationFn: async (blockedId: string) => {
      if (!currentUserId) throw new Error('Not authenticated');
      const { error } = await supabase
        .from('user_blocks')
        .delete()
        .eq('blocker_id', currentUserId)
        .eq('blocked_id', blockedId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-blocks', currentUserId] });
      queryClient.invalidateQueries({ queryKey: ['chat-blocked-by-others', currentUserId] });
    },
  });

  return {
    blocks: myBlocksQuery.data || [],
    blockedIds,
    blockedByIds,
    isLoading: myBlocksQuery.isLoading || blockedByOthersQuery.isLoading,
    error: myBlocksQuery.error || blockedByOthersQuery.error,
    blockUser,
    unblockUser,
  };
}
~~~

### FILE: src/modules/chat/hooks/useChatNotifications.ts
~~~ts
import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface NotificationOptions {
  enabled?: boolean;
  showToast?: boolean;
  playSound?: boolean;
}

export function useChatNotifications(
  userId: string | null,
  currentConversationId: string | null,
  options: NotificationOptions = {}
) {
  const { enabled = true, showToast = true, playSound = true } = options;

  const playNotificationSound = useCallback(() => {
    if (!playSound) return;

    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch {
      // Silently fail if audio context is not available
      console.debug('Audio notification not available');
    }
  }, [playSound]);

  useEffect(() => {
    if (!userId || !enabled) return;

    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    (async () => {
      // Scope notifications to conversations the user is currently in.
      // This avoids subscribing to all messages globally.
      const { data: rows, error } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', userId)
        .is('left_at', null);

      if (cancelled) return;
      if (error) {
        console.error('[chat-notifications] Failed to load conversation ids:', error);
        return;
      }

      const conversationIds = (rows || []).map((r: any) => r.conversation_id).filter(Boolean);
      if (!conversationIds.length) return;

      const inFilter = `conversation_id=in.(${conversationIds.join(',')})`;

      channel = supabase
        .channel(`chat-notifications:${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: inFilter,
          },
          async (payload) => {
            const message = payload.new as any;

            if (message.sender_id === userId) return;
            if (message.conversation_id === currentConversationId) return;

            const { data: sender } = await supabase
              .from('profiles')
              .select('username, full_name, avatar_url')
              .eq('id', message.sender_id)
              .maybeSingle();

            playNotificationSound();

            const senderName = sender?.full_name || sender?.username || 'Ai đó';
            const content = (message.content || '').toString();
            const description = content ? content.substring(0, 50) : 'Đã gửi một tệp đính kèm';

            if (showToast) {
              toast.info(`${senderName} đã gửi tin nhắn`, {
                description,
                duration: 4000,
              });
            }

            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification(`Tin nhắn từ ${senderName}`, {
                body: content ? content.substring(0, 100) : 'Bạn nhận được một tệp đính kèm',
                icon: sender?.avatar_url || '/fun-profile-logo-128.webp',
                tag: message.conversation_id,
              });
            }
          }
        )
        .subscribe();
    })();

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [userId, currentConversationId, enabled, showToast, playNotificationSound]);

  return null;
}
~~~

### FILE: src/modules/chat/hooks/useChatSettings.ts
~~~ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ChatSettings } from '../types';

export type { ChatSettings };

const DEFAULT_SETTINGS: Omit<ChatSettings, 'id' | 'user_id' | 'created_at' | 'updated_at'> = {
  who_can_message: 'friends',
  show_read_receipts: true,
  show_typing_indicator: true,
};

export function useChatSettings(userId: string | null) {
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: ['chat-settings', userId],
    queryFn: async () => {
      if (!userId) return null;

      const { data, error } = await supabase
        .from('chat_settings')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;

      // Return settings with defaults
      if (!data) {
        return {
          user_id: userId,
          ...DEFAULT_SETTINGS,
        } as ChatSettings;
      }

      return data;
    },
    enabled: !!userId,
  });

  const updateSettings = useMutation({
    mutationFn: async (updates: Partial<ChatSettings>) => {
      if (!userId) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('chat_settings')
        .upsert(
          {
            user_id: userId,
            ...updates,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        )
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-settings', userId] });
    },
  });

  return {
    settings: settingsQuery.data,
    isLoading: settingsQuery.isLoading,
    error: settingsQuery.error,
    updateSettings,
  };
}

// Check if a user can message another user
export async function canSendMessage(senderId: string, receiverId: string): Promise<boolean> {
  // Get receiver's chat settings
  const { data: settings } = await supabase
    .from('chat_settings')
    .select('who_can_message')
    .eq('user_id', receiverId)
    .maybeSingle();

  const whoCanMessage = settings?.who_can_message || 'friends';

  switch (whoCanMessage) {
    case 'everyone':
      return true;
    case 'nobody':
      return false;
    case 'friends':
    default:
      // Check if they are friends
      const { data: friendship } = await supabase
        .from('friendships')
        .select('id')
        .or(`and(user_id.eq.${senderId},friend_id.eq.${receiverId}),and(user_id.eq.${receiverId},friend_id.eq.${senderId})`)
        .eq('status', 'accepted')
        .limit(1);

      return (friendship?.length || 0) > 0;
  }
}
~~~

### FILE: src/modules/chat/hooks/useConversations.ts
~~~ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';
import type { Conversation, ConversationParticipant } from '../types';

export type { Conversation, ConversationParticipant };

export function useConversations(userId: string | null) {
  const queryClient = useQueryClient();

  const conversationsQuery = useQuery({
    queryKey: ['conversations', userId],
    queryFn: async () => {
      if (!userId) return [];

      // Get conversations where user is a participant
      const { data: participantData, error: participantError } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', userId)
        .is('left_at', null);

      if (participantError) throw participantError;
      if (!participantData?.length) return [];

      const conversationIds = participantData.map(p => p.conversation_id);

      // Get full conversation data with participants
      const { data: conversations, error } = await supabase
        .from('conversations')
        .select(`
          *,
          conversation_participants (
            id,
            user_id,
            role,
            nickname,
            joined_at,
            left_at
          )
        `)
        .in('id', conversationIds)
        .order('last_message_at', { ascending: false, nullsFirst: false });

      if (error) throw error;

      // Fetch profiles for participants
      const allUserIds = new Set<string>();
      conversations?.forEach(conv => {
        conv.conversation_participants?.forEach((p: ConversationParticipant) => {
          if (p.user_id && !p.left_at) allUserIds.add(p.user_id);
        });
      });

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, full_name, external_wallet_address, custodial_wallet_address, wallet_address')
        .in('id', Array.from(allUserIds));

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      // Map profiles to participants
      return conversations?.map(conv => ({
        ...conv,
        participants: conv.conversation_participants?.map((p: ConversationParticipant) => ({
          ...p,
          profile: profileMap.get(p.user_id)
        }))
      })) || [];
    },
    enabled: !!userId,
    staleTime: 30 * 1000,
  });

  const conversationIdsForRealtime = (conversationsQuery.data || []).map((c: any) => c.id).filter(Boolean);
  const conversationIdsKey = conversationIdsForRealtime.join(',');

  // Realtime subscription for conversation updates
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`conversations-changes:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversation_participants', filter: `user_id=eq.${userId}` },
        () => queryClient.invalidateQueries({ queryKey: ['conversations', userId] })
      );

    // Subscribe to conversations table only when we already have conversation ids.
    // Keep participants subscription always-on so first conversation appears in realtime.
    if (conversationIdsForRealtime.length) {
      const convFilter = `id=in.(${conversationIdsForRealtime.join(',')})`;
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations', filter: convFilter },
        () => queryClient.invalidateQueries({ queryKey: ['conversations', userId] })
      );
    }

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient, conversationIdsKey]);

  // Create direct conversation
  const createDirectConversation = useMutation({
    mutationFn: async (otherUserId: string) => {
      if (!userId) throw new Error('User not authenticated');

      // Block enforcement (Phase 1): prevent creating DM if you blocked the other user.
      const { data: myBlock } = await supabase
        .from('user_blocks')
        .select('id')
        .eq('blocker_id', userId)
        .eq('blocked_id', otherUserId)
        .maybeSingle();
      if (myBlock?.id) {
        throw new Error('Bạn đã tạm ngừng kết nối với người dùng này.');
      }

      // Also prevent creating DM if the other user has blocked you.
      const { data: blockedByOther } = await supabase
        .from('user_blocks')
        .select('id')
        .eq('blocker_id', otherUserId)
        .eq('blocked_id', userId)
        .maybeSingle();
      if (blockedByOther?.id) {
        throw new Error('Người dùng này đã tạm ngừng kết nối với bạn.');
      }

      // Check if conversation already exists
      const { data: existingParticipants } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', userId)
        .is('left_at', null);

      if (existingParticipants?.length) {
        const { data: otherParticipants } = await supabase
          .from('conversation_participants')
          .select('conversation_id')
          .eq('user_id', otherUserId)
          .in('conversation_id', existingParticipants.map(p => p.conversation_id))
          .is('left_at', null);

        if (otherParticipants?.length) {
          // Check if it's a direct (2-person) conversation
          for (const op of otherParticipants) {
            const { data: allParticipants } = await supabase
              .from('conversation_participants')
              .select('user_id')
              .eq('conversation_id', op.conversation_id)
              .is('left_at', null);

            if (allParticipants?.length === 2) {
              // Found existing direct conversation
              const { data: conv } = await supabase
                .from('conversations')
                .select('*')
                .eq('id', op.conversation_id)
                .eq('type', 'direct')
                .single();

              if (conv) return conv;
            }
          }
        }
      }

      // Create new conversation
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .insert({
          type: 'direct',
          created_by: userId,
        })
        .select()
        .single();

      if (convError) throw convError;

      // Add both participants
      const { error: partError } = await supabase
        .from('conversation_participants')
        .insert([
          { conversation_id: conversation.id, user_id: userId, role: 'member' },
          { conversation_id: conversation.id, user_id: otherUserId, role: 'member' },
        ]);

      if (partError) throw partError;

      return conversation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations', userId] });
    },
  });

  return {
    conversations: conversationsQuery.data || [],
    isLoading: conversationsQuery.isLoading,
    error: conversationsQuery.error,
    createDirectConversation,
  };
}

export function useConversation(conversationId: string | null) {
  return useQuery({
    queryKey: ['conversation', conversationId],
    queryFn: async () => {
      if (!conversationId) return null;

      const { data, error } = await supabase
        .from('conversations')
        .select(`
          *,
          conversation_participants (
            id,
            user_id,
            role,
            nickname,
            joined_at,
            left_at
          )
        `)
        .eq('id', conversationId)
        .single();

      if (error) throw error;

      // Fetch profiles for participants
      const userIds = data.conversation_participants
        ?.filter((p: ConversationParticipant) => !p.left_at)
        .map((p: ConversationParticipant) => p.user_id) || [];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, full_name, external_wallet_address, custodial_wallet_address, wallet_address')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      return {
        ...data,
        participants: data.conversation_participants?.map((p: ConversationParticipant) => ({
          ...p,
          profile: profileMap.get(p.user_id)
        }))
      };
    },
    enabled: !!conversationId,
  });
}
~~~

### FILE: src/modules/chat/hooks/useGroupConversations.ts
~~~ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useGroupConversations(userId: string | null) {
  const queryClient = useQueryClient();

  // Create group conversation
  const createGroupConversation = useMutation({
    mutationFn: async ({
      name,
      memberIds,
    }: {
      name: string;
      memberIds: string[];
    }) => {
      if (!userId) throw new Error('User not authenticated');
      if (memberIds.length < 1) throw new Error('At least 1 member required');

      // Create conversation
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .insert({
          type: 'group',
          name,
          created_by: userId,
        })
        .select()
        .single();

      if (convError) throw convError;

      // Add all participants (including creator as admin)
      const participants = [
        { conversation_id: conversation.id, user_id: userId, role: 'admin' },
        ...memberIds.map((id) => ({
          conversation_id: conversation.id,
          user_id: id,
          role: 'member',
        })),
      ];

      const { error: partError } = await supabase
        .from('conversation_participants')
        .insert(participants);

      if (partError) throw partError;

      return conversation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations', userId] });
      toast.success('Đã tạo nhóm mới');
    },
    onError: (error) => {
      console.error('Error creating group:', error);
      toast.error('Không thể tạo nhóm');
    },
  });

  // Add member to group
  const addMember = useMutation({
    mutationFn: async ({
      conversationId,
      memberId,
    }: {
      conversationId: string;
      memberId: string;
    }) => {
      const { error } = await supabase.from('conversation_participants').insert({
        conversation_id: conversationId,
        user_id: memberId,
        role: 'member',
      });

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['conversation', variables.conversationId],
      });
      toast.success('Đã thêm thành viên');
    },
  });

  // Remove member from group
  const removeMember = useMutation({
    mutationFn: async ({
      conversationId,
      memberId,
    }: {
      conversationId: string;
      memberId: string;
    }) => {
      const { error } = await supabase
        .from('conversation_participants')
        .update({ left_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('user_id', memberId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['conversation', variables.conversationId],
      });
      toast.success('Đã xóa thành viên');
    },
  });

  // Update group settings
  const updateGroup = useMutation({
    mutationFn: async ({
      conversationId,
      updates,
    }: {
      conversationId: string;
      updates: { name?: string; avatar_url?: string };
    }) => {
      const { error } = await supabase
        .from('conversations')
        .update(updates)
        .eq('id', conversationId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['conversation', variables.conversationId],
      });
      queryClient.invalidateQueries({ queryKey: ['conversations', userId] });
      toast.success('Đã cập nhật nhóm');
    },
  });

  // Leave group
  const leaveGroup = useMutation({
    mutationFn: async (conversationId: string) => {
      if (!userId) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('conversation_participants')
        .update({ left_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('user_id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations', userId] });
      toast.success('Đã rời nhóm');
    },
  });

  return {
    createGroupConversation,
    addMember,
    removeMember,
    updateGroup,
    leaveGroup,
  };
}
~~~

### FILE: src/modules/chat/hooks/useMediaDevices.ts
~~~ts
/**
 * Hook to manage media devices (cameras, microphones, speakers)
 * Provides device enumeration, selection, and switching capabilities
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import AgoraRTC, { ICameraVideoTrack, IMicrophoneAudioTrack } from 'agora-rtc-sdk-ng';

export interface MediaDevice {
  deviceId: string;
  label: string;
  kind: 'audioinput' | 'audiooutput' | 'videoinput';
}

export interface MediaDevicesState {
  cameras: MediaDevice[];
  microphones: MediaDevice[];
  speakers: MediaDevice[];
  selectedCamera: string | null;
  selectedMicrophone: string | null;
  selectedSpeaker: string | null;
}

interface UseMediaDevicesOptions {
  videoTrack?: ICameraVideoTrack | null;
  audioTrack?: IMicrophoneAudioTrack | null;
}

export function useMediaDevices({ videoTrack, audioTrack }: UseMediaDevicesOptions = {}) {
  const [devices, setDevices] = useState<MediaDevicesState>({
    cameras: [],
    microphones: [],
    speakers: [],
    selectedCamera: null,
    selectedMicrophone: null,
    selectedSpeaker: null,
  });
  const [isEnumerating, setIsEnumerating] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const audioLevelIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Enumerate available devices
  const enumerateDevices = useCallback(async () => {
    setIsEnumerating(true);
    try {
      // Request permissions first to get proper device labels
      await navigator.mediaDevices.getUserMedia({ audio: true, video: true }).catch(() => {});
      
      const [cameras, microphones] = await Promise.all([
        AgoraRTC.getCameras(),
        AgoraRTC.getMicrophones(),
      ]);
      
      // Get speakers if available (not all browsers support)
      let speakers: MediaDevice[] = [];
      try {
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        speakers = allDevices
          .filter(d => d.kind === 'audiooutput')
          .map(d => ({
            deviceId: d.deviceId,
            label: d.label || `Speaker ${d.deviceId.slice(0, 4)}`,
            kind: 'audiooutput' as const,
          }));
      } catch (e) {
        console.log('[MediaDevices] Speakers enumeration not supported');
      }

      setDevices(prev => ({
        ...prev,
        cameras: cameras.map(c => ({
          deviceId: c.deviceId,
          label: c.label || `Camera ${c.deviceId.slice(0, 4)}`,
          kind: 'videoinput' as const,
        })),
        microphones: microphones.map(m => ({
          deviceId: m.deviceId,
          label: m.label || `Microphone ${m.deviceId.slice(0, 4)}`,
          kind: 'audioinput' as const,
        })),
        speakers,
        // Set defaults if not already set
        selectedCamera: prev.selectedCamera || (cameras.length > 0 ? cameras[0].deviceId : null),
        selectedMicrophone: prev.selectedMicrophone || (microphones.length > 0 ? microphones[0].deviceId : null),
        selectedSpeaker: prev.selectedSpeaker || (speakers.length > 0 ? speakers[0].deviceId : null),
      }));
    } catch (error) {
      console.error('[MediaDevices] Failed to enumerate devices:', error);
    } finally {
      setIsEnumerating(false);
    }
  }, []);

  // Switch camera (for flip camera feature)
  const flipCamera = useCallback(async () => {
    if (!videoTrack || devices.cameras.length < 2) return false;

    try {
      const currentDeviceId = videoTrack.getTrackLabel();
      const currentIndex = devices.cameras.findIndex(c => c.label === currentDeviceId || c.deviceId === devices.selectedCamera);
      const nextIndex = (currentIndex + 1) % devices.cameras.length;
      const nextDevice = devices.cameras[nextIndex];

      await videoTrack.setDevice(nextDevice.deviceId);
      setDevices(prev => ({ ...prev, selectedCamera: nextDevice.deviceId }));
      return true;
    } catch (error) {
      console.error('[MediaDevices] Failed to flip camera:', error);
      return false;
    }
  }, [videoTrack, devices.cameras, devices.selectedCamera]);

  // Select specific camera
  const selectCamera = useCallback(async (deviceId: string) => {
    if (!videoTrack) return false;

    try {
      await videoTrack.setDevice(deviceId);
      setDevices(prev => ({ ...prev, selectedCamera: deviceId }));
      return true;
    } catch (error) {
      console.error('[MediaDevices] Failed to select camera:', error);
      return false;
    }
  }, [videoTrack]);

  // Select specific microphone
  const selectMicrophone = useCallback(async (deviceId: string) => {
    if (!audioTrack) return false;

    try {
      await audioTrack.setDevice(deviceId);
      setDevices(prev => ({ ...prev, selectedMicrophone: deviceId }));
      return true;
    } catch (error) {
      console.error('[MediaDevices] Failed to select microphone:', error);
      return false;
    }
  }, [audioTrack]);

  // Select speaker (playback device)
  const selectSpeaker = useCallback(async (deviceId: string) => {
    try {
      // Note: Speaker selection typically needs to be applied to audio elements
      // This is more of a stored preference
      setDevices(prev => ({ ...prev, selectedSpeaker: deviceId }));
      return true;
    } catch (error) {
      console.error('[MediaDevices] Failed to select speaker:', error);
      return false;
    }
  }, []);

  // Monitor audio level for mic test
  const startAudioLevelMonitor = useCallback(() => {
    if (!audioTrack) return;

    audioLevelIntervalRef.current = setInterval(() => {
      const level = audioTrack.getVolumeLevel();
      setAudioLevel(level * 100); // Convert to percentage
    }, 100);
  }, [audioTrack]);

  const stopAudioLevelMonitor = useCallback(() => {
    if (audioLevelIntervalRef.current) {
      clearInterval(audioLevelIntervalRef.current);
      audioLevelIntervalRef.current = null;
    }
    setAudioLevel(0);
  }, []);

  // Check if device has multiple cameras (for showing flip button)
  const hasMultipleCameras = devices.cameras.length > 1;

  // Get front/back camera info
  const getFrontCamera = useCallback(() => {
    return devices.cameras.find(c => 
      c.label.toLowerCase().includes('front') || 
      c.label.toLowerCase().includes('facetime') ||
      c.label.toLowerCase().includes('user')
    );
  }, [devices.cameras]);

  const getBackCamera = useCallback(() => {
    return devices.cameras.find(c => 
      c.label.toLowerCase().includes('back') || 
      c.label.toLowerCase().includes('environment')
    );
  }, [devices.cameras]);

  // Enumerate devices on mount
  useEffect(() => {
    enumerateDevices();

    // Listen for device changes
    const handleDeviceChange = () => {
      enumerateDevices();
    };

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
      stopAudioLevelMonitor();
    };
  }, [enumerateDevices, stopAudioLevelMonitor]);

  return {
    // State
    devices,
    isEnumerating,
    audioLevel,
    hasMultipleCameras,

    // Actions
    enumerateDevices,
    flipCamera,
    selectCamera,
    selectMicrophone,
    selectSpeaker,
    startAudioLevelMonitor,
    stopAudioLevelMonitor,

    // Helpers
    getFrontCamera,
    getBackCamera,
  };
}
~~~

### FILE: src/modules/chat/hooks/useMessages.ts
~~~ts
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useCallback } from 'react';
import type { Message, MessageReaction } from '../types';

export type { Message, MessageReaction };

const PAGE_SIZE = 30;

export function useMessages(conversationId: string | null, userId: string | null) {
  const queryClient = useQueryClient();
  const messagesQueryKey = ['messages', conversationId] as const;

  const patchMessageInCache = useCallback(
    (messageId: string, updater: (message: any) => any) => {
      queryClient.setQueryData(messagesQueryKey, (old: any) => {
        if (!old?.pages?.length) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            messages: page.messages.map((m: any) => (m.id === messageId ? updater(m) : m)),
          })),
        };
      });
    },
    [queryClient, conversationId]
  );

  const removeMessageFromCache = useCallback(
    (messageId: string) => {
      queryClient.setQueryData(messagesQueryKey, (old: any) => {
        if (!old?.pages?.length) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            messages: page.messages.filter((m: any) => m.id !== messageId),
          })),
        };
      });
    },
    [queryClient, conversationId]
  );

  const messagesQuery = useInfiniteQuery({
    queryKey: ['messages', conversationId],
    queryFn: async ({ pageParam = 0 }) => {
      if (!conversationId) return { messages: [], nextCursor: null };

      const from = pageParam * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data: messages, error } = await supabase
        .from('messages')
        .select(`
          *,
          message_reactions (
            id,
            user_id,
            emoji,
            created_at
          )
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      // Fetch sender profiles
      const senderIds = new Set(messages?.map(m => m.sender_id) || []);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, full_name')
        .in('id', Array.from(senderIds));

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      // Fetch reply messages if any
      const replyIds = messages?.filter(m => m.reply_to_id).map(m => m.reply_to_id) || [];
      let replyMap = new Map();
      if (replyIds.length > 0) {
        const { data: replies } = await supabase
          .from('messages')
          .select('id, content, sender_id')
          .in('id', replyIds);

        replies?.forEach(r => {
          replyMap.set(r.id, { ...r, sender: profileMap.get(r.sender_id) });
        });
      }

      // Fetch read receipts
      const messageIds = messages?.map(m => m.id) || [];
      const { data: reads } = await supabase
        .from('message_reads')
        .select('message_id, user_id')
        .in('message_id', messageIds);

      const readMap = new Map<string, string[]>();
      reads?.forEach(r => {
        const existing = readMap.get(r.message_id) || [];
        existing.push(r.user_id);
        readMap.set(r.message_id, existing);
      });

      const enrichedMessages = messages?.map(m => ({
        ...m,
        sender: profileMap.get(m.sender_id),
        reply_to: replyMap.get(m.reply_to_id) || null,
        reactions: m.message_reactions || [],
        read_by: readMap.get(m.id) || [],
      })) || [];

      return {
        // Keep page in DESC order; we'll reverse after flattening all pages.
        messages: enrichedMessages,
        nextCursor: messages?.length === PAGE_SIZE ? pageParam + 1 : null,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: 0,
    enabled: !!conversationId,
    staleTime: 10 * 1000,
  });

  // Realtime subscription for message INSERT/UPDATE/DELETE in current conversation.
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          // Fetch sender profile
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, username, avatar_url, full_name')
            .eq('id', payload.new.sender_id)
            .single();

          const newMessage: any = {
            ...payload.new,
            sender: profile,
            reactions: [],
            read_by: [],
          };

          // Add to cache with dedupe (can happen around optimistic updates + refetch).
          queryClient.setQueryData(messagesQueryKey, (old: any) => {
            if (!old?.pages?.length) return old;
            const firstPage = old.pages[0];
            const alreadyExists = old.pages.some((page: any) =>
              (page.messages || []).some((m: any) => m.id === newMessage.id)
            );
            if (alreadyExists) return old;
            return {
              ...old,
              pages: [
                {
                  ...firstPage,
                  // Pages are stored in DESC order, so newest goes first.
                  messages: [newMessage, ...firstPage.messages],
                },
                ...old.pages.slice(1),
              ],
            };
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const updated = payload.new as any;
          patchMessageInCache(updated.id, (m) => ({ ...m, ...updated }));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const deleted = payload.old as any;
          if (!deleted?.id) return;
          removeMessageFromCache(deleted.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, patchMessageInCache, queryClient, removeMessageFromCache]);

  // Realtime subscriptions for reactions/reads scoped to messages currently loaded in this thread.
  // This avoids subscribing to all reactions/reads globally.
  const subscribedMessageIds =
    messagesQuery.data?.pages
      .flatMap((p: any) => p.messages || [])
      .map((m: any) => m?.id)
      .filter((id: any) => typeof id === 'string' && !id.startsWith('temp-')) || [];

  const messageIdsForFilter = subscribedMessageIds.slice(0, 200);
  const messageIdsKey = messageIdsForFilter.join(',');

  useEffect(() => {
    if (!conversationId) return;
    if (!messageIdsForFilter.length) return;

    const inFilter = `message_id=in.(${messageIdsForFilter.join(',')})`;

    const channel = supabase
      .channel(`message-meta:${conversationId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'message_reactions', filter: inFilter },
        (payload) => {
          const reaction = (payload.new || payload.old) as any;
          const messageId = reaction?.message_id as string | undefined;
          if (!messageId) return;

          if (payload.eventType === 'INSERT') {
            patchMessageInCache(messageId, (m) => {
              const reactions = Array.isArray(m.reactions) ? m.reactions : [];
              const exists = reactions.some((r: any) => r.id === reaction.id);
              if (exists) return m;
              return { ...m, reactions: [...reactions, reaction] };
            });
            return;
          }

          if (payload.eventType === 'UPDATE') {
            patchMessageInCache(messageId, (m) => {
              const reactions = Array.isArray(m.reactions) ? m.reactions : [];
              return {
                ...m,
                reactions: reactions.map((r: any) => (r.id === reaction.id ? { ...r, ...reaction } : r)),
              };
            });
            return;
          }

          if (payload.eventType === 'DELETE') {
            patchMessageInCache(messageId, (m) => {
              const reactions = Array.isArray(m.reactions) ? m.reactions : [];
              return {
                ...m,
                reactions: reactions.filter((r: any) => r.id !== reaction.id),
              };
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'message_reads', filter: inFilter },
        (payload) => {
          const read = payload.new as any;
          const messageId = read?.message_id as string | undefined;
          const readUserId = read?.user_id as string | undefined;
          if (!messageId || !readUserId) return;

          patchMessageInCache(messageId, (m) => {
            const readBy = Array.isArray(m.read_by) ? m.read_by : [];
            if (readBy.includes(readUserId)) return m;
            return { ...m, read_by: [...readBy, readUserId] };
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, messageIdsKey, patchMessageInCache]);

  // Send message mutation with optimistic update
  const sendMessage = useMutation({
    mutationFn: async ({
      content,
      mediaUrls,
      replyToId,
      messageType,
      metadata,
    }: {
      content?: string;
      mediaUrls?: string[];
      replyToId?: string;
      messageType?: string;
      metadata?: any;
    }) => {
      if (!conversationId || !userId) throw new Error('Invalid state');
      if (!content?.trim() && !mediaUrls?.length) throw new Error('Message is empty');

      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: userId,
          content: content?.trim() || null,
          media_urls: mediaUrls || [],
          reply_to_id: replyToId || null,
          message_type: messageType || 'text',
          metadata: metadata || {},
        })
        .select()
        .single();

      if (error) throw error;

      return data;
    },
    // Optimistic update - show message immediately
    onMutate: async (variables) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: messagesQueryKey });

      // Snapshot the previous value
      const previousMessages = queryClient.getQueryData(messagesQueryKey);

      // Optimistically update to the new value
      const optimisticMessage = {
        id: `temp-${Date.now()}`,
        conversation_id: conversationId,
        sender_id: userId,
        content: variables.content?.trim() || null,
        media_urls: variables.mediaUrls || [],
        reply_to_id: variables.replyToId || null,
        message_type: (variables as any).messageType || 'text',
        metadata: (variables as any).metadata || {},
        edited_at: null,
        pinned_at: null,
        pinned_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_deleted: false,
        deleted_at: null,
        sender: { id: userId, username: 'Bạn', avatar_url: null, full_name: null },
        reactions: [],
        read_by: [],
        reply_to: null,
      };

      queryClient.setQueryData(messagesQueryKey, (old: any) => {
        if (!old?.pages?.length) {
          return {
            pages: [{ messages: [optimisticMessage], nextCursor: null }],
            pageParams: [0],
          };
        }
        const firstPage = old.pages[0];
        return {
          ...old,
          pages: [
            {
              ...firstPage,
              // Pages are stored in DESC order, so newest goes first.
              messages: [optimisticMessage, ...firstPage.messages],
            },
            ...old.pages.slice(1),
          ],
        };
      });

      return { previousMessages };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousMessages) {
        queryClient.setQueryData(messagesQueryKey, context.previousMessages);
      }
      console.error('Failed to send message:', err);
    },
    onSettled: () => {
      // Refetch after error or success to ensure data consistency
      queryClient.invalidateQueries({ queryKey: messagesQueryKey });
    },
  });

  // Mark message as read
  const markAsRead = useCallback(
    async (messageIds: string | string[]) => {
      if (!userId) return;
      const ids = Array.isArray(messageIds) ? messageIds : [messageIds];
      const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
      if (!uniqueIds.length) return;

      await supabase.from('message_reads').upsert(
        uniqueIds.map((messageId) => ({ message_id: messageId, user_id: userId })),
        { onConflict: 'message_id,user_id' }
      );
    },
    [userId]
  );

  // Add reaction
  const addReaction = useMutation({
    mutationFn: async ({ messageId, emoji }: { messageId: string; emoji: string }) => {
      if (!userId) throw new Error('User not authenticated');

      const { error } = await supabase.from('message_reactions').upsert(
        { message_id: messageId, user_id: userId, emoji },
        { onConflict: 'message_id,user_id,emoji' }
      );

      if (error) throw error;
    },
  });

  // Remove reaction
  const removeReaction = useMutation({
    mutationFn: async ({ messageId, emoji }: { messageId: string; emoji: string }) => {
      if (!userId) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('message_reactions')
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', userId)
        .eq('emoji', emoji);

      if (error) throw error;
    },
  });

  const editMessage = useMutation({
    mutationFn: async ({ messageId, content }: { messageId: string; content: string }) => {
      if (!userId) throw new Error('User not authenticated');
      const next = content.trim();
      if (!next) throw new Error('Message is empty');
      const { error } = await supabase
        .from('messages')
        .update({ content: next, edited_at: new Date().toISOString() })
        .eq('id', messageId);
      if (error) throw error;
      return { messageId, content: next };
    },
    onMutate: async ({ messageId, content }) => {
      await queryClient.cancelQueries({ queryKey: messagesQueryKey });
      const previousMessages = queryClient.getQueryData(messagesQueryKey);
      patchMessageInCache(messageId, (m) => ({
        ...m,
        content: content.trim(),
        edited_at: new Date().toISOString(),
      }));
      return { previousMessages };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(messagesQueryKey, context.previousMessages);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: messagesQueryKey });
    },
  });

  const softDeleteMessage = useMutation({
    mutationFn: async ({ messageId }: { messageId: string }) => {
      if (!userId) throw new Error('User not authenticated');
      const { error } = await supabase
        .from('messages')
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
          content: null,
          media_urls: [],
        })
        .eq('id', messageId);
      if (error) throw error;
      return { messageId };
    },
    onMutate: async ({ messageId }) => {
      await queryClient.cancelQueries({ queryKey: messagesQueryKey });
      const previousMessages = queryClient.getQueryData(messagesQueryKey);
      patchMessageInCache(messageId, (m) => ({
        ...m,
        is_deleted: true,
        deleted_at: new Date().toISOString(),
        content: null,
        media_urls: [],
      }));
      return { previousMessages };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(messagesQueryKey, context.previousMessages);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: messagesQueryKey });
    },
  });

  // Flatten all messages (pages are DESC); reverse once to render ASC
  const allMessagesDesc = messagesQuery.data?.pages.flatMap((p) => p.messages) || [];
  const allMessages = allMessagesDesc.slice().reverse();

  return {
    messages: allMessages,
    isLoading: messagesQuery.isLoading,
    isFetchingNextPage: messagesQuery.isFetchingNextPage,
    hasNextPage: messagesQuery.hasNextPage,
    fetchNextPage: messagesQuery.fetchNextPage,
    error: messagesQuery.error,
    sendMessage,
    markAsRead,
    addReaction,
    removeReaction,
    editMessage,
    softDeleteMessage,
  };
}
~~~

### FILE: src/modules/chat/hooks/usePins.ts
~~~ts
import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Message } from '../types';

export function usePins(conversationId: string | null) {
  const queryClient = useQueryClient();

  const pinnedQuery = useQuery({
    queryKey: ['chat-pinned', conversationId],
    queryFn: async () => {
      if (!conversationId) return null as Message | null;
      const { data, error } = await supabase
        .from('messages')
        .select('id, conversation_id, sender_id, content, pinned_at, pinned_by, created_at')
        .eq('conversation_id', conversationId)
        .not('pinned_at', 'is', null)
        .order('pinned_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as any) as Message | null;
    },
    enabled: !!conversationId,
    staleTime: 10 * 1000,
  });

  // Realtime: invalidate on any messages update in the conversation (simple + reliable)
  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`pins:${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        () => queryClient.invalidateQueries({ queryKey: ['chat-pinned', conversationId] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient]);

  const pinMessage = useMutation({
    mutationFn: async (messageId: string) => {
      const { error } = await supabase.rpc('pin_message', { p_message_id: messageId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-pinned', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
    },
  });

  const unpinMessage = useMutation({
    mutationFn: async (messageId: string) => {
      const { error } = await supabase.rpc('unpin_message', { p_message_id: messageId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-pinned', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
    },
  });

  return {
    pinnedMessage: pinnedQuery.data || null,
    isLoading: pinnedQuery.isLoading,
    pinMessage,
    unpinMessage,
  };
}

~~~

### FILE: src/modules/chat/hooks/useRedEnvelope.ts
~~~ts
import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { RedEnvelope, RedEnvelopeClaim } from '../types';

export function useRedEnvelope(envelopeId: string | null, conversationId: string | null) {
  const queryClient = useQueryClient();

  const envelopeQuery = useQuery({
    queryKey: ['chat-red-envelope', envelopeId],
    queryFn: async () => {
      if (!envelopeId) return null as RedEnvelope | null;
      const { data, error } = await supabase
        .from('red_envelopes')
        .select('*')
        .eq('id', envelopeId)
        .maybeSingle();
      if (error) throw error;
      return data as any as RedEnvelope | null;
    },
    enabled: !!envelopeId,
    staleTime: 5 * 1000,
  });

  const claimsQuery = useQuery({
    queryKey: ['chat-red-envelope-claims', envelopeId],
    queryFn: async () => {
      if (!envelopeId) return [] as RedEnvelopeClaim[];
      const { data, error } = await supabase
        .from('red_envelope_claims')
        .select('*')
        .eq('envelope_id', envelopeId)
        .order('claimed_at', { ascending: true });
      if (error) throw error;
      return (data || []) as any as RedEnvelopeClaim[];
    },
    enabled: !!envelopeId,
    staleTime: 5 * 1000,
  });

  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`red-envelope:${conversationId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'red_envelopes', filter: `conversation_id=eq.${conversationId}` },
        () => {
          if (envelopeId) queryClient.invalidateQueries({ queryKey: ['chat-red-envelope', envelopeId] });
        }
      )
      .on(
        'postgres_changes',
        envelopeId
          ? { event: '*', schema: 'public', table: 'red_envelope_claims', filter: `envelope_id=eq.${envelopeId}` }
          : { event: '*', schema: 'public', table: 'red_envelope_claims' },
        () => {
          if (envelopeId) queryClient.invalidateQueries({ queryKey: ['chat-red-envelope-claims', envelopeId] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, envelopeId, queryClient]);

  const claim = useMutation({
    mutationFn: async () => {
      if (!envelopeId) throw new Error('Missing envelope');
      const { data, error } = await supabase.rpc('claim_red_envelope', { p_envelope_id: envelopeId });
      if (error) throw error;
      return data as any;
    },
    onSuccess: () => {
      if (envelopeId) {
        queryClient.invalidateQueries({ queryKey: ['chat-red-envelope', envelopeId] });
        queryClient.invalidateQueries({ queryKey: ['chat-red-envelope-claims', envelopeId] });
      }
    },
  });

  return {
    envelope: envelopeQuery.data || null,
    claims: claimsQuery.data || [],
    isLoading: envelopeQuery.isLoading || claimsQuery.isLoading,
    claim,
  };
}
~~~

### FILE: src/modules/chat/hooks/useReports.ts
~~~ts
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useReports(currentUserId: string | null) {
  const createReport = useMutation({
    mutationFn: async (input: {
      reportedUserId?: string | null;
      conversationId?: string | null;
      messageId?: string | null;
      reason: string;
      details?: string | null;
    }) => {
      if (!currentUserId) throw new Error('Not authenticated');
      const { error } = await supabase.from('reports').insert({
        reporter_id: currentUserId,
        reported_user_id: input.reportedUserId ?? null,
        conversation_id: input.conversationId ?? null,
        message_id: input.messageId ?? null,
        reason: input.reason,
        details: input.details ?? null,
      });
      if (error) throw error;
    },
  });

  return { createReport };
}

~~~

### FILE: src/modules/chat/hooks/useStickers.ts
~~~ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Sticker, StickerPack } from '../types';

export function useStickers() {
  const packsQuery = useQuery({
    queryKey: ['chat-sticker-packs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sticker_packs')
        .select('id, name, description, preview_url, is_free, is_active, sort_order, created_at')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as StickerPack[];
    },
    staleTime: 60 * 1000,
  });

  const stickersQuery = useQuery({
    queryKey: ['chat-stickers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stickers')
        .select('id, pack_id, name, url, is_animated, sort_order')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data || []) as Sticker[];
    },
    staleTime: 60 * 1000,
  });

  const packs = packsQuery.data || [];
  const stickers = stickersQuery.data || [];

  const stickersByPack = new Map<string, Sticker[]>();
  for (const s of stickers) {
    const arr = stickersByPack.get(s.pack_id) || [];
    arr.push(s);
    stickersByPack.set(s.pack_id, arr);
  }

  return {
    packs,
    stickersByPack,
    isLoading: packsQuery.isLoading || stickersQuery.isLoading,
    error: packsQuery.error || stickersQuery.error,
  };
}

~~~

### FILE: src/modules/chat/hooks/useTypingIndicator.ts
~~~ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { TypingUser } from '../types';

export type { TypingUser };

export function useTypingIndicator(conversationId: string | null, userId: string | null, username: string | null) {
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Cleanup typing users after timeout
  const cleanupTypingUser = useCallback((userIdToRemove: string) => {
    setTypingUsers((prev) => prev.filter((u) => u.userId !== userIdToRemove));
  }, []);

  useEffect(() => {
    if (!conversationId || !userId) return;

    const channel = supabase.channel(`typing:${conversationId}`, {
      config: {
        presence: { key: userId },
      },
    });

    channel
      .on('broadcast', { event: 'typing' }, (payload) => {
        const { userId: typingUserId, username: typingUsername, avatar_url, isTyping } = payload.payload;

        if (typingUserId === userId) return; // Ignore own typing

        if (isTyping) {
          setTypingUsers((prev) => {
            const exists = prev.find((u) => u.userId === typingUserId);
            if (exists) return prev;
            return [...prev, { userId: typingUserId, username: typingUsername, avatar_url }];
          });

          // Auto-remove after 3 seconds
          setTimeout(() => cleanupTypingUser(typingUserId), 3000);
        } else {
          cleanupTypingUser(typingUserId);
        }
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [conversationId, userId, cleanupTypingUser]);

  // Send typing indicator (debounced)
  const sendTyping = useCallback(
    (isTyping: boolean) => {
      if (!channelRef.current || !userId || !username) return;

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      channelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId, username, isTyping },
      });

      // Auto-stop typing after 2 seconds of no input
      if (isTyping) {
        typingTimeoutRef.current = setTimeout(() => {
          channelRef.current?.send({
            type: 'broadcast',
            event: 'typing',
            payload: { userId, username, isTyping: false },
          });
        }, 2000);
      }
    },
    [userId, username]
  );

  return {
    typingUsers: typingUsers.filter((u) => u.userId !== userId),
    sendTyping,
  };
}
~~~

### FILE: src/modules/chat/index.ts
~~~ts
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
~~~

### FILE: src/modules/chat/pages/Chat.tsx
~~~tsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useConversations } from '../hooks/useConversations';
import { useGroupConversations } from '../hooks/useGroupConversations';
import { useChatNotifications } from '../hooks/useChatNotifications';
import { ConversationList } from '../components/ConversationList';
import { MessageThread } from '../components/MessageThread';
import { NewConversationDialog } from '../components/NewConversationDialog';
import { CreateGroupDialog } from '../components/CreateGroupDialog';
import { ChatSettingsDialog } from '../components/ChatSettingsDialog';
import { FacebookNavbar } from '@/components/layout/FacebookNavbar';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';
import { useIsMobileOrTablet } from '@/hooks/use-mobile';
import { ArrowLeft, MessageSquarePlus, Users, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function Chat() {
  const { conversationId } = useParams<{ conversationId?: string }>();
  const navigate = useNavigate();
  const isMobileOrTablet = useIsMobileOrTablet();
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const sidebarSettingsBtnRef = useRef<HTMLButtonElement | null>(null);
  const sidebarComposeBtnRef = useRef<HTMLButtonElement | null>(null);
  const lastFocusedSidebarControlRef = useRef<'settings' | 'compose' | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }
      setUserId(user.id);

      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single();

      setUsername(profile?.username || null);
    };

    checkAuth();
  }, [navigate]);

  const { conversations, isLoading, createDirectConversation } = useConversations(userId);
  const { createGroupConversation } = useGroupConversations(userId);

  useChatNotifications(userId, conversationId || null);

  const handleSelectConversation = (id: string) => {
    navigate(`/chat/${id}`);
  };

  const handleBack = () => {
    navigate('/chat');
  };

  const handleNewConversation = async (otherUserId: string) => {
    const result = await createDirectConversation.mutateAsync(otherUserId);
    if (result) {
      navigate(`/chat/${result.id}`);
    }
    setShowNewConversation(false);
  };

  const handleCreateGroup = async (name: string, memberIds: string[]) => {
    const result = await createGroupConversation.mutateAsync({ name, memberIds });
    if (result) {
      navigate(`/chat/${result.id}`);
    }
    setShowCreateGroup(false);
  };

  useEffect(() => {
    if (isMobileOrTablet) return;
    const control = lastFocusedSidebarControlRef.current;
    const target =
      control === 'settings'
        ? sidebarSettingsBtnRef.current
        : control === 'compose'
          ? sidebarComposeBtnRef.current
          : null;
    target?.focus({ preventScroll: true });
  }, [conversationId, isMobileOrTablet]);

  if (isMobileOrTablet) {
    return (
      <div className="h-screen overflow-hidden bg-background flex flex-col">
        <FacebookNavbar />
        <main className="flex-1 pt-14 pb-20 overflow-hidden">
          {conversationId ? (
            <div className="h-full min-h-0 flex flex-col overflow-hidden">
              <div className="flex items-center gap-2 p-3 border-b bg-card">
                <Button variant="ghost" size="icon" onClick={handleBack}>
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <span className="font-medium">Tin nhắn</span>
              </div>
              <MessageThread conversationId={conversationId} userId={userId} username={username} />
            </div>
          ) : (
            <div className="h-full min-h-0 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b">
                <h1 className="text-xl font-bold">Tin nhắn</h1>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowSettings(true)}
                    className="border border-transparent hover:border-[#C9A84C]/40 rounded-full"
                  >
                    <Settings className="h-5 w-5" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="border border-transparent hover:border-[#C9A84C]/40 rounded-full"
                      >
                        <MessageSquarePlus className="h-5 w-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setShowNewConversation(true)}>
                        <MessageSquarePlus className="h-4 w-4 mr-2" />
                        Tin nhắn mới
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setShowCreateGroup(true)}>
                        <Users className="h-4 w-4 mr-2" />
                        Tạo nhóm
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              <ConversationList
                conversations={conversations}
                selectedId={null}
                currentUserId={userId}
                onSelect={handleSelectConversation}
                isLoading={isLoading}
              />
            </div>
          )}
        </main>
        <MobileBottomNav />

        <NewConversationDialog
          open={showNewConversation}
          onOpenChange={setShowNewConversation}
          currentUserId={userId}
          onSelectUser={handleNewConversation}
        />
        <CreateGroupDialog
          open={showCreateGroup}
          onOpenChange={setShowCreateGroup}
          currentUserId={userId}
          onCreateGroup={handleCreateGroup}
          isCreating={createGroupConversation.isPending}
        />
        <ChatSettingsDialog open={showSettings} onOpenChange={setShowSettings} userId={userId} />
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-background flex flex-col">
      <FacebookNavbar />
      <main className="flex-1 pt-14 overflow-hidden">
        <div className="h-full flex overflow-hidden">
          <aside className="w-80 flex-shrink-0 h-full border-r bg-card overflow-hidden">
            <div className="h-full min-h-0 flex flex-col">
              <div className="sticky top-0 z-10 bg-card flex items-center justify-between p-4 border-b">
                <h1 className="text-xl font-bold">Tin nhắn</h1>
                <div className="flex items-center gap-1">
                  <Button
                    ref={sidebarSettingsBtnRef}
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowSettings(true)}
                    onFocus={() => {
                      lastFocusedSidebarControlRef.current = 'settings';
                    }}
                    className="border border-transparent hover:border-[#C9A84C]/40 rounded-full"
                  >
                    <Settings className="h-5 w-5" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        ref={sidebarComposeBtnRef}
                        variant="ghost"
                        size="icon"
                        onFocus={() => {
                          lastFocusedSidebarControlRef.current = 'compose';
                        }}
                        className="border border-transparent hover:border-[#C9A84C]/40 rounded-full"
                      >
                        <MessageSquarePlus className="h-5 w-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setShowNewConversation(true)}>
                        <MessageSquarePlus className="h-4 w-4 mr-2" />
                        Tin nhắn mới
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setShowCreateGroup(true)}>
                        <Users className="h-4 w-4 mr-2" />
                        Tạo nhóm
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              <ConversationList
                conversations={conversations}
                selectedId={conversationId || null}
                currentUserId={userId}
                onSelect={handleSelectConversation}
                isLoading={isLoading}
              />
            </div>
          </aside>

          <section className="flex-1 min-w-0 h-full flex flex-col overflow-hidden">
            {conversationId ? (
              <MessageThread conversationId={conversationId} userId={userId} username={username} />
            ) : (
              <div className="flex-1 min-h-0 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <MessageSquarePlus className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg">Chọn cuộc trò chuyện để bắt đầu</p>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>

      <NewConversationDialog
        open={showNewConversation}
        onOpenChange={setShowNewConversation}
        currentUserId={userId}
        onSelectUser={handleNewConversation}
      />
      <CreateGroupDialog
        open={showCreateGroup}
        onOpenChange={setShowCreateGroup}
        currentUserId={userId}
        onCreateGroup={handleCreateGroup}
        isCreating={createGroupConversation.isPending}
      />
      <ChatSettingsDialog open={showSettings} onOpenChange={setShowSettings} userId={userId} />
    </div>
  );
}
~~~

### FILE: src/modules/chat/types/index.ts
~~~ts
/**
 * Chat Module Types
 * Centralized type definitions for the chat feature
 */

import { Json } from '@/integrations/supabase/types';

// User profile type
export interface UserProfile {
  id: string;
  username: string;
  avatar_url: string | null;
  full_name: string | null;
  external_wallet_address?: string | null;
  custodial_wallet_address?: string | null;
  wallet_address?: string | null;
}

// Conversation types
export interface Conversation {
  id: string;
  type: string;
  name: string | null;
  avatar_url: string | null;
  created_by: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  created_at: string | null;
  updated_at: string | null;
  participants?: ConversationParticipant[];
  unread_count?: number;
}

export interface ConversationParticipant {
  id: string;
  conversation_id: string;
  user_id: string;
  role: string | null;
  nickname: string | null;
  joined_at: string | null;
  left_at: string | null;
  muted_until?: string | null;
  profile?: UserProfile;
}

// Message types
export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  media_urls: Json | null;
  reply_to_id: string | null;
  message_type?: 'text' | 'sticker' | 'red_envelope' | 'system' | string;
  metadata?: Json | null;
  edited_at?: string | null;
  pinned_at?: string | null;
  pinned_by?: string | null;
  is_deleted: boolean | null;
  deleted_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  sender?: UserProfile;
  reply_to?: Message | null;
  reactions?: MessageReaction[];
  read_by?: string[];
}

export interface MessageReaction {
  id: string;
  message_id?: string;
  user_id: string;
  emoji: string;
  created_at?: string | null;
}

export interface UserBlock {
  id: string;
  blocker_id: string;
  blocked_id: string;
  created_at: string | null;
}

export interface Report {
  id: string;
  reporter_id: string;
  reported_user_id: string | null;
  conversation_id: string | null;
  message_id: string | null;
  reason: string;
  details: string | null;
  status: string;
  created_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

export interface StickerPack {
  id: string;
  name: string;
  description: string | null;
  preview_url: string | null;
  is_free: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string | null;
}

export interface Sticker {
  id: string;
  pack_id: string;
  name: string;
  url: string;
  is_animated: boolean;
  sort_order: number;
}

export interface RedEnvelope {
  id: string;
  creator_id: string;
  conversation_id: string;
  message_id: string | null;
  token: 'CAMLY' | 'BNB' | string;
  total_amount: number;
  total_count: number;
  remaining_amount: number;
  remaining_count: number;
  expires_at: string;
  status: 'active' | 'expired' | 'fully_claimed' | string;
  created_at: string | null;
}

export interface RedEnvelopeClaim {
  id: string;
  envelope_id: string;
  claimer_id: string;
  amount: number;
  claimed_at: string;
}

// Call types
export type CallState = 'idle' | 'calling' | 'ringing' | 'connecting' | 'connected' | 'ended';
export type CallType = 'voice' | 'video';

export interface CallSession {
  id: string;
  conversation_id: string;
  initiator_id: string;
  call_type: CallType;
  status: string;
  channel_name: string;
  started_at?: string;
  ended_at?: string;
  duration_seconds?: number;
}

export interface RemoteUser {
  uid: import('agora-rtc-sdk-ng').UID;
  audioTrack?: any;
  videoTrack?: any;
  hasAudio: boolean;
  hasVideo: boolean;
}

// Media devices
export interface MediaDevice {
  deviceId: string;
  label: string;
  kind: 'audioinput' | 'audiooutput' | 'videoinput';
}

export interface NetworkQuality {
  uplink: number; // 0-5 (0=unknown, 1=excellent, 5=bad)
  downlink: number;
}

// Chat settings
export interface ChatSettings {
  id: string;
  user_id: string;
  who_can_message: string | null;
  show_read_receipts: boolean | null;
  show_typing_indicator: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

// Typing indicator
export interface TypingUser {
  userId: string;
  username: string;
  avatar_url?: string;
}
~~~

### FILE: packages/fun-chat/docs/BACKEND_REQUIREMENTS.md
~~~md
# Backend Requirements for `@fun/chat`

## Required Supabase schema
Run migration:
- `supabase/migrations/0001_fun_chat_core.sql`

This creates:
- `conversations`
- `conversation_participants`
- `messages`
- `message_reads`
- `message_reactions`
- `call_sessions`
- `call_participants`

## Agora token endpoint
For voice/video call support, configure an endpoint that returns RTC token.

### Request
`POST /token/rtc`

```json
{
  "channel": "chat_xxx",
  "userAccount": "user-id",
  "role": "publisher",
  "expireSeconds": 3600
}
```

### Response
```json
{
  "token": "...",
  "appId": "...",
  "channel": "chat_xxx",
  "userAccount": "user-id",
  "role": "publisher",
  "expireAt": 1735689600
}
```

## Minimal environment variables
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_AGORA_APP_ID`
- `VITE_AGORA_TOKEN_ENDPOINT` (optional if calls disabled)
- `VITE_AGORA_TOKEN_API_KEY` (optional header for token endpoint)

## Notes
- Calls are optional and controlled by `features.calls`.
- Chat-only integration works without Agora config.
- `profiles` table is expected (`id`, `username`, `avatar_url`, `full_name`).
~~~

### FILE: packages/fun-chat/package.json
~~~json
{
  "name": "@fun/chat",
  "version": "0.1.0",
  "private": false,
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs"
    },
    "./styles.css": "./dist/styles.css"
  },
  "files": [
    "dist",
    "README.md",
    "docs",
    "supabase"
  ],
  "sideEffects": [
    "*.css"
  ],
  "scripts": {
    "build": "tsup --config tsup.config.ts && node ./scripts/copy-css.mjs",
    "pack:local": "npm pack"
  },
  "peerDependencies": {
    "@supabase/supabase-js": "^2.79.0",
    "@tanstack/react-query": "^5.0.0",
    "agora-rtc-sdk-ng": "^4.24.2",
    "react": "^18.0.0 || ^19.0.0",
    "react-dom": "^18.0.0 || ^19.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.23",
    "tsup": "^8.2.4",
    "typescript": "^5.8.3"
  }
}
~~~

### FILE: packages/fun-chat/postcss.config.cjs
~~~js
module.exports = {
  plugins: {},
};
~~~

### FILE: packages/fun-chat/README.md
~~~md
# @fun/chat

Reusable chat module for React apps with Supabase realtime messaging and optional Agora calls.

## Install

```bash
npm i @fun/chat @supabase/supabase-js @tanstack/react-query agora-rtc-sdk-ng
```

## Quickstart

```tsx
import { FunChatProvider, FunChatApp, type FunChatConfig } from '@fun/chat';

const config: FunChatConfig = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  agoraAppId: import.meta.env.VITE_AGORA_APP_ID,
  tokenEndpoint: import.meta.env.VITE_AGORA_TOKEN_ENDPOINT,
  tokenEndpointHeaders: {
    'x-api-key': import.meta.env.VITE_AGORA_TOKEN_API_KEY,
  },
  features: {
    calls: true,
    attachments: false,
    reactions: true,
    readReceipts: true,
  },
};

export default function App() {
  return (
    <FunChatProvider config={config}>
      <FunChatApp />
    </FunChatProvider>
  );
}
```

`@fun/chat` already loads its default styles from the main entry.  
Optional: import `@fun/chat/styles.css` only if you want explicit style control.

## Config

`FunChatProvider` supports either:
- `supabaseClient` (pre-existing client), or
- `supabaseUrl` + `supabaseAnonKey`.

If both are present, `supabaseClient` is used.

## Backend requirements

- SQL migration: `supabase/migrations/0001_fun_chat_core.sql`
- Token endpoint + env vars: `docs/BACKEND_REQUIREMENTS.md`

## Build package

```bash
cd packages/fun-chat
npm install
npm run build
```

## Pack `.tgz`

```bash
cd packages/fun-chat
npm run pack:local
```

## Local install from tgz

```bash
npm i /absolute/path/to/fun-chat-0.1.0.tgz
```
~~~

### FILE: packages/fun-chat/scripts/copy-css.mjs
~~~js
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = resolve(__dirname, '../src/styles/fun-chat.css');
const out = resolve(__dirname, '../dist/styles.css');
mkdirSync(dirname(out), { recursive: true });
copyFileSync(src, out);
~~~

### FILE: packages/fun-chat/src/config/types.ts
~~~ts
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
~~~

### FILE: packages/fun-chat/src/context/FunChatContext.ts
~~~ts
import { createContext } from 'react';
import type { FunChatContextValue } from '../config/types';

export const FunChatContext = createContext<FunChatContextValue | null>(null);
~~~

### FILE: packages/fun-chat/src/FunChatApp.tsx
~~~tsx
import { useEffect, useMemo, useState } from 'react';
import { useAgoraCall } from './hooks/useAgoraCall';
import { useConversations } from './hooks/useConversations';
import { useFunChat } from './hooks/useFunChat';
import { useGroupConversations } from './hooks/useGroupConversations';
import { useMessages } from './hooks/useMessages';
import {
  CallPanel,
  ChatInput,
  ConversationList,
  CreateGroupDialog,
  MessageThread,
  NewConversationDialog,
} from './ui';

export function FunChatApp() {
  const { user, config, features } = useFunChat();
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);

  const { conversations, isLoading, createDirectConversation } = useConversations();
  const { createGroupConversation } = useGroupConversations();
  const { messages, isLoading: loadingMessages, sendMessage } = useMessages(activeConversationId);
  const call = useAgoraCall(activeConversationId);

  useEffect(() => {
    if (!activeConversationId && conversations.length) {
      setActiveConversationId(conversations[0].id);
    }
  }, [activeConversationId, conversations]);

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeConversationId) || null,
    [activeConversationId, conversations]
  );

  const emptyStateText = config.ui?.emptyStateText || 'Select a conversation to start chatting.';

  return (
    <div className={`fun-chat-root ${config.ui?.className || ''}`}>
      <aside className="fun-chat-sidebar">
        <div className="fun-chat-sidebar-header">
          <h2>Fun Chat</h2>
          <div className="fun-chat-actions">
            <button type="button" onClick={() => setShowNewConversation(true)}>
              New DM
            </button>
            <button type="button" onClick={() => setShowCreateGroup(true)}>
              New Group
            </button>
          </div>
        </div>

        <ConversationList
          conversations={conversations}
          selectedId={activeConversationId}
          currentUserId={user?.id || null}
          isLoading={isLoading}
          onSelect={(conversationId) => {
            setActiveConversationId(conversationId);
            config.callbacks?.onOpenConversation?.(conversationId);
          }}
        />
      </aside>

      <section className="fun-chat-main">
        {selectedConversation ? (
          <>
            <div className="fun-chat-main-header">
              <h3>{selectedConversation.name || 'Conversation'}</h3>
            </div>

            <MessageThread messages={messages} currentUserId={user?.id || null} isLoading={loadingMessages} />

            <CallPanel
              enabled={features.calls}
              canCall={call.canCall}
              isInCall={call.isInCall}
              callType={call.callType}
              onStartVoice={() => call.startCall('voice')}
              onStartVideo={() => call.startCall('video')}
              onEnd={call.endCall}
            />

            <ChatInput
              disabled={!user}
              onSend={async ({ content }) => {
                await sendMessage.mutateAsync({ content });
              }}
            />
          </>
        ) : (
          <div className="fun-chat-empty">{emptyStateText}</div>
        )}
      </section>

      <NewConversationDialog
        open={showNewConversation}
        onClose={() => setShowNewConversation(false)}
        onSelectUser={async (otherUserId) => {
          const result = await createDirectConversation.mutateAsync(otherUserId);
          if (result?.id) setActiveConversationId(result.id);
        }}
      />

      <CreateGroupDialog
        open={showCreateGroup}
        onClose={() => setShowCreateGroup(false)}
        onCreateGroup={async ({ name, memberIds }) => {
          const result = await createGroupConversation.mutateAsync({ name, memberIds });
          if (result?.id) setActiveConversationId(result.id);
        }}
      />
    </div>
  );
}
~~~

### FILE: packages/fun-chat/src/hooks/useAgoraCall.ts
~~~ts
import AgoraRTC, { type IAgoraRTCClient, type UID } from 'agora-rtc-sdk-ng';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { CallType } from '../config/types';
import { fetchAgoraToken } from '../services/tokenFetcher';
import { useFunChat } from './useFunChat';

export function useAgoraCall(conversationId: string | null) {
  const { client, config, user, features } = useFunChat();
  const rtcRef = useRef<IAgoraRTCClient | null>(null);
  const [isInCall, setIsInCall] = useState(false);
  const [callType, setCallType] = useState<CallType>('voice');
  const [channelName, setChannelName] = useState<string | null>(null);
  const localAudioTrackRef = useRef<any>(null);
  const localVideoTrackRef = useRef<any>(null);

  const canCall = useMemo(() => Boolean(features.calls && config.agoraAppId && config.tokenEndpoint), [features.calls, config]);

  const ensureClient = useCallback(() => {
    if (!rtcRef.current) {
      rtcRef.current = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
    }
    return rtcRef.current;
  }, []);

  const startCall = useCallback(
    async (type: CallType) => {
      if (!conversationId) throw new Error('No conversation selected');
      if (!user?.id) throw new Error('Not authenticated');
      if (!canCall) throw new Error('Calls are disabled or not configured');

      const channel = `chat_${conversationId.replace(/-/g, '').slice(0, 24)}`;
      const tokenResult = await fetchAgoraToken({
        endpoint: config.tokenEndpoint as string,
        headers: config.tokenEndpointHeaders,
        payload: {
          channel,
          userAccount: user.id,
          role: 'publisher',
          expireSeconds: 3600,
        },
      });

      const rtc = ensureClient();
      const uid = user.id as UID;
      await rtc.join(config.agoraAppId as string, channel, tokenResult.token, uid);

      const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
      localAudioTrackRef.current = audioTrack;
      localVideoTrackRef.current = videoTrack;
      await rtc.publish([audioTrack, videoTrack]);

      await client.from('call_sessions').insert({
        conversation_id: conversationId,
        initiator_id: user.id,
        call_type: type,
        status: 'ringing',
        channel_name: channel,
        started_at: new Date().toISOString(),
      });

      setCallType(type);
      setChannelName(channel);
      setIsInCall(true);
    },
    [canCall, client, config.agoraAppId, config.tokenEndpoint, config.tokenEndpointHeaders, conversationId, ensureClient, user?.id]
  );

  const endCall = useCallback(async () => {
    const rtc = rtcRef.current;
    if (rtc) {
      localAudioTrackRef.current?.stop?.();
      localAudioTrackRef.current?.close?.();
      localVideoTrackRef.current?.stop?.();
      localVideoTrackRef.current?.close?.();
      localAudioTrackRef.current = null;
      localVideoTrackRef.current = null;
      await rtc.leave();
      rtcRef.current = null;
    }

    if (conversationId && user?.id) {
      await client
        .from('call_sessions')
        .update({ status: 'ended', ended_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('initiator_id', user.id)
        .in('status', ['ringing', 'active']);
    }

    setIsInCall(false);
    setChannelName(null);
  }, [client, conversationId, user?.id]);

  return {
    canCall,
    isInCall,
    callType,
    channelName,
    startCall,
    endCall,
  };
}
~~~

### FILE: packages/fun-chat/src/hooks/useConversations.ts
~~~ts
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
~~~

### FILE: packages/fun-chat/src/hooks/useFunChat.ts
~~~ts
import { useContext } from 'react';
import { FunChatContext } from '../context/FunChatContext';

export function useFunChat() {
  const ctx = useContext(FunChatContext);
  if (!ctx) {
    throw new Error('useFunChat must be used within <FunChatProvider>');
  }
  return ctx;
}

export function useFunChatClient() {
  return useFunChat().client;
}
~~~

### FILE: packages/fun-chat/src/hooks/useGroupConversations.ts
~~~ts
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
~~~

### FILE: packages/fun-chat/src/hooks/useMessages.ts
~~~ts
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
~~~

### FILE: packages/fun-chat/src/index.ts
~~~ts
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
~~~

### FILE: packages/fun-chat/src/providers/FunChatProvider.tsx
~~~tsx
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@supabase/supabase-js';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { FunChatContext } from '../context/FunChatContext';
import type { FunChatConfig, FunChatResolvedFeatures } from '../config/types';
import type { User } from '@supabase/supabase-js';

const defaultFeatures: FunChatResolvedFeatures = {
  calls: false,
  attachments: false,
  reactions: true,
  readReceipts: true,
};

function resolveFeatures(config: FunChatConfig): FunChatResolvedFeatures {
  return {
    calls: config.features?.calls ?? defaultFeatures.calls,
    attachments: config.features?.attachments ?? defaultFeatures.attachments,
    reactions: config.features?.reactions ?? defaultFeatures.reactions,
    readReceipts: config.features?.readReceipts ?? defaultFeatures.readReceipts,
  };
}

function ProviderInner({ config, children }: { config: FunChatConfig; children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const client = useMemo(() => {
    if (config.supabaseClient) return config.supabaseClient;
    if (config.supabaseUrl && config.supabaseAnonKey) {
      return createClient(config.supabaseUrl, config.supabaseAnonKey);
    }
    throw new Error('FunChatProvider requires either supabaseClient or supabaseUrl + supabaseAnonKey');
  }, [config]);

  const features = useMemo(() => resolveFeatures(config), [config]);

  useEffect(() => {
    let mounted = true;

    client.auth
      .getUser()
      .then(({ data, error }) => {
        if (error) {
          config.callbacks?.onError?.(error);
          return;
        }
        if (!mounted) return;
        setUser(data.user ?? null);
        if (!data.user) config.callbacks?.onRequireAuth?.();
      })
      .catch((error) => {
        config.callbacks?.onError?.(error);
      });

    const { data } = client.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) config.callbacks?.onRequireAuth?.();
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [client, config]);

  const value = useMemo(
    () => ({
      config,
      client,
      user,
      features,
    }),
    [config, client, user, features]
  );

  return <FunChatContext.Provider value={value}>{children}</FunChatContext.Provider>;
}

function QueryBoundary({ config, children }: { config: FunChatConfig; children: ReactNode }) {
  let existingQueryClient: QueryClient | null = null;
  try {
    existingQueryClient = useQueryClient();
  } catch {
    existingQueryClient = null;
  }

  const localClient = useMemo(() => new QueryClient(), []);

  if (existingQueryClient) {
    return <ProviderInner config={config}>{children}</ProviderInner>;
  }

  return (
    <QueryClientProvider client={localClient}>
      <ProviderInner config={config}>{children}</ProviderInner>
    </QueryClientProvider>
  );
}

export function FunChatProvider({ config, children }: { config: FunChatConfig; children: ReactNode }) {
  return <QueryBoundary config={config}>{children}</QueryBoundary>;
}
~~~

### FILE: packages/fun-chat/src/services/tokenFetcher.ts
~~~ts
import type { AgoraTokenRequest, AgoraTokenResponse } from '../config/types';

export async function fetchAgoraToken(options: {
  endpoint: string;
  headers?: Record<string, string>;
  payload: AgoraTokenRequest;
}): Promise<AgoraTokenResponse> {
  const response = await fetch(options.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    body: JSON.stringify(options.payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data?.token) {
    throw new Error(data?.error || 'Failed to fetch Agora token');
  }

  return data as AgoraTokenResponse;
}
~~~

### FILE: packages/fun-chat/src/styles/fun-chat.css
~~~css
.fun-chat-root {
  display: grid;
  grid-template-columns: 320px 1fr;
  height: 100vh;
  border: 1px solid #e5e7eb;
  background: #ffffff;
  color: #0f172a;
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
}

.fun-chat-sidebar {
  border-right: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.fun-chat-sidebar-header {
  padding: 12px;
  border-bottom: 1px solid #e5e7eb;
}

.fun-chat-sidebar-header h2 {
  margin: 0 0 8px;
  font-size: 18px;
}

.fun-chat-actions {
  display: flex;
  gap: 8px;
}

.fun-chat-actions button,
.fun-chat-input button,
.fun-chat-call-panel button,
.fun-chat-modal button {
  border: 1px solid #d1d5db;
  background: #111827;
  color: #ffffff;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
}

.fun-chat-actions button:disabled,
.fun-chat-input button:disabled,
.fun-chat-call-panel button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.fun-chat-conversation-list {
  overflow: auto;
  padding: 8px;
  display: grid;
  gap: 8px;
}

.fun-chat-conversation-item {
  text-align: left;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 10px;
  cursor: pointer;
}

.fun-chat-conversation-item.is-active {
  border-color: #111827;
  background: #eef2ff;
}

.fun-chat-conversation-title {
  font-weight: 600;
  margin-bottom: 4px;
}

.fun-chat-conversation-preview {
  color: #64748b;
  font-size: 13px;
}

.fun-chat-main {
  min-width: 0;
  display: grid;
  grid-template-rows: auto 1fr auto auto;
}

.fun-chat-main-header {
  border-bottom: 1px solid #e5e7eb;
  padding: 12px;
}

.fun-chat-main-header h3 {
  margin: 0;
}

.fun-chat-thread {
  overflow: auto;
  padding: 14px;
  display: grid;
  gap: 10px;
  background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%);
}

.fun-chat-bubble-row {
  display: flex;
}

.fun-chat-bubble-row.is-mine {
  justify-content: flex-end;
}

.fun-chat-bubble {
  max-width: 75%;
  border-radius: 10px;
  padding: 8px 10px;
  background: #e2e8f0;
}

.fun-chat-bubble.is-mine {
  background: #111827;
  color: #ffffff;
}

.fun-chat-bubble-author {
  font-size: 12px;
  opacity: 0.8;
  margin-bottom: 4px;
}

.fun-chat-input {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  padding: 12px;
  border-top: 1px solid #e5e7eb;
}

.fun-chat-input textarea,
.fun-chat-inline-form input,
.fun-chat-stack-form input,
.fun-chat-stack-form textarea {
  width: 100%;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 8px;
  font: inherit;
}

.fun-chat-call-panel {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-top: 1px solid #e5e7eb;
  background: #f8fafc;
}

.fun-chat-call-state {
  color: #0f766e;
  font-weight: 600;
}

.fun-chat-empty,
.fun-chat-muted {
  color: #64748b;
  padding: 16px;
}

.fun-chat-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(2, 6, 23, 0.5);
  display: grid;
  place-items: center;
  z-index: 50;
}

.fun-chat-modal {
  width: min(520px, calc(100% - 24px));
  border-radius: 12px;
  background: #ffffff;
  padding: 16px;
  border: 1px solid #e5e7eb;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
}

.fun-chat-inline-form,
.fun-chat-stack-form {
  display: grid;
  gap: 8px;
}

.fun-chat-link {
  margin-top: 10px;
  background: transparent !important;
  color: #111827 !important;
}

@media (max-width: 900px) {
  .fun-chat-root {
    grid-template-columns: 1fr;
    grid-template-rows: 45vh 55vh;
  }

  .fun-chat-sidebar {
    border-right: 0;
    border-bottom: 1px solid #e5e7eb;
  }
}
~~~

### FILE: packages/fun-chat/src/ui/CallPanel.tsx
~~~tsx
import type { CallType } from '../config/types';

export function CallPanel(props: {
  enabled: boolean;
  canCall: boolean;
  isInCall: boolean;
  callType: CallType;
  onStartVoice: () => void;
  onStartVideo: () => void;
  onEnd: () => void;
}) {
  if (!props.enabled) return null;

  return (
    <div className="fun-chat-call-panel">
      <span>Call:</span>
      {!props.isInCall ? (
        <>
          <button type="button" onClick={props.onStartVoice} disabled={!props.canCall}>
            Voice
          </button>
          <button type="button" onClick={props.onStartVideo} disabled={!props.canCall}>
            Video
          </button>
        </>
      ) : (
        <>
          <span className="fun-chat-call-state">In {props.callType} call</span>
          <button type="button" onClick={props.onEnd}>
            End call
          </button>
        </>
      )}
    </div>
  );
}
~~~

### FILE: packages/fun-chat/src/ui/ChatInput.tsx
~~~tsx
import { FormEvent, useState } from 'react';

export function ChatInput(props: {
  disabled?: boolean;
  onSend: (input: { content: string }) => Promise<unknown> | unknown;
}) {
  const [content, setContent] = useState('');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const next = content.trim();
    if (!next || props.disabled) return;
    await props.onSend({ content: next });
    setContent('');
  }

  return (
    <form className="fun-chat-input" onSubmit={handleSubmit}>
      <textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        placeholder="Type a message"
        rows={2}
        disabled={props.disabled}
      />
      <button type="submit" disabled={props.disabled || !content.trim()}>
        Send
      </button>
    </form>
  );
}
~~~

### FILE: packages/fun-chat/src/ui/ConversationList.tsx
~~~tsx
import type { Conversation } from '../config/types';

export function ConversationList(props: {
  conversations: Conversation[];
  selectedId: string | null;
  currentUserId: string | null;
  isLoading: boolean;
  onSelect: (conversationId: string) => void;
}) {
  if (props.isLoading) {
    return <div className="fun-chat-muted">Loading conversations...</div>;
  }

  if (!props.conversations.length) {
    return <div className="fun-chat-muted">No conversations yet.</div>;
  }

  return (
    <div className="fun-chat-conversation-list">
      {props.conversations.map((conversation) => {
        const peers = (conversation.participants || []).filter((p) => p.user_id !== props.currentUserId);
        const title =
          conversation.type === 'group'
            ? conversation.name || 'Unnamed group'
            : peers[0]?.profile?.username || peers[0]?.profile?.full_name || 'Direct chat';

        const active = conversation.id === props.selectedId;

        return (
          <button
            key={conversation.id}
            type="button"
            onClick={() => props.onSelect(conversation.id)}
            className={`fun-chat-conversation-item ${active ? 'is-active' : ''}`}
          >
            <div className="fun-chat-conversation-title">{title}</div>
            <div className="fun-chat-conversation-preview">
              {conversation.last_message_preview || 'Start chatting'}
            </div>
          </button>
        );
      })}
    </div>
  );
}
~~~

### FILE: packages/fun-chat/src/ui/CreateGroupDialog.tsx
~~~tsx
import { FormEvent, useState } from 'react';

export function CreateGroupDialog(props: {
  open: boolean;
  onClose: () => void;
  onCreateGroup: (payload: { name: string; memberIds: string[] }) => Promise<unknown> | unknown;
}) {
  const [name, setName] = useState('');
  const [members, setMembers] = useState('');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const memberIds = members
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    await props.onCreateGroup({ name, memberIds });
    setName('');
    setMembers('');
    props.onClose();
  }

  if (!props.open) return null;

  return (
    <div className="fun-chat-modal-backdrop">
      <div className="fun-chat-modal">
        <h3>Create group</h3>
        <form className="fun-chat-stack-form" onSubmit={handleSubmit}>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Group name" />
          <textarea
            value={members}
            onChange={(event) => setMembers(event.target.value)}
            placeholder="Member user IDs separated by commas"
            rows={3}
          />
          <button type="submit">Create group</button>
        </form>
        <button type="button" className="fun-chat-link" onClick={props.onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
~~~

### FILE: packages/fun-chat/src/ui/index.ts
~~~ts
export { ConversationList } from './ConversationList';
export { MessageThread } from './MessageThread';
export { ChatInput } from './ChatInput';
export { NewConversationDialog } from './NewConversationDialog';
export { CreateGroupDialog } from './CreateGroupDialog';
export { CallPanel } from './CallPanel';
~~~

### FILE: packages/fun-chat/src/ui/MessageThread.tsx
~~~tsx
import type { Message } from '../config/types';

export function MessageThread(props: { messages: Message[]; currentUserId: string | null; isLoading: boolean }) {
  if (props.isLoading) {
    return <div className="fun-chat-muted">Loading messages...</div>;
  }

  if (!props.messages.length) {
    return <div className="fun-chat-muted">No messages yet. Send the first one.</div>;
  }

  return (
    <div className="fun-chat-thread">
      {props.messages.map((message) => {
        const mine = message.sender_id === props.currentUserId;
        return (
          <div key={message.id} className={`fun-chat-bubble-row ${mine ? 'is-mine' : ''}`}>
            <div className={`fun-chat-bubble ${mine ? 'is-mine' : ''}`}>
              {!mine ? (
                <div className="fun-chat-bubble-author">
                  {message.sender?.username || message.sender?.full_name || 'User'}
                </div>
              ) : null}
              <div>{message.content || '(empty message)'}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
~~~

### FILE: packages/fun-chat/src/ui/NewConversationDialog.tsx
~~~tsx
import { FormEvent, useEffect, useState } from 'react';
import { useFunChat } from '../hooks/useFunChat';

type Profile = { id: string; username: string | null; full_name: string | null };

export function NewConversationDialog(props: {
  open: boolean;
  onClose: () => void;
  onSelectUser: (userId: string) => Promise<unknown> | unknown;
}) {
  const { client, user } = useFunChat();
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<Profile[]>([]);

  useEffect(() => {
    if (!props.open || !user?.id) return;

    const run = async () => {
      const { data } = await client
        .from('profiles')
        .select('id, username, full_name')
        .neq('id', user.id)
        .limit(20);
      setItems((data || []) as Profile[]);
    };

    run();
  }, [client, props.open, user?.id]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    const selected = items.find((item) =>
      [item.username, item.full_name, item.id].filter(Boolean).some((field) =>
        String(field).toLowerCase().includes(query.trim().toLowerCase())
      )
    );

    if (!selected) return;
    await props.onSelectUser(selected.id);
    setQuery('');
    props.onClose();
  }

  if (!props.open) return null;

  return (
    <div className="fun-chat-modal-backdrop">
      <div className="fun-chat-modal">
        <h3>New conversation</h3>
        <form onSubmit={handleCreate} className="fun-chat-inline-form">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Type username"
          />
          <button type="submit">Create</button>
        </form>
        <button type="button" className="fun-chat-link" onClick={props.onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
~~~

### FILE: packages/fun-chat/supabase/migrations/0001_fun_chat_core.sql
~~~sql
-- Fun Chat Core schema

CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL DEFAULT 'direct' CHECK (type IN ('direct', 'group')),
  name TEXT,
  avatar_url TEXT,
  created_by UUID,
  last_message_at TIMESTAMPTZ DEFAULT now(),
  last_message_preview TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.conversation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  nickname TEXT,
  joined_at TIMESTAMPTZ DEFAULT now(),
  left_at TIMESTAMPTZ,
  last_read_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  content TEXT,
  media_urls JSONB DEFAULT '[]'::jsonb,
  reply_to_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.message_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  read_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(message_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

CREATE TABLE IF NOT EXISTS public.call_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  initiator_id UUID NOT NULL,
  call_type TEXT NOT NULL CHECK (call_type IN ('voice', 'video')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ringing', 'active', 'ended', 'missed', 'declined')),
  channel_name TEXT NOT NULL UNIQUE,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.call_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_session_id UUID REFERENCES public.call_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  joined_at TIMESTAMPTZ,
  left_at TIMESTAMPTZ,
  is_muted BOOLEAN DEFAULT false,
  is_video_off BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON public.conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_participants_user ON public.conversation_participants(user_id) WHERE left_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_reads_message ON public.message_reads(message_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_message ON public.message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_call_sessions_conversation ON public.call_sessions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_call_participants_session ON public.call_participants(call_session_id);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_participants ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_conversation_participant(conv_id UUID, check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = conv_id
      AND user_id = check_user_id
      AND left_at IS NULL
  )
$$;

CREATE OR REPLACE FUNCTION public.is_conversation_admin(conv_id UUID, check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = conv_id
      AND user_id = check_user_id
      AND role = 'admin'
      AND left_at IS NULL
  )
$$;

DROP POLICY IF EXISTS "Users can view conversations" ON public.conversations;
CREATE POLICY "Users can view conversations"
  ON public.conversations FOR SELECT
  USING (public.is_conversation_participant(id, auth.uid()));

DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;
CREATE POLICY "Users can create conversations"
  ON public.conversations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admins can update conversations" ON public.conversations;
CREATE POLICY "Admins can update conversations"
  ON public.conversations FOR UPDATE
  USING (public.is_conversation_admin(id, auth.uid()));

DROP POLICY IF EXISTS "Users can view participants" ON public.conversation_participants;
CREATE POLICY "Users can view participants"
  ON public.conversation_participants FOR SELECT
  USING (public.is_conversation_participant(conversation_id, auth.uid()));

DROP POLICY IF EXISTS "Users can insert participants" ON public.conversation_participants;
CREATE POLICY "Users can insert participants"
  ON public.conversation_participants FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can update own participant record" ON public.conversation_participants;
CREATE POLICY "Users can update own participant record"
  ON public.conversation_participants FOR UPDATE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view messages" ON public.messages;
CREATE POLICY "Users can view messages"
  ON public.messages FOR SELECT
  USING (public.is_conversation_participant(conversation_id, auth.uid()));

DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
CREATE POLICY "Users can send messages"
  ON public.messages FOR INSERT
  WITH CHECK (sender_id = auth.uid() AND public.is_conversation_participant(conversation_id, auth.uid()));

DROP POLICY IF EXISTS "Users can update own messages" ON public.messages;
CREATE POLICY "Users can update own messages"
  ON public.messages FOR UPDATE
  USING (sender_id = auth.uid());

DROP POLICY IF EXISTS "Users can view call sessions" ON public.call_sessions;
CREATE POLICY "Users can view call sessions"
  ON public.call_sessions FOR SELECT
  USING (public.is_conversation_participant(conversation_id, auth.uid()));

DROP POLICY IF EXISTS "Users can create call sessions" ON public.call_sessions;
CREATE POLICY "Users can create call sessions"
  ON public.call_sessions FOR INSERT
  WITH CHECK (initiator_id = auth.uid() AND public.is_conversation_participant(conversation_id, auth.uid()));

DROP POLICY IF EXISTS "Users can update call sessions" ON public.call_sessions;
CREATE POLICY "Users can update call sessions"
  ON public.call_sessions FOR UPDATE
  USING (public.is_conversation_participant(conversation_id, auth.uid()));

DROP POLICY IF EXISTS "Users can view call participants" ON public.call_participants;
CREATE POLICY "Users can view call participants"
  ON public.call_participants FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.call_sessions cs
      WHERE cs.id = call_participants.call_session_id
        AND public.is_conversation_participant(cs.conversation_id, auth.uid())
    )
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_participants;
~~~

### FILE: packages/fun-chat/tsconfig.json
~~~json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "declaration": true,
    "strict": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true
  },
  "include": ["src", "tsup.config.ts"]
}
~~~

### FILE: packages/fun-chat/tsup.config.ts
~~~ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  external: ['react', 'react-dom', '@supabase/supabase-js', '@tanstack/react-query', 'agora-rtc-sdk-ng'],
});
~~~

### FILE: packages/fun-chat-call/examples/host-app-snippet.tsx
~~~tsx
import { FunChatProvider, ChatPanel, CallOverlay, type ChatCallAdapter } from '@fun/chat-call';

const adapter: ChatCallAdapter = {
  getAuth: async () => ({ userId: 'user-id' }),
  fetchAgoraToken: async ({ channelName, role }) => ({
    appId: 'agora-app-id',
    token: 'agora-token',
    uid: 1,
    channelName,
    expiresAt: Date.now() + 60_000,
  }),
  fetchChatHistory: async () => ({ items: [], nextCursor: null }),
  sendMessage: async () => ({ ok: true }),
};

export function HostAppSnippet() {
  return (
    <FunChatProvider
      adapter={adapter}
      config={{
        appName: 'My Host App',
        renderers: {
          ChatPanel: () => <div>My Chat UI</div>,
          CallOverlay: () => <div />,
        },
      }}
    >
      <ChatPanel />
      <CallOverlay />
    </FunChatProvider>
  );
}
~~~

### FILE: packages/fun-chat-call/examples/vite-smoke/index.html
~~~text
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>fun-chat-call smoke</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
~~~

### FILE: packages/fun-chat-call/examples/vite-smoke/package.json
~~~json
{
  "name": "fun-chat-call-vite-smoke",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@fun/chat-call": "file:../../fun-chat-call-0.1.0.tgz",
    "@tanstack/react-query": "^5.90.6",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.30.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.23",
    "@types/react-dom": "^18.3.7",
    "@vitejs/plugin-react": "^4.4.1",
    "typescript": "^5.8.3",
    "vite": "^5.4.19"
  }
}
~~~

### FILE: packages/fun-chat-call/examples/vite-smoke/src/App.tsx
~~~tsx
import {
  ChatPanel,
  CallOverlay,
  FunChatProvider,
  type ChatCallAdapter,
} from '@fun/chat-call';

const adapter: ChatCallAdapter = {
  getAuth: () => ({ userId: 'smoke-user' }),
  fetchAgoraToken: async ({ channelName }) => ({
    appId: 'smoke-app',
    token: 'smoke-token',
    uid: 1,
    channelName,
    expiresAt: Date.now() + 60000,
  }),
  fetchChatHistory: async () => ({ items: [], nextCursor: null }),
  sendMessage: async () => ({ ok: true }),
};

export function App() {
  return (
    <FunChatProvider
      adapter={adapter}
      config={{
        appName: 'Smoke Host',
        renderers: {
          ChatPanel: () => <div>Smoke ChatPanel renderer OK</div>,
          CallOverlay: () => null,
        },
      }}
    >
      <main>
        <h1>Smoke Test: @fun/chat-call</h1>
        <ChatPanel />
        <CallOverlay />
      </main>
    </FunChatProvider>
  );
}
~~~

### FILE: packages/fun-chat-call/examples/vite-smoke/src/main.tsx
~~~tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
~~~

### FILE: packages/fun-chat-call/examples/vite-smoke/tsconfig.json
~~~json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "Bundler",
    "allowImportingTsExtensions": false,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": false
  },
  "include": ["src"]
}
~~~

### FILE: packages/fun-chat-call/examples/vite-smoke/vite.config.ts
~~~ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});
~~~

### FILE: packages/fun-chat-call/package.json
~~~json
{
  "name": "@fun/chat-call",
  "version": "0.1.0",
  "private": false,
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs"
    }
  },
  "files": [
    "dist",
    "README.md"
  ],
  "sideEffects": false,
  "scripts": {
    "build": "tsup --config tsup.config.ts",
    "pack:local": "npm pack"
  },
  "peerDependencies": {
    "react": "^18.0.0 || ^19.0.0",
    "react-dom": "^18.0.0 || ^19.0.0",
    "react-router-dom": "^6.0.0",
    "@tanstack/react-query": "^5.0.0"
  },
  "dependencies": {
    "agora-rtc-sdk-ng": "^4.24.2"
  },
  "devDependencies": {
    "@types/react": "^18.3.23",
    "tsup": "^8.2.4",
    "typescript": "^5.8.3"
  }
}
~~~

### FILE: packages/fun-chat-call/PLAN.md
~~~md
# FUN Chat + Calling Extraction Plan

## Scope
Extract the existing chat + calling feature into `packages/fun-chat-call` with a clean public API and host adapter layer, while preserving existing behavior in this app.

## Current source of truth
- Chat page + UI: `src/modules/chat/pages/Chat.tsx`, `src/modules/chat/components/*`
- Chat/call hooks: `src/modules/chat/hooks/*` (notably `useMessages`, `useConversations`, `useAgoraCall`)
- Global incoming call: `src/contexts/CallContext.tsx`
- Agora token backend: `supabase/functions/agora-token/index.ts`

## Target package structure
- `packages/fun-chat-call/package.json`
- `packages/fun-chat-call/src/index.ts`
- `packages/fun-chat-call/src/provider/FunChatProvider.tsx`
- `packages/fun-chat-call/src/config/types.ts`
- `packages/fun-chat-call/src/adapters/ChatCallAdapter.ts`
- `packages/fun-chat-call/src/ui/*`
- `packages/fun-chat-call/src/hooks/*`
- `packages/fun-chat-call/src/services/*`
- `packages/fun-chat-call/README.md`
- `packages/fun-chat-call/examples/host-app-snippet.tsx`

## Implementation phases
1. **API & adapter layer**
   - Define `ChatCallAdapter` and package config types.
   - Add provider + `useFunChat()`.
2. **UI bridge extraction**
   - Expose `ChatPanel` + `CallOverlay` from package.
   - Bridge to existing in-repo chat/call UI to preserve behavior.
3. **Logic hooks/services**
   - Add adapter-first hooks/services (`useMessages`, `usePresence`, `useCall`, agora wrappers).
4. **Host integration**
   - Add `src/integrations/funChatCallAdapter.ts` implementation.
   - Wire app root with `FunChatProvider` and package exports.
   - Replace chat route component import with package `ChatPanel`.
5. **Docs & migration notes**
   - README with setup/config/troubleshooting.
   - Migration note listing old vs new imports.

## Safety constraints
- No hardcoded app routes/endpoints inside package API.
- Env/config comes from host via provider config + adapter.
- Keep existing behavior in this app by using bridge components and default adapter implementation.
~~~

### FILE: packages/fun-chat-call/README.md
~~~md
# @fun/chat-call

Package chat + g?i tho?i/video d?ng t�i s? d?ng cho React app.

## Public API
```ts
import {
  FunChatProvider,
  ChatPanel,
  CallOverlay,
  useFunChat,
  useMessages,
  usePresence,
  useCall,
  type FunChatConfig,
  type ChatCallAdapter,
} from '@fun/chat-call';
```

## Adapter b?t bu?c
Host app c?n implement `ChatCallAdapter`:
- `getAuth()`
- `fetchAgoraToken(params)`
- `fetchChatHistory(conversationId, cursor?)`
- `sendMessage(conversationId, payload)`

T�y ch?n:
- `subscribeRealtime(conversationId, handlers)`
- `uploadAttachment(file)`

## Build package
```bash
cd packages/fun-chat-call
npm install
npm run build
```

K?t qu? build n?m t?i `dist/` g?m:
- `dist/index.mjs`
- `dist/index.cjs`
- `dist/index.d.ts`

## Pack ra tgz
```bash
cd packages/fun-chat-call
npm run pack:local
# ho?c: npm pack
```

File t?o ra d?ng: `fun-chat-call-0.1.0.tgz`.

## C�i v�o repo kh�c t? tgz
```bash
cd /path/to/other-project
npm i /absolute/path/to/packages/fun-chat-call/fun-chat-call-0.1.0.tgz
```

## Smoke test b?ng Vite (d�ng tgz)
V� d? c� s?n t?i `examples/vite-smoke`.

### Ch?y smoke test
```bash
cd packages/fun-chat-call
npm run build
npm pack
cd examples/vite-smoke
npm install
npm i ../../fun-chat-call-0.1.0.tgz
npm run dev
```

N?u app Vite ch?y v� render ��?c `ChatPanel` t? package l� pass smoke test.

## Troubleshooting
1. Kh�ng g?i ��?c camera/mic:
- Ki?m tra quy?n browser + HTTPS origin.

2. Agora token l?i:
- Verify endpoint trong adapter `fetchAgoraToken`.
- Verify role/channelName/uid theo backend.

3. Kh�ng nh?n realtime:
- Ki?m tra adapter `subscribeRealtime` c� unsubscribe chu?n.

4. Import l?i `@fun/chat-call`:
- Ki?m tra ��ng phi�n b?n tgz v� lockfile �? update.

## Migration note (host app)
- C?: import tr?c ti?p t? `src/modules/chat/pages/Chat`.
- M?i: import `ChatPanel` t? `@fun/chat-call` v� truy?n renderer bridge �? gi? UI c?.
~~~

### FILE: packages/fun-chat-call/src/adapters/ChatCallAdapter.ts
~~~ts
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
~~~

### FILE: packages/fun-chat-call/src/config/types.ts
~~~ts
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
~~~

### FILE: packages/fun-chat-call/src/hooks/useCall.ts
~~~ts
import { useCallback, useState } from 'react';
import { useFunChat } from './useFunChat';
import { fetchAgoraToken } from '../services/tokenFetcher';
import { createRtcStateStore, type RtcCallStateStore } from '../services/rtcState';

export function useCall() {
  const { adapter } = useFunChat();
  const [state, setState] = useState<RtcCallStateStore>(() => createRtcStateStore());

  const requestToken = useCallback(
    async (channelName: string, role: 'host' | 'audience' | 'publisher' | 'subscriber') => {
      setState((prev) => ({ ...prev, status: 'connecting' }));
      try {
        const token = await fetchAgoraToken(adapter, { channelName, role });
        setState((prev) => ({ ...prev, status: 'connected', token }));
        return token;
      } catch (error) {
        setState((prev) => ({ ...prev, status: 'error', error }));
        throw error;
      }
    },
    [adapter]
  );

  const resetCallState = useCallback(() => {
    setState(createRtcStateStore());
  }, []);

  return {
    state,
    requestToken,
    resetCallState,
  };
}

~~~

### FILE: packages/fun-chat-call/src/hooks/useFunChat.ts
~~~ts
import { useFunChatContext } from '../provider/FunChatProvider';

export function useFunChat() {
  return useFunChatContext();
}

~~~

### FILE: packages/fun-chat-call/src/hooks/useMessages.ts
~~~ts
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

~~~

### FILE: packages/fun-chat-call/src/hooks/usePresence.ts
~~~ts
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

~~~

### FILE: packages/fun-chat-call/src/index.ts
~~~ts
export { FunChatProvider } from './provider/FunChatProvider';
export { ChatPanel } from './ui/ChatPanel';
export { CallOverlay } from './ui/CallOverlay';
export { useFunChat } from './hooks/useFunChat';
export { useMessages } from './hooks/useMessages';
export { usePresence } from './hooks/usePresence';
export { useCall } from './hooks/useCall';

export type { FunChatConfig, FunChatUiText, FunChatRenderers } from './config/types';
export type {
  AgoraTokenParams,
  AgoraTokenResult,
  MessagePayload,
  MessageCursorPage,
  RealtimeSubscription,
} from './config/types';
export type { ChatCallAdapter, ChatCallAuth } from './adapters/ChatCallAdapter';

~~~

### FILE: packages/fun-chat-call/src/provider/FunChatProvider.tsx
~~~tsx
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { ChatCallAdapter } from '../adapters/ChatCallAdapter';
import type { FunChatConfig } from '../config/types';

interface FunChatContextValue {
  config: FunChatConfig;
  adapter: ChatCallAdapter;
}

const FunChatContext = createContext<FunChatContextValue | null>(null);

interface FunChatProviderProps {
  config: FunChatConfig;
  adapter: ChatCallAdapter;
  children: ReactNode;
}

export function FunChatProvider({ config, adapter, children }: FunChatProviderProps) {
  const value = useMemo(
    () => ({
      config,
      adapter,
    }),
    [config, adapter]
  );

  return <FunChatContext.Provider value={value}>{children}</FunChatContext.Provider>;
}

export function useFunChatContext() {
  const ctx = useContext(FunChatContext);
  if (!ctx) {
    throw new Error('useFunChatContext must be used inside <FunChatProvider>');
  }
  return ctx;
}

~~~

### FILE: packages/fun-chat-call/src/services/agoraClient.ts
~~~ts
import AgoraRTC, { type IAgoraRTCClient } from 'agora-rtc-sdk-ng';

export function createAgoraClient(mode: 'rtc' | 'live' = 'rtc', codec: 'vp8' | 'h264' = 'vp8') {
  return AgoraRTC.createClient({ mode, codec });
}

export async function joinAgoraClient(
  client: IAgoraRTCClient,
  appId: string,
  channelName: string,
  token: string,
  uid: string | number
) {
  return client.join(appId, channelName, token, uid);
}

export async function leaveAgoraClient(client: IAgoraRTCClient) {
  await client.leave();
}

~~~

### FILE: packages/fun-chat-call/src/services/rtcState.ts
~~~ts
import type { AgoraTokenResult } from '../config/types';

export type RtcCallStatus = 'idle' | 'connecting' | 'connected' | 'error';

export interface RtcCallStateStore {
  status: RtcCallStatus;
  token: AgoraTokenResult | null;
  error: unknown | null;
}

export function createRtcStateStore(): RtcCallStateStore {
  return {
    status: 'idle',
    token: null,
    error: null,
  };
}

~~~

### FILE: packages/fun-chat-call/src/services/tokenFetcher.ts
~~~ts
import type { ChatCallAdapter } from '../adapters/ChatCallAdapter';
import type { AgoraTokenParams } from '../config/types';

export async function fetchAgoraToken(adapter: ChatCallAdapter, params: AgoraTokenParams) {
  return adapter.fetchAgoraToken(params);
}

~~~

### FILE: packages/fun-chat-call/src/ui/CallOverlay.tsx
~~~tsx
import { useFunChat } from '../hooks/useFunChat';
import type { FunChatRendererProps } from '../config/types';

export function CallOverlay(props?: FunChatRendererProps) {
  const { config } = useFunChat();
  const renderer = config.renderers?.CallOverlay;

  if (renderer) return renderer(props);

  return null;
}

~~~

### FILE: packages/fun-chat-call/src/ui/ChatPanel.tsx
~~~tsx
import { useFunChat } from '../hooks/useFunChat';
import type { FunChatRendererProps } from '../config/types';

export function ChatPanel(props?: FunChatRendererProps) {
  const { config } = useFunChat();
  const renderer = config.renderers?.ChatPanel;

  if (renderer) return renderer(props);

  return (
    <div className={props?.className}>
      <p>{config.uiText?.emptyStateTitle ?? 'Chat panel is not configured.'}</p>
    </div>
  );
}

~~~

### FILE: packages/fun-chat-call/tsconfig.json
~~~json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "declaration": true,
    "strict": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true
  },
  "include": ["src", "tsup.config.ts"]
}
~~~

### FILE: packages/fun-chat-call/tsup.config.ts
~~~ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  splitting: false,
  external: ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query'],
});
~~~

### FILE: supabase/config.toml
~~~toml
project_id = "lramftbsjrqyysdqlfdg"
~~~

### FILE: supabase/functions/_shared/jwt.ts
~~~ts
/**
 * JWT Utilities for FUN Profile SSO
 * 
 * Derives signing key from SUPABASE_SERVICE_ROLE_KEY to avoid needing a separate secret.
 * Uses HMAC-SHA256 for token signing.
 */

const JWT_ISSUER = "fun_profile";
const ACCESS_TOKEN_EXPIRES_SECONDS = 3600; // 1 hour

interface JWTPayload {
  sub: string;                    // user_id (UUID)
  fun_id: string;                 // FUN ID (username-based identifier)
  username: string;               // Display username
  custodial_wallet: string | null; // Custodial wallet address
  scope: string[];                // Granted scopes/permissions
}

interface JWTHeader {
  alg: string;
  typ: string;
}

// Derive a signing key from SUPABASE_SERVICE_ROLE_KEY using HKDF-like approach
async function getSigningKey(): Promise<CryptoKey> {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY not configured");
  }
  
  // Use the service key + salt to derive JWT signing key
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(serviceKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
  
  // Derive a specific key for JWT signing
  const salt = encoder.encode("fun_profile_jwt_v1");
  const derivedKeyData = await crypto.subtle.sign("HMAC", keyMaterial, salt);
  
  // Import the derived key for HMAC operations
  return await crypto.subtle.importKey(
    "raw",
    derivedKeyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

// Base64URL encode
function base64UrlEncode(data: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...data));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Base64URL decode
function base64UrlDecode(str: string): Uint8Array {
  // Add padding if needed
  let padded = str.replace(/-/g, "+").replace(/_/g, "/");
  while (padded.length % 4) {
    padded += "=";
  }
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Generate a JWT Access Token
 */
export async function generateAccessToken(payload: JWTPayload): Promise<string> {
  const signingKey = await getSigningKey();
  const encoder = new TextEncoder();
  
  const now = Math.floor(Date.now() / 1000);
  
  const header: JWTHeader = {
    alg: "HS256",
    typ: "JWT"
  };
  
  const claims = {
    ...payload,
    iss: JWT_ISSUER,
    iat: now,
    exp: now + ACCESS_TOKEN_EXPIRES_SECONDS
  };
  
  // Encode header and payload
  const headerB64 = base64UrlEncode(encoder.encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(encoder.encode(JSON.stringify(claims)));
  
  // Sign
  const message = `${headerB64}.${payloadB64}`;
  const signature = await crypto.subtle.sign(
    "HMAC",
    signingKey,
    encoder.encode(message)
  );
  
  const signatureB64 = base64UrlEncode(new Uint8Array(signature));
  
  return `${message}.${signatureB64}`;
}

/**
 * Verify and decode a JWT Access Token
 * Returns null if invalid or expired
 */
export async function verifyAccessToken(token: string): Promise<JWTPayload | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      console.error("[JWT] Invalid token format");
      return null;
    }
    
    const [headerB64, payloadB64, signatureB64] = parts;
    
    // Verify signature
    const signingKey = await getSigningKey();
    const encoder = new TextEncoder();
    const message = `${headerB64}.${payloadB64}`;
    
    const signatureBytes = base64UrlDecode(signatureB64);
    const isValid = await crypto.subtle.verify(
      "HMAC",
      signingKey,
      new Uint8Array(signatureBytes).buffer as ArrayBuffer,
      encoder.encode(message)
    );
    
    if (!isValid) {
      console.error("[JWT] Signature verification failed");
      return null;
    }
    
    // Decode and validate claims
    const payloadJson = new TextDecoder().decode(base64UrlDecode(payloadB64));
    const claims = JSON.parse(payloadJson);
    
    // Check issuer
    if (claims.iss !== JWT_ISSUER) {
      console.error("[JWT] Invalid issuer");
      return null;
    }
    
    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (claims.exp && claims.exp < now) {
      console.error("[JWT] Token expired");
      return null;
    }
    
    return {
      sub: claims.sub,
      fun_id: claims.fun_id,
      username: claims.username,
      custodial_wallet: claims.custodial_wallet,
      scope: claims.scope
    };
  } catch (error) {
    console.error("[JWT] Verification error:", error);
    return null;
  }
}

/**
 * Generate an opaque refresh token (secure random string)
 */
export function generateRefreshToken(length = 96): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => chars[b % chars.length]).join("");
}

/**
 * Decode JWT without verification (for debugging/logging only)
 */
export function decodeJwtUnsafe(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    
    const payloadJson = new TextDecoder().decode(base64UrlDecode(parts[1]));
    return JSON.parse(payloadJson);
  } catch {
    return null;
  }
}
~~~

### FILE: supabase/functions/agora-token/index.ts
~~~ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Authorization required" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return jsonResponse({ error: "Invalid token" }, 401);
    }

    const body = await req.json();
    const { channel_name, call_session_id } = body;

    if (!channel_name) {
      return jsonResponse({ error: "channel_name is required" }, 400);
    }

    // If call_session_id provided, verify user is participant
    if (call_session_id) {
      const { data: session, error: sessionError } = await supabase
        .from("call_sessions")
        .select("id, conversation_id")
        .eq("id", call_session_id)
        .single();

      if (sessionError || !session) {
        return jsonResponse({ error: "Call session not found" }, 404);
      }
    }

    // Proxy to Cloudflare Worker (uses official Agora library)
    const workerUrl = Deno.env.get("VITE_AGORA_WORKER_URL");
    const workerApiKey = Deno.env.get("VITE_AGORA_WORKER_API_KEY");
    if (!workerUrl || !workerApiKey) {
      return jsonResponse({ error: "Agora worker configuration missing" }, 500);
    }

    const allowedOrigin = "https://angelquangvu-funprofile.lovable.app";

    const workerRes = await fetch(`${workerUrl.replace(/\/$/, "")}/token/rtc`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": workerApiKey,
        Origin: allowedOrigin,
      },
      body: JSON.stringify({
        channel: channel_name,
        userAccount: user.id,
        role: "publisher",
        expireSeconds: 86400,
      }),
    });

    const workerPayload = await workerRes.json().catch(() => ({}));
    if (!workerRes.ok) {
      console.error("[AGORA-TOKEN] Worker error:", workerPayload);
      return jsonResponse(
        { error: workerPayload?.error || "Failed to issue Agora token" },
        workerRes.status,
      );
    }

    console.log(
      `[AGORA-TOKEN] Token issued for user ${user.id}, channel: ${channel_name}`,
    );

    // Map response to existing frontend format
    return jsonResponse({
      token: workerPayload.token,
      app_id: workerPayload.appId,
      channel: workerPayload.channel || channel_name,
      uid: workerPayload.userAccount || user.id,
      expires_at: workerPayload.expireAt,
    });
  } catch (error: unknown) {
    console.error("[AGORA-TOKEN] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ error: errorMessage }, 500);
  }
});
~~~

### FILE: supabase/functions/angel-inline/index.ts
~~~ts
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

type AngelInlineRequest = {
  conversation_id: string;
  prompt: string;
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function extractTextFromCompletion(data: any): string {
  const msg = data?.choices?.[0]?.message;
  if (!msg) return '';
  const c = msg.content;
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) {
    // Some providers return array segments
    return c.map((x) => (typeof x === 'string' ? x : x?.text || '')).join('').trim();
  }
  return '';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json(401, { error: 'Missing authorization header' });

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const lovableKey = Deno.env.get('LOVABLE_API_KEY');
    const angelBotUserId = Deno.env.get('ANGEL_BOT_USER_ID');

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      return json(500, { error: 'Supabase env not configured' });
    }
    if (!angelBotUserId) {
      return json(500, { error: 'ANGEL_BOT_USER_ID not configured' });
    }
    if (!lovableKey) {
      return json(500, { error: 'LOVABLE_API_KEY not configured' });
    }

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: userData, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !userData.user) return json(401, { error: 'Unauthorized' });
    const userId = userData.user.id;

    const body = (await req.json()) as AngelInlineRequest;
    const conversationId = body?.conversation_id;
    const prompt = (body?.prompt || '').trim();

    if (!conversationId || !prompt) return json(400, { error: 'Missing conversation_id or prompt' });
    if (prompt.length > 2000) return json(400, { error: 'Prompt too long' });

    // Verify membership
    const { data: participant, error: partErr } = await supabaseAdmin
      .from('conversation_participants')
      .select('id')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .is('left_at', null)
      .maybeSingle();
    if (partErr) return json(500, { error: partErr.message });
    if (!participant) return json(403, { error: 'Not a conversation participant' });

    // Basic rate-limit: 1 request / 5s per user per conversation
    const { data: recent, error: recentErr } = await supabaseAdmin
      .from('messages')
      .select('id, created_at')
      .eq('conversation_id', conversationId)
      .eq('sender_id', angelBotUserId)
      .gte('created_at', new Date(Date.now() - 5000).toISOString())
      .order('created_at', { ascending: false })
      .limit(1);
    if (recentErr) return json(500, { error: recentErr.message });
    if (recent && recent.length > 0) {
      return json(429, { error: 'Rate limited' });
    }

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content:
              'You are Angel AI for FUN Profile. Reply helpfully and concisely. Use Vietnamese unless user asks otherwise.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
      }),
    });

    if (!aiRes.ok) {
      const text = await aiRes.text().catch(() => '');
      return json(502, { error: 'AI request failed', details: text.slice(0, 400) });
    }

    const aiData = await aiRes.json();
    const reply = extractTextFromCompletion(aiData).trim();
    if (!reply) return json(502, { error: 'Empty AI response' });

    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: angelBotUserId,
        content: reply,
        media_urls: [],
        reply_to_id: null,
        message_type: 'system',
        metadata: { bot: 'angel', prompt },
      })
      .select('id')
      .single();

    if (insertErr) return json(500, { error: insertErr.message });

    return json(200, { ok: true, message_id: inserted.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[angel-inline]', msg);
    return json(500, { error: msg });
  }
});

~~~

### FILE: supabase/functions/live-token/index.ts
~~~ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type LiveRole = "host" | "audience" | "recorder";

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function badRequest(error: string, status = 400) {
  return jsonResponse({ error }, status);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return badRequest("Method not allowed", 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return badRequest("Authorization required", 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !supabaseAnonKey) {
      return badRequest("Supabase configuration missing", 500);
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) return badRequest("Invalid token", 401);

    const body = await req.json().catch(() => null) as { session_id?: string; sessionId?: string; role?: LiveRole } | null;
    const sessionId = body?.session_id || body?.sessionId;
    const role = body?.role;
    if (!sessionId) return badRequest("session_id is required");
    if (role !== "host" && role !== "audience" && role !== "recorder") return badRequest("role must be host, audience, or recorder");

    const { data: liveSession, error: sessionError } = await supabase
      .from("live_sessions")
      .select("id, host_user_id, status, agora_channel, channel_name, recording_uid")
      .eq("id", sessionId)
      .maybeSingle();

    if (sessionError) return badRequest(sessionError.message, 400);
    if (!liveSession) return badRequest("Live session not found", 404);

    const channel = liveSession.agora_channel || liveSession.channel_name;
    if (!channel) return badRequest("Live channel not configured", 400);

    if ((role === "host" || role === "recorder") && liveSession.host_user_id !== user.id) {
      return badRequest("Only host can request host/recorder token", 403);
    }
    if (role !== "recorder" && liveSession.status !== "live") {
      return badRequest("Live session has ended", 409);
    }
    const workerUrl = Deno.env.get("LIVE_AGORA_WORKER_URL") || Deno.env.get("VITE_AGORA_WORKER_URL");
    const workerApiKey = Deno.env.get("LIVE_AGORA_WORKER_API_KEY") || Deno.env.get("VITE_AGORA_WORKER_API_KEY");
    if (!workerUrl || !workerApiKey) {
      return badRequest("Live Agora worker configuration missing", 500);
    }

    const allowedOrigin = "https://angelquangvu-funprofile.lovable.app";

    const workerRes = await fetch(`${workerUrl.replace(/\/$/, "")}/token/rtc`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": workerApiKey,
        "Origin": allowedOrigin,
      },
      body: JSON.stringify({
        channel,
        userAccount: role === "recorder" ? String(liveSession.recording_uid || user.id) : user.id,
        role: (role === "host" || role === "recorder") ? "publisher" : "subscriber",
        expireSeconds: 3600,
      }),
    });

    const workerPayload = await workerRes.json().catch(() => ({}));
    if (!workerRes.ok) {
      return badRequest(workerPayload?.error || "Failed to issue Agora token", workerRes.status);
    }

    return jsonResponse({
      token: workerPayload.token,
      channel: workerPayload.channel || channel,
      uid: workerPayload.userAccount || user.id,
      appId: workerPayload.appId,
      expiresAt: workerPayload.expireAt,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return badRequest(message, 500);
  }
});
~~~

### FILE: supabase/migrations/20260210120000_chat_pins_search.sql
~~~sql
-- Chat Phase 1: Pins + Search indexes

-- Trigram extension for fast ILIKE/substring search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add pin columns to messages
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS pinned_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS pinned_by uuid NULL REFERENCES auth.users(id);

-- Index for pinned banner lookup per conversation
CREATE INDEX IF NOT EXISTS idx_messages_pinned
  ON public.messages (conversation_id, pinned_at DESC)
  WHERE pinned_at IS NOT NULL;

-- Search index on content (Phase 1 scope: search within a conversation)
CREATE INDEX IF NOT EXISTS idx_messages_content_trgm
  ON public.messages
  USING gin (content gin_trgm_ops);

-- RPC: pin/unpin (bypass message UPDATE RLS; enforces conversation membership)
CREATE OR REPLACE FUNCTION public.pin_message(p_message_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_conversation_id uuid;
BEGIN
  SELECT m.conversation_id INTO v_conversation_id
  FROM public.messages m
  WHERE m.id = p_message_id;

  IF v_conversation_id IS NULL THEN
    RAISE EXCEPTION 'Message not found';
  END IF;

  IF NOT public.is_conversation_participant(v_conversation_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not a conversation participant';
  END IF;

  UPDATE public.messages
  SET pinned_at = now(),
      pinned_by = auth.uid()
  WHERE id = p_message_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.unpin_message(p_message_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_conversation_id uuid;
BEGIN
  SELECT m.conversation_id INTO v_conversation_id
  FROM public.messages m
  WHERE m.id = p_message_id;

  IF v_conversation_id IS NULL THEN
    RAISE EXCEPTION 'Message not found';
  END IF;

  IF NOT public.is_conversation_participant(v_conversation_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not a conversation participant';
  END IF;

  UPDATE public.messages
  SET pinned_at = NULL,
      pinned_by = NULL
  WHERE id = p_message_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.pin_message(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unpin_message(uuid) TO authenticated;

~~~

### FILE: supabase/migrations/20260210120500_chat_block_report.sql
~~~sql
-- Chat Phase 1: Block & Report

-- 1) Blocks table
CREATE TABLE IF NOT EXISTS public.user_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(blocker_id, blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker ON public.user_blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked ON public.user_blocks(blocked_id);

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own blocks"
  ON public.user_blocks
  FOR ALL
  TO authenticated
  USING (blocker_id = auth.uid())
  WITH CHECK (blocker_id = auth.uid());

-- SECURITY DEFINER helper so other policies (e.g. messages INSERT) can detect blocks
-- in either direction without being limited by user_blocks RLS.
CREATE OR REPLACE FUNCTION public.has_block_between(p_user_a uuid, p_user_b uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_blocks ub
    WHERE (ub.blocker_id = p_user_a AND ub.blocked_id = p_user_b)
       OR (ub.blocker_id = p_user_b AND ub.blocked_id = p_user_a)
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_block_between(uuid, uuid) TO authenticated;

-- 2) Reports table (moderation feedback)
CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  conversation_id uuid NULL REFERENCES public.conversations(id) ON DELETE SET NULL,
  message_id uuid NULL REFERENCES public.messages(id) ON DELETE SET NULL,
  reason text NOT NULL,
  details text NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  created_at timestamptz DEFAULT now(),
  reviewed_at timestamptz NULL,
  reviewed_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_reports_reporter ON public.reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON public.reports(created_at DESC);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Reporter can create + view own
CREATE POLICY "Users can create reports"
  ON public.reports
  FOR INSERT
  TO authenticated
  WITH CHECK (reporter_id = auth.uid());

CREATE POLICY "Users can view own reports"
  ON public.reports
  FOR SELECT
  TO authenticated
  USING (reporter_id = auth.uid());

-- Admin can review
CREATE POLICY "Admins can review reports"
  ON public.reports
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3) Enforce DM block on message send: replace messages INSERT policy
DROP POLICY IF EXISTS "Users can send messages in their conversations" ON public.messages;

CREATE POLICY "Users can send messages in their conversations"
  ON public.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.is_conversation_participant(conversation_id, auth.uid())
    AND (
      (SELECT c.type FROM public.conversations c WHERE c.id = conversation_id) <> 'direct'
      OR NOT EXISTS (
        SELECT 1
        FROM public.conversation_participants cp
        WHERE cp.conversation_id = public.messages.conversation_id
          AND cp.user_id <> auth.uid()
          AND cp.left_at IS NULL
          AND public.has_block_between(auth.uid(), cp.user_id)
      )
    )
  );
~~~

### FILE: supabase/migrations/20260210121000_chat_stickers_edit.sql
~~~sql
-- Chat Phase 1: Stickers + Edit Message + Message metadata/type

-- 1) Messages columns
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS edited_at timestamptz NULL;

-- Basic index for filtering by type (optional but helps)
CREATE INDEX IF NOT EXISTS idx_messages_type
  ON public.messages (conversation_id, message_type, created_at DESC);

-- 2) Replace messages UPDATE policy to enforce:
-- - author-only
-- - edits only within 15 minutes for non-deleted text messages
-- - soft delete allowed anytime by author (is_deleted = true)
DROP POLICY IF EXISTS "Users can update their own messages" ON public.messages;

CREATE POLICY "Users can update their own messages"
  ON public.messages
  FOR UPDATE
  TO authenticated
  USING (sender_id = auth.uid())
  WITH CHECK (
    sender_id = auth.uid()
    AND (
      -- Soft delete: allow anytime
      is_deleted = true
      OR (
        -- Edit: only text messages, not deleted, within 15 minutes
        message_type = 'text'
        AND is_deleted = false
        AND now() - created_at <= interval '15 minutes'
      )
    )
  );

-- Optional hard DELETE: disable it for Phase 1 (keep as soft delete)
DROP POLICY IF EXISTS "Users can delete their own messages" ON public.messages;

-- 3) Stickers tables
CREATE TABLE IF NOT EXISTS public.sticker_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NULL,
  preview_url text NULL,
  is_premium boolean NOT NULL DEFAULT false,
  price numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stickers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id uuid NOT NULL REFERENCES public.sticker_packs(id) ON DELETE CASCADE,
  name text NOT NULL,
  url text NOT NULL,
  emoji text NULL,
  sort_order int NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_stickers_pack ON public.stickers(pack_id, sort_order);

-- Optional ownership table (premium packs)
CREATE TABLE IF NOT EXISTS public.user_sticker_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pack_id uuid NOT NULL REFERENCES public.sticker_packs(id) ON DELETE CASCADE,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, pack_id)
);

ALTER TABLE public.sticker_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stickers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sticker_packs ENABLE ROW LEVEL SECURITY;

-- Everyone can view sticker catalog
CREATE POLICY "Sticker packs are viewable"
  ON public.sticker_packs
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Stickers are viewable"
  ON public.stickers
  FOR SELECT
  TO authenticated
  USING (true);

-- Users can view their owned packs
CREATE POLICY "Users can view own sticker packs"
  ON public.user_sticker_packs
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can acquire packs for themselves (Phase 1)
CREATE POLICY "Users can insert own sticker packs"
  ON public.user_sticker_packs
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Seed 1 free pack + a few starter stickers (idempotent-ish via name)
DO $$
DECLARE
  v_pack_id uuid;
BEGIN
  SELECT id INTO v_pack_id FROM public.sticker_packs WHERE name = 'Fun Starter';
  IF v_pack_id IS NULL THEN
    INSERT INTO public.sticker_packs (name, description, preview_url, is_premium, price)
    VALUES ('Fun Starter', 'Free starter stickers', '/stickers/preview.svg', false, 0)
    RETURNING id INTO v_pack_id;
  END IF;

  -- Insert stickers if pack has none
  IF NOT EXISTS (SELECT 1 FROM public.stickers WHERE pack_id = v_pack_id) THEN
    INSERT INTO public.stickers (pack_id, name, url, emoji, sort_order) VALUES
      (v_pack_id, 'Hello', '/stickers/hello.svg', '👋', 1),
      (v_pack_id, 'Love',  '/stickers/love.svg',  '❤️', 2),
      (v_pack_id, 'Lol',   '/stickers/lol.svg',   '😂', 3),
      (v_pack_id, 'Wow',   '/stickers/wow.svg',   '😮', 4),
      (v_pack_id, 'Sad',   '/stickers/sad.svg',   '😢', 5),
      (v_pack_id, 'Angry', '/stickers/angry.svg', '😡', 6);
  END IF;
END $$;

~~~

### FILE: supabase/migrations/20260210121500_chat_red_envelope.sql
~~~sql
-- Chat Phase 1: Red Envelope (Li xi)

CREATE TABLE IF NOT EXISTS public.red_envelopes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  message_id uuid NULL REFERENCES public.messages(id) ON DELETE SET NULL,
  token text NOT NULL CHECK (token IN ('CAMLY','BNB')),
  total_amount numeric NOT NULL CHECK (total_amount > 0),
  total_count int NOT NULL CHECK (total_count > 0),
  remaining_amount numeric NOT NULL CHECK (remaining_amount >= 0),
  remaining_count int NOT NULL CHECK (remaining_count >= 0),
  expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','fully_claimed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_red_envelopes_conversation ON public.red_envelopes(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_red_envelopes_status ON public.red_envelopes(status);

CREATE TABLE IF NOT EXISTS public.red_envelope_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  envelope_id uuid NOT NULL REFERENCES public.red_envelopes(id) ON DELETE CASCADE,
  claimer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  claimed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(envelope_id, claimer_id)
);

CREATE INDEX IF NOT EXISTS idx_red_envelope_claims_envelope ON public.red_envelope_claims(envelope_id, claimed_at ASC);
CREATE INDEX IF NOT EXISTS idx_red_envelope_claims_claimer ON public.red_envelope_claims(claimer_id, claimed_at DESC);

ALTER TABLE public.red_envelopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.red_envelope_claims ENABLE ROW LEVEL SECURITY;

-- Envelopes visible to conversation members
CREATE POLICY "Users can view envelopes in their conversations"
  ON public.red_envelopes
  FOR SELECT
  TO authenticated
  USING (public.is_conversation_participant(conversation_id, auth.uid()));

CREATE POLICY "Users can create envelopes in their conversations"
  ON public.red_envelopes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    creator_id = auth.uid()
    AND public.is_conversation_participant(conversation_id, auth.uid())
  );

-- Claims visible to conversation members (via envelope)
CREATE POLICY "Users can view claims in their conversations"
  ON public.red_envelope_claims
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.red_envelopes e
      WHERE e.id = envelope_id
        AND public.is_conversation_participant(e.conversation_id, auth.uid())
    )
  );

-- Users can claim for themselves (insert is done via RPC; keep policy anyway)
CREATE POLICY "Users can insert own claims"
  ON public.red_envelope_claims
  FOR INSERT
  TO authenticated
  WITH CHECK (claimer_id = auth.uid());

-- Enable realtime (Phase 1 UX)
ALTER PUBLICATION supabase_realtime ADD TABLE public.red_envelopes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.red_envelope_claims;

-- Atomic claim function (random split)
CREATE OR REPLACE FUNCTION public.claim_red_envelope(p_envelope_id uuid)
RETURNS TABLE (amount numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_envelope public.red_envelopes%ROWTYPE;
  v_min numeric;
  v_decimals int;
  v_avg numeric;
  v_max numeric;
  v_cap numeric;
  v_amount numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_envelope
  FROM public.red_envelopes
  WHERE id = p_envelope_id
  FOR UPDATE;

  IF v_envelope.id IS NULL THEN
    RAISE EXCEPTION 'Envelope not found';
  END IF;

  IF NOT public.is_conversation_participant(v_envelope.conversation_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not a conversation participant';
  END IF;

  IF v_envelope.status <> 'active' OR v_envelope.expires_at <= now() THEN
    UPDATE public.red_envelopes
    SET status = CASE
      WHEN remaining_count <= 0 THEN 'fully_claimed'
      ELSE 'expired'
    END
    WHERE id = v_envelope.id;
    RAISE EXCEPTION 'Envelope expired or inactive';
  END IF;

  IF v_envelope.remaining_count <= 0 OR v_envelope.remaining_amount <= 0 THEN
    UPDATE public.red_envelopes SET status = 'fully_claimed' WHERE id = v_envelope.id;
    RAISE EXCEPTION 'Envelope fully claimed';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.red_envelope_claims
    WHERE envelope_id = v_envelope.id AND claimer_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Already claimed';
  END IF;

  -- Token precision + minimum unit
  IF v_envelope.token = 'BNB' THEN
    v_decimals := 8;
    v_min := 0.0001;
  ELSE
    v_decimals := 3;
    v_min := 0.001;
  END IF;

  IF v_envelope.remaining_count = 1 THEN
    v_amount := v_envelope.remaining_amount;
  ELSE
    v_avg := v_envelope.remaining_amount / v_envelope.remaining_count;
    v_max := v_envelope.remaining_amount - v_min * (v_envelope.remaining_count - 1);

    -- Typical hongbao: random in [min, 2*avg], but never exceed v_max
    v_cap := LEAST(v_max, GREATEST(v_min, 2 * v_avg));
    v_amount := v_min + (v_cap - v_min) * random();
  END IF;

  v_amount := LEAST(v_amount, v_envelope.remaining_amount);
  v_amount := round(v_amount, v_decimals);

  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid claim amount';
  END IF;

  INSERT INTO public.red_envelope_claims (envelope_id, claimer_id, amount)
  VALUES (v_envelope.id, auth.uid(), v_amount);

  UPDATE public.red_envelopes
  SET
    remaining_amount = remaining_amount - v_amount,
    remaining_count = remaining_count - 1,
    status = CASE
      WHEN remaining_count - 1 <= 0 OR remaining_amount - v_amount <= 0 THEN 'fully_claimed'
      ELSE status
    END
  WHERE id = v_envelope.id;

  RETURN QUERY SELECT v_amount;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_red_envelope(uuid) TO authenticated;

~~~

### FILE: supabase/migrations/20260210121800_chat_message_preview.sql
~~~sql
-- Chat Phase 1: Improve conversation preview for non-text message types

CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_preview text;
BEGIN
  -- Derive preview
  IF NEW.is_deleted = true THEN
    v_preview := '[Deleted]';
  ELSIF COALESCE(NEW.message_type, 'text') = 'sticker' THEN
    v_preview := '[Sticker]';
  ELSIF COALESCE(NEW.message_type, 'text') = 'red_envelope' THEN
    v_preview := '[Red Envelope]';
  ELSIF COALESCE(NEW.content, '') <> '' THEN
    v_preview := LEFT(NEW.content, 100);
  ELSIF (NEW.media_urls IS NOT NULL AND jsonb_array_length(NEW.media_urls) > 0) THEN
    v_preview := '[Attachment]';
  ELSE
    v_preview := '';
  END IF;

  UPDATE public.conversations
  SET
    last_message_at = NEW.created_at,
    last_message_preview = v_preview,
    updated_at = now()
  WHERE id = NEW.conversation_id;

  RETURN NEW;
END;
$$;

~~~

### FILE: supabase/migrations/20260211103000_live_sessions_mvp.sql
~~~sql
-- MVP In-app Livestream
-- 1) Extend posts to support live post cards
ALTER TABLE public.posts
ADD COLUMN IF NOT EXISTS post_type text NOT NULL DEFAULT 'text',
ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'posts_post_type_check'
      AND conrelid = 'public.posts'::regclass
  ) THEN
    ALTER TABLE public.posts
    ADD CONSTRAINT posts_post_type_check
    CHECK (post_type IN ('text', 'live'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_posts_post_type_created_at
ON public.posts(post_type, created_at DESC);

-- 2) Live sessions table
CREATE TABLE IF NOT EXISTS public.live_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  channel_name text NOT NULL UNIQUE,
  title text,
  privacy text NOT NULL DEFAULT 'public',
  status text NOT NULL DEFAULT 'live',
  viewer_count integer NOT NULL DEFAULT 0 CHECK (viewer_count >= 0),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  post_id uuid REFERENCES public.posts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT live_sessions_privacy_check CHECK (privacy IN ('public', 'friends')),
  CONSTRAINT live_sessions_status_check CHECK (status IN ('live', 'ended'))
);

CREATE INDEX IF NOT EXISTS idx_live_sessions_status_started_at
ON public.live_sessions(status, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_live_sessions_host_status
ON public.live_sessions(host_user_id, status, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_live_sessions_privacy_status
ON public.live_sessions(privacy, status, started_at DESC);

DROP TRIGGER IF EXISTS update_live_sessions_updated_at ON public.live_sessions;
CREATE TRIGGER update_live_sessions_updated_at
BEFORE UPDATE ON public.live_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Live sessions can be viewed by host/public/friends" ON public.live_sessions;
CREATE POLICY "Live sessions can be viewed by host/public/friends"
ON public.live_sessions
FOR SELECT
USING (
  host_user_id = auth.uid()
  OR privacy = 'public'
  OR (
    privacy = 'friends'
    AND auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.friendships f
      WHERE f.status = 'accepted'
        AND (
          (f.user_id = host_user_id AND f.friend_id = auth.uid())
          OR
          (f.friend_id = host_user_id AND f.user_id = auth.uid())
        )
    )
  )
);

DROP POLICY IF EXISTS "Hosts can create own live sessions" ON public.live_sessions;
CREATE POLICY "Hosts can create own live sessions"
ON public.live_sessions
FOR INSERT
WITH CHECK (host_user_id = auth.uid());

DROP POLICY IF EXISTS "Hosts can update own live sessions" ON public.live_sessions;
CREATE POLICY "Hosts can update own live sessions"
ON public.live_sessions
FOR UPDATE
USING (host_user_id = auth.uid())
WITH CHECK (host_user_id = auth.uid());
~~~

### FILE: supabase/migrations/20260211114000_live_recording_e2e.sql
~~~sql
-- Agora Cloud Recording E2E for livestream -> feed video

-- Ensure live_sessions structure exists and is compatible with recording workflow.
CREATE TABLE IF NOT EXISTS public.live_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_name text NOT NULL UNIQUE,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'live' CHECK (status IN ('live', 'ended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS channel_name text,
  ADD COLUMN IF NOT EXISTS started_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS ended_at timestamptz,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'live',
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Backfill owner_id from prior column host_user_id if table already existed.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'live_sessions'
      AND column_name = 'host_user_id'
  ) THEN
    UPDATE public.live_sessions
    SET owner_id = host_user_id
    WHERE owner_id IS NULL;
  END IF;
END
$$;

ALTER TABLE public.live_sessions
  ALTER COLUMN channel_name SET NOT NULL,
  ALTER COLUMN started_at SET NOT NULL,
  ALTER COLUMN owner_id SET NOT NULL,
  ALTER COLUMN status SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_live_sessions_channel_name_unique
ON public.live_sessions(channel_name);

CREATE INDEX IF NOT EXISTS idx_live_sessions_owner_status
ON public.live_sessions(owner_id, status, started_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'live_sessions_status_check'
      AND conrelid = 'public.live_sessions'::regclass
  ) THEN
    ALTER TABLE public.live_sessions
      ADD CONSTRAINT live_sessions_status_check CHECK (status IN ('live', 'ended'));
  END IF;
END
$$;

DROP TRIGGER IF EXISTS update_live_sessions_updated_at ON public.live_sessions;
CREATE TRIGGER update_live_sessions_updated_at
BEFORE UPDATE ON public.live_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Cloud recording lifecycle table
CREATE TABLE IF NOT EXISTS public.live_recordings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  live_id uuid NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  resource_id text NOT NULL,
  sid text NOT NULL,
  recorder_uid text NOT NULL,
  mode text NOT NULL DEFAULT 'composite' CHECK (mode IN ('composite')),
  status text NOT NULL DEFAULT 'recording' CHECK (status IN ('starting', 'recording', 'stopped', 'failed')),
  storage_vendor integer NOT NULL,
  storage_region integer NOT NULL,
  file_list_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  media_url text,
  error_message text,
  raw_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  stopped_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_live_recordings_live_created
ON public.live_recordings(live_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_live_recordings_status
ON public.live_recordings(status, created_at DESC);

-- Public feed archive table for recorded live videos
CREATE TABLE IF NOT EXISTS public.feed_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'video' CHECK (type IN ('video')),
  title text,
  caption text,
  media_key text,
  media_url text,
  source text NOT NULL DEFAULT 'agora_recording' CHECK (source IN ('agora_recording')),
  recording_id uuid NOT NULL REFERENCES public.live_recordings(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT feed_posts_media_ref_check CHECK (media_key IS NOT NULL OR media_url IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_feed_posts_created
ON public.feed_posts(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_feed_posts_author
ON public.feed_posts(author_id, created_at DESC);

ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_posts ENABLE ROW LEVEL SECURITY;

-- live_sessions policies
DROP POLICY IF EXISTS "Live sessions can be viewed by host/public/friends" ON public.live_sessions;
DROP POLICY IF EXISTS "Hosts can create own live sessions" ON public.live_sessions;
DROP POLICY IF EXISTS "Hosts can update own live sessions" ON public.live_sessions;

DROP POLICY IF EXISTS "Live sessions read by everyone" ON public.live_sessions;
CREATE POLICY "Live sessions read by everyone"
ON public.live_sessions
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Owners can create live sessions" ON public.live_sessions;
CREATE POLICY "Owners can create live sessions"
ON public.live_sessions
FOR INSERT
WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Owners or admins can update live sessions" ON public.live_sessions;
CREATE POLICY "Owners or admins can update live sessions"
ON public.live_sessions
FOR UPDATE
USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- live_recordings policies
DROP POLICY IF EXISTS "Owners or admins can read live recordings" ON public.live_recordings;
CREATE POLICY "Owners or admins can read live recordings"
ON public.live_recordings
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.live_sessions ls
    WHERE ls.id = live_id
      AND (ls.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
);

DROP POLICY IF EXISTS "Owners or admins can create live recordings" ON public.live_recordings;
CREATE POLICY "Owners or admins can create live recordings"
ON public.live_recordings
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.live_sessions ls
    WHERE ls.id = live_id
      AND (ls.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
);

DROP POLICY IF EXISTS "Owners or admins can update live recordings" ON public.live_recordings;
CREATE POLICY "Owners or admins can update live recordings"
ON public.live_recordings
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.live_sessions ls
    WHERE ls.id = live_id
      AND (ls.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.live_sessions ls
    WHERE ls.id = live_id
      AND (ls.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
);

-- feed_posts policies
DROP POLICY IF EXISTS "Feed posts are viewable by everyone" ON public.feed_posts;
CREATE POLICY "Feed posts are viewable by everyone"
ON public.feed_posts
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Authors or admins can create feed posts" ON public.feed_posts;
CREATE POLICY "Authors or admins can create feed posts"
ON public.feed_posts
FOR INSERT
WITH CHECK (author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authors or admins can update feed posts" ON public.feed_posts;
CREATE POLICY "Authors or admins can update feed posts"
ON public.feed_posts
FOR UPDATE
USING (author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
~~~

### FILE: supabase/migrations/20260211120000_chat_preview_on_update.sql
~~~sql
-- Phase 1: Keep conversation preview in sync when last message is edited / soft-deleted

-- Update preview only when the updated message is currently the latest by created_at in that conversation.
CREATE OR REPLACE FUNCTION public.update_conversation_last_message_on_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_last_id uuid;
  v_preview text;
BEGIN
  SELECT m.id INTO v_last_id
  FROM public.messages m
  WHERE m.conversation_id = NEW.conversation_id
  ORDER BY m.created_at DESC
  LIMIT 1;

  IF v_last_id IS NULL OR v_last_id <> NEW.id THEN
    RETURN NEW;
  END IF;

  -- Derive preview (same rules as chat_message_preview migration, but for UPDATE).
  IF NEW.is_deleted = true THEN
    v_preview := '[Deleted]';
  ELSIF COALESCE(NEW.message_type, 'text') = 'sticker' THEN
    v_preview := '[Sticker]';
  ELSIF COALESCE(NEW.message_type, 'text') = 'red_envelope' THEN
    v_preview := '[Red Envelope]';
  ELSIF COALESCE(NEW.content, '') <> '' THEN
    v_preview := LEFT(NEW.content, 100);
  ELSIF (NEW.media_urls IS NOT NULL AND jsonb_array_length(NEW.media_urls) > 0) THEN
    v_preview := '[Attachment]';
  ELSE
    v_preview := '';
  END IF;

  UPDATE public.conversations
  SET
    last_message_at = NEW.created_at,
    last_message_preview = v_preview,
    updated_at = now()
  WHERE id = NEW.conversation_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_message_update_preview ON public.messages;
CREATE TRIGGER on_message_update_preview
  AFTER UPDATE ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_conversation_last_message_on_update();
~~~

### FILE: supabase/migrations/20260211121000_live_recording_alignment.sql
~~~sql
-- Align live_sessions schema to Agora Cloud Recording quickstart requirements

ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS host_user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS agora_uid_host integer,
  ADD COLUMN IF NOT EXISTS recording_uid integer,
  ADD COLUMN IF NOT EXISTS resource_id text,
  ADD COLUMN IF NOT EXISTS sid text,
  ADD COLUMN IF NOT EXISTS recording_status text NOT NULL DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS recording_acquired_at timestamptz;

-- Backfill host_user_id from owner_id if present
UPDATE public.live_sessions
SET host_user_id = owner_id
WHERE host_user_id IS NULL
  AND owner_id IS NOT NULL;

ALTER TABLE public.live_sessions
  ALTER COLUMN host_user_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'live_sessions_recording_status_check'
      AND conrelid = 'public.live_sessions'::regclass
  ) THEN
    ALTER TABLE public.live_sessions
      ADD CONSTRAINT live_sessions_recording_status_check
      CHECK (recording_status IN ('idle', 'acquired', 'recording', 'stopped', 'failed'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_live_sessions_recording_status
ON public.live_sessions(recording_status, created_at DESC);

-- Sensitive recording internals should not be selected by generic clients.
REVOKE SELECT(resource_id, sid) ON public.live_sessions FROM anon, authenticated;
GRANT SELECT(resource_id, sid) ON public.live_sessions TO service_role;

-- Public audience can only read active live rows (without sensitive columns).
DROP POLICY IF EXISTS "Live sessions read by everyone" ON public.live_sessions;
CREATE POLICY "Live sessions read active"
ON public.live_sessions
FOR SELECT
USING (
  status = 'live'
  OR host_user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
);

-- Host create/update guard
DROP POLICY IF EXISTS "Owners can create live sessions" ON public.live_sessions;
CREATE POLICY "Hosts can create own sessions"
ON public.live_sessions
FOR INSERT
WITH CHECK (host_user_id = auth.uid());

DROP POLICY IF EXISTS "Owners or admins can update live sessions" ON public.live_sessions;
CREATE POLICY "Hosts or admins can update sessions"
ON public.live_sessions
FOR UPDATE
USING (host_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (host_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

~~~

### FILE: supabase/migrations/20260215010000_live_stream_mvp_phase0.sql
~~~sql
-- Live Streaming MVP (phase 0 + reactions) additive migration

-- 1) live_sessions compatibility: add agora_channel, keep channel_name
ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS agora_channel text;

UPDATE public.live_sessions
SET agora_channel = channel_name
WHERE agora_channel IS NULL
  AND channel_name IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_live_sessions_agora_channel_unique
ON public.live_sessions(agora_channel)
WHERE agora_channel IS NOT NULL;

-- 2) live_messages table
CREATE TABLE IF NOT EXISTS public.live_messages (
  id bigserial PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_live_messages_session_created_at
ON public.live_messages(session_id, created_at);

-- 3) live_reactions table
CREATE TABLE IF NOT EXISTS public.live_reactions (
  id bigserial PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_live_reactions_session_created_at
ON public.live_reactions(session_id, created_at);

-- 4) RLS
ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view live sessions" ON public.live_sessions;
DROP POLICY IF EXISTS "Live sessions read by everyone" ON public.live_sessions;
CREATE POLICY "Live sessions read by everyone"
ON public.live_sessions
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Host can create live sessions" ON public.live_sessions;
DROP POLICY IF EXISTS "Hosts can create own live sessions" ON public.live_sessions;
DROP POLICY IF EXISTS "Owners can create live sessions" ON public.live_sessions;
DROP POLICY IF EXISTS "Hosts can create own sessions" ON public.live_sessions;
CREATE POLICY "Hosts can create own live sessions"
ON public.live_sessions
FOR INSERT
WITH CHECK (host_user_id = auth.uid());

DROP POLICY IF EXISTS "Host can update own live sessions" ON public.live_sessions;
DROP POLICY IF EXISTS "Hosts can update own live sessions" ON public.live_sessions;
DROP POLICY IF EXISTS "Owners or admins can update live sessions" ON public.live_sessions;
DROP POLICY IF EXISTS "Hosts or admins can update sessions" ON public.live_sessions;
CREATE POLICY "Hosts can update own live sessions"
ON public.live_sessions
FOR UPDATE
USING (host_user_id = auth.uid())
WITH CHECK (host_user_id = auth.uid());

DROP POLICY IF EXISTS "Anyone can view live messages" ON public.live_messages;
CREATE POLICY "Anyone can view live messages"
ON public.live_messages
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert live messages" ON public.live_messages;
CREATE POLICY "Authenticated users can insert live messages"
ON public.live_messages
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can view live reactions" ON public.live_reactions;
CREATE POLICY "Anyone can view live reactions"
ON public.live_reactions
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert live reactions" ON public.live_reactions;
CREATE POLICY "Authenticated users can insert live reactions"
ON public.live_reactions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 5) Realtime publication (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'live_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.live_messages;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'live_reactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.live_reactions;
  END IF;
END
$$;
~~~

### FILE: supabase/migrations/20260215173000_live_replay_backfill.sql
~~~sql
-- Backfill playback_url for ended live posts from latest live_recordings.media_url

WITH latest_recordings AS (
  SELECT
    ls.id AS live_id,
    ls.post_id,
    lr.media_url,
    ROW_NUMBER() OVER (PARTITION BY ls.id ORDER BY lr.created_at DESC) AS rn
  FROM public.live_sessions ls
  JOIN public.live_recordings lr ON lr.live_id = ls.id
  WHERE ls.status = 'ended'
    AND ls.post_id IS NOT NULL
    AND lr.media_url IS NOT NULL
    AND lr.media_url <> ''
)
UPDATE public.posts p
SET metadata = jsonb_set(
  jsonb_set(
    COALESCE(p.metadata::jsonb, '{}'::jsonb),
    '{playback_url}',
    to_jsonb(lat.media_url),
    true
  ),
  '{live_status}',
  to_jsonb('ended'::text),
  true
)
FROM latest_recordings lat
WHERE lat.rn = 1
  AND p.id = lat.post_id
  AND (
    (COALESCE(p.metadata::jsonb, '{}'::jsonb) ->> 'playback_url') IS NULL
    OR (COALESCE(p.metadata::jsonb, '{}'::jsonb) ->> 'playback_url') = ''
  );

WITH latest_recordings AS (
  SELECT
    ls.id AS live_id,
    lr.media_url,
    ROW_NUMBER() OVER (PARTITION BY ls.id ORDER BY lr.created_at DESC) AS rn
  FROM public.live_sessions ls
  JOIN public.live_recordings lr ON lr.live_id = ls.id
  WHERE ls.status = 'ended'
    AND lr.media_url IS NOT NULL
    AND lr.media_url <> ''
)
UPDATE public.live_sessions ls
SET recording_status = 'stopped',
    updated_at = now()
FROM latest_recordings lat
WHERE lat.rn = 1
  AND ls.id = lat.live_id
  AND COALESCE(ls.recording_status, 'idle') <> 'stopped';
~~~

### FILE: supabase/migrations/20260215194000_live_recording_rpc_no_service_role.sql
~~~sql
-- Live recording no-service-role architecture for Lovable Cloud

ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS recording_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS recording_stopped_at timestamptz,
  ADD COLUMN IF NOT EXISTS recording_ready_at timestamptz,
  ADD COLUMN IF NOT EXISTS recording_error text,
  ADD COLUMN IF NOT EXISTS last_worker_response jsonb DEFAULT '{}'::jsonb;

ALTER TABLE public.live_recordings
  ADD COLUMN IF NOT EXISTS duration_seconds integer,
  ADD COLUMN IF NOT EXISTS thumbnail_url text;

ALTER TABLE public.live_recordings
  DROP CONSTRAINT IF EXISTS live_recordings_status_check;

ALTER TABLE public.live_recordings
  ADD CONSTRAINT live_recordings_status_check
  CHECK (status IN ('starting', 'recording', 'stopping', 'processing', 'ready', 'stopped', 'failed'));

ALTER TABLE public.live_sessions
  DROP CONSTRAINT IF EXISTS live_sessions_recording_status_check;

ALTER TABLE public.live_sessions
  ADD CONSTRAINT live_sessions_recording_status_check
  CHECK (recording_status IN ('idle', 'acquired', 'acquiring', 'starting', 'recording', 'stopping', 'processing', 'ready', 'stopped', 'failed'));

CREATE OR REPLACE FUNCTION public.get_live_recording_context(_session_id uuid)
RETURNS TABLE (
  id uuid,
  host_user_id uuid,
  channel_name text,
  agora_channel text,
  resource_id text,
  sid text,
  recording_uid integer,
  recording_status text,
  recording_started_at timestamptz,
  recording_stopped_at timestamptz,
  recording_ready_at timestamptz,
  recording_error text,
  last_worker_response jsonb,
  post_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ls.id,
    ls.host_user_id,
    ls.channel_name,
    ls.agora_channel,
    ls.resource_id,
    ls.sid,
    ls.recording_uid,
    ls.recording_status,
    ls.recording_started_at,
    ls.recording_stopped_at,
    ls.recording_ready_at,
    ls.recording_error,
    COALESCE(ls.last_worker_response, '{}'::jsonb),
    ls.post_id
  FROM public.live_sessions ls
  WHERE ls.id = _session_id
    AND (
      ls.host_user_id = auth.uid()
      OR public.has_role(auth.uid(), 'admin'::app_role)
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_live_recording_context(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_live_recording_context(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_live_recording_state(
  _session_id uuid,
  _recording_status text DEFAULT NULL,
  _resource_id text DEFAULT NULL,
  _sid text DEFAULT NULL,
  _recording_uid integer DEFAULT NULL,
  _recording_started_at timestamptz DEFAULT NULL,
  _recording_stopped_at timestamptz DEFAULT NULL,
  _recording_ready_at timestamptz DEFAULT NULL,
  _recording_error text DEFAULT NULL,
  _last_worker_response jsonb DEFAULT NULL
)
RETURNS public.live_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.live_sessions;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.live_sessions ls
    WHERE ls.id = _session_id
      AND (
        ls.host_user_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin'::app_role)
      )
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.live_sessions ls
  SET
    recording_status = COALESCE(_recording_status, ls.recording_status),
    resource_id = COALESCE(_resource_id, ls.resource_id),
    sid = COALESCE(_sid, ls.sid),
    recording_uid = COALESCE(_recording_uid, ls.recording_uid),
    recording_started_at = COALESCE(_recording_started_at, ls.recording_started_at),
    recording_stopped_at = COALESCE(_recording_stopped_at, ls.recording_stopped_at),
    recording_ready_at = COALESCE(_recording_ready_at, ls.recording_ready_at),
    recording_error = COALESCE(_recording_error, ls.recording_error),
    last_worker_response = COALESCE(_last_worker_response, ls.last_worker_response),
    updated_at = now()
  WHERE ls.id = _session_id
  RETURNING ls.* INTO _row;

  RETURN _row;
END;
$$;

REVOKE ALL ON FUNCTION public.set_live_recording_state(uuid, text, text, text, integer, timestamptz, timestamptz, timestamptz, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_live_recording_state(uuid, text, text, text, integer, timestamptz, timestamptz, timestamptz, text, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.upsert_live_recording_row(
  _session_id uuid,
  _resource_id text DEFAULT NULL,
  _sid text DEFAULT NULL,
  _recorder_uid text DEFAULT NULL,
  _status text DEFAULT NULL,
  _file_list_json jsonb DEFAULT NULL,
  _media_url text DEFAULT NULL,
  _raw_response jsonb DEFAULT NULL,
  _stopped_at timestamptz DEFAULT NULL,
  _duration_seconds integer DEFAULT NULL,
  _thumbnail_url text DEFAULT NULL
)
RETURNS public.live_recordings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _live public.live_sessions;
  _latest_id uuid;
  _row public.live_recordings;
BEGIN
  SELECT * INTO _live
  FROM public.live_sessions ls
  WHERE ls.id = _session_id
    AND (
      ls.host_user_id = auth.uid()
      OR public.has_role(auth.uid(), 'admin'::app_role)
    );

  IF _live.id IS NULL THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT lr.id INTO _latest_id
  FROM public.live_recordings lr
  WHERE lr.live_id = _session_id
  ORDER BY lr.created_at DESC
  LIMIT 1;

  IF _latest_id IS NULL THEN
    INSERT INTO public.live_recordings (
      live_id,
      resource_id,
      sid,
      recorder_uid,
      status,
      file_list_json,
      media_url,
      raw_response,
      stopped_at,
      duration_seconds,
      thumbnail_url
    ) VALUES (
      _session_id,
      _resource_id,
      _sid,
      _recorder_uid,
      COALESCE(_status, 'recording'),
      COALESCE(_file_list_json, '[]'::jsonb),
      _media_url,
      _raw_response,
      _stopped_at,
      _duration_seconds,
      _thumbnail_url
    ) RETURNING * INTO _row;
  ELSE
    UPDATE public.live_recordings lr
    SET
      resource_id = COALESCE(_resource_id, lr.resource_id),
      sid = COALESCE(_sid, lr.sid),
      recorder_uid = COALESCE(_recorder_uid, lr.recorder_uid),
      status = COALESCE(_status, lr.status),
      file_list_json = COALESCE(_file_list_json, lr.file_list_json),
      media_url = COALESCE(_media_url, lr.media_url),
      raw_response = COALESCE(_raw_response, lr.raw_response),
      stopped_at = COALESCE(_stopped_at, lr.stopped_at),
      duration_seconds = COALESCE(_duration_seconds, lr.duration_seconds),
      thumbnail_url = COALESCE(_thumbnail_url, lr.thumbnail_url)
    WHERE lr.id = _latest_id
    RETURNING lr.* INTO _row;
  END IF;

  RETURN _row;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_live_recording_row(uuid, text, text, text, text, jsonb, text, jsonb, timestamptz, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_live_recording_row(uuid, text, text, text, text, jsonb, text, jsonb, timestamptz, integer, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.attach_live_replay_to_post(
  _session_id uuid,
  _playback_url text,
  _duration_seconds integer DEFAULT NULL,
  _thumbnail_url text DEFAULT NULL
)
RETURNS public.live_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _live public.live_sessions;
  _metadata jsonb;
BEGIN
  SELECT * INTO _live
  FROM public.live_sessions ls
  WHERE ls.id = _session_id
    AND (
      ls.host_user_id = auth.uid()
      OR public.has_role(auth.uid(), 'admin'::app_role)
    );

  IF _live.id IS NULL THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF _live.post_id IS NOT NULL THEN
    SELECT COALESCE(p.metadata::jsonb, '{}'::jsonb)
    INTO _metadata
    FROM public.posts p
    WHERE p.id = _live.post_id;

    _metadata := _metadata
      || jsonb_build_object('playback_url', _playback_url)
      || jsonb_build_object('live_status', 'ended')
      || jsonb_build_object('replay_ready_at', now());

    IF _duration_seconds IS NOT NULL THEN
      _metadata := _metadata || jsonb_build_object('duration_seconds', _duration_seconds);
    END IF;

    IF _thumbnail_url IS NOT NULL THEN
      _metadata := _metadata || jsonb_build_object('thumbnail_url', _thumbnail_url);
    END IF;

    UPDATE public.posts p
    SET
      metadata = _metadata,
      video_url = COALESCE(_playback_url, p.video_url)
    WHERE p.id = _live.post_id;
  END IF;

  UPDATE public.live_sessions ls
  SET
    recording_status = CASE WHEN _playback_url IS NULL OR _playback_url = '' THEN 'failed' ELSE 'ready' END,
    recording_ready_at = CASE WHEN _playback_url IS NULL OR _playback_url = '' THEN ls.recording_ready_at ELSE now() END,
    recording_error = CASE WHEN _playback_url IS NULL OR _playback_url = '' THEN COALESCE(ls.recording_error, 'Playback URL missing') ELSE NULL END,
    updated_at = now()
  WHERE ls.id = _session_id
  RETURNING ls.* INTO _live;

  RETURN _live;
END;
$$;

REVOKE ALL ON FUNCTION public.attach_live_replay_to_post(uuid, text, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.attach_live_replay_to_post(uuid, text, integer, text) TO authenticated;
~~~

### FILE: worker/package.json
~~~json
{
  "name": "fun-agora-rtc-token",
  "version": "1.0.0",
  "description": "Cloudflare Worker for generating Agora RTC tokens with userAccount support",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "tail": "wrangler tail"
  },
  "dependencies": {
    "agora-token": "^2.0.3"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20241112.0",
    "typescript": "^5.6.3",
    "wrangler": "^3.91.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
~~~

### FILE: worker/README.md
~~~md
# Fun Agora RTC Token Service

## Cloud Recording env (required)

Set these secrets for `/recording/acquire|start|stop|query`:

- `AGORA_APP_ID`
- `AGORA_CUSTOMER_ID`
- `AGORA_CUSTOMER_SECRET`
- `API_KEY`
- `R2_BUCKET`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_REGION`
- `R2_ENDPOINT` (e.g. `https://<accountid>.r2.cloudflarestorage.com`)
- `RECORDING_PLAYBACK_BASE_URL`

Cloudflare Worker để generate Agora RTC tokens cho ứng dụng Fun Profile.

## 🚀 Quick Start

### 1. Cài đặt dependencies

```bash
cd worker
npm install
```

### 2. Cấu hình Secrets

```bash
# Agora credentials (lấy từ Agora Console)
wrangler secret put AGORA_APP_ID
# Nhập App ID khi được hỏi

wrangler secret put AGORA_APP_CERTIFICATE
# Nhập App Certificate khi được hỏi

# API key để bảo vệ endpoint (tạo một key mạnh 32+ ký tự)
wrangler secret put API_KEY
# Nhập API key khi được hỏi
```

### 3. Local Development

```bash
npm run dev
```

Worker sẽ chạy tại `http://localhost:8787`

### 4. Deploy to Production

```bash
npm run deploy
```

Worker sẽ được deploy tại: `https://fun-agora-rtc-token.<your-subdomain>.workers.dev`

---

## 📡 API Reference

### GET /health

Health check endpoint.

**Response:**
```json
{
  "ok": true,
  "service": "fun-agora-rtc-token",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### GET /config

Trả về public configuration (không bao gồm secrets).

**Response:**
```json
{
  "appId": "your_app_id",
  "allowedOrigin": "https://angelquangvu-funprofile.lovable.app",
  "defaultTtlSeconds": 3600
}
```

### POST /token/rtc

Generate RTC token cho Agora Video Calling.

**Headers:**
```
Content-Type: application/json
x-api-key: <YOUR_API_KEY>
```

**Request Body:**
```json
{
  "channel": "my-channel",
  "userAccount": "user-123",
  "role": "publisher",
  "expireSeconds": 3600
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| channel | string | Yes | Channel name (1-64 chars, alphanumeric, _, -) |
| userAccount | string | Yes | User account/UID (1-128 chars) |
| role | string | No | "publisher" (default) or "subscriber" |
| expireSeconds | number | No | Token TTL in seconds (60-86400, default: 3600) |

**Success Response (200):**
```json
{
  "appId": "your_app_id",
  "token": "007eJxTYBBx...",
  "channel": "my-channel",
  "userAccount": "user-123",
  "role": "publisher",
  "expireAt": 1705316400
}
```

**Error Responses:**

| Status | Description |
|--------|-------------|
| 400 | Invalid request (missing/invalid fields) |
| 401 | Missing or invalid API key |
| 403 | Origin not allowed |
| 429 | Rate limit exceeded |
| 500 | Internal server error |

---

## 🔌 Frontend Integration

### Trong Lovable App (React/TypeScript)

```typescript
// src/utils/agoraToken.ts

const AGORA_WORKER_URL = 'https://fun-agora-rtc-token.<your-subdomain>.workers.dev';
const API_KEY = import.meta.env.VITE_AGORA_WORKER_API_KEY; // Lưu trong .env

export interface AgoraTokenResponse {
  appId: string;
  token: string;
  channel: string;
  userAccount: string;
  role: string;
  expireAt: number;
}

export async function getAgoraToken(
  channel: string,
  userAccount: string,
  role: 'publisher' | 'subscriber' = 'publisher'
): Promise<AgoraTokenResponse> {
  const response = await fetch(`${AGORA_WORKER_URL}/token/rtc`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
    },
    body: JSON.stringify({
      channel,
      userAccount,
      role,
      expireSeconds: 3600,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get Agora token');
  }

  return response.json();
}
```

### Sử dụng với Agora Web SDK

```typescript
import AgoraRTC from 'agora-rtc-sdk-ng';
import { getAgoraToken } from './utils/agoraToken';

async function joinChannel(channelName: string, userId: string) {
  // 1. Get token from worker
  const { appId, token, userAccount } = await getAgoraToken(channelName, userId);

  // 2. Create Agora client
  const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });

  // 3. Join channel with string userAccount
  await client.join(appId, channelName, token, userAccount);

  // 4. Create and publish tracks
  const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
  await client.publish([audioTrack, videoTrack]);

  console.log('Joined channel successfully!');
}
```

---

## 🔒 Security

### CORS
- Chỉ cho phép requests từ: `https://angelquangvu-funprofile.lovable.app`

### API Key
- Bắt buộc header `x-api-key` cho endpoint `/token/rtc`
- Khuyến nghị: Sử dụng key mạnh (32+ ký tự random)

### Rate Limiting
- Best-effort in-memory rate limit: 60 requests/minute per IP
- **Production**: Nên enable Cloudflare Rate Limiting Rules

### Secrets
- `AGORA_APP_CERTIFICATE` không bao giờ được trả về cho client
- Chỉ lưu trữ trong Cloudflare Secrets

---

## 🛠 Configuration

### wrangler.toml

| Variable | Description |
|----------|-------------|
| ALLOWED_ORIGIN | Domain được phép gọi API |
| TOKEN_TTL_SECONDS | Default TTL cho token (giây) |

### Secrets (wrangler secret put)

| Secret | Description |
|--------|-------------|
| AGORA_APP_ID | Agora Application ID |
| AGORA_APP_CERTIFICATE | Agora App Certificate |
| API_KEY | API key để authenticate requests |

---

## 📊 Monitoring

### View Logs

```bash
npm run tail
```

### Metrics

Truy cập Cloudflare Dashboard > Workers & Pages > fun-agora-rtc-token > Metrics

---

## 🧪 Testing with cURL

### Health Check
```bash
curl https://fun-agora-rtc-token.<subdomain>.workers.dev/health
```

### Get Config
```bash
curl https://fun-agora-rtc-token.<subdomain>.workers.dev/config
```

### Generate Token
```bash
curl -X POST https://fun-agora-rtc-token.<subdomain>.workers.dev/token/rtc \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Origin: https://angelquangvu-funprofile.lovable.app" \
  -d '{
    "channel": "test-channel",
    "userAccount": "user-123",
    "role": "publisher",
    "expireSeconds": 3600
  }'
```

---

## 📝 License

Private - Fun Profile Team
~~~

### FILE: worker/src/cors.ts
~~~ts
/**
 * CORS Middleware for Cloudflare Worker
 * Supports multiple allowed origins (comma-separated)
 */

export interface Env {
  ALLOWED_ORIGINS: string; // Comma-separated list of allowed origins
  TOKEN_TTL_SECONDS: string;
  AGORA_APP_ID: string;
  AGORA_APP_CERTIFICATE: string;
  API_KEY: string;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  RECORDINGS_BUCKET: R2Bucket;
  // Agora REST API (Cloud Recording)
  AGORA_CUSTOMER_ID: string;
  AGORA_CUSTOMER_SECRET: string;
  // R2 (S3-compatible storage)
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  R2_BUCKET: string;
  R2_REGION: string;
  R2_ENDPOINT: string;
  R2_ACCOUNT_ID?: string;
  // Playback
  RECORDING_PLAYBACK_BASE_URL: string;
}

/**
 * Parse allowed origins from env (comma-separated)
 */
function parseAllowedOrigins(env: Env): string[] {
  return env.ALLOWED_ORIGINS.split(',').map(o => o.trim());
}

/**
 * Check if origin is in allowed list
 */
function isOriginAllowed(origin: string, env: Env): boolean {
  const allowedOrigins = parseAllowedOrigins(env);
  return allowedOrigins.includes(origin);
}

/**
 * Generate CORS headers for responses
 * Echoes back the allowed origin for proper CORS support
 */
export function corsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-api-key, x-correlation-id, Authorization, X-Stream-Id, X-Filename',
    'Access-Control-Max-Age': '86400',
  };
}

/**
 * Handle CORS preflight and origin validation
 * Returns Response if request should be blocked or is preflight
 * Returns { origin } if request should continue
 */
export function handleCors(request: Request, env: Env): Response | { origin: string } {
  const origin = request.headers.get('Origin');
  
  // For non-browser requests (no Origin header), allow if it's a health check
  if (!origin) {
    const url = new URL(request.url);
    if (url.pathname === '/health' || url.pathname === '/config') {
      return { origin: '*' }; // Allow health/config checks without origin
    }
    // For token requests, origin is required
    return new Response(
      JSON.stringify({ error: 'Origin header required' }),
      {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }

  // Check if origin is allowed
  if (!isOriginAllowed(origin, env)) {
    return new Response(
      JSON.stringify({ error: 'Origin not allowed' }),
      {
        status: 403,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }

  // Handle OPTIONS preflight request
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(origin),
    });
  }

  // Request is allowed, return origin for use in response headers
  return { origin };
}

/**
 * Add CORS headers to a response
 */
export function addCorsHeaders(response: Response, origin: string): Response {
  const newHeaders = new Headers(response.headers);
  const cors = corsHeaders(origin);
  
  for (const [key, value] of Object.entries(cors)) {
    newHeaders.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}
~~~

### FILE: worker/src/index.ts
~~~ts
/**
 * Cloudflare Worker - Agora RTC Token Service
 * 
 * Generates secure RTC tokens for Agora Video Calling using userAccount (string UID)
 * 
 * Endpoints:
 * - GET /health - Health check
 * - GET /config - Public configuration
 * - POST /token/rtc - Generate RTC token
 */

import { RtcTokenBuilder, RtcRole } from 'agora-token';
import { Env, handleCors, corsHeaders } from './cors';
import { validateTokenRequest } from './validate';
import { handleRecordingAcquire, handleRecordingQuery, handleRecordingStart, handleRecordingStop } from './recording';
import { handleLiveRecordingUpload } from './upload';

// Re-export Env type
export type { Env };

// Rate limiting: in-memory store (best-effort, resets on worker restart)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 60; // 60 requests per minute

/**
 * Check rate limit for an IP address
 */
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    // Start new window
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false; // Rate limit exceeded
  }

  entry.count++;
  return true;
}

/**
 * Clean up expired rate limit entries (run periodically)
 */
function cleanupRateLimitMap(): void {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap.entries()) {
    if (now > entry.resetAt) {
      rateLimitMap.delete(ip);
    }
  }
}

/**
 * Generate a unique request ID for logging
 */
function generateRequestId(): string {
  return crypto.randomUUID().slice(0, 8);
}

/**
 * Create a JSON error response
 */
function errorResponse(message: string, status: number, origin: string): Response {
  return new Response(
    JSON.stringify({ error: message }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(origin),
      },
    }
  );
}

/**
 * Create a JSON success response
 */
function jsonResponse(data: Record<string, unknown>, origin: string): Response {
  return new Response(
    JSON.stringify(data),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(origin),
      },
    }
  );
}

/**
 * Handle GET /health endpoint
 */
function handleHealth(origin: string): Response {
  return jsonResponse({
    ok: true,
    service: 'fun-agora-rtc-token',
    timestamp: new Date().toISOString(),
  }, origin);
}

/**
 * Handle GET /config endpoint
 */
function handleConfig(env: Env, origin: string): Response {
  return jsonResponse({
    appId: env.AGORA_APP_ID,
    allowedOrigins: env.ALLOWED_ORIGINS,
    defaultTtlSeconds: parseInt(env.TOKEN_TTL_SECONDS) || 3600,
  }, origin);
}

/**
 * Handle POST /token/rtc endpoint
 */
async function handleTokenRequest(request: Request, env: Env, requestId: string, origin: string): Promise<Response> {
  // Check API key
  const apiKey = request.headers.get('x-api-key');
  if (!apiKey || apiKey !== env.API_KEY) {
    console.log(`[${requestId}] Invalid or missing API key`);
    return errorResponse('Missing or invalid API key', 401, origin);
  }

  // Parse request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON in request body', 400, origin);
  }

  // Validate request
  const defaultTtl = parseInt(env.TOKEN_TTL_SECONDS) || 3600;
  const validation = validateTokenRequest(body, defaultTtl);

  if (!validation.valid || !validation.data) {
    return errorResponse(validation.error || 'Invalid request', 400, origin);
  }

  const { channel, userAccount, role, expireSeconds } = validation.data;

  try {
    // Calculate expiration timestamp
    const expireAt = Math.floor(Date.now() / 1000) + expireSeconds;

    // Generate RTC token using agora-token library
    const agoraRole = role === 'publisher' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
    
    const token = RtcTokenBuilder.buildTokenWithUserAccount(
      env.AGORA_APP_ID,
      env.AGORA_APP_CERTIFICATE,
      channel,
      userAccount,
      agoraRole,
      expireSeconds,
      expireSeconds
    );

    console.log(`[${requestId}] Token generated for channel: ${channel}, userAccount: ${userAccount.substring(0, 8)}...`);

    return jsonResponse({
      appId: env.AGORA_APP_ID,
      token,
      channel,
      userAccount,
      role,
      expireAt,
    }, origin);

  } catch (error) {
    console.error(`[${requestId}] Token generation error:`, error instanceof Error ? error.message : 'Unknown error');
    return errorResponse('Internal server error', 500, origin);
  }
}

/**
 * Main request handler
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const requestId = generateRequestId();
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // Cleanup rate limit map periodically (1% chance per request)
    if (Math.random() < 0.01) {
      cleanupRateLimitMap();
    }

    console.log(`[${requestId}] ${method} ${path}`);

    // Handle CORS - returns Response if blocked/preflight, or { origin } if allowed
    const corsResult = handleCors(request, env);
    if (corsResult instanceof Response) {
      return corsResult;
    }
    
    const { origin } = corsResult;

    // Rate limiting (get IP from CF headers)
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (!checkRateLimit(clientIP)) {
      console.log(`[${requestId}] Rate limit exceeded for IP: ${clientIP.substring(0, 10)}...`);
      return errorResponse('Rate limit exceeded. Try again later.', 429, origin);
    }

    // Route handling
    try {
      // GET /health
      if (method === 'GET' && path === '/health') {
        return handleHealth(origin);
      }

      // GET /config
      if (method === 'GET' && path === '/config') {
        return handleConfig(env, origin);
      }

      // POST /token/rtc
      if (method === 'POST' && path === '/token/rtc') {
        return await handleTokenRequest(request, env, requestId, origin);
      }

      // POST /recording/acquire
      if (method === 'POST' && path === '/recording/acquire') {
        return await handleRecordingAcquire(request, env, requestId, origin);
      }

      // POST /recording/start
      if (method === 'POST' && path === '/recording/start') {
        return await handleRecordingStart(request, env, requestId, origin);
      }

      // POST /recording/stop
      if (method === 'POST' && path === '/recording/stop') {
        return await handleRecordingStop(request, env, requestId, origin);
      }

      // GET /recording/query
      if (method === 'GET' && path === '/recording/query') {
        return await handleRecordingQuery(request, env, requestId, origin);
      }

      // POST /upload/live-recording
      if (method === 'POST' && path === '/upload/live-recording') {
        return await handleLiveRecordingUpload(request, env, requestId, origin);
      }

      // 404 for unknown routes
      return errorResponse('Not found', 404, origin);

    } catch (error) {
      console.error(`[${requestId}] Unhandled error:`, error instanceof Error ? error.message : 'Unknown error');
      return errorResponse('Internal server error', 500, origin);
    }
  },
};
~~~

### FILE: worker/src/recording.ts
~~~ts
/**
 * Agora Cloud Recording handlers for Cloudflare Worker.
 * Routes: /recording/acquire, /recording/start, /recording/stop, /recording/query
 */

import { Env, corsHeaders } from './cors';

interface AcquireRequest {
  channelName: string;
  uid: string;
  sessionId: string;
}

interface StartRequest {
  channelName: string;
  uid: string;
  token: string;
  sessionId: string;
  resourceId: string;
}

interface StopRequest {
  channelName: string;
  recordingUid: string;
  resourceId: string;
  sid: string;
  sessionId?: string;
}

function requireEnv(env: Env, requestId: string, origin: string): Response | null {
  const required = ['AGORA_APP_ID', 'AGORA_CUSTOMER_ID', 'AGORA_CUSTOMER_SECRET', 'R2_BUCKET', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_ENDPOINT'] as const;
  for (const key of required) {
    if (!String(env[key] || '').trim()) {
      return errorJson(requestId, 'missing_env', `Missing required env: ${key}`, 500, origin);
    }
  }
  return null;
}

function basicAuth(env: Env): string {
  return `Basic ${btoa(`${env.AGORA_CUSTOMER_ID}:${env.AGORA_CUSTOMER_SECRET}`)}`;
}

function validateApiKey(request: Request, env: Env): boolean {
  const key = request.headers.get('x-api-key');
  return !!key && key === env.API_KEY;
}

function successJson(requestId: string, data: Record<string, unknown>, origin: string): Response {
  return new Response(
    JSON.stringify({ ok: true, requestId, data }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    }
  );
}

function errorJson(
  requestId: string,
  code: string,
  message: string,
  status: number,
  origin: string,
  detail?: unknown,
  agoraCode?: unknown,
  agoraMessage?: unknown
): Response {
  return new Response(
    JSON.stringify({
      ok: false,
      requestId,
      error: {
        code,
        message,
        agoraCode,
        agoraMessage,
        detail,
      },
    }),
    {
      status,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    }
  );
}

function parseJsonSafe(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function fetchAgora(
  requestId: string,
  env: Env,
  method: 'GET' | 'POST',
  path: string,
  payload?: Record<string, unknown>
): Promise<{ status: number; body: any }> {
  const url = `https://api.agora.io/v1/apps/${env.AGORA_APP_ID}${path}`;
  console.log(`[${requestId}] agora ${method} ${url}`);

  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: basicAuth(env),
    },
    body: payload ? JSON.stringify(payload) : undefined,
  });

  const text = await response.text();
  const body = parseJsonSafe(text) as any;

  console.log(`[${requestId}] agora status=${response.status} code=${body?.code ?? 'n/a'}`);
  return { status: response.status, body };
}

function parseFileList(raw: unknown): unknown[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      // Plain filename string (e.g. "abc_channel.m3u8")
      if (raw.trim().length > 0) {
        return [{ fileName: raw.trim() }];
      }
      return [];
    }
  }
  return [];
}

function buildMediaUrl(fileList: unknown[], playbackBaseUrl: string, sessionId?: string): string | null {
  if (!playbackBaseUrl || fileList.length === 0) return null;
  const files = fileList as Array<{ fileName?: string }>;
  const mp4 = files.find((x) => typeof x?.fileName === 'string' && x.fileName.toLowerCase().endsWith('.mp4'));
  const any = files.find((x) => typeof x?.fileName === 'string');
  const fileName = (mp4 || any)?.fileName;
  if (!fileName) return null;
  const base = playbackBaseUrl.replace(/\/+$/, '');
  const prefix = sessionId ? `funprofile/live/${sessionId}` : '';
  const path = prefix ? `${prefix}/${fileName.replace(/^\/+/, '')}` : fileName.replace(/^\/+/, '');
  return `${base}/${path}`;
}

function getDurationSeconds(body: any): number | null {
  const duration = body?.serverResponse?.extensionServiceState?.payload?.durationMs;
  if (typeof duration === 'number') return Math.floor(duration / 1000);
  return null;
}

function getThumbnailUrl(mediaUrl: string | null): string | null {
  if (!mediaUrl) return null;
  const lastDot = mediaUrl.lastIndexOf('.');
  if (lastDot < 0) return null;
  return `${mediaUrl.slice(0, lastDot)}.jpg`;
}

export async function handleRecordingAcquire(request: Request, env: Env, requestId: string, origin: string): Promise<Response> {
  if (!validateApiKey(request, env)) {
    return errorJson(requestId, 'unauthorized', 'Missing or invalid API key', 401, origin);
  }

  const envErr = requireEnv(env, requestId, origin);
  if (envErr) return envErr;

  let body: AcquireRequest;
  try {
    body = await request.json() as AcquireRequest;
  } catch {
    return errorJson(requestId, 'bad_json', 'Invalid JSON payload', 400, origin);
  }

  if (!body.channelName || !body.uid || !body.sessionId) {
    return errorJson(requestId, 'invalid_input', 'channelName, uid, sessionId are required', 400, origin);
  }

  const payload = {
    cname: body.channelName,
    uid: body.uid,
    clientRequest: { resourceExpiredHour: 24 },
  };

  const agora = await fetchAgora(requestId, env, 'POST', '/cloud_recording/acquire', payload);
  if (agora.status < 200 || agora.status >= 300 || !agora.body?.resourceId) {
    return errorJson(
      requestId,
      'agora_acquire_failed',
      'Agora acquire failed',
      502,
      origin,
      agora.body,
      agora.body?.code,
      agora.body?.message
    );
  }

  return successJson(requestId, {
    resourceId: agora.body.resourceId,
    sessionId: body.sessionId,
  }, origin);
}

export async function handleRecordingStart(request: Request, env: Env, requestId: string, origin: string): Promise<Response> {
  if (!validateApiKey(request, env)) {
    return errorJson(requestId, 'unauthorized', 'Missing or invalid API key', 401, origin);
  }

  const envErr = requireEnv(env, requestId, origin);
  if (envErr) return envErr;

  let body: StartRequest;
  try {
    body = await request.json() as StartRequest;
  } catch {
    return errorJson(requestId, 'bad_json', 'Invalid JSON payload', 400, origin);
  }

  if (!body.channelName || !body.uid || !body.token || !body.sessionId || !body.resourceId) {
    return errorJson(requestId, 'invalid_input', 'channelName, uid, token, sessionId, resourceId are required', 400, origin);
  }

  const storageConfig: Record<string, unknown> = {
    vendor: 1,
    region: Number.isFinite(Number(env.R2_REGION)) ? Number(env.R2_REGION) : 0,
    bucket: env.R2_BUCKET,
    accessKey: env.R2_ACCESS_KEY_ID,
    secretKey: env.R2_SECRET_ACCESS_KEY,
    endpoint: env.R2_ENDPOINT,
    fileNamePrefix: ['funprofile', 'live', body.sessionId],
  };

  console.log(`[${requestId}] storageConfig: bucket=${env.R2_BUCKET}, endpoint=${env.R2_ENDPOINT}, region=${env.R2_REGION || '0'}`);

  const payload = {
    cname: body.channelName,
    uid: body.uid,
    clientRequest: {
      token: body.token,
      recordingConfig: {
        channelType: 1,
        streamTypes: 2,
        maxIdleTime: 120,
        videoStreamType: 0,
        transcodingConfig: {
          width: 1280,
          height: 720,
          fps: 15,
          bitrate: 1200,
          mixedVideoLayout: 1,
        },
      },
      storageConfig,
    },
  };

  const path = `/cloud_recording/resourceid/${body.resourceId}/mode/mix/start`;
  const agora = await fetchAgora(requestId, env, 'POST', path, payload);

  console.log(`[${requestId}] agora start response: sid=${agora.body?.sid}, uploadingStatus=${agora.body?.serverResponse?.uploadingStatus || 'n/a'}`);

  if (agora.status < 200 || agora.status >= 300 || !agora.body?.sid) {
    return errorJson(
      requestId,
      'agora_start_failed',
      'Agora start failed',
      502,
      origin,
      agora.body,
      agora.body?.code,
      agora.body?.message
    );
  }

  return successJson(requestId, {
    resourceId: body.resourceId,
    sid: agora.body.sid,
    sessionId: body.sessionId,
    storageTarget: {
      bucket: env.R2_BUCKET,
      endpoint: env.R2_ENDPOINT,
    },
  }, origin);
}

export async function handleRecordingStop(request: Request, env: Env, requestId: string, origin: string): Promise<Response> {
  if (!validateApiKey(request, env)) {
    return errorJson(requestId, 'unauthorized', 'Missing or invalid API key', 401, origin);
  }

  const envErr = requireEnv(env, requestId, origin);
  if (envErr) return envErr;

  let body: StopRequest;
  try {
    body = await request.json() as StopRequest;
  } catch {
    return errorJson(requestId, 'bad_json', 'Invalid JSON payload', 400, origin);
  }

  if (!body.channelName || !body.recordingUid || !body.resourceId || !body.sid) {
    return errorJson(requestId, 'invalid_input', 'channelName, recordingUid, resourceId, sid are required', 400, origin);
  }

  const payload = {
    cname: body.channelName,
    uid: body.recordingUid,
    clientRequest: {},
  };

  const path = `/cloud_recording/resourceid/${body.resourceId}/sid/${body.sid}/mode/mix/stop`;
  const agora = await fetchAgora(requestId, env, 'POST', path, payload);

  console.log(`[${requestId}] agora stop response: uploadingStatus=${agora.body?.serverResponse?.uploadingStatus || 'n/a'}, fileListMode=${agora.body?.serverResponse?.fileListMode || 'n/a'}`);

  const alreadyGone = agora.status === 404 && agora.body?.code === 404;
  if ((agora.status < 200 || agora.status >= 300) && !alreadyGone) {
    return errorJson(
      requestId,
      'agora_stop_failed',
      'Agora stop failed',
      502,
      origin,
      agora.body,
      agora.body?.code,
      agora.body?.message
    );
  }

  const fileList = alreadyGone ? [] : parseFileList(agora.body?.serverResponse?.fileList);
  const mediaUrl = alreadyGone ? null : buildMediaUrl(fileList, env.RECORDING_PLAYBACK_BASE_URL, body.sessionId);
  const durationSeconds = alreadyGone ? null : getDurationSeconds(agora.body);
  const thumbnailUrl = getThumbnailUrl(mediaUrl);

  return successJson(requestId, {
    fileList,
    mediaUrl,
    durationSeconds,
    thumbnailUrl,
    alreadyGone,
    rawAgoraResponse: agora.body,
  }, origin);
}

export async function handleRecordingQuery(request: Request, env: Env, requestId: string, origin: string): Promise<Response> {
  if (!validateApiKey(request, env)) {
    return errorJson(requestId, 'unauthorized', 'Missing or invalid API key', 401, origin);
  }

  const envErr = requireEnv(env, requestId, origin);
  if (envErr) return envErr;

  const url = new URL(request.url);
  const resourceId = url.searchParams.get('resourceId') || '';
  const sid = url.searchParams.get('sid') || '';
  const mode = url.searchParams.get('mode') || 'mix';
  const sessionId = url.searchParams.get('sessionId') || '';

  if (!resourceId || !sid) {
    return errorJson(requestId, 'invalid_input', 'resourceId and sid are required', 400, origin);
  }

  const path = `/cloud_recording/resourceid/${resourceId}/sid/${sid}/mode/${mode}/query`;
  const agora = await fetchAgora(requestId, env, 'GET', path);

  if (agora.status < 200 || agora.status >= 300) {
    return errorJson(
      requestId,
      'agora_query_failed',
      'Agora query failed',
      502,
      origin,
      agora.body,
      agora.body?.code,
      agora.body?.message
    );
  }

  const fileList = parseFileList(agora.body?.serverResponse?.fileList);
  const mediaUrl = buildMediaUrl(fileList, env.RECORDING_PLAYBACK_BASE_URL, sessionId);
  const durationSeconds = getDurationSeconds(agora.body);
  const thumbnailUrl = getThumbnailUrl(mediaUrl);

  return successJson(requestId, {
    fileList,
    mediaUrl,
    durationSeconds,
    thumbnailUrl,
    rawAgoraResponse: agora.body,
  }, origin);
}
~~~

### FILE: worker/src/upload.ts
~~~ts
import { Env, corsHeaders } from './cors';

const MAX_UPLOAD_SIZE_BYTES = 100 * 1024 * 1024; // 100MB
const ALLOWED_VIDEO_TYPES = new Set([
  'video/webm',
  'video/webm;codecs=vp8,opus',
  'video/mp4',
]);

interface SupabaseUser {
  id: string;
}

function errorJson(message: string, status: number, origin: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin),
    },
  });
}

function okJson(payload: Record<string, unknown>, origin: string): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin),
    },
  });
}

async function verifySupabaseUser(authHeader: string, env: Env): Promise<SupabaseUser | null> {
  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    method: 'GET',
    headers: {
      Authorization: authHeader,
      apikey: env.SUPABASE_ANON_KEY,
    },
  });

  if (!response.ok) return null;
  const user = (await response.json()) as SupabaseUser;
  if (!user?.id) return null;
  return user;
}

async function isHostOfSession(streamId: string, userId: string, authHeader: string, env: Env): Promise<boolean> {
  const query = new URL(`${env.SUPABASE_URL}/rest/v1/live_sessions`);
  query.searchParams.set('select', 'id');
  query.searchParams.set('id', `eq.${streamId}`);
  query.searchParams.set('or', `(host_user_id.eq.${userId},owner_id.eq.${userId})`);
  query.searchParams.set('limit', '1');

  const response = await fetch(query.toString(), {
    method: 'GET',
    headers: {
      Authorization: authHeader,
      apikey: env.SUPABASE_ANON_KEY,
    },
  });

  if (!response.ok) return false;
  const rows = (await response.json()) as Array<{ id: string }>;
  return Array.isArray(rows) && rows.length > 0;
}

function sanitizeFilename(raw: string | null): string {
  const fallback = 'recording.webm';
  if (!raw) return fallback;
  const safe = raw.replace(/[^a-zA-Z0-9._-]/g, '_');
  if (!safe || safe.startsWith('.')) return fallback;
  return safe;
}

function isSupportedVideoType(contentType: string): boolean {
  const normalized = contentType.toLowerCase();
  if (ALLOWED_VIDEO_TYPES.has(normalized)) return true;
  return normalized.startsWith('video/webm') || normalized.startsWith('video/mp4');
}

export async function handleLiveRecordingUpload(
  request: Request,
  env: Env,
  requestId: string,
  origin: string
): Promise<Response> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return errorJson('Missing or invalid Authorization header', 401, origin);
  }

  const streamId = request.headers.get('X-Stream-Id');
  if (!streamId) {
    return errorJson('Missing X-Stream-Id', 400, origin);
  }

  const contentType = request.headers.get('Content-Type') || '';
  if (!contentType || !isSupportedVideoType(contentType)) {
    return errorJson('Unsupported Content-Type', 400, origin);
  }

  const user = await verifySupabaseUser(authHeader, env);
  if (!user) {
    return errorJson('Invalid JWT', 401, origin);
  }

  const ownsSession = await isHostOfSession(streamId, user.id, authHeader, env);
  if (!ownsSession) {
    return errorJson('Forbidden: session does not belong to user', 403, origin);
  }

  const bodyBuffer = await request.arrayBuffer();
  if (!bodyBuffer.byteLength) {
    return errorJson('Empty upload body', 400, origin);
  }
  if (bodyBuffer.byteLength > MAX_UPLOAD_SIZE_BYTES) {
    return errorJson('Uploaded file too large', 413, origin);
  }

  const filename = sanitizeFilename(request.headers.get('X-Filename'));
  const key = `recordings/${streamId}/${Date.now()}-${filename}`;
  await env.RECORDINGS_BUCKET.put(key, bodyBuffer, {
    httpMetadata: {
      contentType,
    },
  });

  const url = `${env.RECORDING_PLAYBACK_BASE_URL.replace(/\/+$/, '')}/${key}`;
  console.log(`[${requestId}] upload/live-recording stored key=${key} user=${user.id}`);

  return okJson({ ok: true, key, url }, origin);
}
~~~

### FILE: worker/src/validate.ts
~~~ts
/**
 * Input validation utilities for Agora Token Service
 */

export interface TokenRequest {
  channel: string;
  userAccount: string;
  role: 'publisher' | 'subscriber';
  expireSeconds: number;
}

export interface ValidationResult {
  valid: boolean;
  data?: TokenRequest;
  error?: string;
}

// Validation regex patterns
const CHANNEL_REGEX = /^[a-zA-Z0-9_-]+$/;
const USER_ACCOUNT_REGEX = /^[a-zA-Z0-9@._-]+$/;

// Validation limits
const CHANNEL_MIN_LENGTH = 1;
const CHANNEL_MAX_LENGTH = 64;
const USER_ACCOUNT_MIN_LENGTH = 1;
const USER_ACCOUNT_MAX_LENGTH = 128;
const EXPIRE_MIN_SECONDS = 60;
const EXPIRE_MAX_SECONDS = 86400;
const DEFAULT_EXPIRE_SECONDS = 3600;

/**
 * Validate channel name
 */
function validateChannel(channel: unknown): string | null {
  if (channel === undefined || channel === null) {
    return 'channel is required';
  }
  
  if (typeof channel !== 'string') {
    return 'channel must be a string';
  }

  const trimmed = channel.trim();
  
  if (trimmed.length < CHANNEL_MIN_LENGTH) {
    return `channel must be at least ${CHANNEL_MIN_LENGTH} character`;
  }
  
  if (trimmed.length > CHANNEL_MAX_LENGTH) {
    return `channel must be at most ${CHANNEL_MAX_LENGTH} characters`;
  }

  if (!CHANNEL_REGEX.test(trimmed)) {
    return 'channel must contain only alphanumeric characters, underscores, and hyphens';
  }

  return null;
}

/**
 * Validate user account (string UID)
 */
function validateUserAccount(userAccount: unknown): string | null {
  if (userAccount === undefined || userAccount === null) {
    return 'userAccount is required';
  }
  
  if (typeof userAccount !== 'string') {
    return 'userAccount must be a string';
  }

  const trimmed = userAccount.trim();
  
  if (trimmed.length < USER_ACCOUNT_MIN_LENGTH) {
    return `userAccount must be at least ${USER_ACCOUNT_MIN_LENGTH} character`;
  }
  
  if (trimmed.length > USER_ACCOUNT_MAX_LENGTH) {
    return `userAccount must be at most ${USER_ACCOUNT_MAX_LENGTH} characters`;
  }

  if (!USER_ACCOUNT_REGEX.test(trimmed)) {
    return 'userAccount must contain only alphanumeric characters, @, ., _, and -';
  }

  return null;
}

/**
 * Validate role
 */
function validateRole(role: unknown): 'publisher' | 'subscriber' {
  if (role === undefined || role === null) {
    return 'publisher'; // Default role
  }
  
  if (role === 'publisher' || role === 'subscriber') {
    return role;
  }
  
  return 'publisher'; // Default for invalid values
}

/**
 * Validate expire seconds
 */
function validateExpireSeconds(expireSeconds: unknown, defaultTtl: number): number {
  if (expireSeconds === undefined || expireSeconds === null) {
    return defaultTtl;
  }
  
  const num = typeof expireSeconds === 'number' 
    ? expireSeconds 
    : parseInt(String(expireSeconds), 10);
  
  if (isNaN(num)) {
    return defaultTtl;
  }

  // Clamp to valid range
  if (num < EXPIRE_MIN_SECONDS) {
    return EXPIRE_MIN_SECONDS;
  }
  
  if (num > EXPIRE_MAX_SECONDS) {
    return EXPIRE_MAX_SECONDS;
  }

  return Math.floor(num);
}

/**
 * Validate the complete token request body
 */
export function validateTokenRequest(
  body: unknown, 
  defaultTtl: number = DEFAULT_EXPIRE_SECONDS
): ValidationResult {
  // Check if body is an object
  if (!body || typeof body !== 'object') {
    return {
      valid: false,
      error: 'Request body must be a JSON object',
    };
  }

  const data = body as Record<string, unknown>;

  // Validate channel
  const channelError = validateChannel(data.channel);
  if (channelError) {
    return {
      valid: false,
      error: channelError,
    };
  }

  // Validate userAccount
  const userAccountError = validateUserAccount(data.userAccount);
  if (userAccountError) {
    return {
      valid: false,
      error: userAccountError,
    };
  }

  // Validate and normalize role and expireSeconds
  const role = validateRole(data.role);
  const expireSeconds = validateExpireSeconds(data.expireSeconds, defaultTtl);

  return {
    valid: true,
    data: {
      channel: (data.channel as string).trim(),
      userAccount: (data.userAccount as string).trim(),
      role,
      expireSeconds,
    },
  };
}
~~~

### FILE: worker/tsconfig.json
~~~json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "types": ["@cloudflare/workers-types"],
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules"]
}
~~~

### FILE: worker/wrangler.toml
~~~toml
# Cloudflare Worker Configuration
# Agora RTC Token Service for Fun Profile

name = "fun-agora-rtc-token"
main = "src/index.ts"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]

# Environment variables (non-sensitive)
[vars]
ALLOWED_ORIGINS = "https://angelquangvu-funprofile.lovable.app,https://id-preview--7ea0fa7c-4fc2-4fc1-9ff9-fdfadf138a52.lovable.app,https://7ea0fa7c-4fc2-4fc1-9ff9-fdfadf138a52.lovableproject.com"
TOKEN_TTL_SECONDS = "3600"
# Required for /upload/live-recording JWT verification
# SUPABASE_URL = "https://<project-ref>.supabase.co"
# SUPABASE_ANON_KEY = "<anon-key>"

# Secrets (set via `wrangler secret put <NAME>`)
# Token service:
# - AGORA_APP_ID
# - AGORA_APP_CERTIFICATE
# - API_KEY
# Cloud Recording:
# - AGORA_CUSTOMER_ID
# - AGORA_CUSTOMER_SECRET
# - R2_ACCESS_KEY_ID
# - R2_SECRET_ACCESS_KEY
# - R2_BUCKET
# - R2_REGION
# - R2_ENDPOINT
# - R2_ACCOUNT_ID (optional)
# - RECORDING_PLAYBACK_BASE_URL
# - SUPABASE_URL
# - SUPABASE_ANON_KEY

[[r2_buckets]]
binding = "RECORDINGS_BUCKET"
bucket_name = "livestreampro"

# Observability
[observability]
enabled = true
~~~

## FOOTER

Tong so file da dump: 123
Excluded theo rule:
- *.tgz
- *.zip
- package-lock.json
- *.png/*.jpg/*.gif/*.webp/*.mp3/*.ico
- dist/
- .git/
Ghi chu: Tai lieu nay la full source theo feature-core + direct integration, khong phai full monorepo.

