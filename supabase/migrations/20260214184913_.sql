
-- Fix: Exclude live posts from rate limit count
CREATE OR REPLACE FUNCTION public.check_post_rate_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  post_count INT;
BEGIN
  SELECT COUNT(*) INTO post_count
  FROM posts
  WHERE user_id = NEW.user_id
  AND created_at > NOW() - INTERVAL '1 hour'
  AND post_type IS DISTINCT FROM 'live';
  
  IF post_count >= 10 THEN
    RAISE EXCEPTION 'Rate limit exceeded: Maximum 10 posts per hour';
  END IF;
  
  RETURN NEW;
END;
$function$;
;
