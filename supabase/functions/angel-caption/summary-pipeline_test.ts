import assert from "node:assert/strict";
import ts from "npm:typescript@5.8.3";
import { formatSummaryForTelegram } from "./summary-format.ts";

const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
const summaryCode = source.slice(source.indexOf("async function summarizeSession"), source.indexOf("// ---------- Telegram: gửi tóm tắt"));
const compiled = ts.transpileModule(`
const GLOSSARY_NOTE = "Keep names unchanged.";
const MODELS = { style_pass: { id: "fixture-model" } };
let gateway;
export function configure(value) { gateway = value; }
function callAiGateway(...args) { return gateway(...args); }
function gatewayText(result) { return (result.data?.choices?.[0]?.message?.content ?? "").trim(); }
${summaryCode}
export { summarizeSession };
`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const mod = await import(`data:application/javascript,${encodeURIComponent(compiled)}`);

type Line = { speaker_name: string | null; text_source: string; text_vi: string | null; text_en: string | null };
type Request = { messages: Array<{ role: string; content: string }> };
const line = (text: string, speaker: string | null = "MC", en: string | null = null): Line => ({
  speaker_name: speaker, text_source: text, text_vi: null, text_en: en,
});
const success = (text: string) => ({ ok: true, status: 200, data: { choices: [{ message: { content: text }, finish_reason: "stop" }] } });
const mapNote = (text: string) => JSON.stringify({ main_points: [text], qa: [], speakers: ["MC"], source_titles: ["Paper 165"], session_stages: [text], meditation: [], presentations: [], music_dance: [], mc_audience: [], other_activities: [] });
const finalText = "🎯 **1) Chủ đề chính / Main topic**\n- Chủ đề / Topic\n💡 **2) Điểm chính / Key points**\n- Nội dung / Content\n❓ **3) Câu hỏi & trả lời nổi bật / Notable Q&A**\n**- Câu hỏi:** Nội dung?\n**- Trả lời:** Nội dung.\n✅ **4) Việc cần làm sau họp / Action items**\n- Không có / None";

const mergeNote = (overrides: Record<string, string[]> = {}) => JSON.stringify({
  topic: ["Chủ đề", "Topic"], main_points: ["Nội dung", "Content"],
  meditation: ["", ""], presentations: ["", ""], music_dance: ["", ""], mc_audience: ["", ""], other_activities: ["", ""],
  qa: ["Nội dung?", "Nội dung.", "Content?", "Content."], actions: ["Không có", "None"], ...overrides,
});
const longText = "🎯 **1) Chủ đề chính / Main topic**\n- Chủ đề\n- Topic\n\n💡 **2) Điểm chính / Key points**\n- Nội dung\n- Content\n\n❓ **3) Câu hỏi & trả lời nổi bật / Notable Q&A**\n- **Câu hỏi:** Nội dung?\n- **Trả lời:** Nội dung.\n- **Q:** Content?\n- **A:** Content.\n\n✅ **4) Việc cần làm sau họp / Action items**\n- Không có\n- None";

Deno.test("summary <=24000 characters preserves a single call and Telegram bilingual formatting", async () => {
  for (const length of [23_999, 24_000]) {
    const requests: Request[] = [];
    mod.configure((request: Request) => { requests.push(request); return Promise.resolve(success(finalText)); });
    // '[MC] ' contributes exactly five characters.
    const result = await mod.summarizeSession([line("x".repeat(length - 5))], "short-session");
    assert.equal(requests.length, 1);
    assert.equal(requests[0].messages[1].content, `TRANSCRIPT:\n[MC] ${"x".repeat(length - 5)}`);
    assert.deepEqual(result, { vi: finalText, en: finalText });
    const telegram = formatSummaryForTelegram(result.vi);
    assert.match(telegram, /🎯 <b>1\) Chủ đề chính \/ Main topic<\/b>/);
    assert.match(telegram, /• Chủ đề \/ Topic/);
    assert.match(telegram, /<b>- Câu hỏi:<\/b>/);
  }
});

Deno.test("long summary sends every whole line to bounded chunks and reduces all ordered notes", async () => {
  const input = Array.from({ length: 600 }, (_, i) => line(`Dòng ${i + 1}: ${"nội dung ".repeat(13)}`, i >= 294 ? "Thu Huyền" : "MC", `English ${i + 1}`));
  input[0] = line("Thiền mở đầu — Urantia Book Paper 165", "MC");
  input[150] = line("Jesus giảng về tin tưởng và của cải", "Người đọc");
  input[294] = line("Bài thuyết trình", "Thu Huyền");
  input[555] = line("Các em bé nghe nhạc ánh sáng và nhảy cùng nhau", "MC");
  input[568] = line("MC đọc tin nhắn chúc mừng và trò chuyện khán giả", "MC");
  const requests: Array<{ body: Request; label: string }> = [];
  const logs: Array<Record<string, unknown>> = [];
  const originalLog = console.log;
  console.log = (label: string, detail: Record<string, unknown>) => { if (label === "[angel-caption] summary_pipeline") logs.push(detail); };
  mod.configure((body: Request, opts: { label: string }) => {
    requests.push({ body, label: opts.label });
    return Promise.resolve(success(opts.label === "caption-summarize-map" ? mapNote(`Ghi chú chặng ${requests.length}`) : mergeNote()));
  });
  try {
    const result = await mod.summarizeSession(input, "long-session");
    assert.ok(result?.vi.includes("- Bài đọc: Paper 165."));
    assert.equal(result.vi.replace("- Bài đọc: Paper 165.\n", "").replace("- Reading: Paper 165.\n", ""), longText);
    assert.equal(result.en, result.vi);
  } finally { console.log = originalLog; }
  const maps = requests.filter(request => request.label === "caption-summarize-map");
  assert.ok(maps.length > 1, "long transcript must use map calls, not prefix truncation");
  const expected = input.map(l => `[${l.speaker_name ?? "?"}] ${l.text_source}${l.text_en && l.text_en !== l.text_source ? ` / ${l.text_en}` : ""}`).join("\n");
  assert.equal(maps.map(request => request.body.messages[1].content.split("TRANSCRIPT:\n")[1]).join("\n"), expected);
  for (const request of maps) {
    assert.ok(request.body.messages[1].content.split("TRANSCRIPT:\n")[1].length <= 8_000);
    assert.match(request.body.messages[0].content, /phần âm nhạc/i);
  }
  const reduce = requests.at(-1)!;
  assert.equal(reduce.label, "caption-summarize-reduce");
  for (let i = 1; i <= maps.length; i++) assert.ok(reduce.body.messages[1].content.includes(`Ghi chú chặng ${i}`));
  assert.match(reduce.body.messages[0].content, /không.*(?:bỏ|lược).*ngắn/i);
  assert.match(reduce.body.messages[0].content, /MC/);
  assert.doesNotMatch(reduce.body.messages[0].content, /3[–-]7/, "long summaries must not retain a point-count cap that crowds out brief stages");
  assert.equal(logs.length, 1);
  assert.equal(logs[0].session_id, "long-session");
  assert.equal(logs[0].ai_call_count, maps.length + 1);
  assert.equal(logs[0].chunk_count, maps.length);
});

Deno.test("24001-character singleton takes map/reduce without splitting or discarding the oversized line", async () => {
  const requests: Array<{ body: Request; label: string }> = [];
  const text = "x".repeat(23_996);
  mod.configure((body: Request, opts: { label: string }) => {
    requests.push({ body, label: opts.label });
    return Promise.resolve(success(opts.label === "caption-summarize-map" ? mapNote("Ghi chú đủ dòng") : mergeNote()));
  });
  await mod.summarizeSession([line(text)], "oversized-singleton");
  assert.deepEqual(requests.map(request => request.label), ["caption-summarize-map", "caption-summarize-reduce"]);
  assert.equal(requests[0].body.messages[1].content.split("TRANSCRIPT:\n")[1], `[MC] ${text}`);
});

Deno.test("map concurrency is bounded at three and reversed completions still reduce chronological notes", async () => {
  const pending = new Map<number, (value: unknown) => void>();
  const requests: Array<{ body: Request; label: string }> = [];
  let active = 0, peak = 0;
  mod.configure((body: Request, opts: { label: string }) => {
    requests.push({ body, label: opts.label });
    if (opts.label === "caption-summarize-reduce") return Promise.resolve(success(mergeNote()));
    const index = Number(body.messages[1].content.match(/^CHẶNG (\d+)/)?.[1]);
    active++; peak = Math.max(peak, active);
    return new Promise(resolve => pending.set(index, (value: unknown) => { active--; resolve(value); }));
  });
  const input = Array.from({ length: 8 }, (_, i) => line(`${i}: ${"x".repeat(3_980)}`));
  const work = mod.summarizeSession(input, "ordered");
  const settle = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
  await settle();
  assert.equal(pending.size, 3);
  pending.get(3)?.(success(mapNote("THIRD"))); await settle();
  assert.ok(pending.has(4));
  pending.get(4)?.(success(mapNote("FOURTH")));
  pending.get(2)?.(success(mapNote("SECOND")));
  pending.get(1)?.(success(mapNote("FIRST")));
  await work;
  assert.equal(peak, 3);
  const merged = requests.at(-1)!.body.messages[1].content;
  assert.ok(merged.indexOf("FIRST") < merged.indexOf("SECOND"));
  assert.ok(merged.indexOf("SECOND") < merged.indexOf("THIRD"));
  assert.ok(merged.indexOf("THIRD") < merged.indexOf("FOURTH"));
  assert.doesNotMatch(merged, /Paper 165/, "unquoted map titles must not be trusted when absent from the source");
  assert.ok(merged.endsWith("- Chặng 1: FIRST\n- Chặng 2: SECOND\n- Chặng 3: THIRD\n- Chặng 4: FOURTH"));
});

Deno.test("failed, blank or truncated map never produces or sends a prefix-only final summary", async () => {
  for (const failure of [
    { ok: false, status: 503, data: null }, success(""), success("not JSON"), success(JSON.stringify({main_points:["partial schema"]})),
    success(JSON.stringify({main_points:[],qa:[],speakers:[],source_titles:[],session_stages:[],meditation:[],presentations:[],music_dance:[],mc_audience:[],other_activities:[]})),
    { ok: true, status: 200, data: { choices: [{ message: { content: "Bị cắt" }, finish_reason: "length" }] } },
  ]) {
    const labels: string[] = [];
    mod.configure((_body: Request, opts: { label: string }) => { labels.push(opts.label); return Promise.resolve(failure); });
    const result = await mod.summarizeSession(Array.from({ length: 8 }, () => line("x".repeat(4_000))), "map-failure");
    assert.equal(result, null);
    assert.equal(labels.includes("caption-summarize-reduce"), false);
    assert.ok(labels.length <= 3, "stop scheduling chunks after the first failure");
  }
});

Deno.test("reduce failure returns no summary instead of publishing intermediate notes", async () => {
  const labels: string[] = [];
  mod.configure((_body: Request, opts: { label: string }) => {
    labels.push(opts.label);
    return Promise.resolve(opts.label === "caption-summarize-map" ? success(mapNote("Ghi chú chặng")) : { ok: false, status: 503, data: null });
  });
  assert.equal(await mod.summarizeSession([line("x".repeat(24_000))], "reduce-failure"), null);
  assert.deepEqual(labels, ["caption-summarize-map", "caption-summarize-reduce"]);
});

const realFixturePath = Deno.env.get("CAPTION_SUMMARY_FIXTURE_PATH");
Deno.test({
  name: "real session dry run forwards all 600 lines across 8 maps and 1 reduce (not AI content acceptance)",
  ignore: !realFixturePath,
  async fn() {
    const { rows } = JSON.parse(await Deno.readTextFile(realFixturePath!));
    const requests: Array<{ body: Request; label: string }> = [];
    mod.configure((body: Request, opts: { label: string }) => {
      requests.push({ body, label: opts.label });
      return Promise.resolve(success(opts.label === "caption-summarize-map" ? mapNote(`Note ${requests.length}`) : mergeNote()));
    });
    await mod.summarizeSession(rows, "jc8aa6fq3z89");
    assert.equal(rows.length, 600);
    const expected = rows.map((l: Line) => `[${l.speaker_name ?? "?"}] ${l.text_source}${l.text_en && l.text_en !== l.text_source ? ` / ${l.text_en}` : ""}`).join("\n");
    assert.equal(expected.length, 61_867);
    const maps = requests.filter(request => request.label === "caption-summarize-map");
    assert.equal(maps.length, 8);
    assert.equal(requests.length, 9);
    assert.equal(maps.map(request => request.body.messages[1].content.split("TRANSCRIPT:\n")[1]).join("\n"), expected);
    assert.equal(requests.at(-1)?.label, "caption-summarize-reduce");
  },
});

Deno.test("short summary preserves the existing Gateway response handling", async () => {
  const response = success(finalText);
  response.data.choices[0].finish_reason = "length";
  mod.configure(() => Promise.resolve(response));
  assert.deepEqual(await mod.summarizeSession([line("Short meeting")], "short-response"), { vi: finalText, en: finalText });
});

Deno.test("map requests an explicit notes schema and accepts fenced valid JSON without dropping its stage ledger", async () => {
  const bodies: Request[] = [];
  mod.configure((body: Request, opts: {label:string}) => {
    bodies.push(body);
    return Promise.resolve(success(opts.label === "caption-summarize-map" ? "```json\n" + mapNote("MC đọc tin nhắn") + "\n```" : mergeNote()));
  });
  assert.deepEqual(await mod.summarizeSession([line("x".repeat(24_000))], "fenced-map"), {vi:longText,en:longText});
  const format = (bodies[0] as Request & {response_format:any}).response_format;
  assert.equal(format.type, "json_schema");
  assert.equal(format.json_schema.strict, true);
  assert.deepEqual(format.json_schema.schema.required, ["main_points", "qa", "speakers", "source_titles", "session_stages", "meditation", "presentations", "music_dance", "mc_audience", "other_activities"]);
  assert.equal(format.json_schema.schema.additionalProperties, false);
  for (const field of format.json_schema.schema.required) {
    assert.deepEqual(format.json_schema.schema.properties[field], {type:"array",items:{type:"string"}});
  }
  const reducedFormat = (bodies[1] as Request & {response_format:any}).response_format;
  assert.equal(reducedFormat.type, "json_schema");
  assert.ok(reducedFormat.json_schema.schema.required.includes("mc_audience"));
  assert.match(bodies[1].messages[1].content, /MC đọc tin nhắn/);
});

Deno.test("oversized long-session reduce output is rejected without truncating stages or adding AI calls", async () => {
  const labels: string[] = [];
  mod.configure((_body: Request, opts: {label:string}) => {
    labels.push(opts.label);
    return Promise.resolve(success(opts.label === "caption-summarize-map" ? mapNote("MC đọc tin nhắn") : mergeNote({main_points:["x".repeat(3_501),"Content"]})));
  });
  assert.equal(await mod.summarizeSession([line("x".repeat(24_000))], "telegram-budget"), null);
  assert.deepEqual(labels, ["caption-summarize-map", "caption-summarize-reduce"]);
});

Deno.test("required MC activity cannot disappear from rendered bilingual points", async () => {
  const input = [line("Paper 165 " + "x".repeat(24_000))];
  const mapped = JSON.parse(mapNote("Nội dung"));
  mapped.source_titles = ["Paper 140"];
  mapped.mc_audience = ["MC đọc lời chúc mừng và giao lưu khán giả"];
  let reduction: Record<string,string[]> = {mc_audience:["",""]};
  mod.configure((_body:Request,opts:{label:string}) => Promise.resolve(success(opts.label === "caption-summarize-map" ? JSON.stringify(mapped) : mergeNote(reduction))));
  assert.equal(await mod.summarizeSession(input, "required-MC"), null, "missing required activity must fail rather than silently omit it");
  reduction = {mc_audience:["MC đọc lời chúc mừng và giao lưu khán giả", "The MC read congratulations and interacted with the audience"]};
  const result = await mod.summarizeSession(input, "required-MC");
  assert.ok(result?.vi.includes("- MC đọc lời chúc mừng và giao lưu khán giả"));
  assert.ok(result?.vi.includes("- The MC read congratulations and interacted with the audience"));
  assert.ok(result?.vi.includes("Paper 165"));
  assert.equal(result?.vi.includes("Paper 140"),false);
  const telegram = formatSummaryForTelegram(result.vi);
  assert.match(telegram, /• MC đọc lời chúc/);
  assert.match(telegram, /<b>1\) Chủ đề chính/);
});

Deno.test("reduce cannot introduce a Paper number absent from transcript evidence", async () => {
  mod.configure((_body:Request,opts:{label:string}) => Promise.resolve(success(opts.label === "caption-summarize-map" ? mapNote("Bài đọc") : mergeNote({main_points:["Jesus giảng Paper 140", "Jesus taught Paper 140"]}))));
  assert.equal(await mod.summarizeSession([line("Paper 165 " + "x".repeat(24_000))], "grounded-paper"), null);
});

Deno.test("AI translation cannot verify a title or Paper number that conflicts with raw speech", async () => {
  const mapped = JSON.parse(mapNote("Nội dung"));
  mapped.source_titles = ["FakeBook", "Paper 140"];
  const input = [line("Paper 165 " + "x".repeat(24_000), "MC", "FakeBook Paper 140")];
  let reduction = mergeNote({main_points:["Paper 140", "Paper 140"]});
  mod.configure((_body:Request,opts:{label:string}) => Promise.resolve(success(opts.label === "caption-summarize-map" ? JSON.stringify(mapped) : reduction)));
  assert.equal(await mod.summarizeSession(input,"raw-provenance"),null);
  reduction = mergeNote();
  const result = await mod.summarizeSession(input,"raw-provenance");
  assert.ok(result?.vi.includes("Paper 165"));
  assert.equal(result?.vi.includes("Paper 140"),false);
  assert.equal(result?.vi.includes("FakeBook"),false);
});

Deno.test("a raw Vietnamese Bài number remains valid when rendered as English Paper", async () => {
  const mapped = JSON.parse(mapNote("Bài đọc")); mapped.source_titles = ["Bài 165"];
  mod.configure((_body:Request,opts:{label:string}) => Promise.resolve(success(opts.label === "caption-summarize-map" ? JSON.stringify(mapped) : mergeNote({main_points:["Nội dung", "Reading Paper 165"]}))));
  const result = await mod.summarizeSession([line("Bài 165 " + "x".repeat(24_000),"MC","Paper 140")],"vietnamese-paper");
  assert.ok(result?.vi.includes("Bài 165"));
  assert.ok(result?.vi.includes("Reading Paper 165"));
  assert.equal(result?.vi.includes("Paper 140"),false);
});
