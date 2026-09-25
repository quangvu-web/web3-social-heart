-- Create crypto_gifts table for tracking crypto gift transactions
CREATE TABLE public.crypto_gifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  from_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  to_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  to_address text NOT NULL,
  token text NOT NULL CHECK (token IN ('BNB', 'CAMLY', 'USDT')),
  amount_numeric numeric NOT NULL CHECK (amount_numeric > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed')),
  tx_hash text,
  error text,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL
);

-- Enable RLS
ALTER TABLE public.crypto_gifts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can insert their own gifts"
  ON public.crypto_gifts FOR INSERT
  WITH CHECK (auth.uid() = from_user_id);

CREATE POLICY "Users can view their sent or received gifts"
  ON public.crypto_gifts FOR SELECT
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

CREATE POLICY "Users can update their own pending gifts"
  ON public.crypto_gifts FOR UPDATE
  USING (auth.uid() = from_user_id);

-- Index for faster queries
CREATE INDEX idx_crypto_gifts_from_user ON public.crypto_gifts(from_user_id);
CREATE INDEX idx_crypto_gifts_to_user ON public.crypto_gifts(to_user_id);
CREATE INDEX idx_crypto_gifts_created_at ON public.crypto_gifts(created_at DESC);;
