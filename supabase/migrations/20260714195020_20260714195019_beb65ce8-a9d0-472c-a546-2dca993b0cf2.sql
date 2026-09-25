CREATE TABLE public.telegram_spam_prelude (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id bigint NOT NULL,
  user_id bigint NOT NULL,
  kind text NOT NULL,
  message_id bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_telegram_spam_prelude_group_user ON public.telegram_spam_prelude (group_id, user_id, created_at DESC);

GRANT ALL ON public.telegram_spam_prelude TO service_role;
ALTER TABLE public.telegram_spam_prelude ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role manages spam prelude"
  ON public.telegram_spam_prelude
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);;
