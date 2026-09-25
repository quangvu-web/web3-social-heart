ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS stream_key text,
  ADD COLUMN IF NOT EXISTS hls_playback_url text,
  ADD COLUMN IF NOT EXISTS rtmp_status text DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'agora';

CREATE UNIQUE INDEX IF NOT EXISTS live_sessions_stream_key_key
  ON public.live_sessions (stream_key)
  WHERE stream_key IS NOT NULL;;
