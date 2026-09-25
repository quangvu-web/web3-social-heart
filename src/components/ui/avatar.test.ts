import { describe, expect, test } from 'bun:test';
import { DEFAULT_AVATAR_SRC, resolveAvatarImageSource } from './avatar';
import { getAvatarUrl } from '@/lib/imageTransform';

describe('resolveAvatarImageSource', () => {
  test('keeps a real uploaded avatar URL', () => {
    const uploadedAvatar = 'https://media.fun.rich/avatars/uploaded.webp';

    expect(resolveAvatarImageSource(uploadedAvatar)).toBe(uploadedAvatar);
  });

  test('uses the FUN Profile logo when the avatar URL is empty', () => {
    expect(resolveAvatarImageSource('')).toBe(DEFAULT_AVATAR_SRC);
  });

  test('uses the FUN Profile logo for an invalid avatar URL', () => {
    expect(resolveAvatarImageSource('not a URL')).toBe(DEFAULT_AVATAR_SRC);
  });

  test('keeps a Google avatar URL', () => {
    const googleAvatar = 'https://lh3.googleusercontent.com/a/google-avatar';

    expect(resolveAvatarImageSource(googleAvatar)).toBe(googleAvatar);
  });

  test('does not transform the static FUN Profile logo', () => {
    expect(getAvatarUrl(DEFAULT_AVATAR_SRC)).toBe(DEFAULT_AVATAR_SRC);
  });
});
