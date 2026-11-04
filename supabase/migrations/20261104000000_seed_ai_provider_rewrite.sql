-- Run through Lovable before deploying the group rewrite resolver/admin UI.
-- Existing flags, table, grants and RLS remain unchanged.
INSERT INTO public.angel_feature_flags (key, enabled, meta, description)
VALUES (
  'ai.provider.rewrite',
  true,
  '{"value":"lovable"}'::jsonb,
  'Nhà cung cấp AI cho viết lại đúng ngôn ngữ nhóm (văn bản thường).'
)
ON CONFLICT (key) DO NOTHING;
