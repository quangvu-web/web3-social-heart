import { useQuery } from '@tanstack/react-query';
import { getLiveSession, listActiveLiveSessions } from './liveService';

// NOTE: live_sessions đã bị DROP khỏi supabase_realtime publication để giảm chi phí
// Cloud (mỗi UPDATE trước đây phát 1 realtime message). Thay vì subscribe row-level,
// dùng polling nhẹ — chỉ tick khi component đang mount và tần suất khác nhau theo trạng thái.

export function useLiveSession(sessionId?: string) {
  return useQuery({
    queryKey: ['live-session', sessionId],
    queryFn: () => getLiveSession(sessionId as string),
    enabled: !!sessionId,
    staleTime: 8_000,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return false;
      // Đang transition → poll nhanh cho tới khi settle
      if (['stopping', 'processing', 'starting', 'reconnecting'].includes(data.status)) return 7_000;
      // Đang live → poll chậm hơn để cập nhật viewer_count / status
      if (data.status === 'live') return 15_000;
      // Đã ended/failed/ready → không cần poll nữa
      return false;
    },
    refetchOnWindowFocus: true,
  });
}

export function useActiveLiveSessions() {
  return useQuery({
    queryKey: ['live-active-sessions'],
    queryFn: listActiveLiveSessions,
    staleTime: 20_000,
    // Trước đây subscribe postgres_changes trên toàn bảng — cực tốn realtime.
    // Nay: poll mỗi 30s khi tab đang focus.
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}
