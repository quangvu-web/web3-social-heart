-- Add verification columns to telegram_community_settings
ALTER TABLE public.telegram_community_settings
  ADD COLUMN IF NOT EXISTS verification_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS verification_timeout_seconds integer NOT NULL DEFAULT 180,
  ADD COLUMN IF NOT EXISTS verification_max_attempts integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS verification_failure_action text NOT NULL DEFAULT 'kick',
  ADD COLUMN IF NOT EXISTS verification_prompt_message text NOT NULL DEFAULT 'Welcome {full_name}! Please verify you are human before chatting: {question}',
  ADD COLUMN IF NOT EXISTS verification_success_message text NOT NULL DEFAULT 'Verified. Welcome to FUN.RICH, {full_name}!',
  ADD COLUMN IF NOT EXISTS verification_failed_message text NOT NULL DEFAULT '{full_name} did not complete verification in time.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'telegram_community_verification_failure_action_check'
  ) THEN
    ALTER TABLE public.telegram_community_settings
      ADD CONSTRAINT telegram_community_verification_failure_action_check
      CHECK (verification_failure_action IN ('kick', 'mute'))
      NOT VALID;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.telegram_community_verification_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id bigint NOT NULL,
  telegram_user_id bigint NOT NULL,
  username text,
  full_name text,
  question text NOT NULL,
  correct_answer integer NOT NULL,
  options integer[] NOT NULL,
  captcha_message_id bigint,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz,
  CONSTRAINT telegram_community_verification_status_check
    CHECK (status IN ('pending', 'verified', 'failed', 'expired'))
);

GRANT SELECT ON public.telegram_community_verification_challenges TO authenticated;
GRANT ALL ON public.telegram_community_verification_challenges TO service_role;

CREATE INDEX IF NOT EXISTS telegram_community_verification_pending_idx
  ON public.telegram_community_verification_challenges(group_id, telegram_user_id, expires_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS telegram_community_verification_expires_idx
  ON public.telegram_community_verification_challenges(expires_at)
  WHERE status = 'pending';

ALTER TABLE public.telegram_community_verification_challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read telegram community verification challenges"
  ON public.telegram_community_verification_challenges;
CREATE POLICY "Admins read telegram community verification challenges"
  ON public.telegram_community_verification_challenges FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS telegram_community_verification_touch
  ON public.telegram_community_verification_challenges;
CREATE TRIGGER telegram_community_verification_touch
BEFORE UPDATE ON public.telegram_community_verification_challenges
FOR EACH ROW EXECUTE FUNCTION public.telegram_community_touch_updated_at();;
