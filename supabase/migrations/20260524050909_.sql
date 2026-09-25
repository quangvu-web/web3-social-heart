ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS posts_post_type_check;

ALTER TABLE public.posts
  ADD CONSTRAINT posts_post_type_check
  CHECK (post_type IN ('text', 'normal', 'video', 'live', 'live_replay'));

ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS agora_uid bigint,
  ADD COLUMN IF NOT EXISTS recording_resource_id text,
  ADD COLUMN IF NOT EXISTS recording_sid text,
  ADD COLUMN IF NOT EXISTS temp_bucket text,
  ADD COLUMN IF NOT EXISTS temp_object_key text,
  ADD COLUMN IF NOT EXISTS archive_bucket text,
  ADD COLUMN IF NOT EXISTS archive_object_key text,
  ADD COLUMN IF NOT EXISTS replay_url text,
  ADD COLUMN IF NOT EXISTS thumbnail_url text,
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS recording_files jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS duration_seconds integer,
  ADD COLUMN IF NOT EXISTS host_heartbeat_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_recording_query_at timestamptz,
  ADD COLUMN IF NOT EXISTS replay_post_created_at timestamptz;

UPDATE public.live_sessions
SET
  user_id = COALESCE(user_id, host_user_id, owner_id),
  agora_uid = COALESCE(agora_uid, agora_uid_host::bigint),
  recording_resource_id = COALESCE(recording_resource_id, resource_id),
  recording_sid = COALESCE(recording_sid, sid),
  replay_url = COALESCE(replay_url, r2_video_url, playback_url),
  error_message = COALESCE(error_message, recording_error, archive_error)
WHERE user_id IS NULL
   OR agora_uid IS NULL
   OR recording_resource_id IS NULL
   OR recording_sid IS NULL
   OR replay_url IS NULL
   OR error_message IS NULL;

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
    'stopping',
    'ended',
    'processing',
    'ready',
    'archiving',
    'posted',
    'failed'
  ));

CREATE INDEX IF NOT EXISTS idx_live_sessions_agora_webcam_processor
  ON public.live_sessions(status, updated_at ASC)
  WHERE mode = 'agora_webcam'
    AND status IN ('live', 'stopping', 'processing');

CREATE INDEX IF NOT EXISTS idx_live_sessions_user_status
  ON public.live_sessions(user_id, status, created_at DESC)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_live_sessions_replay_post_unique
  ON public.live_sessions(replay_post_id)
  WHERE replay_post_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_posts_live_replay_session_unique
  ON public.posts((metadata->>'live_session_id'))
  WHERE post_type = 'live_replay'
    AND metadata ? 'live_session_id'
    AND deleted_at IS NULL;

COMMENT ON COLUMN public.live_sessions.recording_resource_id IS
  'Agora Cloud Recording resourceId for server-side webcam recording.';
COMMENT ON COLUMN public.live_sessions.recording_sid IS
  'Agora Cloud Recording sid for server-side webcam recording.';
COMMENT ON COLUMN public.live_sessions.temp_object_key IS
  'R2 TEMP object key or common prefix produced by Agora Cloud Recording.';
COMMENT ON COLUMN public.live_sessions.archive_object_key IS
  'Primary R2 ARCHIVE replay object key.';;
