-- 1. Fix mutable search_path
ALTER FUNCTION public.sync_profiles_legacy_wallet_fields(uuid) SET search_path = public;
ALTER FUNCTION public.sync_profiles_wallet_legacy_trigger() SET search_path = public;
ALTER FUNCTION public.touch_wallet_rate_limits_updated_at() SET search_path = public;

-- 2. Lock down SECURITY DEFINER functions
DO $$
DECLARE
  r record;
  backend_only text[] := ARRAY[
    'create_notification_on_comment_like','check_comment_rate_limit','check_post_rate_limit',
    'check_reserved_username','check_search_rate_limit','cleanup_comment_files','cleanup_post_files',
    'cleanup_profile_files','create_notification_on_comment','create_notification_on_like',
    'create_notification_on_live_start','create_soul_nft_for_new_user','generate_fun_id',
    'update_conversation_last_message','handle_new_user','sync_primary_wallet_to_profile',
    'sync_wallet_link_to_profile','update_financial_from_transaction','update_profile_grand_totals',
    'sync_profiles_wallet_legacy_trigger','touch_wallet_rate_limits_updated_at','touch_angel_feature_flags',
    'telegram_community_touch_updated_at','tg_group_config_touch','update_updated_at_column',
    'crypto_gifts_validate_update','rls_auto_enable','check_rate_limit','log_user_action',
    'check_action_rate_limit','find_user_id_by_email','telegram_group_health_inbound',
    'telegram_group_health_reply','get_live_recording_context','set_live_recording_state',
    'set_live_recording_stopped','upsert_live_recording_row','cleanup_expired_oauth_data',
    'delete_storage_object','generate_secure_token','approve_user_reward','reject_user_reward',
    'calculate_engagement_quality','sync_profiles_legacy_wallet_fields','random_audit'
  ];
  auth_only text[] := ARRAY[
    'claim_red_envelope','pin_message','unpin_message','fun_game_assign_daily_quests',
    'fun_game_claim_daily_reward','fun_game_ensure_profile','fun_game_open_next_box','fun_game_pet_action',
    'fun_game_player_summary','fun_game_track_action','fun_game_track_demo_action',
    'attach_live_replay_to_post','mark_live_replay_uploaded','end_livestream','ban_user_permanently',
    'run_financial_reconciliation','recalculate_user_financial','detect_device_clusters',
    'calculate_trust_score'
  ];
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = ANY(backend_only)
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon, authenticated', r.sig);
  END LOOP;

  FOR r IN
    SELECT p.oid::regprocedure AS sig FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = ANY(auth_only)
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', r.sig);
  END LOOP;
END $$;

-- 3. live_sessions: hide stream credentials from clients
REVOKE SELECT (stream_key, stream_key_encrypted, rtmps_url, recording_resource_id)
  ON public.live_sessions FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_live_session_credentials(_session_id uuid)
RETURNS TABLE(stream_key text, rtmps_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ls.stream_key, ls.rtmps_url
  FROM public.live_sessions ls
  WHERE ls.id = _session_id
    AND (ls.host_user_id = auth.uid() OR ls.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
$$;

REVOKE ALL ON FUNCTION public.get_live_session_credentials(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_live_session_credentials(uuid) TO authenticated, service_role;

-- 4. chat_settings: no cross-user reads
DROP POLICY IF EXISTS "Users can view others' message permissions" ON public.chat_settings;

CREATE OR REPLACE FUNCTION public.can_user_message(p_receiver_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender uuid := auth.uid();
  v_mode text;
BEGIN
  IF v_sender IS NULL OR p_receiver_id IS NULL THEN
    RETURN false;
  END IF;
  IF v_sender = p_receiver_id THEN
    RETURN true;
  END IF;

  SELECT who_can_message INTO v_mode FROM public.chat_settings WHERE user_id = p_receiver_id;
  v_mode := COALESCE(v_mode, 'friends');

  IF v_mode = 'everyone' THEN
    RETURN true;
  ELSIF v_mode = 'nobody' THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.friendships f
    WHERE f.status = 'accepted'
      AND ((f.user_id = v_sender AND f.friend_id = p_receiver_id)
        OR (f.user_id = p_receiver_id AND f.friend_id = v_sender))
  );
END;
$$;

REVOKE ALL ON FUNCTION public.can_user_message(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.can_user_message(uuid) TO authenticated, service_role;

-- 5. Storage: enforce owner folder on uploads
DROP POLICY IF EXISTS "Authenticated users can upload videos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload live thumbnails" ON storage.objects;

CREATE POLICY "Users can upload own live thumbnails"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'live-thumbnails'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update own live thumbnails"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'live-thumbnails'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );