import { assertEquals } from "jsr:@std/assert@1";
import { resolveGroupReplyLanguage } from "./telegram-community.ts";

Deno.test("en group: Vietnamese question is answered in English", () => {
  const r = resolveGroupReplyLanguage("Angel ơi FUN Profile là gì vậy?", "en");
  assertEquals(r.bucket, "en");
  assertEquals(r.policyNote, null);
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
