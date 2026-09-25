ALTER TABLE public.telegram_community_settings
  ADD COLUMN IF NOT EXISTS ai_persona_prompt text;

COMMENT ON COLUMN public.telegram_community_settings.ai_persona_prompt IS
  'Prompt xưng hô (persona) cho Angel AI: ép bot tự xưng "Angel" và gọi user là "bé". Để trống → dùng default trong code.';;
