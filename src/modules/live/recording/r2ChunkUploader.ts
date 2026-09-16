/**
 * R2 chunked uploader for webcam live recordings.
 *
 * Buffers MediaRecorder chunks in memory until they reach `MIN_PART_BYTES`
 * (R2 multipart minimum: 5 MiB), then uploads each part to the Cloudflare
 * Worker (`/upload/live-part/*`). Up to `MAX_CONCURRENCY` parts upload in
 * parallel to avoid head-of-line blocking on slow uplinks.
 *
 * Lifecycle:
 *   const u = createR2ChunkUploader({ sessionId });
 *   await u.start();           // POST /init -> { key, upload_id }
 *   u.appendChunk(blob, seq);  // queue, flushes when buffer ≥ 5 MiB
 *   const final = await u.finalize();  // flush remaining + POST /complete
 *   // or: u.abort();          // POST /abort, drop everything
 */

import { supabase } from '@/integrations/supabase/client';

const WORKER_URL = (
  import.meta.env.VITE_AGORA_WORKER_URL ||
  'https://fun-agora-rtc-token.hieu-le-010.workers.dev'
).replace(/\/+$/, '');

// R2 multipart minimum (except last part): 5 MiB
const MIN_PART_BYTES = 5 * 1024 * 1024;
const MAX_CONCURRENCY = 2;
const MAX_RETRIES_PER_PART = 4;

export type R2UploaderState = 'idle' | 'starting' | 'uploading' | 'completing' | 'completed' | 'failed' | 'aborted';

export interface R2UploadedPart {
  partNumber: number;
  etag: string;
}

export interface R2FinalizeResult {
  key: string;
  url: string;
  size: number;
  partCount: number;
}

export interface R2UploaderStatus {
  state: R2UploaderState;
  uploadedBytes: number;
  queuedBytes: number;
  partsUploaded: number;
  partsInFlight: number;
  lastError: string | null;
}

export interface CreateR2UploaderOptions {
  sessionId: string;
  contentType?: string;
  onStatus?: (status: R2UploaderStatus) => void;
}

export interface R2ChunkUploader {
  start: () => Promise<void>;
  appendChunk: (chunk: Blob, sequence: number) => void;
  finalize: () => Promise<R2FinalizeResult>;
  abort: () => Promise<void>;
  getStatus: () => R2UploaderStatus;
  getKey: () => string | null;
}

async function getAuthToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Bạn cần đăng nhập để ghi live');
  return token;
}

async function postJson<T>(path: string, body: unknown, token: string): Promise<T> {
  const res = await fetch(`${WORKER_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`POST ${path} ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

async function uploadPartOnce(
  buffer: ArrayBuffer,
  partNumber: number,
  ctx: { sessionId: string; key: string; uploadId: string; token: string },
): Promise<string> {
  const res = await fetch(`${WORKER_URL}/upload/live-part/upload`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/octet-stream',
      Authorization: `Bearer ${ctx.token}`,
      'X-Stream-Id': ctx.sessionId,
      'X-Upload-Id': ctx.uploadId,
      'X-R2-Key': ctx.key,
      'X-Part-Number': String(partNumber),
    },
    body: buffer,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`upload part ${partNumber} ${res.status}: ${text}`);
  }
  const data = (await res.json()) as { etag?: string };
  if (!data.etag) throw new Error(`upload part ${partNumber}: missing etag`);
  return data.etag;
}

async function uploadPartWithRetry(
  buffer: ArrayBuffer,
  partNumber: number,
  ctx: { sessionId: string; key: string; uploadId: string; token: string },
): Promise<string> {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < MAX_RETRIES_PER_PART; attempt++) {
    try {
      return await uploadPartOnce(buffer, partNumber, ctx);
    } catch (err) {
      lastErr = err;
      const wait = Math.min(15000, 500 * Math.pow(2, attempt));
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('upload part failed');
}

export function createR2ChunkUploader(opts: CreateR2UploaderOptions): R2ChunkUploader {
  const { sessionId, contentType = 'video/webm' } = opts;

  let state: R2UploaderState = 'idle';
  let key: string | null = null;
  let uploadId: string | null = null;
  let token: string | null = null;

  let nextPartNumber = 1;
  const buffer: BlobPart[] = [];
  let bufferedBytes = 0;
  let uploadedBytes = 0;
  let partsUploaded = 0;
  let partsInFlight = 0;
  let lastError: string | null = null;

  const uploadedParts: R2UploadedPart[] = [];
  const inFlight = new Set<Promise<void>>();
  let abortRequested = false;

  const emit = () => {
    opts.onStatus?.(getStatus());
  };

  const getStatus = (): R2UploaderStatus => ({
    state,
    uploadedBytes,
    queuedBytes: bufferedBytes,
    partsUploaded,
    partsInFlight,
    lastError,
  });

  const flushPart = async (partBlob: Blob) => {
    if (!key || !uploadId || !token) throw new Error('uploader not started');
    const partNumber = nextPartNumber++;
    partsInFlight++;
    emit();
    try {
      const arrayBuf = await partBlob.arrayBuffer();
      const etag = await uploadPartWithRetry(arrayBuf, partNumber, {
        sessionId,
        key,
        uploadId,
        token,
      });
      uploadedParts.push({ partNumber, etag });
      uploadedBytes += partBlob.size;
      partsUploaded++;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown';
      lastError = message;
      state = 'failed';
      throw err;
    } finally {
      partsInFlight--;
      emit();
    }
  };

  const enqueueFlush = (partBlob: Blob) => {
    // Wait for a slot if at concurrency cap.
    const job = (async () => {
      while (inFlight.size >= MAX_CONCURRENCY) {
        await Promise.race(inFlight);
      }
      const p = flushPart(partBlob);
      inFlight.add(p as unknown as Promise<void>);
      try {
        await p;
      } finally {
        inFlight.delete(p as unknown as Promise<void>);
      }
    })();
    // Track top-level so finalize can await everything
    inFlight.add(job);
    job.finally(() => inFlight.delete(job));
  };

  const drainBufferIfReady = (force: boolean) => {
    if (state !== 'uploading' && state !== 'completing') return;
    if (abortRequested) return;
    if (!force && bufferedBytes < MIN_PART_BYTES) return;
    if (bufferedBytes === 0) return;
    const partBlob = new Blob(buffer, { type: contentType });
    buffer.length = 0;
    bufferedBytes = 0;
    enqueueFlush(partBlob);
  };

  return {
    async start() {
      if (state !== 'idle') return;
      state = 'starting';
      emit();
      try {
        token = await getAuthToken();
        const result = await postJson<{ key: string; upload_id: string }>(
          '/upload/live-part/init',
          { stream_id: sessionId, content_type: contentType },
          token,
        );
        key = result.key;
        uploadId = result.upload_id;
        state = 'uploading';
        emit();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'init failed';
        lastError = message;
        state = 'failed';
        emit();
        throw err;
      }
    },

    appendChunk(chunk: Blob) {
      if (!chunk || chunk.size === 0) return;
      if (state !== 'uploading') return;
      buffer.push(chunk);
      bufferedBytes += chunk.size;
      drainBufferIfReady(false);
    },

    async finalize(): Promise<R2FinalizeResult> {
      if (!key || !uploadId || !token) throw new Error('uploader not started');
      state = 'completing';
      emit();

      // Flush whatever is left (last part is allowed to be < 5 MiB)
      drainBufferIfReady(true);

      // Wait for all inflight to finish
      while (inFlight.size > 0) {
        await Promise.allSettled([...inFlight]);
      }

      if ((state as R2UploaderState) === 'failed') {
        throw new Error(lastError || 'one or more parts failed');
      }

      if (uploadedParts.length === 0) {
        throw new Error('no parts uploaded — nothing to finalize');
      }

      const result = await postJson<{ key: string; url: string; size: number }>(
        '/upload/live-part/complete',
        {
          stream_id: sessionId,
          key,
          upload_id: uploadId,
          parts: uploadedParts,
        },
        token,
      );

      state = 'completed';
      emit();
      return { ...result, partCount: uploadedParts.length };
    },

    async abort() {
      abortRequested = true;
      buffer.length = 0;
      bufferedBytes = 0;
      // Best-effort: wait briefly for in-flight to settle so abort doesn't race
      try {
        await Promise.race([
          Promise.allSettled([...inFlight]),
          new Promise((r) => setTimeout(r, 3000)),
        ]);
      } catch {
        // ignore
      }
      if (key && uploadId && token) {
        try {
          await postJson('/upload/live-part/abort', { stream_id: sessionId, key, upload_id: uploadId }, token);
        } catch (err) {
          console.warn('[r2ChunkUploader] abort failed:', err);
        }
      }
      state = 'aborted';
      emit();
    },

    getStatus,
    getKey: () => key,
  };
}
