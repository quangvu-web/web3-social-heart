-- Phase 0.5: Canonicalize crypto_gifts RLS policy names
-- Drop legacy policy names (from 20260207070852)
DROP POLICY IF EXISTS "Users can insert their own gifts" ON public.crypto_gifts;
DROP POLICY IF EXISTS "Users can view their sent or received gifts" ON public.crypto_gifts;
DROP POLICY IF EXISTS "Users can update their own pending gifts" ON public.crypto_gifts;

-- Drop canonical names if they already exist (idempotent)
DROP POLICY IF EXISTS "crypto_gifts_select_own" ON public.crypto_gifts;
DROP POLICY IF EXISTS "crypto_gifts_insert_sender" ON public.crypto_gifts;
DROP POLICY IF EXISTS "crypto_gifts_update_sender" ON public.crypto_gifts;

-- Recreate with canonical names
CREATE POLICY "crypto_gifts_select_own"
  ON public.crypto_gifts FOR SELECT TO authenticated
  USING (from_user_id = auth.uid() OR to_user_id = auth.uid());

CREATE POLICY "crypto_gifts_insert_sender"
  ON public.crypto_gifts FOR INSERT TO authenticated
  WITH CHECK (from_user_id = auth.uid());

CREATE POLICY "crypto_gifts_update_sender"
  ON public.crypto_gifts FOR UPDATE TO authenticated
  USING (from_user_id = auth.uid())
  WITH CHECK (from_user_id = auth.uid());;
