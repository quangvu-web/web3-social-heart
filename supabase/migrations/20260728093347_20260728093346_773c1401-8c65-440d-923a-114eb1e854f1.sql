INSERT INTO public.angel_feature_flags (key, enabled, meta)
VALUES
  ('image.distill_enabled', true, jsonb_build_object('min_chars', 180)),
  ('image.no_text_guardrail', true, '{}'::jsonb),
  ('image.fal_enabled', false, '{}'::jsonb)
ON CONFLICT (key) DO NOTHING;;
