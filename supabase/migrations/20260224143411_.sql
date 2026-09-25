-- Unified auth canonical wallet schema: user_wallets + nonce/audit/rate-limit tables
create extension if not exists pgcrypto;

create table if not exists public.user_wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  address text not null,
  chain_id integer null,
  is_primary boolean not null default false,
  verified_at timestamptz null,
  created_at timestamptz not null default now(),
  constraint user_wallets_address_format_check check (address ~ '^0x[0-9a-f]{40}$')
);

alter table public.user_wallets
  drop constraint if exists user_wallets_address_key;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'user_wallets_address_unique'
      and conrelid = 'public.user_wallets'::regclass
  ) then
    alter table public.user_wallets
      add constraint user_wallets_address_unique unique (address);
  end if;
end
$$;

create unique index if not exists user_wallets_one_primary_per_user_idx
  on public.user_wallets (user_id)
  where is_primary = true;

create index if not exists user_wallets_user_id_created_at_idx
  on public.user_wallets (user_id, created_at desc);

-- Ensure wallet_nonces has all needed columns
alter table public.wallet_nonces
  add column if not exists purpose text,
  add column if not exists requested_by_user_id uuid,
  add column if not exists issued_at timestamptz,
  add column if not exists used_at timestamptz;

update public.wallet_nonces
set purpose = 'link'
where purpose is null;

-- wallet_auth_attempts
create table if not exists public.wallet_auth_attempts (
  id uuid primary key default gen_random_uuid(),
  attempt_type text not null,
  address text null,
  user_id uuid null references auth.users(id) on delete set null,
  success boolean not null,
  reason text null,
  ip_hash text null,
  ua_hash text null,
  created_at timestamptz not null default now(),
  constraint wallet_auth_attempts_attempt_type_check check (attempt_type in ('nonce', 'link', 'login'))
);

create index if not exists wallet_auth_attempts_created_at_idx
  on public.wallet_auth_attempts (created_at);

create index if not exists wallet_auth_attempts_address_created_at_idx
  on public.wallet_auth_attempts (address, created_at desc);

-- wallet_rate_limits
create table if not exists public.wallet_rate_limits (
  key text primary key,
  window_start timestamptz not null,
  count integer not null default 0,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists wallet_rate_limits_expires_at_idx
  on public.wallet_rate_limits (expires_at);

create or replace function public.touch_wallet_rate_limits_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists wallet_rate_limits_set_updated_at on public.wallet_rate_limits;
create trigger wallet_rate_limits_set_updated_at
before update on public.wallet_rate_limits
for each row execute function public.touch_wallet_rate_limits_updated_at();

-- RLS
alter table public.user_wallets enable row level security;
alter table public.wallet_auth_attempts enable row level security;
alter table public.wallet_rate_limits enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_wallets'
      and policyname = 'Users can view own wallets'
  ) then
    create policy "Users can view own wallets"
    on public.user_wallets for select to authenticated
    using ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_wallets'
      and policyname = 'Users can insert own wallets'
  ) then
    create policy "Users can insert own wallets"
    on public.user_wallets for insert to authenticated
    with check ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_wallets'
      and policyname = 'Users can update own wallets'
  ) then
    create policy "Users can update own wallets"
    on public.user_wallets for update to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_wallets'
      and policyname = 'Users can delete own wallets'
  ) then
    create policy "Users can delete own wallets"
    on public.user_wallets for delete to authenticated
    using ((select auth.uid()) = user_id);
  end if;
end
$$;

-- Backfill from wallet_links if present
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'wallet_links'
  ) then
    insert into public.user_wallets (user_id, address, chain_id, verified_at, created_at)
    select wl.user_id, wl.address, wl.chain_id, wl.verified_at, wl.created_at
    from public.wallet_links wl
    where wl.address ~ '^0x[0-9a-f]{40}$'
    on conflict (address) do nothing;
  end if;
end
$$;

-- Backfill from profiles.external_wallet_address
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'external_wallet_address'
  ) then
    execute $sql$
      insert into public.user_wallets (user_id, address, chain_id, verified_at, created_at)
      select p.id, lower(trim(p.external_wallet_address)), 56, now(), now()
      from public.profiles p
      where p.external_wallet_address is not null
        and lower(trim(p.external_wallet_address)) ~ '^0x[0-9a-f]{40}$'
      on conflict (address) do nothing
    $sql$;
  end if;
end
$$;

-- Normalize addresses
update public.user_wallets set address = lower(address) where address <> lower(address);

-- Set primary wallets
with ranked as (
  select uw.id, uw.user_id,
    row_number() over (partition by uw.user_id order by coalesce(uw.verified_at, uw.created_at) desc, uw.created_at desc) as rn
  from public.user_wallets uw
)
update public.user_wallets uw
set is_primary = (ranked.rn = 1)
from ranked
where ranked.id = uw.id;

-- Sync trigger
create or replace function public.sync_profiles_legacy_wallet_fields(p_user_id uuid)
returns void language plpgsql as $$
declare
  primary_wallet text;
  set_clauses text[] := array[]::text[];
  has_col boolean;
begin
  select uw.address into primary_wallet
  from public.user_wallets uw
  where uw.user_id = p_user_id
  order by uw.is_primary desc, coalesce(uw.verified_at, uw.created_at) desc
  limit 1;

  select exists (select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='external_wallet_address') into has_col;
  if has_col then set_clauses := array_append(set_clauses, format('external_wallet_address = %L', primary_wallet)); end if;

  select exists (select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='wallet_address') into has_col;
  if has_col then set_clauses := array_append(set_clauses, format('wallet_address = %L', primary_wallet)); end if;

  select exists (select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='default_wallet_type') into has_col;
  if has_col and primary_wallet is not null then set_clauses := array_append(set_clauses, 'default_wallet_type = ''external'''); end if;

  if array_length(set_clauses, 1) > 0 then
    execute format('update public.profiles set %s where id = %L', array_to_string(set_clauses, ', '), p_user_id);
  end if;
end;
$$;

create or replace function public.sync_profiles_wallet_legacy_trigger()
returns trigger language plpgsql as $$
declare affected_user uuid;
begin
  affected_user := coalesce(new.user_id, old.user_id);
  if affected_user is not null then
    perform public.sync_profiles_legacy_wallet_fields(affected_user);
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_sync_profiles_wallet_legacy_on_user_wallets on public.user_wallets;
create trigger trg_sync_profiles_wallet_legacy_on_user_wallets
after insert or update or delete on public.user_wallets
for each row execute function public.sync_profiles_wallet_legacy_trigger();;
