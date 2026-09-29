export interface TelegramWebhookInfo {
  url?: string;
  pending_update_count?: number;
  last_error_date?: number;
  last_error_message?: string;
}

export type TelegramWebhookState = "unverified" | "monitor" | "error";

export interface TelegramWebhookStatus {
  state: TelegramWebhookState;
  reason: "unavailable" | "missing_url" | "wrong_target" | "recent_delivery_error" | "reply_unverified";
  hasHistoricalError: boolean;
}

const SAFE_WEBHOOK_PATHS = new Set([
  "/functions/v1/telegram-community-webhook",
  "/functions/v1/telegram-webhook",
]);
const RECENT_ERROR_WINDOW_MS = 10 * 60 * 1000;

export function sanitizeWebhookUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    const safeOrigin = url.origin;
    if (!SAFE_WEBHOOK_PATHS.has(url.pathname)) return `${safeOrigin}/…`;
    return `${safeOrigin}${url.pathname}`;
  } catch {
    return "Webhook URL đã được ẩn";
  }
}

export function getTelegramWebhookStatus(
  info: TelegramWebhookInfo | null | undefined,
  expectedUrl: string,
  nowMs = Date.now(),
): TelegramWebhookStatus {
  if (!info) return { state: "unverified", reason: "unavailable", hasHistoricalError: false };
  if (!info.url) return { state: "error", reason: "missing_url", hasHistoricalError: false };
  if (sanitizeWebhookUrl(info.url) !== sanitizeWebhookUrl(expectedUrl)) {
    return { state: "error", reason: "wrong_target", hasHistoricalError: Boolean(info.last_error_message) };
  }

  const hasHistoricalError = Boolean(info.last_error_date || info.last_error_message);
  const ageMs = info.last_error_date ? nowMs - info.last_error_date * 1000 : Number.POSITIVE_INFINITY;
  if (hasHistoricalError && ageMs >= 0 && ageMs <= RECENT_ERROR_WINDOW_MS) {
    return { state: "error", reason: "recent_delivery_error", hasHistoricalError: true };
  }

  // URL đúng đích và không có lỗi gần đây vẫn chưa chứng minh bot đã gửi phản hồi.
  return { state: "monitor", reason: "reply_unverified", hasHistoricalError };
}
