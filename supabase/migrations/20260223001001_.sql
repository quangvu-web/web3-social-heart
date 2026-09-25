
-- 1. Update constraint to allow 'friend_live' type
ALTER TABLE public.notifications 
  DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications 
  ADD CONSTRAINT notifications_type_check CHECK (type IN (
    'like','love','care','wow','haha','pray','sad','angry',
    'comment','comment_like','share',
    'friend_request','friend_accept','friend_accepted',
    'reward_approved','reward_rejected','account_banned',
    'friend_live'
  ));

-- 2. Trigger function to notify friends when a live session starts
CREATE OR REPLACE FUNCTION public.create_notification_on_live_start()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  IF NEW.status = 'live' THEN
    INSERT INTO public.notifications (user_id, actor_id, post_id, type)
    SELECT 
      CASE WHEN f.user_id = NEW.host_user_id THEN f.friend_id ELSE f.user_id END,
      NEW.host_user_id,
      NEW.post_id,
      'friend_live'
    FROM public.friendships f
    WHERE f.status = 'accepted'
      AND (f.user_id = NEW.host_user_id OR f.friend_id = NEW.host_user_id);
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Create trigger on live_sessions
DROP TRIGGER IF EXISTS notify_on_live_start ON public.live_sessions;
CREATE TRIGGER notify_on_live_start
AFTER INSERT ON public.live_sessions
FOR EACH ROW EXECUTE FUNCTION create_notification_on_live_start();
;
