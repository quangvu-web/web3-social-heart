
-- Add cooldown tracking column
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS last_wallet_changed_at timestamptz DEFAULT NULL;

-- Create/replace sync trigger function
CREATE OR REPLACE FUNCTION public.sync_primary_wallet_to_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  target_user_id uuid;
  primary_address text;
BEGIN
  target_user_id := COALESCE(NEW.user_id, OLD.user_id);
  
  SELECT address INTO primary_address
  FROM public.user_wallets
  WHERE user_id = target_user_id AND is_primary = true
  LIMIT 1;
  
  UPDATE public.profiles
  SET wallet_address = primary_address,
      last_wallet_changed_at = now()
  WHERE id = target_user_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Drop existing trigger if any to avoid conflict
DROP TRIGGER IF EXISTS trg_sync_wallet_to_profile ON public.user_wallets;

-- Create the trigger
CREATE TRIGGER trg_sync_wallet_to_profile
AFTER INSERT OR UPDATE OR DELETE ON public.user_wallets
FOR EACH ROW
EXECUTE FUNCTION public.sync_primary_wallet_to_profile();
;
