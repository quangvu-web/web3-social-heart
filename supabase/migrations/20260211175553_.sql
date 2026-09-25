
-- 1. Add post_type and metadata columns to posts table
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS post_type text NOT NULL DEFAULT 'normal';
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2. Create live_sessions table
CREATE TABLE IF NOT EXISTS public.live_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  host_user_id uuid NOT NULL REFERENCES public.profiles(id),
  channel_name text NOT NULL,
  title text NOT NULL DEFAULT '',
  privacy text NOT NULL DEFAULT 'public',
  status text NOT NULL DEFAULT 'live',
  viewer_count integer NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  post_id uuid REFERENCES public.posts(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_live_sessions_host ON public.live_sessions(host_user_id);
CREATE INDEX IF NOT EXISTS idx_live_sessions_status ON public.live_sessions(status);
CREATE INDEX IF NOT EXISTS idx_live_sessions_post ON public.live_sessions(post_id);

-- 4. Enable RLS
ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;

-- 5. RLS policies
CREATE POLICY "Host can create live sessions"
  ON public.live_sessions FOR INSERT
  WITH CHECK (auth.uid() = host_user_id);

CREATE POLICY "Host can update own live sessions"
  ON public.live_sessions FOR UPDATE
  USING (auth.uid() = host_user_id);

CREATE POLICY "Anyone can view live sessions"
  ON public.live_sessions FOR SELECT
  USING (true);

-- 6. Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_sessions;
;
