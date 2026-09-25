-- FUN.Rich Mini Game MVP RPCs
create or replace function public.fun_game_ensure_profile()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.fun_game_profiles%rowtype;
  v_pet public.fun_game_pets%rowtype;
  v_box_type_id uuid;
  v_unopened_boxes integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  insert into public.fun_game_profiles (user_id)
  values (v_user_id)
  on conflict (user_id) do update set updated_at = now()
  returning * into v_profile;

  insert into public.fun_game_pets (user_id)
  values (v_user_id)
  on conflict (user_id) do update set updated_at = now()
  returning * into v_pet;

  select id into v_box_type_id
  from public.fun_game_box_types
  where code = 'season_1_cosmic_box' and is_active = true
  limit 1;

  if v_box_type_id is not null and not exists (
    select 1 from public.fun_game_user_boxes where user_id = v_user_id
  ) then
    insert into public.fun_game_user_boxes (user_id, box_type_id, source, server_seed_hash)
    values (v_user_id, v_box_type_id, 'welcome', encode(extensions.gen_random_bytes(32), 'hex'));
  end if;

  select count(*) into v_unopened_boxes
  from public.fun_game_user_boxes
  where user_id = v_user_id and status = 'unopened';

  return jsonb_build_object(
    'profile', to_jsonb(v_profile),
    'pet', to_jsonb(v_pet),
    'unopened_boxes', v_unopened_boxes
  );
end;
$$;

create or replace function public.fun_game_assign_daily_quests()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_quests jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  perform public.fun_game_ensure_profile();

  insert into public.fun_game_daily_quests (
    user_id, quest_template_id, quest_date, target_count, expires_at
  )
  select v_user_id, t.id, current_date, t.target_count, (current_date + 1)::timestamptz
  from public.fun_game_quest_templates t
  where t.is_active = true and t.event_type = 'daily_light_quest'
  order by t.code
  limit 7
  on conflict (user_id, quest_template_id, quest_date) do nothing;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', q.id,
      'quest_template_id', q.quest_template_id,
      'title', t.title,
      'description', t.description,
      'progress_count', q.progress_count,
      'target_count', q.target_count,
      'completed_at', q.completed_at,
      'claimed_at', q.claimed_at,
      'reward_type', t.reward_type,
      'reward_amount', t.reward_amount,
      'light_score_delta', t.light_score_delta,
      'ai_moderation_required', t.ai_moderation_required
    ) order by q.created_at, t.code
  ), '[]'::jsonb) into v_quests
  from public.fun_game_daily_quests q
  join public.fun_game_quest_templates t on t.id = q.quest_template_id
  where q.user_id = v_user_id and q.quest_date = current_date;

  return jsonb_build_object('quests', v_quests);
end;
$$;

create or replace function public.fun_game_track_demo_action(
  p_daily_quest_id uuid,
  p_increment integer default 1
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_quest public.fun_game_daily_quests%rowtype;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if coalesce(p_increment, 0) <= 0 then raise exception 'Increment must be positive'; end if;

  update public.fun_game_daily_quests
  set
    progress_count = least(target_count, progress_count + p_increment),
    completed_at = case
      when completed_at is not null then completed_at
      when least(target_count, progress_count + p_increment) >= target_count then now()
      else null
    end,
    proof = proof || jsonb_build_object('demo_action_at', now()),
    updated_at = now()
  where id = p_daily_quest_id and user_id = v_user_id and claimed_at is null
  returning * into v_quest;

  if v_quest.id is null then raise exception 'Quest not found or already claimed'; end if;
  return to_jsonb(v_quest);
end;
$$;

create or replace function public.fun_game_claim_daily_reward(p_daily_quest_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_quest record;
  v_status public.fun_game_reward_status;
  v_ledger public.fun_game_reward_ledger%rowtype;
  v_box_type_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;

  select q.*, t.reward_type as t_reward_type, t.reward_amount as t_reward_amount,
         t.light_score_delta as t_light_score_delta, t.title as t_title
    into v_quest
  from public.fun_game_daily_quests q
  join public.fun_game_quest_templates t on t.id = q.quest_template_id
  where q.id = p_daily_quest_id and q.user_id = v_user_id
  for update of q;

  if not found then raise exception 'Quest not found'; end if;
  if v_quest.completed_at is null or v_quest.progress_count < v_quest.target_count then
    raise exception 'Quest is not complete';
  end if;

  select * into v_ledger from public.fun_game_reward_ledger
  where idempotency_key = 'daily:' || p_daily_quest_id::text;

  if v_ledger.id is null then
    v_status := case
      when v_quest.risk_score >= 70 then 'pending'::public.fun_game_reward_status
      when v_quest.t_reward_type in ('camly_coin'::public.fun_game_reward_type, 'nft_badge'::public.fun_game_reward_type, 'nft_item'::public.fun_game_reward_type) then 'pending'::public.fun_game_reward_status
      else 'approved'::public.fun_game_reward_status
    end;

    insert into public.fun_game_reward_ledger (
      user_id, source_type, source_id, reward_type, amount, status,
      idempotency_key, risk_score, approved_at, metadata
    )
    values (
      v_user_id, 'daily_light_quest'::public.fun_game_event_type, p_daily_quest_id,
      v_quest.t_reward_type, v_quest.t_reward_amount, v_status,
      'daily:' || p_daily_quest_id::text, v_quest.risk_score,
      case when v_status = 'approved' then now() else null end,
      jsonb_build_object('quest_title', v_quest.t_title)
    )
    returning * into v_ledger;

    if v_status = 'approved' then
      update public.fun_game_profiles
      set
        xp = xp + case when v_quest.t_reward_type = 'xp'::public.fun_game_reward_type then v_quest.t_reward_amount::bigint else 0 end,
        light_score = light_score
          + case when v_quest.t_reward_type = 'light_score'::public.fun_game_reward_type then v_quest.t_reward_amount::integer else 0 end
          + greatest(v_quest.t_light_score_delta, 0),
        streak_days = case
          when last_daily_reset_at::date = current_date then streak_days
          else streak_days + 1
        end,
        last_daily_reset_at = now(),
        updated_at = now()
      where user_id = v_user_id;

      if v_quest.t_reward_type = 'mystery_box'::public.fun_game_reward_type then
        select id into v_box_type_id
        from public.fun_game_box_types
        where code = 'season_1_cosmic_box' and is_active = true
        limit 1;

        if v_box_type_id is not null then
          insert into public.fun_game_user_boxes (user_id, box_type_id, source, reward_ledger_id, server_seed_hash)
          values (v_user_id, v_box_type_id, 'daily_quest', v_ledger.id, encode(extensions.gen_random_bytes(32), 'hex'));
        end if;
      end if;
    end if;
  end if;

  update public.fun_game_daily_quests
  set claimed_at = coalesce(claimed_at, now()), updated_at = now()
  where id = p_daily_quest_id and user_id = v_user_id;

  return jsonb_build_object('reward', to_jsonb(v_ledger));
end;
$$;

create or replace function public.fun_game_open_next_box()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_box record;
  v_total_weight integer := 0;
  v_roll integer;
  v_running integer := 0;
  v_entry jsonb;
  v_selected jsonb;
  v_min numeric;
  v_max numeric;
  v_amount numeric;
  v_ledger public.fun_game_reward_ledger%rowtype;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;

  select b.id as box_id, bt.probability_table, bt.title into v_box
  from public.fun_game_user_boxes b
  join public.fun_game_box_types bt on bt.id = b.box_type_id
  where b.user_id = v_user_id and b.status = 'unopened'
  order by b.created_at
  limit 1
  for update of b;

  if not found then
    return jsonb_build_object('box', null, 'reward', null);
  end if;

  for v_entry in select * from jsonb_array_elements(v_box.probability_table) loop
    v_total_weight := v_total_weight + (v_entry->>'weight')::integer;
  end loop;

  if v_total_weight <= 0 then
    raise exception 'Invalid box probability table';
  end if;

  v_roll := floor(random() * v_total_weight)::integer + 1;

  for v_entry in select * from jsonb_array_elements(v_box.probability_table) loop
    v_running := v_running + (v_entry->>'weight')::integer;
    if v_roll <= v_running then
      v_selected := v_entry;
      exit;
    end if;
  end loop;

  v_min := (v_selected->>'min')::numeric;
  v_max := (v_selected->>'max')::numeric;
  v_amount := floor(random() * (v_max - v_min + 1)) + v_min;

  insert into public.fun_game_reward_ledger (
    user_id, source_type, source_id, reward_type, amount, status,
    idempotency_key, approved_at, metadata
  )
  values (
    v_user_id, 'mystery_box'::public.fun_game_event_type, v_box.box_id,
    (v_selected->>'reward_type')::public.fun_game_reward_type,
    v_amount,
    case when (v_selected->>'reward_type') in ('camly_coin','nft_badge','nft_item')
      then 'pending'::public.fun_game_reward_status
      else 'approved'::public.fun_game_reward_status end,
    'box:' || v_box.box_id::text,
    case when (v_selected->>'reward_type') in ('camly_coin','nft_badge','nft_item') then null else now() end,
    jsonb_build_object('box_title', v_box.title, 'rarity', v_selected->>'rarity')
  )
  on conflict (idempotency_key) do update set metadata = public.fun_game_reward_ledger.metadata
  returning * into v_ledger;

  update public.fun_game_user_boxes
  set status = 'opened', opened_at = now(), reward_ledger_id = v_ledger.id
  where id = v_box.box_id and user_id = v_user_id;

  if v_ledger.status = 'approved' then
    update public.fun_game_profiles
    set
      xp = xp + case when v_ledger.reward_type = 'xp'::public.fun_game_reward_type then v_ledger.amount::bigint else 0 end,
      light_score = light_score + case when v_ledger.reward_type = 'light_score'::public.fun_game_reward_type then v_ledger.amount::integer else 0 end,
      updated_at = now()
    where user_id = v_user_id;
  end if;

  return jsonb_build_object('box_id', v_box.box_id, 'reward', to_jsonb(v_ledger));
end;
$$;

create or replace function public.fun_game_pet_action(p_action text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_pet public.fun_game_pets%rowtype;
  v_energy_delta integer;
  v_mood_delta integer;
  v_xp_delta integer;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_action not in ('feed','meditate','train') then
    raise exception 'Unknown pet action: %', p_action;
  end if;

  perform public.fun_game_ensure_profile();

  v_energy_delta := case p_action when 'feed' then 15 when 'meditate' then 8 when 'train' then -12 end;
  v_mood_delta   := case p_action when 'feed' then 5  when 'meditate' then 12 when 'train' then 3  end;
  v_xp_delta     := case p_action when 'feed' then 4  when 'meditate' then 8  when 'train' then 14 end;

  update public.fun_game_pets
  set
    energy = least(100, greatest(0, energy + v_energy_delta)),
    mood = least(100, greatest(0, mood + v_mood_delta)),
    xp = xp + v_xp_delta,
    level = greatest(level, floor((xp + v_xp_delta) / 100)::integer + 1),
    aura = greatest(aura, floor((xp + v_xp_delta) / 250)::integer + 1),
    last_interaction_at = now(),
    updated_at = now()
  where user_id = v_user_id
  returning * into v_pet;

  update public.fun_game_profiles
  set xp = xp + v_xp_delta, light_score = light_score + 1, updated_at = now()
  where user_id = v_user_id;

  return to_jsonb(v_pet);
end;
$$;

create or replace function public.fun_game_leaderboard(p_limit integer default 20)
returns table (
  user_id uuid,
  username text,
  avatar_url text,
  light_score integer,
  xp bigint,
  streak_days integer
)
language sql
security definer
set search_path = public
as $$
  select
    gp.user_id,
    coalesce(p.username, 'Light User') as username,
    p.avatar_url,
    gp.light_score,
    gp.xp,
    gp.streak_days
  from public.fun_game_profiles gp
  left join public.profiles p on p.id = gp.user_id
  order by gp.light_score desc, gp.xp desc, gp.updated_at desc
  limit greatest(1, least(coalesce(p_limit, 20), 100));
$$;

grant execute on function public.fun_game_ensure_profile() to authenticated;
grant execute on function public.fun_game_assign_daily_quests() to authenticated;
grant execute on function public.fun_game_track_demo_action(uuid, integer) to authenticated;
grant execute on function public.fun_game_claim_daily_reward(uuid) to authenticated;
grant execute on function public.fun_game_open_next_box() to authenticated;
grant execute on function public.fun_game_pet_action(text) to authenticated;
grant execute on function public.fun_game_leaderboard(integer) to authenticated, anon;;
