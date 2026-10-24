import assert from "npm:assert@2.1.0";
const assertEquals = assert.deepStrictEqual;
import { resolveGroupReplyLanguage } from "./telegram-community.ts";

Deno.test("en group: Vietnamese question is answered in English", () => {
  const r = resolveGroupReplyLanguage("Angel ơi FUN Profile là gì vậy?", "en");
  assertEquals(r.bucket, "en");
  assertEquals(r.botVoiceBucket, "en");
  assertEquals(r.policyNote?.includes("MUST be in English"), true);
});
Deno.test("en group: English question stays English", () => {
  assertEquals(resolveGroupReplyLanguage("What is FUN Profile?", "en").bucket, "en");
});
Deno.test("en group: translation to Vietnamese keeps target, framing English", () => {
  const r = resolveGroupReplyLanguage("dịch sang tiếng Việt: I am grateful", "en");
  assertEquals(r.bucket, "vi");
  assertEquals(r.policyNote?.includes("MUST be in English"), true);
});
Deno.test("auto group: Vietnamese question stays Vietnamese", () => {
  assertEquals(resolveGroupReplyLanguage("Angel ơi FUN Profile là gì vậy?", "auto").bucket, "vi");
  assertEquals(resolveGroupReplyLanguage("Angel ơi FUN Profile là gì vậy?", null).bucket, "vi");
});

Deno.test("vi group: English question uses Vietnamese voice and overrides mirroring", () => {
  const r = resolveGroupReplyLanguage("What is FUN Profile?", "vi");
  assertEquals(r.bucket, "vi");
  assertEquals(r.botVoiceBucket, "vi");
  assertEquals(r.policyNote?.includes("MUST be in Vietnamese"), true);
});
Deno.test("vi group: translation keeps English and Chinese targets with Vietnamese framing", () => {
  for (const [text, target, name] of [
    ["Translate to English: Tôi biết ơn", "en", "English"],
    ["dịch sang tiếng Trung: Tôi biết ơn", "zh", "Chinese"],
  ]) {
    const r = resolveGroupReplyLanguage(text, "vi");
    assertEquals(r.bucket, target);
    assertEquals(r.botVoiceBucket, "vi");
    assertEquals(r.policyNote?.includes(`translated content itself MUST be in ${name}`), true);
    assertEquals(r.policyNote?.includes("MUST be in Vietnamese"), true);
  }
});
Deno.test("vi group: translation to Vietnamese and Vietnamese questions retain Vietnamese voice", () => {
  for (const text of ["Translate to Vietnamese: I am grateful", "Angel ơi FUN Profile là gì?"]) {
    const r = resolveGroupReplyLanguage(text, "vi");
    assertEquals(r.bucket, "vi");
    assertEquals(r.botVoiceBucket, "vi");
  }
});
Deno.test("auto and absent settings preserve English messages and explicit translations", () => {
  for (const setting of ["auto", null, undefined]) {
    assertEquals(resolveGroupReplyLanguage("What is FUN Profile?", setting), { bucket: "en", policyNote: null });
    assertEquals(resolveGroupReplyLanguage("Translate to Vietnamese: I am grateful", setting), { bucket: "vi", policyNote: null });
  }
});

import * as community from "./telegram-community.ts";
Deno.test("group output gate repairs quoted wrong-language prose and English in vi groups", async () => {
  for (const [reply, text, setting, expected] of [
    ['Bé có thể nói "Con biết ơn" mỗi sáng.', "Thực hành biết ơn thế nào?", "en", "Start each morning with gratitude."],
    ["Start each morning with gratitude.", "How can I practice gratitude?", "vi", "Bé hãy bắt đầu mỗi sáng bằng lòng biết ơn."],
  ]) {
    let calls = 0;
    const policy = resolveGroupReplyLanguage(text, setting);
    const actual = await community.enforceGroupReplyLanguageOutput(reply, policy, async (source, note) => {
      calls++;
      assertEquals(source, reply);
      assertEquals(note, policy.policyNote);
      return expected;
    });
    assertEquals(actual, expected);
    assertEquals(calls, 1);
  }
});
Deno.test("group output gate leaves auto and already-correct forced prose untouched", async () => {
  for (const [reply, setting] of [["Bé có thể thực hành lòng biết ơn.", "auto"], ["Practice gratitude every morning.", "en"], ["Bé hãy bắt đầu bằng lòng biết ơn.", "vi"]]) {
    assertEquals(await community.enforceGroupReplyLanguageOutput(reply, resolveGroupReplyLanguage("Hello", setting), async () => {
      throw new Error("must not rewrite");
    }), reply);
  }
});
Deno.test("group output gate enforces mixed translation policy without collapsing target content", async () => {
  for (const [question, setting, framing, translation] of [
    ["Translate to Vietnamese: I am grateful", "en", "Here is the translation:", "Tôi biết ơn."],
    ["Translate to English: Tôi biết ơn", "vi", "Bản dịch là:", "I am grateful."],
  ]) {
    const policy = resolveGroupReplyLanguage(question, setting);
    assertEquals(await community.enforceGroupReplyLanguageOutput("Original translation", policy, async (_source, note) => {
      assertEquals(note?.includes("TRANSLATION REQUEST"), true);
      return JSON.stringify({ framing, translation });
    }), `${framing}\n\n${translation}`);
  }
});
Deno.test("group output gate fails in the group voice when rewrite errors or stays in the wrong language", async () => {
  const policy = resolveGroupReplyLanguage("Xin chào", "en");
  for (const rewrite of [async () => { throw new Error("unavailable"); }, async () => "Bé yêu ơi", async () => ""]) {
    assertEquals(await community.enforceGroupReplyLanguageOutput("Xin chào bé", policy, rewrite), "🙏 Angel is a bit busy, please try again later 💛");
  }
});

Deno.test("group output gate distinguishes proper names from mixed wrong-language prose", async () => {
  const english = "Practice gratitude with Nguyễn every morning.";
  assertEquals(await community.enforceGroupReplyLanguageOutput(english, resolveGroupReplyLanguage("Xin chào", "en"), async () => { throw new Error("no rewrite expected"); }), english);
  const mixed = "Bé, practice gratitude every morning. Write three things you are thankful for and take a deep breath.";
  let called = false;
  assertEquals(await community.enforceGroupReplyLanguageOutput(mixed, resolveGroupReplyLanguage("Hello", "vi"), async () => { called = true; return "Bé hãy dành ba phút mỗi sáng để thực hành lòng biết ơn."; }), "Bé hãy dành ba phút mỗi sáng để thực hành lòng biết ơn.");
  assertEquals(called, true);
});
Deno.test("mixed translation gate rejects wrong framing or wrong translation language", async () => {
  const policy = resolveGroupReplyLanguage("Translate to Vietnamese: I am grateful", "en");
  for (const result of ["Bản dịch là: Tôi biết ơn.", JSON.stringify({ framing: "Bản dịch là:", translation: "Tôi biết ơn." }), JSON.stringify({ framing: "Here is the translation:", translation: "I am grateful." })]) {
    assertEquals(await community.enforceGroupReplyLanguageOutput("Original translation", policy, async () => result), "🙏 Angel is a bit busy, please try again later 💛");
  }
});

Deno.test("translation rewrite request excludes provider-authored commentary from the translation source", () => {
  const policy = resolveGroupReplyLanguage("Translate to Vietnamese: I am grateful", "en");
  const messages = community.buildGroupReplyRewriteMessages("Đây là lời giải thích của bot, không phải nguồn dịch.", "Translate to Vietnamese: I am grateful", policy.policyNote!);
  assertEquals(messages.filter(message => message.role === "user").map(message => message.content), ["Translate to Vietnamese: I am grateful"]);
});

Deno.test("final Telegram language boundary preserves first-person translated content after addressing", async () => {
  const policy = resolveGroupReplyLanguage("Translate to Vietnamese: I am grateful", "en");
  const reply = await community.finalizeTelegramReplyLanguage("Tôi biết ơn một buổi sáng bình yên.", {
    originalUserMessage: "Translate to Vietnamese: I am grateful", forcedLangBucket: policy.bucket,
    languagePolicyNote: policy.policyNote, fallbackLangBucket: policy.botVoiceBucket, chatType: "supergroup",
  }, async () => JSON.stringify({ framing: "Here is the translation:", translation: "Tôi biết ơn." }));
  assertEquals(reply, "Here is the translation:\n\nTôi biết ơn.");
});

Deno.test("normal Vietnamese group rewrite still applies the final Telegram addressing contract", async () => {
  const policy = resolveGroupReplyLanguage("How can I practice gratitude?", "vi");
  assertEquals(await community.finalizeTelegramReplyLanguage("Practice gratitude every morning.", {
    originalUserMessage: "How can I practice gratitude?", forcedLangBucket: policy.bucket,
    languagePolicyNote: policy.policyNote, fallbackLangBucket: policy.botVoiceBucket, chatType: "supergroup",
  }, async () => "Tôi sẽ giúp bạn thực hành lòng biết ơn."), "Angel sẽ giúp bé thực hành lòng biết ơn.");
});

Deno.test("Vietnamese translation framing keeps Angel addressing without changing the English translation", async () => {
  const policy = resolveGroupReplyLanguage("Translate to English: Tôi biết ơn", "vi");
  assertEquals(await community.enforceGroupReplyLanguageOutput("Original", policy, async () => JSON.stringify({ framing: "Chào bạn, dưới đây là bản dịch bạn yêu cầu.", translation: "I am grateful." })), "Chào bé, dưới đây là bản dịch bé yêu cầu.\n\nI am grateful.");
});
