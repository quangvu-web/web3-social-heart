ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS host_connection_status text NOT NULL DEFAULT 'online',
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS recording_stop_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS recording_last_query_at timestamptz,
  ADD COLUMN IF NOT EXISTS recording_error text,
  ADD COLUMN IF NOT EXISTS cleanup_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_cleanup_at timestamptz;

UPDATE public.live_sessions
SET
  last_seen_at = COALESCE(last_seen_at, last_host_heartbeat_at, last_heartbeat_at, host_heartbeat_at, started_at, created_at),
  recording_stop_requested_at = COALESCE(recording_stop_requested_at, stop_requested_at),
  cleanup_attempts = COALESCE(cleanup_attempts, recording_retry_count, 0),
  host_connection_status = COALESCE(host_connection_status, 'online')
WHERE last_seen_at IS NULL
   OR recording_stop_requested_at IS NULL
   OR cleanup_attempts IS NULL
   OR host_connection_status IS NULL;

ALTER TABLE public.live_sessions DROP CONSTRAINT IF EXISTS live_sessions_status_check;
ALTER TABLE public.live_sessions ADD CONSTRAINT live_sessions_status_check
  CHECK (status IN (
    'created','idle','preview','connecting','starting','waiting_for_obs','source_connected','ready_to_go_live',
    'live','recording','reconnecting','disconnected','cleanup_pending','ending','stopping','stopped',
    'uploading','queued','ended','processing','ready','archiving','posted','deleted','failed'
  ));

ALTER TABLE public.live_sessions DROP CONSTRAINT IF EXISTS live_sessions_end_reason_check;
ALTER TABLE public.live_sessions ADD CONSTRAINT live_sessions_end_reason_check
  CHECK (
    end_reason IS NULL OR end_reason IN (
      'user_ended','host_clicked_end','app_closed','heartbeat_timeout','host_heartbeat_timeout',
      'network_lost','watchdog_cleanup','zombie_cleanup','ended_recording_active','ending_timeout'
    )
  );

ALTER TABLE public.live_sessions DROP CONSTRAINT IF EXISTS live_sessions_host_connection_status_check;
ALTER TABLE public.live_sessions ADD CONSTRAINT live_sessions_host_connection_status_check
  CHECK (host_connection_status IN ('online', 'offline', 'unknown'));

CREATE INDEX IF NOT EXISTS idx_live_sessions_live_end_heartbeat
  ON public.live_sessions(status, last_host_heartbeat_at ASC)
  WHERE status IN ('live','recording','reconnecting','disconnected','cleanup_pending','ending','stopping','processing');

CREATE INDEX IF NOT EXISTS idx_live_sessions_recording_zombie
  ON public.live_sessions(recording_provider, recording_status, recording_stop_requested_at)
  WHERE recording_provider = 'agora'
    AND recording_status IN ('acquiring','starting','started','recording','stopping');

COMMENT ON COLUMN public.live_sessions.host_connection_status IS 'Host connection status maintained by live heartbeat/watchdog.';
COMMENT ON COLUMN public.live_sessions.recording_stop_requested_at IS 'Alias-style timestamp for when Agora Cloud Recording stop was requested.';
COMMENT ON COLUMN public.live_sessions.cleanup_attempts IS 'Bounded cleanup attempt counter for live end/watchdog shutdown.';;
