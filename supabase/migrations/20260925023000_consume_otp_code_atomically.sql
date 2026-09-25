-- Keep the existing table protected by RLS. The function below is callable
-- only by the Edge Function's service_role client.
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.consume_otp_code(
  p_otp_id uuid,
  p_identifier text,
  p_code text
)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  UPDATE public.otp_codes
  SET is_used = true
  WHERE id = p_otp_id
    AND identifier = lower(btrim(p_identifier))
    AND code = p_code
    AND is_used = false
    AND expires_at > now()
  RETURNING otp_codes.id;
$$;

REVOKE ALL ON FUNCTION public.consume_otp_code(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_otp_code(uuid, text, text) TO service_role;
