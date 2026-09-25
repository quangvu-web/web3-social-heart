ALTER TABLE public.angel_channel_knowledge
  ADD COLUMN IF NOT EXISTS merged_message_ids INTEGER[] NOT NULL DEFAULT '{}'::int[];

ALTER TABLE public.angel_watched_channels
  ADD COLUMN IF NOT EXISTS warn_long_posts BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_long_warned_at TIMESTAMPTZ;;
