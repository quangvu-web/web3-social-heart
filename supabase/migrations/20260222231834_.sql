CREATE TABLE public.wallet_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  chain_id integer NOT NULL,
  address text NOT NULL,
  label text,
  verified_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wallet_links_user_chain_address_unique UNIQUE (user_id, chain_id, address),
  CONSTRAINT wallet_links_chain_address_unique UNIQUE (chain_id, address)
);

-- Indexes
CREATE INDEX idx_wallet_links_user_id ON public.wallet_links(user_id);
CREATE INDEX idx_wallet_links_address ON public.wallet_links(address);

-- RLS
ALTER TABLE public.wallet_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own wallets"
  ON public.wallet_links FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own wallets"
  ON public.wallet_links FOR DELETE
  USING (user_id = auth.uid());

-- Trigger: sync latest verified wallet back to profiles.external_wallet_address
CREATE OR REPLACE FUNCTION public.sync_wallet_link_to_profile()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  target_user uuid;
  latest_address text;
BEGIN
  target_user := COALESCE(NEW.user_id, OLD.user_id);

  SELECT wl.address INTO latest_address
  FROM wallet_links wl
  WHERE wl.user_id = target_user
  ORDER BY wl.verified_at DESC NULLS LAST, wl.created_at DESC
  LIMIT 1;

  UPDATE profiles
  SET external_wallet_address = latest_address
  WHERE id = target_user;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_sync_wallet_to_profile
  AFTER INSERT OR UPDATE OR DELETE ON public.wallet_links
  FOR EACH ROW EXECUTE FUNCTION public.sync_wallet_link_to_profile();

-- Migrate existing data: copy external_wallet_address into wallet_links
INSERT INTO public.wallet_links (user_id, chain_id, address, label, verified_at)
SELECT id, 56, lower(external_wallet_address), 'migrated', now()
FROM profiles
WHERE external_wallet_address IS NOT NULL AND external_wallet_address != ''
ON CONFLICT DO NOTHING;;
