ALTER TABLE public.caption_sessions ADD COLUMN IF NOT EXISTS meeting_key text;

CREATE UNIQUE INDEX IF NOT EXISTS caption_sessions_active_meeting_key_key
  ON public.caption_sessions (meeting_key)
  WHERE status IN ('pending', 'joining', 'live') AND meeting_key IS NOT NULL;