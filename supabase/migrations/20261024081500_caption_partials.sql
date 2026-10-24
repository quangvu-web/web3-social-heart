CREATE TABLE public.caption_partials (
  session_id uuid PRIMARY KEY REFERENCES public.caption_sessions(id) ON DELETE CASCADE,
  speaker_name text,
  text_source text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.caption_partials TO anon, authenticated;
GRANT ALL ON public.caption_partials TO service_role;

ALTER TABLE public.caption_partials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view caption partials"
  ON public.caption_partials
  FOR SELECT
  TO anon, authenticated
  USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.caption_partials;
