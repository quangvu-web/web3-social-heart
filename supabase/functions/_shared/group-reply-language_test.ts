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
