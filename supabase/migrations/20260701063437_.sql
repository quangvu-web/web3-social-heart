ALTER TABLE public.telegram_community_settings
  ADD COLUMN IF NOT EXISTS meditation_summary_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS meditation_summary_prompt text;;
