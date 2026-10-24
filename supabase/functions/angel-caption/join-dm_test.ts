import assert from "node:assert/strict";
import { sendCaptionJoinDm } from "./join-dm.ts";

function fixture() {
  const claims = new Set<string>();
  const messages: Array<{ path: string; body: { to: string; message: string } }> = [];
  let claimError: string | null = null;
  let sendFails = false;
  let sendStatus = 200;
  let claimThrows = false;
  const admin = { from(table: string) {
    assert.equal(table, "caption_join_dm_claims");
    return { async insert(row: { webhook_id: string }) {
      if (claimThrows) throw new Error("database unavailable");
      if (claimError) return { error: { code: claimError } };
      if (claims.has(row.webhook_id)) return { error: { code: "23505" } };
      claims.add(row.webhook_id);
      return { error: null };
    } };
  } };
  const send = async (path: string, init: RequestInit) => {
    messages.push({ path, body: JSON.parse(String(init.body)) });
    if (sendFails) throw new Error("transport failed");
    return { ok: sendStatus < 400, status: sendStatus };
  };
  const session = { id: "session-1", public_code: "test-caption", recall_bot_id: "bot-1" };
  return { messages, claims,
    deliver: (eventId: string | null = "event-1", participantId = "1234") =>
      sendCaptionJoinDm(admin as never, session, participantId, eventId, send),
    failClaim: () => { claimError = "42P01"; },
    failSend: () => { sendFails = true; },
    rejectSend: () => { sendStatus = 403; },
    throwClaim: () => { claimThrows = true; },
  };
}

Deno.test("one webhook event claims before sending one private bilingual caption link, including concurrent retries", async () => {
  const f = fixture();
  await Promise.all([f.deliver(), f.deliver(), f.deliver()]);
  assert.equal(f.messages.length, 1);
  assert.equal(f.messages[0].path, "/api/v1/bot/bot-1/send_chat_message/");
  assert.equal(f.messages[0].body.to, "1234");
  const url = "https://web3-social-heart.lovable.app/captions/test-caption";
  assert.equal(f.messages[0].body.message, `👋 Welcome to the FUN Community session! Here's your live caption link: ${url} — click to view live subtitles in your preferred language. 🎙️ This session is recorded and transcribed to generate the live captions. / Chào bạn! Link phụ đề trực tiếp: ${url} — buổi họp được ghi và chép lời để tạo phụ đề.`);
});

Deno.test("new join event sends another DM to the same participant", async () => {
  const f = fixture();
  await f.deliver("join-1"); await f.deliver("join-2");
  assert.equal(f.messages.length, 2);
});

Deno.test("failed or ambiguous send keeps durable claim and never retries that event", async () => {
  const f = fixture(); f.failSend();
  await f.deliver(); await f.deliver();
  assert.equal(f.messages.length, 1);
  assert.equal(f.claims.size, 1);
});

Deno.test("missing event ID or broadcast recipient never sends or claims", async () => {
  const f = fixture();
  await f.deliver(null); await f.deliver("");
  for (const recipient of ["", "everyone", "host", "everyone_except_host"]) await f.deliver("bad-event", recipient);
  assert.equal(f.messages.length, 0);
  assert.equal(f.claims.size, 0);
});

Deno.test("unavailable claim storage fails closed without throwing or sending", async () => {
  const f = fixture(); f.failClaim(); await f.deliver();
  assert.equal(f.messages.length, 0);
});

Deno.test("Recall non-2xx response retains claim and does not send on redelivery", async () => {
  const f = fixture(); f.rejectSend(); await f.deliver(); await f.deliver();
  assert.equal(f.messages.length, 1);
  assert.equal(f.claims.size, 1);
});

Deno.test("claim network exception is contained and never sends", async () => {
  const f = fixture(); f.throwClaim(); await f.deliver();
  assert.equal(f.messages.length, 0);
});
