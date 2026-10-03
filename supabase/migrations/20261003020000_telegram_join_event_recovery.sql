-- Durable, concurrency-safe state for recoverable Telegram join processing.
-- This migration is a local draft until explicitly applied by the operator.

ALTER TABLE public.telegram_member_events
  ADD COLUMN IF NOT EXISTS processing_status text,
  ADD COLUMN IF NOT EXISTS processing_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lease_token uuid,
  ADD COLUMN IF NOT EXISTS lease_until timestamptz,
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivery_state text,
  ADD COLUMN IF NOT EXISTS delivery_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS join_outcome text,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS processed_at timestamptz;

DO $$ BEGIN
  ALTER TABLE public.telegram_member_events
    ADD CONSTRAINT telegram_member_events_processing_status_check
    CHECK (processing_status IS NULL OR processing_status IN ('pending','processing','failed','done','needs_review')) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.telegram_member_events
    ADD CONSTRAINT telegram_member_events_delivery_state_check
    CHECK (delivery_state IS NULL OR delivery_state IN ('not_sent','sending','sent','uncertain')) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.telegram_member_events
    ADD CONSTRAINT telegram_member_events_processing_attempts_check
    CHECK (processing_attempts >= 0) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_tg_member_events_join_recovery
  ON public.telegram_member_events (occurred_at, lease_until)
  WHERE event_type IN ('join','rejoined')
    AND processing_status IN ('pending','processing','failed');

DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.telegram_community_verification_challenges
    WHERE status IN ('pending','enforcement_processing')
    GROUP BY group_id, telegram_user_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'active_verification_challenge_duplicates_exist';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_tg_verif_active_per_user
  ON public.telegram_community_verification_challenges (group_id, telegram_user_id)
  WHERE status IN ('pending','enforcement_processing');

CREATE OR REPLACE FUNCTION public.tg_record_join_event(
  p_chat_id bigint,
  p_tg_user_id bigint,
  p_event_type text,
  p_occurred_at timestamptz,
  p_row jsonb
)
RETURNS TABLE(id uuid, processing_status text, inserted boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF p_chat_id IS NULL OR p_tg_user_id IS NULL OR p_occurred_at IS NULL
     OR p_event_type IS NULL OR p_event_type NOT IN ('join','rejoined')
     OR jsonb_typeof(p_row) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'invalid_join_event';
  END IF;

  INSERT INTO public.telegram_member_events AS e
    (chat_id, tg_user_id, event_type, occurred_at, username, display_name,
     old_status, new_status, invite_link, invite_link_name,
     invited_by_tg_id, invited_by_username, admin_actor_tg_id,
     admin_actor_username, metadata, processing_status, delivery_state)
  VALUES
    (p_chat_id, p_tg_user_id, p_event_type, p_occurred_at,
     p_row->>'username', coalesce(nullif(p_row->>'display_name',''), 'id:' || p_tg_user_id::text),
     p_row->>'old_status', p_row->>'new_status', p_row->>'invite_link',
     p_row->>'invite_link_name', nullif(p_row->>'invited_by_tg_id','')::bigint,
     p_row->>'invited_by_username', nullif(p_row->>'admin_actor_tg_id','')::bigint,
     p_row->>'admin_actor_username', coalesce(p_row->'metadata','{}'::jsonb), 'pending', 'not_sent')
  ON CONFLICT (chat_id, tg_user_id, event_type, occurred_at) DO NOTHING
  RETURNING e.id INTO v_id;

  IF v_id IS NOT NULL THEN
    RETURN QUERY SELECT v_id, 'pending'::text, true;
    RETURN;
  END IF;

  RETURN QUERY
    SELECT e.id, e.processing_status, false
    FROM public.telegram_member_events e
    WHERE e.chat_id=p_chat_id AND e.tg_user_id=p_tg_user_id
      AND e.event_type=p_event_type AND e.occurred_at=p_occurred_at;
END $$;

CREATE OR REPLACE FUNCTION public.tg_claim_join_event(p_id uuid, p_lease_seconds integer DEFAULT 90)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_token uuid := gen_random_uuid(); v_rows integer;
BEGIN
  IF p_id IS NULL OR p_lease_seconds IS NULL OR p_lease_seconds NOT BETWEEN 30 AND 120 THEN RAISE EXCEPTION 'invalid_claim'; END IF;
  UPDATE public.telegram_member_events SET
    processing_status='processing', lease_token=v_token, claimed_at=now(),
    lease_until=now()+make_interval(secs=>p_lease_seconds),
    processing_attempts=processing_attempts+1, processed_at=NULL
  WHERE id=p_id AND processing_attempts < 5
    AND occurred_at > now() - interval '10 minutes'
    AND (processing_status IN ('pending','failed') OR
      (processing_status='processing' AND lease_until < now()
       AND coalesce(delivery_state,'not_sent') <> 'sending'));
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN CASE WHEN v_rows=1 THEN v_token ELSE NULL END;
END $$;

CREATE OR REPLACE FUNCTION public.tg_renew_join_lease(p_id uuid, p_token uuid, p_seconds integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rows integer;
BEGIN
  IF p_id IS NULL OR p_token IS NULL OR p_seconds IS NULL OR p_seconds NOT BETWEEN 10 AND 60 THEN RAISE EXCEPTION 'invalid_lease'; END IF;
  UPDATE public.telegram_member_events SET lease_until=now()+make_interval(secs=>p_seconds)
  WHERE id=p_id AND lease_token=p_token AND processing_status='processing'
    AND lease_until > now()
    AND now()+make_interval(secs=>p_seconds) <= claimed_at + interval '5 minutes';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows=1;
END $$;

CREATE OR REPLACE FUNCTION public.tg_begin_join_delivery(p_id uuid, p_token uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rows integer;
BEGIN
  UPDATE public.telegram_member_events SET delivery_state='sending', delivery_started_at=now()
  WHERE id=p_id AND lease_token=p_token AND processing_status='processing'
    AND lease_until > now()+interval '20 seconds'
    AND coalesce(delivery_state,'not_sent')='not_sent';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows=1;
END $$;

CREATE OR REPLACE FUNCTION public.tg_finish_join_event(
  p_id uuid, p_token uuid, p_status text, p_outcome text,
  p_delivery text DEFAULT NULL, p_error text DEFAULT NULL
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rows integer;
BEGIN
  IF p_id IS NULL OR p_token IS NULL OR p_status IS NULL OR p_status NOT IN ('done','failed','needs_review')
     OR (p_delivery IS NOT NULL AND p_delivery NOT IN ('sent','not_sent','uncertain'))
     OR (p_delivery='uncertain' AND p_status<>'needs_review') THEN
    RAISE EXCEPTION 'invalid_finish';
  END IF;
  UPDATE public.telegram_member_events SET
    processing_status=p_status, join_outcome=left(p_outcome,80),
    last_error=left(p_error,240), delivery_state=coalesce(p_delivery,delivery_state),
    processed_at=CASE WHEN p_status IN ('done','needs_review') THEN now() ELSE NULL END,
    lease_token=NULL, lease_until=NULL
  WHERE id=p_id AND lease_token=p_token AND processing_status='processing'
    -- Only an explicit not_sent report may retry an attempted delivery.
    -- Ambiguous sends must remain needs_review; never retry sent messages.
    AND NOT (delivery_state='sending' AND NOT (
      (p_status='failed' AND coalesce(p_delivery,'sending')='not_sent') OR
      (p_status IN ('done','needs_review') AND coalesce(p_delivery,'sending') IN ('sent','uncertain'))))
    AND NOT (p_status='failed' AND coalesce(p_delivery,delivery_state)='sent')
    AND (p_delivery IS NULL OR p_delivery NOT IN ('sent','uncertain') OR delivery_state='sending')
    AND NOT (p_status='done' AND coalesce(p_delivery,delivery_state)='uncertain');
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows=1;
END $$;

CREATE OR REPLACE FUNCTION public.tg_sweep_join_events()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rows integer;
BEGIN
  UPDATE public.telegram_member_events SET
    processing_status='needs_review', processed_at=now(),
    delivery_state=CASE WHEN delivery_state='sending' THEN 'uncertain' ELSE delivery_state END,
    lease_token=NULL, lease_until=NULL,
    last_error=coalesce(last_error,'recovery_window_expired_or_delivery_uncertain')
  WHERE event_type IN ('join','rejoined')
    AND processing_status IN ('pending','processing','failed')
    AND ((processing_status='processing' AND lease_until < now() AND delivery_state='sending')
      OR (occurred_at <= now()-interval '10 minutes'
          AND (processing_status<>'processing' OR lease_until < now()))
      OR (processing_attempts >= 5
          AND (processing_status<>'processing' OR lease_until < now())));
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END $$;

CREATE OR REPLACE FUNCTION public.tg_mark_join_event_review(p_id uuid, p_reason text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rows integer;
BEGIN
  UPDATE public.telegram_member_events SET
    processing_status='needs_review', processed_at=now(),
    last_error=left(p_reason,240), lease_token=NULL, lease_until=NULL
  WHERE id=p_id AND event_type IN ('join','rejoined')
    AND (processing_status IN ('pending','failed') OR
      (processing_status='processing' AND lease_until < now()
       AND coalesce(delivery_state,'not_sent') <> 'sending'));
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows=1;
END $$;

REVOKE ALL ON FUNCTION public.tg_record_join_event(bigint,bigint,text,timestamptz,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_claim_join_event(uuid,integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_renew_join_lease(uuid,uuid,integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_begin_join_delivery(uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_finish_join_event(uuid,uuid,text,text,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_sweep_join_events() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_mark_join_event_review(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tg_record_join_event(bigint,bigint,text,timestamptz,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.tg_claim_join_event(uuid,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.tg_renew_join_lease(uuid,uuid,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.tg_begin_join_delivery(uuid,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.tg_finish_join_event(uuid,uuid,text,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.tg_sweep_join_events() TO service_role;
GRANT EXECUTE ON FUNCTION public.tg_mark_join_event_review(uuid,text) TO service_role;
