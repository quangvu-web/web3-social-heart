INSERT INTO public.angel_feature_flags (key, enabled, meta)
VALUES ('image.free_mode', true, '{}'::jsonb)
ON CONFLICT (key) DO UPDATE SET enabled = EXCLUDED.enabled;;
