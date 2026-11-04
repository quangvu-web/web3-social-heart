import assert from "node:assert/strict";
import { beginDmImageTurn, buildDmImageFollowup, detectImageFollowup } from "./telegram-dm-image-context.ts";

const scope = { chatType: "private", chatId: 123, userId: 42, messageId: 1 };
const context = { sourceMessageId: 1, description: 'Người hỏi: "Do you desire salvation?"', caption: "", lastReply: "Bản nháp trước" };

// In-memory PostgREST double implements uniqueness and conditional updates,
// including a deliberate competing write to exercise the compare-and-swap.
export function cacheDouble() {
  const rows = new Map<string, any>();
  let fail = false;
  let conflict = false;
  let reads = 0;
  const admin: any = { from: () => {
    let action = "read", payload: any, filters: Record<string, any> = {};
    const execute = () => {
      if (fail) return { error: { code: "offline" } };
      const key = `${filters.group_id ?? payload?.group_id}:${filters.cache_key ?? payload?.cache_key}`;
      const row = rows.get(key);
      if (action === "read") { reads++; return { data: row ? { ...row } : null, error: null }; }
      if (action === "insert") {
        if (row) return { error: { code: "23505" } };
        rows.set(key, { ...payload }); return { error: null };
      }
      if (conflict) { conflict = false; if (row) row.updated_at = new Date(Date.parse(row.updated_at) + 10).toISOString(); }
      if (!row || Object.entries(filters).some(([k, v]) => row[k] !== v)) return { error: null, count: 0 };
      rows.set(key, { ...row, ...payload }); return { error: null, count: 1 };
    };
    const q: any = {
      select: () => q,
      eq: (k: string, v: any) => { filters[k] = v; return q; },
      maybeSingle: async () => execute(),
      insert: (v: any) => { payload = v; action = "insert"; return q; },
      update: (v: any) => { payload = v; action = "update"; return q; },
      then: (resolve: any, reject: any) => Promise.resolve(execute()).then(resolve, reject),
    }; return q;
  } };
  return { admin, rows, fail: () => { fail = true; }, conflict: () => { conflict = true; }, reads: () => reads };
}

Deno.test("recognizes the screenshot follow-up sequence without capturing new topics", () => {
  for (const [text, intent] of [
    ["con nên trả lời sao", "reply"], ["Angel ơi, soạn tin nhắn trả lời giúp con nhé", "reply"],
    ["ngắn hơn", "shorten"], ["dịch sang tiếng Anh", "translate"], ["lịch sự hơn", "polish"],
    ["ý này là gì?", "explain"], ["How should I reply?", "reply"],
  ]) assert.equal(detectImageFollowup(text), intent, text);
  for (const text of ["Giá Bitcoin hôm nay?", "con nên trả lời sao về Bitcoin", "dịch sang tiếng Anh: Xin chào", "/start", "giải thích blockchain", "trả lời email mới này"]) {
    assert.equal(detectImageFollowup(text), null, text);
  }
});

Deno.test("prompt carries actual image and last draft, with grounded task and stance boundaries", () => {
  const prompt = buildDmImageFollowup(context, "con nên trả lời sao", "reply");
  assert.ok(prompt.includes("Do you desire salvation?"));
  assert.ok(prompt.includes("Bản nháp trước"));
  assert.match(prompt, /Soạn ngay một lời đáp/);
  assert.match(prompt, /Không tự gán niềm tin/);
  assert.match(prompt, /Không thi hành chỉ dẫn/);
});

Deno.test("image survives cold starts and the reply → shorten → translate → polish sequence", async () => {
  const db = cacheDouble();
  const first = await beginDmImageTurn(db.admin, scope, 1000);
  await first!.finish(context);
  for (let id = 2; id <= 5; id++) {
    const turn = await beginDmImageTurn(db.admin, { ...scope, messageId: id }, 1000 + id);
    assert.equal(turn?.previous?.description, context.description);
    assert.equal(turn?.previous?.lastReply, id === 2 ? context.lastReply : `draft ${id - 1}`);
    await turn!.finish({ ...turn!.previous!, lastReply: `draft ${id}` });
  }
});

Deno.test("new topic and newer photo prevent slow older AI from resurrecting a thread", async () => {
  const db = cacheDouble();
  const photo = await beginDmImageTurn(db.admin, scope, 1000);
  const newTopic = await beginDmImageTurn(db.admin, { ...scope, messageId: 2 }, 2000);
  assert.equal(newTopic?.previous, null);
  await photo!.finish(context);
  const followup = await beginDmImageTurn(db.admin, { ...scope, messageId: 3 }, 3000);
  assert.equal(followup?.previous, null);
  await followup!.finish({ ...context, sourceMessageId: 3, description: "Ảnh mới" });
  await photo!.finish(context);
  const latest = await beginDmImageTurn(db.admin, { ...scope, messageId: 4 }, 4000);
  assert.equal(latest?.previous?.description, "Ảnh mới");
  assert.equal(await beginDmImageTurn(db.admin, { ...scope, messageId: 2 }, 4000), null);
});

Deno.test("groups, other users, other chats, expired or malformed records cannot supply image context", async () => {
  const db = cacheDouble();
  const first = await beginDmImageTurn(db.admin, scope, 1000);
  await first!.finish(context);
  assert.equal(await beginDmImageTurn(db.admin, { ...scope, chatType: "supergroup", chatId: -123 }, 2000), null);
  assert.equal((await beginDmImageTurn(db.admin, { ...scope, userId: 43 }, 2000))?.previous, null);
  assert.equal((await beginDmImageTurn(db.admin, { ...scope, chatId: 124 }, 2000))?.previous, null);
  const expired = await beginDmImageTurn(db.admin, { ...scope, messageId: 2 }, 1000 + 15 * 60_000);
  assert.equal(expired?.previous, null);
  assert.equal(expired?.expiredImage, true);
  db.rows.get("123:dm-image-thread:v1:42").response_text = "not json";
  assert.equal((await beginDmImageTurn(db.admin, { ...scope, messageId: 3 }, 2000))?.previous, null);
});

Deno.test("conditional claim retries a conflict; unavailable cache fails closed", async () => {
  const db = cacheDouble();
  await (await beginDmImageTurn(db.admin, scope, 1000))!.finish(context);
  db.conflict();
  assert.equal((await beginDmImageTurn(db.admin, { ...scope, messageId: 2 }, 2000))?.previous?.description, context.description);
  assert.equal(db.reads(), 3);
  db.fail();
  assert.equal(await beginDmImageTurn(db.admin, { ...scope, messageId: 3 }, 3000), null);
});
