CREATE TABLE IF NOT EXISTS public.trusted_telegram_handles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id bigint NULL,
  handle text NOT NULL,
  note text,
  added_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS trusted_telegram_handles_chat_handle_uniq
  ON public.trusted_telegram_handles (COALESCE(chat_id, 0), lower(handle));

GRANT SELECT ON public.trusted_telegram_handles TO authenticated;
GRANT ALL ON public.trusted_telegram_handles TO service_role;

ALTER TABLE public.trusted_telegram_handles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='trusted_telegram_handles'
      AND policyname='admins manage trusted tg handles'
  ) THEN
    CREATE POLICY "admins manage trusted tg handles"
      ON public.trusted_telegram_handles FOR ALL TO authenticated
      USING (public.has_role(auth.uid(), 'admin'))
      WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='trusted_telegram_handles'
      AND policyname='authenticated read trusted tg handles'
  ) THEN
    CREATE POLICY "authenticated read trusted tg handles"
      ON public.trusted_telegram_handles FOR SELECT TO authenticated
      USING (true);
  END IF;
END $$;

INSERT INTO public.trusted_telegram_handles (chat_id, handle, note) VALUES
  (NULL, 'funrich_community', 'official FUN community'),
  (NULL, 'funrich_community_bot', 'own bot'),
  (NULL, 'funrichchannel', 'official FUN channel')
ON CONFLICT DO NOTHING;;
