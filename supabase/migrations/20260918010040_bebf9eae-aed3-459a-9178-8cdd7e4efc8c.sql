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
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;

  FOR r IN
    SELECT p.oid::regprocedure AS sig FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = ANY(auth_only)
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.sig);
  END LOOP;
END $$;