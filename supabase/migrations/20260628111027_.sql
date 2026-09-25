ALTER TABLE public.telegram_community_settings
  ADD COLUMN IF NOT EXISTS fun_core_context_prompt TEXT;;
