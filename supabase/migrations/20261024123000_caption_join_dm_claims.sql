-- Apply via Lovable only. Durable at-most-once attempts for Recall join DMs.
-- Keep claims after failed/ambiguous delivery: retries must never flood a participant.
CREATE TABLE public.caption_join_dm_claims (
  webhook_id text PRIMARY KEY CHECK (length(webhook_id) BETWEEN 1 AND 512),
  session_id uuid NOT NULL REFERENCES public.caption_sessions(id) ON DELETE CASCADE,
  participant_id text NOT NULL CHECK (length(participant_id) BETWEEN 1 AND 128),
  claimed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.caption_join_dm_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.caption_join_dm_claims FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.caption_join_dm_claims TO service_role;

COMMENT ON TABLE public.caption_join_dm_claims IS
  'One Recall private caption-link send attempt per authenticated Svix webhook-id; never reclaim on send failure.';
