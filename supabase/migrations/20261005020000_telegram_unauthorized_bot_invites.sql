-- New migration proposal. Do not apply automatically; operator approval required.
-- Unlike moderation notices, keys identify a bot invitation, not a message/cooldown.
BEGIN;
CREATE TABLE public.telegram_unauthorized_bot_invites (
  bot_id bigint NOT NULL CHECK (bot_id > 0),
  group_id bigint NOT NULL CHECK (group_id < 0),
  update_id bigint NOT NULL CHECK (update_id >= 0),
  event_date bigint NOT NULL CHECK (event_date > 0),
  claimed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (bot_id, group_id, update_id, event_date)
);
ALTER TABLE public.telegram_unauthorized_bot_invites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.telegram_unauthorized_bot_invites FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.telegram_unauthorized_bot_invites TO service_role;

CREATE FUNCTION public.tg_claim_unauthorized_bot_invite(
  p_group_id bigint, p_bot_id bigint, p_update_id bigint, p_event_date bigint
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_group_id IS NULL OR p_group_id >= 0 OR p_bot_id IS NULL OR p_bot_id <= 0
    OR p_update_id IS NULL OR p_update_id < 0 OR p_event_date IS NULL OR p_event_date <= 0 THEN
    RAISE EXCEPTION 'invalid bot invitation metadata';
  END IF;
  -- Never infer missing settings from a database error. An exception rolls back the claim.
  IF EXISTS (SELECT 1 FROM public.telegram_community_settings WHERE group_id = p_group_id) THEN
    RETURN 'managed';
  END IF;
  INSERT INTO public.telegram_unauthorized_bot_invites(bot_id, group_id, update_id, event_date)
    VALUES (p_bot_id, p_group_id, p_update_id, p_event_date) ON CONFLICT DO NOTHING;
  IF NOT FOUND THEN RETURN 'duplicate'; END IF;
  RETURN 'claimed';
END;
$$;
REVOKE ALL ON FUNCTION public.tg_claim_unauthorized_bot_invite(bigint, bigint, bigint, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tg_claim_unauthorized_bot_invite(bigint, bigint, bigint, bigint) TO service_role;
COMMIT;
-- Retain keys across retries; do not reclaim ambiguous attempts or delete keys on leave.
-- New invitations have new primary my_chat_member update/date identities.
