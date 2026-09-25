-- Table 1: watched channels config
CREATE TABLE public.angel_watched_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id bigint NOT NULL UNIQUE,
  username text,
  title text,
  is_active boolean NOT NULL DEFAULT true,
  auto_push_to_core boolean NOT NULL DEFAULT true,
  last_synced_at timestamptz,
  last_message_id bigint,
  ingested_count integer NOT NULL DEFAULT 0,
  added_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.angel_watched_channels TO authenticated;
GRANT ALL ON public.angel_watched_channels TO service_role;

ALTER TABLE public.angel_watched_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage watched channels"
  ON public.angel_watched_channels
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER angel_watched_channels_updated_at
  BEFORE UPDATE ON public.angel_watched_channels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Table 2: ingested content from channels
CREATE TABLE public.angel_channel_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id bigint NOT NULL,
  message_id bigint NOT NULL,
  content text,
  media_type text,
  media_url text,
  posted_at timestamptz,
  raw_message jsonb,
  pushed_to_core boolean NOT NULL DEFAULT false,
  pushed_at timestamptz,
  push_error text,
  core_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(chat_id, message_id)
);

CREATE INDEX idx_angel_channel_knowledge_chat_id ON public.angel_channel_knowledge(chat_id, posted_at DESC);
CREATE INDEX idx_angel_channel_knowledge_unpushed ON public.angel_channel_knowledge(pushed_to_core) WHERE pushed_to_core = false;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.angel_channel_knowledge TO authenticated;
GRANT ALL ON public.angel_channel_knowledge TO service_role;

ALTER TABLE public.angel_channel_knowledge ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view all channel knowledge"
  ON public.angel_channel_knowledge
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage channel knowledge"
  ON public.angel_channel_knowledge
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER angel_channel_knowledge_updated_at
  BEFORE UPDATE ON public.angel_channel_knowledge
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();;
