ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS last_heartbeat_at timestamptz,
  ADD COLUMN IF NOT EXISTS heartbeat_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS client_state text,
  ADD COLUMN IF NOT EXISTS heartbeat_device_type text,
  ADD COLUMN IF NOT EXISTS heartbeat_source_type text,
  ADD COLUMN IF NOT EXISTS heartbeat_agora_channel_name text,
  ADD COLUMN IF NOT EXISTS disconnect_detected_at timestamptz,
  ADD COLUMN IF NOT EXISTS cleanup_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS cleanup_finished_at timestamptz,
  ADD COLUMN IF NOT EXISTS end_reason text,
  ADD COLUMN IF NOT EXISTS total_duration_seconds integer,
  ADD COLUMN IF NOT EXISTS watchdog_stop_result jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS last_recording_query_result jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.live_sessions
SET
  last_heartbeat_at = COALESCE(last_heartbeat_at, host_heartbeat_at, started_at),
  heartbeat_count = COALESCE(heartbeat_count, 0)
WHERE last_heartbeat_at IS NULL
   OR heartbeat_count IS NULL;

ALTER TABLE public.live_sessions DROP CONSTRAINT IF EXISTS live_sessions_status_check;
ALTER TABLE public.live_sessions
  ADD CONSTRAINT live_sessions_status_check
  CHECK (status IN (
    'created','connecting','waiting_for_obs','source_connected','ready_to_go_live',
    'live','reconnecting','disconnected','cleanup_pending','stopping','ended',
    'processing','ready','archiving','posted','failed'
  ));

ALTER TABLE public.live_sessions DROP CONSTRAINT IF EXISTS live_sessions_client_state_check;
ALTER TABLE public.live_sessions
  ADD CONSTRAINT live_sessions_client_state_check
  CHECK (client_state IS NULL OR client_state IN ('live','reconnecting','background','closing'));

ALTER TABLE public.live_sessions DROP CONSTRAINT IF EXISTS live_sessions_end_reason_check;
ALTER TABLE public.live_sessions
  ADD CONSTRAINT live_sessions_end_reason_check
  CHECK (end_reason IS NULL OR end_reason IN ('user_ended','app_closed','heartbeat_timeout','network_lost','watchdog_cleanup'));

CREATE INDEX IF NOT EXISTS idx_live_sessions_watchdog_scan
  ON public.live_sessions(status, last_heartbeat_at ASC)
  WHERE status IN ('live', 'reconnecting', 'disconnected', 'cleanup_pending');

CREATE INDEX IF NOT EXISTS idx_live_sessions_watchdog_cleanup
  ON public.live_sessions(cleanup_started_at, cleanup_finished_at)
  WHERE cleanup_started_at IS NOT NULL;;
