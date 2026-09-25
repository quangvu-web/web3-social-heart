ALTER TABLE public.telegram_community_settings
  ADD COLUMN IF NOT EXISTS meditation_summary_sender_scope text NOT NULL DEFAULT 'trusted',
  ADD COLUMN IF NOT EXISTS meditation_summary_max_age_minutes integer NOT NULL DEFAULT 60;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'telegram_community_settings_med_sender_scope_chk'
  ) THEN
    ALTER TABLE public.telegram_community_settings
      ADD CONSTRAINT telegram_community_settings_med_sender_scope_chk
      CHECK (meditation_summary_sender_scope IN ('trusted', 'anyone'));
  END IF;
END $$;;
