
-- RPC đọc resource_id và sid (các cột bị REVOKE SELECT)
CREATE OR REPLACE FUNCTION get_live_recording_context(_session_id uuid)
RETURNS TABLE(
  id uuid,
  host_user_id uuid,
  agora_channel text,
  channel_name text,
  resource_id text,
  sid text,
  recording_uid bigint,
  recording_status text,
  post_id uuid
) AS $$
BEGIN
  RETURN QUERY
  SELECT ls.id, ls.host_user_id, ls.agora_channel, ls.channel_name,
         ls.resource_id, ls.sid, ls.recording_uid::bigint,
         ls.recording_status, ls.post_id
  FROM live_sessions ls
  WHERE ls.id = _session_id
    AND ls.host_user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- RPC cập nhật recording state sau khi stop
CREATE OR REPLACE FUNCTION set_live_recording_stopped(
  _session_id uuid,
  _media_url text DEFAULT NULL,
  _file_list jsonb DEFAULT '[]'::jsonb
)
RETURNS void AS $$
DECLARE
  _post_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM live_sessions
    WHERE id = _session_id AND host_user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  UPDATE live_sessions
  SET recording_status = CASE WHEN _media_url IS NOT NULL THEN 'stopped' ELSE 'failed' END,
      updated_at = now()
  WHERE id = _session_id
  RETURNING live_sessions.post_id INTO _post_id;

  UPDATE live_recordings
  SET status = 'stopped',
      media_url = _media_url,
      file_list_json = _file_list,
      stopped_at = now()
  WHERE live_id = _session_id;

  IF _post_id IS NOT NULL AND _media_url IS NOT NULL THEN
    UPDATE posts
    SET video_url = _media_url,
        metadata = jsonb_set(
          COALESCE(metadata, '{}'::jsonb),
          '{playback_url}',
          to_jsonb(_media_url)
        )
    WHERE id = _post_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
;
