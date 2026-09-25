CREATE TABLE IF NOT EXISTS public.telegram_ai_message_locks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id BIGINT NOT NULL,
  message_id BIGINT NOT NULL,
  trigger_source TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'responded', 'failed', 'skipped')),
  user_id BIGINT,
  prompt_preview TEXT,
  extra JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, message_id, trigger_source)
);

CREATE INDEX IF NOT EXISTS idx_telegram_ai_message_locks_group_created
  ON public.telegram_ai_message_locks (group_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_telegram_ai_message_locks_status_created
  ON public.telegram_ai_message_locks (status, created_at DESC);

GRANT SELECT ON public.telegram_ai_message_locks TO authenticated;
GRANT ALL ON public.telegram_ai_message_locks TO service_role;

ALTER TABLE public.telegram_ai_message_locks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read AI message locks" ON public.telegram_ai_message_locks;
CREATE POLICY "Admins can read AI message locks"
  ON public.telegram_ai_message_locks
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));;
