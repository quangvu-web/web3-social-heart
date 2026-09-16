import * as tus from 'tus-js-client';
import { supabase } from '@/integrations/supabase/client';

export type LiveReplayUploadMethod = 'form' | 'tus';
export type LiveReplayStatus = 'uploading' | 'queued' | 'processing' | 'ready' | 'failed';

export interface CreateLiveReplayUploadResult {
  uploadURL: string;
  stream_uid: string;
  replay_id: string;
  upload_method: LiveReplayUploadMethod;
}

export interface LiveReplayRow {
  id: string;
  user_id: string;
  live_session_id: string;
  stream_uid: string;
  playback_hls: string | null;
  playback_dash: string | null;
  playback_mp4: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  filesize_bytes: number | null;
  status: LiveReplayStatus;
  error_message: string | null;
}

export async function createLiveReplayUpload(input: {
  liveSessionId: string;
  chunkedRecordingId?: string | null;
  expectedSize: number;
  sourceWebmKey?: string | null;
}): Promise<CreateLiveReplayUploadResult> {
  const { data, error } = await supabase.functions.invoke('live-replay-create-upload', {
    body: {
      live_session_id: input.liveSessionId,
      chunked_recording_id: input.chunkedRecordingId ?? null,
      expected_size: input.expectedSize,
      source_webm_key: input.sourceWebmKey ?? null,
    },
  });
  if (error) throw error;
  if (!data?.uploadURL || !data?.stream_uid || !data?.replay_id) {
    throw new Error('Invalid replay upload response');
  }
  return data as CreateLiveReplayUploadResult;
}

export function uploadReplayToCloudflare(input: {
  blob: Blob;
  uploadURL: string;
  method: LiveReplayUploadMethod;
  filename: string;
  onProgress?: (percent: number) => void;
}): Promise<void> {
  if (input.method === 'tus') {
    return new Promise((resolve, reject) => {
      const upload = new tus.Upload(input.blob, {
        uploadUrl: input.uploadURL,
        // 50MB chunks for fast retries. Do NOT set parallelUploads here:
        // tus-js-client requires `endpoint` (not `uploadUrl`) when parallelUploads > 1,
        // which causes "Cannot read properties of undefined (reading 'split')".
        chunkSize: 50 * 1024 * 1024,
        retryDelays: [0, 1000, 3000, 5000, 10000],
        removeFingerprintOnSuccess: true,
        metadata: {
          filename: input.filename,
          filetype: input.blob.type || 'video/webm',
        },
        onError: reject,
        onProgress: (bytesUploaded, bytesTotal) => {
          if (bytesTotal > 0) {
            input.onProgress?.(Math.round((bytesUploaded / bytesTotal) * 100));
          }
        },
        onSuccess: () => resolve(),
      });
      upload.start();
    });
  }

  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', new File([input.blob], input.filename, { type: input.blob.type || 'video/webm' }));

    const xhr = new XMLHttpRequest();
    xhr.open('POST', input.uploadURL);
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      input.onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Cloudflare upload failed: HTTP ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error('Cloudflare upload failed - network error'));
    xhr.send(formData);
  });
}

export async function markLiveReplayUploaded(replayId: string): Promise<void> {
  const rpc = supabase.rpc as unknown as (
    fn: string,
    args: Record<string, string>
  ) => Promise<{ error: Error | null }>;
  const { error } = await rpc('mark_live_replay_uploaded', { _replay_id: replayId });
  if (error) {
    // Race condition: Cloudflare webhook may have already advanced status past 'uploading'
    // (to 'queued', 'processing', or 'ready'). That's fine — log and continue.
    console.warn('[markLiveReplayUploaded] non-fatal:', error.message || error);
  }
}
