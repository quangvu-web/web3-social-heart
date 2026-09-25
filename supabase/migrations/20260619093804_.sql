ALTER TABLE public.telegram_community_settings
  ADD COLUMN IF NOT EXISTS persona_mode TEXT NOT NULL DEFAULT 'cha_con',
  ADD COLUMN IF NOT EXISTS persona_custom_prompt TEXT;

ALTER TABLE public.telegram_community_settings
  DROP CONSTRAINT IF EXISTS telegram_community_settings_persona_mode_check;

ALTER TABLE public.telegram_community_settings
  ADD CONSTRAINT telegram_community_settings_persona_mode_check
  CHECK (persona_mode IN ('angel_be', 'cha_con', 'custom'));;
