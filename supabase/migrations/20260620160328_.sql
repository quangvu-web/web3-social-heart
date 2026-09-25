
CREATE TABLE public.app_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_prefix text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  key_last4 text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','rotated','revoked')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  rotated_at timestamptz,
  revoked_at timestamptz
);

CREATE INDEX idx_app_api_keys_status ON public.app_api_keys(status);
CREATE INDEX idx_app_api_keys_hash ON public.app_api_keys(key_hash);

GRANT SELECT ON public.app_api_keys TO authenticated;
GRANT ALL ON public.app_api_keys TO service_role;

ALTER TABLE public.app_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view app api key metadata"
  ON public.app_api_keys
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
;
