ALTER TABLE public.telegram_community_settings ADD COLUMN caption_operator_ids BIGINT[] DEFAULT '{}'::BIGINT[];
DO $$
BEGIN
  IF (SELECT id FROM public.telegram_community_settings ORDER BY created_at ASC LIMIT 1) IS DISTINCT FROM 'a4853d56-cc46-4a5a-a5f9-3b36a571107b'::uuid THEN
    RAISE EXCEPTION 'Community settings row changed; refusing operator seed';
  END IF;
  UPDATE public.telegram_community_settings
  SET caption_operator_ids = ARRAY[5373909526]::BIGINT[]
  WHERE id = 'a4853d56-cc46-4a5a-a5f9-3b36a571107b'::uuid;
END;
$$;