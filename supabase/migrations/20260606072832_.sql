CREATE TABLE IF NOT EXISTS public.telegram_community_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id bigint NOT NULL UNIQUE,
  bot_username text,
  welcome_enabled boolean NOT NULL DEFAULT true,
  anti_spam_enabled boolean NOT NULL DEFAULT true,
  anti_link_enabled boolean NOT NULL DEFAULT true,
  new_user_restriction_hours integer NOT NULL DEFAULT 24,
  max_messages_per_minute integer NOT NULL DEFAULT 3,
  warning_before_mute integer NOT NULL DEFAULT 2,
  warning_before_ban integer NOT NULL DEFAULT 3,
  mute_duration_minutes integer NOT NULL DEFAULT 1440,
  welcome_message text NOT NULL DEFAULT '✨ Welcome {full_name} to the FUN.RICH Community 💚

This is a place to share love, wisdom, positive energy, and build a FUN & RICH life together.

Please read the rules and create your FUN.RICH profile to start your journey.',
  rules_message text NOT NULL DEFAULT 'FUN.RICH Community Rules

1. Be kind, respectful, and constructive.
2. No spam, scam, phishing, or fake rewards.
3. Never ask for seed phrases, private keys, or passwords.
4. No unsolicited external links or promotions.
5. Keep the community positive and helpful.',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.telegram_community_user_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id bigint NOT NULL,
  telegram_user_id bigint NOT NULL,
  username text,
  full_name text,
  joined_at timestamptz NOT NULL DEFAULT now(),
  message_count_window_start timestamptz NOT NULL DEFAULT now(),
  message_count integer NOT NULL DEFAULT 0,
  warning_count integer NOT NULL DEFAULT 0,
  muted_until timestamptz,
  banned_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, telegram_user_id)
);

CREATE TABLE IF NOT EXISTS public.telegram_community_moderation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id bigint NOT NULL,
  telegram_user_id bigint,
  username text,
  action text NOT NULL,
  reason text NOT NULL,
  message_text text,
  message_id bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.telegram_community_domain_whitelist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.telegram_community_blocked_keywords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword text NOT NULL UNIQUE,
  severity text NOT NULL DEFAULT 'medium',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT telegram_community_keyword_severity_check
    CHECK (severity IN ('low', 'medium', 'high'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_community_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_community_user_state TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_community_moderation_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_community_domain_whitelist TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_community_blocked_keywords TO authenticated;

GRANT ALL ON public.telegram_community_settings TO service_role;
GRANT ALL ON public.telegram_community_user_state TO service_role;
GRANT ALL ON public.telegram_community_moderation_logs TO service_role;
GRANT ALL ON public.telegram_community_domain_whitelist TO service_role;
GRANT ALL ON public.telegram_community_blocked_keywords TO service_role;

CREATE INDEX IF NOT EXISTS telegram_community_user_state_group_user_idx
  ON public.telegram_community_user_state(group_id, telegram_user_id);
CREATE INDEX IF NOT EXISTS telegram_community_logs_created_at_idx
  ON public.telegram_community_moderation_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS telegram_community_logs_group_created_idx
  ON public.telegram_community_moderation_logs(group_id, created_at DESC);

ALTER TABLE public.telegram_community_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_community_user_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_community_moderation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_community_domain_whitelist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_community_blocked_keywords ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage telegram community settings" ON public.telegram_community_settings;
CREATE POLICY "Admins manage telegram community settings"
  ON public.telegram_community_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins read telegram community user state" ON public.telegram_community_user_state;
CREATE POLICY "Admins read telegram community user state"
  ON public.telegram_community_user_state FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins read telegram community logs" ON public.telegram_community_moderation_logs;
CREATE POLICY "Admins read telegram community logs"
  ON public.telegram_community_moderation_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins manage telegram community domain whitelist" ON public.telegram_community_domain_whitelist;
CREATE POLICY "Admins manage telegram community domain whitelist"
  ON public.telegram_community_domain_whitelist FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins manage telegram community blocked keywords" ON public.telegram_community_blocked_keywords;
CREATE POLICY "Admins manage telegram community blocked keywords"
  ON public.telegram_community_blocked_keywords FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.telegram_community_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS telegram_community_settings_touch ON public.telegram_community_settings;
CREATE TRIGGER telegram_community_settings_touch
BEFORE UPDATE ON public.telegram_community_settings
FOR EACH ROW EXECUTE FUNCTION public.telegram_community_touch_updated_at();

DROP TRIGGER IF EXISTS telegram_community_user_state_touch ON public.telegram_community_user_state;
CREATE TRIGGER telegram_community_user_state_touch
BEFORE UPDATE ON public.telegram_community_user_state
FOR EACH ROW EXECUTE FUNCTION public.telegram_community_touch_updated_at();

INSERT INTO public.telegram_community_domain_whitelist(domain)
VALUES ('fun.rich'), ('funprofile.camly.co'), ('t.me/funrich')
ON CONFLICT (domain) DO NOTHING;

INSERT INTO public.telegram_community_blocked_keywords(keyword, severity)
VALUES
  ('airdrop free', 'medium'),
  ('claim reward', 'medium'),
  ('investment guaranteed', 'high'),
  ('double your money', 'high'),
  ('seed phrase', 'high'),
  ('private key', 'high'),
  ('connect wallet now', 'high'),
  ('urgent verify wallet', 'high')
ON CONFLICT (keyword) DO NOTHING;;
