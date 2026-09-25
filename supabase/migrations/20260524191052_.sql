
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS download_mp4_parts JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.live_sessions ADD COLUMN IF NOT EXISTS download_mp4_parts JSONB NOT NULL DEFAULT '[]'::jsonb;
;
