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