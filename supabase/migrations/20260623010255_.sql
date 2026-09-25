-- Harden Community Guard against fake reward / eligibility / admin-contact scam waves.
INSERT INTO public.telegram_community_blocked_keywords (keyword, severity, is_active)
SELECT k, 'high', true FROM (VALUES
  ('community reward distribution'),
  ('additional reward round'),
  ('confirm eligibility'),
  ('participation details'),
  ('multi-account activity'),
  ('only one application'),
  ('wallets have previously interacted'),
  ('contact the administrator'),
  ('rickmorgan_support'),
  ('reward round'),
  ('receive participation details')
) AS v(k)
ON CONFLICT (keyword) DO UPDATE
SET severity = 'high',
    is_active = true;

UPDATE public.telegram_community_settings
SET anti_spam_enabled = true,
    anti_link_enabled = true,
    block_scam_keywords = true,
    warning_before_mute = 2,
    warning_before_ban = 3,
    mute_duration_minutes = 1440;;
