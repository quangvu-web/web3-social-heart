-- Synthetic local fixture only: this is NOT a production schema dump.
-- Columns used by the migration follow generated types; UUID/JSONB and the
-- pre-existing dedupe index are explicit assumptions to verify before rollout.
DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE service_role NOLOGIN BYPASSRLS; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TABLE public.telegram_member_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), chat_id bigint NOT NULL,
 tg_user_id bigint NOT NULL, event_type text NOT NULL, occurred_at timestamptz NOT NULL,
 username text, display_name text, old_status text, new_status text,
 invite_link text, invite_link_name text, invited_by_tg_id bigint,
 invited_by_username text, admin_actor_tg_id bigint, admin_actor_username text,
 metadata jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uniq_tg_member_events_dedupe ON public.telegram_member_events
 (chat_id,tg_user_id,event_type,occurred_at);
CREATE TABLE public.telegram_community_verification_challenges (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), group_id bigint NOT NULL,
 telegram_user_id bigint NOT NULL, status text NOT NULL DEFAULT 'pending'
);
ALTER TABLE public.telegram_member_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_community_verification_challenges ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_member_events,
 public.telegram_community_verification_challenges TO service_role;
