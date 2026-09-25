-- FUN.Rich player summary RPC for post-claim UX (Malaysia timezone for daily reset).
create or replace function public.fun_game_player_summary()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_rewards jsonb;
  v_inventory_count integer;
  v_next_reset timestamptz;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  perform public.fun_game_ensure_profile();

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'source_type', r.source_type,
        'reward_type', r.reward_type,
        'amount', r.amount,
        'status', r.status,
        'created_at', r.created_at,
        'metadata', r.metadata
      )
      order by r.created_at desc
    ),
    '[]'::jsonb
  )
    into v_rewards
  from (
    select id, source_type, reward_type, amount, status, created_at, metadata
    from public.fun_game_reward_ledger
    where user_id = v_user_id
    order by created_at desc
    limit 10
  ) r;

  select count(*)
    into v_inventory_count
  from public.fun_game_inventory_items
  where user_id = v_user_id;

  -- Next daily reset = midnight Malaysia time (UTC+8)
  v_next_reset := ((((now() at time zone 'Asia/Kuala_Lumpur')::date) + 1)::timestamp)
                  at time zone 'Asia/Kuala_Lumpur';

  return jsonb_build_object(
    'recent_rewards', v_rewards,
    'inventory_count', coalesce(v_inventory_count, 0),
    'next_daily_reset_at', v_next_reset
  );
end;
$$;

revoke all on function public.fun_game_player_summary() from public, anon;
grant execute on function public.fun_game_player_summary() to authenticated;;
