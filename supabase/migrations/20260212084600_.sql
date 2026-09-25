
-- 1. Add missing columns to live_sessions
ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS agora_uid_host integer,
  ADD COLUMN IF NOT EXISTS recording_uid integer,
  ADD COLUMN IF NOT EXISTS resource_id text,
  ADD COLUMN IF NOT EXISTS sid text,
  ADD COLUMN IF NOT EXISTS recording_status text DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS recording_acquired_at timestamptz;

-- Backfill owner_id from host_user_id
UPDATE public.live_sessions SET owner_id = host_user_id WHERE owner_id IS NULL;

-- Index for recording status queries
CREATE INDEX IF NOT EXISTS idx_live_sessions_recording_status ON public.live_sessions(recording_status);

-- Revoke sensitive columns from anon/authenticated
REVOKE SELECT(resource_id, sid) ON public.live_sessions FROM anon, authenticated;
GRANT SELECT(resource_id, sid) ON public.live_sessions TO service_role;

-- 2. Create live_recordings table
CREATE TABLE IF NOT EXISTS public.live_recordings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  live_id uuid REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  resource_id text,
  sid text,
  recorder_uid text,
  mode text DEFAULT 'composite',
  status text DEFAULT 'recording',
  storage_vendor integer,
  storage_region integer,
  file_list_json jsonb DEFAULT '[]'::jsonb,
  media_url text,
  raw_response jsonb,
  stopped_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.live_recordings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Host can view own recordings"
  ON public.live_recordings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.live_sessions ls
      WHERE ls.id = live_recordings.live_id
        AND ls.host_user_id = auth.uid()
    )
  );

CREATE POLICY "Service role manages recordings"
  ON public.live_recordings FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 3. Create feed_posts table
CREATE TABLE IF NOT EXISTS public.feed_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid REFERENCES public.profiles(id),
  type text DEFAULT 'video',
  title text,
  caption text,
  media_key text,
  media_url text,
  source text DEFAULT 'agora_recording',
  recording_id uuid REFERENCES public.live_recordings(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.feed_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view feed posts"
  ON public.feed_posts FOR SELECT
  USING (true);

CREATE POLICY "Authors can manage own feed posts"
  ON public.feed_posts FOR ALL
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);
;
