type GoogleTelegramStartResponse = {
  success?: boolean;
  requires_telegram_2fa?: boolean;
  challenge_id?: unknown;
  user_id?: unknown;
};

export type GoogleTelegramStartResult =
  | { kind: 'challenge'; challengeId: string }
  | { kind: 'skip' }
  | { kind: 'error' };

export function parseGoogleTelegramStartResponse(
  response: GoogleTelegramStartResponse | null | undefined,
  userId: string,
): GoogleTelegramStartResult {
  if (!response?.success) return { kind: 'error' };

  if (response.requires_telegram_2fa === false) return { kind: 'skip' };

  if (
    response.requires_telegram_2fa === true
    && typeof response.challenge_id === 'string'
    && response.challenge_id.length > 0
    && response.user_id === userId
  ) {
    return { kind: 'challenge', challengeId: response.challenge_id };
  }

  return { kind: 'error' };
}

export function getGoogleTelegramStartErrorMessage(status?: number): string {
  switch (status) {
    case 401:
      return 'Phiên đăng nhập Google không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.';
    case 429:
      return 'Đã gửi quá nhiều mã Telegram. Vui lòng chờ trước khi thử lại.';
    case 500:
      return 'Máy chủ chưa thể gửi mã Telegram. Vui lòng thử lại sau.';
    default:
      return 'Không thể bắt đầu xác thực Telegram. Vui lòng đăng nhập lại.';
  }
}

export function getFunctionHttpStatus(error: unknown): number | undefined {
  if (
    typeof error === 'object'
    && error !== null
    && 'context' in error
    && (error as { context?: unknown }).context instanceof Response
  ) {
    return (error as { context: Response }).context.status;
  }

  return undefined;
}
