-- READ ONLY. Operator runs on the confirmed project; no secrets/message bodies.
-- Before applying: settings_table must exist.
-- After applying: all remaining booleans must be true before deploying dependent code.
SELECT
  to_regclass('public.telegram_community_settings') IS NOT NULL AS settings_table_present,
  to_regclass('public.telegram_unauthorized_bot_invites') IS NOT NULL AS invite_table_present,
  to_regprocedure('public.tg_claim_unauthorized_bot_invite(bigint,bigint,bigint,bigint)') IS NOT NULL AS claim_rpc_present,
  COALESCE((SELECT relrowsecurity FROM pg_class WHERE oid=to_regclass('public.telegram_unauthorized_bot_invites')), false) AS invite_rls_enabled,
  CASE WHEN to_regprocedure('public.tg_claim_unauthorized_bot_invite(bigint,bigint,bigint,bigint)') IS NULL THEN false ELSE
    has_function_privilege('service_role', 'public.tg_claim_unauthorized_bot_invite(bigint,bigint,bigint,bigint)', 'EXECUTE')
    AND NOT has_function_privilege('anon', 'public.tg_claim_unauthorized_bot_invite(bigint,bigint,bigint,bigint)', 'EXECUTE')
    AND NOT has_function_privilege('authenticated', 'public.tg_claim_unauthorized_bot_invite(bigint,bigint,bigint,bigint)', 'EXECUTE')
  END AS claim_privileges_valid;
