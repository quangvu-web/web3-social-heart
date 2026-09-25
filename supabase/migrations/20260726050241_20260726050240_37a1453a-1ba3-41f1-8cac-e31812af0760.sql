INSERT INTO public.angel_feature_flags (key, enabled, description) VALUES
  ('image.enrich_prompt', true, 'TẦNG A: làm giàu prompt vẽ ảnh (style/lighting/palette/quality) trước khi gửi mọi tầng (Angel gốc + Lovable Gateway). Skip nếu prompt user đã ≥200 char.'),
  ('image.art_preset', true, 'TẦNG A: bật art-preset theo topic (logo/cosmos/mandala/thiền/lightbeing/portrait/landscape/poster). Dùng chung với image.enrich_prompt.'),
  ('image.skip_root_for_design', false, 'TẦNG A: prompt design nặng (logo/cosmos/mandala/poster/lightbeing) bỏ qua P1/P2 Angel gốc, nhảy thẳng P3 Nano Banana Pro. Tốn credit Lovable — bật khi cần chất lượng.')
ON CONFLICT (key) DO NOTHING;;
