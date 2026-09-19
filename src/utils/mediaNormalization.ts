export type NormalizedMediaItem = {
  url: string;
  type: 'image' | 'video';
};

function isMediaItem(value: unknown): value is NormalizedMediaItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return typeof item.url === 'string' && item.url.trim().length > 0
    && (item.type === 'image' || item.type === 'video');
}

/** Normalize JSON/JSONB media values returned by Supabase into safe media items. */
export function normalizeMediaUrls(value: unknown): NormalizedMediaItem[] {
  let parsed: unknown = value;

  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(parsed)) return [];
  return parsed.filter(isMediaItem).map((item) => ({
    url: item.url.trim(),
    type: item.type,
  }));
}
