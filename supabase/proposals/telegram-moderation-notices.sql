-- PROPOSAL ONLY. Operator reviews/applies before deploying the dependent code.
-- Existing AI locks have no verified rolling group cooldown contract.
-- Metadata only; no message body, username, bot token or webhook URL.
BEGIN;
CREATE TABLE public.telegram_moderation_notice_events (
  group_id bigint NOT NULL,
  message_id bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (group_id, message_id)
);
CREATE TABLE public.telegram_moderation_notice_groups (
  group_id bigint PRIMARY KEY,
  last_claimed_at timestamptz
);
ALTER TABLE public.telegram_moderation_notice_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_moderation_notice_groups ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.telegram_moderation_notice_events, public.telegram_moderation_notice_groups FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_moderation_notice_events, public.telegram_moderation_notice_groups TO service_role;

CREATE FUNCTION public.tg_claim_moderation_failure_notice(p_group_id bigint, p_message_id bigint)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  last_claim timestamptz;
  claimed_at timestamptz;
BEGIN
  IF p_group_id IS NULL OR p_group_id >= 0 OR p_message_id IS NULL OR p_message_id <= 0 THEN
    RAISE EXCEPTION 'invalid moderation notice metadata';
  END IF;
  -- Unique event also persists suppressed messages: a replay after cooldown cannot send.
  INSERT INTO public.telegram_moderation_notice_events(group_id, message_id)
    VALUES(p_group_id, p_message_id) ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN RETURN 'duplicate'; END IF;

  INSERT INTO public.telegram_moderation_notice_groups(group_id)
    VALUES(p_group_id) ON CONFLICT DO NOTHING;
  SELECT last_claimed_at INTO last_claim FROM public.telegram_moderation_notice_groups
    WHERE group_id = p_group_id FOR UPDATE;
  -- Use DB clock after lock acquisition, not transaction start or Edge clock.
  claimed_at := clock_timestamp();
  IF last_claim IS NOT NULL AND last_claim > claimed_at - interval '5 minutes' THEN
    RETURN 'cooldown';
  END IF;
  UPDATE public.telegram_moderation_notice_groups SET last_claimed_at = claimed_at WHERE group_id = p_group_id;
  RETURN 'claimed';
END;
$$;
REVOKE ALL ON FUNCTION public.tg_claim_moderation_failure_notice(bigint, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tg_claim_moderation_failure_notice(bigint, bigint) TO service_role;
COMMIT;
-- Keep event keys while webhook replay remains possible; purging keys allows old replays.
-- Reservation is not exactly-once delivery. A crash/ambiguous send can lose a notice;
-- original moderation audit stays available, and new failures can notify after cooldown.
