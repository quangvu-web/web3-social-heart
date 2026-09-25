ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS telegram_chat_id text,
  ADD COLUMN IF NOT EXISTS telegram_username text,
  ADD COLUMN IF NOT EXISTS telegram_2fa_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS telegram_linked_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_telegram_chat_id_unique
  ON public.profiles (telegram_chat_id)
  WHERE telegram_chat_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.telegram_link_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.telegram_link_tokens TO authenticated;
GRANT ALL ON public.telegram_link_tokens TO service_role;

CREATE INDEX IF NOT EXISTS telegram_link_tokens_user_id_idx
  ON public.telegram_link_tokens (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS telegram_link_tokens_expires_at_idx
  ON public.telegram_link_tokens (expires_at);

CREATE TABLE IF NOT EXISTS public.telegram_otp_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  first_factor text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT telegram_otp_challenges_first_factor_check
    CHECK (first_factor IN ('email_otp', 'wallet', 'password'))
);

GRANT SELECT ON public.telegram_otp_challenges TO authenticated;
GRANT ALL ON public.telegram_otp_challenges TO service_role;

CREATE INDEX IF NOT EXISTS telegram_otp_challenges_user_id_idx
  ON public.telegram_otp_challenges (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS telegram_otp_challenges_expires_at_idx
  ON public.telegram_otp_challenges (expires_at);

ALTER TABLE public.telegram_link_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_otp_challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own telegram link tokens" ON public.telegram_link_tokens;
CREATE POLICY "Users can read own telegram link tokens"
  ON public.telegram_link_tokens FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own telegram otp challenges" ON public.telegram_otp_challenges;
CREATE POLICY "Users can read own telegram otp challenges"
  ON public.telegram_otp_challenges FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);;
