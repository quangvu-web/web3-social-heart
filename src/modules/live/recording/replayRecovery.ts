const DB_NAME = 'fun-live-replay-recovery';
const DB_VERSION = 1;
const CHUNKS_STORE = 'chunks';
const FINAL_STORE = 'finalized';

type ChunkRecord = {
  sessionId: string;
  sequence: number;
  blob: Blob;
  createdAt: number;
};

type FinalRecord = {
  sessionId: string;
  blob: Blob;
  mimeType: string;
  size: number;
  durationSeconds: number | null;
  replayId?: string;
  createdAt: number;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(CHUNKS_STORE)) {
        db.createObjectStore(CHUNKS_STORE, { keyPath: ['sessionId', 'sequence'] });
      }
      if (!db.objectStoreNames.contains(FINAL_STORE)) {
        db.createObjectStore(FINAL_STORE, { keyPath: 'sessionId' });
      }
    };
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
  });
}

async function write<T>(storeName: string, value: T): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  }).finally(() => db.close());
}

export async function saveReplayChunk(sessionId: string, sequence: number, blob: Blob): Promise<void> {
  if (!sessionId || !blob.size) return;
  await write<ChunkRecord>(CHUNKS_STORE, { sessionId, sequence, blob, createdAt: Date.now() });
}

export async function saveFinalizedReplay(record: Omit<FinalRecord, 'createdAt'>): Promise<void> {
  await write<FinalRecord>(FINAL_STORE, { ...record, createdAt: Date.now() });
}

export async function deleteReplayRecovery(sessionId: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([CHUNKS_STORE, FINAL_STORE], 'readwrite');
    tx.objectStore(FINAL_STORE).delete(sessionId);
    const chunks = tx.objectStore(CHUNKS_STORE);
    const req = chunks.openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return;
      const value = cursor.value as ChunkRecord;
      if (value.sessionId === sessionId) cursor.delete();
      cursor.continue();
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  }).finally(() => db.close());
}
