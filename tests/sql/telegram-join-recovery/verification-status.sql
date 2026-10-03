BEGIN;

INSERT INTO public.telegram_community_verification_challenges
  (id, group_id, telegram_user_id, status)
VALUES
  ('00000000-0000-4000-8000-000000000091', -100000000091, 90091, 'pending');

UPDATE public.telegram_community_verification_challenges
SET status = 'enforcement_processing'
WHERE id = '00000000-0000-4000-8000-000000000091';
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.telegram_community_verification_challenges
    WHERE id = '00000000-0000-4000-8000-000000000091'
      AND status = 'enforcement_processing'
  ) THEN RAISE EXCEPTION 'enforcement_processing status was not persisted'; END IF;
END $$;

UPDATE public.telegram_community_verification_challenges
SET status = 'release_failed'
WHERE id = '00000000-0000-4000-8000-000000000091';
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.telegram_community_verification_challenges
    WHERE id = '00000000-0000-4000-8000-000000000091'
      AND status = 'release_failed'
  ) THEN RAISE EXCEPTION 'release_failed status was not persisted'; END IF;
END $$;

ROLLBACK;
