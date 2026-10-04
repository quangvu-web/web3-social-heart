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
  if (typeof result.url !== "string" || (typeof result.pending_update_count !== "number" || !Number.isSafeInteger(result.pending_update_count) || result.pending_update_count < 0)) return null;
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
    return { verified: false, error_code: "telegram_api_rejected" } as const;
  }
  const response = body as { ok?: unknown; result?: unknown };
  if (response.ok !== true || !response.result || typeof response.result !== "object") {
    return { verified: false, error_code: "telegram_response_invalid" } as const;
  }
  const result = response.result as {
    url?: unknown;
    pending_update_count?: unknown;
    allowed_updates?: unknown;
    last_error_date?: unknown;
    last_error_message?: unknown;
  };
  if (typeof result.url !== "string" || (typeof result.pending_update_count !== "number" || !Number.isSafeInteger(result.pending_update_count) || result.pending_update_count < 0)) {
    return { verified: false, error_code: "telegram_response_invalid" } as const;
  }
  if (result.allowed_updates !== undefined && !Array.isArray(result.allowed_updates)) {
    return { verified: false, error_code: "telegram_response_invalid" } as const;
  }
  if (Array.isArray(result.allowed_updates) && result.allowed_updates.some((update) => typeof update !== "string")) {
    return { verified: false, error_code: "telegram_response_invalid" } as const;
  }
  let endpointMatches = false;
  try {
    const actual = new URL(result.url);
    const expected = new URL(expectedEndpoint);
    endpointMatches = actual.origin === expected.origin && actual.pathname === expected.pathname
      && !actual.username && !actual.password && !actual.hash;
  } catch {
    if (result.url !== "") return { verified: false, error_code: "telegram_response_invalid" } as const;
    // Empty means no webhook configured; report mismatch without exposing URLs.
  }
  const missing = missingCommunityWebhookUpdates(body)!;
  return {
    verified: endpointMatches && missing.length === 0,
    response_valid: true,
    error_code: !endpointMatches ? "endpoint_mismatch" : missing.length ? "required_updates_missing" : undefined,
    endpoint_matches: endpointMatches,
    pending_update_count: result.pending_update_count,
    last_error_date: typeof result.last_error_date === "number" ? result.last_error_date : null,
    has_last_error: typeof result.last_error_message === "string" && result.last_error_message.length > 0,
    missing_updates: missing,
    ...(Array.isArray(result.allowed_updates)
      ? { allowed_updates: (result.allowed_updates as string[]).map((update) => (COMMUNITY_WEBHOOK_ALLOWED_UPDATES as readonly string[]).includes(update) ? update : "other_update") }
      : {}),
  } as const;
}
