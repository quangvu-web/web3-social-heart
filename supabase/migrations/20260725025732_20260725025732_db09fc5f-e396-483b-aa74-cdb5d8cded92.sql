
-- 1) angel_feature_flags: cờ bật/tắt runtime
CREATE TABLE public.angel_feature_flags (
  key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT ON public.angel_feature_flags TO authenticated;
GRANT ALL ON public.angel_feature_flags TO service_role;

ALTER TABLE public.angel_feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view feature flags"
  ON public.angel_feature_flags FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage feature flags"
  ON public.angel_feature_flags FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.touch_angel_feature_flags()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_angel_feature_flags_touch
BEFORE UPDATE ON public.angel_feature_flags
FOR EACH ROW EXECUTE FUNCTION public.touch_angel_feature_flags();

-- Seed các flag hiện đang có ở code (default TẮT trừ chỗ đang bật thật sự)
INSERT INTO public.angel_feature_flags (key, enabled, description) VALUES
  ('postprocess.style_pass',           false, 'Chạy Gemini flash-lite để rút gọn + thêm emoji sau response Angel gốc.'),
  ('postprocess.narrative_fixup',      true,  'Sửa lời thoại nhân vật bị chèn "Angel" sai xưng hô.'),
  ('postprocess.hard_revert',          true,  'Regex safety net: hòa Angel → hòa mình, bé bè → bạn bè...'),
  ('image.fallback_lovable_enabled',   true,  'Cho phép P3 fallback ảnh qua Lovable AI Gateway (tốn credit).'),
  ('image.force_pro_on_heavy',         true,  'Prompt heavy (logo/design/mô tả dài) → dùng gemini-3-pro-image.'),
  ('image.rewrite_prompt',             true,  'Rewrite brief Việt bullet-heavy sang English prose trước generate-image.'),
  ('router.smart_fallback',            true,  'Bot tự đoán ý định khi câu hỏi quá ngắn/mơ hồ, không trả "chưa hiểu".'),
  ('router.factual_clean_mirror',      true,  'Câu hỏi tra cứu thật → bypass style pass, dùng thẳng mirror RAG.'),
  ('router.dm_unlimited_length',       true,  'DM riêng không giới hạn độ dài phản hồi.'),
  ('memory.extract_on_dm',             true,  'Sau DM, trích fact bằng flash-lite lưu memory user.'),
  ('memory.callback_in_reply',         true,  'Cho phép Angel gợi lại chi tiết cũ từ memory.'),
  ('spam.mention_bait',                true,  'Chặn tin nhắn mention-bait scam.'),
  ('spam.cjk',                         true,  'Chặn mẫu spam ký tự Trung/Nhật/Hàn.'),
  ('spam.payment_laundering',          true,  'Chặn scam payment gateway / API laundering 2026.')
ON CONFLICT (key) DO NOTHING;

-- 2) angel_ai_events: telemetry
CREATE TABLE public.angel_ai_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ts timestamptz NOT NULL DEFAULT now(),
  channel text NOT NULL,       -- dm | group | web | inline | worker
  intent text NOT NULL,        -- chat | image | youtube | memory_extract | style_pass...
  tier text,                   -- primary | backup | fallback | postprocess
  model text,
  user_ref text,
  duration_ms integer NOT NULL DEFAULT 0,
  tokens_in integer,
  tokens_out integer,
  credits_est numeric,
  ok boolean NOT NULL DEFAULT true,
  error text,
  meta jsonb
);

CREATE INDEX idx_angel_ai_events_ts        ON public.angel_ai_events (ts DESC);
CREATE INDEX idx_angel_ai_events_channel   ON public.angel_ai_events (channel, ts DESC);
CREATE INDEX idx_angel_ai_events_intent    ON public.angel_ai_events (intent, ts DESC);
CREATE INDEX idx_angel_ai_events_user_ref  ON public.angel_ai_events (user_ref, ts DESC) WHERE user_ref IS NOT NULL;
CREATE INDEX idx_angel_ai_events_ok        ON public.angel_ai_events (ok, ts DESC) WHERE ok = false;

GRANT SELECT ON public.angel_ai_events TO authenticated;
GRANT ALL ON public.angel_ai_events TO service_role;

ALTER TABLE public.angel_ai_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view ai events"
  ON public.angel_ai_events FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role writes ai events"
  ON public.angel_ai_events FOR INSERT
  TO service_role
  WITH CHECK (true);
;
