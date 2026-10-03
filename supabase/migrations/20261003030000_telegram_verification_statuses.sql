-- Keep persisted verification states in sync with the webhook state machine.
-- Production previously allowed only pending/verified/failed/expired, which
-- rejected enforcement_processing and release_failed updates from the webhook.
DO $$
DECLARE
  v_definition text;
  v_normalized text;
BEGIN
  SELECT pg_get_constraintdef(c.oid)
  INTO v_definition
  FROM pg_constraint c
  WHERE c.conrelid = 'public.telegram_community_verification_challenges'::regclass
    AND c.conname = 'telegram_community_verification_status_check';

  IF v_definition IS NULL THEN
    ALTER TABLE public.telegram_community_verification_challenges
      ADD CONSTRAINT telegram_community_verification_status_check
      CHECK (status IN (
        'pending', 'verified', 'failed', 'expired',
        'release_failed', 'enforcement_processing'
      )) NOT VALID;
  ELSE
    v_normalized := regexp_replace(v_definition, '\s', '', 'g');
    IF v_normalized = 'CHECK((status=ANY(ARRAY['
      || '''pending''::text,''verified''::text,''failed''::text,''expired''::text])))' THEN
      ALTER TABLE public.telegram_community_verification_challenges
        DROP CONSTRAINT telegram_community_verification_status_check;
      ALTER TABLE public.telegram_community_verification_challenges
        ADD CONSTRAINT telegram_community_verification_status_check
        CHECK (status IN (
          'pending', 'verified', 'failed', 'expired',
          'release_failed', 'enforcement_processing'
        )) NOT VALID;
    ELSIF v_normalized <> 'CHECK((status=ANY(ARRAY['
      || '''pending''::text,''verified''::text,''failed''::text,''expired''::text,''release_failed''::text,''enforcement_processing''::text])))' THEN
      RAISE EXCEPTION 'unexpected_telegram_verification_status_constraint: %', v_definition;
    END IF;
  END IF;
END $$;

ALTER TABLE public.telegram_community_verification_challenges
  VALIDATE CONSTRAINT telegram_community_verification_status_check;
