INSERT INTO public.angel_feature_flags (key, enabled, description) VALUES
  ('router.strict_mirror',  true,  'Telegram chat forward đúng 1 message user cuối tới Angel gốc — khớp payload angel.fun.rich/chat.'),
  ('router.enrich_context', false, 'Bật lại history + memory + intent-prefix vào messages gửi Angel gốc (mặc định TẮT vì làm loãng RAG).')
ON CONFLICT (key) DO NOTHING;;
