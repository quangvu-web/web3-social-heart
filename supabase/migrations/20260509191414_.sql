
ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS stream_key_last_reset_at timestamptz,
  ADD COLUMN IF NOT EXISTS source_connected_at timestamptz,
  ADD COLUMN IF NOT EXISTS go_live_clicked_at timestamptz,
  ADD COLUMN IF NOT EXISTS live_post_id uuid REFERENCES public.posts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS replay_post_id uuid REFERENCES public.posts(id) ON DELETE SET NULL;

UPDATE public.live_sessions
SET live_post_id = post_id
WHERE mode = 'rtmp_obs'
  AND live_post_id IS NULL
  AND post_id IS NOT NULL;

ALTER TABLE public.live_sessions
  DROP CONSTRAINT IF EXISTS live_sessions_status_check;

ALTER TABLE public.live_sessions
  ADD CONSTRAINT live_sessions_status_check
  CHECK (status IN (
    'created',
    'waiting_for_obs',
    'source_connected',
    'ready_to_go_live',
    'live',
    'ended',
    'processing',
    'archiving',
    'posted',
    'failed'
  ));

CREATE INDEX IF NOT EXISTS idx_live_sessions_rtmp_producer_status
  ON public.live_sessions(host_user_id, status, updated_at DESC)
  WHERE mode = 'rtmp_obs';

CREATE INDEX IF NOT EXISTS idx_live_sessions_live_post_id
  ON public.live_sessions(live_post_id)
  WHERE live_post_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_live_sessions_replay_post_id
  ON public.live_sessions(replay_post_id)
  WHERE replay_post_id IS NOT NULL;

COMMENT ON COLUMN public.live_sessions.source_connected_at IS
  'Set when Cloudflare Stream Live Input first receives OBS/RTMP input. This does not mean the live is public.';
COMMENT ON COLUMN public.live_sessions.go_live_clicked_at IS
  'Set when the creator clicks Go Live in the Live Producer dashboard.';
;
