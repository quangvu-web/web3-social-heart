import { describe, expect, test } from 'bun:test';
import {
  getGoogleTelegramStartErrorMessage,
  parseGoogleTelegramStartResponse,
} from './googleTelegram2fa';

describe('parseGoogleTelegramStartResponse', () => {
  test('keeps Google sign-in blocked and opens the Telegram challenge only for a matching user', () => {
    expect(parseGoogleTelegramStartResponse({
      success: true,
      requires_telegram_2fa: true,
      challenge_id: 'challenge-1',
      user_id: 'user-1',
    }, 'user-1')).toEqual({ kind: 'challenge', challengeId: 'challenge-1' });
  });

  test('allows navigation only when the backend explicitly disables Telegram 2FA', () => {
    expect(parseGoogleTelegramStartResponse({
      success: true,
      requires_telegram_2fa: false,
    }, 'user-1')).toEqual({ kind: 'skip' });
  });

  test('rejects malformed or mismatched challenge responses', () => {
    expect(parseGoogleTelegramStartResponse({
      success: true,
      requires_telegram_2fa: true,
      challenge_id: 'challenge-1',
      user_id: 'another-user',
    }, 'user-1')).toEqual({ kind: 'error' });
  });
});

describe('getGoogleTelegramStartErrorMessage', () => {
  test.each([
    [401, 'Phiên đăng nhập Google không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.'],
    [429, 'Đã gửi quá nhiều mã Telegram. Vui lòng chờ trước khi thử lại.'],
    [500, 'Máy chủ chưa thể gửi mã Telegram. Vui lòng thử lại sau.'],
  ])('maps HTTP %i to a specific Vietnamese message', (status, message) => {
    expect(getGoogleTelegramStartErrorMessage(status)).toBe(message);
  });
});
