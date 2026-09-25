ALTER TABLE public.live_sessions
  DROP CONSTRAINT IF EXISTS live_sessions_stream_provider_check;

ALTER TABLE public.live_sessions
  ADD CONSTRAINT live_sessions_stream_provider_check
  CHECK (stream_provider = ANY (ARRAY['agora','nginx_rtmp','cloudflare_stream']));

ALTER TABLE public.live_sessions
  DROP CONSTRAINT IF EXISTS live_sessions_live_mode_check;

ALTER TABLE public.live_sessions
  ADD CONSTRAINT live_sessions_live_mode_check
  CHECK (live_mode = ANY (ARRAY['webcam','rtmp','rtmp_obs']));;
