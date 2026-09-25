
-- 1) Mở rộng channel cho angel_user_memory: thêm 'group' và 'inline'
ALTER TABLE public.angel_user_memory DROP CONSTRAINT IF EXISTS angel_user_memory_channel_check;
ALTER TABLE public.angel_user_memory
  ADD CONSTRAINT angel_user_memory_channel_check
  CHECK (channel IN ('telegram','web','group','inline'));

-- 2) Cross-device: lưu lịch sử chat web của bé lên server để đồng bộ mọi thiết bị
CREATE TABLE public.angel_web_chat_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_angel_web_chat_history_user ON public.angel_web_chat_history (user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.angel_web_chat_history TO authenticated;
GRANT ALL ON public.angel_web_chat_history TO service_role;

ALTER TABLE public.angel_web_chat_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own web chat history"
  ON public.angel_web_chat_history FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own web chat history"
  ON public.angel_web_chat_history FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins manage all web chat history"
  ON public.angel_web_chat_history FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 3) Toggle bật/tắt memory toàn cục (admin quản lý)
CREATE TABLE public.angel_memory_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled_web boolean NOT NULL DEFAULT true,
  enabled_telegram_dm boolean NOT NULL DEFAULT true,
  enabled_group boolean NOT NULL DEFAULT false,
  enabled_inline boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.angel_memory_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

GRANT SELECT ON public.angel_memory_settings TO authenticated;
GRANT ALL ON public.angel_memory_settings TO service_role;

ALTER TABLE public.angel_memory_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone authenticated read angel_memory_settings"
  ON public.angel_memory_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins update angel_memory_settings"
  ON public.angel_memory_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
;
