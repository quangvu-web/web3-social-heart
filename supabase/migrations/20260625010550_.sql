CREATE TABLE IF NOT EXISTS public.telegram_event_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id BIGINT NOT NULL,
  message_id BIGINT NOT NULL,
  sender_user_id BIGINT,
  sender_chat_id BIGINT,
  event_type TEXT NOT NULL,
  title TEXT,
  topic TEXT,
  host_name TEXT,
  event_date TEXT,
  event_time TEXT,
  timezone TEXT,
  zoom_link TEXT,
  zoom_id TEXT,
  zoom_password TEXT,
  livestream_links JSONB NOT NULL DEFAULT '[]'::jsonb,
  raw_text TEXT,
  language TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (chat_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_telegram_event_messages_chat_message
  ON public.telegram_event_messages (chat_id, message_id);

CREATE INDEX IF NOT EXISTS idx_telegram_event_messages_chat_created
  ON public.telegram_event_messages (chat_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_telegram_event_messages_event_type
  ON public.telegram_event_messages (event_type);

GRANT SELECT ON public.telegram_event_messages TO authenticated;
GRANT ALL ON public.telegram_event_messages TO service_role;

ALTER TABLE public.telegram_event_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read telegram event messages" ON public.telegram_event_messages;
CREATE POLICY "Admins can read telegram event messages"
  ON public.telegram_event_messages
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS telegram_event_messages_touch ON public.telegram_event_messages;
CREATE TRIGGER telegram_event_messages_touch
BEFORE UPDATE ON public.telegram_event_messages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();;
