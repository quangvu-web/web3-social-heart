
CREATE TABLE public.telegram_group_mutes (
  id uuid primary key default gen_random_uuid(),
  group_id bigint not null,
  tg_user_id bigint not null,
  tg_username text,
  muted_until timestamptz not null,
  reason text,
  created_at timestamptz not null default now(),
  unique (group_id, tg_user_id)
);
CREATE INDEX idx_telegram_group_mutes_until ON public.telegram_group_mutes (muted_until);

GRANT SELECT ON public.telegram_group_mutes TO authenticated;
GRANT ALL ON public.telegram_group_mutes TO service_role;

ALTER TABLE public.telegram_group_mutes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read mutes"
  ON public.telegram_group_mutes
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
;
