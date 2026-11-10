import assert from "node:assert/strict";
import ts from "npm:typescript@5.8.3";
import { computeDedupeKey, detectSourceLang, splitCaptionSentences } from "./caption-utils.ts";

const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
const handlers = source.slice(source.indexOf("interface TranscriptEvent"), source.indexOf("// ---------- Action: stop"));
const isolated = ts.transpileModule(`
let admin, translate, history = [];
export function configure(a, t, h = []) { admin = a; translate = t; history = h; }
function splitCaptionSentences(words) { return globalThis.__captionSplit(words); }
function wordsToSentence(words) { return globalThis.__captionSplit(words)[0] ?? { text: "", startSec: null }; }
function applyHearingCorrections(text) { return text; }
function detectSourceLang(text) { return globalThis.__captionLang(text); }
async function computeDedupeKey(...args) { return globalThis.__captionKey(...args); }
async function loadCaptionTranslationContext() { return history; }
async function translateCaption(...args) { return translate(...args); }
function scheduleCaptionWork() {}
async function isPlaybackActive(_admin, session) { return session.playback_status === "playing"; }
${handlers}
export { handleTranscriptData };
`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
(globalThis as Record<string, unknown>).__captionSplit = splitCaptionSentences;
(globalThis as Record<string, unknown>).__captionKey = computeDedupeKey;
(globalThis as Record<string, unknown>).__captionLang = detectSourceLang;
const mod = await import(`data:application/javascript,${encodeURIComponent(isolated)}`);

Deno.test("translation receives previous source sentence as context but requests only current sentence", async () => {
  const translator = source.slice(source.indexOf("async function translateCaption"), source.indexOf("async function summarizeSession"));
  let request: Record<string, unknown> | null = null;
  const compiled = ts.transpileModule(`
import { buildCaptionTranslationMessages } from ${JSON.stringify(new URL("./caption-translation.ts", import.meta.url).href)};
const GLOSSARY_NOTE = "Keep names unchanged.";
const MODELS = { style_pass: { id: "fixture" } };
async function callAiGateway(value) { globalThis.__translationRequest(value); return { ok: true }; }
function gatewayText() { return "English result"; }
${translator}
export { translateCaption };
`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
  (globalThis as Record<string, unknown>).__translationRequest = (value: Record<string, unknown>) => { request = value; };
  const { translateCaption } = await import(`data:application/javascript,${encodeURIComponent(compiled)}`);
  assert.equal(await translateCaption("Xin chào.", "vi", "Chúng ta bắt đầu."), "English result");
  const messages = (request as unknown as { messages: Array<{ role: string; content: string }> }).messages;
  assert.match(messages[0].content, /only the current sentence/i);
  assert.match(messages[1].content, /Chúng ta bắt đầu\./);
  assert.match(messages[1].content, /Xin chào\./);
});

Deno.test("long final turn translates concurrently, retains partial until insert, and ignores replay", async () => {
  const rows: Array<Record<string, unknown>> = [];
  const translated: Array<{ text: string; previous: string | null }> = [];
  const clears: number[] = [];
  const admin = { from(table: string) {
    const filters: Array<(row: Record<string, unknown>) => boolean> = [];
    let descending = false;
    const query = {
      select() { return query; },
      update() { return query; },
      delete() { clears.push(rows.length); return query; },
      lte() { return query; },
      then(resolve: (value: unknown) => void) { resolve({ error: null }); },
      eq(key: string, value: unknown) { filters.push((row) => row[key] === value); return query; },
      in() { return query; },
      order() { descending = true; return query; },
      limit() { return query; },
      maybeSingle() {
        if (table === "caption_sessions") return Promise.resolve({ data: { id: "session-1", status: "live", started_at: "2026-10-24T00:00:00Z" } });
        const matches = rows.filter((row) => filters.every((filter) => filter(row)));
        return Promise.resolve({ data: (descending ? matches.at(-1) : matches[0]) ?? null });
      },
      insert(value: Record<string, unknown>) {
        if (rows.some((row) => row.dedupe_key === value.dedupe_key)) return Promise.resolve({ error: { code: "23505" } });
        rows.push(value);
        return Promise.resolve({ error: null });
      },
    };
    return query;
  } };
  mod.configure(admin, async (text: string, _lang: string, previous: string | null) => {
    translated.push({ text, previous });
    if (!rows.length) assert.equal(clears.length, 0, "partial must survive until the first durable row");
    return `translated ${text}`;
  });
  const words = ["Xin", "chào", "mọi", "người", ".", "Chúng", "ta", "bắt", "đầu", "!"].map((text, i) => ({
    text, start_timestamp: { relative: i / 10 },
  }));
  const payload = { data: { bot: { id: "bot-1" }, data: { words, participant: { name: "MC" } } } };
  await mod.handleTranscriptData(admin, payload, null);
  assert.deepEqual(rows.map((row) => [row.seq, row.text_source, row.ts_offset_sec]), [
    [1, "Xin chào mọi người.", 0], [2, "Chúng ta bắt đầu!", 0.5],
  ]);
  assert.deepEqual(translated, [
    { text: "Xin chào mọi người.", previous: null },
    { text: "Chúng ta bắt đầu!", previous: "Xin chào mọi người." },
  ]);
  assert.deepEqual(clears, [1], "partial clears only after first successful insert");
  assert.notEqual(rows[0].dedupe_key, rows[1].dedupe_key);
  await mod.handleTranscriptData(admin, payload, null);
  assert.equal(rows.length, 2);
  assert.equal(translated.length, 2);
});

function segmentFixture() {
  const rows: Array<Record<string, unknown>> = [];
  const partial = { updated_at: "2000-01-01T00:00:00Z", text: "Speaking" };
  let clearCount = 0, deleteFailures = 0, insertError: string | null = null, playback = false, playbackUnreadable = false;
  const admin = { from(table: string) {
    const filters: Array<(row: Record<string, unknown>) => boolean> = [];
    let descending = false, cutoff = "";
    const query = {
      select() { return query; }, eq(key: string, value: unknown) { filters.push(row => row[key] === value); return query; },
      order() { descending = true; return query; }, limit() { return query; },
      delete() { return query; }, lte(_key: string, value: string) { cutoff = value; return query; },
      then(resolve: (value: unknown) => void) {
        if (deleteFailures > 0) { deleteFailures--; resolve({ error: { code: "delete-failed" } }); return; }
        if (partial.updated_at <= cutoff) { partial.text = ""; clearCount++; }
        resolve({ error: null });
      },
      maybeSingle() {
        if (table === "caption_sessions") return Promise.resolve({
          data: playbackUnreadable ? null : { id: "session-1", status: "live", playback_status: playback ? "playing" : null },
          error: playbackUnreadable ? { code: "read-failed" } : null,
        });
        const matches = rows.filter(row => filters.every(filter => filter(row)));
        return Promise.resolve({ data: descending ? matches.at(-1) : matches[0] });
      },
      insert(row: Record<string, unknown>) {
        if (insertError) return Promise.resolve({ error: { code: insertError } });
        rows.push(row); return Promise.resolve({ error: null });
      },
    };
    return query;
  } };
  const words = Array.from({ length: 9 }, (_, i) => ({ text: `Sentence ${i + 1}.`, start_timestamp: { relative: i * 2 } }));
  return { admin, rows, partial, payload: { data: { bot: { id: "bot-1" }, data: { words } } },
    get clearCount() { return clearCount; },
    set deleteFailures(value: number) { deleteFailures = value; },
    set insertError(value: string | null) { insertError = value; },
    set playback(value: boolean) { playback = value; },
    set playbackUnreadable(value: boolean) { playbackUnreadable = value; },
  };
}

async function waitFor(condition: () => boolean) {
  for (let i = 0; i < 100 && !condition(); i++) await new Promise(resolve => setTimeout(resolve, 1));
  assert.ok(condition(), "async worker condition must settle");
}

Deno.test("four workers tolerate reverse translation completion, preserve seq/context, log timings and retain newer partial", async () => {
  const f = segmentFixture();
  let active = 0, peak = 0;
  const pending = new Map<string, () => void>();
  const contexts = new Map<string, string | null>();
  mod.configure(f.admin, (text: string, _lang: string, previous: string | null) => {
    contexts.set(text, previous); active++; peak = Math.max(peak, active);
    return new Promise(resolve => pending.set(text, () => { active--; resolve(`Dịch ${text}`); }));
  });
  const logs: Array<Record<string, unknown>> = [];
  const originalLog = console.log;
  console.log = (label: string, fields: Record<string, unknown>) => {
    if (label.endsWith("transcript_segment_complete")) logs.push(fields);
  };
  try {
    const work = mod.handleTranscriptData(f.admin, f.payload, null);
    await waitFor(() => pending.size === 4);
    assert.equal(active, 4);
    assert.equal(f.partial.text, "Speaking");
    assert.equal(f.rows.length, 0);
    // Bound lookahead to four: a slow first sentence cannot create an unbounded ready backlog.
    for (const n of [4, 3, 2]) {
      await waitFor(() => pending.has(`Sentence ${n}.`));
      pending.get(`Sentence ${n}.`)?.();
    }
    assert.equal(f.rows.length, 0, "later sentences must not overtake sentence 1");
    assert.equal(pending.size, 4, "lookahead stays bounded while the writer waits");
    f.partial.updated_at = "2999-01-01T00:00:00Z";
    f.partial.text = "New segment speaking";
    pending.get("Sentence 1.")?.();
    await waitFor(() => f.rows.length === 4 && pending.has("Sentence 8."));
    assert.equal(f.rows.length, 4, "ready prefix commits while the tail still translates");
    for (const n of [8, 7, 6, 5]) pending.get(`Sentence ${n}.`)?.();
    await waitFor(() => pending.has("Sentence 9."));
    pending.get("Sentence 9.")?.();
    await work;
    assert.equal(peak, 4);
    assert.deepEqual(f.rows.map(row => [row.seq, row.text_source, row.ts_offset_sec]), [
      [1, "Sentence 1.", 0], [2, "Sentence 2.", 2], [3, "Sentence 3.", 4],
      [4, "Sentence 4.", 6], [5, "Sentence 5.", 8], [6, "Sentence 6.", 10],
      [7, "Sentence 7.", 12], [8, "Sentence 8.", 14], [9, "Sentence 9.", 16],
    ]);
    assert.equal(contexts.get("Sentence 1."), null);
    assert.equal(contexts.get("Sentence 5."), "Sentence 3.\nSentence 4.");
    assert.equal(f.partial.text, "New segment speaking");
    assert.equal(logs.length, 1);
    assert.equal(logs[0].sentence_count, 9);
    assert.equal(logs[0].inserted_count, 9);
    assert.ok(Number(logs[0].first_insert_ms) > 0);
    assert.ok(Number(logs[0].last_insert_ms) >= Number(logs[0].first_insert_ms));
    assert.equal((logs[0].translation_by_language as { en: { count: number } }).en.count, 9);
    assert.ok(Number(logs[0].processing_ms) >= Number(logs[0].last_insert_ms));
    assert.ok(Number(logs[0].translation_median_ms) >= 0);
    // Mixed replay: already-inserted sentences are not translated again but remain context.
    f.rows.splice(4); contexts.clear();
    mod.configure(f.admin, (text: string, _lang: string, previous: string | null) => {
      contexts.set(text, previous); return Promise.resolve(null);
    });
    await mod.handleTranscriptData(f.admin, f.payload, null);
    assert.equal(contexts.size, 5);
    assert.equal(contexts.get("Sentence 5."), "Sentence 3.\nSentence 4.");
    assert.equal(f.rows.length, 9);
    assert.equal(f.rows[4].text_vi, null, "failed translation preserves source row");
  } finally { console.log = originalLog; }
});

Deno.test("failed/duplicate insert and unreadable playback retain partial; active playback blocks writes", async () => {
  for (const mode of ["insert-failed", "duplicate", "playback-read-failed", "playback"]) {
    const f = segmentFixture();
    mod.configure(f.admin, () => {
      if (mode === "insert-failed") f.insertError = "XX000";
      if (mode === "duplicate") f.insertError = "23505";
      if (mode === "playback-read-failed") f.playbackUnreadable = true;
      if (mode === "playback") f.playback = true;
      return Promise.resolve("Translated");
    });
    await mod.handleTranscriptData(f.admin, f.payload, null);
    assert.equal(f.rows.length, 0, mode);
    assert.equal(f.partial.text, "Speaking", mode);
    assert.equal(f.clearCount, 0, mode);
  }
});

Deno.test("single-sentence commit retries a transient partial deletion failure", async () => {
  const f = segmentFixture();
  f.payload.data.data.words = f.payload.data.data.words.slice(0, 1);
  f.deleteFailures = 1;
  mod.configure(f.admin, () => Promise.resolve("Translated"));
  await mod.handleTranscriptData(f.admin, f.payload, null);
  assert.equal(f.rows.length, 1);
  assert.equal(f.partial.text, "");
  assert.equal(f.clearCount, 1);
});

Deno.test("first sentence of a new segment receives recent source context without rewriting the source", async () => {
  const f = segmentFixture();
  const contexts: Array<string | null> = [];
  mod.configure(f.admin, (text: string, _lang: string, previous: string | null) => {
    contexts.push(previous); return Promise.resolve(`English: ${text}`);
  }, ["Hoài An vừa chia sẻ.", "Chúng ta tiếp tục."]);
  await mod.handleTranscriptData(f.admin, { event: "transcript.data", data: { bot: { id: "bot-1" }, data: { words: [
    { text: "Xin chào.", start_timestamp: { relative: 12 } },
  ] } } });
  assert.deepEqual(contexts, ["Hoài An vừa chia sẻ.\nChúng ta tiếp tục."]);
  assert.equal(f.rows[0].text_source, "Xin chào.");
});

Deno.test("first ready sentence is visible before a slow later sentence; prefix replay does not duplicate it", async () => {
  const f = segmentFixture();
  f.payload.data.data.words = f.payload.data.data.words.slice(0, 2);
  let release: (() => void) | undefined;
  mod.configure(f.admin, (text: string) => text === "Sentence 1."
    ? Promise.resolve("Dịch đầu")
    : new Promise(resolve => { release = () => resolve("Dịch sau"); }));
  const work = mod.handleTranscriptData(f.admin, f.payload, null);
  await waitFor(() => f.rows.length === 1 && !!release);
  assert.equal(f.rows[0].text_source, "Sentence 1.");
  assert.equal(f.partial.text, "", "partial clears after the first durable row, not after the slow tail");
  release!(); await work;
  assert.deepEqual(f.rows.map(row => row.seq), [1, 2]);
  let replayCalls = 0;
  mod.configure(f.admin, () => { replayCalls++; return Promise.resolve("Unexpected"); });
  await mod.handleTranscriptData(f.admin, f.payload, null);
  assert.equal(replayCalls, 0); assert.equal(f.rows.length, 2);
});

Deno.test("translation exception keeps committed prefix, observes in-flight work and stops lookahead", async () => {
  const f = segmentFixture();
  const calls: string[] = [];
  mod.configure(f.admin, (text: string) => {
    calls.push(text);
    if (text === "Sentence 2." || text === "Sentence 4.") return Promise.reject(new Error("translation offline"));
    return Promise.resolve("Dịch đầu");
  });
  await assert.rejects(() => mod.handleTranscriptData(f.admin, f.payload, null), /translation offline/);
  assert.deepEqual(f.rows.map(row => row.seq), [1]);
  assert.ok(calls.length <= 5, "do not translate the entire remaining turn after a failure");
});

Deno.test("translation timing distinguishes Vietnamese and English without logging speech", async () => {
  const f = segmentFixture();
  f.payload.data.data.words = [
    { text: "Xin chào.", start_timestamp: { relative: 0 } },
    { text: "Welcome.", start_timestamp: { relative: 2 } },
  ];
  const captured: Array<{ label: string; fields: Record<string, unknown> }> = [];
  const originalLog = console.log;
  console.log = (label: string, fields: Record<string, unknown>) => captured.push({ label, fields });
  mod.configure(f.admin, () => Promise.resolve("Translated"));
  try {
    await mod.handleTranscriptData(f.admin, f.payload, null);
    const inserts = captured.filter(r => r.label.endsWith("caption_sentence_insert"));
    assert.deepEqual(inserts.map(r => r.fields.source_lang), ["vi", "en"]);
    assert.ok(inserts.every(r => typeof r.fields.translation_ms === "number"));
    const summary = captured.find(r => r.label.endsWith("transcript_segment_complete"))!;
    const timings = summary.fields.translation_by_language as Record<string, { count: number; total_ms: number }>;
    assert.equal(timings.vi.count, 1); assert.equal(timings.en.count, 1);
    assert.ok(timings.vi.total_ms >= 0); assert.ok(timings.en.total_ms >= 0);
    assert.ok(!JSON.stringify(captured).includes("Xin chào"));
  } finally { console.log = originalLog; }
});
