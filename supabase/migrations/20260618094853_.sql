
CREATE OR REPLACE FUNCTION public.telegram_group_health_inbound(
  p_group_id BIGINT,
  p_group_title TEXT,
  p_text TEXT,
  p_user TEXT,
  p_help_intent BOOLEAN
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.telegram_group_health (
    group_id, group_title, last_inbound_at, last_inbound_text, last_inbound_user,
    inbound_count_total, help_intent_count_total
  ) VALUES (
    p_group_id, p_group_title, now(), p_text, p_user,
    1, CASE WHEN p_help_intent THEN 1 ELSE 0 END
  )
  ON CONFLICT (group_id) DO UPDATE SET
    group_title = COALESCE(EXCLUDED.group_title, telegram_group_health.group_title),
    last_inbound_at = now(),
    last_inbound_text = EXCLUDED.last_inbound_text,
    last_inbound_user = EXCLUDED.last_inbound_user,
    inbound_count_total = telegram_group_health.inbound_count_total + 1,
    help_intent_count_total = telegram_group_health.help_intent_count_total + CASE WHEN p_help_intent THEN 1 ELSE 0 END,
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.telegram_group_health_reply(
  p_group_id BIGINT,
  p_mode TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.telegram_group_health (
    group_id, last_bot_reply_at, last_bot_reply_mode, bot_reply_count_total
  ) VALUES (p_group_id, now(), p_mode, 1)
  ON CONFLICT (group_id) DO UPDATE SET
    last_bot_reply_at = now(),
    last_bot_reply_mode = EXCLUDED.last_bot_reply_mode,
    bot_reply_count_total = telegram_group_health.bot_reply_count_total + 1,
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.telegram_group_health_inbound(BIGINT, TEXT, TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.telegram_group_health_inbound(BIGINT, TEXT, TEXT, TEXT, BOOLEAN) TO service_role;

REVOKE ALL ON FUNCTION public.telegram_group_health_reply(BIGINT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.telegram_group_health_reply(BIGINT, TEXT) TO service_role;
;
