CREATE TABLE IF NOT EXISTS public.angel_lovable_image_fallback_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_ref text NOT NULL,
  usage_day date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Kuala_Lumpur')::date,
  count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_ref, usage_day)
);

GRANT SELECT, INSERT, UPDATE ON public.angel_lovable_image_fallback_usage TO authenticated;
GRANT ALL ON public.angel_lovable_image_fallback_usage TO service_role;

ALTER TABLE public.angel_lovable_image_fallback_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_full_access_lovable_img_fallback"
  ON public.angel_lovable_image_fallback_usage
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_angel_lovable_img_fallback_day
  ON public.angel_lovable_image_fallback_usage (usage_day DESC);;
