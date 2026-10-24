import assert from "node:assert/strict";
import ts from "npm:typescript@5.8.3";
import { computeDedupeKey, splitCaptionSentences } from "./caption-utils.ts";

const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
const handlers = source.slice(source.indexOf("interface TranscriptEvent"), source.indexOf("// ---------- Action: stop"));
const isolated = ts.transpileModule(`
let admin, translate;
export function configure(a, t) { admin = a; translate = t; }
function splitCaptionSentences(words) { return globalThis.__captionSplit(words); }
function wordsToSentence(words) { return globalThis.__captionSplit(words)[0] ?? { text: "", startSec: null }; }
function applyHearingCorrections(text) { return text; }
function detectSourceLang(text) { return /[ăâđêôơư]/i.test(text) ? "vi" : "en"; }
async function computeDedupeKey(...args) { return globalThis.__captionKey(...args); }
async function translateCaption(...args) { return translate(...args); }
function scheduleCaptionWork() {}
${handlers}
export { handleTranscriptData };
`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
(globalThis as Record<string, unknown>).__captionSplit = splitCaptionSentences;
(globalThis as Record<string, unknown>).__captionKey = computeDedupeKey;
const mod = await import(`data:application/javascript,${encodeURIComponent(isolated)}`);

Deno.test("translation receives previous source sentence as context but requests only current sentence", async () => {
  const translator = source.slice(source.indexOf("async function translateCaption"), source.indexOf("async function summarizeSession"));
  let request: Record<string, unknown> | null = null;
  const compiled = ts.transpileModule(`
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

Deno.test("long final turn writes ordered sentences as each translation completes and ignores replay", async () => {
  const rows: Array<Record<string, unknown>> = [];
  const translated: Array<{ text: string; previous: string | null }> = [];
  const admin = { from(table: string) {
    const filters: Array<(row: Record<string, unknown>) => boolean> = [];
    let descending = false;
    const query = {
      select() { return query; },
      update() { return query; },
      delete() { return query; },
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
    if (translated.length === 2) assert.equal(rows.length, 1, "first sentence is already visible while second translates");
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
  assert.notEqual(rows[0].dedupe_key, rows[1].dedupe_key);
  await mod.handleTranscriptData(admin, payload, null);
  assert.equal(rows.length, 2);
  assert.equal(translated.length, 2);
});
