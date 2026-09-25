UPDATE public.live_sessions
SET
  status = 'ended',
  ended_at = COALESCE(ended_at, now()),
  end_reason = COALESCE(end_reason, 'watchdog_cleanup'),
  cleanup_finished_at = now(),
  recording_status = CASE
    WHEN recording_status IN ('acquiring','starting','started','recording','stopping') THEN 'failed'
    ELSE COALESCE(recording_status, 'failed')
  END,
  updated_at = now()
WHERE status IN ('live','starting','recording','reconnecting','disconnected','cleanup_pending','ending','stopping','processing')
  AND COALESCE(last_host_heartbeat_at, last_heartbeat_at, host_heartbeat_at, started_at, created_at)
      < now() - interval '5 minutes';;
