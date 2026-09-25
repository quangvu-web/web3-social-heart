ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS cloudflare_live_input_id text,
  ADD COLUMN IF NOT EXISTS cloudflare_video_uid text;

CREATE INDEX IF NOT EXISTS idx_live_sessions_cloudflare_live_input_id
  ON public.live_sessions(cloudflare_live_input_id)
  WHERE cloudflare_live_input_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_live_sessions_cloudflare_video_uid
  ON public.live_sessions(cloudflare_video_uid)
  WHERE cloudflare_video_uid IS NOT NULL;;
