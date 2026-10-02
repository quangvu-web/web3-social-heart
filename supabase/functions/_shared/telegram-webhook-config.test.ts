import assert from "npm:assert@2.1.0";
import {
  COMMUNITY_WEBHOOK_ALLOWED_UPDATES,
  missingCommunityWebhookUpdates,
} from "./telegram-webhook-config.ts";

Deno.test("webhook readiness requires chat_member and all handlers used by join verification", () => {
  assert.deepStrictEqual(missingCommunityWebhookUpdates([
    "message",
    "edited_message",
    "channel_post",
    "edited_channel_post",
    "callback_query",
    "my_chat_member",
  ]), ["chat_member"]);
  assert.deepStrictEqual(missingCommunityWebhookUpdates(COMMUNITY_WEBHOOK_ALLOWED_UPDATES), []);
});

Deno.test("a failed webhook info lookup does not authorize an automatic webhook change", () => {
  assert.strictEqual(missingCommunityWebhookUpdates(undefined), null);
});
