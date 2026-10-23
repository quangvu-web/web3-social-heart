import assert from "node:assert/strict";
import ts from "npm:typescript@5.8.3";

const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
const deliveryCode = source.slice(source.indexOf("async function sendSummaryToCommunity"), source.indexOf("async function runSummarize"));
const isolated = ts.transpileModule(`
let sendTelegram;
export function configure(sender) { sendTelegram = sender; }
function callCommunityTelegram(...args) { return sendTelegram(...args); }
${deliveryCode}
export { sendSummaryToCommunity };
`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
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
