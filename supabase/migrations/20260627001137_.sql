ALTER TABLE public.telegram_community_settings
  ADD COLUMN IF NOT EXISTS ai_user_replies_per_minute INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS ai_user_replies_per_day INTEGER NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS ai_group_replies_per_hour INTEGER NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS ai_group_replies_per_day INTEGER NOT NULL DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS positive_engagement_max_per_day INTEGER NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS community_personality TEXT NOT NULL DEFAULT 'professional'
    CHECK (community_personality IN ('silent', 'professional', 'friendly', 'very_active', 'celebration')),
  ADD COLUMN IF NOT EXISTS ai_response_cache_ttl_hours INTEGER NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS ai_knowledge_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS mini_app_builder_timeout_minutes INTEGER NOT NULL DEFAULT 30;

UPDATE public.telegram_community_settings
SET
  ai_user_replies_per_minute = COALESCE(NULLIF(ai_max_messages_per_minute, 0), ai_user_replies_per_minute, 3),
  positive_engagement_cooldown_minutes = COALESCE(NULLIF(positive_engagement_cooldown_minutes, 0), 20),
  positive_engagement_max_per_hour = COALESCE(NULLIF(positive_engagement_max_per_hour, 0), 3)
WHERE true;

CREATE TABLE IF NOT EXISTS public.telegram_ai_priority_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id BIGINT,
  category TEXT NOT NULL,
  priority INTEGER NOT NULL,
  replies_per_minute INTEGER,
  replies_per_day INTEGER,
  group_replies_per_hour INTEGER,
  group_replies_per_day INTEGER,
  is_unlimited BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_telegram_ai_priority_rules_unique_scope
  ON public.telegram_ai_priority_rules (COALESCE(group_id, 0), category);

CREATE INDEX IF NOT EXISTS idx_telegram_ai_priority_rules_group
  ON public.telegram_ai_priority_rules (group_id, category);

CREATE TABLE IF NOT EXISTS public.telegram_ai_runtime_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id BIGINT NOT NULL,
  user_id BIGINT,
  message_id BIGINT,
  message_type TEXT,
  intent TEXT NOT NULL,
  priority INTEGER NOT NULL,
  provider TEXT,
  model TEXT,
  cache_hit BOOLEAN NOT NULL DEFAULT false,
  knowledge_used BOOLEAN NOT NULL DEFAULT false,
  tool_used TEXT,
  rate_limit_category TEXT,
  allowed BOOLEAN NOT NULL DEFAULT false,
  latency_ms INTEGER,
  retrieval_time_ms INTEGER,
  input_tokens INTEGER,
  output_tokens INTEGER,
  estimated_cost NUMERIC(12, 6),
  error TEXT,
  prompt_hash TEXT,
  prompt_preview TEXT,
  extra JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_telegram_ai_runtime_logs_group_created
  ON public.telegram_ai_runtime_logs (group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_telegram_ai_runtime_logs_user_created
  ON public.telegram_ai_runtime_logs (group_id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_telegram_ai_runtime_logs_intent_created
  ON public.telegram_ai_runtime_logs (intent, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_telegram_ai_runtime_logs_cache_created
  ON public.telegram_ai_runtime_logs (cache_hit, created_at DESC);

CREATE TABLE IF NOT EXISTS public.telegram_ai_response_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id BIGINT NOT NULL,
  cache_key TEXT NOT NULL,
  intent TEXT NOT NULL,
  language TEXT,
  prompt_hash TEXT NOT NULL,
  prompt_preview TEXT,
  response_text TEXT NOT NULL,
  provider TEXT,
  model TEXT,
  hit_count INTEGER NOT NULL DEFAULT 0,
  token_estimate_saved INTEGER NOT NULL DEFAULT 0,
  knowledge_version INTEGER NOT NULL DEFAULT 1,
  expires_at TIMESTAMPTZ NOT NULL,
  last_hit_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, cache_key)
);

CREATE INDEX IF NOT EXISTS idx_telegram_ai_response_cache_group_expires
  ON public.telegram_ai_response_cache (group_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_telegram_ai_response_cache_intent
  ON public.telegram_ai_response_cache (intent, created_at DESC);

CREATE TABLE IF NOT EXISTS public.telegram_ai_user_modes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  mode TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id, mode)
);

CREATE INDEX IF NOT EXISTS idx_telegram_ai_user_modes_group_user
  ON public.telegram_ai_user_modes (group_id, user_id, expires_at DESC);

INSERT INTO public.telegram_ai_priority_rules
  (group_id, category, priority, replies_per_minute, replies_per_day, group_replies_per_hour, group_replies_per_day, is_unlimited)
VALUES
  (NULL, 'owner', 1, NULL, NULL, NULL, NULL, true),
  (NULL, 'coordinator', 2, NULL, NULL, NULL, NULL, true),
  (NULL, 'admin', 3, NULL, NULL, NULL, NULL, true),
  (NULL, 'mention_bot', 4, 20, 500, 300, 3000, false),
  (NULL, 'reply_to_bot', 5, 20, 500, 300, 3000, false),
  (NULL, 'knowledge_question', 6, 20, 500, 300, 3000, false),
  (NULL, 'mini_app_builder', 7, 20, 1000, 500, 5000, false),
  (NULL, 'support_request', 8, 10, 300, 200, 2000, false),
  (NULL, 'wallet_request', 8, 10, 300, 200, 2000, false),
  (NULL, 'livestream_request', 8, 10, 300, 200, 2000, false),
  (NULL, 'telegram_request', 8, 10, 300, 200, 2000, false),
  (NULL, 'small_talk', 9, 3, 100, 100, 1000, false),
  (NULL, 'normal_chat', 9, 3, 100, 100, 1000, false),
  (NULL, 'positive_auto_reply', 10, NULL, 20, 3, 20, false),
  (NULL, 'spam', 11, 0, 0, 0, 0, false)
ON CONFLICT DO NOTHING;

GRANT SELECT ON public.telegram_ai_priority_rules TO authenticated;
GRANT ALL ON public.telegram_ai_priority_rules TO service_role;
GRANT SELECT ON public.telegram_ai_runtime_logs TO authenticated;
GRANT ALL ON public.telegram_ai_runtime_logs TO service_role;
GRANT SELECT ON public.telegram_ai_response_cache TO authenticated;
GRANT ALL ON public.telegram_ai_response_cache TO service_role;
GRANT SELECT ON public.telegram_ai_user_modes TO authenticated;
GRANT ALL ON public.telegram_ai_user_modes TO service_role;

ALTER TABLE public.telegram_ai_priority_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_ai_runtime_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_ai_response_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_ai_user_modes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage AI priority rules" ON public.telegram_ai_priority_rules;
CREATE POLICY "Admins can manage AI priority rules"
  ON public.telegram_ai_priority_rules
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can read AI runtime logs" ON public.telegram_ai_runtime_logs;
CREATE POLICY "Admins can read AI runtime logs"
  ON public.telegram_ai_runtime_logs
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can read AI response cache" ON public.telegram_ai_response_cache;
CREATE POLICY "Admins can read AI response cache"
  ON public.telegram_ai_response_cache
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can read AI user modes" ON public.telegram_ai_user_modes;
CREATE POLICY "Admins can read AI user modes"
  ON public.telegram_ai_user_modes
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));;
