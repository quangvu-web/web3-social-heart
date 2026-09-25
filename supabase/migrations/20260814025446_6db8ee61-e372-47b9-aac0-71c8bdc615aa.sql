ALTER TABLE public.telegram_community_settings
  ADD COLUMN IF NOT EXISTS join_guard_name_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS join_guard_name_keywords text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS join_guard_name_allowlist text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS join_guard_avatar_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS join_guard_avatar_threshold text NOT NULL DEFAULT 'explicit',
  ADD COLUMN IF NOT EXISTS join_guard_action text NOT NULL DEFAULT 'ban';

CREATE TABLE IF NOT EXISTS public.telegram_join_avatar_scans (
  file_unique_id text PRIMARY KEY,
  verdict text NOT NULL,
  score numeric NOT NULL DEFAULT 0,
  reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT ALL ON public.telegram_join_avatar_scans TO service_role;
GRANT SELECT ON public.telegram_join_avatar_scans TO authenticated;

ALTER TABLE public.telegram_join_avatar_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view avatar scans"
ON public.telegram_join_avatar_scans
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_telegram_join_avatar_scans_updated_at
BEFORE UPDATE ON public.telegram_join_avatar_scans
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();;
