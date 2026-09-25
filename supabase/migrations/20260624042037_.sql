ALTER TABLE public.telegram_community_settings
  ADD COLUMN IF NOT EXISTS always_reply_owner BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS always_reply_admins BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS always_reply_on_mention BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS always_reply_on_reply_to_bot BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS help_intent_ai_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS positive_engagement_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS positive_engagement_cooldown_minutes INTEGER NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS positive_engagement_max_per_hour INTEGER NOT NULL DEFAULT 3;

CREATE TABLE IF NOT EXISTS public.telegram_ai_audit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id BIGINT NOT NULL,
  user_id BIGINT,
  username TEXT,
  trigger_source TEXT NOT NULL,
  prompt_preview TEXT,
  ai_responded BOOLEAN NOT NULL DEFAULT false,
  response_time_ms INTEGER,
  extra JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_telegram_ai_audit_group_created
  ON public.telegram_ai_audit (group_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_telegram_ai_audit_source_created
  ON public.telegram_ai_audit (trigger_source, created_at DESC);

GRANT SELECT ON public.telegram_ai_audit TO authenticated;
GRANT ALL ON public.telegram_ai_audit TO service_role;

ALTER TABLE public.telegram_ai_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read AI audit" ON public.telegram_ai_audit;
CREATE POLICY "Admins can read AI audit"
  ON public.telegram_ai_audit
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

UPDATE public.telegram_community_settings AS settings
SET
  always_reply_owner = config.always_reply_owner,
  always_reply_admins = config.always_reply_admins,
  always_reply_on_mention = config.always_reply_on_mention,
  always_reply_on_reply_to_bot = config.always_reply_on_reply_to_bot
FROM public.telegram_group_config AS config
WHERE settings.group_id = config.group_id;;
