-- Run after applying 20260929160000_restore_telegram_operations_admin_rights.sql.
-- Read-only assertions; this file does not change production data or privileges.
DO $$
DECLARE
  t text;
  p text;
  targets text[] := ARRAY[
    'telegram_community_settings', 'telegram_group_config', 'telegram_group_mutes',
    'trusted_telegram_handles', 'trusted_bot_usernames', 'telegram_ai_audit',
    'telegram_ai_runtime_logs', 'telegram_ai_response_cache', 'telegram_ai_conversations',
    'telegram_member_events', 'telegram_member_daily_stats', 'telegram_bot_dm_users',
    'telegram_bot_dm_events', 'angel_image_pipeline_logs', 'angel_persona_settings',
    'angel_feature_flags', 'telegram_feedback', 'reward_claims', 'angel_prompt_versions',
    'app_api_keys', 'audit_logs'
  ];
BEGIN
  FOREACH t IN ARRAY targets LOOP
    IF NOT (SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
            WHERE n.nspname='public' AND c.relname=t) THEN
      RAISE EXCEPTION 'RLS must remain enabled on public.%', t;
    END IF;
    FOREACH p IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] LOOP
      IF has_table_privilege('anon', format('public.%I', t), p) THEN
        RAISE EXCEPTION 'anon unexpectedly has % on public.%', p, t;
      END IF;
    END LOOP;
  END LOOP;

  IF NOT has_table_privilege('authenticated', 'public.reward_claims', 'SELECT')
     OR NOT has_table_privilege('authenticated', 'public.reward_claims', 'INSERT')
     OR has_table_privilege('authenticated', 'public.reward_claims', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.reward_claims', 'DELETE') THEN
    RAISE EXCEPTION 'reward_claims authenticated grants exceed own-read/insert access';
  END IF;
  IF has_table_privilege('authenticated', 'public.app_api_keys', 'SELECT')
     OR has_table_privilege('authenticated', 'public.app_api_keys', 'INSERT') THEN
    RAISE EXCEPTION 'app_api_keys must remain Edge Function only';
  END IF;
  IF NOT has_table_privilege('service_role', 'public.app_api_keys', 'SELECT')
     OR NOT has_table_privilege('service_role', 'public.app_api_keys', 'INSERT')
     OR NOT has_table_privilege('service_role', 'public.app_api_keys', 'UPDATE') THEN
    RAISE EXCEPTION 'service_role app_api_keys permissions incomplete';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='trusted_bot_usernames'
                 AND policyname='Admins can add trusted bot usernames' AND cmd='INSERT')
     OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='trusted_bot_usernames'
                 AND policyname='Admins can delete trusted bot usernames' AND cmd='DELETE') THEN
    RAISE EXCEPTION 'trusted_bot_usernames admin write policies missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='telegram_group_mutes'
                 AND policyname='Admins can delete telegram group mutes' AND cmd='DELETE') THEN
    RAISE EXCEPTION 'telegram_group_mutes admin delete policy missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='reward_claims'
                 AND policyname='Admins can view all reward claims' AND cmd='SELECT')
     OR NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='reward_claims'
                 AND cmd='SELECT' AND qual ILIKE '%auth.uid()%user_id%') THEN
    RAISE EXCEPTION 'reward_claims must preserve own-read and add admin read';
  END IF;
END $$;
