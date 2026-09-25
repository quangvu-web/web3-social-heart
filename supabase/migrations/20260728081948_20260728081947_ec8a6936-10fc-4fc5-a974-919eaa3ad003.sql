create table if not exists public.angel_fal_image_usage (
  id uuid primary key default gen_random_uuid(),
  user_ref text not null,
  usage_day date not null,
  count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_ref, usage_day)
);
create index if not exists idx_angel_fal_image_usage_user_day
  on public.angel_fal_image_usage (user_ref, usage_day);
grant select, insert, update, delete on public.angel_fal_image_usage to authenticated;
grant all on public.angel_fal_image_usage to service_role;
alter table public.angel_fal_image_usage enable row level security;
create policy "Admin can view fal usage"
  on public.angel_fal_image_usage
  for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));
insert into public.angel_feature_flags (key, enabled, description, meta)
values ('image.fal_enabled', true, 'Bật P5 fallback fal.ai khi P1-P4 fail',
  jsonb_build_object(
    'model_default','fal-ai/flux/schnell',
    'model_logo','fal-ai/ideogram/v2',
    'model_heavy','fal-ai/flux-pro/v1.1'
  ))
on conflict (key) do nothing;;
