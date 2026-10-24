import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { AppErrorFallback } from '@/components/common/AppErrorFallback';

interface LawOfLightGuardProps {
  children: React.ReactNode;
}

export const LawOfLightGuard = ({ children }: LawOfLightGuardProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, profile, isLoading, bootstrapError } = useAuth();
  const [isAllowed, setIsAllowed] = useState(false);

  useEffect(() => {
    // Skip check while AuthContext is loading
    if (isLoading || bootstrapError) return;

    const checkAccess = () => {
      // Public pages - always allow
      const publicPaths = ['/law-of-light', '/docs', '/captions', '/angel-player'];
      const isPublicPath = publicPaths.some(path => location.pathname.startsWith(path));
      
      if (isPublicPath) {
        setIsAllowed(true);
        return;
      }

      // Auth page - require Law of Light acceptance first
      if (location.pathname.startsWith('/auth')) {
        const pending = localStorage.getItem('law_of_light_accepted_pending');
        if (pending === 'true') {
          setIsAllowed(true);
          return;
        }
        navigate('/law-of-light', { replace: true });
        return;
      }

      // Guest mode: Allow unauthenticated users to view feed only
      if (!session) {
        if (location.pathname === '/' || location.pathname === '/feed') {
          setIsAllowed(true);
          return;
        }
        navigate('/law-of-light', { replace: true });
        return;
      }

      // Authenticated users - check Law of Light acceptance
      if (profile && !profile.law_of_light_accepted) {
        const pending = localStorage.getItem('law_of_light_accepted_pending');
        if (pending === 'true') {
          supabase.from('profiles').update({
            law_of_light_accepted: true,
            law_of_light_accepted_at: new Date().toISOString()
          }).eq('id', session.user.id).then(() => {
            localStorage.removeItem('law_of_light_accepted_pending');
          });
          setIsAllowed(true);
          return;
        }
        navigate('/law-of-light', { replace: true });
        return;
      }

      setIsAllowed(true);
    };

    checkAccess();
  }, [navigate, location.pathname, session, profile, isLoading, bootstrapError]);

  if (bootstrapError) {
    return (
      <AppErrorFallback
        code="auth_bootstrap_error"
        error={bootstrapError}
        message="Không thể khởi tạo phiên đăng nhập. Bạn có thể tải lại hoặc xóa cache để thử lại."
      />
    );
  }

  // Show loading while AuthContext is initializing
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Đang kiểm tra...</p>
        </div>
      </div>
    );
  }

  if (!isAllowed) {
    return null;
  }

  return <>{children}</>;
};
