ALTER TABLE public.caption_sessions
  ADD COLUMN IF NOT EXISTS chat_announced_at timestamptz NULL;
