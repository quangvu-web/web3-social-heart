ALTER TABLE public.angel_persona_settings
  ADD COLUMN IF NOT EXISTS rule_overrides jsonb NOT NULL DEFAULT '{}'::jsonb;;
