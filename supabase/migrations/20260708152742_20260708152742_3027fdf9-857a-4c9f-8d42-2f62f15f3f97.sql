
CREATE TABLE public.telegram_history_backfill (
  id uuid primary key default gen_random_uuid(),
  chat_id bigint not null unique,
  chat_title text,
  chat_username text,
  session_string text,
  phone_code_hash text,
  cursor_min_id bigint default 0,
  total_ingested integer default 0,
  total_seen integer default 0,
  status text default 'idle',
  last_error text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

GRANT SELECT ON public.telegram_history_backfill TO authenticated;
GRANT ALL ON public.telegram_history_backfill TO service_role;

ALTER TABLE public.telegram_history_backfill ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view backfill state"
  ON public.telegram_history_backfill
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
;
