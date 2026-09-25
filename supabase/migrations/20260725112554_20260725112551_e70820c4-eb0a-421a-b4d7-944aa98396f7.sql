
UPDATE public.angel_channel_knowledge
   SET next_retry_at = NULL,
       skip_reason = COALESCE(skip_reason, 'no_content_after_error')
 WHERE next_retry_at IS NOT NULL
   AND content IS NULL;
;
