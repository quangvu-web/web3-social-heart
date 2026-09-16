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