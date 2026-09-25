
-- Member tracking tables
CREATE TABLE public.telegram_member_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id bigint NOT NULL,
  tg_user_id bigint NOT NULL,
  username text,
  display_name text,
  event_type text NOT NULL CHECK (event_type IN ('join','left','kicked','banned','unbanned','rejoined','account_deleted')),
  old_status text,
  new_status text,
  invite_link text,
  invite_link_name text,
  invited_by_tg_id bigint,
  invited_by_username text,
  admin_actor_tg_id bigint,
  admin_actor_username text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tg_member_events_chat_time ON public.telegram_member_events (chat_id, occurred_at DESC);
CREATE INDEX idx_tg_member_events_chat_user_time ON public.telegram_member_events (chat_id, tg_user_id, occurred_at DESC);
CREATE INDEX idx_tg_member_events_chat_type_time ON public.telegram_member_events (chat_id, event_type, occurred_at DESC);
CREATE UNIQUE INDEX uniq_tg_member_events_dedupe ON public.telegram_member_events (chat_id, tg_user_id, event_type, occurred_at);

GRANT SELECT ON public.telegram_member_events TO authenticated;
GRANT ALL ON public.telegram_member_events TO service_role;

ALTER TABLE public.telegram_member_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view member events"
ON public.telegram_member_events FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));


CREATE TABLE public.telegram_member_daily_stats (
  chat_id bigint NOT NULL,
  stat_date date NOT NULL,
  total_members int,
  joined_count int NOT NULL DEFAULT 0,
  left_count int NOT NULL DEFAULT 0,
  kicked_count int NOT NULL DEFAULT 0,
  banned_count int NOT NULL DEFAULT 0,
  unbanned_count int NOT NULL DEFAULT 0,
  rejoined_count int NOT NULL DEFAULT 0,
  net_growth int NOT NULL DEFAULT 0,
  top_invite_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chat_id, stat_date)
);

GRANT SELECT ON public.telegram_member_daily_stats TO authenticated;
GRANT ALL ON public.telegram_member_daily_stats TO service_role;

ALTER TABLE public.telegram_member_daily_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view daily stats"
ON public.telegram_member_daily_stats FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));


CREATE TABLE public.telegram_invite_link_stats (
  chat_id bigint NOT NULL,
  invite_link text NOT NULL,
  invite_link_name text,
  total_joins int NOT NULL DEFAULT 0,
  current_members int NOT NULL DEFAULT 0,
  left_within_7d int NOT NULL DEFAULT 0,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chat_id, invite_link)
);

GRANT SELECT ON public.telegram_invite_link_stats TO authenticated;
GRANT ALL ON public.telegram_invite_link_stats TO service_role;

ALTER TABLE public.telegram_invite_link_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view invite link stats"
ON public.telegram_invite_link_stats FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));


-- Settings columns for alerts/reports
ALTER TABLE public.telegram_community_settings
  ADD COLUMN IF NOT EXISTS member_alerts_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS member_alerts_chat_id text,
  ADD COLUMN IF NOT EXISTS member_alerts_min_severity text NOT NULL DEFAULT 'all' CHECK (member_alerts_min_severity IN ('all','kick_ban_only'));
;
