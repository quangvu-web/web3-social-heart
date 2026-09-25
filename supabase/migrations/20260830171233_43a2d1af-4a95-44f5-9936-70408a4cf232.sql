CREATE TABLE IF NOT EXISTS public.angel_discussion_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discussion_chat_id bigint NOT NULL,
  channel_chat_id bigint,
  post_message_id bigint NOT NULL,
  trigger_message_id bigint,
  comment_message_id bigint,
  kind text NOT NULL DEFAULT 'post_comment',
  content text NOT NULL DEFAULT '',
  content_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS angel_discussion_comments_post_uniq
  ON public.angel_discussion_comments (discussion_chat_id, post_message_id, kind);

CREATE INDEX IF NOT EXISTS angel_discussion_comments_recent_idx
  ON public.angel_discussion_comments (discussion_chat_id, created_at DESC);

GRANT SELECT ON public.angel_discussion_comments TO authenticated;
GRANT ALL ON public.angel_discussion_comments TO service_role;

ALTER TABLE public.angel_discussion_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view discussion comments"
ON public.angel_discussion_comments
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.angel_feature_flags (key, enabled, description, meta)
VALUES (
  'discussion.auto_comment',
  false,
  'Angel tu binh luan bai moi cua channel trong Discussion Group da lien ket.',
  '{"channel_ids": [], "max_per_hour": 6, "min_gap_seconds": 120, "reply_to_members": true}'::jsonb
)
ON CONFLICT (key) DO NOTHING;;
