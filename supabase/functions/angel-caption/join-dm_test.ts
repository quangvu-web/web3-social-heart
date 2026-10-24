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

const realJoin = JSON.parse(await Deno.readTextFile(new URL("./fixtures/participant-join.json", import.meta.url)));
const { handleCaptionParticipantJoin } = await import("./join-dm.ts");
function handlerFixture(sessionOverrides: Record<string, unknown> = {}, mode = "normal") {
  const lookups: Array<[string, unknown]> = [];
  const claims = new Set<string>();
  const sent: Array<{ to: string; message: string }> = [];
  const session = { id: "session-1", public_code: "caption-1", recall_bot_id: "bot-1", status: "live", platform: "zoom", ...sessionOverrides };
  const admin = { from(table: string) {
    let column = "";
    const query = {
      select() { return query; },
      eq(key: string, value: unknown) { column = key; lookups.push([key, value]); return query; },
      maybeSingle() {
        if (mode === "throw") throw new Error("unavailable");
        return Promise.resolve({
          data: mode === "missing" || mode === "error" || (mode === "metadata" && column !== "id") ? null : session,
          error: mode === "error" ? { code: "network" } : null,
        });
      },
      insert(row: { webhook_id: string }) {
        assert.equal(table, "caption_join_dm_claims");
        if (claims.has(row.webhook_id)) return Promise.resolve({ error: { code: "23505" } });
        claims.add(row.webhook_id); return Promise.resolve({ error: null });
      },
    }; return query;
  } };
  const send = async (_path: string, init: RequestInit) => { sent.push(JSON.parse(String(init.body))); return { ok: true, status: 200 }; };
  return { lookups, claims, sent, deliver: (payload = structuredClone(realJoin), eventId = "svix-1") =>
    handleCaptionParticipantJoin(admin as never, payload, eventId, send) };
}

Deno.test("verified real join shape resolves bot and sends DM to nested numeric participant ID", async () => {
  const f = handlerFixture(); await f.deliver();
  assert.deepEqual(f.lookups[0], ["recall_bot_id", "bot-1"]);
  assert.equal(f.sent[0].to, "200");
  assert.ok(f.sent[0].message.includes("/captions/caption-1"));
});

Deno.test("self bot join does not claim or send", async () => {
  const f = handlerFixture(); const payload = structuredClone(realJoin);
  payload.data.data.participant.name = "Angel Translator 🌐";
  await f.deliver(payload); assert.equal(f.sent.length, 0); assert.equal(f.claims.size, 0);
});

Deno.test("closed, non-Zoom, or mismatched bot sessions cannot send DM", async () => {
  for (const overrides of [{status:"ended"}, {status:"failed"}, {platform:"google_meet"}, {recall_bot_id:"other-bot"}]) {
    const f = handlerFixture(overrides); await f.deliver(); assert.equal(f.sent.length, 0);
  }
});

Deno.test("malformed participant ID or missing bot identity never falls back to public chat", async () => {
  for (const id of [null, "everyone", "host", -1, 0, {}, " 200 ", 1.5]) {
    const f = handlerFixture(); const payload = structuredClone(realJoin); payload.data.data.participant.id = id;
    await f.deliver(payload); assert.equal(f.sent.length, 0); assert.equal(f.claims.size, 0);
  }
  const f = handlerFixture(); const payload = structuredClone(realJoin); delete payload.data.bot.id;
  await f.deliver(payload); assert.equal(f.sent.length, 0);
});

Deno.test("rejoin uses new Svix ID even when participant-events artifact ID is unchanged", async () => {
  const f = handlerFixture();
  await f.deliver(structuredClone(realJoin), "svix-1");
  await f.deliver(structuredClone(realJoin), "svix-1");
  await f.deliver(structuredClone(realJoin), "svix-2");
  assert.equal(f.sent.length, 2);
});

Deno.test("metadata fallback only sends when the session belongs to the same bot", async () => {
  const f = handlerFixture({}, "metadata"); await f.deliver();
  assert.deepEqual(f.lookups, [["recall_bot_id", "bot-1"], ["id", "session-1"]]);
  assert.equal(f.sent.length, 1);
  const mismatch = handlerFixture({recall_bot_id:"wrong-bot"}, "metadata"); await mismatch.deliver();
  assert.equal(mismatch.sent.length, 0);
});

Deno.test("missing session, read error, and thrown lookup never claim or send", async () => {
  for (const mode of ["missing", "error", "throw"]) {
    const f = handlerFixture({}, mode); await f.deliver();
    assert.equal(f.sent.length, 0); assert.equal(f.claims.size, 0);
  }
});

Deno.test("initial pending/joining joins are eligible without changing session lifecycle", async () => {
  for (const status of ["pending", "joining"]) {
    const f = handlerFixture({status}); await f.deliver(); assert.equal(f.sent.length, 1);
  }
});
