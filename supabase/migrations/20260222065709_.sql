
-- ============================================
-- ANTI-SYBIL PROTECTION LAYER - Phase 1-3
-- ============================================

-- 1. USER TRUST TABLE
CREATE TABLE public.user_trust (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  trust_score INTEGER NOT NULL DEFAULT 50 CHECK (trust_score >= 0 AND trust_score <= 100),
  account_age_score INTEGER NOT NULL DEFAULT 0,
  engagement_score INTEGER NOT NULL DEFAULT 0,
  report_penalty INTEGER NOT NULL DEFAULT 0,
  fingerprint_penalty INTEGER NOT NULL DEFAULT 0,
  is_flagged BOOLEAN NOT NULL DEFAULT false,
  flag_reason TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_trust ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own trust" ON public.user_trust
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can read all trust" ON public.user_trust
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update trust" ON public.user_trust
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert trust" ON public.user_trust
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. USER ACTION LOG TABLE
CREATE TABLE public.user_action_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('post', 'comment', 'share', 'reaction')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_action_log_lookup ON public.user_action_log (user_id, action_type, created_at DESC);

ALTER TABLE public.user_action_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own actions" ON public.user_action_log
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can read all actions" ON public.user_action_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Service role inserts via edge functions, no INSERT policy needed for users

-- 3. USER DEVICE FINGERPRINT TABLE
CREATE TABLE public.user_device_fingerprint (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ip_hash TEXT NOT NULL,
  device_hash TEXT NOT NULL,
  user_agent_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_device_fingerprint_device ON public.user_device_fingerprint (device_hash);
CREATE INDEX idx_device_fingerprint_user ON public.user_device_fingerprint (user_id);

ALTER TABLE public.user_device_fingerprint ENABLE ROW LEVEL SECURITY;

-- Only service role (edge functions) can write; admins can read
CREATE POLICY "Admins can read fingerprints" ON public.user_device_fingerprint
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 4. REWARD PENDING TABLE (48h delay)
CREATE TABLE public.reward_pending (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount BIGINT NOT NULL DEFAULT 0,
  action_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'frozen')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  unlock_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '48 hours'),
  processed_at TIMESTAMPTZ
);

CREATE INDEX idx_reward_pending_user ON public.reward_pending (user_id, status);

ALTER TABLE public.reward_pending ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own pending rewards" ON public.reward_pending
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage pending rewards" ON public.reward_pending
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- SQL FUNCTIONS
-- ============================================

-- Function 1: Check action rate limit
CREATE OR REPLACE FUNCTION public.check_action_rate_limit(p_user_id UUID, p_action_type TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count INTEGER;
  v_limit INTEGER;
  v_account_age INTEGER;
  v_trust_score INTEGER;
  v_is_new BOOLEAN;
BEGIN
  -- Get account age in days
  SELECT EXTRACT(DAY FROM now() - created_at)::INTEGER INTO v_account_age
  FROM profiles WHERE id = p_user_id;

  -- Get trust score (default 50 if not exists)
  SELECT COALESCE(trust_score, 50) INTO v_trust_score
  FROM user_trust WHERE user_id = p_user_id;
  IF v_trust_score IS NULL THEN v_trust_score := 50; END IF;

  v_is_new := (v_account_age < 7) OR (v_trust_score < 50);

  -- Set limits based on user type
  v_limit := CASE p_action_type
    WHEN 'post' THEN CASE WHEN v_is_new THEN 3 ELSE 10 END
    WHEN 'comment' THEN CASE WHEN v_is_new THEN 10 ELSE 50 END
    WHEN 'share' THEN CASE WHEN v_is_new THEN 5 ELSE 20 END
    WHEN 'reaction' THEN CASE WHEN v_is_new THEN 20 ELSE 100 END
    ELSE 10
  END;

  -- Count actions in last 24h
  SELECT COUNT(*) INTO v_count
  FROM user_action_log
  WHERE user_id = p_user_id
    AND action_type = p_action_type
    AND created_at > now() - INTERVAL '24 hours';

  RETURN jsonb_build_object(
    'allowed', v_count < v_limit,
    'current', v_count,
    'limit', v_limit,
    'is_new_user', v_is_new,
    'trust_score', v_trust_score
  );
END;
$$;

-- Function 2: Log user action (with rate limit check)
CREATE OR REPLACE FUNCTION public.log_user_action(p_user_id UUID, p_action_type TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_check JSONB;
BEGIN
  v_check := check_action_rate_limit(p_user_id, p_action_type);

  IF NOT (v_check->>'allowed')::BOOLEAN THEN
    RETURN v_check;
  END IF;

  INSERT INTO user_action_log (user_id, action_type)
  VALUES (p_user_id, p_action_type);

  RETURN v_check;
END;
$$;

-- Function 3: Calculate trust score
CREATE OR REPLACE FUNCTION public.calculate_trust_score(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_account_age_score INTEGER;
  v_engagement_score INTEGER;
  v_report_penalty INTEGER := 0;
  v_fingerprint_penalty INTEGER := 0;
  v_trust_score INTEGER;
  v_account_days INTEGER;
  v_posts BIGINT;
  v_comments BIGINT;
  v_friends BIGINT;
  v_device_cluster_count INTEGER;
BEGIN
  -- Account age score: 1 point per day, max 25
  SELECT EXTRACT(DAY FROM now() - created_at)::INTEGER INTO v_account_days
  FROM profiles WHERE id = p_user_id;
  v_account_age_score := LEAST(v_account_days, 25);

  -- Engagement score: based on diverse activity, max 50
  SELECT COUNT(*) INTO v_posts FROM posts WHERE user_id = p_user_id;
  SELECT COUNT(*) INTO v_comments FROM comments WHERE user_id = p_user_id;
  SELECT COUNT(*) INTO v_friends FROM friendships 
    WHERE (user_id = p_user_id OR friend_id = p_user_id) AND status = 'accepted';

  v_engagement_score := LEAST(50,
    LEAST(v_posts, 20) +          -- max 20 from posts
    LEAST(v_comments, 15) +       -- max 15 from comments
    LEAST(v_friends, 15)          -- max 15 from friends
  );

  -- Report penalty: count reports against user
  SELECT COUNT(*) * 10 INTO v_report_penalty
  FROM reports WHERE reported_user_id = p_user_id AND status != 'dismissed';

  -- Fingerprint penalty: check device clusters
  SELECT COUNT(DISTINCT udf2.user_id) INTO v_device_cluster_count
  FROM user_device_fingerprint udf1
  JOIN user_device_fingerprint udf2 ON udf1.device_hash = udf2.device_hash
  WHERE udf1.user_id = p_user_id AND udf2.user_id != p_user_id;

  IF v_device_cluster_count > 3 THEN
    v_fingerprint_penalty := 15;
  ELSIF v_device_cluster_count > 1 THEN
    v_fingerprint_penalty := 5;
  END IF;

  v_trust_score := GREATEST(0, LEAST(100, 
    v_account_age_score + v_engagement_score - v_report_penalty - v_fingerprint_penalty
  ));

  -- Upsert trust record
  INSERT INTO user_trust (user_id, trust_score, account_age_score, engagement_score, report_penalty, fingerprint_penalty, updated_at)
  VALUES (p_user_id, v_trust_score, v_account_age_score, v_engagement_score, v_report_penalty, v_fingerprint_penalty, now())
  ON CONFLICT (user_id) DO UPDATE SET
    trust_score = v_trust_score,
    account_age_score = v_account_age_score,
    engagement_score = v_engagement_score,
    report_penalty = v_report_penalty,
    fingerprint_penalty = v_fingerprint_penalty,
    updated_at = now();

  RETURN v_trust_score;
END;
$$;

-- Function 4: Detect device clusters (admin only)
CREATE OR REPLACE FUNCTION public.detect_device_clusters()
RETURNS TABLE(device_hash TEXT, user_count BIGINT, user_ids UUID[], usernames TEXT[])
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can detect device clusters';
  END IF;

  RETURN QUERY
  SELECT 
    udf.device_hash,
    COUNT(DISTINCT udf.user_id) AS user_count,
    ARRAY_AGG(DISTINCT udf.user_id) AS user_ids,
    ARRAY_AGG(DISTINCT p.username) AS usernames
  FROM user_device_fingerprint udf
  JOIN profiles p ON p.id = udf.user_id
  GROUP BY udf.device_hash
  HAVING COUNT(DISTINCT udf.user_id) > 1
  ORDER BY user_count DESC;
END;
$$;

-- Initialize user_trust for existing users with default score
INSERT INTO public.user_trust (user_id, trust_score, updated_at)
SELECT id, 50, now() FROM profiles
ON CONFLICT (user_id) DO NOTHING;
;
