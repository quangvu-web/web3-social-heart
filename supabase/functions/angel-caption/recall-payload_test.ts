import assert from "node:assert/strict";
import ts from "npm:typescript@5.8.3";
import { splitCaptionSentences } from "./caption-utils.ts";

// Exercise the production webhook handlers in isolation: no Recall, AI or database calls.
const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
const handlers = source.slice(source.indexOf("interface TranscriptEvent"), source.indexOf("// ---------- Action: stop"));
const isolated = ts.transpileModule(`
let admin;
export function setAdmin(value) { admin = value; }
function getAdmin() { return admin; }
function json(value, status = 200) { return Response.json(value, { status }); }
let signatureValid = true;
export function setSignatureValid(value) { signatureValid = value; }
async function verifySvixSignature() { return signatureValid; }
function wordsToSentence(words) { return { text: words.map(w => w.text).join(' '), startSec: 1 }; }
function splitCaptionSentences(words) { return globalThis.__captionSplit(words); }
function applyHearingCorrections(text) { return text; }
function detectSourceLang() { return 'en'; }
async function computeDedupeKey() { return 'fixture-dedupe'; }
async function translateCaption() { return 'Xin chào'; }
async function recallFetch() { throw new Error('No meeting chat allowed'); }
async function handleCaptionParticipantJoin(admin, payload, webhookId, sendChat) {
  globalThis.__captionJoinDelivery = { admin, payload, webhookId, sendChat };
}
async function runSummarize() { throw new Error('No summary expected'); }
async function closeCaptionSession() { throw new Error('No closure expected'); }
function scheduleCaptionWork() {}
async function isPlaybackActive(_admin, session) { return globalThis.__captionPlayback?.(session) ?? false; }
${handlers}
export { handleRecallWebhook };
`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { setAdmin, handleRecallWebhook, setSignatureValid } = await import(`data:application/javascript,${encodeURIComponent(isolated)}`);
(globalThis as Record<string, unknown>).__captionSplit = splitCaptionSentences;

function fixture(status: string, startedAt: string | null = null, metadataOnly = false) {
  const updates: Record<string, unknown>[] = [];
  const inserts: Record<string, unknown>[] = [];
  const partialWrites: Record<string, unknown>[] = [];
  const partialDeletes: string[] = [];
  const lookups: Array<[string, unknown]> = [];
  setAdmin({ from(table: string) {
    let column = "";
    const query = {
      select() { return query; },
      eq(key: string, value: unknown) { column = key; if (table === "caption_sessions") lookups.push([key, value]); return query; },
      in() { return query; },
      order() { return query; }, limit() { return query; },
      update(value: Record<string, unknown>) { updates.push(value); return query; },
      lte() { return query; },
      delete() { partialDeletes.push(table); return query; },
      upsert(value: Record<string, unknown>) { partialWrites.push(value); return Promise.resolve({ error: null }); },
      then(resolve: (value: unknown) => void) { resolve({ error: null }); },
      insert(value: Record<string, unknown>) { inserts.push(value); return Promise.resolve({ error: null }); },
      maybeSingle() { return Promise.resolve({ data: table === "caption_sessions" && (!metadataOnly || column === "id")
        ? { id: "session-1", public_code: "fixture", status, started_at: startedAt } : null }); },
    };
    return query;
  } });
  return { updates, inserts, lookups, partialWrites, partialDeletes };
}

async function deliver(event: string, data: unknown, metadata?: unknown) {
  const response = await handleRecallWebhook(new Request("https://fixture.invalid/?action=recall-webhook", {
    method: "POST", body: JSON.stringify({ event, data, metadata }),
  }));
  assert.equal(response.status, 200);
}

Deno.test("Recall nested transcript bot ID writes caption and recovers pending/joining without meeting chat", async () => {
  for (const status of ["pending", "joining"]) {
    const f = fixture(status);
    await deliver("transcript.data", { bot: { id: "bot-current" }, bot_id: "bot-old", data: { words: [{ text: "Hello" }], participant: { name: "Speaker" } } });
    assert.deepEqual(f.lookups[0], ["recall_bot_id", "bot-current"]);
    assert.equal(f.updates[0].status, "live");
    assert.ok(!Number.isNaN(Date.parse(String(f.updates[0].started_at))));
    assert.equal(f.inserts[0].text_source, "Hello");
    assert.equal(f.inserts[0].speaker_name, "Speaker");
  }
});

Deno.test("Recovery preserves existing start and never reopens live/ended/failed", async () => {
  const f = fixture("joining", "2026-10-21T23:00:00Z");
  await deliver("transcript.data", { bot: { id: "bot-1" }, data: { words: [{ text: "Hello" }] } });
  assert.deepEqual(f.updates, [{ status: "live" }]);
  for (const status of ["live", "ended", "failed"]) {
    const f = fixture(status);
    await deliver("transcript.data", { bot: { id: "bot-1" }, data: { words: [{ text: "Hello" }] } });
    assert.equal(f.updates.length, 0);
  }
});

Deno.test("Nested bot metadata takes precedence; both old metadata paths remain supported", async () => {
  for (const shape of ["current", "old-data", "old-root"]) {
    const f = fixture("live", null, true);
    await deliver("transcript.data", {
      ...(shape === "current" ? { bot: { metadata: { caption_session_id: "session-1" } }, metadata: { caption_session_id: "wrong" } } : {}),
      ...(shape === "old-data" ? { metadata: { caption_session_id: "session-1" } } : {}),
      data: { words: [{ text: "Hello" }] },
    }, shape === "old-root" ? { caption_session_id: "session-1" } : undefined);
    assert.deepEqual(f.lookups[0], ["id", "session-1"]);
    assert.equal(f.inserts.length, 1);
  }
});

Deno.test("Nested status code and bot ID take precedence; legacy bot/status still work", async () => {
  const current = fixture("pending");
  await deliver("bot.status_change", { bot: { id: "bot-current" }, bot_id: "bot-old", data: { code: "joining" }, status: { code: "fatal" } });
  assert.deepEqual(current.lookups[0], ["recall_bot_id", "bot-current"]);
  assert.deepEqual(current.updates, [{ status: "joining" }]);
  const legacy = fixture("pending");
  await deliver("bot.status_change", { bot_id: "bot-old", status: { code: "joining" } });
  assert.deepEqual(legacy.lookups[0], ["recall_bot_id", "bot-old"]);
  assert.deepEqual(legacy.updates, [{ status: "joining" }]);
  const transcript = fixture("live");
  await deliver("transcript.data", { bot_id: "bot-old", data: { words: [{ text: "Hello" }] } });
  assert.deepEqual(transcript.lookups[0], ["recall_bot_id", "bot-old"]);
  assert.equal(transcript.inserts.length, 1);
});

Deno.test("real Recall partial shape overwrites one temporary row and final clears it", async () => {
  const f = fixture("live");
  const bot = { id: "bot-current", metadata: { caption_session_id: "session-1" } };
  await deliver("transcript.partial_data", { bot, data: {
    words: [{ text: "Hello" }], participant: { name: "MC" },
  } });
  await deliver("transcript.partial_data", { bot, data: {
    words: [{ text: "Hello" }, { text: "world" }], participant: { name: "MC" },
  } });
  assert.deepEqual(f.partialWrites.map((row) => [row.session_id, row.speaker_name, row.text_source]), [
    ["session-1", "MC", "Hello"], ["session-1", "MC", "Hello world"],
  ]);
  assert.ok(f.partialWrites.every((row) => !Number.isNaN(Date.parse(String(row.updated_at)))));
  await deliver("transcript.data", { bot, data: {
    words: [{ text: "Hello" }, { text: "world." }], participant: { name: "MC" },
  } });
  assert.deepEqual(f.partialDeletes, ["caption_partials"]);
  assert.equal(f.inserts.length, 1);
});

Deno.test("partial speech marks a joining session live even if status delivery was missed", async () => {
  const f = fixture("joining");
  await deliver("transcript.partial_data", { bot: { id: "bot-current" }, data: {
    words: [{ text: "Hello" }], participant: { name: "MC" },
  } });
  assert.equal(f.updates[0].status, "live");
  assert.equal(f.partialWrites[0].text_source, "Hello");
});

Deno.test("music playback suppresses both partial and final caption writes", async () => {
  (globalThis as Record<string, unknown>).__captionPlayback = () => true;
  try {
    const f = fixture("live");
    const data = { bot: { id: "bot-current" }, data: {
      words: [{ text: "Music" }], participant: { name: "Speaker" },
    } };
    await deliver("transcript.partial_data", data);
    await deliver("transcript.data", data);
    assert.equal(f.partialWrites.length, 0);
    assert.equal(f.inserts.length, 0);
  } finally {
    delete (globalThis as Record<string, unknown>).__captionPlayback;
  }
});

Deno.test("authenticated join routes intact payload and Svix webhook ID to isolated DM handler", async () => {
  fixture("live");
  const payload = { event: "participant_events.join", data: { data: { participant: { id: 200 } } } };
  const response = await handleRecallWebhook(new Request("https://fixture.invalid/?action=recall-webhook", {
    method: "POST", body: JSON.stringify(payload), headers: { "webhook-id": "svix-event-123" },
  }));
  assert.equal(response.status, 200);
  const delivery = (globalThis as any).__captionJoinDelivery;
  assert.deepEqual(delivery.payload, payload);
  assert.equal(delivery.webhookId, "svix-event-123");
});

Deno.test("invalid Svix signature cannot reach the join DM handler", async () => {
  const global = globalThis as any;
  delete global.__captionJoinDelivery;
  setSignatureValid(false);
  try {
    const response = await handleRecallWebhook(new Request("https://fixture.invalid/?action=recall-webhook", {
      method: "POST", body: JSON.stringify({ event: "participant_events.join" }),
    }));
    assert.equal(response.status, 401);
    assert.equal(global.__captionJoinDelivery, undefined);
  } finally { setSignatureValid(true); }
});
