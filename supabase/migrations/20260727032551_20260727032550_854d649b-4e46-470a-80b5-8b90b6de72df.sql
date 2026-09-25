
ALTER TABLE public.angel_last_question
  ADD COLUMN IF NOT EXISTS anchor_context text;
;
