ALTER TABLE public.posts
  DROP CONSTRAINT IF EXISTS posts_post_type_check;

ALTER TABLE public.posts
  ADD CONSTRAINT posts_post_type_check
  CHECK (post_type IN ('text', 'normal', 'video', 'live', 'live_replay'));

ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS recording_provider text NOT NULL DEFAULT 'agora',
  ADD COLUMN IF NOT EXISTS recording_error_code text,
  ADD COLUMN IF NOT EXISTS recording_error_message text,
  ADD COLUMN IF NOT EXISTS browser_recording_status text NOT NULL DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS browser_recording_warning text,
  ADD COLUMN IF NOT EXISTS browser_recording_chunk_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS browser_recording_total_bytes bigint NOT NULL DEFAULT 0;

UPDATE public.live_sessions
SET
  recording_provider = COALESCE(NULLIF(recording_provider, ''), 'agora'),
  browser_recording_status = COALESCE(NULLIF(browser_recording_status, ''), 'idle'),
  browser_recording_chunk_count = COALESCE(browser_recording_chunk_count, 0),
  browser_recording_total_bytes = COALESCE(browser_recording_total_bytes, 0);

ALTER TABLE public.live_sessions
  DROP CONSTRAINT IF EXISTS live_sessions_recording_provider_check;
ALTER TABLE public.live_sessions
  ADD CONSTRAINT live_sessions_recording_provider_check
  CHECK (recording_provider IN ('agora', 'browser', 'none'));

ALTER TABLE public.live_sessions
  DROP CONSTRAINT IF EXISTS live_sessions_browser_recording_status_check;
ALTER TABLE public.live_sessions
  ADD CONSTRAINT live_sessions_browser_recording_status_check
  CHECK (browser_recording_status IN ('idle', 'recording', 'uploading', 'uploaded', 'failed'));

ALTER TABLE public.live_sessions
  DROP CONSTRAINT IF EXISTS live_sessions_recording_status_check;
ALTER TABLE public.live_sessions
  ADD CONSTRAINT live_sessions_recording_status_check
  CHECK (recording_status IN (
    'idle','acquired','acquiring','starting','recording','uploading',
    'queued','stopping','processing','ready','stopped','failed','deleted'
  ));

CREATE TABLE IF NOT EXISTS public.live_recording_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  live_session_id uuid NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  post_id uuid REFERENCES public.posts(id) ON DELETE SET NULL,
  provider text NOT NULL DEFAULT 'browser',
  chunk_index integer NOT NULL,
  r2_bucket text NOT NULL,
  r2_key text NOT NULL,
  mime_type text,
  size_bytes bigint,
  duration_ms integer,
  uploaded_at timestamptz DEFAULT now(),
  status text DEFAULT 'uploaded',
  error_message text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT live_recording_chunks_provider_check CHECK (provider IN ('browser')),
  CONSTRAINT live_recording_chunks_status_check CHECK (status IN ('uploaded', 'failed')),
  CONSTRAINT live_recording_chunks_chunk_index_check CHECK (chunk_index >= 0)
);

CREATE INDEX IF NOT EXISTS idx_live_recording_chunks_session
  ON public.live_recording_chunks(live_session_id);
CREATE INDEX IF NOT EXISTS idx_live_recording_chunks_post
  ON public.live_recording_chunks(post_id);
CREATE INDEX IF NOT EXISTS idx_live_recording_chunks_session_chunk
  ON public.live_recording_chunks(live_session_id, chunk_index);
CREATE UNIQUE INDEX IF NOT EXISTS idx_live_recording_chunks_unique_provider_chunk
  ON public.live_recording_chunks(live_session_id, provider, chunk_index);
CREATE INDEX IF NOT EXISTS idx_live_sessions_active_agora_recordings
  ON public.live_sessions(recording_provider, recording_status, started_at DESC)
  WHERE recording_provider = 'agora'
    AND recording_status IN ('starting', 'recording');

ALTER TABLE public.live_recording_chunks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Hosts can view their browser recording chunks" ON public.live_recording_chunks;
CREATE POLICY "Hosts can view their browser recording chunks"
  ON public.live_recording_chunks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.live_sessions ls
      WHERE ls.id = live_recording_chunks.live_session_id
        AND COALESCE(ls.user_id, ls.host_user_id, ls.owner_id) = auth.uid()
    )
  );;
