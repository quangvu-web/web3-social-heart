
-- Enhanced handle_new_user function with reserved username handling and duplicate prevention
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
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
  
  -- If username is reserved, append user id prefix
  IF base_username = ANY(reserved_names) THEN
    base_username := base_username || '_' || substr(NEW.id::text, 1, 8);
  END IF;
  
  final_username := base_username;
  
  -- If username already exists, append random suffix (max 10 attempts)
  DECLARE
    attempt_count integer := 0;
  BEGIN
    WHILE EXISTS (SELECT 1 FROM profiles WHERE username = final_username) AND attempt_count < 10 LOOP
      final_username := base_username || '_' || substr(md5(random()::text), 1, 6);
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
$$;

-- Recreate trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
;
