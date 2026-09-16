/**
 * Social media preview grid for the post composer.
 * Shows the first four media like Facebook and keeps upload details lightweight.
 */

import { useCallback, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle, GripVertical, ImagePlus, Loader2, Play, RotateCcw, Video, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { UploadItem } from '@/utils/uploadQueue';

interface MediaUploadPreviewProps {
  items: UploadItem[];
  onRemove: (id: string) => void;
  onRetry: (id: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  disabled?: boolean;
}

function getTileClass(total: number, index: number): string {
  if (total === 1) return 'col-span-2 row-span-2 aspect-[4/3]';
  if (total === 2) return 'aspect-square';
  if (total === 3) return index === 0 ? 'row-span-2 aspect-auto' : 'aspect-square';
  return 'aspect-square';
}

function getStatusLabel(item: UploadItem): string {
  if (item.status === 'queued') return item.type === 'video' ? 'Đang chờ tải video...' : 'Đang chờ tải ảnh...';
  if (item.status === 'uploading') return item.type === 'video' ? 'Đang tải video...' : 'Đang tải ảnh...';
  if (item.status === 'failed') return item.error || 'Upload thất bại';
  return 'Sẵn sàng';
}

export function MediaUploadPreview({
  items,
  onRemove,
  onRetry,
  onReorder,
  disabled = false,
}: MediaUploadPreviewProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const visibleItems = useMemo(() => items.slice(0, 4), [items]);
  const hiddenCount = Math.max(0, items.length - visibleItems.length);

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    if (disabled) return;
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  }, [disabled]);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  }, [draggedIndex]);

  const handleDragEnd = useCallback(() => {
    if (draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
      onReorder(draggedIndex, dragOverIndex);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, [dragOverIndex, draggedIndex, onReorder]);

  if (items.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>{items.length} media trong bài viết</span>
        <span className="hidden sm:inline">Kéo để sắp xếp lại</span>
      </div>

      <div className="grid grid-cols-2 gap-1.5 overflow-hidden rounded-2xl">
        {visibleItems.map((item, index) => {
          const isBusy = item.status === 'queued' || item.status === 'uploading';
          const isFailed = item.status === 'failed';
          const isLastVisible = index === visibleItems.length - 1 && hiddenCount > 0;

          return (
            <div
              key={item.id}
              draggable={!disabled && !isBusy}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              className={cn(
                'group relative min-h-[150px] overflow-hidden bg-muted',
                getTileClass(items.length, index),
                draggedIndex === index && 'opacity-50',
                dragOverIndex === index && 'outline outline-2 outline-primary',
                !disabled && !isBusy && 'cursor-grab active:cursor-grabbing',
              )}
            >
              {item.type === 'image' ? (
                <img src={item.preview} alt="" className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <div className="relative h-full w-full">
                  <video src={item.preview} className="h-full w-full object-cover" muted playsInline />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/15">
                    <div className="rounded-full bg-black/45 p-3 text-white shadow-lg">
                      <Play className="h-7 w-7 fill-current" />
                    </div>
                  </div>
                </div>
              )}

              {isLastVisible && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-3xl font-bold text-white">
                  +{hiddenCount}
                </div>
              )}

              {isBusy && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/55 p-4 text-center text-white">
                  <div className="absolute inset-0 animate-pulse bg-white/10" />
                  <Loader2 className="mb-2 h-6 w-6 animate-spin" />
                  <span className="text-sm font-medium">{getStatusLabel(item)}</span>
                  <Progress value={item.progress} className="mt-3 h-1.5 w-4/5" />
                  <span className="mt-1 text-xs">{Math.round(item.progress || 0)}%</span>
                </div>
              )}

              {isFailed && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/65 p-4 text-center text-white">
                  <AlertCircle className="mb-2 h-6 w-6 text-destructive" />
                  <span className="mb-3 line-clamp-2 text-sm">{getStatusLabel(item)}</span>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    aria-label="Thử lại upload media"
                    onClick={() => onRetry(item.id)}
                    className="h-8 rounded-full"
                  >
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                    Thử lại
                  </Button>
                </div>
              )}

              {item.status === 'completed' && (
                <div className="absolute bottom-2 left-2 rounded-full bg-emerald-500 p-1 text-white shadow">
                  <CheckCircle className="h-4 w-4" />
                </div>
              )}

              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Xóa media"
                onClick={() => onRemove(item.id)}
                disabled={disabled}
                className="absolute right-2 top-2 h-9 w-9 rounded-full bg-black/55 text-white shadow hover:bg-black/75"
              >
                <X className="h-4 w-4" />
              </Button>

              {!disabled && !isBusy && (
                <div className="absolute left-2 top-2 rounded-full bg-black/45 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100">
                  <GripVertical className="h-4 w-4" />
                </div>
              )}

              <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-xs font-medium text-white">
                {item.type === 'image' ? <ImagePlus className="h-3.5 w-3.5" /> : <Video className="h-3.5 w-3.5" />}
                {item.type === 'image' ? 'Ảnh' : 'Video'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
