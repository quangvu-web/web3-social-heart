import assert from "npm:assert@2.1.0";
import { attemptModerationDelete, sendModerationFailureNotice } from "./telegram-moderation-notice.ts";

Deno.test("delete metadata distinguishes Telegram permission and deletion limits", async () => {
  for (const [description, kind] of [
    ["Bad Request: not enough rights to delete messages", "permission_denied"],
    ["Bad Request: message can't be deleted", "message_not_deletable"],
    ["Bad Request: message to delete not found", "message_not_found"],
  ]) {
    const result = await attemptModerationDelete(async () => ({ ok: false, status: 400, data: { ok: false, error_code: 400, description } }));
    assert.strictEqual(result.deleted, false);
    assert.strictEqual(result.failure, kind);
    assert.strictEqual(result.errorCode, 400);
  }
});

Deno.test("delete metadata distinguishes network, invalid response and unknown API error", async () => {
  assert.strictEqual((await attemptModerationDelete(async () => { throw new TypeError("synthetic private payload"); })).failure, "transport_error");
  assert.strictEqual((await attemptModerationDelete(async () => ({ ok: false, status: 0 }))).failure, "transport_error");
  assert.strictEqual((await attemptModerationDelete(async () => ({ ok: false, status: 200, data: { error: "invalid body" } }))).failure, "invalid_response");
  assert.strictEqual((await attemptModerationDelete(async () => ({ ok: false, status: 403, data: { ok: false, error_code: 403 } }))).failure, "telegram_error");
  assert.strictEqual((await attemptModerationDelete(async () => ({ ok: false, status: 500, data: { error: "COMMUNITY_GUARD_BOT_TOKEN is not configured" } }))).failure, "configuration_unavailable");
  assert.strictEqual((await attemptModerationDelete(async () => ({ ok: true, status: 200, data: { ok: true } }))).deleted, true);
});

Deno.test("failure notices respect durable claim decisions and record send failures without private details", async () => {
  const events: Array<{ action: string; reason: string }> = [];
  let sends = 0;
  const run = (claim: string | null, sendOk = true) => sendModerationFailureNotice({
    groupId: -1001, messageId: 7,
    claim: async () => claim,
    send: async () => { sends++; return { ok: sendOk }; },
    audit: async (event) => { events.push(event); },
  });
  await run("duplicate"); await run("cooldown"); await run(null);
  assert.strictEqual(sends, 0);
  assert.deepStrictEqual(events.map(e => e.action), ["moderation_notice_suppressed", "moderation_notice_suppressed", "moderation_notice_unavailable"]);
  await run("claimed", false);
  assert.strictEqual(events.at(-1)?.action, "moderation_notice_send_failed");
  assert.strictEqual(sends, 1);
  await sendModerationFailureNotice({ groupId: -1001, messageId: 8,
    claim: async () => { throw new Error("private secret"); },
    send: async () => { throw new Error("must not send"); },
    audit: async e => { events.push(e); },
  });
  assert.strictEqual(events.at(-1)?.action, "moderation_notice_unavailable");
  assert.strictEqual(JSON.stringify(events).includes("private secret"), false);
});

import { resolveDeletePermission } from "./telegram-moderation-notice.ts";
Deno.test("permission false differs from unverified membership or omitted flag", () => {
  assert.strictEqual(resolveDeletePermission(false, { status: "administrator", can_delete_messages: true }), null);
  assert.strictEqual(resolveDeletePermission(true, { status: "administrator" }), null);
  assert.strictEqual(resolveDeletePermission(true, { status: "unknown" }), null);
  assert.strictEqual(resolveDeletePermission(true, { status: "administrator", can_delete_messages: false }), false);
  assert.strictEqual(resolveDeletePermission(true, { status: "member" }), false);
  assert.strictEqual(resolveDeletePermission(true, { status: "administrator", can_delete_messages: true }), true);
});
