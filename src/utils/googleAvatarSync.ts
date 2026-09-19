interface GoogleAvatarSyncInput {
  profileAvatarUrl: string | null | undefined;
  provider: unknown;
  providers?: unknown;
  userMetadata: Record<string, unknown> | null | undefined;
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/** Return a Google avatar only when it can safely fill an empty profile avatar. */
export function getGoogleAvatarToSync({
  profileAvatarUrl,
  provider,
  providers,
  userMetadata,
}: GoogleAvatarSyncInput): string | null {
  if (nonEmptyString(profileAvatarUrl)) return null;

  const hasGoogleProvider = provider === 'google'
    || (Array.isArray(providers) && providers.includes('google'));
  if (!hasGoogleProvider || !userMetadata) return null;

  return nonEmptyString(userMetadata.avatar_url)
    || nonEmptyString(userMetadata.picture);
}
