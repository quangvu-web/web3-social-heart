import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { scanJoinName, normalizeJoinName, avatarVerdictBlocks } from "./telegram-join-guard.ts";

Deno.test("normalizeJoinName strips accents, leet and zero-width", () => {
  assertEquals(normalizeJoinName("S3xy​ Gái Gọi"), "sexy gai goi");
});

Deno.test("scanJoinName blocks adult / shop / gambling names", () => {
  assertEquals(scanJoinName("Hot Sexy Girl")?.keyword, "sexy");
  assertEquals(scanJoinName("BUBU Store acc")?.keyword, "bubu store");
  assertEquals(scanJoinName("789bet vip")?.keyword, "789bet");
  assertEquals(scanJoinName("同城约炮小妹")?.keyword, "约炮");
});

Deno.test("scanJoinName is safe for normal names and substrings", () => {
  assertEquals(scanJoinName("Nguyen Van An"), null);
  assertEquals(scanJoinName("Essex Trading"), null);
  assertEquals(scanJoinName("Camly Coin"), null);
});

Deno.test("scanJoinName honours allowlist and extra keywords", () => {
  assertEquals(scanJoinName("Sexy Angel", { allowlist: ["sexy angel"] }), null);
  assertEquals(scanJoinName("Spam King", { extraKeywords: ["spam king"] })?.source, "group");
});

Deno.test("avatarVerdictBlocks respects threshold", () => {
  assertEquals(avatarVerdictBlocks("explicit", "explicit"), true);
  assertEquals(avatarVerdictBlocks("suspicious", "explicit"), false);
  assertEquals(avatarVerdictBlocks("suspicious", "suspicious"), true);
  assertEquals(avatarVerdictBlocks("safe", "suspicious"), false);
});
