
-- Step 1, 2, 4: Add retry + status tracking columns to angel_channel_knowledge
ALTER TABLE public.angel_channel_knowledge
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_retry_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS youtube_error text NULL,
  ADD COLUMN IF NOT EXISTS skip_reason text NULL;

CREATE INDEX IF NOT EXISTS idx_ack_retry
  ON public.angel_channel_knowledge (next_retry_at)
  WHERE next_retry_at IS NOT NULL AND pushed_to_core = false;

-- Step 2 backfill: rows never pushed with NULL error + NULL content → media-only skip
UPDATE public.angel_channel_knowledge
   SET skip_reason = 'no_text_content'
 WHERE pushed_to_core = false
   AND push_error IS NULL
   AND (content IS NULL OR btrim(content) = '')
   AND skip_reason IS NULL;

-- Step 4 backfill: move YouTube-specific errors into youtube_error column
UPDATE public.angel_channel_knowledge
   SET youtube_error = push_error,
       push_error = NULL
 WHERE push_error LIKE 'unplayable:%'
    OR push_error LIKE 'youtube:%'
    OR push_error ILIKE '%LOGIN_REQUIRED%';

-- Step 1 seed: mark 429-errored rows for immediate retry
UPDATE public.angel_channel_knowledge
   SET next_retry_at = now(),
       retry_count = 0
 WHERE push_error LIKE 'HTTP 429%'
   AND pushed_to_core = false;

-- Step 3 seed: mark duplicate-key rows for retry (handler will treat as success)
UPDATE public.angel_channel_knowledge
   SET next_retry_at = now(),
       retry_count = 0
 WHERE push_error ILIKE '%duplicate key%'
   AND pushed_to_core = false;
;
