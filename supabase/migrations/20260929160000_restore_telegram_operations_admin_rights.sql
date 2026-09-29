-- Restore only the table privileges used by Telegram Operations and its runtime.
-- RLS remains enabled; no privileges are granted to anon. Safe to reapply.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'telegram_community_settings', 'telegram_group_config', 'telegram_group_mutes',
    'trusted_telegram_handles', 'trusted_bot_usernames', 'telegram_ai_audit',
    'telegram_ai_runtime_logs', 'telegram_ai_response_cache', 'telegram_ai_conversations',
    'telegram_member_events', 'telegram_member_daily_stats', 'telegram_bot_dm_users',
    'telegram_bot_dm_events', 'angel_image_pipeline_logs', 'angel_persona_settings',
    'angel_feature_flags', 'telegram_feedback', 'reward_claims', 'angel_prompt_versions',
    'app_api_keys', 'audit_logs'
  ] LOOP
    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM anon, authenticated, service_role', t);
  END LOOP;
END $$;

-- Authenticated admin UI reads. Writes stay bounded by each table's existing RLS.
GRANT SELECT, UPDATE ON TABLE public.telegram_community_settings TO authenticated;
GRANT SELECT, UPDATE ON TABLE public.telegram_group_config TO authenticated;
GRANT SELECT, DELETE ON TABLE public.telegram_group_mutes TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.trusted_telegram_handles TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.trusted_bot_usernames TO authenticated;
GRANT SELECT ON TABLE public.telegram_ai_audit TO authenticated;
GRANT SELECT ON TABLE public.telegram_ai_runtime_logs TO authenticated;
GRANT SELECT ON TABLE public.telegram_ai_response_cache TO authenticated;
GRANT SELECT, DELETE ON TABLE public.telegram_ai_conversations TO authenticated;
GRANT SELECT ON TABLE public.telegram_member_events TO authenticated;
GRANT SELECT ON TABLE public.telegram_member_daily_stats TO authenticated;
GRANT SELECT ON TABLE public.telegram_bot_dm_users TO authenticated;
GRANT SELECT ON TABLE public.telegram_bot_dm_events TO authenticated;
GRANT SELECT ON TABLE public.angel_image_pipeline_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.angel_persona_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.angel_feature_flags TO authenticated;
GRANT SELECT, UPDATE, DELETE ON TABLE public.telegram_feedback TO authenticated;
GRANT SELECT, INSERT ON TABLE public.reward_claims TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.angel_prompt_versions TO authenticated;
-- app_api_keys is accessed only through the admin-only Edge Function.
GRANT SELECT, INSERT ON TABLE public.audit_logs TO authenticated;

-- Service role permissions reflect bot, scheduled worker, and Edge Function operations.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.telegram_community_settings TO service_role;
GRANT SELECT, UPDATE ON TABLE public.telegram_group_config TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.telegram_group_mutes TO service_role;
GRANT SELECT ON TABLE public.trusted_telegram_handles TO service_role;
GRANT SELECT ON TABLE public.trusted_bot_usernames TO service_role;
GRANT SELECT, INSERT ON TABLE public.telegram_ai_audit TO service_role;
GRANT SELECT, INSERT ON TABLE public.telegram_ai_runtime_logs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.telegram_ai_response_cache TO service_role;
GRANT SELECT, INSERT ON TABLE public.telegram_ai_conversations TO service_role;
GRANT SELECT, INSERT ON TABLE public.telegram_member_events TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.telegram_member_daily_stats TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.telegram_bot_dm_users TO service_role;
GRANT INSERT ON TABLE public.telegram_bot_dm_events TO service_role;
GRANT INSERT ON TABLE public.angel_image_pipeline_logs TO service_role;
GRANT SELECT ON TABLE public.angel_persona_settings TO service_role;
GRANT SELECT ON TABLE public.angel_feature_flags TO service_role;
GRANT SELECT, INSERT ON TABLE public.telegram_feedback TO service_role;
GRANT SELECT, INSERT ON TABLE public.reward_claims TO service_role;
GRANT SELECT ON TABLE public.angel_prompt_versions TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.app_api_keys TO service_role;
GRANT INSERT ON TABLE public.audit_logs TO service_role;

GRANT USAGE, SELECT ON SEQUENCE public.telegram_feedback_id_seq TO service_role;
REVOKE ALL PRIVILEGES ON SEQUENCE public.telegram_feedback_id_seq FROM anon, authenticated;

-- Restrict trusted bot list writes to admins; its existing authenticated SELECT policy stays.
DROP POLICY IF EXISTS "Admins can add trusted bot usernames" ON public.trusted_bot_usernames;
CREATE POLICY "Admins can add trusted bot usernames"
  ON public.trusted_bot_usernames FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
DROP POLICY IF EXISTS "Admins can delete trusted bot usernames" ON public.trusted_bot_usernames;
CREATE POLICY "Admins can delete trusted bot usernames"
  ON public.trusted_bot_usernames FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Admins may remove bot mutes; the existing admin SELECT policy remains.
DROP POLICY IF EXISTS "Admins can delete telegram group mutes" ON public.telegram_group_mutes;
CREATE POLICY "Admins can delete telegram group mutes"
  ON public.telegram_group_mutes FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- User self-read/self-insert policies remain; this adds an admin-only read path.
DROP POLICY IF EXISTS "Admins can view all reward claims" ON public.reward_claims;
CREATE POLICY "Admins can view all reward claims"
  ON public.reward_claims FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

COMMENT ON POLICY "Admins can view all reward claims" ON public.reward_claims IS
  'Admins may inspect all claims; non-admin users remain constrained by their existing auth.uid() = user_id policy.';
