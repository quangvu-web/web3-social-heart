ALTER TABLE public.telegram_community_settings
  ADD COLUMN IF NOT EXISTS cjk_chatter_guard_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS cjk_chatter_strike_threshold integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS group_primary_language text NOT NULL DEFAULT 'vi';;
