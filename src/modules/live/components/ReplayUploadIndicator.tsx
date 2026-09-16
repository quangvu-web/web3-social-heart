import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Loader2, X, AlertCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
  clearUploadJob,
  getActiveUploadJob,
  subscribeUploadJob,
  type UploadJob,
} from '@/modules/live/recording/backgroundUploader';

export function ReplayUploadIndicator() {
  const [job, setJob] = useState<UploadJob | null>(getActiveUploadJob());

  useEffect(() => {
    return subscribeUploadJob(setJob);
  }, []);

  if (!job) return null;

  const isDone = job.status === 'success';
  const isFailed = job.status === 'failed';
  const isWorking = !isDone && !isFailed;

  const label = (() => {
    switch (job.status) {
      case 'preparing':
        return 'Đang chuẩn bị replay...';
      case 'uploading':
        return `Đang tải replay ${job.progress}%`;
      case 'finalizing':
        return 'Đang hoàn tất...';
      case 'success':
        return 'Replay đã sẵn sàng';
      case 'failed':
        return job.errorMessage || 'Tải replay thất bại';
      default:
        return 'Đang xử lý...';
    }
  })();

  return (
    <div className="fixed bottom-20 right-4 z-[60] w-[300px] rounded-xl border border-border/60 bg-background/95 backdrop-blur-md shadow-xl p-3 animate-fade-in">
      <div className="flex items-center gap-2 mb-2">
        {isWorking && <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />}
        {isDone && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
        {isFailed && <AlertCircle className="h-4 w-4 text-destructive shrink-0" />}
        <span className="text-sm font-medium flex-1 truncate">{label}</span>
        {(isDone || isFailed) && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => clearUploadJob()}
            aria-label="Đóng"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {isWorking && (
        <Progress
          value={job.status === 'uploading' ? job.progress : job.status === 'finalizing' ? 100 : 5}
          className="h-2"
        />
      )}

      {isWorking && (
        <p className="text-[11px] text-muted-foreground mt-2">
          Bạn có thể tiếp tục dùng app. Vui lòng không đóng tab.
        </p>
      )}

      {isDone && (
        <Link
          to={`/live/${job.sessionId}`}
          className="text-xs text-primary underline mt-1 inline-block"
          onClick={() => clearUploadJob()}
        >
          Xem replay →
        </Link>
      )}

      {isFailed && (
        <p className="text-[11px] text-destructive mt-1">
          Replay vẫn được lưu cục bộ. Hãy thử lại sau.
        </p>
      )}
    </div>
  );
}

export default ReplayUploadIndicator;
