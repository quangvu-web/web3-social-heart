import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * useSessionKeepAlive Hook
 * 
 * Đảm bảo session được duy trì khi tab ở background.
 * - Proactive refresh token trước khi hết hạn
 * - Visibility change handler để refresh khi user quay lại
 * - Heartbeat interval để giữ session alive
 */
export function useSessionKeepAlive() {
  useEffect(() => {
    // 1. Khi tab visible trở lại → kiểm tra và refresh session
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          // Force refresh để đảm bảo token mới nhất
          await supabase.auth.refreshSession();
          console.log('[SessionKeepAlive] Session refreshed on tab visible');
        }
      }
    };

    // 2. Heartbeat mỗi 10 phút để refresh token proactively
    const heartbeat = setInterval(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Refresh nếu token sắp hết hạn (còn dưới 15 phút)
        const expiresAt = session.expires_at;
        const now = Math.floor(Date.now() / 1000);
        if (expiresAt && expiresAt - now < 900) {
          await supabase.auth.refreshSession();
          console.log('[SessionKeepAlive] Token proactively refreshed (expiring soon)');
        }
      }
    }, 10 * 60 * 1000); // 10 phút

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(heartbeat);
    };
  }, []);
}
