create type public.fun_game_reward_type as enum ('fun_money','camly_coin','xp','light_score','nft_badge','nft_item','mystery_box');
create type public.fun_game_reward_status as enum ('pending','approved','rejected','paid');
create type public.fun_game_rarity as enum ('common','rare','epic','legendary','cosmic');
create type public.fun_game_event_type as enum ('daily_light_quest','treasure_hunt','ai_pet','mystery_box','referral','season');

create table public.fun_game_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  xp bigint not null default 0 check (xp >= 0),
  light_score integer not null default 0 check (light_score >= 0),
  streak_days integer not null default 0 check (streak_days >= 0),
  last_daily_reset_at timestamptz,
  risk_score numeric(5,2) not null default 0 check (risk_score between 0 and 100),
  reward_multiplier numeric(5,2) not null default 1 check (reward_multiplier between 0 and 10),
  active_season text not null default 'season_1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.fun_game_quest_templates (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  description text not null,
  event_type public.fun_game_event_type not null default 'daily_light_quest',
  target_count integer not null default 1 check (target_count > 0),
  reward_type public.fun_game_reward_type not null,
  reward_amount numeric(18,6) not null default 0 check (reward_amount >= 0),
  light_score_delta integer not null default 0,
  cooldown_seconds integer not null default 0 check (cooldown_seconds >= 0),
  daily_cap integer not null default 1 check (daily_cap > 0),
  ai_moderation_required boolean not null default false,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.fun_game_daily_quests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  quest_template_id uuid not null references public.fun_game_quest_templates(id),
  quest_date date not null default current_date,
  progress_count integer not null default 0 check (progress_count >= 0),
  target_count integer not null check (target_count > 0),
  completed_at timestamptz,
  claimed_at timestamptz,
  expires_at timestamptz not null,
  proof jsonb not null default '{}'::jsonb,
  risk_score numeric(5,2) not null default 0 check (risk_score between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, quest_template_id, quest_date)
);

create table public.fun_game_treasure_events (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  description text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  max_claims integer check (max_claims is null or max_claims > 0),
  claim_count integer not null default 0 check (claim_count >= 0),
  geo_required boolean not null default false,
  qr_required boolean not null default false,
  team_size_min integer not null default 1 check (team_size_min > 0),
  reward_table jsonb not null default '[]'::jsonb,
  clues jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table public.fun_game_treasure_claims (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.fun_game_treasure_events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  team_id uuid,
  answer_hash text,
  qr_nonce_hash text,
  geo_confidence numeric(5,2) check (geo_confidence is null or geo_confidence between 0 and 100),
  status public.fun_game_reward_status not null default 'pending',
  risk_score numeric(5,2) not null default 0 check (risk_score between 0 and 100),
  proof jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (event_id, user_id)
);

create table public.fun_game_pets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null default 'Light Pet',
  personality_seed text not null default encode(gen_random_bytes(12),'hex'),
  level integer not null default 1 check (level > 0),
  xp bigint not null default 0 check (xp >= 0),
  energy integer not null default 100 check (energy between 0 and 100),
  mood integer not null default 80 check (mood between 0 and 100),
  aura integer not null default 1 check (aura >= 0),
  rarity public.fun_game_rarity not null default 'common',
  skills jsonb not null default '[]'::jsonb,
  equipped_skin_item_id uuid,
  last_interaction_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.fun_game_box_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  season text not null default 'season_1',
  rarity public.fun_game_rarity not null default 'common',
  probability_table jsonb not null,
  jackpot_budget numeric(18,6) not null default 0 check (jackpot_budget >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.fun_game_user_boxes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  box_type_id uuid not null references public.fun_game_box_types(id),
  source text not null,
  status text not null default 'unopened' check (status in ('unopened','opening','opened','void')),
  opened_at timestamptz,
  reward_ledger_id uuid,
  server_seed_hash text,
  client_seed text,
  nonce bigint not null default 0,
  created_at timestamptz not null default now()
);

create table public.fun_game_inventory_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_type text not null,
  rarity public.fun_game_rarity not null default 'common',
  title text not null,
  metadata jsonb not null default '{}'::jsonb,
  nft_chain_id integer,
  nft_contract_address text,
  nft_token_id text,
  transferable boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.fun_game_reward_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_type public.fun_game_event_type not null,
  source_id uuid,
  reward_type public.fun_game_reward_type not null,
  amount numeric(18,6) not null default 0 check (amount >= 0),
  status public.fun_game_reward_status not null default 'pending',
  idempotency_key text not null unique,
  chain_id integer,
  tx_hash text,
  risk_score numeric(5,2) not null default 0 check (risk_score between 0 and 100),
  review_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  paid_at timestamptz
);

create table public.fun_game_anti_cheat_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  severity text not null default 'info' check (severity in ('info','warning','critical')),
  risk_score numeric(5,2) not null default 0 check (risk_score between 0 and 100),
  signal jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index fun_game_daily_quests_user_date_idx on public.fun_game_daily_quests(user_id, quest_date desc);
create index fun_game_reward_ledger_user_created_idx on public.fun_game_reward_ledger(user_id, created_at desc);
create index fun_game_reward_ledger_status_idx on public.fun_game_reward_ledger(status, created_at);
create index fun_game_inventory_user_idx on public.fun_game_inventory_items(user_id, created_at desc);
create index fun_game_anti_cheat_user_idx on public.fun_game_anti_cheat_events(user_id, created_at desc);

alter table public.fun_game_profiles enable row level security;
alter table public.fun_game_quest_templates enable row level security;
alter table public.fun_game_daily_quests enable row level security;
alter table public.fun_game_treasure_events enable row level security;
alter table public.fun_game_treasure_claims enable row level security;
alter table public.fun_game_pets enable row level security;
alter table public.fun_game_box_types enable row level security;
alter table public.fun_game_user_boxes enable row level security;
alter table public.fun_game_inventory_items enable row level security;
alter table public.fun_game_reward_ledger enable row level security;
alter table public.fun_game_anti_cheat_events enable row level security;

create policy "Users can read own game profile" on public.fun_game_profiles for select using (auth.uid() = user_id);
create policy "Users can read active quest templates" on public.fun_game_quest_templates for select using (is_active = true);
create policy "Users can read own daily quests" on public.fun_game_daily_quests for select using (auth.uid() = user_id);
create policy "Users can read active treasure events" on public.fun_game_treasure_events for select using (is_active = true);
create policy "Users can read own treasure claims" on public.fun_game_treasure_claims for select using (auth.uid() = user_id);
create policy "Users can insert own treasure claims" on public.fun_game_treasure_claims for insert with check (auth.uid() = user_id);
create policy "Users can read own pet" on public.fun_game_pets for select using (auth.uid() = user_id);
create policy "Users can update own pet display state" on public.fun_game_pets for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can read active box types" on public.fun_game_box_types for select using (is_active = true);
create policy "Users can read own boxes" on public.fun_game_user_boxes for select using (auth.uid() = user_id);
create policy "Users can read own inventory" on public.fun_game_inventory_items for select using (auth.uid() = user_id);
create policy "Users can read own rewards" on public.fun_game_reward_ledger for select using (auth.uid() = user_id);
create policy "Users can read own anti-cheat audit events" on public.fun_game_anti_cheat_events for select using (auth.uid() = user_id);

create trigger fun_game_profiles_updated_at before update on public.fun_game_profiles for each row execute function public.update_updated_at_column();
create trigger fun_game_quest_templates_updated_at before update on public.fun_game_quest_templates for each row execute function public.update_updated_at_column();
create trigger fun_game_daily_quests_updated_at before update on public.fun_game_daily_quests for each row execute function public.update_updated_at_column();
create trigger fun_game_treasure_events_updated_at before update on public.fun_game_treasure_events for each row execute function public.update_updated_at_column();
create trigger fun_game_pets_updated_at before update on public.fun_game_pets for each row execute function public.update_updated_at_column();
create trigger fun_game_box_types_updated_at before update on public.fun_game_box_types for each row execute function public.update_updated_at_column();

insert into public.fun_game_quest_templates
  (code, title, description, target_count, reward_type, reward_amount, light_score_delta, cooldown_seconds, daily_cap, ai_moderation_required, metadata)
values
  ('positive_comment_1','Write 1 positive comment','Create one helpful or kind comment in the community.',1,'light_score',8,8,120,3,true,'{"surface":"feed","sentiment_min":0.65}'),
  ('create_post_1','Create 1 community post','Publish one original post that follows the Law of Light.',1,'fun_money',25,5,900,1,true,'{"surface":"feed"}'),
  ('meditate_5_min','Meditate 5 minutes','Complete one short light meditation session.',5,'xp',12,3,0,1,false,'{"unit":"minute"}'),
  ('play_minigame_1','Play 1 mini game','Complete one approved FUN Play mini game session.',1,'fun_money',15,2,300,5,false,'{"surface":"fun_play"}'),
  ('invite_friend_1','Invite 1 friend','Invite one new friend who completes onboarding.',1,'mystery_box',1,10,0,1,false,'{"requires_verified_signup":true}')
on conflict (code) do nothing;

insert into public.fun_game_box_types (code, title, season, rarity, probability_table, jackpot_budget)
values
  ('season_1_cosmic_box','Season 1 Cosmic Box','season_1','rare',
   '[{"rarity":"common","weight":6400,"reward_type":"fun_money","min":5,"max":25},
     {"rarity":"rare","weight":2400,"reward_type":"xp","min":20,"max":80},
     {"rarity":"epic","weight":900,"reward_type":"light_score","min":10,"max":40},
     {"rarity":"legendary","weight":270,"reward_type":"nft_badge","min":1,"max":1},
     {"rarity":"cosmic","weight":30,"reward_type":"camly_coin","min":1,"max":5}]'::jsonb,
   1000)
on conflict (code) do nothing;;
