
CREATE TABLE IF NOT EXISTS public.live_replays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  live_session_id uuid NOT NULL,
  chunked_recording_id uuid,
  source_webm_key text,
  stream_uid text NOT NULL UNIQUE,
  playback_hls text,
  playback_dash text,
  playback_mp4 text,
  thumbnail_url text,
  duration_seconds integer,
  filesize_bytes bigint,
  status text NOT NULL DEFAULT 'uploading',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_live_replays_session ON public.live_replays(live_session_id);
CREATE INDEX IF NOT EXISTS idx_live_replays_user ON public.live_replays(user_id);
CREATE INDEX IF NOT EXISTS idx_live_replays_stream_uid ON public.live_replays(stream_uid);

ALTER TABLE public.live_replays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners and admins can view replays"
ON public.live_replays FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated can view ready replays"
ON public.live_replays FOR SELECT TO authenticated
USING (status = 'ready');

CREATE POLICY "Owners can insert replays"
ON public.live_replays FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners and admins can update replays"
ON public.live_replays FOR UPDATE TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_live_replays_updated_at
BEFORE UPDATE ON public.live_replays
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.mark_live_replay_uploaded(_replay_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.live_replays
     SET status = 'queued', updated_at = now()
   WHERE id = _replay_id
     AND (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
     AND status = 'uploading';
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_live_replay_uploaded(uuid) TO authenticated;
;
