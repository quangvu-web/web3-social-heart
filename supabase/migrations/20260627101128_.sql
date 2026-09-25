ALTER TABLE public.telegram_community_settings ADD COLUMN IF NOT EXISTS owner_anonymous_address_prompt TEXT;
ALTER TABLE public.telegram_community_settings ADD COLUMN IF NOT EXISTS community_support_prompt TEXT;;
