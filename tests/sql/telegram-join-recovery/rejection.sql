-- Regression: a definite rejected send must release the claim for retry.
BEGIN;
SET LOCAL ROLE service_role;
DO $$
DECLARE e uuid; token uuid;
BEGIN
 SELECT id INTO e FROM public.tg_record_join_event(-100,1,'join',now(),'{}');
 token := public.tg_claim_join_event(e);
 ASSERT token IS NOT NULL, 'initial claim';
 ASSERT public.tg_begin_join_delivery(e,token), 'begin delivery';
 ASSERT public.tg_finish_join_event(e,token,'failed','welcome_failed','not_sent'),
   'explicit rejection must finish as retryable';
 ASSERT public.tg_claim_join_event(e) IS NOT NULL, 'retry claim';
END $$;
ROLLBACK;
