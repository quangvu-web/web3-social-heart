import { describe, expect, test } from 'bun:test';
import type { UploadItem } from './uploadQueue';
import { buildMediaPayload, resolveCompletedMedia } from './uploadPayload';

const item = (overrides: Partial<UploadItem>): UploadItem => ({
  id: 'image-1',
  file: new File(['image'], 'photo.jpg', { type: 'image/jpeg' }),
  preview: 'blob:preview',
  type: 'image',
  status: 'queued',
  progress: 0,
  ...overrides,
});

describe('post media payload', () => {
  test('uses completed uploadItems when the queue ref is stale', () => {
    const completed = resolveCompletedMedia([
      item({ status: 'completed', progress: 100, url: 'https://assets.r2.dev/posts/photo.jpg' }),
    ], []);

    const mediaPayload = buildMediaPayload(completed);
    const postPayload = {
      content: 'Ảnh + text test',
      media_urls: mediaPayload.mediaUrls,
      image_url: mediaPayload.imageUrl,
    };

    expect(postPayload).toEqual({
      content: 'Ảnh + text test',
      media_urls: [{ url: 'https://assets.r2.dev/posts/photo.jpg', type: 'image' }],
      image_url: 'https://assets.r2.dev/posts/photo.jpg',
    });
  });

  test('excludes uploads that are not completed or have no URL', () => {
    expect(resolveCompletedMedia([
      item({ status: 'uploading', progress: 80 }),
      item({ id: 'image-2', status: 'completed', progress: 100 }),
    ])).toEqual([]);
  });
});
