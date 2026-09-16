import { Buffer } from 'buffer';

type TsEbml = typeof import('ts-ebml');

async function loadEbml(): Promise<TsEbml> {
  const globalWithBuffer = globalThis as typeof globalThis & { Buffer?: typeof Buffer };
  if (!globalWithBuffer.Buffer) {
    globalWithBuffer.Buffer = Buffer;
  }
  return import('ts-ebml');
}

export interface FinalizedWebm {
  blob: Blob;
  durationSeconds: number | null;
}

export async function finalizeWebmDuration(blob: Blob): Promise<FinalizedWebm> {
  if (!blob || blob.size === 0) {
    throw new Error('Video recording is empty');
  }

  const buffer = await blob.arrayBuffer();
  const fallback = (): FinalizedWebm => ({
    blob: new Blob([buffer], { type: blob.type || 'video/webm' }),
    durationSeconds: null,
  });

  try {
    const ebml = await loadEbml();
    const decoder = new ebml.Decoder();
    const reader = new ebml.Reader();
    reader.logging = false;
    reader.drop_default_duration = false;

    // ts-ebml expects a Node Buffer, not a raw ArrayBuffer (Buffer adds readVint etc.)
    const nodeBuffer = Buffer.from(buffer);
    const elements = decoder.decode(nodeBuffer as unknown as ArrayBuffer);
    elements.forEach((element) => reader.read(element));
    reader.stop();

    const duration = reader.duration;
    const durationSeconds =
      Number.isFinite(duration) && duration > 0
        ? (duration * reader.timestampScale) / 1_000_000_000
        : null;

    if (!reader.metadatas?.length || !reader.cues?.length || !durationSeconds) {
      return { blob: new Blob([buffer], { type: blob.type || 'video/webm' }), durationSeconds };
    }

    const metadata = ebml.tools.makeMetadataSeekable(reader.metadatas, duration, reader.cues);
    const body = buffer.slice(reader.metadataSize);
    return {
      blob: new Blob([metadata, body], { type: blob.type || 'video/webm' }),
      durationSeconds,
    };
  } catch (err) {
    console.warn('[finalizeWebmDuration] ts-ebml failed, uploading raw blob', err);
    return fallback();
  }
}
