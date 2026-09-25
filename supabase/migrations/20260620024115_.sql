ALTER TABLE public.telegram_group_config
  ADD COLUMN IF NOT EXISTS father_channel_id BIGINT NULL,
  ADD COLUMN IF NOT EXISTS father_channel_title TEXT NULL;;
