
CREATE TABLE public.telegram_group_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id BIGINT NOT NULL UNIQUE,
  group_title TEXT,
  welcome_message TEXT NOT NULL DEFAULT 'Chào mừng {name} đến với cộng đồng FUN.RICH! 🌟 Hãy giới thiệu bản thân nhé.',
  ai_enabled BOOLEAN NOT NULL DEFAULT true,
  moderation_level TEXT NOT NULL DEFAULT 'medium' CHECK (moderation_level IN ('off','medium','strict')),
  mute_minutes INT NOT NULL DEFAULT 60,
  strike_threshold INT NOT NULL DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_group_config TO authenticated;
GRANT ALL ON public.telegram_group_config TO service_role;
ALTER TABLE public.telegram_group_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage telegram group config"
ON public.telegram_group_config FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.telegram_group_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id BIGINT NOT NULL,
  tg_user_id BIGINT,
  tg_username TEXT,
  message_id BIGINT,
  message_text TEXT,
  reason TEXT NOT NULL,
  action_taken TEXT NOT NULL,
  ai_score JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tg_violations_group_time ON public.telegram_group_violations(group_id, created_at DESC);
CREATE INDEX idx_tg_violations_user ON public.telegram_group_violations(tg_user_id);

GRANT SELECT, INSERT ON public.telegram_group_violations TO authenticated;
GRANT ALL ON public.telegram_group_violations TO service_role;
ALTER TABLE public.telegram_group_violations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read telegram violations"
ON public.telegram_group_violations FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.telegram_group_strikes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id BIGINT NOT NULL,
  tg_user_id BIGINT NOT NULL,
  tg_username TEXT,
  strike_count INT NOT NULL DEFAULT 0,
  last_violation_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, tg_user_id)
);

GRANT SELECT ON public.telegram_group_strikes TO authenticated;
GRANT ALL ON public.telegram_group_strikes TO service_role;
ALTER TABLE public.telegram_group_strikes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read telegram strikes"
ON public.telegram_group_strikes FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.tg_group_config_touch()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_tg_group_config_touch
BEFORE UPDATE ON public.telegram_group_config
FOR EACH ROW EXECUTE FUNCTION public.tg_group_config_touch();

CREATE TRIGGER trg_tg_group_strikes_touch
BEFORE UPDATE ON public.telegram_group_strikes
FOR EACH ROW EXECUTE FUNCTION public.tg_group_config_touch();
;
