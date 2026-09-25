CREATE TABLE public.meditation_schedule_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_vi text NOT NULL DEFAULT 'Rãi hoa và hương thơm từ Đất Trời. Quả cầu pha lê. Om Mani Padme Hum.',
  topic_en text NOT NULL DEFAULT 'Scattering Flowers and Fragrance from Heaven and Earth. Crystal Sphere. Om Mani Padme Hum.',
  zoom_url text NOT NULL DEFAULT 'https://zoom.us/j/8808082024?pwd=ZuWAc0so0yxCppowVAUGamsdzna9Md.1',
  zoom_id text NOT NULL DEFAULT '88 08 08 2024',
  zoom_pw text NOT NULL DEFAULT '999',
  youtube_community_url text DEFAULT '',
  youtube_happy_url text DEFAULT '',
  facebook_url text DEFAULT '',
  funprofile_url text DEFAULT '',
  telegram_url text NOT NULL DEFAULT 'https://t.me/camlycoin9999?videochat',
  x_url text DEFAULT '',
  image_path text,
  image_prompt text NOT NULL DEFAULT 'Spiritual meditation poster: cosmic night sky with a glowing crystal tree of light reflected on calm water, floating lotus flowers in pink purple gold, soft sparkles, Om Mani Padme Hum mantra, ethereal serene atmosphere, 16:9',
  target_chat_ids text[] NOT NULL DEFAULT ARRAY['-1001923198068','-1002379632770'],
  send_times_vn text[] NOT NULL DEFAULT ARRAY['04:45','11:45','19:45'],
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meditation_schedule_config TO authenticated;
GRANT ALL ON public.meditation_schedule_config TO service_role;

ALTER TABLE public.meditation_schedule_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage meditation config"
  ON public.meditation_schedule_config FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_meditation_config_updated_at
  BEFORE UPDATE ON public.meditation_schedule_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.meditation_schedule_config DEFAULT VALUES;

CREATE TABLE public.meditation_post_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id text NOT NULL,
  slot text NOT NULL,
  sent_date date NOT NULL,
  message_id bigint,
  status text NOT NULL,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chat_id, slot, sent_date)
);

GRANT SELECT ON public.meditation_post_log TO authenticated;
GRANT ALL ON public.meditation_post_log TO service_role;

ALTER TABLE public.meditation_post_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read meditation log"
  ON public.meditation_post_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Public read meditation images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'meditation-images');

CREATE POLICY "Admin write meditation images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'meditation-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin update meditation images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'meditation-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin delete meditation images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'meditation-images' AND public.has_role(auth.uid(), 'admin'));;
