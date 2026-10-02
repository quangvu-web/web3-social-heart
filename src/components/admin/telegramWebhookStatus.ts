export const REQUIRED_JOIN_WEBHOOK_UPDATES = ["message", "chat_member", "callback_query"] as const;

export type WebhookUpdatesStatus = {
  state: "loading" | "unverified" | "missing" | "ready";
  missing: string[];
};

export function resolveWebhookUpdatesStatus(input: {
  loading: boolean;
  verified: boolean;
  allowedUpdates?: unknown;
}): WebhookUpdatesStatus {
  if (input.loading) return { state: "loading", missing: [] };
  if (!input.verified) return { state: "unverified", missing: [] };

  const allowedUpdates = input.allowedUpdates;
  const hasExplicitUpdateList = Array.isArray(allowedUpdates) && allowedUpdates.length > 0;
  const enabledUpdates = hasExplicitUpdateList
    ? allowedUpdates.filter((update): update is string => typeof update === "string")
    : REQUIRED_JOIN_WEBHOOK_UPDATES.filter((update) => update !== "chat_member");
  const missing = REQUIRED_JOIN_WEBHOOK_UPDATES.filter((update) => !enabledUpdates.includes(update));

  return { state: missing.length ? "missing" : "ready", missing };
}
