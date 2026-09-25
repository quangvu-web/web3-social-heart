ALTER TABLE public.telegram_community_settings
  ADD COLUMN IF NOT EXISTS ai_persona_prompt text;

COMMENT ON COLUMN public.telegram_community_settings.ai_persona_prompt IS
  'Persona/xưng hô rule áp dụng cho Angel AI (Pass 1 + Pass 2). NULL = dùng DEFAULT_AI_PERSONA_PROMPT trong edge function.';;
