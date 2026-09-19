import { describe, expect, test } from 'bun:test';
import { getTransformedImageUrl } from './imageTransform';

describe('getTransformedImageUrl', () => {
  test('keeps public R2 dev URLs unchanged', () => {
    const url = 'https://pub-example.r2.dev/posts/example.webp';

    expect(getTransformedImageUrl(url, { preset: 'post' })).toBe(url);
  });
});
