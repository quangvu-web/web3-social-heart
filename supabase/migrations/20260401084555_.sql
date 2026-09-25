-- Expand canonical wallet records to support multiple wallet networks.

alter table public.user_wallets
  add column if not exists wallet_network text not null default 'EVM';

alter table public.user_wallets
  drop constraint if exists user_wallets_address_format_check;

alter table public.user_wallets
  add constraint user_wallets_wallet_network_check
  check (wallet_network in ('EVM', 'BTC_TESTNET'));

alter table public.user_wallets
  add constraint user_wallets_address_format_check
  check (
    (wallet_network = 'EVM' and address ~ '^0x[0-9a-f]{40}$')
    or
    (wallet_network = 'BTC_TESTNET' and address ~ '^tb1[0-9ac-hj-np-z]{11,71}$')
  );

alter table public.user_wallets
  drop constraint if exists user_wallets_address_unique;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_wallets_network_address_unique'
      and conrelid = 'public.user_wallets'::regclass
  ) then
    alter table public.user_wallets
      add constraint user_wallets_network_address_unique unique (wallet_network, address);
  end if;
end
$$;;
