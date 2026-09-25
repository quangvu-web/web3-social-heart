CREATE TABLE IF NOT EXISTS public.telegram_scheduled_deletions (
  chat_id bigint NOT NULL,
  message_id bigint NOT NULL,
  delete_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chat_id, message_id)
);
GRANT ALL ON public.telegram_scheduled_deletions TO service_role;
ALTER TABLE public.telegram_scheduled_deletions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role manages scheduled deletions"
  ON public.telegram_scheduled_deletions FOR ALL
  TO service_role USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_tg_sched_del_due ON public.telegram_scheduled_deletions (delete_at);;
