import assert from "node:assert/strict";
import ts from "npm:typescript@5.8.3";
import { splitSummaryMessages } from "./summary-parts.ts";

const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
const deliveryCode = source.slice(source.indexOf("async function sendSummaryToCommunity"), source.indexOf("async function runSummarize"));
const isolated = ts.transpileModule(`
function splitSummaryMessages(text) { return globalThis.__splitSummary(text); }
let sendTelegram;
export function configure(sender) { sendTelegram = sender; }
function callCommunityTelegram(...args) { return sendTelegram(...args); }
${deliveryCode}
export { sendSummaryToCommunity };
`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
(globalThis as Record<string, unknown>).__splitSummary = splitSummaryMessages;
const mod = await import(`data:application/javascript,${encodeURIComponent(isolated)}`);

function fixture(rows: Array<Record<string, unknown>>) {
  const queries: Array<{ select?: string; order?: string; not?: string }> = [];
  const sent: Array<{ method: string; body: Record<string, unknown> }> = [];
  let groupResponse: unknown = { ok: true, status: 200, data: { ok: true, result: { message_id: 1 } } };
  const admin = { from(table: string) {
    assert.equal(table, "telegram_community_settings");
    const queryInfo: { select?: string; order?: string; not?: string } = {};
    queries.push(queryInfo);
    const query = {
      select(value: string) { queryInfo.select = value; return query; },
      not(field: string) { queryInfo.not = field; return query; },
      order(field: string, options: { ascending: boolean }) { queryInfo.order = `${field}:${options.ascending}`; return query; },
      limit(_count: number) { return query; },
      maybeSingle() { return Promise.resolve({ data: rows[0] ?? null, error: null }); },
      then(resolve: (value: unknown) => unknown) { return Promise.resolve(resolve({ data: rows.slice(0, 1), error: null })); },
    };
    return query;
  } };
  mod.configure(async (method: string, body: Record<string, unknown>) => {
    sent.push({ method, body });
    return body.chat_id === 42 ? { ok: true, status: 200, data: { ok: true } } : groupResponse;
  });
  return { admin, queries, sent, failGroup(value: unknown) { groupResponse = value; } };
}

Deno.test("summary uses dedicated destination from oldest settings row and marks DM delivered", async () => {
  const f = fixture([{ group_id: -1002379632770, caption_summary_chat_id: -1001649798056, member_alerts_chat_id: -100999 }]);
  await mod.sendSummaryToCommunity(f.admin, "📝 Summary", 42);
  assert.equal(f.queries[0].order, "created_at:true");
  assert.match(f.queries[0].select ?? "", /caption_summary_chat_id/);
  assert.equal(f.sent.length, 2);
  assert.equal(f.sent[0].body.chat_id, "-1001649798056");
  assert.equal(f.sent[1].body.chat_id, 42);
  assert.equal(f.sent[1].body.text, "📝 Summary\n📣 Tóm tắt đã được đăng vào nhóm cộng đồng.");
});

Deno.test("missing dedicated destination falls back to oldest configured member alerts chat", async () => {
  const f = fixture([{ group_id: -1002379632770, caption_summary_chat_id: null, member_alerts_chat_id: null }]);
  // The fallback query returns the oldest non-null alert destination.
  f.admin.from = ((original) => (table: string) => {
    const query = original(table);
    const oldMaybeSingle = query.maybeSingle;
    query.maybeSingle = () => f.queries.length > 1
      ? Promise.resolve({ data: { member_alerts_chat_id: -100777 }, error: null })
      : oldMaybeSingle();
    return query;
  })(f.admin.from);
  await mod.sendSummaryToCommunity(f.admin, "Summary", 42);
  assert.equal(f.queries[1].order, "created_at:true");
  assert.equal(f.queries[1].not, "member_alerts_chat_id");
  assert.equal(f.sent[0].body.chat_id, "-100777");
});

Deno.test("Telegram group failure logs destination and raw description, then explains it in DM", async () => {
  const f = fixture([{ caption_summary_chat_id: -1001649798056, member_alerts_chat_id: null }]);
  f.failGroup({ ok: false, status: 403, data: { ok: false, description: "Forbidden: bot is not a member of the chat" } });
  const originalWarn = console.warn;
  const warnings: unknown[][] = [];
  console.warn = (...args: unknown[]) => { warnings.push(args); };
  try { await mod.sendSummaryToCommunity(f.admin, "Summary", 42); }
  finally { console.warn = originalWarn; }
  assert.equal(f.sent.length, 2);
  assert.match(String(f.sent[1].body.text), /⚠️ Chưa đăng được tóm tắt vào nhóm cộng đồng \(lý do: Forbidden: bot is not a member of the chat\)\. Bé vẫn nhận bản sao tại đây\./);
  assert.ok(warnings.some(([message, detail]) => message === "[angel-caption] summary send to community failed" &&
    (detail as Record<string, unknown>).chat_id === "-1001649798056" &&
    (detail as Record<string, unknown>).description === "Forbidden: bot is not a member of the chat"));
});

Deno.test("no configured destination sends only a DM with one honest status line", async () => {
  const f = fixture([{ caption_summary_chat_id: null, member_alerts_chat_id: null }]);
  await mod.sendSummaryToCommunity(f.admin, "Summary", 42);
  assert.equal(f.sent.length, 1);
  assert.equal(f.sent[0].body.chat_id, 42);
  assert.match(String(f.sent[0].body.text), /^Summary\n⚠️ Chưa đăng được tóm tắt vào nhóm cộng đồng \(lý do: chưa cấu hình nhóm nhận\)\. Bé vẫn nhận bản sao tại đây\.$/);
});

const multipartText = () => [
  "📝 <b>Tóm tắt buổi họp</b>\n⏱ ~93 phút\n🔗 https://caption.example/test", "",
  "🎯 <b>1) Chủ đề chính / Main topic</b>\n• Thiền và thuyết trình / Meditation and presentations", "",
  "💡 <b>2) Điểm chính / Key points</b>\n• " + "Nội dung &amp; ánh sáng. ".repeat(95), "",
  "❓ <b>3) Câu hỏi &amp; trả lời / Q&amp;A</b>\n• <b>Q:</b> " + "Câu hỏi nguyên vẹn. ".repeat(65), "",
  "✅ <b>4) Việc cần làm / Actions</b>\n• " + "Thực hành mỗi ngày. ".repeat(55),
].join("\n");

Deno.test("long bilingual summary delivers both ordered parts to group and DM with status only on last DM", async () => {
  const f = fixture([{ caption_summary_chat_id: -10077 }]);
  await mod.sendSummaryToCommunity(f.admin, multipartText(), 42);
  const group = f.sent.filter(s => s.body.chat_id === "-10077").map(s => String(s.body.text));
  const dm = f.sent.filter(s => s.body.chat_id === 42).map(s => String(s.body.text));
  assert.equal(group.length, 2);
  assert.equal(dm.length, 2);
  assert.match(group[0], /phần 1\/2/);
  assert.match(group[1], /phần 2\/2/);
  assert.match(group[0], /🎯/); assert.match(group[0], /💡/);
  assert.doesNotMatch(group[0], /❓|✅/);
  assert.match(group[1], /❓/); assert.match(group[1], /✅/);
  assert.equal(dm[0], group[0]);
  assert.equal(dm[1], group[1] + "\n📣 Tóm tắt đã được đăng vào nhóm cộng đồng.");
  for (const part of [...group, ...dm]) assert.ok(part.length <= 3800);
  assert.deepEqual(f.sent.map(s=>s.body.chat_id), ["-10077", "-10077", 42, 42]);
});

Deno.test("failure on one group part still sends every other group and DM part with one final warning", async () => {
  const f = fixture([{ caption_summary_chat_id: -10077 }]);
  let groupCount = 0;
  mod.configure(async (method: string, body: Record<string, unknown>) => {
    f.sent.push({method,body});
    if (body.chat_id === "-10077" && ++groupCount === 1) throw new Error("network offline");
    return {ok:true,status:200,data:{}};
  });
  await mod.sendSummaryToCommunity(f.admin, multipartText(), 42);
  assert.equal(f.sent.length, 4);
  const dm = f.sent.filter(s=>s.body.chat_id===42).map(s=>String(s.body.text));
  assert.doesNotMatch(dm[0], /⚠️|📣/);
  assert.match(dm[1], /⚠️.*lỗi kết nối Telegram/);
  assert.doesNotMatch(dm[1], /📣/);
  assert.match(dm.join("\n"), /🎯[\s\S]*💡[\s\S]*❓[\s\S]*✅/);
});

Deno.test("a failed DM part does not prevent later DM parts", async () => {
  const f = fixture([{ caption_summary_chat_id: -10077 }]);
  let dmCount = 0;
  mod.configure(async (method:string,body:Record<string,unknown>)=>{
    f.sent.push({method,body});
    if(body.chat_id===42 && ++dmCount===1) throw new Error("temporary network error");
    return {ok:true,status:200,data:{}};
  });
  await mod.sendSummaryToCommunity(f.admin,multipartText(),42);
  assert.equal(f.sent.filter(s=>s.body.chat_id===42).length,2);
});

Deno.test("HTTP failure on the last group part is reported once after every DM part",async()=>{
  const f=fixture([{caption_summary_chat_id:-10077}]);
  let groupCount=0;
  mod.configure(async(method:string,body:Record<string,unknown>)=>{
    f.sent.push({method,body});
    return body.chat_id==="-10077" && ++groupCount===2
      ? {ok:false,status:403,data:{description:"Forbidden <group>"}}
      : {ok:true,status:200,data:{}};
  });
  await mod.sendSummaryToCommunity(f.admin,multipartText(),42);
  const dm=f.sent.filter(s=>s.body.chat_id===42).map(s=>String(s.body.text));
  assert.equal(dm.length,2);
  assert.doesNotMatch(dm[0],/📣|⚠️/);
  assert.match(dm[1],/⚠️.*Forbidden &lt;group&gt;/);
  assert.equal(dm.join("\n").split("⚠️").length-1,1);
});
