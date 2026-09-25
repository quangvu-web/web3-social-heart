
-- 1. Add agora_channel column to live_sessions
ALTER TABLE public.live_sessions ADD COLUMN IF NOT EXISTS agora_channel text;
UPDATE public.live_sessions SET agora_channel = channel_name WHERE agora_channel IS NULL;

-- 2. Create live_messages table
CREATE TABLE public.live_messages (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.live_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view live messages"
  ON public.live_messages FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can send messages"
  ON public.live_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_live_messages_session_created ON public.live_messages (session_id, created_at);

-- 3. Create live_reactions table
CREATE TABLE public.live_reactions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  emoji text NOT NULL DEFAULT 'heart',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.live_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view live reactions"
  ON public.live_reactions FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can send reactions"
  ON public.live_reactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_live_reactions_session_created ON public.live_reactions (session_id, created_at);

-- 4. Enable realtime for both new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_reactions;
;
