ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS live_mode text NOT NULL DEFAULT 'webcam',
  ADD COLUMN IF NOT EXISTS stream_provider text NOT NULL DEFAULT 'agora',
  ADD COLUMN IF NOT EXISTS hls_url text;

UPDATE public.live_sessions
SET
  live_mode = CASE
    WHEN COALESCE(source, 'agora') = 'rtmp' THEN 'rtmp'
    ELSE 'webcam'
  END,
  stream_provider = CASE
    WHEN COALESCE(source, 'agora') = 'rtmp' THEN 'nginx_rtmp'
    ELSE 'agora'
  END
WHERE live_mode IS NULL
   OR stream_provider IS NULL
   OR live_mode NOT IN ('webcam', 'rtmp')
   OR stream_provider NOT IN ('agora', 'nginx_rtmp');

UPDATE public.live_sessions
SET hls_url = COALESCE(hls_url, hls_playback_url)
WHERE hls_url IS NULL
  AND hls_playback_url IS NOT NULL;

UPDATE public.live_sessions
SET hls_playback_url = COALESCE(hls_playback_url, hls_url)
WHERE hls_playback_url IS NULL
  AND hls_url IS NOT NULL;

ALTER TABLE public.live_sessions
  DROP CONSTRAINT IF EXISTS live_sessions_live_mode_check;

ALTER TABLE public.live_sessions
  ADD CONSTRAINT live_sessions_live_mode_check
  CHECK (live_mode IN ('webcam', 'rtmp'));

ALTER TABLE public.live_sessions
  DROP CONSTRAINT IF EXISTS live_sessions_stream_provider_check;

ALTER TABLE public.live_sessions
  ADD CONSTRAINT live_sessions_stream_provider_check
  CHECK (stream_provider IN ('agora', 'nginx_rtmp'));

CREATE INDEX IF NOT EXISTS idx_live_sessions_live_mode_status
ON public.live_sessions(live_mode, status, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_live_sessions_stream_provider_status
ON public.live_sessions(stream_provider, status, started_at DESC);;
