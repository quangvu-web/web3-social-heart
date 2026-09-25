ALTER TABLE public.telegram_community_settings ADD COLUMN IF NOT EXISTS event_assistant_enabled BOOLEAN NOT NULL DEFAULT true;;
