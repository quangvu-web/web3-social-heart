-- Add missing RLS policies for wallet_nonces insert
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='wallet_nonces' and policyname='Service insert nonces') then
    create policy "Service insert nonces" on public.wallet_nonces for insert with check (false);
  end if;
end
$$;;
