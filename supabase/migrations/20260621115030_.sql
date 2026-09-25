
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS language text DEFAULT 'vi',
  ADD COLUMN IF NOT EXISTS synced_with_fun_api_at timestamptz;

UPDATE public.profiles SET display_name = full_name WHERE display_name IS NULL AND full_name IS NOT NULL AND full_name <> '';
UPDATE public.profiles SET email = email_claimed WHERE email IS NULL AND email_claimed IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_unique_idx ON public.profiles(email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_fun_id_unique_idx ON public.profiles(fun_id) WHERE fun_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

CREATE TABLE IF NOT EXISTS public.fun_api_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('success','error')),
  error_message text,
  request_payload jsonb,
  response_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.fun_api_sync_log TO service_role;
ALTER TABLE public.fun_api_sync_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service role only" ON public.fun_api_sync_log;
CREATE POLICY "service role only" ON public.fun_api_sync_log FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS fun_api_sync_log_user_idx ON public.fun_api_sync_log(user_id, created_at DESC);

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
;
