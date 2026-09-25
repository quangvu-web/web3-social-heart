
CREATE TABLE IF NOT EXISTS public.telegram_group_health (
  group_id BIGINT PRIMARY KEY,
  group_title TEXT,
  last_inbound_at TIMESTAMPTZ,
  last_inbound_text TEXT,
  last_inbound_user TEXT,
  last_bot_reply_at TIMESTAMPTZ,
  last_bot_reply_mode TEXT,
  inbound_count_total BIGINT NOT NULL DEFAULT 0,
  bot_reply_count_total BIGINT NOT NULL DEFAULT 0,
  help_intent_count_total BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.telegram_group_health TO service_role;

ALTER TABLE public.telegram_group_health ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_only" ON public.telegram_group_health
  FOR ALL TO service_role USING (true) WITH CHECK (true);
;
