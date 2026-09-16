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