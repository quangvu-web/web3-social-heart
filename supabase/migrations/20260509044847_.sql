ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS r2_recording_key TEXT,
  ADD COLUMN IF NOT EXISTS r2_recording_size BIGINT;

COMMENT ON COLUMN public.live_sessions.r2_recording_key IS 'R2 object key of webcam live recording (multipart-assembled). Used by live-replay-finalize-r2 to ask Cloudflare Stream to copy it.';
COMMENT ON COLUMN public.live_sessions.r2_recording_size IS 'Total bytes of r2_recording_key object.';;
