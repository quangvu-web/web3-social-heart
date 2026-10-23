import assert from "node:assert/strict";
import ts from "npm:typescript@5.8.3";
import { splitCaptionSentences } from "./caption-utils.ts";

const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
const helpers = source.slice(source.indexOf("// Lazy work factories"), source.indexOf("// ---------- Action: start"));
const handlers = source.slice(source.indexOf("interface TranscriptEvent"), source.indexOf("// ---------- Action: stop"));
const announceRoute = source.slice(source.indexOf("async function handleAnnounce"), source.indexOf("// ---------- Entry"));
const isolated = ts.transpileModule(`
let admin, recall;
export function configure(a, r) { admin = a; recall = r; }
function getAdmin() { return admin; }
function checkInternalToken(req) { return req.headers.get("x-caption-token") === "fixture-token"; }
function recallFetch(...args) { return recall(...args); }
function captionUrl(code) { return "https://caption.example/captions/" + code; }
function json(value, status = 200) { return Response.json(value, { status }); }
async function verifySvixSignature() { return true; }
async function runSummarize() {}
function wordsToSentence(words) { return { text: words.map((word) => word.text).join(" "), startSec: 1 }; }
function splitCaptionSentences(words) { return globalThis.__captionSplit(words); }
function applyHearingCorrections(text) { return text; }
function detectSourceLang() { return "en"; }
async function computeDedupeKey() { return "line-1"; }
async function translateCaption() { return "Xin chào"; }
${helpers}
${handlers}
${announceRoute}
export async function callAnnounce(...args) { return announceCaptionLink(...args); }
export { handleAnnounce, handleBotStatusChange, handleTranscriptData, reconcileOrphanSessions, scheduleCaptionWork, probeJoinAnnouncement };
`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const mod = await import(`data:application/javascript,${encodeURIComponent(isolated)}`);
(globalThis as Record<string, unknown>).__captionSplit = splitCaptionSentences;

type Row = Record<string, unknown>;
function fixture(status = "joining", ageMinutes = 3) {
  const row: Row = {
    id: "session-1", public_code: "current-code", status, recall_bot_id: "bot-1",
    created_at: new Date(Date.now() - ageMinutes * 60_000).toISOString(),
    started_at: null, chat_announced_at: null,
  };
  const lines: Row[] = [];
  const recallCalls: Array<{ path: string; init?: RequestInit }> = [];
  let postFailure: "response" | "exception" | null = null;
  let postAttempts = 0;
  const botCodes: string[] = [];
  const admin = { from(table: string) {
    const filters: Array<(candidate: Row) => boolean> = [];
    let patch: Row | null = null;
    let countRequested = false;
    let limit = Infinity;
    const query = {
      select() { return query; },
      update(value: Row, options?: { count?: string }) { patch = value; countRequested = options?.count === "exact"; return query; },
      eq(key: string, value: unknown) { filters.push((candidate) => candidate[key] === value); return query; },
      is(key: string, value: unknown) { filters.push((candidate) => candidate[key] === value); return query; },
      in(key: string, values: unknown[]) { filters.push((candidate) => values.includes(candidate[key])); return query; },
      not(key: string, _operator: string, value: unknown) { filters.push((candidate) => candidate[key] !== value); return query; },
      lt(key: string, value: string) { filters.push((candidate) => String(candidate[key]) < value); return query; },
      order() { return query; },
      limit(value: number) { limit = value; return query; },
      maybeSingle() {
        const rows = table === "caption_sessions" ? [row] : lines;
        return Promise.resolve({ data: structuredClone(rows.find((candidate) => filters.every((f) => f(candidate))) ?? null), error: null });
      },
      insert(value: Row) { lines.push(value); return Promise.resolve({ error: null }); },
      then(resolve: (value: unknown) => unknown) {
        const rows = table === "caption_sessions" ? [row] : lines;
        const matched = rows.filter((candidate) => filters.every((f) => f(candidate))).slice(0, limit);
        if (patch) matched.forEach((candidate) => Object.assign(candidate, patch));
        return Promise.resolve(resolve({ data: structuredClone(matched), count: countRequested ? matched.length : null, error: null }));
      },
    };
    return query;
  } };
  mod.configure(admin, async (path: string, init?: RequestInit) => {
    recallCalls.push({ path, init });
    if (path.endsWith("/send_chat_message/")) {
      postAttempts++;
      if (postFailure === "exception") { postFailure = null; throw new Error("network failed"); }
      if (postFailure === "response") { postFailure = null; return { ok: false, status: 503, data: null }; }
      return { ok: true, status: 200, data: {} };
    }
    return { ok: true, status: 200, data: { status_changes: [{ code: botCodes.shift() ?? "in_call_recording" }] } };
  });
  return {
    admin, row, lines, recallCalls,
    failNextPost(kind: "response" | "exception") { postFailure = kind; },
    setBotCodes(...codes: string[]) { botCodes.push(...codes); },
    get postAttempts() { return postAttempts; },
    sentMessages() { return recallCalls.filter(({ path }) => path.endsWith("/send_chat_message/")); },
  };
}

function statusPayload() { return { data: { bot: { id: "bot-1" }, data: { code: "in_call_recording" } } }; }

Deno.test("recording status announces once even when transcript already made session live", async () => {
  const f = fixture("live");
  await mod.handleBotStatusChange(f.admin, statusPayload(), null);
  await mod.handleBotStatusChange(f.admin, statusPayload(), null);
  assert.equal(f.postAttempts, 1);
  assert.ok(f.row.chat_announced_at);
  const sent = f.sentMessages()[0];
  assert.equal(sent.path, "/api/v1/bot/bot-1/send_chat_message/");
  const body = JSON.parse(String(sent.init?.body));
  assert.equal(body.to, "everyone");
  assert.match(body.message, /Dear international friends, welcome to our FUN Community Zoom session!/);
  assert.match(body.message, /🔗 Translation link: https:\/\/caption\.example\/captions\/current-code/);
});

Deno.test("failed Recall response rolls back claim so next status retries", async () => {
  const f = fixture();
  f.failNextPost("response");
  await mod.handleBotStatusChange(f.admin, statusPayload(), null);
  assert.equal(f.row.chat_announced_at, null);
  await mod.handleBotStatusChange(f.admin, statusPayload(), null);
  assert.equal(f.postAttempts, 2);
  assert.ok(f.row.chat_announced_at);
});

Deno.test("Recall exception rolls back claim and next trigger can retry", async () => {
  const f = fixture();
  f.failNextPost("exception");
  await mod.handleBotStatusChange(f.admin, statusPayload(), null);
  assert.equal(f.row.chat_announced_at, null);
  await mod.callAnnounce(f.admin, f.row, "reconcile");
  assert.equal(f.postAttempts, 2);
  assert.ok(f.row.chat_announced_at);
});

Deno.test("first transcript keeps captions flowing and schedules an announcement without duplicate status send", async () => {
  const f = fixture();
  const tasks: Promise<unknown>[] = [];
  const runtime = globalThis as typeof globalThis & { EdgeRuntime?: { waitUntil(task: Promise<unknown>): void } };
  runtime.EdgeRuntime = { waitUntil(task) { tasks.push(task); } };
  try {
    await mod.handleTranscriptData(f.admin, { data: { bot: { id: "bot-1" }, data: { words: [{ text: "Hello" }] } } }, null);
    assert.equal(f.lines.length, 1);
    assert.equal(f.lines[0].text_source, "Hello");
    await mod.handleBotStatusChange(f.admin, statusPayload(), null);
    await Promise.all(tasks);
    assert.equal(f.postAttempts, 1);
  } finally { delete runtime.EdgeRuntime; }
});

Deno.test("reconcile announces a silent two-minute-old joining bot", async () => {
  const f = fixture("joining", 2.5);
  await mod.reconcileOrphanSessions();
  assert.equal(f.postAttempts, 1);
  assert.ok(f.row.chat_announced_at);
});

Deno.test("join probe announces a fresh silent bot before the two-minute reconcile cutoff", async () => {
  const f = fixture("joining", 0.1);
  f.setBotCodes("joining", "in_call_recording");
  await mod.probeJoinAnnouncement(f.row, 3, 0);
  assert.equal(f.postAttempts, 1);
  assert.ok(f.row.chat_announced_at);
  await mod.handleBotStatusChange(f.admin, statusPayload(), null);
  assert.equal(f.postAttempts, 1);
});

Deno.test("simultaneous announcement triggers claim one send", async () => {
  const f = fixture("live");
  await Promise.all([
    mod.callAnnounce(f.admin, f.row, "status"),
    mod.callAnnounce(f.admin, f.row, "reconcile"),
  ]);
  assert.equal(f.postAttempts, 1);
  assert.ok(f.row.chat_announced_at);
});

Deno.test("authenticated announce action sends only for a valid internal token", async () => {
  const f = fixture("live");
  const request = (token: string) => new Request("https://fixture.invalid/?action=announce", {
    method: "POST", headers: { "x-caption-token": token, "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: "session-1" }),
  });
  assert.equal((await mod.handleAnnounce(request("wrong"))).status, 401);
  assert.equal(f.postAttempts, 0);
  assert.equal((await mod.handleAnnounce(request("fixture-token"))).status, 200);
  assert.equal(f.postAttempts, 1);
});

Deno.test("announce background fallback self-calls with the internal token", async () => {
  const f = fixture();
  const priorFetch = globalThis.fetch;
  const priorUrl = Deno.env.get("SUPABASE_URL");
  const priorToken = Deno.env.get("CAPTION_INTERNAL_TOKEN");
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  Deno.env.set("SUPABASE_URL", "https://fixture.invalid");
  Deno.env.set("CAPTION_INTERNAL_TOKEN", "fixture-token");
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return Response.json({ ok: true });
  };
  try {
    mod.scheduleCaptionWork("announce", String(f.row.id));
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://fixture.invalid/functions/v1/angel-caption?action=announce");
    assert.equal(new Headers(calls[0].init?.headers).get("x-caption-token"), "fixture-token");
    assert.equal(new Headers(calls[0].init?.headers).get("x-caption-background"), "1");
    assert.equal(JSON.parse(String(calls[0].init?.body)).session_id, "session-1");
  } finally {
    globalThis.fetch = priorFetch;
    if (priorUrl === undefined) Deno.env.delete("SUPABASE_URL"); else Deno.env.set("SUPABASE_URL", priorUrl);
    if (priorToken === undefined) Deno.env.delete("CAPTION_INTERNAL_TOKEN"); else Deno.env.set("CAPTION_INTERNAL_TOKEN", priorToken);
  }
});
