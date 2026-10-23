export type FabPosition = { x: number; y: number };
export const FAB_POSITION_KEY = 'angel-fab-position';
export const FAB_SIZE = 56;
export const FAB_MARGIN = 8;
export const FAB_DRAG_THRESHOLD = 6;

export function clampFabPosition(position: FabPosition, width: number, height: number): FabPosition {
  return {
    x: Math.min(Math.max(FAB_MARGIN, position.x), Math.max(FAB_MARGIN, width - FAB_SIZE - FAB_MARGIN)),
    y: Math.min(Math.max(FAB_MARGIN, position.y), Math.max(FAB_MARGIN, height - FAB_SIZE - FAB_MARGIN)),
  };
}

export function loadFabPosition(storage: Pick<Storage, 'getItem'>, width: number, height: number): FabPosition | null {
  try {
    const raw = storage.getItem(FAB_POSITION_KEY);
    if (!raw) return null;
    const point = JSON.parse(raw);
    if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) return null;
    return clampFabPosition(point, width, height);
  } catch { return null; }
}

export function isCaptionGuest(path: string, user: unknown): boolean {
  return !user && path.startsWith('/captions/');
}