import { expect, test } from "bun:test";
import { requestWebhookDiagnostic, webhookDiagnosticView } from "./telegramWebhookDiagnostic";
const valid = { verified: true, response_valid: true, endpoint_matches: true, pending_update_count: 0,
  allowed_updates: ["message", "chat_member", "callback_query"] };
test("registration and verification have separate UI outcomes", () => {
  const failed = webhookDiagnosticView({ registration: "failed", stage: "set_webhook", code: "telegram_api_rejected" }, true);
  expect(failed.state).toBe("error"); expect(failed.message).toContain("Đăng ký thất bại");
  const unverified = webhookDiagnosticView({ registration: "accepted", stage: "get_webhook_info", code: "webhook_registered_unverified", cause_code: "telegram_transport_failed" }, true);
  expect(unverified.state).toBe("unverified"); expect(unverified.message).toContain("đã được gửi nhưng chưa xác minh");
  expect(unverified.message).toContain("Đọc trạng thái Telegram");
  expect(webhookDiagnosticView({ registration: "accepted", webhook: valid }, true).state).toBe("verified");
});
test("valid response with wrong endpoint or missing updates stays unverified", () => {
  for (const [override, code] of [[{ endpoint_matches: false }, "endpoint_mismatch"], [{ allowed_updates: [] }, "required_updates_missing"]] as const) {
    const result = webhookDiagnosticView({ webhook: { ...valid, ...override }, code, stage: "verify_webhook" });
    expect(result.state).toBe("unverified"); expect(result.webhook?.response_valid).toBe(true);
    expect(result.message).toContain(code);
  }
});
test("UI messages expose only allowlisted codes and no raw errors", async () => {
  const secret = "secret-fixture-url-token";
  const malformed = webhookDiagnosticView({ code: secret, stage: secret, error: secret, webhook: { url: secret } });
  expect(JSON.stringify(malformed)).not.toContain(secret);
  const rejected = await requestWebhookDiagnostic(() => Promise.reject(new Error(secret)), true);
  expect(rejected.state).toBe("error"); expect(rejected.message).toContain("admin_request_failed");
  expect(JSON.stringify(rejected)).not.toContain(secret);
  const http = await requestWebhookDiagnostic(async () => ({ data: null, error: { message: secret, context: Response.json({ code: "bot_token_missing", stage: "preflight", raw: secret }, { status: 500 }) } }));
  expect(http.message).toContain("bot_token_missing"); expect(JSON.stringify(http)).not.toContain(secret);
});
test("old backend cannot accidentally claim verified", () => {
  expect(webhookDiagnosticView({ success: true, webhook: { verified: true } }).state).toBe("error");
  expect(webhookDiagnosticView({ success: true, webhook: { ...valid, allowed_updates: undefined } }).state).toBe("unverified");
});

test("configuration, transport and API failures retain safe stage and Vietnamese guidance", () => {
  for (const code of ["bot_token_missing", "webhook_secret_missing", "telegram_transport_failed", "telegram_api_rejected", "telegram_response_invalid"]) {
    const view = webhookDiagnosticView({ code, stage: "get_webhook_info" });
    expect(view.state).toBe("error"); expect(view.message).toContain(code);
    expect(view.message).toContain("Đọc trạng thái Telegram");
  }
});
