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