CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$
BEGIN
  PERFORM cron.unschedule('meditation-broadcast-morning');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$
BEGIN
  PERFORM cron.unschedule('meditation-broadcast-noon');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$
BEGIN
  PERFORM cron.unschedule('meditation-broadcast-evening');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$
BEGIN
  PERFORM cron.unschedule('meditation-broadcast-every-minute');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'meditation-broadcast-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://lramftbsjrqyysdqlfdg.supabase.co/functions/v1/meditation-broadcast',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);;
