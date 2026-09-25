-- Add missing columns to live_sessions
ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS recording_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS recording_stopped_at timestamptz,
  ADD COLUMN IF NOT EXISTS recording_ready_at timestamptz,
  ADD COLUMN IF NOT EXISTS recording_error text,
  ADD COLUMN IF NOT EXISTS last_worker_response jsonb DEFAULT '{}'::jsonb;

-- Add missing columns to live_recordings
ALTER TABLE public.live_recordings
  ADD COLUMN IF NOT EXISTS duration_seconds integer,
  ADD COLUMN IF NOT EXISTS thumbnail_url text;

-- Add constraints (drop first to be safe)
ALTER TABLE public.live_recordings
  DROP CONSTRAINT IF EXISTS live_recordings_status_check;

ALTER TABLE public.live_recordings
  ADD CONSTRAINT live_recordings_status_check
  CHECK (status IN ('starting', 'recording', 'stopping', 'processing', 'ready', 'stopped', 'failed'));

ALTER TABLE public.live_sessions
  DROP CONSTRAINT IF EXISTS live_sessions_recording_status_check;

ALTER TABLE public.live_sessions
  ADD CONSTRAINT live_sessions_recording_status_check
  CHECK (recording_status IN ('idle', 'acquired', 'acquiring', 'starting', 'recording', 'stopping', 'processing', 'ready', 'stopped', 'failed'));;
