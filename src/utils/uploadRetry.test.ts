import { expect, test } from 'bun:test';
import { retryUploadOperation } from './uploadRetry';

test('retries a transient upload failure and returns the eventual result', async () => {
  let attempts = 0;

  const result = await retryUploadOperation(async () => {
    attempts += 1;
    if (attempts < 2) throw new TypeError('Failed to fetch');
    return 'uploaded';
  }, { maxAttempts: 2, delayMs: 0 });

  expect(result).toBe('uploaded');
  expect(attempts).toBe(2);
});

test('does not retry a server validation error', async () => {
  let attempts = 0;

  await expect(retryUploadOperation(async () => {
    attempts += 1;
    throw new Error('File type not allowed');
  }, { maxAttempts: 3, delayMs: 0 })).rejects.toThrow('File type not allowed');

  expect(attempts).toBe(1);
});
