
CREATE OR REPLACE FUNCTION public.increment_live_viewer_count(session_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE live_sessions
  SET viewer_count = COALESCE(viewer_count, 0) + 1,
      updated_at = now()
  WHERE id = session_id AND status = 'live';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.decrement_live_viewer_count(session_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE live_sessions
  SET viewer_count = GREATEST(COALESCE(viewer_count, 0) - 1, 0),
      updated_at = now()
  WHERE id = session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
;
