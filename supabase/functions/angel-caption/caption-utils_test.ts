// angel-caption/caption-utils_test.ts
// Test đơn vị cho logic thuần của Angel Caption Bot.
// Chạy: deno test supabase/functions/angel-caption/caption-utils_test.ts

import {
  applyHearingCorrections,
  computeDedupeKey,
  detectPlatform,
  detectSourceLang,
  extractMeetingKey,
  generatePublicCode,
  isValidMeetingUrl,
  verifySvixSignature,
  wordsToSentence,
} from "./caption-utils.ts";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
}
function assertEq<T>(actual: T, expected: T, msg: string) {
  if (actual !== expected) {
    throw new Error(`ASSERT EQ FAILED: ${msg} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

Deno.test("detectPlatform: zoom / meet / teams / invalid", () => {
  assertEq(detectPlatform("https://us05web.zoom.us/j/123456?pwd=abc"), "zoom", "zoom.us");
  assertEq(detectPlatform("https://meet.google.com/abc-defg-hij"), "google_meet", "meet");
  assertEq(detectPlatform("https://teams.microsoft.com/l/meetup-join/xyz"), "teams", "teams");
  assertEq(detectPlatform("https://example.com/meeting"), null, "unknown host");
  assertEq(detectPlatform("not-a-url"), null, "garbage");
  assert(isValidMeetingUrl("https://zoom.us/j/999"), "valid zoom");
  assert(!isValidMeetingUrl("https://evilzoom.us.fake.com/j/1"), "fake zoom host rejected");
});

Deno.test("generatePublicCode: 12 ký tự, alphabet an toàn, ngẫu nhiên", () => {
  const a = generatePublicCode();
  const b = generatePublicCode();
  assertEq(a.length, 12, "length");
  assert(/^[abcdefghjkmnpqrstuvwxyz23456789]+$/.test(a), "alphabet");
  assert(a !== b, "two codes differ");
});

Deno.test("wordsToSentence: ghép words, dọn space trước dấu câu, lấy start từ đầu", () => {
  const { text, startSec } = wordsToSentence([
    { text: "Con", start_timestamp: { relative: 12.5 } },
    { text: "xin", start_timestamp: { relative: 12.8 } },
    { text: "biết", start_timestamp: { relative: 13.0 } },
    { text: "ơn", start_timestamp: { relative: 13.2 } },
    { text: ",", start_timestamp: { relative: 13.3 } },
    { text: "Cha", start_timestamp: { relative: 13.6 } },
  ]);
  assertEq(text, "Con xin biết ơn, Cha", "joined text");
  assertEq(startSec, 12.5, "start offset");

  const empty = wordsToSentence([]);
  assertEq(empty.text, "", "empty words");
  assertEq(empty.startSec, null, "empty start");
});

Deno.test("detectSourceLang: tiếng Việt có dấu, stopword, và tiếng Anh", () => {
  assertEq(detectSourceLang("Con xin biết ơn Cha Vũ Trụ"), "vi", "vi diacritics");
  assertEq(detectSourceLang("cai nay la cua chung ta"), "vi", "vi stopwords");
  assertEq(detectSourceLang("The Thought Adjuster dwells within you"), "en", "english");
  assertEq(detectSourceLang("Urantia Melchizedek Nebadon"), "en", "proper nouns default en");
});

Deno.test("applyHearingCorrections: chỉ 4 cặp đã duyệt", () => {
  assertEq(
    applyHearingCorrections("Welcome to The Selections Horn, thought-adapter and ByBuddy"),
    "Welcome to Resurrection Hall, Thought Adjuster and bé Ly",
    "all corrections applied",
  );
  assertEq(
    applyHearingCorrections("The Selections Hall opens"),
    "Resurrection Hall opens",
    "second hall variant",
  );
  assertEq(
    applyHearingCorrections("Resurrection Hall is fine"),
    "Resurrection Hall is fine",
    "no false positive",
  );
});

Deno.test("computeDedupeKey: ổn định và phân biệt", async () => {
  const k1 = await computeDedupeKey("bot-1", 12.5, "hello");
  const k2 = await computeDedupeKey("bot-1", 12.5, "hello");
  const k3 = await computeDedupeKey("bot-1", 12.6, "hello");
  const k4 = await computeDedupeKey("bot-2", 12.5, "hello");
  assertEq(k1, k2, "stable");
  assert(k1 !== k3 && k1 !== k4, "differs by ts/bot");
  assert(/^[0-9a-f]{64}$/.test(k1), "sha256 hex");
});

async function signSvix(secret: string, id: string, ts: string, body: string): Promise<string> {
  const keyBytes = Uint8Array.from(atob(secret.replace(/^whsec_/, "")), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${ts}.${body}`));
  let bin = "";
  new Uint8Array(sig).forEach((b) => (bin += String.fromCharCode(b)));
  return `v1,${btoa(bin)}`;
}

Deno.test("verifySvixSignature: chữ ký đúng/sai, prefix whsec_, replay cũ", async () => {
  const secret = `whsec_${btoa("test-secret-key-32bytes-padded!!")}`;
  const id = "msg_123";
  const body = JSON.stringify({ event: "transcript.data", data: { bot_id: "b1" } });
  const ts = String(Math.floor(Date.now() / 1000));
  const header = await signSvix(secret, id, ts, body);

  assert(
    await verifySvixSignature({ webhookId: id, timestamp: ts, signatureHeader: header, rawBody: body, secret }),
    "valid signature accepted",
  );
  assert(
    !(await verifySvixSignature({ webhookId: id, timestamp: ts, signatureHeader: header, rawBody: body + "x", secret })),
    "tampered body rejected",
  );
  assert(
    !(await verifySvixSignature({ webhookId: id, timestamp: ts, signatureHeader: "v1,aaaa", rawBody: body, secret })),
    "wrong signature rejected",
  );
  const oldTs = String(Math.floor(Date.now() / 1000) - 3600);
  const oldHeader = await signSvix(secret, id, oldTs, body);
  assert(
    !(await verifySvixSignature({ webhookId: id, timestamp: oldTs, signatureHeader: oldHeader, rawBody: body, secret })),
    "old timestamp rejected",
  );
  assert(
    !(await verifySvixSignature({ webhookId: null, timestamp: ts, signatureHeader: header, rawBody: body, secret })),
    "missing id rejected",
  );
});
