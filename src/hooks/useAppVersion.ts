import { useCallback, useEffect, useState } from 'react';
import { currentAppVersion, clearCachesAndReload } from '@/lib/appRecovery';

interface VersionPayload {
  version?: string;
  builtAt?: string;
}

export function useAppVersion() {
  const current = currentAppVersion();
  const [latest, setLatest] = useState<VersionPayload | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [preloadError, setPreloadError] = useState<Error | null>(null);

  const checkVersion = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch(`/version.json?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (!response.ok) return false;
      const next = (await response.json()) as VersionPayload;
      if (!next.version) return false;
      setLatest(next);
      const hasUpdate = Boolean(
        current.version && current.version !== 'dev' && next.version !== current.version,
      );
      if (hasUpdate) setUpdateAvailable(true);
      return hasUpdate;
    } catch (error) {
      console.warn('[version] check failed', error);
      return false;
    }
  }, [current.version]);

  useEffect(() => {
    checkVersion().catch(() => undefined);
    const timer = window.setInterval(() => {
      checkVersion().catch(() => undefined);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [checkVersion]);

  useEffect(() => {
    const handlePreloadError = (event: Event) => {
      event.preventDefault();
      const payload = event as Event & { payload?: Error };
      const error = payload.payload || new Error('vite preload error');
      console.warn('[vite] preload error', error);
      setPreloadError(error);
      setUpdateAvailable(true);
    };

    window.addEventListener('vite:preloadError', handlePreloadError);
    return () => window.removeEventListener('vite:preloadError', handlePreloadError);
  }, []);

  return {
    current,
    latest,
    updateAvailable,
    preloadError,
    checkNow: checkVersion,
    dismissUpdate: () => setUpdateAvailable(false),
    updateNow: () => void clearCachesAndReload(),
  };
}
