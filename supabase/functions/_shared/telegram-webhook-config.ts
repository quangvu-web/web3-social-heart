export const COMMUNITY_WEBHOOK_ALLOWED_UPDATES = [
  "message",
  "edited_message",
  "channel_post",
  "edited_channel_post",
  "callback_query",
  "chat_member",
  "my_chat_member",
] as const;

const REQUIRED_JOIN_UPDATES = ["message", "chat_member", "callback_query"] as const;

export function missingCommunityWebhookUpdates(webhookInfo: unknown): string[] | null {
  if (!webhookInfo || typeof webhookInfo !== "object") return null;
  const response = webhookInfo as { ok?: unknown; result?: unknown };
  if (response.ok !== true || !response.result || typeof response.result !== "object") return null;

  const result = response.result as { url?: unknown; pending_update_count?: unknown; allowed_updates?: unknown };
  if (typeof result.url !== "string" || typeof result.pending_update_count !== "number") return null;
  const allowedUpdates = result.allowed_updates;
  if (allowedUpdates === undefined || (Array.isArray(allowedUpdates) && allowedUpdates.length === 0)) {
    // Telegram's default includes message and callback_query, but excludes chat_member.
    return ["chat_member"];
  }
  if (!Array.isArray(allowedUpdates)) return null;

  const actual = allowedUpdates.filter((update): update is string => typeof update === "string");
  return REQUIRED_JOIN_UPDATES.filter((update) => !actual.includes(update));
}

export function safeCommunityWebhookStatus(
  telegramResponse: { ok: boolean; data?: unknown },
  expectedEndpoint: string,
) {
  const body = telegramResponse.data;
  if (!telegramResponse.ok || !body || typeof body !== "object") {
    return { verified: false, error_code: "telegram_api_error" } as const;
  }
  const response = body as { ok?: unknown; result?: unknown };
  if (response.ok !== true || !response.result || typeof response.result !== "object") {
    return { verified: false, error_code: "invalid_telegram_response" } as const;
  }
  const result = response.result as {
    url?: unknown;
    pending_update_count?: unknown;
    allowed_updates?: unknown;
    last_error_date?: unknown;
    last_error_message?: unknown;
  };
  if (typeof result.url !== "string" || typeof result.pending_update_count !== "number") {
    return { verified: false, error_code: "invalid_telegram_response" } as const;
  }
  if (result.allowed_updates !== undefined && !Array.isArray(result.allowed_updates)) {
    return { verified: false, error_code: "invalid_telegram_response" } as const;
  }
  if (Array.isArray(result.allowed_updates) && result.allowed_updates.some((update) => typeof update !== "string")) {
    return { verified: false, error_code: "invalid_telegram_response" } as const;
  }
  return {
    verified: true,
    endpoint_matches: result.url === expectedEndpoint || result.url.startsWith(`${expectedEndpoint}?`),
    pending_update_count: result.pending_update_count,
    last_error_date: typeof result.last_error_date === "number" ? result.last_error_date : null,
    has_last_error: typeof result.last_error_message === "string" && result.last_error_message.length > 0,
    missing_updates: missingCommunityWebhookUpdates(body),
    ...(Array.isArray(result.allowed_updates)
      ? { allowed_updates: result.allowed_updates as string[] }
      : {}),
  } as const;
}
