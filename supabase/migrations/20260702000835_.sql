CREATE TABLE IF NOT EXISTS public.telegram_meditation_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id BIGINT NOT NULL,
  message_id BIGINT NOT NULL,
  replied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (chat_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_telegram_meditation_replies_chat_message
  ON public.telegram_meditation_replies (chat_id, message_id);

CREATE INDEX IF NOT EXISTS idx_telegram_meditation_replies_replied_at
  ON public.telegram_meditation_replies (replied_at DESC);

GRANT SELECT, INSERT ON public.telegram_meditation_replies TO authenticated;
GRANT ALL ON public.telegram_meditation_replies TO service_role;

ALTER TABLE public.telegram_meditation_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage telegram meditation replies" ON public.telegram_meditation_replies;
CREATE POLICY "Service role can manage telegram meditation replies"
  ON public.telegram_meditation_replies
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can read telegram meditation replies" ON public.telegram_meditation_replies;
CREATE POLICY "Admins can read telegram meditation replies"
  ON public.telegram_meditation_replies
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.telegram_community_settings
  ADD COLUMN IF NOT EXISTS event_assistant_prompt TEXT;;
