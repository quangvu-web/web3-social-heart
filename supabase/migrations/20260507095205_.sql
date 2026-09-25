-- Archive Cloudflare Stream live replays to R2 and remove Stream as long-term storage.

ALTER TABLE public.live_replays
  ADD COLUMN IF NOT EXISTS cloudflare_playback_url text,
  ADD COLUMN IF NOT EXISTS cloudflare_mp4_download_url text,
  ADD COLUMN IF NOT EXISTS r2_object_key text,
  ADD COLUMN IF NOT EXISTS r2_bucket text,
  ADD COLUMN IF NOT EXISTS r2_video_url text,
  ADD COLUMN IF NOT EXISTS storage_provider text NOT NULL DEFAULT 'cloudflare_stream',
  ADD COLUMN IF NOT EXISTS playback_provider text NOT NULL DEFAULT 'cloudflare_stream',
  ADD COLUMN IF NOT EXISTS archive_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS archive_error text,
  ADD COLUMN IF NOT EXISTS archive_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_archive_retry_at timestamptz,
  ADD COLUMN IF NOT EXISTS processing_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS stream_deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS auto_posted_at timestamptz;

ALTER TABLE public.live_replays
  DROP CONSTRAINT IF EXISTS live_replays_archive_status_check;
ALTER TABLE public.live_replays
  ADD CONSTRAINT live_replays_archive_status_check
  CHECK (archive_status IN ('pending', 'mp4_pending', 'archiving', 'archived', 'failed'));

ALTER TABLE public.live_replays
  DROP CONSTRAINT IF EXISTS live_replays_storage_provider_check;
ALTER TABLE public.live_replays
  ADD CONSTRAINT live_replays_storage_provider_check
  CHECK (storage_provider IN ('cloudflare_stream', 'r2'));

ALTER TABLE public.live_replays
  DROP CONSTRAINT IF EXISTS live_replays_playback_provider_check;
ALTER TABLE public.live_replays
  ADD CONSTRAINT live_replays_playback_provider_check
  CHECK (playback_provider IN ('cloudflare_stream', 'r2'));

CREATE INDEX IF NOT EXISTS idx_live_replays_archive_retry
  ON public.live_replays(next_archive_retry_at ASC, updated_at ASC)
  WHERE archive_status IN ('pending', 'mp4_pending', 'failed') AND stream_deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_live_replays_r2_object_key
  ON public.live_replays(r2_object_key)
  WHERE r2_object_key IS NOT NULL;

ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS storage_provider text,
  ADD COLUMN IF NOT EXISTS playback_provider text,
  ADD COLUMN IF NOT EXISTS cloudflare_playback_url text,
  ADD COLUMN IF NOT EXISTS cloudflare_mp4_download_url text,
  ADD COLUMN IF NOT EXISTS r2_object_key text,
  ADD COLUMN IF NOT EXISTS r2_bucket text,
  ADD COLUMN IF NOT EXISTS r2_video_url text,
  ADD COLUMN IF NOT EXISTS archive_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS archive_error text,
  ADD COLUMN IF NOT EXISTS processing_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS stream_deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS auto_posted_at timestamptz;

ALTER TABLE public.live_sessions
  DROP CONSTRAINT IF EXISTS live_sessions_archive_status_check;
ALTER TABLE public.live_sessions
  ADD CONSTRAINT live_sessions_archive_status_check
  CHECK (archive_status IN ('pending', 'mp4_pending', 'archiving', 'archived', 'failed'));

CREATE TABLE IF NOT EXISTS public.creator_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id uuid REFERENCES public.posts(id) ON DELETE SET NULL,
  live_session_id uuid REFERENCES public.live_sessions(id) ON DELETE SET NULL,
  live_replay_id uuid REFERENCES public.live_replays(id) ON DELETE SET NULL,
  title text,
  media_type text NOT NULL DEFAULT 'video',
  storage_provider text NOT NULL DEFAULT 'r2',
  playback_provider text NOT NULL DEFAULT 'r2',
  r2_object_key text NOT NULL,
  r2_bucket text,
  video_url text NOT NULL,
  thumbnail_url text,
  duration_seconds integer,
  filesize_bytes bigint,
  source_stream_uid text,
  status text NOT NULL DEFAULT 'ready',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT creator_library_media_type_check CHECK (media_type IN ('video')),
  CONSTRAINT creator_library_status_check CHECK (status IN ('ready', 'deleted', 'failed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_creator_library_live_replay_unique
  ON public.creator_library(live_replay_id)
  WHERE live_replay_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_creator_library_user_created
  ON public.creator_library(user_id, created_at DESC)
  WHERE deleted_at IS NULL;

ALTER TABLE public.creator_library ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Creator library owners can read" ON public.creator_library;
CREATE POLICY "Creator library owners can read"
ON public.creator_library
FOR SELECT
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Service role manages creator library" ON public.creator_library;
CREATE POLICY "Service role manages creator library"
ON public.creator_library
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');;
