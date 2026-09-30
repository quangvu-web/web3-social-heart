-- Restore only the DML privileges required by Angel channel management,
-- Telegram ingestion, and retry workers. No DML is granted to client roles.
GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.angel_watched_channels
TO service_role;

GRANT SELECT, INSERT, UPDATE
ON TABLE public.angel_channel_knowledge
TO service_role;
