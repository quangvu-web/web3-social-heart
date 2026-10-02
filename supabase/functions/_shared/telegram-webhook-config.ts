export const COMMUNITY_WEBHOOK_ALLOWED_UPDATES = [
  "message",
  "edited_message",
  "channel_post",
  "edited_channel_post",
  "callback_query",
  "chat_member",
  "my_chat_member",
] as const;

export function missingCommunityWebhookUpdates(allowedUpdates: unknown): string[] | null {
  if (!Array.isArray(allowedUpdates)) return null;
  const actual = allowedUpdates.filter((update): update is string => typeof update === "string");
  return COMMUNITY_WEBHOOK_ALLOWED_UPDATES.filter((update) => !actual.includes(update));
}
