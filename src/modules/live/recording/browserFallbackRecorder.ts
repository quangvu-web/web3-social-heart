import { uploadBrowserRecordingChunk, updateBrowserRecordingStatus } from '../liveService';
import { createRecorder, type RecorderController, type RecorderState } from './clientRecorder';

export type BrowserFallbackState = 'idle' | 'recording' | 'uploading' | 'uploaded' | 'failed';

interface CreateBrowserFallbackRecorderOptions {
  liveSessionId: string;
  postId?: string | null;
  tracks: MediaStreamTrack[];
  onStateChange?: (state: BrowserFallbackState) => void;
  onError?: (error: unknown) => void;
}

export interface BrowserFallbackRecorder {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  getState: () => BrowserFallbackState;
}

function mapRecorderState(state: RecorderState): BrowserFallbackState {
  if (state === 'recording') return 'recording';
  if (state === 'stopped') return 'uploaded';
  if (state === 'failed') return 'failed';
  return 'idle';
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Browser fallback recording failed.';
}

export function createBrowserFallbackRecorder(opts: CreateBrowserFallbackRecorderOptions): BrowserFallbackRecorder {
  const stream = new MediaStream(opts.tracks.filter((track) => track.readyState === 'live'));
  let state: BrowserFallbackState = 'idle';
  let recorder: RecorderController | null = null;
  let uploadChain = Promise.resolve();
  let failed = false;
  let startedAt = 0;

  const setState = (next: BrowserFallbackState) => {
    state = next;
    opts.onStateChange?.(next);
  };

  const reportFailure = async (error: unknown) => {
    failed = true;
    setState('failed');
    opts.onError?.(error);
    try {
      await updateBrowserRecordingStatus({
        liveSessionId: opts.liveSessionId,
        status: 'failed',
        warning: 'Livestream vẫn tiếp tục, nhưng replay có thể không được lưu.',
        errorMessage: errorMessage(error),
      });
    } catch (statusError) {
      console.warn('[browserFallbackRecorder] status update failed:', statusError);
    }
  };

  const enqueueUpload = (chunk: Blob, sequence: number) => {
    if (!chunk || chunk.size === 0 || failed) return;
    const elapsed = startedAt ? Date.now() - startedAt : null;
    uploadChain = uploadChain
      .then(async () => {
        setState('uploading');
        await uploadBrowserRecordingChunk({
          liveSessionId: opts.liveSessionId,
          postId: opts.postId ?? null,
          chunkIndex: sequence,
          chunk,
          mimeType: recorder?.getMimeType() || chunk.type || 'video/webm',
          durationMs: elapsed,
        });
        if (!failed) setState('recording');
      })
      .catch((error) => {
        void reportFailure(error);
      });
  };

  return {
    async start() {
      if (state !== 'idle') return;
      if (!stream.getTracks().length) {
        await reportFailure(new Error('No live media tracks available for browser fallback recording.'));
        return;
      }

      try {
        recorder = createRecorder(stream, {
          timesliceMs: 15_000,
          onStateChange: (next) => {
            if (!failed) setState(mapRecorderState(next));
          },
          onChunk: enqueueUpload,
          onError: (error) => {
            void reportFailure(error);
          },
        });
        startedAt = Date.now();
        await updateBrowserRecordingStatus({
          liveSessionId: opts.liveSessionId,
          status: 'recording',
          warning: 'Đang ghi replay dự phòng từ trình duyệt.',
        });
        recorder.start();
      } catch (error) {
        await reportFailure(error);
      }
    },

    async stop() {
      if (!recorder || state === 'idle') return;
      try {
        await recorder.stop();
        await uploadChain;
        if (!failed) {
          setState('uploaded');
          await updateBrowserRecordingStatus({
            liveSessionId: opts.liveSessionId,
            status: 'uploaded',
            warning: 'Replay dự phòng đã được upload thành công.',
          });
        }
      } catch (error) {
        await reportFailure(error);
      }
    },

    getState() {
      return state;
    },
  };
}
