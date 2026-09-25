
ALTER TABLE public.telegram_ai_conversations
  ALTER COLUMN chat_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'telegram',
  ADD COLUMN IF NOT EXISTS web_user_id uuid,
  ADD COLUMN IF NOT EXISTS web_conversation_id text;

CREATE INDEX IF NOT EXISTS idx_taic_source_created ON public.telegram_ai_conversations (source, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_taic_web_user_created ON public.telegram_ai_conversations (web_user_id, created_at DESC);

GRANT DELETE ON public.telegram_ai_conversations TO authenticated;

DROP POLICY IF EXISTS "admin delete ai conversations" ON public.telegram_ai_conversations;
CREATE POLICY "admin delete ai conversations"
  ON public.telegram_ai_conversations
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
;
