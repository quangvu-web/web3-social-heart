-- Drop existing function with old signature first
DROP FUNCTION IF EXISTS public.get_live_recording_context(uuid);

-- Now recreate with new signature including extra columns
CREATE OR REPLACE FUNCTION public.get_live_recording_context(_session_id uuid)
RETURNS TABLE (
  id uuid,
  host_user_id uuid,
  channel_name text,
  agora_channel text,
  resource_id text,
  sid text,
  recording_uid integer,
  recording_status text,
  recording_started_at timestamptz,
  recording_stopped_at timestamptz,
  recording_ready_at timestamptz,
  recording_error text,
  last_worker_response jsonb,
  post_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ls.id, ls.host_user_id, ls.channel_name, ls.agora_channel,
    ls.resource_id, ls.sid, ls.recording_uid, ls.recording_status,
    ls.recording_started_at, ls.recording_stopped_at, ls.recording_ready_at,
    ls.recording_error, COALESCE(ls.last_worker_response, '{}'::jsonb), ls.post_id
  FROM public.live_sessions ls
  WHERE ls.id = _session_id
    AND (ls.host_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));
END;
$$;

REVOKE ALL ON FUNCTION public.get_live_recording_context(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_live_recording_context(uuid) TO authenticated;

-- set_live_recording_state
CREATE OR REPLACE FUNCTION public.set_live_recording_state(
  _session_id uuid,
  _recording_status text DEFAULT NULL,
  _resource_id text DEFAULT NULL,
  _sid text DEFAULT NULL,
  _recording_uid integer DEFAULT NULL,
  _recording_started_at timestamptz DEFAULT NULL,
  _recording_stopped_at timestamptz DEFAULT NULL,
  _recording_ready_at timestamptz DEFAULT NULL,
  _recording_error text DEFAULT NULL,
  _last_worker_response jsonb DEFAULT NULL
)
RETURNS public.live_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.live_sessions;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.live_sessions ls
    WHERE ls.id = _session_id
      AND (ls.host_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.live_sessions ls
  SET
    recording_status = COALESCE(_recording_status, ls.recording_status),
    resource_id = COALESCE(_resource_id, ls.resource_id),
    sid = COALESCE(_sid, ls.sid),
    recording_uid = COALESCE(_recording_uid, ls.recording_uid),
    recording_started_at = COALESCE(_recording_started_at, ls.recording_started_at),
    recording_stopped_at = COALESCE(_recording_stopped_at, ls.recording_stopped_at),
    recording_ready_at = COALESCE(_recording_ready_at, ls.recording_ready_at),
    recording_error = COALESCE(_recording_error, ls.recording_error),
    last_worker_response = COALESCE(_last_worker_response, ls.last_worker_response),
    updated_at = now()
  WHERE ls.id = _session_id
  RETURNING ls.* INTO _row;

  RETURN _row;
END;
$$;

REVOKE ALL ON FUNCTION public.set_live_recording_state(uuid, text, text, text, integer, timestamptz, timestamptz, timestamptz, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_live_recording_state(uuid, text, text, text, integer, timestamptz, timestamptz, timestamptz, text, jsonb) TO authenticated;

-- upsert_live_recording_row
CREATE OR REPLACE FUNCTION public.upsert_live_recording_row(
  _session_id uuid, _resource_id text DEFAULT NULL, _sid text DEFAULT NULL,
  _recorder_uid text DEFAULT NULL, _status text DEFAULT NULL,
  _file_list_json jsonb DEFAULT NULL, _media_url text DEFAULT NULL,
  _raw_response jsonb DEFAULT NULL, _stopped_at timestamptz DEFAULT NULL,
  _duration_seconds integer DEFAULT NULL, _thumbnail_url text DEFAULT NULL
)
RETURNS public.live_recordings
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _live public.live_sessions;
  _latest_id uuid;
  _row public.live_recordings;
BEGIN
  SELECT * INTO _live FROM public.live_sessions ls
  WHERE ls.id = _session_id
    AND (ls.host_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));
  IF _live.id IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT lr.id INTO _latest_id FROM public.live_recordings lr
  WHERE lr.live_id = _session_id ORDER BY lr.created_at DESC LIMIT 1;

  IF _latest_id IS NULL THEN
    INSERT INTO public.live_recordings (
      live_id, resource_id, sid, recorder_uid, status, file_list_json,
      media_url, raw_response, stopped_at, duration_seconds, thumbnail_url
    ) VALUES (
      _session_id, _resource_id, _sid, _recorder_uid,
      COALESCE(_status, 'recording'), COALESCE(_file_list_json, '[]'::jsonb),
      _media_url, _raw_response, _stopped_at, _duration_seconds, _thumbnail_url
    ) RETURNING * INTO _row;
  ELSE
    UPDATE public.live_recordings lr SET
      resource_id = COALESCE(_resource_id, lr.resource_id),
      sid = COALESCE(_sid, lr.sid),
      recorder_uid = COALESCE(_recorder_uid, lr.recorder_uid),
      status = COALESCE(_status, lr.status),
      file_list_json = COALESCE(_file_list_json, lr.file_list_json),
      media_url = COALESCE(_media_url, lr.media_url),
      raw_response = COALESCE(_raw_response, lr.raw_response),
      stopped_at = COALESCE(_stopped_at, lr.stopped_at),
      duration_seconds = COALESCE(_duration_seconds, lr.duration_seconds),
      thumbnail_url = COALESCE(_thumbnail_url, lr.thumbnail_url)
    WHERE lr.id = _latest_id RETURNING lr.* INTO _row;
  END IF;
  RETURN _row;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_live_recording_row(uuid, text, text, text, text, jsonb, text, jsonb, timestamptz, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_live_recording_row(uuid, text, text, text, text, jsonb, text, jsonb, timestamptz, integer, text) TO authenticated;

-- attach_live_replay_to_post
CREATE OR REPLACE FUNCTION public.attach_live_replay_to_post(
  _session_id uuid, _playback_url text,
  _duration_seconds integer DEFAULT NULL, _thumbnail_url text DEFAULT NULL
)
RETURNS public.live_sessions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _live public.live_sessions;
  _metadata jsonb;
BEGIN
  SELECT * INTO _live FROM public.live_sessions ls
  WHERE ls.id = _session_id
    AND (ls.host_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));
  IF _live.id IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;

  IF _live.post_id IS NOT NULL THEN
    SELECT COALESCE(p.metadata::jsonb, '{}'::jsonb) INTO _metadata
    FROM public.posts p WHERE p.id = _live.post_id;

    _metadata := _metadata
      || jsonb_build_object('playback_url', _playback_url)
      || jsonb_build_object('live_status', 'ended')
      || jsonb_build_object('replay_ready_at', now());
    IF _duration_seconds IS NOT NULL THEN
      _metadata := _metadata || jsonb_build_object('duration_seconds', _duration_seconds);
    END IF;
    IF _thumbnail_url IS NOT NULL THEN
      _metadata := _metadata || jsonb_build_object('thumbnail_url', _thumbnail_url);
    END IF;

    UPDATE public.posts p SET metadata = _metadata, video_url = COALESCE(_playback_url, p.video_url)
    WHERE p.id = _live.post_id;
  END IF;

  UPDATE public.live_sessions ls SET
    recording_status = CASE WHEN _playback_url IS NULL OR _playback_url = '' THEN 'failed' ELSE 'ready' END,
    recording_ready_at = CASE WHEN _playback_url IS NULL OR _playback_url = '' THEN ls.recording_ready_at ELSE now() END,
    recording_error = CASE WHEN _playback_url IS NULL OR _playback_url = '' THEN COALESCE(ls.recording_error, 'Playback URL missing') ELSE NULL END,
    updated_at = now()
  WHERE ls.id = _session_id RETURNING ls.* INTO _live;

  RETURN _live;
END;
$$;

REVOKE ALL ON FUNCTION public.attach_live_replay_to_post(uuid, text, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.attach_live_replay_to_post(uuid, text, integer, text) TO authenticated;;
