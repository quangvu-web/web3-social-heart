
-- Add missing columns to crypto_gifts
ALTER TABLE public.crypto_gifts
  ADD COLUMN IF NOT EXISTS message_id uuid REFERENCES public.messages(id),
  ADD COLUMN IF NOT EXISTS chain_id int NOT NULL DEFAULT 56;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_crypto_gifts_message_id ON public.crypto_gifts(message_id);
CREATE INDEX IF NOT EXISTS idx_crypto_gifts_conversation_id ON public.crypto_gifts(conversation_id);

-- Trigger to protect immutable fields
CREATE OR REPLACE FUNCTION public.crypto_gifts_validate_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.to_user_id IS DISTINCT FROM OLD.to_user_id
    OR NEW.to_address IS DISTINCT FROM OLD.to_address
    OR NEW.token IS DISTINCT FROM OLD.token
    OR NEW.amount_numeric IS DISTINCT FROM OLD.amount_numeric
    OR NEW.chain_id IS DISTINCT FROM OLD.chain_id
    OR NEW.conversation_id IS DISTINCT FROM OLD.conversation_id
    OR NEW.from_user_id IS DISTINCT FROM OLD.from_user_id
  THEN
    RAISE EXCEPTION 'Cannot modify immutable fields';
  END IF;
  IF NEW.tx_hash IS DISTINCT FROM OLD.tx_hash AND OLD.tx_hash IS NOT NULL THEN
    RAISE EXCEPTION 'tx_hash can only be set once';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status != 'pending' OR NEW.status NOT IN ('confirmed', 'failed') THEN
      RAISE EXCEPTION 'Invalid status transition';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS crypto_gifts_validate_update_trg ON public.crypto_gifts;
CREATE TRIGGER crypto_gifts_validate_update_trg
  BEFORE UPDATE ON public.crypto_gifts
  FOR EACH ROW EXECUTE FUNCTION public.crypto_gifts_validate_update();
;
