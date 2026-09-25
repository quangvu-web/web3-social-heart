ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS producer_active_at timestamptz,
  ADD COLUMN IF NOT EXISTS producer_disconnected_at timestamptz,
  ADD COLUMN IF NOT EXISTS producer_input_enabled boolean NOT NULL DEFAULT false;

UPDATE public.live_sessions
SET producer_input_enabled = true
WHERE mode = 'rtmp_obs'
  AND status IN ('source_connected', 'ready_to_go_live', 'live')
  AND producer_input_enabled = false;

CREATE INDEX IF NOT EXISTS idx_live_sessions_rtmp_producer_active
  ON public.live_sessions(producer_active_at DESC)
  WHERE mode = 'rtmp_obs'
    AND status IN ('waiting_for_obs', 'source_connected', 'ready_to_go_live');

COMMENT ON COLUMN public.live_sessions.producer_active_at IS
  'Last heartbeat from the Live Producer page. RTMP ingest is only enabled while this is fresh.';
COMMENT ON COLUMN public.live_sessions.producer_disconnected_at IS
  'Set when the Live Producer page closes or its heartbeat is considered stale.';
COMMENT ON COLUMN public.live_sessions.producer_input_enabled IS
  'Whether FUN Profile currently allows the Cloudflare Live Input to accept OBS/RTMP source video.';;
