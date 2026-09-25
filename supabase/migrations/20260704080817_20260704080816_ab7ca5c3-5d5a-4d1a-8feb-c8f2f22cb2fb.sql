
CREATE TABLE public.telegram_ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id bigint,
  chat_id bigint NOT NULL,
  chat_type text,
  user_id bigint,
  username text,
  full_name text,
  message_id bigint,
  reply_message_id bigint,
  trigger_source text,
  user_message text NOT NULL,
  bot_reply text,
  language text,
  provider text,
  latency_ms integer,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_taic_chat_created ON public.telegram_ai_conversations (chat_id, created_at DESC);
CREATE INDEX idx_taic_group_created ON public.telegram_ai_conversations (group_id, created_at DESC);
CREATE INDEX idx_taic_user_created ON public.telegram_ai_conversations (user_id, created_at DESC);
CREATE INDEX idx_taic_created ON public.telegram_ai_conversations (created_at DESC);

GRANT SELECT ON public.telegram_ai_conversations TO authenticated;
GRANT ALL ON public.telegram_ai_conversations TO service_role;

ALTER TABLE public.telegram_ai_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin read ai conversations"
  ON public.telegram_ai_conversations
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
;
