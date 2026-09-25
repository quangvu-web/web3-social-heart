-- Create call_sessions table for tracking call history
CREATE TABLE public.call_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  initiator_id UUID NOT NULL,
  call_type TEXT NOT NULL CHECK (call_type IN ('voice', 'video')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ringing', 'active', 'ended', 'missed', 'declined')),
  channel_name TEXT NOT NULL UNIQUE,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create call_participants table
CREATE TABLE public.call_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_session_id UUID REFERENCES public.call_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  joined_at TIMESTAMPTZ,
  left_at TIMESTAMPTZ,
  is_muted BOOLEAN DEFAULT false,
  is_video_off BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_call_sessions_conversation ON public.call_sessions(conversation_id);
CREATE INDEX idx_call_sessions_status ON public.call_sessions(status);
CREATE INDEX idx_call_sessions_initiator ON public.call_sessions(initiator_id);
CREATE INDEX idx_call_participants_session ON public.call_participants(call_session_id);
CREATE INDEX idx_call_participants_user ON public.call_participants(user_id);

-- Enable RLS
ALTER TABLE public.call_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_participants ENABLE ROW LEVEL SECURITY;

-- RLS Policies for call_sessions
-- Users can view call sessions for conversations they're part of
CREATE POLICY "Users can view call sessions in their conversations"
  ON public.call_sessions FOR SELECT
  USING (is_conversation_participant(conversation_id, auth.uid()));

-- Users can create call sessions in conversations they're part of
CREATE POLICY "Users can create call sessions in their conversations"
  ON public.call_sessions FOR INSERT
  WITH CHECK (
    initiator_id = auth.uid() 
    AND is_conversation_participant(conversation_id, auth.uid())
  );

-- Participants can update call sessions (for status changes)
CREATE POLICY "Participants can update call sessions"
  ON public.call_sessions FOR UPDATE
  USING (is_conversation_participant(conversation_id, auth.uid()));

-- RLS Policies for call_participants
-- Users can view participants in call sessions they have access to
CREATE POLICY "Users can view call participants"
  ON public.call_participants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.call_sessions cs
      WHERE cs.id = call_participants.call_session_id
      AND is_conversation_participant(cs.conversation_id, auth.uid())
    )
  );

-- Users can add themselves as participants
CREATE POLICY "Users can join calls"
  ON public.call_participants FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.call_sessions cs
      WHERE cs.id = call_participants.call_session_id
      AND is_conversation_participant(cs.conversation_id, auth.uid())
    )
  );

-- Users can update their own participant record
CREATE POLICY "Users can update their participant status"
  ON public.call_participants FOR UPDATE
  USING (user_id = auth.uid());

-- Users can leave calls (delete their participant record)
CREATE POLICY "Users can leave calls"
  ON public.call_participants FOR DELETE
  USING (user_id = auth.uid());

-- Enable realtime for call notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_participants;

-- Create trigger to update updated_at
CREATE TRIGGER update_call_sessions_updated_at
  BEFORE UPDATE ON public.call_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();;
