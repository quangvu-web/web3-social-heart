export type TelegramRequestOutcome<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export function isTelegramApiSuccess(httpOk: boolean, payload: { ok?: unknown } | null): boolean {
  return httpOk && payload?.ok === true;
}

export function sanitizeTelegramTransportError(error: unknown, token: string | null): string {
  const raw = error instanceof Error ? `${error.name}: ${error.message}` : "Telegram transport failed";
  const withoutToken = token ? raw.replaceAll(token, "[REDACTED]") : raw;
  return withoutToken
    .replace(/(https?:\/\/api\.telegram\.org\/bot)[^/\s?]+/gi, "$1[REDACTED]")
    .replace(/([?&](?:secret|token|key)=)[^&\s]+/gi, "$1[REDACTED]")
    .slice(0, 240);
}

export async function captureTelegramRequest<T>(
  request: () => Promise<T>,
  token: string | null,
): Promise<TelegramRequestOutcome<T>> {
  try {
    return { ok: true, value: await request() };
  } catch (error) {
    return { ok: false, error: sanitizeTelegramTransportError(error, token) };
  }
}
