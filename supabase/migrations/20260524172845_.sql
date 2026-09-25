-- Widen Agora UID columns to bigint to fit Agora's 32-bit unsigned UID range.
ALTER TABLE public.live_sessions
  ALTER COLUMN agora_uid_host TYPE bigint USING agora_uid_host::bigint,
  ALTER COLUMN recording_uid TYPE bigint USING recording_uid::bigint;

-- Drop dependent functions before recreating with bigint signatures.
DROP FUNCTION IF EXISTS public.get_live_recording_context(uuid);
DROP FUNCTION IF EXISTS public.set_live_recording_state(uuid, text, text, text, integer, timestamptz, timestamptz, timestamptz, text, jsonb);
DROP FUNCTION IF EXISTS public.set_live_recording_state(uuid, text, text, text, bigint, timestamptz, timestamptz, timestamptz, text, jsonb);

CREATE OR REPLACE FUNCTION public.get_live_recording_context(_session_id uuid)
RETURNS TABLE (
  id uuid,
  host_user_id uuid,
  channel_name text,
  agora_channel text,
  resource_id text,
  sid text,
  recording_uid bigint,
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
    ls.id,
    ls.host_user_id,
    ls.channel_name,
    ls.agora_channel,
    ls.resource_id,
    ls.sid,
    ls.recording_uid,
    ls.recording_status,
    ls.recording_started_at,
    ls.recording_stopped_at,
    ls.recording_ready_at,
    ls.recording_error,
    COALESCE(ls.last_worker_response, '{}'::jsonb),
    ls.post_id
  FROM public.live_sessions ls
  WHERE ls.id = _session_id
    AND (
      ls.host_user_id = auth.uid()
      OR public.has_role(auth.uid(), 'admin'::app_role)
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_live_recording_context(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_live_recording_context(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_live_recording_state(
  _session_id uuid,
  _recording_status text DEFAULT NULL,
  _resource_id text DEFAULT NULL,
  _sid text DEFAULT NULL,
  _recording_uid bigint DEFAULT NULL,
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
    SELECT 1
    FROM public.live_sessions ls
    WHERE ls.id = _session_id
      AND (
        ls.host_user_id = auth.uid()
        OR public.has_role(auth.uid(), 'admin'::app_role)
      )
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

REVOKE ALL ON FUNCTION public.set_live_recording_state(uuid, text, text, text, bigint, timestamptz, timestamptz, timestamptz, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_live_recording_state(uuid, text, text, text, bigint, timestamptz, timestamptz, timestamptz, text, jsonb) TO authenticated;;
