
CREATE OR REPLACE FUNCTION public.find_user_id_by_email(p_email text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public', 'auth'
AS $$
  SELECT id FROM auth.users WHERE email = lower(p_email) LIMIT 1;
$$;
;
