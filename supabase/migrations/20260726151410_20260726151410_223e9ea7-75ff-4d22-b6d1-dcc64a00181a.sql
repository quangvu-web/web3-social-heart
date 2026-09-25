
-- Rolling summary storage
CREATE TABLE IF NOT EXISTS public.angel_conversation_summary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL CHECK (channel IN ('telegram_dm','telegram_group','web')),
  scope_key text NOT NULL,
  summary text NOT NULL DEFAULT '',
  turns_covered integer NOT NULL DEFAULT 0,
  last_message_ref text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (channel, scope_key)
);

GRANT SELECT ON public.angel_conversation_summary TO authenticated;
GRANT ALL ON public.angel_conversation_summary TO service_role;

ALTER TABLE public.angel_conversation_summary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read angel_conversation_summary"
  ON public.angel_conversation_summary FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins manage angel_conversation_summary"
  ON public.angel_conversation_summary FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX IF NOT EXISTS idx_angel_conv_summary_lookup
  ON public.angel_conversation_summary (channel, scope_key);

CREATE TRIGGER update_angel_conv_summary_updated_at
  BEFORE UPDATE ON public.angel_conversation_summary
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Extend memory settings with rolling summary toggles + thresholds
ALTER TABLE public.angel_memory_settings
  ADD COLUMN IF NOT EXISTS rolling_summary_dm boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rolling_summary_group boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rolling_summary_web boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rolling_summary_turn_threshold integer NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS rolling_summary_keep_recent integer NOT NULL DEFAULT 6;
;
