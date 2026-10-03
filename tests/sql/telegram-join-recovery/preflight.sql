\set ON_ERROR_STOP on
SELECT group_id, telegram_user_id, count(*) AS active_challenges
FROM public.telegram_community_verification_challenges
WHERE status IN ('pending','enforcement_processing')
GROUP BY group_id, telegram_user_id HAVING count(*) > 1;
DO $$ BEGIN
 IF EXISTS (
  SELECT 1 FROM public.telegram_community_verification_challenges
  WHERE status IN ('pending','enforcement_processing')
  GROUP BY group_id,telegram_user_id HAVING count(*)>1
 ) THEN RAISE EXCEPTION 'active_verification_challenge_duplicates_exist'; END IF;
END $$;
