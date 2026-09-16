import { assertEquals, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { containsBlacklist, stripUrls } from "./telegramGroup.ts";

Deno.test("stripUrls removes https URLs (slug no longer contains 'sex')", () => {
  const out = stripUrls(
    "hello https://www.facebook.com/share/v/1SExkz19Zd/ world",
  ).toLowerCase();
  assertEquals(out.includes("sex"), false);
  assertEquals(out.includes("hello"), true);
  assertEquals(out.includes("world"), true);
});

Deno.test("stripUrls removes www and bare domain links", () => {
  assertEquals(stripUrls("see www.evil.com/sexpage now").includes("sex"), false);
  assertEquals(stripUrls("visit example.com/sex-thing here").includes("sex"), false);
  assertEquals(stripUrls("open t.me/sexchannel ok").includes("sex"), false);
});

Deno.test("containsBlacklist: Facebook URL with 'SEx' slug is SAFE", () => {
  const text =
    "Anh em xem bài này nhé https://www.facebook.com/share/v/1SExkz19Zd/ rất hay";
  assertEquals(containsBlacklist(text), null);
});

Deno.test("containsBlacklist: bare URL with 'sex' substring in slug is SAFE", () => {
  assertEquals(
    containsBlacklist("share link www.fb.com/post/SexyCatVideo123"),
    null,
  );
  assertEquals(
    containsBlacklist("t.me/joinchat/SEX-random-id-xyz"),
    null,
  );
});

Deno.test("containsBlacklist: 'phimsex' / 'sexchat' as plain word IS blocked", () => {
  assertNotEquals(containsBlacklist("ai muốn xem phimsex không"), null);
  assertNotEquals(containsBlacklist("join sexchat room"), null);
});

Deno.test("containsBlacklist: obfuscated 'p o r n' IS blocked even with URL present", () => {
  const r = containsBlacklist(
    "click https://safe.com/abc and watch p o r n now",
  );
  assertNotEquals(r, null);
});

Deno.test("containsBlacklist: clean text with link only is SAFE", () => {
  assertEquals(
    containsBlacklist("Check https://camlycoin.com/whitepaper.pdf"),
    null,
  );
});

Deno.test("containsBlacklist: porn bot handle still caught (not a URL)", () => {
  const r = containsBlacklist("contact @sexyhotbot for more");
  assertNotEquals(r, null);
});
