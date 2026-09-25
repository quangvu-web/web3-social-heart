
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'angel-channel-retry-every-2min') THEN
    PERFORM cron.unschedule('angel-channel-retry-every-2min');
  END IF;
END $$;

SELECT cron.schedule(
  'angel-channel-retry-every-2min',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://lramftbsjrqyysdqlfdg.supabase.co/functions/v1/angel-channel-retry',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);
;
