ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS stop_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS stopped_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_host_heartbeat_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_viewer_activity_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_media_activity_at timestamptz,
  ADD COLUMN IF NOT EXISTS recording_retry_count integer NOT NULL DEFAULT 0;

UPDATE public.live_sessions
SET
  last_host_heartbeat_at = COALESCE(last_host_heartbeat_at, last_heartbeat_at, host_heartbeat_at, started_at),
  recording_retry_count = COALESCE(recording_retry_count, 0)
WHERE last_host_heartbeat_at IS NULL
   OR recording_retry_count IS NULL;

ALTER TABLE public.live_sessions
  DROP CONSTRAINT IF EXISTS live_sessions_recording_status_check;

ALTER TABLE public.live_sessions
  ADD CONSTRAINT live_sessions_recording_status_check
  CHECK (recording_status IN (
    'idle','acquired','acquiring','starting','started','recording','uploading','queued','stopping','processing','ready','stopped','failed','deleted'
  ));

CREATE INDEX IF NOT EXISTS idx_live_sessions_recording_leak_watchdog
  ON public.live_sessions(recording_provider, recording_status, last_host_heartbeat_at ASC)
  WHERE recording_provider = 'agora'
    AND recording_status IN ('acquiring', 'starting', 'started', 'recording', 'stopping');

CREATE UNIQUE INDEX IF NOT EXISTS uniq_live_sessions_one_active_agora_recording
  ON public.live_sessions(id)
  WHERE recording_provider = 'agora'
    AND recording_status IN ('acquiring', 'starting', 'started', 'recording', 'stopping');

COMMENT ON COLUMN public.live_sessions.stop_requested_at IS 'Set immediately before an explicit or watchdog Agora Cloud Recording stop attempt.';
COMMENT ON COLUMN public.live_sessions.stopped_at IS 'Set when Agora Cloud Recording is known or safely assumed to be stopped.';
COMMENT ON COLUMN public.live_sessions.last_host_heartbeat_at IS 'Host-only heartbeat timestamp used by watchdog cleanup.';
COMMENT ON COLUMN public.live_sessions.last_media_activity_at IS 'Last time the host confirmed local audio/video media was published.';;
