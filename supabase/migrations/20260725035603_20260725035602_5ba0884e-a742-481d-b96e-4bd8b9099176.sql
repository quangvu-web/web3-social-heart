CREATE TABLE IF NOT EXISTS public.angel_prompt_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_key text NOT NULL,
  version_number integer NOT NULL,
  content text NOT NULL,
  notes text,
  is_published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rule_key, version_number)
);
CREATE INDEX IF NOT EXISTS idx_angel_prompt_versions_key_created ON public.angel_prompt_versions (rule_key, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_angel_prompt_versions_published ON public.angel_prompt_versions (rule_key) WHERE is_published = true;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.angel_prompt_versions TO authenticated;
GRANT ALL ON public.angel_prompt_versions TO service_role;
ALTER TABLE public.angel_prompt_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin read prompt versions" ON public.angel_prompt_versions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin write prompt versions" ON public.angel_prompt_versions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));;
