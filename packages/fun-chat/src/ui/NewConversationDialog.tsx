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