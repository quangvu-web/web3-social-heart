ALTER TABLE public.angel_last_question
  ADD COLUMN IF NOT EXISTS chat_message_id BIGINT;

COMMENT ON COLUMN public.angel_last_question.chat_message_id IS
  'Telegram message_id của bot reply sinh ra anchor này (nullable, dùng để debug context bridge).';;
