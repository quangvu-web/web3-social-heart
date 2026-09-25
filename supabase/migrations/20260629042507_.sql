ALTER TABLE public.telegram_community_settings
ADD COLUMN IF NOT EXISTS help_intent_prompt text;;
