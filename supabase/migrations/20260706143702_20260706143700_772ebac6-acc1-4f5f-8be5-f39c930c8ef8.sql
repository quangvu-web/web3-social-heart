-- Drop live_sessions khỏi Realtime publication để dừng phát broadcast row-level
-- (mỗi UPDATE trước đây phát 1 realtime message → đốt băng thông Cloud).
-- Frontend chuyển sang polling nhẹ với refetchInterval.
ALTER PUBLICATION supabase_realtime DROP TABLE public.live_sessions;;
