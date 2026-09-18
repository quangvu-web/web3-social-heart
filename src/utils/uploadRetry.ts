export interface UploadRetryOptions {
  maxAttempts?: number;
  delayMs?: number;
}

function isRetryableUploadError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') return false;
  if (error instanceof TypeError) return true;
  if (error instanceof Error && /failed to fetch|network|timed out|timeout|HTTP 5\d\d/i.test(error.message)) {
    return true;
  }
  return false;
}

export async function retryUploadOperation<T>(
  operation: () => Promise<T>,
  options: UploadRetryOptions = {},
): Promise<T> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? 2);
  const delayMs = Math.max(0, options.delayMs ?? 500);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxAttempts || !isRetryableUploadError(error)) throw error;
      if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error('Upload failed');
}
