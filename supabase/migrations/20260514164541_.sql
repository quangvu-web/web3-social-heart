create or replace function public.fun_game_track_action(
  p_quest_code text,
  p_increment integer default 1,
  p_proof jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_template public.fun_game_quest_templates%rowtype;
  v_quest public.fun_game_daily_quests%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if coalesce(p_quest_code, '') = '' then
    raise exception 'Quest code is required';
  end if;

  if coalesce(p_increment, 0) <= 0 then
    raise exception 'Increment must be positive';
  end if;

  perform public.fun_game_ensure_profile();

  select *
    into v_template
  from public.fun_game_quest_templates
  where code = p_quest_code
    and is_active = true
  limit 1;

  if not found then
    raise exception 'Quest template not found: %', p_quest_code;
  end if;

  insert into public.fun_game_daily_quests (
    user_id,
    quest_template_id,
    quest_date,
    target_count,
    expires_at,
    proof
  )
  values (
    v_user_id,
    v_template.id,
    current_date,
    v_template.target_count,
    (current_date + 1)::timestamptz,
    jsonb_build_object('auto_assigned_by', p_quest_code)
  )
  on conflict (user_id, quest_template_id, quest_date) do nothing;

  update public.fun_game_daily_quests
  set
    progress_count = least(target_count, progress_count + p_increment),
    completed_at = case
      when completed_at is not null then completed_at
      when least(target_count, progress_count + p_increment) >= target_count then now()
      else null
    end,
    proof = proof || coalesce(p_proof, '{}'::jsonb) || jsonb_build_object('last_tracked_at', now()),
    updated_at = now()
  where user_id = v_user_id
    and quest_template_id = v_template.id
    and quest_date = current_date
    and claimed_at is null
  returning * into v_quest;

  if not found then
    select *
      into v_quest
    from public.fun_game_daily_quests
    where user_id = v_user_id
      and quest_template_id = v_template.id
      and quest_date = current_date;
  end if;

  insert into public.fun_game_anti_cheat_events (
    user_id,
    event_type,
    severity,
    risk_score,
    signal
  )
  values (
    v_user_id,
    'quest_action_tracked',
    'info',
    0,
    jsonb_build_object(
      'quest_code', p_quest_code,
      'increment', p_increment,
      'quest_id', v_quest.id,
      'proof', coalesce(p_proof, '{}'::jsonb)
    )
  );

  return jsonb_build_object(
    'quest', to_jsonb(v_quest),
    'template', jsonb_build_object(
      'code', v_template.code,
      'title', v_template.title,
      'reward_type', v_template.reward_type,
      'reward_amount', v_template.reward_amount
    )
  );
end;
$$;

grant execute on function public.fun_game_track_action(text, integer, jsonb) to authenticated;;
