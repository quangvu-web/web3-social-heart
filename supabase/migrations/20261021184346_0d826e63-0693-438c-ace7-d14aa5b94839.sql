CREATE TABLE public.caption_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_code TEXT UNIQUE NOT NULL,
  meeting_url TEXT NOT NULL,
  platform TEXT,
  recall_bot_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_by_telegram_id BIGINT,
  created_by_chat_id BIGINT,
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.caption_sessions TO anon;
GRANT SELECT ON public.caption_sessions TO authenticated;
GRANT ALL ON public.caption_sessions TO service_role;

ALTER TABLE public.caption_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view caption sessions"
  ON public.caption_sessions
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE TABLE public.caption_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.caption_sessions(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  speaker_name TEXT,
  source_lang TEXT,
  text_source TEXT NOT NULL,
  text_vi TEXT,
  text_en TEXT,
  ts_offset_sec NUMERIC,
  dedupe_key TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.caption_lines TO anon;
GRANT SELECT ON public.caption_lines TO authenticated;
GRANT ALL ON public.caption_lines TO service_role;

ALTER TABLE public.caption_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view caption lines"
  ON public.caption_lines
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE UNIQUE INDEX idx_caption_lines_session_dedupe
  ON public.caption_lines(session_id, dedupe_key);

CREATE INDEX idx_caption_lines_session_seq
  ON public.caption_lines(session_id, seq);

ALTER PUBLICATION supabase_realtime ADD TABLE public.caption_lines;