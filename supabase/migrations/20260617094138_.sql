
CREATE TABLE public.telegram_bot_dm_users (
  telegram_user_id bigint PRIMARY KEY,
  chat_id bigint NOT NULL,
  username text,
  first_name text,
  last_name text,
  language_code text,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  message_count integer NOT NULL DEFAULT 0,
  last_command text,
  last_message_text text,
  linked_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.telegram_bot_dm_users TO authenticated;
GRANT ALL ON public.telegram_bot_dm_users TO service_role;

ALTER TABLE public.telegram_bot_dm_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read DM users"
  ON public.telegram_bot_dm_users
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_tg_bot_dm_users_last_seen ON public.telegram_bot_dm_users (last_seen_at DESC);
CREATE INDEX idx_tg_bot_dm_users_linked ON public.telegram_bot_dm_users (linked_user_id);

CREATE TABLE public.telegram_bot_dm_events (
  id bigserial PRIMARY KEY,
  telegram_user_id bigint NOT NULL,
  chat_id bigint NOT NULL,
  message_id bigint,
  kind text NOT NULL,
  command text,
  text_preview text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.telegram_bot_dm_events TO authenticated;
GRANT ALL ON public.telegram_bot_dm_events TO service_role;

ALTER TABLE public.telegram_bot_dm_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read DM events"
  ON public.telegram_bot_dm_events
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_tg_bot_dm_events_user ON public.telegram_bot_dm_events (telegram_user_id, created_at DESC);
CREATE INDEX idx_tg_bot_dm_events_created ON public.telegram_bot_dm_events (created_at DESC);
;
