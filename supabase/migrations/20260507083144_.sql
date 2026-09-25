
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS delete_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS delete_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS delete_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS delete_attempts int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delete_error text,
  ADD COLUMN IF NOT EXISTS delete_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS cloudflare_deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS r2_deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_posts_active_created
  ON public.posts (created_at DESC)
  WHERE deleted_at IS NULL;

ALTER TABLE public.live_replays
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS delete_error text;

ALTER TABLE public.live_recordings
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS delete_error text;
;
