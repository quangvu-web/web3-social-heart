-- Apply through the project's backend workflow; Codex must not execute migrations.
-- Existing/new groups inherit true; no explicit per-group updates or language changes.
ALTER TABLE public.telegram_community_settings
  ADD COLUMN group_vision_enabled boolean DEFAULT true;

-- The existing table keeps its RLS policies and GRANTs; no new table is introduced.
COMMENT ON COLUMN public.telegram_community_settings.group_vision_enabled IS
  'Allow conversational image descriptions only for explicit mention/reply-to-bot/ask in this group; independent from moderation OCR.';
