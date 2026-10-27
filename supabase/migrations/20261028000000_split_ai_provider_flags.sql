-- Run through Lovable BEFORE deploying the per-service resolver or admin UI.
-- Existing table/RLS/grants are unchanged; this migration only seeds rows.
DO $migration$
DECLARE
  legacy public.angel_feature_flags%ROWTYPE;
BEGIN
  SELECT * INTO legacy
  FROM public.angel_feature_flags
  WHERE key = 'ai.provider'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cannot seed service providers: ai.provider is missing';
  END IF;

  INSERT INTO public.angel_feature_flags (key, enabled, meta, description)
  SELECT service.key, legacy.enabled, legacy.meta, service.description
  FROM (VALUES
    ('ai.provider.caption', 'Nhà cung cấp AI cho dịch phụ đề.'),
    ('ai.provider.vision', 'Nhà cung cấp AI cho đọc ảnh.'),
    ('ai.provider.ocr', 'Nhà cung cấp AI cho quét chữ trong ảnh (OCR).')
  ) AS service(key, description)
  ON CONFLICT (key) DO NOTHING;

  -- Source row remains untouched, including its metadata and updated_at.
  -- Existing service rows are deliberately never overwritten on a rerun.
END;
$migration$;
