ALTER TABLE public.telegram_community_settings
  ADD COLUMN IF NOT EXISTS event_followup_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS event_followup_prompt TEXT;;
