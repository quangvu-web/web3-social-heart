import { describe, expect, test } from 'bun:test';
import { normalizeMediaUrls } from './mediaNormalization';

const image = { url: 'https://assets.r2.dev/posts/photo.jpg', type: 'image' as const };

describe('normalizeMediaUrls', () => {
  test('keeps a valid Array', () => {
    expect(normalizeMediaUrls([image])).toEqual([image]);
  });

  test('parses a JSON string', () => {
    expect(normalizeMediaUrls(JSON.stringify([image]))).toEqual([image]);
  });

  test('returns an empty Array for null', () => {
    expect(normalizeMediaUrls(null)).toEqual([]);
  });

  test('drops malformed media data safely', () => {
    expect(normalizeMediaUrls([{ url: image.url }, { url: '', type: 'image' }, 'bad'])).toEqual([]);
  });
});
