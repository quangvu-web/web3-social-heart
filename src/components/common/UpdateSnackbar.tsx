import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppVersion } from '@/hooks/useAppVersion';
import { clearCachesAndReload } from '@/lib/appRecovery';

export function UpdateSnackbar() {
  const appVersion = useAppVersion();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error) {
      console.error('[PWA] Service worker registration failed:', error);
    },
  });

  const showVersionUpdate = appVersion.updateAvailable;
  if (!needRefresh && !showVersionUpdate) return null;

  const title = appVersion.preloadError
    ? 'Phiên bản ứng dụng đã được cập nhật'
    : 'FUN Profile vừa có phiên bản mới';
  const description = appVersion.preloadError
    ? 'Một phần ứng dụng đang dùng file cũ. Vui lòng cập nhật để tiếp tục.'
    : 'Cập nhật nhẹ nhàng để nhận trải nghiệm mới nhất.';

  const updateNow = () => {
    if (showVersionUpdate) {
      appVersion.updateNow();
      return;
    }
    updateServiceWorker(true);
  };

  const dismiss = () => {
    setNeedRefresh(false);
    appVersion.dismissUpdate();
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-3 right-3 z-[80] mx-auto max-w-md animate-in slide-in-from-bottom-3 fade-in-0 rounded-2xl border border-primary/20 bg-card/95 p-3 shadow-2xl shadow-primary/15 backdrop-blur sm:left-auto sm:right-4"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" size="sm" className="h-9 rounded-full" onClick={updateNow}>
              <RefreshCw className="mr-2 h-3.5 w-3.5" />
              Cập nhật ngay
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-9 rounded-full"
              onClick={() => void clearCachesAndReload()}
            >
              Xóa cache và tải lại
            </Button>
            <Button type="button" size="sm" variant="ghost" className="h-9 rounded-full" onClick={dismiss}>
              Để sau
            </Button>
          </div>
        </div>
        <button
          type="button"
          aria-label="Đóng thông báo cập nhật"
          onClick={dismiss}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
