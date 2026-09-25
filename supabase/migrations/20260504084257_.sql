-- Reset stale playback_mp4 URLs that were guessed before MP4 render was actually enabled.
-- These point to /downloads/default.mp4 which 404s. The new finalize flow will re-populate them.

UPDATE public.live_replays
SET playback_mp4 = NULL,
    updated_at = now()
WHERE playback_mp4 LIKE '%/downloads/default.mp4';

UPDATE public.posts
SET metadata = metadata - 'playback_mp4'
WHERE metadata ->> 'playback_mp4' LIKE '%/downloads/default.mp4';;
