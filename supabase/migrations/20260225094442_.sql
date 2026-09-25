
-- 1. siwe_nonces: store SIWE nonces for wallet-first login
CREATE TABLE public.siwe_nonces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  address text NOT NULL,
  nonce text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.siwe_nonces ENABLE ROW LEVEL SECURITY;
-- No RLS policies — only edge functions with service role key access this table

CREATE INDEX idx_siwe_nonces_address_nonce ON public.siwe_nonces (address, nonce);

-- 2. email_link_otps: store hashed OTPs for email verification on wallet-first accounts
CREATE TABLE public.email_link_otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text NOT NULL,
  otp_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_link_otps ENABLE ROW LEVEL SECURITY;
-- No RLS policies — only edge functions with service role key access this table

CREATE INDEX idx_email_link_otps_user_email ON public.email_link_otps (user_id, email);
;
