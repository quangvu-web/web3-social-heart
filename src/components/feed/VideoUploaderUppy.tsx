import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Video, X, Loader2, CheckCircle, AlertCircle, Clock, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { uploadVideoToR2 } from '@/utils/r2Upload';

interface VideoUploaderUppyProps {
  onUploadComplete: (result: { uid: string; url: string; thumbnailUrl: string; localThumbnail?: string }) => void;
  onUploadError?: (error: Error) => void;
  onUploadStart?: () => void;
  onRemove?: () => void;
  disabled?: boolean;
  selectedFile?: File | null;
}

interface UploadState {
  status: 'idle' | 'preparing' | 'uploading' | 'ready' | 'error';
  progress: number;
  bytesUploaded: number;
  bytesTotal: number;
  uploadSpeed: number;
  videoKey?: string;
  error?: string;
  localThumbnail?: string;
}

const BACKEND_TIMEOUT_MS = 30000;

/**
 * Generate a thumbnail from video file using canvas
 */
const generateVideoThumbnail = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    const cleanup = () => {
      URL.revokeObjectURL(video.src);
    };

    video.onloadeddata = () => {
      video.currentTime = Math.min(1, video.duration * 0.25);
    };

    video.onseeked = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx?.drawImage(video, 0, 0);
      const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.8);
      cleanup();
      resolve(thumbnailUrl);
    };

    video.onerror = () => {
      cleanup();
      reject(new Error('Cannot generate thumbnail from video'));
    };

    setTimeout(() => {
      if (!canvas.width) {
        cleanup();
        reject(new Error('Thumbnail generation timeout'));
      }
    }, 10000);

    video.src = URL.createObjectURL(file);
  });
};

export const VideoUploaderUppy = ({
  onUploadComplete,
  onUploadError,
  onUploadStart,
  onRemove,
  disabled = false,
  selectedFile,
}: VideoUploaderUppyProps) => {
  const [uploadState, setUploadState] = useState<UploadState>({
    status: 'idle',
    progress: 0,
    bytesUploaded: 0,
    bytesTotal: 0,
    uploadSpeed: 0,
  });

  const lastBytesRef = useRef(0);
  const lastTimeRef = useRef(Date.now());
  const isUploadingRef = useRef(false);
  const localThumbnailRef = useRef<string | undefined>(undefined);
  const currentFileRef = useRef<string | null>(null);
  const uploadStartedRef = useRef(false);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!selectedFile) return;

    const fileId = `${selectedFile.name}_${selectedFile.size}_${selectedFile.lastModified}`;
    if (currentFileRef.current === fileId && uploadStartedRef.current) return;

    const startUpload = async () => {
      if (uploadStartedRef.current && currentFileRef.current === fileId) return;

      currentFileRef.current = fileId;
      uploadStartedRef.current = true;
      startTimeRef.current = Date.now();

      try {
        isUploadingRef.current = true;

        setUploadState({
          status: 'preparing',
          progress: 0,
          bytesUploaded: 0,
          bytesTotal: selectedFile.size,
          uploadSpeed: 0,
        });

        onUploadStart?.();

        generateVideoThumbnail(selectedFile)
          .then((thumb) => {
            localThumbnailRef.current = thumb;
            setUploadState((prev) => ({ ...prev, localThumbnail: thumb }));
          })
          .catch(() => undefined);

        setUploadState((prev) => ({ ...prev, status: 'uploading' }));

        const result = await uploadVideoToR2(
          selectedFile,
          (progress) => {
            const now = Date.now();
            const timeDiff = (now - lastTimeRef.current) / 1000;
            const bytesDiff = progress.bytesUploaded - lastBytesRef.current;
            const speed = timeDiff > 0 ? bytesDiff / timeDiff : 0;

            lastBytesRef.current = progress.bytesUploaded;
            lastTimeRef.current = now;

            setUploadState((prev) => ({
              ...prev,
              progress: progress.percentage,
              bytesUploaded: progress.bytesUploaded,
              bytesTotal: progress.bytesTotal,
              uploadSpeed: speed > 0 ? speed : prev.uploadSpeed,
            }));
          }
        );

        setUploadState((prev) => ({
          ...prev,
          status: 'ready',
          progress: 100,
          videoKey: result.key,
        }));

        isUploadingRef.current = false;
        toast.success('Video ð? t?i lên thành công!');

        // TODO: Upload thumbnail to R2 if needed (currently using local thumbnail only).
        onUploadComplete({
          uid: result.key,
          url: result.publicUrl,
          thumbnailUrl: localThumbnailRef.current || '',
          localThumbnail: localThumbnailRef.current,
        });
      } catch (error) {
        isUploadingRef.current = false;
        uploadStartedRef.current = false;
        currentFileRef.current = null;

        const errorMessage = error instanceof Error ? error.message : 'L?i không xác ð?nh';
        setUploadState((prev) => ({
          ...prev,
          status: 'error',
          error: errorMessage,
        }));

        onUploadError?.(error instanceof Error ? error : new Error(errorMessage));
        toast.error(`L?i: ${errorMessage}`);
      }
    };

    startUpload();
  }, [selectedFile, onUploadComplete, onUploadError, onUploadStart]);

  const handleRetry = useCallback(() => {
    if (!selectedFile) return;
    uploadStartedRef.current = false;
    currentFileRef.current = null;
    setUploadState({
      status: 'idle',
      progress: 0,
      bytesUploaded: 0,
      bytesTotal: 0,
      uploadSpeed: 0,
    });
    setTimeout(() => {
      setUploadState((prev) => ({ ...prev }));
    }, 100);
  }, [selectedFile]);

  const handleCancel = useCallback(() => {
    isUploadingRef.current = false;
    uploadStartedRef.current = false;
    currentFileRef.current = null;

    setUploadState({
      status: 'idle',
      progress: 0,
      bytesUploaded: 0,
      bytesTotal: 0,
      uploadSpeed: 0,
    });
    onRemove?.();
  }, [onRemove]);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const formatSpeed = (bytesPerSecond: number): string => {
    return `${formatBytes(bytesPerSecond)}/s`;
  };

  const formatTime = (seconds: number): string => {
    if (!isFinite(seconds) || seconds <= 0) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getETA = (): string => {
    if (uploadState.uploadSpeed <= 0) return '--:--';
    const remaining = uploadState.bytesTotal - uploadState.bytesUploaded;
    const seconds = remaining / uploadState.uploadSpeed;
    return formatTime(seconds);
  };

  if (uploadState.status === 'idle' && !selectedFile) {
    return null;
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4" data-video-key={uploadState.videoKey}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Video className="w-5 h-5 text-primary" />
          <span className="font-medium text-sm">T?i video lên</span>
        </div>

        {uploadState.status !== 'ready' && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCancel}
            disabled={disabled}
            className="h-8 w-8"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {uploadState.status === 'preparing' && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Ðang chu?n b?...</span>
        </div>
      )}

      {uploadState.status === 'uploading' && (
        <div className="space-y-3">
          <Progress value={uploadState.progress} className="h-3" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {formatBytes(uploadState.bytesUploaded)} / {formatBytes(uploadState.bytesTotal)}
            </span>
            <span className="font-medium text-primary">{Math.round(uploadState.progress)}%</span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            {uploadState.uploadSpeed > 0 && (
              <span>T?c ð?: {formatSpeed(uploadState.uploadSpeed)}</span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              C?n l?i: {getETA()}
            </span>
          </div>
          <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded text-xs text-amber-600 dark:text-amber-400">
            ?? Vui l?ng không ðóng tr?nh duy?t khi ðang t?i lên!
          </div>
        </div>
      )}

      {uploadState.status === 'ready' && uploadState.videoKey && (
        <div className="space-y-2">
          <div className="relative rounded-lg overflow-hidden bg-muted h-32">
            {uploadState.localThumbnail ? (
              <img
                src={uploadState.localThumbnail}
                alt="Video thumbnail"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Video className="w-12 h-12 text-muted-foreground" />
              </div>
            )}
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              Video ð? s?n sàng
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              className="h-6 text-xs text-muted-foreground hover:text-destructive"
            >
              Xóa
            </Button>
          </div>
        </div>
      )}

      {uploadState.status === 'error' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="w-4 h-4" />
            <span>{uploadState.error || 'Ð? x?y ra l?i'}</span>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetry}
              className="gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              Th? l?i
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
            >
              H?y
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

