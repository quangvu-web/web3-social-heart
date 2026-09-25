
-- =============================================
-- PHASE 4: Update get_user_rewards_v2 with Trust Multiplier
-- PHASE 5: Create user_stake_status table
-- PHASE 6: Create calculate_engagement_quality function + update calculate_trust_score
-- =============================================

-- PHASE 4: Rebuild get_user_rewards_v2 with trust multiplier
CREATE OR REPLACE FUNCTION public.get_user_rewards_v2(limit_count integer DEFAULT 10)
 RETURNS TABLE(id uuid, username text, avatar_url text, posts_count bigint, comments_count bigint, reactions_count bigint, friends_count bigint, shares_count bigint, reactions_on_posts bigint, livestreams_count bigint, today_reward bigint, total_reward bigint)
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  cutoff_date CONSTANT TIMESTAMPTZ := '2026-01-15 00:00:00+00';
BEGIN
  RETURN QUERY
  WITH 
  old_stats AS (
    SELECT 
      p.id AS user_id,
      COALESCE((SELECT COUNT(*) FROM posts WHERE user_id = p.id AND created_at < cutoff_date), 0) AS old_posts,
      COALESCE((
        SELECT COUNT(*) FROM comments c
        INNER JOIN posts po ON c.post_id = po.id
        WHERE po.user_id = p.id AND c.created_at < cutoff_date
      ), 0) AS old_comments,
      COALESCE((
        SELECT COUNT(*) FROM reactions r
        INNER JOIN posts po ON r.post_id = po.id
        WHERE po.user_id = p.id AND r.created_at < cutoff_date
      ), 0) AS old_reactions,
      COALESCE((
        SELECT COUNT(*) FROM shared_posts sp
        INNER JOIN posts po ON sp.original_post_id = po.id
        WHERE po.user_id = p.id AND sp.created_at < cutoff_date
      ), 0) AS old_shares,
      COALESCE((
        SELECT COUNT(*) FROM friendships 
        WHERE (user_id = p.id OR friend_id = p.id) 
          AND status = 'accepted' 
          AND created_at < cutoff_date
      ), 0) AS old_friends
    FROM profiles p
  ),
  new_daily_posts AS (
    SELECT 
      po.user_id,
      (created_at AT TIME ZONE 'UTC')::DATE AS reward_date,
      LEAST(COUNT(*), 10) AS capped_count
    FROM posts po
    WHERE created_at >= cutoff_date
    GROUP BY po.user_id, (created_at AT TIME ZONE 'UTC')::DATE
  ),
  new_daily_reactions AS (
    SELECT 
      po.user_id,
      (r.created_at AT TIME ZONE 'UTC')::DATE AS reward_date,
      LEAST(COUNT(*), 50) AS capped_count
    FROM reactions r
    INNER JOIN posts po ON r.post_id = po.id
    WHERE r.created_at >= cutoff_date
    GROUP BY po.user_id, (r.created_at AT TIME ZONE 'UTC')::DATE
  ),
  new_daily_comments AS (
    SELECT 
      po.user_id,
      (c.created_at AT TIME ZONE 'UTC')::DATE AS reward_date,
      LEAST(COUNT(*), 50) AS capped_count
    FROM comments c
    INNER JOIN posts po ON c.post_id = po.id
    WHERE c.created_at >= cutoff_date 
      AND length(c.content) > 20
    GROUP BY po.user_id, (c.created_at AT TIME ZONE 'UTC')::DATE
  ),
  new_daily_shares AS (
    SELECT 
      po.user_id,
      (sp.created_at AT TIME ZONE 'UTC')::DATE AS reward_date,
      LEAST(COUNT(*), 5) AS capped_count
    FROM shared_posts sp
    INNER JOIN posts po ON sp.original_post_id = po.id
    WHERE sp.created_at >= cutoff_date
    GROUP BY po.user_id, (sp.created_at AT TIME ZONE 'UTC')::DATE
  ),
  new_daily_friends AS (
    SELECT 
      user_id,
      reward_date,
      LEAST(COUNT(*), 10) AS capped_count
    FROM (
      SELECT user_id, (created_at AT TIME ZONE 'UTC')::DATE AS reward_date FROM friendships 
      WHERE status = 'accepted' AND created_at >= cutoff_date
      UNION ALL
      SELECT friend_id AS user_id, (created_at AT TIME ZONE 'UTC')::DATE AS reward_date FROM friendships 
      WHERE status = 'accepted' AND created_at >= cutoff_date
    ) f
    GROUP BY user_id, reward_date
  ),
  new_daily_livestreams AS (
    SELECT 
      user_id,
      (started_at AT TIME ZONE 'UTC')::DATE AS reward_date,
      LEAST(COUNT(*), 5) AS capped_count
    FROM livestreams
    WHERE started_at >= cutoff_date AND is_eligible = true
    GROUP BY user_id, (started_at AT TIME ZONE 'UTC')::DATE
  ),
  new_stats AS (
    SELECT 
      p.id AS user_id,
      COALESCE((SELECT SUM(capped_count) FROM new_daily_posts WHERE user_id = p.id), 0) AS new_posts,
      COALESCE((SELECT SUM(capped_count) FROM new_daily_reactions WHERE user_id = p.id), 0) AS new_reactions,
      COALESCE((SELECT SUM(capped_count) FROM new_daily_comments WHERE user_id = p.id), 0) AS new_comments,
      COALESCE((SELECT SUM(capped_count) FROM new_daily_shares WHERE user_id = p.id), 0) AS new_shares,
      COALESCE((SELECT SUM(capped_count) FROM new_daily_friends WHERE user_id = p.id), 0) AS new_friends,
      COALESCE((SELECT SUM(capped_count) FROM new_daily_livestreams WHERE user_id = p.id), 0) AS new_livestreams
    FROM profiles p
  ),
  today_stats AS (
    SELECT 
      p.id AS user_id,
      COALESCE((SELECT capped_count FROM new_daily_posts WHERE user_id = p.id AND reward_date = CURRENT_DATE), 0) AS today_posts,
      COALESCE((SELECT capped_count FROM new_daily_reactions WHERE user_id = p.id AND reward_date = CURRENT_DATE), 0) AS today_reactions,
      COALESCE((SELECT capped_count FROM new_daily_comments WHERE user_id = p.id AND reward_date = CURRENT_DATE), 0) AS today_comments,
      COALESCE((SELECT capped_count FROM new_daily_shares WHERE user_id = p.id AND reward_date = CURRENT_DATE), 0) AS today_shares,
      COALESCE((SELECT capped_count FROM new_daily_friends WHERE user_id = p.id AND reward_date = CURRENT_DATE), 0) AS today_friends,
      COALESCE((SELECT capped_count FROM new_daily_livestreams WHERE user_id = p.id AND reward_date = CURRENT_DATE), 0) AS today_livestreams
    FROM profiles p
  ),
  total_counts AS (
    SELECT 
      p.id AS user_id,
      COALESCE((SELECT COUNT(*) FROM posts WHERE user_id = p.id), 0) AS total_posts,
      COALESCE((
        SELECT COUNT(*) FROM comments c
        INNER JOIN posts po ON c.post_id = po.id
        WHERE po.user_id = p.id
      ), 0) AS total_comments,
      COALESCE((SELECT COUNT(*) FROM reactions WHERE user_id = p.id), 0) AS total_reactions_made,
      COALESCE((
        SELECT COUNT(*) FROM friendships 
        WHERE (user_id = p.id OR friend_id = p.id) AND status = 'accepted'
      ), 0) AS total_friends,
      COALESCE((
        SELECT COUNT(*) FROM shared_posts sp
        INNER JOIN posts po ON sp.original_post_id = po.id
        WHERE po.user_id = p.id
      ), 0) AS total_shares,
      COALESCE((
        SELECT COUNT(*) FROM reactions r
        INNER JOIN posts po ON r.post_id = po.id
        WHERE po.user_id = p.id
      ), 0) AS total_reactions_on_posts,
      COALESCE((SELECT COUNT(*) FROM livestreams WHERE user_id = p.id AND is_eligible = true), 0) AS total_livestreams
    FROM profiles p
  )
  
  SELECT 
    p.id,
    p.username,
    p.avatar_url,
    tc.total_posts AS posts_count,
    tc.total_comments AS comments_count,
    tc.total_reactions_made AS reactions_count,
    tc.total_friends AS friends_count,
    tc.total_shares AS shares_count,
    tc.total_reactions_on_posts AS reactions_on_posts,
    tc.total_livestreams AS livestreams_count,
    -- Today's reward with trust multiplier
    (
      (
        (ts.today_posts * 10000) +
        (ts.today_reactions * 1000) +
        (ts.today_comments * 2000) +
        (ts.today_shares * 10000) +
        (ts.today_friends * 10000) +
        (ts.today_livestreams * 20000)
      ) * COALESCE(ut.trust_score, 50) / 100
    )::BIGINT AS today_reward,
    -- Total reward with trust multiplier
    (
      (
        50000 +
        (os.old_posts * 10000) +
        (os.old_reactions * 1000) +
        (os.old_comments * 2000) +
        (os.old_shares * 10000) +
        (os.old_friends * 10000) +
        (ns.new_posts * 10000) +
        (ns.new_reactions * 1000) +
        (ns.new_comments * 2000) +
        (ns.new_shares * 10000) +
        (ns.new_friends * 10000) +
        (ns.new_livestreams * 20000)
      ) * COALESCE(ut.trust_score, 50) / 100
    )::BIGINT AS total_reward
  FROM profiles p
  LEFT JOIN old_stats os ON os.user_id = p.id
  LEFT JOIN new_stats ns ON ns.user_id = p.id
  LEFT JOIN today_stats ts ON ts.user_id = p.id
  LEFT JOIN total_counts tc ON tc.user_id = p.id
  LEFT JOIN user_trust ut ON ut.user_id = p.id
  ORDER BY total_reward DESC
  LIMIT limit_count;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_user_rewards_v2(integer) TO anon;
GRANT EXECUTE ON FUNCTION public.get_user_rewards_v2(integer) TO authenticated;

-- =============================================
-- PHASE 5: Create user_stake_status table
-- =============================================
CREATE TABLE IF NOT EXISTS public.user_stake_status (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  wallet_address text,
  fun_balance bigint NOT NULL DEFAULT 0,
  meets_requirement boolean NOT NULL DEFAULT false,
  last_checked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_stake_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own stake status"
  ON public.user_stake_status FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can read all stake status"
  ON public.user_stake_status FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage stake status"
  ON public.user_stake_status FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- =============================================
-- PHASE 6: Engagement Quality Score function
-- =============================================
CREATE OR REPLACE FUNCTION public.calculate_engagement_quality(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_unique_commenters integer := 0;
  v_content_quality integer := 0;
  v_interaction_diversity integer := 0;
  v_total integer := 0;
BEGIN
  -- Factor 1: Unique commenters on user's posts (0-30 points)
  -- More unique people commenting = more organic engagement
  SELECT LEAST(30, COUNT(DISTINCT c.user_id) * 2) INTO v_unique_commenters
  FROM comments c
  INNER JOIN posts po ON c.post_id = po.id
  WHERE po.user_id = p_user_id
    AND c.user_id != p_user_id
    AND c.created_at > now() - interval '30 days';

  -- Factor 2: Non-duplicate content (0-30 points)
  -- Check if posts have diverse content (not copy-paste)
  DECLARE
    v_total_posts integer;
    v_unique_posts integer;
  BEGIN
    SELECT COUNT(*), COUNT(DISTINCT LEFT(content, 100))
    INTO v_total_posts, v_unique_posts
    FROM posts
    WHERE user_id = p_user_id
      AND created_at > now() - interval '30 days';
    
    IF v_total_posts > 0 THEN
      v_content_quality := LEAST(30, (v_unique_posts::float / v_total_posts * 30)::integer);
    ELSE
      v_content_quality := 15; -- neutral for new users
    END IF;
  END;

  -- Factor 3: Interaction diversity (0-40 points)
  -- How many different users does this user interact with
  SELECT LEAST(40, COUNT(DISTINCT target_user) * 3) INTO v_interaction_diversity
  FROM (
    -- Comments on different users' posts
    SELECT po.user_id AS target_user
    FROM comments c
    INNER JOIN posts po ON c.post_id = po.id
    WHERE c.user_id = p_user_id
      AND po.user_id != p_user_id
      AND c.created_at > now() - interval '30 days'
    UNION
    -- Reactions on different users' posts
    SELECT po.user_id AS target_user
    FROM reactions r
    INNER JOIN posts po ON r.post_id = po.id
    WHERE r.user_id = p_user_id
      AND po.user_id != p_user_id
      AND r.created_at > now() - interval '30 days'
    UNION
    -- Friends
    SELECT CASE WHEN user_id = p_user_id THEN friend_id ELSE user_id END AS target_user
    FROM friendships
    WHERE (user_id = p_user_id OR friend_id = p_user_id)
      AND status = 'accepted'
  ) interactions;

  v_total := LEAST(100, v_unique_commenters + v_content_quality + v_interaction_diversity);
  
  -- Update engagement_score in user_trust
  INSERT INTO user_trust (user_id, engagement_score, updated_at)
  VALUES (p_user_id, v_total, now())
  ON CONFLICT (user_id) DO UPDATE SET
    engagement_score = v_total,
    updated_at = now();

  RETURN v_total;
END;
$$;

GRANT EXECUTE ON FUNCTION public.calculate_engagement_quality(uuid) TO authenticated;

-- Update calculate_trust_score to use engagement quality
CREATE OR REPLACE FUNCTION public.calculate_trust_score(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_account_age_score integer := 0;
  v_engagement_score integer := 0;
  v_report_penalty integer := 0;
  v_fingerprint_penalty integer := 0;
  v_trust_score integer := 50;
  v_account_age_days integer;
  v_device_cluster_count integer;
BEGIN
  -- Account age score (0-25, 1 point per day, max 25)
  SELECT EXTRACT(DAY FROM now() - created_at)::integer INTO v_account_age_days
  FROM profiles WHERE id = p_user_id;
  
  v_account_age_score := LEAST(25, COALESCE(v_account_age_days, 0));

  -- Engagement quality score (0-100, scaled to 0-50)
  v_engagement_score := (calculate_engagement_quality(p_user_id) * 50 / 100);

  -- Report penalty (-10 per report)
  SELECT COALESCE(COUNT(*), 0) * 10 INTO v_report_penalty
  FROM reports
  WHERE reported_user_id = p_user_id AND status != 'dismissed';

  -- Device fingerprint penalty (-15 if sharing device with >3 accounts)
  SELECT COUNT(DISTINCT udf2.user_id) INTO v_device_cluster_count
  FROM user_device_fingerprint udf1
  INNER JOIN user_device_fingerprint udf2 ON udf1.device_hash = udf2.device_hash
  WHERE udf1.user_id = p_user_id AND udf2.user_id != p_user_id;
  
  IF v_device_cluster_count > 3 THEN
    v_fingerprint_penalty := 15;
  END IF;

  -- Calculate final score
  v_trust_score := GREATEST(0, LEAST(100, 
    v_account_age_score + v_engagement_score - v_report_penalty - v_fingerprint_penalty
  ));

  -- Upsert into user_trust
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
;
