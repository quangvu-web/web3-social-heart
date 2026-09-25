
CREATE TABLE public.angel_last_question (
  scope_key text PRIMARY KEY,
  question text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.angel_last_question TO authenticated;
GRANT ALL ON public.angel_last_question TO service_role;

ALTER TABLE public.angel_last_question ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_manage_last_question"
  ON public.angel_last_question
  FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX idx_angel_last_question_updated_at
  ON public.angel_last_question (updated_at DESC);
;
