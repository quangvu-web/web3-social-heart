CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

SELECT cron.schedule(
  'angel-health-check-every-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://lramftbsjrqyysdqlfdg.supabase.co/functions/v1/angel-health-check',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);;
