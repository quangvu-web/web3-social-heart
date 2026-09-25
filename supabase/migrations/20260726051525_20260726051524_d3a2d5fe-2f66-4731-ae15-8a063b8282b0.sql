INSERT INTO public.angel_feature_flags (key, enabled, meta) VALUES
  ('image.stream_lovable', true, jsonb_build_object('desc', 'Bật SSE streaming khi gọi Lovable Gateway vẽ ảnh (Nano Banana Pro).')),
  ('image.stream_telegram_preview', true, jsonb_build_object('desc', 'Bật preview streaming ảnh trên Telegram: gửi partial rồi editMessageMedia bằng final.'))
ON CONFLICT (key) DO NOTHING;;
