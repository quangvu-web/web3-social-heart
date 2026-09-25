
CREATE TABLE IF NOT EXISTS public.cloud_usage_events (
  id BIGSERIAL PRIMARY KEY,
  function_name TEXT NOT NULL,
  feature TEXT,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  status_code INTEGER,
  bytes_out INTEGER,
  meta JSONB,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cloud_usage_events_occurred_idx ON public.cloud_usage_events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS cloud_usage_events_fn_time_idx ON public.cloud_usage_events(function_name, occurred_at DESC);

GRANT SELECT ON public.cloud_usage_events TO authenticated;
GRANT INSERT ON public.cloud_usage_events TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.cloud_usage_events_id_seq TO authenticated;
GRANT ALL ON public.cloud_usage_events TO service_role;
GRANT ALL ON SEQUENCE public.cloud_usage_events_id_seq TO service_role;

ALTER TABLE public.cloud_usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_can_read_cloud_usage" ON public.cloud_usage_events
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "any_authenticated_can_insert_cloud_usage" ON public.cloud_usage_events
  FOR INSERT TO authenticated
  WITH CHECK (true);
;
