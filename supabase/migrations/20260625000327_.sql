ALTER TABLE public.telegram_community_settings
  ADD COLUMN IF NOT EXISTS scam_protection_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS scam_strict_mode BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS scam_warning_enabled BOOLEAN NOT NULL DEFAULT true;;
