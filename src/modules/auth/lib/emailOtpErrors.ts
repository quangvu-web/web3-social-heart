import type { TranslationKey } from '@/i18n/translations';

/** Only allow known public errors onto the UI. Never display backend text. */
export async function emailOtpErrorKey(error: unknown, data?: unknown, phase: 'send' | 'verify' = 'send'): Promise<TranslationKey> {
  let status: number | undefined;
  let body = data;
  if (error && typeof error === 'object' && 'context' in error && error.context instanceof Response) {
    status = error.context.status;
    try { body = await error.context.clone().json(); } catch { /* Non-JSON gateway response. */ }
  }
  if (status === 429) return phase === 'send' ? 'otpRateLimited' : 'otpVerifyRateLimited';
  const payload = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  if (payload.error_code === 'email_delivery_failed' || payload.email_sent === false) return 'otpEmailNotDelivered';
  if (status && status !== 400) return 'otpServiceUnavailable';
  switch (payload.error_code ?? payload.error) {
    case 'rate_limited': return phase === 'send' ? 'otpRateLimited' : 'otpVerifyRateLimited';
    case 'invalid_email':
    case 'Invalid email format':
    case 'Identifier is required (email or phone)': return 'authErrorInvalidEmail';
    case 'invalid_otp':
    case 'Invalid OTP code': return 'otpInvalid';
    case 'otp_expired':
    case 'OTP expired or not found. Please request a new one.': return 'otpExpired';
    default: return 'otpServiceUnavailable';
  }
}
