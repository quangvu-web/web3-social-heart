
CREATE TABLE public.angel_persona_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  persona_prompt text,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.angel_persona_settings TO authenticated;
GRANT ALL ON public.angel_persona_settings TO service_role;

ALTER TABLE public.angel_persona_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin read angel persona"
  ON public.angel_persona_settings
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin write angel persona"
  ON public.angel_persona_settings
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.angel_persona_settings (singleton, persona_prompt)
VALUES (true, NULL)
ON CONFLICT (singleton) DO NOTHING;
;
