
-- Create streams table for new browser-based livestream architecture
CREATE TABLE public.streams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text,
  video_path text,
  duration integer DEFAULT 0,
  status text NOT NULL DEFAULT 'recording',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.streams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view completed streams"
  ON public.streams FOR SELECT
  USING (status = 'completed');

CREATE POLICY "Users can view own streams"
  ON public.streams FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own streams"
  ON public.streams FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own streams"
  ON public.streams FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own streams"
  ON public.streams FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Storage RLS for videos bucket (already exists, public)
CREATE POLICY "Authenticated users can upload videos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'videos');

CREATE POLICY "Anyone can view videos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'videos');
;
