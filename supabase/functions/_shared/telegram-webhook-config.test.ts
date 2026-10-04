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
  const required = ["message", "chat_member", "callback_query", "my_chat_member"];
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
    data: { ok: true, result: { url: urlWithQueryMarker, pending_update_count: 2, allowed_updates: ["message", "chat_member", "callback_query", "my_chat_member"] } },
  }, "https://example.invalid/functions/v1/telegram-community-webhook");

  assert.strictEqual(status.verified, true);
  if (!("missing_updates" in status)) throw new Error("expected verified webhook metadata");
  assert.strictEqual(status.endpoint_matches, true);
  assert.deepStrictEqual(status.missing_updates, []);
  assert.strictEqual(JSON.stringify(status).includes(urlWithQueryMarker), false);
  assert.strictEqual("url" in status, false);
});

Deno.test("failed getWebhookInfo remains unverified in the admin-safe response", () => {
  assert.deepStrictEqual(safeCommunityWebhookStatus({ ok: false, data: null }, "https://example.invalid/hook"), {
    verified: false,
    error_code: "telegram_api_rejected",
  });
  assert.deepStrictEqual(safeCommunityWebhookStatus({
    ok: true,
    data: { ok: true, result: { url: "https://example.invalid/hook", pending_update_count: 0, allowed_updates: [null] } },
  }, "https://example.invalid/hook"), {
    verified: false,
    error_code: "telegram_response_invalid",
  });
});

Deno.test("verification requires the matching endpoint and all required updates", () => {
  for (const [url, updates, expected] of [
    ["https://other.invalid/hook", COMMUNITY_WEBHOOK_ALLOWED_UPDATES, "endpoint_mismatch"],
    ["https://example.invalid/hook", [], "required_updates_missing"],
  ] as const) {
    const status = safeCommunityWebhookStatus({ ok: true, data: { ok: true, result: {
      url, pending_update_count: 0, allowed_updates: updates,
    } } }, "https://example.invalid/hook");
    assert.strictEqual(status.verified, false);
    assert.strictEqual(status.error_code, expected);
  }
});

Deno.test("primary bot invite source must be enabled for verified webhook readiness", () => {
  assert.deepStrictEqual(missingCommunityWebhookUpdates({ ...validWebhookInfo, result: {
    ...validWebhookInfo.result, allowed_updates: ["message", "chat_member", "callback_query"],
  } }), ["my_chat_member"]);
});
