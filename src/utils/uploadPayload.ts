import type { UploadItem } from './uploadQueue';

export type CompletedMedia = { url: string; type: 'image' | 'video' };

/**
 * Resolve completed uploads from the latest React state, falling back to the
 * queue snapshot only for items that state has not observed yet.
 */
export function resolveCompletedMedia(
  uploadItems: UploadItem[],
  queueMedia: CompletedMedia[] = [],
): CompletedMedia[] {
  const stateMedia = uploadItems
    .filter((item) => item.status === 'completed' && Boolean(item.url))
    .map((item) => ({ url: item.url!, type: item.type }));

  const seen = new Set(stateMedia.map((media) => media.url));
  const fallbackMedia = queueMedia.filter((media) => !seen.has(media.url));

  return [...stateMedia, ...fallbackMedia];
}

export function buildMediaPayload(completedMedia: CompletedMedia[]) {
  const firstImage = completedMedia.find((media) => media.type === 'image');
  const firstVideo = completedMedia.find((media) => media.type === 'video');

  return {
    mediaUrls: completedMedia,
    imageUrl: firstImage?.url || null,
    videoUrl: firstVideo?.url || null,
  };
}
