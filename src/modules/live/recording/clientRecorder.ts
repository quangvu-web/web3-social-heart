export type RecorderState =
  | 'idle'
  | 'starting'
  | 'recording'
  | 'stopping'
  | 'stopped'
  | 'failed';

export interface CreateRecorderOptions {
  timesliceMs?: number;
  videoBitsPerSecond?: number;
  audioBitsPerSecond?: number;
  onStateChange?: (state: RecorderState) => void;
  onChunk?: (chunk: Blob, sequence: number) => void;
  onError?: (error: unknown) => void;
}

export interface RecorderController {
  start: () => void;
  stop: () => Promise<Blob>;
  getBlob: () => Blob | null;
  getMimeType: () => string;
  getSize: () => number;
  getState: () => RecorderState;
}

const DEFAULT_TIMESLICE_MS = 15_000;
const DEFAULT_VIDEO_BPS = 1_500_000; // 1.5 Mbps – good quality for replay
const DEFAULT_AUDIO_BPS = 64_000;    // 64 kbps
const MIME_CANDIDATES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
  'video/mp4',
];

export function getSupportedRecordingMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') {
    return null;
  }

  for (const mimeType of MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      return mimeType;
    }
  }

  return null;
}

export function canRecordLiveReplay(): boolean {
  return !!getSupportedRecordingMimeType();
}

function resolveMimeType(): string {
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('MediaRecorder is not supported in this browser');
  }

  const mimeType = getSupportedRecordingMimeType();
  if (mimeType) return mimeType;

  throw new Error('No supported recording mime type found');
}

export function createRecorder(
  stream: MediaStream,
  opts: CreateRecorderOptions = {}
): RecorderController {
  const mimeType = resolveMimeType();
  const timesliceMs = opts.timesliceMs ?? DEFAULT_TIMESLICE_MS;
  const videoBitsPerSecond = opts.videoBitsPerSecond ?? DEFAULT_VIDEO_BPS;
  const audioBitsPerSecond = opts.audioBitsPerSecond ?? DEFAULT_AUDIO_BPS;
  const chunks: BlobPart[] = [];
  let blob: Blob | null = null;
  let size = 0;
  let state: RecorderState = 'idle';
  let sequence = 1;

  const setState = (nextState: RecorderState) => {
    state = nextState;
    opts.onStateChange?.(nextState);
  };

  let mediaRecorder: MediaRecorder;
  try {
    mediaRecorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond, audioBitsPerSecond });
  } catch (error) {
    setState('failed');
    opts.onError?.(error);
    throw error;
  }

  mediaRecorder.ondataavailable = (event: BlobEvent) => {
    if (!event.data || event.data.size === 0) return;
    chunks.push(event.data);
    size += event.data.size;
    opts.onChunk?.(event.data, sequence);
    sequence += 1;
  };

  mediaRecorder.onerror = (event) => {
    setState('failed');
    opts.onError?.(event);
  };

  return {
    start: () => {
      if (mediaRecorder.state !== 'inactive') return;
      setState('starting');
      blob = null;
      size = 0;
      sequence = 1;
      chunks.length = 0;

      try {
        mediaRecorder.start(timesliceMs);
        setState('recording');
      } catch (error) {
        setState('failed');
        opts.onError?.(error);
      }
    },
    stop: () =>
      new Promise<Blob>((resolve, reject) => {
        if (mediaRecorder.state === 'inactive') {
          if (blob) return resolve(blob);
          const emptyBlob = new Blob(chunks, { type: mimeType });
          blob = emptyBlob;
          setState('stopped');
          return resolve(emptyBlob);
        }

        setState('stopping');

        mediaRecorder.onstop = () => {
          blob = new Blob(chunks, { type: mimeType });
          setState('stopped');
          resolve(blob);
        };

        try {
          mediaRecorder.stop();
        } catch (error) {
          setState('failed');
          opts.onError?.(error);
          reject(error);
        }
      }),
    getBlob: () => blob,
    getMimeType: () => mimeType,
    getSize: () => size,
    getState: () => state,
  };
}
