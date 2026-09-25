
CREATE TABLE public.telegram_feedback (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NOT NULL CHECK (source IN ('dm','group')),
  chat_id BIGINT,
  chat_title TEXT,
  telegram_user_id BIGINT,
  username TEXT,
  display_name TEXT,
  message_id BIGINT,
  content TEXT NOT NULL,
  reply_to_message_id BIGINT,
  reply_to_preview TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','reviewing','resolved','archived')),
  admin_note TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID
);

CREATE INDEX idx_telegram_feedback_created_at ON public.telegram_feedback (created_at DESC);
CREATE INDEX idx_telegram_feedback_status ON public.telegram_feedback (status);
CREATE INDEX idx_telegram_feedback_user ON public.telegram_feedback (telegram_user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_feedback TO authenticated;
GRANT ALL ON public.telegram_feedback TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.telegram_feedback_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.telegram_feedback_id_seq TO service_role;

ALTER TABLE public.telegram_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view feedback"
ON public.telegram_feedback FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update feedback"
ON public.telegram_feedback FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete feedback"
ON public.telegram_feedback FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
;
