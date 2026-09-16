import { useMemo, useState } from 'react';
import { AlertTriangle, Bug, ChevronDown, Copy, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  buildAppErrorDetails,
  clearCachesAndReload,
  copyErrorDetails,
  reloadApp,
  reportTechnicalIssue,
  type AppErrorDetails,
} from '@/lib/appRecovery';
import { cn } from '@/lib/utils';

interface AppErrorFallbackProps {
  title?: string;
  message?: string;
  code?: string;
  error?: unknown;
  details?: Partial<AppErrorDetails>;
  updateMode?: boolean;
  className?: string;
}

export function AppErrorFallback({
  title = 'Không thể tải FUN Profile',
  message = 'Ứng dụng có thể vừa được cập nhật hoặc kết nối đang gặp sự cố.',
  code = 'unknown_error',
  error,
  details,
  updateMode = false,
  className,
}: AppErrorFallbackProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const debugDetails = useMemo(() => buildAppErrorDetails({
    code,
    message: error instanceof Error ? error.message : details?.message || message,
    stack: error instanceof Error ? error.stack : details?.stack,
    ...details,
  }), [code, details, error, message]);

  const handleCopy = async () => {
    await copyErrorDetails(debugDetails);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className={cn('min-h-screen bg-[#f0f2f5] px-4 py-8 text-foreground', className)}>
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-2xl items-center justify-center">
        <div className="w-full rounded-2xl border bg-card p-5 shadow-xl sm:p-6">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-700">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold">{updateMode ? 'Phiên bản ứng dụng đã được cập nhật' : title}</h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {updateMode ? 'Vui lòng tải lại để dùng phiên bản mới nhất của FUN Profile.' : message}
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button type="button" onClick={reloadApp} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              {updateMode ? 'Cập nhật ngay' : 'Tải lại ứng dụng'}
            </Button>
            <Button type="button" variant="outline" onClick={() => void clearCachesAndReload()} className="gap-2">
              <Trash2 className="h-4 w-4" />
              Xóa cache và tải lại
            </Button>
            <Button type="button" variant="ghost" onClick={() => reportTechnicalIssue(debugDetails)} className="gap-2">
              <Bug className="h-4 w-4" />
              Báo lỗi kỹ thuật
            </Button>
          </div>

          <div className="mt-5 rounded-lg border bg-muted/30">
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm font-medium"
            >
              <span>Chi tiết lỗi</span>
              <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} />
            </button>
            {open && (
              <div className="border-t p-3">
                <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded bg-background p-3 text-xs text-muted-foreground">
                  {JSON.stringify(debugDetails, null, 2)}
                </pre>
                <Button type="button" size="sm" variant="outline" onClick={handleCopy} className="mt-3 gap-2">
                  <Copy className="h-3.5 w-3.5" />
                  {copied ? 'Đã copy' : 'Copy lỗi'}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
