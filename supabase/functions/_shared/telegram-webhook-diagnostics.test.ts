import assert from "npm:assert@2.1.0";
import { diagnoseCommunityWebhook } from "./telegram-webhook-diagnostics.ts";
const endpoint = "https://fixture.invalid/functions/v1/telegram-community-webhook";
const marker = "NEVER_OUTPUT_FIXTURE_SECRET";
const info = (overrides = {}) => ({ ok: true, result: { url: `${endpoint}?secret=${marker}`,
  pending_update_count: 0, allowed_updates: ["message", "chat_member", "callback_query", "my_chat_member"], ...overrides } });
function harness(replies: (Response | Error)[], action: "get_webhook_info" | "register_webhook" = "get_webhook_info") {
  const calls: { method: string; body: Record<string, unknown> }[] = [];
  const logs: unknown[] = [];
  return { calls, logs, run: (extra = {}) => diagnoseCommunityWebhook({ action, token: marker, secret: marker,
    backendUrl: "https://fixture.invalid", log: (e) => logs.push(e),
    fetcher: (url, init) => {
      calls.push({ method: String(url).split('/').pop()!, body: JSON.parse(String(init?.body)) });
      const next = replies.shift();
      if (!next) throw new Error("Unexpected fetch");
      if (next instanceof Error) throw next;
      return Promise.resolve(next);
    }, ...extra }) };
}
Deno.test("missing configuration does not fetch", async () => {
  for (const [extra, code] of [[{ token: "" }, "bot_token_missing"], [{ secret: "" }, "webhook_secret_missing"]] as const) {
    const h = harness([], "register_webhook");
    const result = await h.run(extra);
    assert.strictEqual(result.code, code); assert.strictEqual(result.stage, "preflight"); assert.strictEqual(h.calls.length, 0);
  }
});
Deno.test("read-only refresh verifies endpoint and never mutates Telegram", async () => {
  const h = harness([Response.json(info())]);
  assert.strictEqual((await h.run()).webhook.verified, true);
  assert.deepStrictEqual(h.calls.map(c => c.method), ["getWebhookInfo"]);
});
Deno.test("transport, HTTP, API and malformed responses get safe distinct codes", async () => {
  for (const [reply, code] of [
    [new Error(`https://api.telegram.org/bot${marker}/getWebhookInfo?secret=${marker}`), "telegram_transport_failed"],
    [new Response(marker, { status: 503 }), "telegram_api_rejected"],
    [Response.json({ ok: false, description: marker }), "telegram_api_rejected"],
    [new Response(marker), "telegram_response_invalid"],
    [Response.json({ ok: true, result: {} }), "telegram_response_invalid"],
  ] as const) {
    const h = harness([reply]); const result = await h.run();
    assert.strictEqual(result.code, code);
    assert.strictEqual(JSON.stringify([result, h.logs]).includes(marker), false);
  }
});
Deno.test("set failure stops; successful set followed by failed get is accepted but unverified", async () => {
  const rejected = harness([Response.json({ ok: false })], "register_webhook");
  const failed = await rejected.run();
  assert.strictEqual(failed.registration, "failed"); assert.strictEqual(failed.stage, "set_webhook");
  assert.strictEqual(rejected.calls.length, 1);
  const h = harness([Response.json({ ok: true, result: true }), new Error(marker)], "register_webhook");
  const result = await h.run();
  assert.strictEqual(result.registration, "accepted"); assert.strictEqual(result.code, "webhook_registered_unverified");
  assert.strictEqual(result.cause_code, "telegram_transport_failed"); assert.strictEqual(result.stage, "get_webhook_info");
  assert.strictEqual(h.calls[0].body.drop_pending_updates, false);
  assert.strictEqual(JSON.stringify([result,h.logs]).includes(marker), false);
});
Deno.test("set requires result true and verified registration requires matching endpoint and updates", async () => {
  const invalid = harness([Response.json({ ok: true, result: false })], "register_webhook");
  assert.strictEqual((await invalid.run()).code, "telegram_response_invalid");
  for (const [overrides, cause] of [[{ url: "https://other.invalid/" }, "endpoint_mismatch"], [{ allowed_updates: [] }, "required_updates_missing"], [{}, undefined]] as const) {
    const h = harness([Response.json({ ok: true, result: true }), Response.json(info(overrides))], "register_webhook");
    const result = await h.run(); assert.strictEqual(result.cause_code, cause);
    assert.strictEqual(result.webhook.verified, cause === undefined);
  }
});
Deno.test("timeout is bounded and classified without leaking exception", async () => {
  const h = harness([]);
  const result = await h.run({ timeoutMs: 5, fetcher: (_url: unknown, init: RequestInit) => new Promise((_resolve, reject) => {
    init.signal!.addEventListener("abort", () => reject(new Error(marker)), { once: true });
  }) });
  assert.strictEqual(result.code, "telegram_transport_failed");
  assert.strictEqual(JSON.stringify([result,h.logs]).includes(marker), false);
});

Deno.test("safe response strips secret-bearing fields, unknown updates and lookalike endpoints", async () => {
  const h = harness([Response.json(info({ allowed_updates: [marker], last_error_message: marker }))]);
  const result = await h.run();
  assert.strictEqual(result.cause_code, "required_updates_missing");
  assert.strictEqual(JSON.stringify([result,h.logs]).includes(marker), false);
  assert.deepStrictEqual("allowed_updates" in result.webhook ? result.webhook.allowed_updates : undefined, ["other_update"]);
  for (const url of [endpoint + "/evil", endpoint.replace("fixture.invalid", "fixture.invalid.evil"), "https://user:password@fixture.invalid/functions/v1/telegram-community-webhook"]) {
    const other = harness([Response.json(info({ url }))]);
    assert.strictEqual((await other.run()).cause_code, "endpoint_mismatch");
  }
});

Deno.test("post-registration HTTP/API/malformed read errors retain accepted registration", async () => {
  for (const [response, code] of [
    [new Response(marker, { status: 500 }), "telegram_api_rejected"],
    [Response.json({ ok: false, description: marker }), "telegram_api_rejected"],
    [Response.json(info({ url: marker })), "telegram_response_invalid"],
    [Response.json({ ok: true }), "telegram_response_invalid"],
  ] as const) {
    const h = harness([Response.json({ ok: true, result: true }), response], "register_webhook");
    const result = await h.run();
    assert.strictEqual(result.registration, "accepted");
    assert.strictEqual(result.code, "webhook_registered_unverified");
    assert.strictEqual(result.cause_code, code);
    assert.strictEqual(JSON.stringify([result,h.logs]).includes(marker), false);
  }
});
