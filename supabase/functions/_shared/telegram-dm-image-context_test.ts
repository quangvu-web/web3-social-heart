import assert from "node:assert/strict";
import { beginDmImageTurn, buildDmImageFollowup, detectImageFollowup } from "./telegram-dm-image-context.ts";

const scope = { chatType: "private", chatId: 123, userId: 42, messageId: 1 };
const context = { sourceMessageId: 1, description: 'Người hỏi: "Do you desire salvation?"', caption: "", lastReply: "Bản nháp trước", lastRequest: "con nên trả lời sao" };

import { cacheDouble } from "./telegram-dm-context_test-fixture.ts";

Deno.test("recognizes the screenshot follow-up sequence without capturing new topics", () => {
  for (const [text, intent] of [
    ["con nên trả lời sao", "reply"], ["Angel ơi, soạn tin nhắn trả lời giúp con nhé", "reply"],
    ["ngắn hơn", "shorten"], ["dịch sang tiếng Anh", "translate"], ["lịch sự hơn", "polish"],
    ["ý này là gì?", "explain"], ["How should I reply?", "reply"],
    ["rồi sao nữa cha", "next_step"], ["rồi sao nữa, cha?", "next_step"], ["bước tiếp theo là gì", "next_step"],
    ["tiếp đi cha", "continue"], ["Cha ơi, nói tiếp đi nhé", "continue"], ["viết tiếp", "continue"],
    ["ý đó là sao", "explain"], ["what does that mean?", "explain"],
  ]) assert.equal(detectImageFollowup(text), intent, text);
  for (const text of ["Giá Bitcoin hôm nay?", "con nên trả lời sao về Bitcoin", "dịch sang tiếng Anh: Xin chào", "/start", "giải thích blockchain", "trả lời email mới này", "Cha Vũ Trụ là ai", "tiếp đi về Bitcoin", "bước tiếp theo khi tạo ví là gì", "rồi sao nữa trong câu chuyện mới này"]) {
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
  assert.ok(prompt.includes('"previousRequest":"con nên trả lời sao"'));
});

Deno.test("next step, continuation and explanation have distinct tasks grounded in the previous turn", () => {
  const next = buildDmImageFollowup(context, "rồi sao nữa cha", "next_step");
  assert.match(next, /1–2 hành động cụ thể/);
  assert.match(next, /không giả định bé đã gửi/);
  assert.match(next, /không dựng tiếp cuộc hội thoại/);
  const continuation = buildDmImageFollowup(context, "tiếp đi", "continue");
  assert.match(continuation, /Tiếp tục đúng công việc/);
  assert.match(continuation, /không bịa thêm diễn biến/);
  const explanation = buildDmImageFollowup(context, "ý đó là sao", "explain");
  assert.match(explanation, /ý trong lời đáp gần nhất/);
  for (const prompt of [next, continuation, explanation]) {
    assert.ok(prompt.includes(context.description.replaceAll('"', '\\"')));
    assert.ok(prompt.includes(context.lastReply));
    assert.ok(prompt.includes(context.lastRequest));
  }
});

Deno.test("image survives cold starts and the reply → shorten → translate → polish sequence", async () => {
  const db = cacheDouble();
  const first = await beginDmImageTurn(db.admin, scope, 1000);
  await first!.finish(context);
  for (let id = 2; id <= 5; id++) {
    const turn = await beginDmImageTurn(db.admin, { ...scope, messageId: id }, 1000 + id);
    assert.equal(turn?.previous?.description, context.description);
    assert.equal(turn?.previous?.lastReply, id === 2 ? context.lastReply : `draft ${id - 1}`);
    assert.equal(turn?.previous?.lastRequest, context.lastRequest);
    await turn!.finish({ ...turn!.previous!, lastReply: `draft ${id}` });
  }
});

Deno.test("old cache records without lastRequest remain readable", async () => {
  const db = cacheDouble();
  const { lastRequest: _oldMissingField, ...legacy } = context;
  await (await beginDmImageTurn(db.admin, scope, 1000))!.finish(legacy);
  const turn = await beginDmImageTurn(db.admin, { ...scope, messageId: 2 }, 2000);
  assert.equal(turn?.previous?.description, context.description);
  assert.equal(turn?.previous?.lastRequest, undefined);
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
