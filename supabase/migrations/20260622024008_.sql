-- Add moderation toggles to telegram_community_settings
ALTER TABLE public.telegram_community_settings
  ADD COLUMN IF NOT EXISTS block_telegram_previews boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS block_external_bots boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS block_scam_keywords boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS block_shock_content boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS enable_ocr_scan boolean NOT NULL DEFAULT true;

-- Allowlist of trusted external bot usernames (NULL chat_id = global)
CREATE TABLE IF NOT EXISTS public.trusted_bot_usernames (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id bigint NULL,
  username text NOT NULL,
  added_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS trusted_bot_usernames_unique
  ON public.trusted_bot_usernames (COALESCE(chat_id, 0), lower(username));

GRANT SELECT ON public.trusted_bot_usernames TO authenticated;
GRANT ALL    ON public.trusted_bot_usernames TO service_role;

ALTER TABLE public.trusted_bot_usernames ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Authenticated can read trusted bots"
    ON public.trusted_bot_usernames FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Seed default allowed bot
INSERT INTO public.trusted_bot_usernames (chat_id, username)
VALUES (NULL, 'funrich_community_bot')
ON CONFLICT DO NOTHING;

-- Seed scam / shock keywords (high severity)
INSERT INTO public.telegram_community_blocked_keywords (keyword, severity, is_active)
SELECT k, 'high', true FROM (VALUES
  ('bonus'),('airdrop'),('free money'),('casino'),('take $'),
  ('被骗'),('诈骗'),('赚钱'),('裸聊'),('轮奸'),('完整版'),('msk69'),('缅北'),
  ('蜜桃臀'),('约炮'),('援交'),('嫖娼'),('黑丝')
) AS v(k)
ON CONFLICT (keyword) DO NOTHING;;
