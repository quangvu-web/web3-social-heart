CREATE TABLE public.trusted_sender_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id bigint NOT NULL,
  sender_chat_id bigint NOT NULL,
  title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chat_id, sender_chat_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trusted_sender_chats TO authenticated;
GRANT ALL ON public.trusted_sender_chats TO service_role;

ALTER TABLE public.trusted_sender_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage trusted sender chats"
  ON public.trusted_sender_chats FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_trusted_sender_chats_lookup ON public.trusted_sender_chats(chat_id, sender_chat_id);;
