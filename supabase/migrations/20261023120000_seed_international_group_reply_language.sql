ALTER TABLE public.telegram_community_settings
  ADD COLUMN IF NOT EXISTS reply_language text NOT NULL DEFAULT 'auto';

DO $$
DECLARE
  v_bot_username text;
BEGIN
  SELECT bot_username
    INTO v_bot_username
    FROM public.telegram_community_settings
    ORDER BY created_at ASC
    LIMIT 1;

  IF NOT EXISTS (
    SELECT 1
      FROM public.telegram_community_settings
     WHERE group_id = -1003646058428
  ) THEN
    -- Match managedGroupSettingsInsert defaults: inherit the configured bot
    -- username where available and enable welcomes; leave other fields to the
    -- table defaults, as ensureSettings does for newly managed groups.
    INSERT INTO public.telegram_community_settings (
      group_id,
      bot_username,
      welcome_enabled,
      reply_language
    ) VALUES (
      -1003646058428,
      v_bot_username,
      true,
      'en'
    );
  END IF;

  UPDATE public.telegram_community_settings
     SET reply_language = 'en'
   WHERE group_id = -1003646058428;
END $$;
