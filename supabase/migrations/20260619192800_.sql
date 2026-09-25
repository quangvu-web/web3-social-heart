ALTER TABLE public.telegram_bot_dm_events
  ADD COLUMN IF NOT EXISTS direction text NOT NULL DEFAULT 'in',
  ADD COLUMN IF NOT EXISTS bot_reply_to_message_id bigint,
  ADD COLUMN IF NOT EXISTS media_kind text,
  ADD COLUMN IF NOT EXISTS media_file_id text,
  ADD COLUMN IF NOT EXISTS media_mime text,
  ADD COLUMN IF NOT EXISTS media_caption text;

CREATE INDEX IF NOT EXISTS idx_tg_bot_dm_events_direction
  ON public.telegram_bot_dm_events (telegram_user_id, created_at DESC, direction);;
