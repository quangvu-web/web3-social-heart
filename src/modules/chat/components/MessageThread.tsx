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

