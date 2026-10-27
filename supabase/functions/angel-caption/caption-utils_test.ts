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
  splitCaptionSentences,
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

Deno.test("extractMeetingKey: Zoom bỏ pwd/query, Meet lấy mã phòng, fallback chuẩn hoá", () => {
  // Cùng một phòng Zoom, link mời khác đuôi → cùng một key.
  assertEq(extractMeetingKey("https://zoom.us/j/8808082024?pwd=abc123"), "zoom:8808082024", "zoom with pwd");
  assertEq(extractMeetingKey("https://zoom.us/j/8808082024?pwd=KHAC"), "zoom:8808082024", "zoom other pwd");
  assertEq(extractMeetingKey("https://us05web.zoom.us/j/8808082024"), "zoom:8808082024", "zoom regional host");
  assertEq(extractMeetingKey("https://zoom.com/j/123"), "zoom:123", "zoom.com");

  // Google Meet: mã xxx-xxxx-xxx, viết thường.
  assertEq(extractMeetingKey("https://meet.google.com/abc-defg-hij"), "meet:abc-defg-hij", "meet code");
  assertEq(extractMeetingKey("https://meet.google.com/ABC-DEFG-HIJ?authuser=0"), "meet:abc-defg-hij", "meet uppercase+query");

  // Teams / nền tảng khác: host + path viết thường, bỏ query và dấu / cuối.
  assertEq(
    extractMeetingKey("https://teams.microsoft.com/l/meetup-join/XYZ/?context=abc"),
    "teams.microsoft.com/l/meetup-join/xyz",
    "teams normalized",
  );

  // Hai phòng khác nhau → key khác nhau.
  assert(
    extractMeetingKey("https://zoom.us/j/111") !== extractMeetingKey("https://zoom.us/j/222"),
    "different zoom rooms differ",
  );
  assertEq(extractMeetingKey("not-a-url"), null, "garbage rejected");
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

Deno.test("splitCaptionSentences: cắt dấu kết câu nhưng giữ số có dấu chấm", () => {
  const words = ["Giá", "là", "5", ".", "000", "đồng", ".", "Tiếp", "tục", "nhé", "!", "Tỷ", "lệ", "100:5.6", "ổn", "?"].map((text, i) => ({
    text, start_timestamp: { relative: i / 2 },
  }));
  assertEq(JSON.stringify(splitCaptionSentences(words)), JSON.stringify([
    { text: "Giá là 5.000 đồng.", startSec: 0 },
    { text: "Tiếp tục nhé!", startSec: 3.5 },
    { text: "Tỷ lệ 100:5.6 ổn?", startSec: 5.5 },
  ]), "punctuation and offsets");
});

Deno.test("splitCaptionSentences: câu dài cắt tại dấu phẩy gần giới hạn, không bỏ từ", () => {
  const words = Array.from({ length: 55 }, (_, i) => ({
    text: i === 39 ? "word39," : `word${i}`,
    start_timestamp: { relative: i },
  }));
  const chunks = splitCaptionSentences(words);
  assertEq(chunks.length, 2, "split long turn");
  assertEq(chunks[0].text.split(" ").length, 40, "cut at nearby comma");
  assertEq(chunks[1].startSec, 40, "second sentence keeps timestamp");
  assertEq(chunks.map((chunk) => chunk.text).join(" ").replace(",", ""), words.map((word) => word.text).join(" ").replace(",", ""), "no dropped words");
});

Deno.test("detectSourceLang: tiếng Việt có dấu, stopword, và tiếng Anh", () => {
  assertEq(detectSourceLang("Con xin biết ơn Cha Vũ Trụ"), "vi", "vi diacritics");
  assertEq(detectSourceLang("cai nay la cua chung ta"), "vi", "vi stopwords");
  assertEq(detectSourceLang("The Thought Adjuster dwells within you"), "en", "english");
  assertEq(detectSourceLang("Urantia Melchizedek Nebadon"), "en", "proper nouns default en");
});

Deno.test("applyHearingCorrections: giữ nguyên 4 cặp đã duyệt trước đây", () => {
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

Deno.test("applyHearingCorrections: đợi ơn tiếng Việt thực sự khớp, không dùng ASCII word boundary", () => {
  assertEq(applyHearingCorrections("cha dạ đợi ơn cha"), "cha dạ đội ơn cha", "Vietnamese correction executes");
});

Deno.test("applyHearingCorrections: sửa mọi lần xuất hiện và giữ hoa đầu câu", () => {
  assertEq(
    applyHearingCorrections("Đợi ơn Cha. cha dạ đợi ơn cha đợi ơn bé ly à đợi ơn à các em bé nha đợi ơn bé quân"),
    "Đội ơn Cha. cha dạ đội ơn cha đội ơn bé ly à đội ơn à các em bé nha đội ơn bé quân",
    "all approved phrase variants",
  );
});

Deno.test("applyHearingCorrections: câu đội ơn đúng và các từ đợi/ơn khác không thay đổi", () => {
  const correct = "Đội ơn Cha, đội ơn bé Ly. Đợi xe, chờ đợi, biết ơn và cảm ơn.";
  assertEq(applyHearingCorrections(correct), correct, "no unrelated replacement");
  const fixed = applyHearingCorrections("Đợi ơn Cha và đợi ơn bé Ly");
  assertEq(applyHearingCorrections(fixed), fixed, "idempotent");
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
