import assert from "node:assert/strict";
import ts from "npm:typescript@5.8.3";
import { formatSummaryForTelegram } from "./summary-format.ts";

const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
const code = source.slice(source.indexOf("async function runSummarize"), source.indexOf("// Lazy work factories"));
const compiled = ts.transpileModule(`
let summarize, deliver;
export function configure(s, d) { summarize = s; deliver = d; }
function summarizeSession(...args) { return summarize(...args); }
function sendSummaryToCommunity(...args) { return deliver(...args); }
function captionUrl(code) { return "https://caption.example/" + code; }
function escapeHtml(text) { return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;"); }
function formatSummaryForTelegram(text) { return globalThis.__summaryFormat(text); }
${code}
export { runSummarize };
`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
(globalThis as Record<string, unknown>).__summaryFormat = formatSummaryForTelegram;
const mod = await import(`data:application/javascript,${encodeURIComponent(compiled)}`);

function fixture(count: number, failPage = -1) {
  const rows = Array.from({ length: count }, (_, i) => ({ speaker_name: "MC", text_source: `Dòng ${i + 1}`, text_vi: null, text_en: null }));
  const read: Array<{ start: number; end: number; orders: string[] }> = [];
  const deliveries: Array<{ text: string; dm: number }> = [];
  let summarized: typeof rows = [], sessionId: string | undefined;
  const session = { id: "session-1", public_code: "test-code", created_by_chat_id: 42,
    started_at: "2026-10-26T00:00:00Z", ended_at: "2026-10-26T01:33:00Z", created_at: "2026-10-26T00:00:00Z" };
  const admin = { from(table: string) {
    let start = 0, end = 999;
    const orders: string[] = [];
    const query = {
      select() { return query; }, eq() { return query; },
      order(key: string) { orders.push(key); return query; },
      limit(value: number) { end = value - 1; return query; },
      range(a: number, b: number) { start = a; end = b; return query; },
      maybeSingle() { assert.equal(table, "caption_sessions"); return Promise.resolve({ data: session }); },
      then(resolve: (value: unknown) => void) {
        read.push({ start, end, orders });
        resolve(read.length - 1 === failPage ? { data: null, error: { code: "page-failed" } } : { data: rows.slice(start, end + 1), error: null });
      },
    };
    return query;
  } };
  mod.configure((lines: typeof rows, id: string) => { summarized = lines; sessionId = id; return Promise.resolve({ vi: "🎯 **Chủ đề / Topic**\n- Đuôi phiên / Final stage", en: "same" }); },
    (_admin: unknown, text: string, dm: number) => { deliveries.push({ text, dm }); return Promise.resolve(); });
  return { admin, rows, read, deliveries, get summarized() { return summarized; }, get sessionId() { return sessionId; } };
}

Deno.test("summary loads every chronological page beyond 1000 rows before existing duration/formatter/delivery", async () => {
  const f = fixture(1205);
  await mod.runSummarize(f.admin, "session-1");
  assert.equal(f.summarized.length, 1205);
  assert.equal(f.summarized.at(-1)?.text_source, "Dòng 1205");
  assert.deepEqual(f.read.map(page => [page.start, page.end]), [[0, 999], [1000, 1999]]);
  assert.deepEqual(f.read[0].orders, ["seq", "id"]);
  assert.equal(f.sessionId, "session-1");
  assert.equal(f.deliveries.length, 1);
  assert.equal(f.deliveries[0].dm, 42);
  assert.match(f.deliveries[0].text, /~93 phút \/ min/);
  assert.match(f.deliveries[0].text, /🎯 <b>Chủ đề \/ Topic<\/b>\n• Đuôi phiên \/ Final stage/);
});

Deno.test("failure loading a later summary page never publishes a prefix-only summary", async () => {
  const f = fixture(1205, 1);
  await mod.runSummarize(f.admin, "session-1");
  assert.equal(f.summarized.length, 0);
  assert.equal(f.deliveries.length, 0);
});

Deno.test("short summary still loads one page and keeps the existing delivery envelope", async () => {
  const f = fixture(10);
  await mod.runSummarize(f.admin, "session-1");
  assert.equal(f.read.length, 1);
  assert.equal(f.deliveries.length, 1);
  assert.match(f.deliveries[0].text, /^📝 <b>Tóm tắt buổi họp \(phụ đề Angel Translator\)<\/b>/);
});
