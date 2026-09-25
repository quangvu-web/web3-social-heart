
CREATE TABLE IF NOT EXISTS public.angel_image_pipeline_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_ref TEXT,
  tier TEXT NOT NULL,                 -- P1_spiritual | P1_fast | P2_fast | P3_lovable | jump_pro
  model TEXT,                          -- angel-root | google/gemini-3-pro-image | ...
  topic TEXT,                          -- logo|cosmos|... from classifyArtTopic
  design_heavy BOOLEAN NOT NULL DEFAULT false,
  heavy BOOLEAN NOT NULL DEFAULT false,
  force_hd BOOLEAN NOT NULL DEFAULT false,
  ok BOOLEAN NOT NULL,
  duration_ms INTEGER,
  prompt_len INTEGER,
  final_prompt_len INTEGER,
  error_status INTEGER,
  error_msg TEXT,
  fallback_stage TEXT,
  meta JSONB
);

CREATE INDEX IF NOT EXISTS idx_angel_image_pipeline_logs_created_at
  ON public.angel_image_pipeline_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_angel_image_pipeline_logs_tier
  ON public.angel_image_pipeline_logs (tier, created_at DESC);

GRANT SELECT ON public.angel_image_pipeline_logs TO authenticated;
GRANT ALL ON public.angel_image_pipeline_logs TO service_role;

ALTER TABLE public.angel_image_pipeline_logs ENABLE ROW LEVEL SECURITY;

-- Admin-only read: reuse has_role('admin') pattern already established in project.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'has_role') THEN
    EXECUTE $p$
      CREATE POLICY "Admins can view image pipeline logs"
      ON public.angel_image_pipeline_logs
      FOR SELECT
      TO authenticated
      USING (public.has_role(auth.uid(), 'admin'::public.app_role))
    $p$;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Seed new flag (default OFF) — extend P1 enrich for design-heavy topics.
INSERT INTO public.angel_feature_flags (key, enabled, description)
VALUES ('image.enrich_p1_design', false, 'Force enrich prompt (opts.force=true) for design-heavy topics on P1 Angel gốc.')
ON CONFLICT (key) DO NOTHING;
;
