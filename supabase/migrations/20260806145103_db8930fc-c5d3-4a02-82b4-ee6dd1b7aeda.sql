ALTER TABLE public.telegram_community_settings
  ADD COLUMN IF NOT EXISTS account_shop_guard_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS account_shop_action text NOT NULL DEFAULT 'ban';

ALTER TABLE public.telegram_community_settings
  DROP CONSTRAINT IF EXISTS telegram_community_settings_account_shop_action_check;

ALTER TABLE public.telegram_community_settings
  ADD CONSTRAINT telegram_community_settings_account_shop_action_check
  CHECK (account_shop_action IN ('ban', 'warn'));;
