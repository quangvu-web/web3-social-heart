
-- Add trust_level, email_claimed, email_verified_at, wallet_verified_at to profiles if missing
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trust_level integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS email_claimed text,
  ADD COLUMN IF NOT EXISTS email_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS wallet_verified_at timestamptz;
;
