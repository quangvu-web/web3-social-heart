ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS rtmps_url text,
  ADD COLUMN IF NOT EXISTS stream_key_encrypted text,
  ADD COLUMN IF NOT EXISTS stream_key_last_shown_at timestamptz,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS playback_url text,
  ADD COLUMN IF NOT EXISTS mode text;;
