
-- ============================================================
-- 1. Thêm cột thiếu vào bảng messages
-- ============================================================
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS pinned_at timestamptz;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS pinned_by uuid REFERENCES public.profiles(id);
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'text';
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS edited_at timestamptz;

-- ============================================================
-- 2. Bảng user_blocks
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(blocker_id, blocked_id)
);

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own blocks"
  ON public.user_blocks FOR SELECT
  USING (auth.uid() = blocker_id);

CREATE POLICY "Users can block others"
  ON public.user_blocks FOR INSERT
  WITH CHECK (auth.uid() = blocker_id AND blocker_id != blocked_id);

CREATE POLICY "Users can unblock"
  ON public.user_blocks FOR DELETE
  USING (auth.uid() = blocker_id);

-- ============================================================
-- 3. Bảng red_envelopes
-- ============================================================
CREATE TABLE IF NOT EXISTS public.red_envelopes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  token text NOT NULL DEFAULT 'CAMLY',
  total_amount numeric NOT NULL CHECK (total_amount > 0),
  total_count int NOT NULL CHECK (total_count > 0),
  remaining_amount numeric NOT NULL,
  remaining_count int NOT NULL,
  greeting text DEFAULT '🧧 Chúc mừng năm mới!',
  status text NOT NULL DEFAULT 'active',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.red_envelopes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view envelopes in their conversations"
  ON public.red_envelopes FOR SELECT
  USING (public.is_conversation_participant(conversation_id, auth.uid()));

CREATE POLICY "Participants can create envelopes"
  ON public.red_envelopes FOR INSERT
  WITH CHECK (auth.uid() = creator_id AND public.is_conversation_participant(conversation_id, auth.uid()));

-- ============================================================
-- 4. Bảng red_envelope_claims
-- ============================================================
CREATE TABLE IF NOT EXISTS public.red_envelope_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  envelope_id uuid NOT NULL REFERENCES public.red_envelopes(id) ON DELETE CASCADE,
  claimer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(envelope_id, claimer_id)
);

ALTER TABLE public.red_envelope_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view claims"
  ON public.red_envelope_claims FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.red_envelopes re
    WHERE re.id = envelope_id
      AND public.is_conversation_participant(re.conversation_id, auth.uid())
  ));

-- ============================================================
-- 5. Bảng reports
-- ============================================================
CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reported_user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  reason text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create reports"
  ON public.reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can view own reports"
  ON public.reports FOR SELECT
  USING (auth.uid() = reporter_id);

-- ============================================================
-- 6. Bảng sticker_packs & stickers
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sticker_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  preview_url text NOT NULL,
  is_free boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sticker_packs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active sticker packs"
  ON public.sticker_packs FOR SELECT
  USING (is_active = true);

CREATE TABLE IF NOT EXISTS public.stickers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id uuid NOT NULL REFERENCES public.sticker_packs(id) ON DELETE CASCADE,
  name text NOT NULL,
  url text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  is_animated boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stickers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view stickers"
  ON public.stickers FOR SELECT
  USING (true);

-- ============================================================
-- 7. Hàm pin_message
-- ============================================================
CREATE OR REPLACE FUNCTION public.pin_message(p_message_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv_id uuid;
BEGIN
  SELECT conversation_id INTO v_conv_id FROM messages WHERE id = p_message_id;
  
  IF NOT is_conversation_participant(v_conv_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not a participant of this conversation';
  END IF;
  
  UPDATE messages
  SET pinned_at = now(), pinned_by = auth.uid()
  WHERE id = p_message_id;
END;
$$;

-- ============================================================
-- 8. Hàm unpin_message
-- ============================================================
CREATE OR REPLACE FUNCTION public.unpin_message(p_message_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv_id uuid;
BEGIN
  SELECT conversation_id INTO v_conv_id FROM messages WHERE id = p_message_id;
  
  IF NOT is_conversation_participant(v_conv_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not a participant of this conversation';
  END IF;
  
  UPDATE messages
  SET pinned_at = NULL, pinned_by = NULL
  WHERE id = p_message_id;
END;
$$;

-- ============================================================
-- 9. Hàm claim_red_envelope
-- ============================================================
CREATE OR REPLACE FUNCTION public.claim_red_envelope(p_envelope_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_envelope red_envelopes%ROWTYPE;
  v_amount numeric;
BEGIN
  SELECT * INTO v_envelope FROM red_envelopes WHERE id = p_envelope_id FOR UPDATE;
  
  IF v_envelope IS NULL THEN
    RAISE EXCEPTION 'Envelope not found';
  END IF;
  
  IF v_envelope.status != 'active' THEN
    RAISE EXCEPTION 'Envelope is no longer active';
  END IF;
  
  IF v_envelope.expires_at < now() THEN
    UPDATE red_envelopes SET status = 'expired' WHERE id = p_envelope_id;
    RAISE EXCEPTION 'Envelope has expired';
  END IF;
  
  IF NOT is_conversation_participant(v_envelope.conversation_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not a participant';
  END IF;
  
  IF EXISTS (SELECT 1 FROM red_envelope_claims WHERE envelope_id = p_envelope_id AND claimer_id = auth.uid()) THEN
    RAISE EXCEPTION 'Already claimed';
  END IF;
  
  IF v_envelope.remaining_count <= 0 THEN
    RAISE EXCEPTION 'No more envelopes left';
  END IF;
  
  -- Random amount for non-last claim
  IF v_envelope.remaining_count = 1 THEN
    v_amount := v_envelope.remaining_amount;
  ELSE
    v_amount := ROUND((random() * v_envelope.remaining_amount * 2 / v_envelope.remaining_count)::numeric, 2);
    IF v_amount < 0.01 THEN v_amount := 0.01; END IF;
    IF v_amount > v_envelope.remaining_amount - (v_envelope.remaining_count - 1) * 0.01 THEN
      v_amount := v_envelope.remaining_amount - (v_envelope.remaining_count - 1) * 0.01;
    END IF;
  END IF;
  
  INSERT INTO red_envelope_claims (envelope_id, claimer_id, amount)
  VALUES (p_envelope_id, auth.uid(), v_amount);
  
  UPDATE red_envelopes
  SET remaining_amount = remaining_amount - v_amount,
      remaining_count = remaining_count - 1,
      status = CASE WHEN remaining_count - 1 = 0 THEN 'completed' ELSE 'active' END
  WHERE id = p_envelope_id;
  
  RETURN v_amount;
END;
$$;

-- ============================================================
-- 10. Bật Realtime cho bảng mới
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_blocks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.red_envelopes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.red_envelope_claims;

-- ============================================================
-- 11. Seed sticker packs (dùng stickers có sẵn trong public/stickers/)
-- ============================================================
INSERT INTO public.sticker_packs (id, name, description, preview_url, is_free, sort_order)
VALUES ('a0000000-0000-0000-0000-000000000001', 'Fun Emotions', 'Bộ sticker cảm xúc vui nhộn', '/stickers/preview.svg', true, 1)
ON CONFLICT DO NOTHING;

INSERT INTO public.stickers (pack_id, name, url, sort_order) VALUES
('a0000000-0000-0000-0000-000000000001', 'Hello', '/stickers/hello.svg', 1),
('a0000000-0000-0000-0000-000000000001', 'Love', '/stickers/love.svg', 2),
('a0000000-0000-0000-0000-000000000001', 'LOL', '/stickers/lol.svg', 3),
('a0000000-0000-0000-0000-000000000001', 'Wow', '/stickers/wow.svg', 4),
('a0000000-0000-0000-0000-000000000001', 'Sad', '/stickers/sad.svg', 5),
('a0000000-0000-0000-0000-000000000001', 'Angry', '/stickers/angry.svg', 6)
ON CONFLICT DO NOTHING;
;
