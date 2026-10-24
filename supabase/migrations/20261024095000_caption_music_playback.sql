ALTER TABLE public.caption_sessions
  ADD COLUMN IF NOT EXISTS playback_status text NOT NULL DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS playback_title text,
  ADD COLUMN IF NOT EXISTS playback_until timestamptz,
  ADD COLUMN IF NOT EXISTS playback_file_path text;

ALTER TABLE public.caption_sessions
  ADD CONSTRAINT caption_sessions_playback_status_check
  CHECK (playback_status IN ('idle', 'playing'));
