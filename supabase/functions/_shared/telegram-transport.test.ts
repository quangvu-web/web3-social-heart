import assert from "npm:assert@2.1.0";
import { captureTelegramRequest, isTelegramApiSuccess, welcomeLogAction } from "./telegram-transport.ts";

Deno.test("Telegram transport failures are returned safely without token or webhook query secrets", async () => {
  const testToken = "123456:fake-test-token";
  const outcome = await captureTelegramRequest(
    async () => {
      throw new TypeError(`request failed at https://api.telegram.org/bot${testToken}/sendMessage?secret=fake-secret`);
    },
    testToken,
  );

  assert.deepStrictEqual(outcome.ok, false);
  if (outcome.ok) return;
  assert.strictEqual(outcome.error.includes(testToken), false);
  assert.strictEqual(outcome.error.includes("fake-secret"), false);
  assert.match(outcome.error, /\[REDACTED\]/);
});

Deno.test("a Telegram HTTP 2xx response is successful only when the Bot API payload says ok true", () => {
  assert.strictEqual(isTelegramApiSuccess(true, { ok: true }), true);
  assert.strictEqual(isTelegramApiSuccess(true, {}), false);
  assert.strictEqual(isTelegramApiSuccess(true, null), false);
  assert.strictEqual(isTelegramApiSuccess(false, { ok: true }), false);
});

Deno.test("welcome success is logged only for a confirmed Telegram Bot API success", () => {
  assert.strictEqual(welcomeLogAction(isTelegramApiSuccess(true, { ok: true })), "welcome_sent");
  assert.strictEqual(welcomeLogAction(isTelegramApiSuccess(true, {})), "welcome_send_failed");
  assert.strictEqual(welcomeLogAction(isTelegramApiSuccess(false, { ok: true })), "welcome_send_failed");
});
