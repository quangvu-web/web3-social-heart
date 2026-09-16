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