CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  base_username text;
  final_username text;
  reserved_names text[] := ARRAY['admin','administrator','system','root',
    'moderator','mod','support','help','lovable','supabase','null',
    'undefined','api','www','mail','email','test','demo'];
BEGIN
  base_username := lower(trim(COALESCE(
    NEW.raw_user_meta_data->>'username',
    SPLIT_PART(NEW.email, '@', 1),
    'user'
  )));
  
  -- Remove non-alphanumeric chars except underscore
  base_username := regexp_replace(base_username, '[^a-z0-9_]', '', 'g');
  
  -- If empty after cleanup, use fallback
  IF base_username = '' THEN
    base_username := 'user';
  END IF;
  
  -- Truncate to max 24 chars to leave room for suffix (max 30 total)
  base_username := LEFT(base_username, 24);
  
  -- If username is reserved, append user id prefix
  IF base_username = ANY(reserved_names) THEN
    base_username := LEFT(base_username, 16) || '_' || substr(NEW.id::text, 1, 8);
  END IF;
  
  final_username := base_username;
  
  -- If username already exists, append random suffix (max 10 attempts)
  DECLARE
    attempt_count integer := 0;
  BEGIN
    WHILE EXISTS (SELECT 1 FROM profiles WHERE username = final_username) AND attempt_count < 10 LOOP
      final_username := LEFT(base_username, 24) || '_' || substr(md5(random()::text), 1, 5);
      attempt_count := attempt_count + 1;
    END LOOP;
  END;
  
  INSERT INTO profiles (id, username, full_name, avatar_url)
  VALUES (
    NEW.id,
    final_username,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  ) ON CONFLICT (id) DO NOTHING;
  
  INSERT INTO user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT DO NOTHING;
  
  RETURN NEW;
END;
$function$;;
