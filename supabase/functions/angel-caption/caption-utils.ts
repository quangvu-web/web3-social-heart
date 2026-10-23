// angel-caption/caption-utils.ts
// Logic thuần cho Angel Caption Bot — tách riêng để test đơn vị được:
//   - validate meeting URL + suy ra platform
//   - sinh public_code
//   - ghép words Recall → câu
//   - heuristic nhận diện vi/en
//   - bảng sửa lỗi nghe sai (không mơ hồ)
//   - dedupe key
//   - xác thực chữ ký webhook kiểu Svix (Recall)

const MEETING_HOSTS: Array<{ platform: string; host: RegExp }> = [
  { platform: "zoom", host: /(^|\.)zoom\.us$/i },
  { platform: "zoom", host: /(^|\.)zoom\.com$/i },
  { platform: "google_meet", host: /(^|\.)meet\.google\.com$/i },
  { platform: "teams", host: /(^|\.)teams\.microsoft\.com$/i },
  { platform: "teams", host: /(^|\.)teams\.live\.com$/i },
];

export function detectPlatform(meetingUrl: string): string | null {
  try {
    const u = new URL(meetingUrl);
    for (const m of MEETING_HOSTS) {
      if (m.host.test(u.hostname)) return m.platform;
    }
    return null;
  } catch {
    return null;
  }
}

export function isValidMeetingUrl(meetingUrl: string): boolean {
  return detectPlatform(meetingUrl) !== null;
}

/**
 * Định danh phòng họp để chống tạo bot trùng:
 *   - Zoom: dãy số sau /j/ trong path → "zoom:<id>" (BỎ QUA pwd và mọi query —
 *     cùng một phòng nhưng link mời có thể khác đuôi).
 *   - Google Meet: mã phòng xxx-xxxx-xxx trong path → "meet:<code>".
 *   - Nền tảng khác/không trích được: URL chuẩn hoá (host + path viết thường,
 *     bỏ query, bỏ dấu / cuối).
 */
export function extractMeetingKey(meetingUrl: string): string | null {
  try {
    const u = new URL(meetingUrl);
    const host = u.hostname.toLowerCase();
    const path = u.pathname.replace(/\/+$/, "");
    if (/(^|\.)zoom\.(us|com)$/i.test(host)) {
      const m = path.match(/\/j\/(\d+)/i);
      if (m) return `zoom:${m[1]}`;
    }
    if (/(^|\.)meet\.google\.com$/i.test(host)) {
      const m = path.match(/\/([a-z]{3}-[a-z]{4}-[a-z]{3})(\/|$)/i);
      if (m) return `meet:${m[1].toLowerCase()}`;
    }
    const normalized = `${host}${path.toLowerCase()}`;
    return normalized || null;
  } catch {
    return null;
  }
}

/** Mã phiên công khai: 12 ký tự chữ thường + số, bỏ ký tự dễ nhầm (0/o/1/l). */
export function generatePublicCode(len = 12): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const buf = new Uint8Array(len);
  crypto.getRandomValues(buf);
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[buf[i] % alphabet.length];
  return out;
}

export interface RecallWord {
  text?: string;
  start_timestamp?: { relative?: number | null } | null;
}

/** Ghép words thành câu gốc + mốc thời gian (giây, relative) của từ đầu tiên. */
export function wordsToSentence(words: RecallWord[]): { text: string; startSec: number | null } {
  const parts: string[] = [];
  let startSec: number | null = null;
  for (const w of words ?? []) {
    const t = String(w?.text ?? "").trim();
    if (!t) continue;
    if (startSec === null) {
      const rel = w?.start_timestamp?.relative;
      if (typeof rel === "number" && Number.isFinite(rel)) startSec = rel;
    }
    parts.push(t);
  }
  // Recall trả words đã tách; nối bằng space rồi dọn space trước dấu câu.
  const text = parts
    .join(" ")
    .replace(/\s+([,.!?;:%…)\]])/g, "$1")
    .replace(/(\d)\.\s+(?=\d)/g, "$1.")
    .replace(/([(\[])\s+/g, "$1")
    .trim();
  return { text, startSec };
}

/** Chia một lượt nói final thành các câu ngắn, giữ mốc của từ đầu mỗi câu. */
export function splitCaptionSentences(words: RecallWord[]): Array<{ text: string; startSec: number | null }> {
  const nonempty = (words ?? []).filter((word) => String(word?.text ?? "").trim());
  const sentences: Array<{ text: string; startSec: number | null }> = [];
  let pending: RecallWord[] = [];
  const flush = (count = pending.length) => {
    const chunk = pending.splice(0, count);
    const sentence = wordsToSentence(chunk);
    if (sentence.text) sentences.push(sentence);
  };

  for (let i = 0; i < nonempty.length; i++) {
    const word = nonempty[i];
    const value = String(word.text).trim();
    pending.push(word);
    const previous = i > 0 ? String(nonempty[i - 1].text).trim() : "";
    const next = i + 1 < nonempty.length ? String(nonempty[i + 1].text).trim() : "";
    const numericDot = /\.$/.test(value) && /\d$/.test(value.slice(0, -1) || previous) && /^\d/.test(next);
    if (/[.!?…][”"')\]]*$/.test(value) && !numericDot) {
      flush();
      continue;
    }
    if (pending.length > 45) {
      let cutoff = -1;
      for (let j = pending.length - 1; j >= 29; j--) {
        if (/[;,]$/.test(String(pending[j].text).trim())) { cutoff = j + 1; break; }
      }
      flush(cutoff > 0 ? cutoff : 45);
    }
  }
  if (pending.length) flush();
  return sentences;
}

const VI_DIACRITIC_RE = /[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i;
const VI_STOPWORDS = new Set([
  "cái", "của", "và", "những", "chúng", "ta", "tôi", "bạn", "là", "có", "không",
  "được", "này", "đó", "cho", "với", "một", "các", "người", "đã", "sẽ", "đang",
  "thì", "mà", "ở", "về", "trong", "khi", "nếu", "vì", "như", "rất", "cũng",
  // Biến thể không dấu (STT thường bỏ dấu)
  "cai", "cua", "va", "nhung", "chung", "toi", "ban", "la", "co", "khong",
  "duoc", "nay", "do", "voi", "mot", "cac", "nguoi", "da", "se", "dang",
  "thi", "ma", "ve", "khi", "neu", "vi", "nhu", "rat", "cung",
]);

/** Heuristic vi/en: có dấu tiếng Việt hoặc tỷ lệ stopword Việt đủ cao → vi. */
export function detectSourceLang(text: string): "vi" | "en" {
  const t = String(text ?? "").trim();
  if (!t) return "en";
  if (VI_DIACRITIC_RE.test(t)) return "vi";
  const tokens = t.toLowerCase().split(/[^a-zà-ỹ0-9]+/i).filter(Boolean);
  if (tokens.length === 0) return "en";
  const viHits = tokens.filter((w) => VI_STOPWORDS.has(w)).length;
  return viHits / tokens.length >= 0.2 && viHits >= 2 ? "vi" : "en";
}

/** Bảng sửa lỗi nghe sai KHÔNG mơ hồ — chỉ các cặp đã duyệt. */
const HEARING_CORRECTIONS: Array<[RegExp, string]> = [
  [/\bThe Selections Horn\b/g, "Resurrection Hall"],
  [/\bThe Selections Hall\b/g, "Resurrection Hall"],
  [/\bthought-adapter\b/gi, "Thought Adjuster"],
  [/\bByBuddy\b/g, "bé Ly"],
];

export function applyHearingCorrections(text: string): string {
  let out = String(text ?? "");
  for (const [re, to] of HEARING_CORRECTIONS) out = out.replace(re, to);
  return out;
}

/** dedupe_key = sha256 hex của botId + startSec + text_source. */
export async function computeDedupeKey(botId: string, startSec: number | null, textSource: string): Promise<string> {
  const raw = `${botId}|${startSec ?? ""}|${textSource}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToBase64(bytes: ArrayBuffer): string {
  const arr = new Uint8Array(bytes);
  let bin = "";
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
  return btoa(bin);
}

/**
 * Xác thực chữ ký webhook Recall (chuẩn Svix):
 *   signed = "<webhook-id>.<webhook-timestamp>.<rawBody>"
 *   key    = base64-decode(secret bỏ tiền tố "whsec_")
 *   header webhook-signature = "v1,<base64(hmac-sha256)>" (có thể nhiều giá trị)
 * Kèm kiểm tra timestamp lệch tối đa 5 phút chống replay.
 */
export async function verifySvixSignature(params: {
  webhookId: string | null;
  timestamp: string | null;
  signatureHeader: string | null;
  rawBody: string;
  secret: string;
  toleranceSec?: number;
}): Promise<boolean> {
  const { webhookId, timestamp, signatureHeader, rawBody, secret } = params;
  if (!webhookId || !timestamp || !signatureHeader || !secret) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  const tolerance = params.toleranceSec ?? 300;
  if (Math.abs(Math.floor(Date.now() / 1000) - ts) > tolerance) return false;

  const keyBytes = base64ToBytes(secret.replace(/^whsec_/, ""));
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes.buffer as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = new TextEncoder().encode(`${webhookId}.${timestamp}.${rawBody}`);
  const expected = bytesToBase64(await crypto.subtle.sign("HMAC", key, signed));

  const candidates = signatureHeader
    .split(" ")
    .map((part) => part.trim())
    .filter((part) => part.startsWith("v1,"))
    .map((part) => part.slice(3));
  return candidates.some((sig) => sig === expected);
}
