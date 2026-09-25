ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check CHECK (type IN (
    'like','love','care','wow','haha','pray','sad','angry',
    'comment','comment_like','share',
    'friend_request','friend_accept','friend_accepted',
    'reward_approved','reward_rejected','account_banned',
    'friend_live','live_guest_invite'
  ));

CREATE TABLE IF NOT EXISTS public.live_viewer_presence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  live_session_id uuid NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  client_state text NOT NULL DEFAULT 'watching',
  device_type text NOT NULL DEFAULT 'desktop',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT live_viewer_presence_state_check CHECK (client_state IN ('watching','background','left')),
  CONSTRAINT live_viewer_presence_device_check CHECK (device_type IN ('desktop','mobile')),
  CONSTRAINT live_viewer_presence_unique UNIQUE (live_session_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.live_guest_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  live_session_id uuid NOT NULL REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  host_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  guest_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  agora_channel_name text NOT NULL,
  agora_uid bigint NOT NULL,
  status text NOT NULL DEFAULT 'invited',
  muted_by_host boolean NOT NULL DEFAULT false,
  invited_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  joined_at timestamptz,
  ended_at timestamptz,
  last_heartbeat_at timestamptz,
  end_reason text,
  layout_update_result jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT live_guest_sessions_status_check CHECK (status IN (
    'invited','accepted','joined','declined','removed','left','disconnected','expired'
  )),
  CONSTRAINT live_guest_sessions_end_reason_check CHECK (
    end_reason IS NULL OR end_reason IN ('declined','cancelled','removed','guest_left','guest_timeout','expired','live_ended')
  ),
  CONSTRAINT live_guest_sessions_not_self_check CHECK (host_user_id <> guest_user_id)
);

CREATE INDEX IF NOT EXISTS idx_live_viewer_presence_session_seen
  ON public.live_viewer_presence(live_session_id, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_live_guest_sessions_session
  ON public.live_guest_sessions(live_session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_live_guest_sessions_guest
  ON public.live_guest_sessions(guest_user_id, status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_live_guest_one_active_per_live
  ON public.live_guest_sessions(live_session_id)
  WHERE status IN ('invited','accepted','joined','disconnected');

ALTER TABLE public.live_viewer_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_guest_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Live viewer presence visible to participants" ON public.live_viewer_presence;
CREATE POLICY "Live viewer presence visible to participants"
  ON public.live_viewer_presence
  FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.live_sessions ls
      WHERE ls.id = live_viewer_presence.live_session_id
        AND COALESCE(ls.user_id, ls.host_user_id, ls.owner_id) = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Viewers upsert own live presence" ON public.live_viewer_presence;
CREATE POLICY "Viewers upsert own live presence"
  ON public.live_viewer_presence
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Viewers update own live presence" ON public.live_viewer_presence;
CREATE POLICY "Viewers update own live presence"
  ON public.live_viewer_presence
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Live guest sessions visible to host and guest" ON public.live_guest_sessions;
CREATE POLICY "Live guest sessions visible to host and guest"
  ON public.live_guest_sessions
  FOR SELECT
  USING (auth.uid() = host_user_id OR auth.uid() = guest_user_id);

DROP POLICY IF EXISTS "Live guest sessions service role only insert" ON public.live_guest_sessions;
CREATE POLICY "Live guest sessions service role only insert"
  ON public.live_guest_sessions
  FOR INSERT
  WITH CHECK (false);

DROP POLICY IF EXISTS "Live guest sessions service role only update" ON public.live_guest_sessions;
CREATE POLICY "Live guest sessions service role only update"
  ON public.live_guest_sessions
  FOR UPDATE
  USING (false)
  WITH CHECK (false);

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.live_viewer_presence;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.live_guest_sessions;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

COMMENT ON TABLE public.live_guest_sessions IS
  'One-guest livestream invite state; backend functions own mutation.';;
