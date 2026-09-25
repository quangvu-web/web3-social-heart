CREATE TABLE IF NOT EXISTS public.price_cache (
  id text PRIMARY KEY DEFAULT 'default',
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.price_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read price cache" ON public.price_cache FOR SELECT USING (true);
;
