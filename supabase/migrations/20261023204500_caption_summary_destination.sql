ALTER TABLE public.telegram_community_settings
  ADD COLUMN IF NOT EXISTS caption_summary_chat_id BIGINT;

DO $$
BEGIN
  IF (SELECT id FROM public.telegram_community_settings ORDER BY created_at ASC LIMIT 1)
    IS DISTINCT FROM 'a4853d56-cc46-4a5a-a5f9-3b36a571107b'::uuid THEN
    RAISE EXCEPTION 'Community settings primary row changed; refusing caption summary destination seed';
  END IF;

  UPDATE public.telegram_community_settings
  SET caption_summary_chat_id = -1001649798056
  WHERE id = 'a4853d56-cc46-4a5a-a5f9-3b36a571107b'::uuid;
END;
$$;
