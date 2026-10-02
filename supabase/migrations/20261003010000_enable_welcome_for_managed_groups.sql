-- One-time backfill: enable welcome messages for every currently managed group.
-- CAPTCHA and all other group settings remain unchanged.
UPDATE public.telegram_community_settings
SET welcome_enabled = TRUE
WHERE welcome_enabled IS DISTINCT FROM TRUE;
