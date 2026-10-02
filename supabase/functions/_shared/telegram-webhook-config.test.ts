import assert from "npm:assert@2.1.0";
import {
  COMMUNITY_WEBHOOK_ALLOWED_UPDATES,
  missingCommunityWebhookUpdates,
  safeCommunityWebhookStatus,
} from "./telegram-webhook-config.ts";

const validWebhookInfo = {
  ok: true,
  result: { url: "https://example.invalid/hook", pending_update_count: 0 },
};

Deno.test("missing allowed_updates uses Telegram defaults and flags chat_member only", () => {
  assert.deepStrictEqual(missingCommunityWebhookUpdates(validWebhookInfo), ["chat_member"]);
  assert.deepStrictEqual(missingCommunityWebhookUpdates({ ...validWebhookInfo, result: { ...validWebhookInfo.result, allowed_updates: [] } }), ["chat_member"]);
});

Deno.test("each required update is reported when omitted", () => {
  const required = ["message", "chat_member", "callback_query"];
  for (const missing of required) {
    const actual = required.filter((update) => update !== missing);
    assert.deepStrictEqual(missingCommunityWebhookUpdates({ ...validWebhookInfo, result: { ...validWebhookInfo.result, allowed_updates: actual } }), [missing]);
  }
});

Deno.test("all required join and CAPTCHA updates are ready", () => {
  assert.deepStrictEqual(missingCommunityWebhookUpdates({ ...validWebhookInfo, result: { ...validWebhookInfo.result, allowed_updates: COMMUNITY_WEBHOOK_ALLOWED_UPDATES } }), []);
});

Deno.test("an API failure or invalid getWebhookInfo result remains unverified", () => {
  assert.strictEqual(missingCommunityWebhookUpdates({ ok: false, result: { allowed_updates: [] } }), null);
  assert.strictEqual(missingCommunityWebhookUpdates(null), null);
  assert.strictEqual(missingCommunityWebhookUpdates({ ok: true }), null);
  assert.strictEqual(missingCommunityWebhookUpdates({ ok: true, result: { allowed_updates: [] } }), null);
});

Deno.test("safe webhook status confirms update readiness without returning webhook URL", () => {
  const urlWithQueryMarker = "https://example.invalid/functions/v1/telegram-community-webhook?marker=fixture";
  const status = safeCommunityWebhookStatus({
    ok: true,
    data: { ok: true, result: { url: urlWithQueryMarker, pending_update_count: 2, allowed_updates: ["message", "chat_member", "callback_query"] } },
  }, "https://example.invalid/functions/v1/telegram-community-webhook");

  assert.strictEqual(status.verified, true);
  assert.strictEqual(status.endpoint_matches, true);
  assert.deepStrictEqual(status.missing_updates, []);
  assert.strictEqual(JSON.stringify(status).includes(urlWithQueryMarker), false);
  assert.strictEqual("url" in status, false);
});

Deno.test("failed getWebhookInfo remains unverified in the admin-safe response", () => {
  assert.deepStrictEqual(safeCommunityWebhookStatus({ ok: false, data: null }, "https://example.invalid/hook"), {
    verified: false,
    error_code: "telegram_api_error",
  });
  assert.deepStrictEqual(safeCommunityWebhookStatus({
    ok: true,
    data: { ok: true, result: { url: "https://example.invalid/hook", pending_update_count: 0, allowed_updates: [null] } },
  }, "https://example.invalid/hook"), {
    verified: false,
    error_code: "invalid_telegram_response",
  });
});
