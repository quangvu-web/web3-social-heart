/**
 * Upload Queue Manager
 * Manages composer media uploads with parallel progress, retry, reorder, and cleanup support.
 */

import { uploadToR2, uploadVideoToR2 } from './r2Upload';
import { compressImage, FILE_LIMITS } from './imageCompression';

export type UploadStatus = 'queued' | 'uploading' | 'completed' | 'failed' | 'cancelled';
export type ComposerMediaStatus = 'idle' | 'uploading' | 'processing' | 'ready' | 'error';

export type MediaItem = {
  id: string;
  file?: File;
  type: 'image' | 'video';
  previewUrl?: string;
  uploadUrl?: string;
  thumbnailUrl?: string;
  duration?: number;
  status: ComposerMediaStatus;
  progress?: number;
  errorMessage?: string;
};

export interface UploadItem {
  id: string;
  file: File;
  preview: string;
  type: 'image' | 'video';
  status: UploadStatus;
  progress: number;
  error?: string;
  url?: string;
  key?: string;
  thumbnailUrl?: string;
  duration?: number;
  bytesUploaded?: number;
  bytesTotal?: number;
  uploadSpeed?: number;
  eta?: number;
}

export interface UploadQueueOptions {
  maxConcurrent?: number;
  maxFiles?: number;
  onProgress?: (item: UploadItem) => void;
  onComplete?: (item: UploadItem) => void;
  onError?: (item: UploadItem, error: Error) => void;
  onQueueComplete?: (items: UploadItem[]) => void;
  accessToken?: string;
}

const DEFAULT_MAX_CONCURRENT = 4;
const DEFAULT_MAX_FILES = 100;

function createUploadId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export class UploadQueue {
  private items: Map<string, UploadItem> = new Map();
  private activeUploads: Set<string> = new Set();
  private options: UploadQueueOptions;
  private abortControllers: Map<string, AbortController> = new Map();
  private isPaused = false;
  private listeners: Set<(items: UploadItem[]) => void> = new Set();

  constructor(options: UploadQueueOptions = {}) {
    this.options = {
      maxConcurrent: DEFAULT_MAX_CONCURRENT,
      maxFiles: DEFAULT_MAX_FILES,
      ...options,
    };
  }

  async addFiles(files: File[], accessToken?: string): Promise<{ added: UploadItem[]; rejected: { file: File; reason: string }[] }> {
    const added: UploadItem[] = [];
    const rejected: { file: File; reason: string }[] = [];
    const currentCount = this.items.size;
    const maxFiles = this.options.maxFiles || DEFAULT_MAX_FILES;

    for (const file of files) {
      if (currentCount + added.length >= maxFiles) {
        rejected.push({ file, reason: `Đã đạt giới hạn ${maxFiles} file` });
        continue;
      }

      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');

      if (!isImage && !isVideo) {
        rejected.push({ file, reason: 'Loại file không được hỗ trợ' });
        continue;
      }

      if (isImage && file.size > FILE_LIMITS.IMAGE_MAX_SIZE) {
        rejected.push({ file, reason: 'Ảnh phải nhỏ hơn 100MB' });
        continue;
      }

      if (isVideo && file.size > FILE_LIMITS.VIDEO_MAX_SIZE) {
        rejected.push({ file, reason: 'Video phải nhỏ hơn 10GB' });
        continue;
      }

      const item: UploadItem = {
        id: createUploadId(),
        file,
        preview: URL.createObjectURL(file),
        type: isImage ? 'image' : 'video',
        status: 'queued',
        progress: 0,
        bytesTotal: file.size,
        bytesUploaded: 0,
      };

      this.items.set(item.id, item);
      added.push(item);
    }

    if (accessToken) {
      this.options.accessToken = accessToken;
    }

    this.notifyListeners();
    this.processQueue();

    return { added, rejected };
  }

  private async processQueue(): Promise<void> {
    if (this.isPaused) return;

    const maxConcurrent = this.options.maxConcurrent || DEFAULT_MAX_CONCURRENT;
    const queuedItems = Array.from(this.items.values()).filter((item) => item.status === 'queued');

    for (const item of queuedItems) {
      if (this.activeUploads.size >= maxConcurrent) break;
      this.uploadItem(item);
    }
  }

  private async uploadItem(item: UploadItem): Promise<void> {
    const id = item.id;
    this.activeUploads.add(id);

    const abortController = new AbortController();
    this.abortControllers.set(id, abortController);
    this.updateItem(id, { status: 'uploading', progress: 1 });

    const startTime = Date.now();
    let lastBytesUploaded = 0;
    let lastUpdateTime = startTime;

    try {
      let processedFile = item.file;
      let result: { url: string; key: string };

      if (item.type === 'image') {
        this.updateItem(id, { progress: 5 });
        processedFile = await compressImage(item.file, {
          maxWidth: FILE_LIMITS.POST_IMAGE_MAX_WIDTH,
          maxHeight: FILE_LIMITS.POST_IMAGE_MAX_HEIGHT,
          quality: 0.85,
        });
        this.updateItem(id, { progress: 15 });

        result = await uploadToR2(processedFile, 'posts', undefined, this.options.accessToken);
      } else {
        const videoResult = await uploadVideoToR2(
          processedFile,
          (progress) => {
            const now = Date.now();
            const timeDiff = (now - lastUpdateTime) / 1000;
            const bytesDiff = progress.bytesUploaded - lastBytesUploaded;
            const speed = timeDiff > 0 ? bytesDiff / timeDiff : 0;

            lastBytesUploaded = progress.bytesUploaded;
            lastUpdateTime = now;

            this.updateItem(id, {
              progress: Math.min(99, Math.max(1, progress.percentage)),
              bytesUploaded: progress.bytesUploaded,
              bytesTotal: progress.bytesTotal,
              uploadSpeed: speed,
            });
          },
          this.options.accessToken
        );

        result = { url: videoResult.publicUrl, key: videoResult.key };
      }

      this.updateItem(id, {
        status: 'completed',
        progress: 100,
        url: result.url,
        key: result.key,
        bytesUploaded: processedFile.size,
      });

      this.options.onComplete?.(this.items.get(id)!);
    } catch (error: any) {
      if (error.name === 'AbortError' || item.status === 'cancelled') {
        this.updateItem(id, { status: 'cancelled' });
      } else {
        this.updateItem(id, {
          status: 'failed',
          error: error.message || 'Upload thất bại',
        });
        this.options.onError?.(this.items.get(id)!, error);
      }
    } finally {
      this.activeUploads.delete(id);
      this.abortControllers.delete(id);
      this.checkQueueComplete();
      this.processQueue();
    }
  }

  private updateItem(id: string, updates: Partial<UploadItem>): void {
    const item = this.items.get(id);
    if (!item) return;

    const updated = { ...item, ...updates };
    this.items.set(id, updated);

    this.options.onProgress?.(updated);
    this.notifyListeners();
  }

  private checkQueueComplete(): void {
    const allItems = Array.from(this.items.values());
    const pendingItems = allItems.filter((item) => item.status === 'queued' || item.status === 'uploading');

    if (pendingItems.length === 0 && allItems.length > 0) {
      this.options.onQueueComplete?.(allItems);
    }
  }

  cancelUpload(id: string): void {
    const item = this.items.get(id);
    if (!item) return;

    if (item.status === 'uploading') {
      this.abortControllers.get(id)?.abort();
    }

    URL.revokeObjectURL(item.preview);
    this.items.delete(id);
    this.notifyListeners();
  }

  removeItem(id: string): void {
    this.cancelUpload(id);
  }

  retryUpload(id: string): void {
    const item = this.items.get(id);
    if (!item || item.status !== 'failed') return;

    this.updateItem(id, { status: 'queued', progress: 0, error: undefined });
    this.processQueue();
  }

  pause(): void {
    this.isPaused = true;
  }

  resume(): void {
    this.isPaused = false;
    this.processQueue();
  }

  cancelAll(): void {
    for (const [id] of this.items) {
      this.cancelUpload(id);
    }
  }

  clearCompleted(): void {
    for (const [id, item] of this.items) {
      if (item.status === 'completed' || item.status === 'failed' || item.status === 'cancelled') {
        URL.revokeObjectURL(item.preview);
        this.items.delete(id);
      }
    }
    this.notifyListeners();
  }

  getItems(): UploadItem[] {
    return Array.from(this.items.values());
  }

  getMediaItems(): MediaItem[] {
    return this.getItems().map((item) => {
      const status: ComposerMediaStatus =
        item.status === 'completed' ? 'ready' :
        item.status === 'failed' ? 'error' :
        item.status === 'uploading' ? 'uploading' :
        item.status === 'queued' ? 'idle' : 'error';

      return {
        id: item.id,
        file: item.file,
        type: item.type,
        previewUrl: item.preview,
        uploadUrl: item.url,
        thumbnailUrl: item.thumbnailUrl,
        duration: item.duration,
        status,
        progress: item.progress,
        errorMessage: item.error,
      };
    });
  }

  getItem(id: string): UploadItem | undefined {
    return this.items.get(id);
  }

  getStats(): {
    total: number;
    completed: number;
    failed: number;
    uploading: number;
    queued: number;
    overallProgress: number;
  } {
    const items = Array.from(this.items.values());
    const completed = items.filter((i) => i.status === 'completed').length;
    const failed = items.filter((i) => i.status === 'failed').length;
    const uploading = items.filter((i) => i.status === 'uploading').length;
    const queued = items.filter((i) => i.status === 'queued').length;

    const overallProgress = items.length > 0
      ? items.reduce((sum, item) => sum + item.progress, 0) / items.length
      : 0;

    return {
      total: items.length,
      completed,
      failed,
      uploading,
      queued,
      overallProgress,
    };
  }

  subscribe(listener: (items: UploadItem[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    const items = this.getItems();
    this.listeners.forEach((listener) => listener(items));
  }

  reorderItems(fromIndex: number, toIndex: number): void {
    const items = this.getItems();
    const [movedItem] = items.splice(fromIndex, 1);
    items.splice(toIndex, 0, movedItem);

    this.items.clear();
    items.forEach((item) => this.items.set(item.id, item));
    this.notifyListeners();
  }

  getCompletedUrls(): Array<{ url: string; type: 'image' | 'video' }> {
    return this.getItems()
      .filter((item) => item.status === 'completed' && item.url)
      .map((item) => ({
        url: item.url!,
        type: item.type,
      }));
  }

  isUploading(): boolean {
    return this.activeUploads.size > 0;
  }

  destroy(): void {
    this.cancelAll();
    this.listeners.clear();
  }
}

export function createUploadQueue(options?: UploadQueueOptions): UploadQueue {
  return new UploadQueue(options);
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function formatEta(seconds: number): string {
  if (!isFinite(seconds) || seconds <= 0) return '--:--';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}
