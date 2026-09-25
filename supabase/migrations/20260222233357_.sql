CREATE TABLE public.wallet_nonces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  chain_id integer NOT NULL,
  address text NOT NULL,
  nonce text NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_wallet_nonces_user_id ON public.wallet_nonces(user_id);
CREATE INDEX idx_wallet_nonces_lookup ON public.wallet_nonces(user_id, chain_id, address, nonce);

ALTER TABLE public.wallet_nonces ENABLE ROW LEVEL SECURITY;;
