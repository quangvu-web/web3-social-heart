import { APP_BUILT_AT, APP_VERSION } from '@/generated/appVersion';

export type AppErrorCode =
  | 'bootstrap_timeout'
  | 'render_error'
  | 'route_chunk_error'
  | 'auth_bootstrap_error'
  | 'version_update'
  | 'unknown_error';

export interface AppErrorDetails {
  code?: AppErrorCode | string;
  message?: string;
  stack?: string;
  url?: string;
  appVersion?: string;
  builtAt?: string;
  browser?: string;
  timestamp?: string;
}

export function currentAppVersion() {
  return {
    version: APP_VERSION,
    builtAt: APP_BUILT_AT,
  };
}

export function buildAppErrorDetails(input: Partial<AppErrorDetails> = {}): AppErrorDetails {
  return {
    code: input.code || 'unknown_error',
    message: input.message,
    stack: import.meta.env.DEV ? input.stack : undefined,
    url: typeof window !== 'undefined' ? window.location.href : input.url,
    appVersion: APP_VERSION,
    builtAt: APP_BUILT_AT,
    browser: typeof navigator !== 'undefined' ? navigator.userAgent : input.browser,
    timestamp: new Date().toISOString(),
  };
}

export function reloadApp() {
  window.location.reload();
}

export async function clearAppCaches() {
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  }
  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  }
}

export async function clearCachesAndReload() {
  try {
    await clearAppCaches();
  } finally {
    window.location.reload();
  }
}

export async function copyErrorDetails(details: AppErrorDetails) {
  const text = JSON.stringify(details, null, 2);
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

export function reportTechnicalIssue(details: AppErrorDetails) {
  const subject = encodeURIComponent('FUN Profile technical error');
  const body = encodeURIComponent(JSON.stringify(details, null, 2));
  window.location.href = `mailto:support@fun.rich?subject=${subject}&body=${body}`;
}

export function isChunkLoadError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '');
  return /Loading chunk|dynamically imported module|Failed to fetch dynamically imported module|Importing a module script failed|vite:preloadError/i.test(message);
}
