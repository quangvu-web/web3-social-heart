
CREATE TABLE IF NOT EXISTS public.telegram_ai_restyle_cache (
  cache_key text PRIMARY KEY,
  restyled_text text NOT NULL,
  hit_count integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_hit_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_ai_restyle_cache TO service_role;

ALTER TABLE public.telegram_ai_restyle_cache ENABLE ROW LEVEL SECURITY;

-- Only service_role (edge functions) reads/writes this cache; no policy for anon/authenticated.
CREATE POLICY "restyle_cache_service_only"
  ON public.telegram_ai_restyle_cache
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_restyle_cache_last_hit
  ON public.telegram_ai_restyle_cache(last_hit_at);

-- Weekly cleanup: drop cache entries not hit in the last 60 days.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('cleanup-restyle-cache-weekly')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-restyle-cache-weekly');
    PERFORM cron.schedule(
      'cleanup-restyle-cache-weekly',
      '0 3 * * 0',
      $cron$DELETE FROM public.telegram_ai_restyle_cache WHERE last_hit_at < now() - interval '60 days'$cron$
    );
  END IF;
END $$;
;
