
-- restream_oauth_states: short-lived OAuth state tokens
CREATE TABLE public.restream_oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  state_hash TEXT NOT NULL UNIQUE,
  redirect_after TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.restream_oauth_states TO service_role;
ALTER TABLE public.restream_oauth_states ENABLE ROW LEVEL SECURITY;

-- restream_connections: per-user encrypted token store
CREATE TABLE public.restream_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  restream_user_id TEXT,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.restream_connections TO authenticated;
GRANT ALL ON public.restream_connections TO service_role;
ALTER TABLE public.restream_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own restream connection"
  ON public.restream_connections FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- restream_channels: destinations connected via Restream
CREATE TABLE public.restream_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  restream_channel_id TEXT NOT NULL,
  platform_id INTEGER,
  platform TEXT,
  display_name TEXT,
  channel_url TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  raw JSONB,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, restream_channel_id)
);
GRANT SELECT ON public.restream_channels TO authenticated;
GRANT ALL ON public.restream_channels TO service_role;
ALTER TABLE public.restream_channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own restream channels"
  ON public.restream_channels FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- restream_api_logs: audit logs for Restream API calls
CREATE TABLE public.restream_api_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  live_session_id UUID,
  action TEXT NOT NULL,
  method TEXT,
  endpoint TEXT,
  status_code INTEGER,
  success BOOLEAN NOT NULL DEFAULT false,
  error_code TEXT,
  error_message TEXT,
  duration_ms INTEGER,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.restream_api_logs TO service_role;
ALTER TABLE public.restream_api_logs ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX idx_restream_oauth_states_user ON public.restream_oauth_states(user_id);
CREATE INDEX idx_restream_oauth_states_expires ON public.restream_oauth_states(expires_at);
CREATE INDEX idx_restream_channels_user ON public.restream_channels(user_id);
CREATE INDEX idx_restream_api_logs_user_created ON public.restream_api_logs(user_id, created_at DESC);
;
