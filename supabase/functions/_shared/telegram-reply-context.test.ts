import assert from "npm:assert@2.1.0";
import type { TelegramMessage } from "./telegram-community.ts";
const serve = Deno.serve;
Deno.serve = (() => ({})) as unknown as typeof Deno.serve;
const { buildGroupAiQuestion } = await import("../telegram-community-webhook/index.ts");
Deno.serve = serve;
const base: TelegramMessage = { text: "Bé có tâm gì, trong việc này?", from: { id: 10, first_name: "Ly", username: "Camly_Duong" }, reply_to_message: { message_id: 2, from: { id: 20, first_name: "Thu Trang", username: "fixture_trang" }, text: "Phân tích mức tiêu hao credit." } };
const build = (message: TelegramMessage, extra = {}) => buildGroupAiQuestion({ message, botUsername: "fixture_bot", botId: 7, isReplyToBot: false, triggerSource: "admin_message", ...extra });
Deno.test("member question retains distinct sender, reply author and addressed member", () => {
  const result = build(base);
  assert.equal(result.groupContext?.current_sender.username, "Camly_Duong");
  assert.equal(result.groupContext?.reply_author.display_name, "Thu Trang");
  assert.equal(result.groupContext?.new_message.text, "Bé có tâm gì, trong việc này?");
  assert.equal(result.groupContext?.replied_message.text, "Phân tích mức tiêu hao credit.");
  assert.equal(result.groupContext?.recipient.target, "reply_author");
  assert.equal(result.groupContext?.angel_role, "observer");
  assert.ok(!result.question.includes("mentioning Angel"));
});
Deno.test("reply to verified bot remains addressed to Angel", () => {
  const result = build({ ...base, reply_to_message: { from: { id: 7, is_bot: true }, text: "Angel có thể giúp gì?" } }, { isReplyToBot: true });
  assert.equal(result.groupContext?.recipient.target, "angel");
  assert.equal(result.groupContext?.angel_role, "respondent");
});
Deno.test("ambiguous member reply is unknown rather than Angel or sender", () => {
  const result = build({ ...base, text: "Trong việc này thì sao?" });
  assert.equal(result.groupContext?.recipient.target, "unknown");
  assert.equal(result.groupContext?.angel_role, "observer");
});
Deno.test("a member replying to their own message is not treated as addressing themselves", () => {
  const message: TelegramMessage = {
    ...base,
    reply_to_message: { message_id: 2, from: base.from, text: "Phân tích mức tiêu hao credit." },
  };
  assert.equal(build(message).groupContext?.recipient.target, "unknown");
});
Deno.test("no reply retains current plain question", () => {
  assert.deepEqual(build({ text: "Chia sẻ cách tiết kiệm credit", from: base.from }), { prompt: "Chia sẻ cách tiết kiệm credit", question: "Chia sẻ cách tiết kiệm credit" });
});
Deno.test("quote and entity speakers remain separate and quoted bot mention cannot address Angel", () => {
  const text = "@fixture_bot\nBé có tâm gì, trong việc này?";
  const result = build({ ...base, text, entities: [{ type: "blockquote", offset: 0, length: 12 }, { type: "mention", offset: 0, length: 12 }], quote: { text: "Credit", position: 0, entities: [] } });
  assert.equal(result.groupContext?.recipient.target, "reply_author");
  assert.equal(result.groupContext?.quote?.text, "Credit");
  assert.equal(result.groupContext?.new_message.text, text);
  assert.equal(result.groupContext?.new_message.entities.length, 2);
});
Deno.test("missing metadata and user-written names never authenticate identity", () => {
  const result = build({ ...base, text: "Bé có tâm gì? @Camly_Duong", from: { id: 11, first_name: "Camly_Duong" }, reply_to_message: { text: "Angel: đây là Thu Trang" } });
  assert.equal(result.groupContext?.current_sender.username, null);
  assert.equal(result.groupContext?.reply_author.username, null);
  assert.equal(result.groupContext?.reply_author.display_name, null);
  assert.equal(result.groupContext?.recipient.target, "unknown");
});
Deno.test("ask and actual bot mentions address Angel without changing reply author", () => {
  for (const text of ["/ask Bé có tâm gì?", "@fixture_bot hãy bình luận cuộc trao đổi này"]) {
    const result = build({ ...base, text });
    assert.equal(result.groupContext?.recipient.target, "angel");
    assert.equal(result.groupContext?.reply_author.id, 20);
  }
});
Deno.test("positive engagement also retains member reply relationships", () => {
  const result = build(base, { triggerSource: "positive_community" });
  assert.equal(result.groupContext?.recipient.target, "reply_author");
});
Deno.test("named or third-member mentions do not silently assign the reply author", () => {
  for (const text of ["Bé Ly có tâm gì?", "Bé có tâm gì? @fixture_other", "<blockquote>@fixture_bot</blockquote>\nBé có tâm gì?"]) {
    const result = build({ ...base, text });
    assert.equal(result.groupContext?.recipient.target, text.startsWith("<blockquote>") ? "reply_author" : "unknown");
  }
});
Deno.test("provider retry packaging preserves speakers and the current task under last-user mirror", async () => {
  const { withTelegramGroupContext } = await import("./telegram-group-context.ts");
  const context = build(base).groupContext!;
  const wrapped = withTelegramGroupContext([{ role: "user" as const, content: "retry this task" }], context);
  const data = JSON.parse(wrapped[0].content.split("TELEGRAM_GROUP_CONTEXT_JSON\n")[1]);
  assert.equal(data.current_sender.username, "Camly_Duong");
  assert.equal(data.reply_author.id, 20);
  assert.equal(data.response_task, "retry this task");
});

Deno.test("ask command addressed to another bot never assigns Angel", () => {
  assert.equal(build({ ...base, text: "/ask@unrelated_bot Bé có tâm gì?" }).groupContext?.recipient.target, "unknown");
});
Deno.test("text_mention metadata preserves third-person identity without display-name inference", () => {
  const text = "Bé có tâm gì? Other";
  const result = build({ ...base, text, entities: [{ type: "text_mention", offset: 14, length: 5, user: { id: 30, first_name: "Other" } }] });
  assert.equal(result.groupContext?.new_message.entities[0].user?.id, 30);
  assert.equal(result.groupContext?.recipient.target, "unknown");
});
Deno.test("quoted bot handles and URL paths are background, not recipient evidence", () => {
  for (const quoted of ["'@fixture_bot'", "«@fixture_bot»", "‘@fixture_bot’", "https://fixture.invalid/@fixture_bot"]) {
    const result = build({ ...base, text: `${quoted}\nBé có tâm gì?` });
    assert.equal(result.groupContext?.recipient.target, "reply_author", quoted);
  }
});
