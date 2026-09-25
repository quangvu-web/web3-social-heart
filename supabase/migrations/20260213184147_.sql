
-- Create live_comments table
CREATE TABLE public.live_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  live_session_id UUID NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.live_comments ENABLE ROW LEVEL SECURITY;

-- SELECT: anyone can view
CREATE POLICY "Anyone can view live comments"
  ON public.live_comments FOR SELECT
  USING (true);

-- INSERT: logged in user, user_id = auth.uid()
CREATE POLICY "Logged in users can post comments"
  ON public.live_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- DELETE: own comments only
CREATE POLICY "Users can delete own comments"
  ON public.live_comments FOR DELETE
  USING (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX idx_live_comments_session ON public.live_comments(live_session_id, created_at);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_comments;
;
