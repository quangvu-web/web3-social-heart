
CREATE TABLE public.angel_user_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_key text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('telegram','web')),
  display_name text,
  preferred_language text,
  facts jsonb NOT NULL DEFAULT '[]'::jsonb,
  turn_count integer NOT NULL DEFAULT 0,
  last_extracted_at timestamptz,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (channel, user_key)
);

CREATE INDEX idx_angel_user_memory_lookup ON public.angel_user_memory (channel, user_key);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.angel_user_memory TO authenticated;
GRANT ALL ON public.angel_user_memory TO service_role;

ALTER TABLE public.angel_user_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage angel_user_memory"
  ON public.angel_user_memory
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_angel_user_memory_updated_at
  BEFORE UPDATE ON public.angel_user_memory
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
;
