import { useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMessages, Message } from '@/hooks/useMessages';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { useConversation } from '@/hooks/useConversations';
import { useAgoraCall } from '@/hooks/useAgoraCall';
import { MessageBubble } from './MessageBubble';
import { ChatInput } from './ChatInput';
import { TypingIndicator } from './TypingIndicator';
import { MessageSearch } from './MessageSearch';
import { GroupSettingsDialog } from './GroupSettingsDialog';
import { IncomingCallDialog } from './IncomingCallDialog';
import { CallRoom } from './CallRoom';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ConversationParticipant } from '@/hooks/useConversations';
import { Search, Settings, Users, Phone, Video } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

interface MessageThreadProps {
  conversationId: string;
  userId: string | null;
  username: string | null;
}

export function MessageThread({ conversationId, userId, username }: MessageThreadProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showGroupSettings, setShowGroupSettings] = useState(false);

  const { data: conversation, refetch: refetchConversation } = useConversation(conversationId);
  const {
    messages,
    isLoading,
    sendMessage,
    markAsRead,
    addReaction,
    removeReaction,
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
  
  const headerName = isGroup
    ? conversation?.name
    : headerProfile?.username || 'User';
  const headerAvatar = isGroup
    ? conversation?.avatar_url
    : headerProfile?.avatar_url;

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  // Mark messages as read
  useEffect(() => {
    if (!userId || messages.length === 0) return;

    const unreadMessages = messages.filter(
      (m) => m.sender_id !== userId && !m.read_by?.includes(userId)
    );

    unreadMessages.forEach((m) => {
      markAsRead(m.id);
    });
  }, [messages, userId, markAsRead]);

  const handleSend = async (content: string, mediaUrls?: string[]) => {
    await sendMessage.mutateAsync({
      content,
      mediaUrls,
      replyToId: replyTo?.id,
    });
    setReplyTo(null);
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

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col">
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
    return (
      <div className="flex-1 flex flex-col">
        <MessageSearch
          conversationId={conversationId}
          onClose={() => setShowSearch(false)}
          onSelectMessage={(messageId) => {
            // TODO: Scroll to message
            setShowSearch(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
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
            disabled={callState !== 'idle'}
            title="Gọi thoại"
          >
            <Phone className="h-5 w-5" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => startCall('video')}
            disabled={callState !== 'idle'}
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
        </div>
      </div>

      {/* Messages */}
      <ScrollArea ref={scrollRef} className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message, index) => {
            const isOwn = message.sender_id === userId;
            const showAvatar = !isOwn && (
              index === 0 || messages[index - 1]?.sender_id !== message.sender_id
            );

            return (
              <MessageBubble
                key={message.id}
                message={message}
                isOwn={isOwn}
                showAvatar={showAvatar}
                currentUserId={userId}
                onReply={() => setReplyTo(message)}
                onReaction={(emoji, hasReacted) => handleReaction(message.id, emoji, hasReacted)}
              />
            );
          })}

          {typingUsers.length > 0 && (
            <TypingIndicator users={typingUsers} />
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        onTyping={sendTyping}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        isSending={sendMessage.isPending}
      />

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
          avatarUrl: undefined, // Could add current user avatar here
        }}
        remoteUserInfo={{
          username: headerProfile?.username,
          avatarUrl: headerProfile?.avatar_url,
        }}
        onToggleMute={toggleMute}
        onToggleCamera={toggleCamera}
        onSwitchToVideo={switchToVideo}
        onEndCall={endCall}
      />
    </div>
  );
}
