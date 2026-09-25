
INSERT INTO public.angel_feature_flags (key, enabled, description) VALUES
  ('image.skip_root_for_design', true, 'Design-heavy topics (logo/cosmos/mandala/poster/lightbeing) skip P1/P2 and go straight to Nano Banana Pro.'),
  ('image.force_pro_on_heavy', true, 'Force gemini-3-pro-image for heavy or design-heavy prompts in the Lovable fallback tier.'),
  ('image.enrich_prompt', true, 'Enrich prompt with style/lighting/palette/composition before sending to image model.'),
  ('image.art_preset', true, 'Apply topic-specific art presets (logo/cosmos/mandala/thien/lightbeing).'),
  ('image.enrich_p1_design', false, 'Also enrich prompt for P1 Angel root when topic is design-heavy (kill-switch OFF by default).'),
  ('image.stream_lovable', true, 'Stream Lovable Gateway image generation (SSE partial frames).'),
  ('image.stream_telegram_preview', true, 'Send partial preview then edit final on Telegram.'),
  ('image.rewrite_prompt', true, 'Rewrite heavy Vietnamese prompts into concise English brief before generation.'),
  ('image.fallback_lovable_enabled', true, 'Master switch for Lovable Gateway fallback tier.')
ON CONFLICT (key) DO UPDATE
SET enabled = EXCLUDED.enabled,
    description = EXCLUDED.description,
    updated_at = now();
;
