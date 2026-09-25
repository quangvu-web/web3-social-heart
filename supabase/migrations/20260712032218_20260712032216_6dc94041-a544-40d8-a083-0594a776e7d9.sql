
CREATE TABLE public.angel_youtube_transcript_cache (
  video_id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  title TEXT,
  author TEXT,
  language TEXT,
  is_auto BOOLEAN DEFAULT false,
  transcript TEXT,
  failure_reason TEXT,
  hit_count INTEGER NOT NULL DEFAULT 0,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.angel_youtube_transcript_cache TO service_role;

ALTER TABLE public.angel_youtube_transcript_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON public.angel_youtube_transcript_cache
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX idx_angel_yt_cache_expires ON public.angel_youtube_transcript_cache(expires_at);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_angel_yt_cache_updated_at
  BEFORE UPDATE ON public.angel_youtube_transcript_cache
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
;
