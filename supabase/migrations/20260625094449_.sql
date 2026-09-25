ALTER TABLE public.telegram_community_settings
  ADD COLUMN IF NOT EXISTS positive_engagement_prompt TEXT;;
