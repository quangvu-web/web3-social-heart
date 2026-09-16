import {
  createLiveReplayUpload,
  markLiveReplayUploaded,
  uploadReplayToCloudflare,
} from '../liveReplayUpload';
import { deleteReplayRecovery } from './replayRecovery';
import { finalizeLiveSession } from '../liveService';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * After upload completes, poll live_sessions.recording_status and ping the
 * reconciler so the feed flips to "replay ready" within ~1 min of CF being
 * ready, even if the Cloudflare webhook is delayed or missing.
 */
async function pollUntilReplayReady(sessionId: string): Promise<void> {
  const startedAt = Date.now();
  const maxMs = 5 * 60 * 1000;
  const intervalMs = 10 * 1000;

  let lastReconcileAt = 0;
  const triggerReconcile = () => {
    if (Date.now() - lastReconcileAt < 25_000) return;
    lastReconcileAt = Date.now();
    void supabase.functions.invoke('reconcile-pending-replays', { body: {} }).catch(() => undefined);
  };
  triggerReconcile();

  while (Date.now() - startedAt < maxMs) {
    await new Promise((r) => setTimeout(r, intervalMs));
    triggerReconcile();
    try {
      const { data } = await supabase
        .from('live_sessions')
        .select('recording_status, post_id')
        .eq('id', sessionId)
        .maybeSingle();
      const status = data?.recording_status;
      if (status === 'ready') {
        toast.success('Replay đã lên feed');
        window.dispatchEvent(
          new CustomEvent('replay-ready', { detail: { sessionId, postId: data?.post_id } }),
        );
        return;
      }
      if (status === 'failed') {
        toast.error('Replay xử lý thất bại');
        return;
      }
    } catch (err) {
      console.warn('[backgroundUploader] poll error:', err);
    }
  }
  toast.message('Replay đang xử lý, sẽ tự lên feed khi xong');
}

export type UploadJobStatus =
  | 'queued'
  | 'preparing'
  | 'uploading'
  | 'finalizing'
  | 'success'
  | 'failed';

export interface UploadJob {
  sessionId: string;
  blob: Blob;
  mimeType: string;
  durationSeconds: number | null;
  status: UploadJobStatus;
  progress: number;
  errorMessage?: string | null;
  replayId?: string | null;
  createdAt: number;
}

type Listener = (job: UploadJob | null) => void;

let activeJob: UploadJob | null = null;
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l(activeJob);
}

function patch(p: Partial<UploadJob>) {
  if (!activeJob) return;
  activeJob = { ...activeJob, ...p };
  emit();
}

export function subscribeUploadJob(listener: Listener): () => void {
  listeners.add(listener);
  listener(activeJob);
  return () => {
    listeners.delete(listener);
  };
}

export function getActiveUploadJob(): UploadJob | null {
  return activeJob;
}

export function clearUploadJob() {
  activeJob = null;
  emit();
}

export interface EnqueueOptions {
  sessionId: string;
  blob: Blob;
  mimeType: string;
  durationSeconds: number | null;
}

/**
 * Push upload to background. Returns immediately. The pipeline runs detached
 * and updates the singleton job state for the global indicator to consume.
 */
export function enqueueReplayUpload(opts: EnqueueOptions): void {
  activeJob = {
    sessionId: opts.sessionId,
    blob: opts.blob,
    mimeType: opts.mimeType,
    durationSeconds: opts.durationSeconds,
    status: 'preparing',
    progress: 0,
    replayId: null,
    createdAt: Date.now(),
  };
  emit();

  // Run pipeline detached
  void runPipeline();
}

async function runPipeline() {
  if (!activeJob) return;
  const job = activeJob;

  try {
    patch({ status: 'preparing', progress: 0 });

    const upload = await createLiveReplayUpload({
      liveSessionId: job.sessionId,
      expectedSize: job.blob.size,
    });
    patch({ replayId: upload.replay_id, status: 'uploading' });

    await uploadReplayToCloudflare({
      blob: job.blob,
      uploadURL: upload.uploadURL,
      method: upload.upload_method,
      filename: `fun-live-replay-${job.sessionId}.webm`,
      onProgress: (percent) => patch({ progress: percent }),
    });

    patch({ status: 'finalizing', progress: 100 });
    await markLiveReplayUploaded(upload.replay_id);

    await deleteReplayRecovery(job.sessionId).catch(() => undefined);

    patch({ status: 'success' });
    // Webhook is primary path; reconciler is fallback. Kick off polling so the
    // feed refreshes within ~1 min of CF marking the video ready, even if the
    // webhook is delayed/missing.
    void pollUntilReplayReady(job.sessionId);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed';
    console.error('[backgroundUploader] pipeline error:', error);
    patch({ status: 'failed', errorMessage: message });

    // Only on failure: mark the session as failed so it doesn't sit forever
    // in a "processing" state.
    try {
      await finalizeLiveSession(job.sessionId, {
        playbackUrl: null,
        recordingStatus: 'failed',
      });
    } catch (e) {
      console.warn('[backgroundUploader] finalizeLiveSession (failure path) failed:', e);
    }
  }
}

// Warn user before closing tab while an upload is in progress
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', (event) => {
    if (
      activeJob &&
      activeJob.status !== 'success' &&
      activeJob.status !== 'failed'
    ) {
      event.preventDefault();
      event.returnValue = '';
    }
  });
}
