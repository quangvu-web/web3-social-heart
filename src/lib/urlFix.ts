export const R2_NEW_PUBLIC_URL = 'https://pub-fe745f8832684f4198a9b0e88e8d451a.r2.dev';

/**
 * Temporary safety net until CLOUDFLARE_R2_PUBLIC_URL is corrected.
 * If a chat attachment is returned with the old media.fun.rich domain for
 * comment-media paths, rewrite to the new public R2 bucket.
 */
export function rewriteChatAttachmentUrl(url: string): string {
  if (!url) return url;

  try {
    const parsed = new URL(url);
    if (parsed.origin === 'https://media.fun.rich' && parsed.pathname.includes('/comment-media/')) {
      return `${R2_NEW_PUBLIC_URL}${parsed.pathname}`;
    }
  } catch {
    return url;
  }

  return url;
}
