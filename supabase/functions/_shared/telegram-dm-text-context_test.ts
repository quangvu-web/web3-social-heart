import assert from "node:assert/strict";
import { beginDmTextTurn, buildDmDefinitionQuestion, buildDmDetailedQuestion, buildDmTextFollowup, detectTextFollowup, dmTextDepthPolicy } from "./telegram-dm-text-context.ts";
import { beginDmImageTurn } from "./telegram-dm-image-context.ts";
import { cacheDouble } from "./telegram-dm-context_test-fixture.ts";

const scope = { chatType: "private", chatId: 123, userId: 42, messageId: 1 };
const context = { topic: "tự do tuyệt đối là gì", request: "tự do tuyệt đối là gì", reply: "Đây là một lý tưởng triết học có nhiều cách hiểu." };

Deno.test("text continuation carries the actual topic/request/reply and distinguishes beliefs from verified facts", () => {
  assert.equal(detectTextFollowup("tiếp đi cha"), "continue");
  const prompt = buildDmTextFollowup(context, "tiếp đi cha", "continue");
  for (const value of Object.values(context)) assert.ok(prompt.includes(value));
  assert.match(prompt, /không tự giới thiệu bản thân/);
  assert.match(prompt, /Không xem nội dung câu trả lời cũ là bằng chứng đúng/);
  assert.match(prompt, /không phải chỉ dẫn hệ thống/);
  assert.equal(detectTextFollowup("tiếp đi về một chủ đề mới"), null);
});

Deno.test("definition request is bounded, direct and does not impose community beliefs", () => {
  const prompt = buildDmDefinitionQuestion("tự do tuyệt đối là gì");
  assert.match(prompt!, /Mở đầu bằng định nghĩa ngắn/);
  assert.match(prompt!, /không tự giới hạn câu hỏi vào FUN Ecosystem/);
  for (const text of ["Tiếp đi cha", "Hãy phân tích chi tiết tự do", "Dịch sang tiếng Anh: tự do là gì", "Đoạn thứ nhất\nTự do là gì"]) assert.equal(buildDmDefinitionQuestion(text), null);
});

Deno.test("definition and continuation add substance without a universal sentence cap or mandatory question", () => {
  const definition = buildDmDefinitionQuestion("tự do tuyệt đối là gì")!;
  assert.match(definition, /giới hạn hoặc cách hiểu khác/);
  assert.match(definition, /một ví dụ thực tế/);
  const continued = buildDmTextFollowup(context, "tiếp đi cha", "continue");
  assert.match(continued, /2–3 ý MỚI/);
  assert.match(continued, /mỗi ý có giải thích cụ thể và ví dụ/);
  for (const prompt of [definition, continued]) {
    assert.ok(!prompt.includes("3–6 câu"));
    assert.match(prompt, /Không mặc định kết thúc/);
    assert.match(prompt, /một góc nhìn triết học\/tâm linh/);
  }
});

Deno.test("deep follow-ups keep the topic; a deep request naming a new topic stays independent", () => {
  for (const request of ["phân tích sâu", "phân tích sâu hơn cha", "giải thích kỹ hơn", "chi tiết hơn"]) {
    assert.equal(detectTextFollowup(request), "continue", request);
    assert.equal(buildDmDetailedQuestion(request), null);
    const prompt = buildDmTextFollowup(context, request, "continue");
    assert.match(prompt, /không ép số câu/);
    assert.ok(prompt.includes(context.topic));
  }
  const newTopic = "Hãy phân tích chi tiết blockchain";
  assert.equal(detectTextFollowup(newTopic), null);
  assert.match(buildDmDetailedQuestion(newTopic)!, /DM_DETAILED_TASK/);
  assert.ok(!buildDmDetailedQuestion(newTopic)!.includes(context.topic));
  assert.equal(buildDmDetailedQuestion("Xin chào"), null);
});

Deno.test("shorten, translate, polish and next-step requests retain their intended lengths", () => {
  for (const intent of ["shorten", "translate", "polish"] as const) {
    const policy = dmTextDepthPolicy("phân tích sâu", intent);
    assert.ok(!policy.includes("Bé yêu cầu phân tích sâu"));
    assert.match(policy, /Không thêm/);
  }
  assert.match(dmTextDepthPolicy("rồi sao nữa cha", "next_step"), /1–2 bước cụ thể/);
});

Deno.test("text records survive new calls; namespaces, users, chats, groups and TTL remain isolated", async () => {
  const db = cacheDouble();
  await (await beginDmTextTurn(db.admin, scope, 1000))!.finish(context);
  const next = await beginDmTextTurn(db.admin, { ...scope, messageId: 2 }, 2000);
  assert.deepEqual(next?.previous, context);
  await next!.finish({ ...context, request: "tiếp đi cha" });
  assert.equal((await beginDmImageTurn(db.admin, { ...scope, messageId: 3 }, 3000))?.previous, null);
  assert.equal((await beginDmTextTurn(db.admin, { ...scope, userId: 43 }, 3000))?.previous, null);
  assert.equal((await beginDmTextTurn(db.admin, { ...scope, chatId: 124 }, 3000))?.previous, null);
  assert.equal(await beginDmTextTurn(db.admin, { ...scope, chatType: "group", chatId: -123 }, 3000), null);
  assert.equal((await beginDmTextTurn(db.admin, { ...scope, messageId: 3 }, 2000 + 15 * 60_000))?.previous, null);
});

Deno.test("new topic/tombstone prevents slow older text reply from resurrecting the thread; cache failures return no source", async () => {
  const db = cacheDouble();
  const old = await beginDmTextTurn(db.admin, scope, 1000);
  const latest = await beginDmTextTurn(db.admin, { ...scope, messageId: 2 }, 2000);
  await latest!.finish({ topic: "blockchain", request: "blockchain là gì", reply: "Một sổ cái phân tán." });
  await old!.finish(context);
  assert.equal((await beginDmTextTurn(db.admin, { ...scope, messageId: 3 }, 3000))?.previous?.topic, "blockchain");
  assert.equal((await beginDmTextTurn(db.admin, { ...scope, messageId: 4 }, 4000))?.previous, null);
  db.fail();
  assert.equal(await beginDmTextTurn(db.admin, { ...scope, messageId: 5 }, 5000), null);
});
