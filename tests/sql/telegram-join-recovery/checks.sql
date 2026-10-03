\set ON_ERROR_STOP on
BEGIN;
-- All rows in this file are synthetic and rolled back.
DO $$
DECLARE f record; t text; permission text;
BEGIN
 FOR f IN SELECT oid FROM pg_proc WHERE pronamespace='public'::regnamespace
   AND proname IN ('tg_record_join_event','tg_claim_join_event','tg_renew_join_lease',
   'tg_begin_join_delivery','tg_finish_join_event','tg_sweep_join_events','tg_mark_join_event_review') LOOP
   ASSERT has_function_privilege('service_role',f.oid,'EXECUTE'), 'service_role execute';
   ASSERT NOT has_function_privilege('anon',f.oid,'EXECUTE'), 'anon denied';
   ASSERT NOT has_function_privilege('authenticated',f.oid,'EXECUTE'), 'authenticated denied';
 END LOOP;
 FOR t IN SELECT unnest(ARRAY['telegram_member_events','telegram_community_verification_challenges']) LOOP
   ASSERT (SELECT relrowsecurity FROM pg_class WHERE oid=('public.'||t)::regclass), 'RLS preserved';
   FOREACH permission IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
     ASSERT has_table_privilege('service_role','public.'||t,permission), 'DML preserved';
   END LOOP;
 END LOOP;
END $$;
SET LOCAL ROLE anon;
DO $$ BEGIN
 BEGIN
   PERFORM public.tg_sweep_join_events();
   RAISE EXCEPTION 'anon execution unexpectedly permitted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SET LOCAL ROLE service_role;
DO $$
DECLARE e uuid; token uuid; replacement uuid; rec record; n integer;
BEGIN
 SELECT * INTO rec FROM public.tg_record_join_event(-100,10,'join',now(),'{}');
 e:=rec.id;
 ASSERT rec.inserted AND rec.processing_status='pending', 'new event';
 SELECT * INTO rec FROM public.tg_record_join_event(-100,10,'join',now(),'{}');
 ASSERT NOT rec.inserted AND rec.id=e, 'duplicate returns same event';
 token:=public.tg_claim_join_event(e);
 ASSERT token IS NOT NULL, 'claim';
 ASSERT public.tg_claim_join_event(e) IS NULL, 'second claim blocked';
 ASSERT NOT public.tg_renew_join_lease(e,gen_random_uuid(),60), 'wrong token renew blocked';
 ASSERT public.tg_renew_join_lease(e,token,60), 'renew';
 ASSERT NOT public.tg_begin_join_delivery(e,gen_random_uuid()), 'wrong token begin blocked';
 ASSERT public.tg_finish_join_event(e,token,'failed','settings_lookup_failed','not_sent'), 'settings failure';
 replacement:=public.tg_claim_join_event(e);
 ASSERT replacement IS NOT NULL AND replacement<>token, 'retry gets new token';
 ASSERT NOT public.tg_finish_join_event(e,token,'done','stale','not_sent'), 'stale owner blocked';
 ASSERT public.tg_begin_join_delivery(e,replacement), 'retry starts send';
 ASSERT NOT public.tg_begin_join_delivery(e,replacement), 'second send blocked';
 ASSERT NOT public.tg_finish_join_event(e,replacement,'failed','ambiguous'), 'implicit retry blocked';
 ASSERT NOT public.tg_finish_join_event(e,replacement,'done','welcome_sent','not_sent'), 'false success blocked';
 ASSERT NOT public.tg_finish_join_event(e,replacement,'failed','welcome_failed','sent'), 'retry after sent blocked';
 ASSERT public.tg_finish_join_event(e,replacement,'done','welcome_sent','sent'), 'confirmed send completes';
 ASSERT public.tg_claim_join_event(e) IS NULL, 'done cannot retry';

 SELECT id INTO e FROM public.tg_record_join_event(-100,11,'rejoined',now(),'{}');
 token:=public.tg_claim_join_event(e);
 ASSERT public.tg_begin_join_delivery(e,token), 'ambiguous begin';
 ASSERT public.tg_finish_join_event(e,token,'needs_review','timeout','uncertain'), 'ambiguous review';
 ASSERT public.tg_claim_join_event(e) IS NULL, 'review cannot retry';

 SELECT id INTO e FROM public.tg_record_join_event(-100,12,'join',now(),'{}');
 token:=public.tg_claim_join_event(e);
 ASSERT public.tg_finish_join_event(e,token,'done','join_guard_removed','not_sent'), 'removed terminal';
 ASSERT public.tg_claim_join_event(e) IS NULL, 'removed no retry';
 SELECT id INTO e FROM public.tg_record_join_event(-100,13,'join',now(),'{}');
 token:=public.tg_claim_join_event(e);
 ASSERT public.tg_finish_join_event(e,token,'done','welcome_and_verification_disabled','not_sent'), 'disabled terminal';
 ASSERT public.tg_claim_join_event(e) IS NULL, 'disabled no retry';

 SELECT id INTO e FROM public.tg_record_join_event(-100,14,'join',now(),'{}');
 token:=public.tg_claim_join_event(e);
 UPDATE public.telegram_member_events SET lease_until=now()-interval '1 second' WHERE id=e;
 replacement:=public.tg_claim_join_event(e);
 ASSERT replacement IS NOT NULL AND replacement<>token, 'expired pre-send lease reclaim';
 ASSERT NOT public.tg_mark_join_event_review(e,'test'), 'active owner protected';
 ASSERT public.tg_begin_join_delivery(e,replacement), 'begin before simulated crash';
 UPDATE public.telegram_member_events SET lease_until=now()-interval '1 second' WHERE id=e;
 ASSERT public.tg_claim_join_event(e) IS NULL, 'expired sending never reclaimed';
 n:=public.tg_sweep_join_events();
 ASSERT n=1, 'sweep ambiguous delivery';
 ASSERT (SELECT processing_status='needs_review' AND delivery_state='uncertain' FROM public.telegram_member_events WHERE id=e), 'sweep state';

 SELECT id INTO e FROM public.tg_record_join_event(-100,15,'join',now()-interval '11 minutes','{}');
 ASSERT public.tg_claim_join_event(e) IS NULL, 'age bound';
 ASSERT public.tg_sweep_join_events()=1, 'aged event reviewed';
 SELECT id INTO e FROM public.tg_record_join_event(-100,16,'join',now(),'{}');
 FOR n IN 1..5 LOOP
   token:=public.tg_claim_join_event(e);
   ASSERT token IS NOT NULL, 'attempt available';
   ASSERT public.tg_finish_join_event(e,token,'failed','challenge_create_failed','not_sent'), 'challenge retry';
 END LOOP;
 ASSERT public.tg_claim_join_event(e) IS NULL, 'attempt cap';
 ASSERT public.tg_sweep_join_events()=1, 'exhausted reviewed';
 SELECT id INTO e FROM public.tg_record_join_event(-100,17,'join',now(),'{}');
 ASSERT public.tg_mark_join_event_review(e,'operator_review'), 'mark review';
 ASSERT public.tg_claim_join_event(e) IS NULL, 'marked terminal';

 BEGIN
   PERFORM public.tg_record_join_event(-100,18,'left',now(),'{}');
   RAISE EXCEPTION 'invalid event accepted';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM<>'invalid_join_event' THEN RAISE; END IF;
 END;
 BEGIN
   PERFORM public.tg_claim_join_event(e,1);
   RAISE EXCEPTION 'invalid lease accepted';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM<>'invalid_claim' THEN RAISE; END IF;
 END;
 INSERT INTO public.telegram_community_verification_challenges(group_id,telegram_user_id,status) VALUES(-100,1,'pending');
 BEGIN
   INSERT INTO public.telegram_community_verification_challenges(group_id,telegram_user_id,status) VALUES(-100,1,'enforcement_processing');
   RAISE EXCEPTION 'active challenge duplicate accepted';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 INSERT INTO public.telegram_community_verification_challenges(group_id,telegram_user_id,status) VALUES(-100,1,'failed');
END $$;
ROLLBACK;
\echo 'PASS: RPC transitions, permissions, RLS preservation and challenge uniqueness'
