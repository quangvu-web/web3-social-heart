-- Community administration uses the backend service role after requireAdmin().
-- Restore only the table privileges required by that handler; keep RLS intact.
GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.telegram_community_settings
TO service_role;
