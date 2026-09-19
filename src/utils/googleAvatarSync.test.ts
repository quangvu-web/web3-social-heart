import { describe, expect, test } from 'bun:test';
import { getGoogleAvatarToSync } from './googleAvatarSync';

describe('getGoogleAvatarToSync', () => {
  test('uses Google avatar_url when the profile has no avatar', () => {
    expect(getGoogleAvatarToSync({
      profileAvatarUrl: null,
      provider: 'google',
      userMetadata: { avatar_url: 'https://lh3.googleusercontent.com/avatar-a' },
    })).toBe('https://lh3.googleusercontent.com/avatar-a');
  });

  test('falls back to Google picture when avatar_url is unavailable', () => {
    expect(getGoogleAvatarToSync({
      profileAvatarUrl: null,
      provider: 'google',
      userMetadata: { picture: 'https://lh3.googleusercontent.com/avatar-b' },
    })).toBe('https://lh3.googleusercontent.com/avatar-b');
  });

  test('uses Google metadata when Google is a linked provider', () => {
    expect(getGoogleAvatarToSync({
      profileAvatarUrl: null,
      provider: 'email',
      providers: ['email', 'google'],
      userMetadata: { picture: 'https://lh3.googleusercontent.com/linked-avatar' },
    })).toBe('https://lh3.googleusercontent.com/linked-avatar');
  });

  test('does not overwrite an avatar already chosen by the user', () => {
    expect(getGoogleAvatarToSync({
      profileAvatarUrl: 'https://cdn.example.com/custom-avatar.jpg',
      provider: 'google',
      userMetadata: { avatar_url: 'https://lh3.googleusercontent.com/google-avatar' },
    })).toBeNull();
  });

  test('does not copy metadata from a non-Google sign-in', () => {
    expect(getGoogleAvatarToSync({
      profileAvatarUrl: null,
      provider: 'email',
      providers: ['email'],
      userMetadata: { avatar_url: 'https://example.com/untrusted-avatar.jpg' },
    })).toBeNull();
  });
});
