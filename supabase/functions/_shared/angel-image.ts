// _shared/angel-image.ts
// Cầu nối tới Angel AI gốc để tạo/sửa ảnh.
// Endpoints (dùng chung API key):
//   POST {ANGEL_ROOT_BASE_URL}/generate-image  { prompt, mode? }
//   POST {ANGEL_ROOT_BASE_URL}/edit-image      { imageUrl, instruction, style? }
// Auth: header `x-api-key: ${ANGEL_ROOT_API_KEY}`
// Quota: bên Angel gốc tự đếm 5 tạo + 5 sửa / ngày.
// Không fallback qua Lovable Gateway để tránh trừ credit FUN Profile.

import { MODELS } from "./angel/models.ts";
import { getFlag } from "./angel/flags.ts";
import { enrichImagePrompt, classifyArtTopic, isDesignHeavyTopic } from "./angel/image-enrich.ts";
import { logImagePipeline } from "./angel/image-telemetry.ts";
import { distillImagePrompt } from "./angel/image-distill.ts";

const DEFAULT_BASE =
  "https://zghvgxwdpsapvuvvdgjl.supabase.co/functions/v1";

export function getAngelRootBase(): string {
  const raw =
    Deno.env.get("ANGEL_ROOT_BASE_URL")
    || Deno.env.get("ANGEL_AI_BASE_URL")
    || "";
  let base = raw;
  if (!base) {
    const chatUrl = Deno.env.get("ANGEL_AI_CHAT_URL");
    if (chatUrl) base = chatUrl.replace(/\/angel-chat\/?$/i, "");
  }
  base = (base || DEFAULT_BASE).replace(/\/$/, "");
  // Nếu secret/env bị cấu hình nhầm thành URL endpoint cụ thể, chuẩn hoá về base functions/v1.
  base = base.replace(/\/(?:angel-chat|angel-router|generate-image|edit-image)\/?$/i, "");
  // Angel gốc xác nhận angel.fun.rich là SPA (không proxy backend). Mọi call
  // ảnh phải đi thẳng vào Supabase functions — ép override nếu env còn cũ.
  if (/angel\.fun\.rich/i.test(base)) {
    console.warn(`[angel-image] override SPA base ${base} → ${DEFAULT_BASE}`);
    base = DEFAULT_BASE;
  }
  return base;
}

function baseKind(base: string): string {
  if (/angel\.fun\.rich/i.test(base)) return "spa-domain";
  if (/\/functions\/v1$/i.test(base)) return "functions-v1";
  if (/\/functions\/v1\//i.test(base)) return "functions-v1-with-extra-path";
  return "custom-base";
}

function payloadDiagnostics(body: Record<string, unknown>): Record<string, unknown> {
  const prompt = typeof body.prompt === "string" ? body.prompt : "";
  const instruction = typeof body.instruction === "string" ? body.instruction : "";
  return {
    keys: Object.keys(body).sort(),
    prompt_len: prompt.length,
    instruction_len: instruction.length,
    has_user_ref: Object.prototype.hasOwnProperty.call(body, "user_ref") || Object.prototype.hasOwnProperty.call(body, "userRef"),
    has_image_url: Object.prototype.hasOwnProperty.call(body, "imageUrl"),
    has_legacy_image_url: Object.prototype.hasOwnProperty.call(body, "image_url"),
  };
}

// ============ Intent detection ============

// Unicode-aware "word boundary" for Vietnamese: not preceded/followed by a
// letter or combining mark. ASCII `\b` fails on diacritics ("vẽ", "ẽ" etc).
const L = "(?<![\\p{L}\\p{M}])";
const R = "(?![\\p{L}\\p{M}])";
const u = (src: string) => new RegExp(src, "iu");

const GENERATE_KEYWORDS: RegExp[] = [
  u(`${L}vẽ${R}`),
  u(`${L}vē${R}`), // fallback rare typo
  u(`${L}tạo (?:ra )?(?:một |1 )?(?:cái |bức |tấm )?(?:ảnh|hình|tranh|bức tranh|bức hình)`),
  u(`${L}làm (?:cho |giúp )?(?:một |1 )?(?:cái |bức |tấm )?(?:ảnh|hình|tranh)`),
  u(`${L}thiết kế (?:ảnh|hình|tranh|poster|thumbnail|banner|logo)`),
  u(`${L}phác (?:hoạ|họa)${R}`),
  u(`${L}minh hoạ${R}`), u(`${L}minh họa${R}`),
  u(`${L}generate (?:an? |the )?(?:image|picture|photo)`),
  u(`${L}make (?:me )?(?:an? |the )?(?:picture|image|photo)`),
  u(`${L}draw (?:me |an? |the )?`),
  u(`${L}paint (?:me |an? |the )?`),
  u(`${L}sketch (?:me |an? |the )?`),
  u(`${L}create (?:an? |the )?(?:image|picture|illustration)`),
  u(`(?:hình|ảnh|tranh)[^\\n]{0,40}giúp Angel`),
  u(`Angel[^\\n]{0,20}(?:vẽ|tạo|làm|thiết kế|phác)`),
  u(`${L}imagine${R}`),
  u(`${L}render (?:an? |the )?(?:image|scene)`),
];

const EDIT_KEYWORDS: RegExp[] = [
  u(`${L}(?:chỉnh|chinh) (?:sửa |lại )?(?:ảnh|hình|tấm|bức)`),
  u(`${L}sửa (?:lại )?(?:ảnh|hình|tấm|bức)`),
  u(`${L}xoá nền${R}`), u(`${L}xóa nền${R}`),
  u(`${L}remove background${R}`),
  u(`${L}đổi màu${R}`), u(`${L}change (?:the )?color`), u(`${L}recolor${R}`),
  u(`${L}thêm[^\\n]{0,20}(?:vào|lên) (?:ảnh|hình)`),
  u(`${L}edit (?:this |the )?(?:image|photo|picture)`),
  u(`${L}retouch${R}`),
  u(`${L}restyle (?:ảnh|hình|this|the image)`),
  u(`${L}biến (?:ảnh|hình|tấm|bức)[^\\n]{0,20}thành`),
  u(`${L}turn (?:this )?(?:image|photo) into`),
];

export type ImageIntent = { mode: "generate" | "edit"; prompt: string; forceHd?: boolean } | null;

// Regex phát hiện lệnh HD: "/vẽ hd", "vẽ hd", "ve hd", "hd:", "#hd", "chất lượng cao".
// Nếu match → strip trigger khỏi prompt và bật forceHd → skip P1/P2, đi thẳng Nano Banana Pro.
const HD_TRIGGER_RE = /(^|\s)(?:\/?vẽ\s+hd|\/?ve\s+hd|hd\s*:|#hd|chất\s+lượng\s+cao|high\s+quality|hi[- ]?res)\b[\s:,-]*/i;

function extractHdTrigger(text: string): { prompt: string; forceHd: boolean } {
  const t = text.trim();
  if (!HD_TRIGGER_RE.test(t)) return { prompt: t, forceHd: false };
  const cleaned = t.replace(HD_TRIGGER_RE, " ").replace(/\s{2,}/g, " ").trim();
  return { prompt: cleaned || t, forceHd: true };
}

/**
 * Phát hiện intent tạo/sửa ảnh từ prompt user.
 * @param text prompt user
 * @param hasImage có ảnh đính kèm hay không (Telegram photo / web upload)
 */
export function detectImageIntent(text: string, hasImage = false): ImageIntent {
  if (!text || text.trim().length < 3) return null;
  const t = text.trim();

  // Nếu có ảnh + edit keyword → edit
  if (hasImage) {
    for (const re of EDIT_KEYWORDS) {
      if (re.test(t)) {
        const { prompt, forceHd } = extractHdTrigger(t);
        return { mode: "edit", prompt, forceHd };
      }
    }
  }

  // Generate intent
  for (const re of GENERATE_KEYWORDS) {
    if (re.test(t)) {
      const { prompt, forceHd } = extractHdTrigger(t);
      return { mode: "generate", prompt, forceHd };
    }
  }

  // HD trigger đứng riêng cũng coi là generate intent.
  if (HD_TRIGGER_RE.test(t)) {
    const { prompt, forceHd } = extractHdTrigger(t);
    if (prompt.length >= 3) return { mode: "generate", prompt, forceHd };
  }

  return null;
}

// ============ API calls ============

export class AngelImageError extends Error {
  status: number;
  detail?: unknown;
  quotaExceeded: boolean;
  currentUsage?: number;
  dailyLimit?: number;
  constructor(status: number, message: string, detail?: unknown) {
    super(message);
    this.status = status;
    this.detail = detail;
    this.quotaExceeded = status === 429;
    if (detail && typeof detail === "object") {
      const d = detail as Record<string, unknown>;
      if (typeof d.current_usage === "number") this.currentUsage = d.current_usage as number;
      if (typeof d.daily_limit === "number") this.dailyLimit = d.daily_limit as number;
    }
  }
}

/**
 * Phân loại lỗi từ AngelImageError để bot hiển thị message phù hợp.
 * - quota_daily: hết lượt trong ngày (429 + counter, hoặc detail.fallback_quota)
 * - rate_limit: quá nhanh (429 nhưng không có counter, hoặc msg chứa "rate")
 * - content_blocked: bị chặn nội dung/safety (400/422 + keywords)
 * - bad_prompt: mô tả không rõ / thiếu input (400 khác)
 * - timeout: 504 / abort
 * - infra: 5xx / mạng
 * - unknown: fallback
 */
export type AngelImageErrorKind =
  | "quota_daily"
  | "rate_limit"
  | "content_blocked"
  | "bad_prompt"
  | "timeout"
  | "infra"
  | "unknown";

export function classifyAngelImageError(e: AngelImageError): AngelImageErrorKind {
  const detail = (e.detail && typeof e.detail === "object") ? e.detail as Record<string, unknown> : {};
  const rawStr = (() => {
    try {
      const r = (detail as any).raw;
      if (typeof r === "string") return r;
      if (r) return JSON.stringify(r);
      return e.message || "";
    } catch { return e.message || ""; }
  })().toLowerCase();

  if ((detail as any).fallback_quota) return "quota_daily";
  if (e.status === 429) {
    if (typeof e.currentUsage === "number" && typeof e.dailyLimit === "number") return "quota_daily";
    if (/daily|hôm nay|quota|limit reached|hết lượt/i.test(rawStr)) return "quota_daily";
    return "rate_limit";
  }
  if (e.status === 504 || /abort|timeout|timed out/.test(rawStr) || /abort|timeout/i.test(e.message)) {
    return "timeout";
  }
  if (/content[_ ]?policy|moderation|safety|unsafe|blocked|violat|prohibited|nsfw|not[_ ]?allowed|inappropriate/.test(rawStr)) {
    return "content_blocked";
  }
  if (e.status === 400 || e.status === 422) {
    if (/missing|empty|too short|invalid prompt|prompt.*required/.test(rawStr)) return "bad_prompt";
    return "bad_prompt";
  }
  if (e.status && e.status >= 500) return "infra";
  return "unknown";
}

/** User-facing message tiếng Việt cho từng loại lỗi (dùng chung DM/Group/Web). */
export function angelImageUserMessage(e: AngelImageError): string {
  const kind = classifyAngelImageError(e);
  const quotaTag = (typeof e.currentUsage === "number" && typeof e.dailyLimit === "number")
    ? ` (${e.currentUsage}/${e.dailyLimit} hôm nay)`
    : "";
  switch (kind) {
    case "quota_daily":
      return `Bé yêu, hôm nay bé đã dùng hết lượt vẽ ảnh với Angel rồi${quotaTag} 💛 Mai Angel vẽ tiếp cho bé nhé ✨`;
    case "rate_limit":
      return "Bé ơi, bé đang gửi hơi nhanh nên Angel chưa vẽ kịp 🎨 Bé chờ khoảng 20-30 giây rồi thử lại giúp Angel nhé 💛";
    case "content_blocked":
      return "Bé ơi, mô tả này Angel chưa vẽ được vì vượt quy tắc an toàn ✨ Bé thử đổi lại mô tả theo hướng tích cực, nhẹ nhàng hơn giúp Angel nhé 💛";
    case "bad_prompt":
      return "Bé ơi, mô tả chưa đủ rõ để Angel vẽ ✨ Bé thử ghi lại chủ thể chính, màu sắc và không gian mong muốn giúp Angel nhé 💛";
    case "timeout":
      return "Bé ơi, mô tả khá chi tiết nên Angel cần thêm chút thời gian ✨ Bé thử lại hoặc rút gọn bớt ý chính để Angel vẽ nhanh hơn nhé 💛";
    case "infra":
      return "Bé ơi, cả các xưởng vẽ dự phòng của Angel đang bận cùng lúc 🎨 Bé thử lại sau 3-5 phút hoặc rút gọn mô tả giúp Angel nhé, Angel sẽ vẽ thật đẹp cho bé 💛";
    default:
      return "Bé ơi, Angel vừa gặp trục trặc nhỏ khi vẽ 🎨 Bé thử lại sau ít phút giúp Angel nhé 💛";
  }
}

export type AngelImageResult = {
  image_url?: string;
  image_base64?: string;
  mime_type?: string;
  provider?: string;
  extraction_kind?: "url" | "base64";
  extraction_path?: string;
  raw?: unknown;
};

export type AngelImagePayload = {
  image_url?: string;
  image_base64?: string;
  mime_type?: string;
  kind?: "url" | "base64";
  path?: string;
};

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseDataImage(value: string): { b64: string; mime: string } | null {
  const m = value.match(/^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=\s_-]+)$/i);
  if (!m) return null;
  return { mime: m[1], b64: m[2].replace(/\s+/g, "") };
}

function normalizeBase64(value: string): string {
  const raw = value.includes(",") ? value.split(",").pop() ?? value : value;
  let compact = raw.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
  const pad = compact.length % 4;
  if (pad) compact += "=".repeat(4 - pad);
  return compact;
}

function isLikelyImageDataUrl(value: string): boolean {
  return /^data:image\/[a-z0-9.+-]+;base64,/i.test(value.trim());
}

function looksLikeImageUrl(value: string, keyHint = ""): boolean {
  if (!/^https?:\/\//i.test(value)) return false;
  const hint = keyHint.toLowerCase();
  if (/(image|photo|picture|file|url|asset|output|result)/i.test(hint)) return true;
  return /\.(png|jpe?g|webp|gif)(\?|#|$)/i.test(value) || /\/image\//i.test(value) || /(?:storage|object|render|download|generated|asset)/i.test(value);
}

function looksLikeBase64Image(value: string, keyHint = ""): boolean {
  if (parseDataImage(value)) return true;
  const hint = keyHint.toLowerCase();
  if (!/(b64|base64|image|photo|png|jpeg|jpg)/i.test(hint)) return false;
  const compact = value.replace(/\s+/g, "");
  return compact.length > 500 && /^[a-z0-9+/=_-]+$/i.test(compact);
}

function firstImageUrlFromText(value: string): string | null {
  const markdownImage = value.match(/!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/i);
  if (markdownImage?.[1]) return markdownImage[1];
  const imageBlock = value.match(/"(?:image_url|imageUrl|url)"\s*:\s*"(https?:\\?\/\\?\/[^"\\]+)"/i);
  if (imageBlock?.[1]) return imageBlock[1].replace(/\\\//g, "/");
  const urls = value.match(/https?:\/\/[^\s)"'<>]+/gi) ?? [];
  return urls.find((url) => looksLikeImageUrl(url, "image_url")) ?? null;
}

function firstBase64ImageFromText(value: string): { b64: string; mime: string } | null {
  const dataUrl = value.match(/data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=\s_-]{500,})/i);
  if (dataUrl?.[1] && dataUrl?.[2]) return { mime: dataUrl[1], b64: dataUrl[2] };
  const jsonB64 = value.match(/"(?:b64_json|image_base64|imageBase64|base64)"\s*:\s*"([a-z0-9+/=\s_-]{500,})"/i);
  if (jsonB64?.[1]) return { mime: "image/png", b64: jsonB64[1] };
  const sseLines = value
    .split(/\r?\n/)
    .map((line) => line.replace(/^data:\s*/i, "").trim())
    .filter(Boolean);
  for (const line of sseLines) {
    if (line === "[DONE]") continue;
    try {
      const parsed = JSON.parse(line);
      const hit = extractAngelImagePayload(parsed);
      if (hit.image_base64) return { mime: hit.mime_type ?? "image/png", b64: hit.image_base64 };
    } catch { /* ignore non-json SSE fragments */ }
  }
  return null;
}

function isImageObject(value: Record<string, unknown>): boolean {
  const type = String(value.type ?? value.mime_type ?? value.mimeType ?? "").toLowerCase();
  return type.includes("image") || value.image_url != null || value.imageUrl != null || value.b64_json != null;
}

export function extractAngelImagePayload(data: unknown): AngelImagePayload {
  const root = data as any;

  const explicitMime =
    stringValue(root?.mime_type) ||
    stringValue(root?.mimeType) ||
    stringValue(root?.data?.[0]?.mime_type) ||
    stringValue(root?.data?.[0]?.mimeType) ||
    stringValue(root?.result?.mime_type) ||
    stringValue(root?.result?.mimeType) ||
    stringValue(root?.output?.mime_type) ||
    stringValue(root?.output?.mimeType) ||
    "image/png";

  const candidates: Array<{ value: string | null; path: string; type: "url" | "base64" }> = [
    { value: stringValue(root?.image_url), path: "image_url", type: "url" },
    { value: stringValue(root?.imageUrl), path: "imageUrl", type: "url" },
    { value: stringValue(root?.url), path: "url", type: "url" },
    { value: stringValue(root?.data?.[0]?.url), path: "data[0].url", type: "url" },
    { value: stringValue(root?.data?.[0]?.image_url), path: "data[0].image_url", type: "url" },
    { value: stringValue(root?.data?.image_url), path: "data.image_url", type: "url" },
    { value: stringValue(root?.data?.imageUrl), path: "data.imageUrl", type: "url" },
    { value: stringValue(root?.result?.image_url), path: "result.image_url", type: "url" },
    { value: stringValue(root?.result?.imageUrl), path: "result.imageUrl", type: "url" },
    { value: stringValue(root?.result?.url), path: "result.url", type: "url" },
    { value: stringValue(root?.output?.image_url), path: "output.image_url", type: "url" },
    { value: stringValue(root?.output?.imageUrl), path: "output.imageUrl", type: "url" },
    { value: stringValue(root?.output?.url), path: "output.url", type: "url" },
    { value: stringValue(root?.choices?.[0]?.message?.images?.[0]?.image_url?.url), path: "choices[0].message.images[0].image_url.url", type: "url" },
    { value: stringValue(root?.choices?.[0]?.message?.images?.[0]?.url), path: "choices[0].message.images[0].url", type: "url" },
    { value: stringValue(root?.image_base64), path: "image_base64", type: "base64" },
    { value: stringValue(root?.imageBase64), path: "imageBase64", type: "base64" },
    { value: stringValue(root?.b64_json), path: "b64_json", type: "base64" },
    { value: stringValue(root?.data_url), path: "data_url", type: "base64" },
    { value: stringValue(root?.dataUrl), path: "dataUrl", type: "base64" },
    { value: stringValue(root?.data?.[0]?.b64_json), path: "data[0].b64_json", type: "base64" },
    { value: stringValue(root?.data?.[0]?.image_base64), path: "data[0].image_base64", type: "base64" },
    { value: stringValue(root?.data?.image_base64), path: "data.image_base64", type: "base64" },
    { value: stringValue(root?.result?.image_base64), path: "result.image_base64", type: "base64" },
    { value: stringValue(root?.result?.imageBase64), path: "result.imageBase64", type: "base64" },
    { value: stringValue(root?.result?.b64_json), path: "result.b64_json", type: "base64" },
    { value: stringValue(root?.result?.data_url), path: "result.data_url", type: "base64" },
    { value: stringValue(root?.output?.image_base64), path: "output.image_base64", type: "base64" },
    { value: stringValue(root?.output?.imageBase64), path: "output.imageBase64", type: "base64" },
    { value: stringValue(root?.output?.b64_json), path: "output.b64_json", type: "base64" },
    { value: stringValue(root?.output?.data_url), path: "output.data_url", type: "base64" },
  ];

  for (const candidate of candidates) {
    if (!candidate.value) continue;
    const dataImage = parseDataImage(candidate.value);
    if (dataImage) return { image_base64: normalizeBase64(dataImage.b64), mime_type: dataImage.mime, kind: "base64", path: candidate.path };
    if (candidate.type === "url" && looksLikeImageUrl(candidate.value, candidate.path)) {
      return { image_url: candidate.value, mime_type: explicitMime, kind: "url", path: candidate.path };
    }
    if (candidate.type === "base64" && looksLikeBase64Image(candidate.value, candidate.path)) {
      return { image_base64: normalizeBase64(candidate.value), mime_type: explicitMime, kind: "base64", path: candidate.path };
    }
  }

  const seen = new Set<unknown>();
  const scan = (value: unknown, keyHint = "root"): AngelImagePayload | null => {
    if (value == null) return null;
    if (typeof value === "string") {
      const s = value.trim();
      const dataImage = parseDataImage(s);
      if (dataImage) return { image_base64: normalizeBase64(dataImage.b64), mime_type: dataImage.mime, kind: "base64", path: keyHint };
      if (looksLikeImageUrl(s, keyHint)) return { image_url: s, mime_type: "image/png", kind: "url", path: keyHint };
      if (looksLikeBase64Image(s, keyHint)) return { image_base64: normalizeBase64(s), mime_type: "image/png", kind: "base64", path: keyHint };
      const textUrl = firstImageUrlFromText(s);
      if (textUrl) return { image_url: textUrl, mime_type: "image/png", kind: "url", path: `${keyHint}:text_url` };
      const textB64 = firstBase64ImageFromText(s);
      if (textB64) return { image_base64: normalizeBase64(textB64.b64), mime_type: textB64.mime, kind: "base64", path: `${keyHint}:text_b64` };
      if (isLikelyImageDataUrl(s)) {
        const parsed = parseDataImage(s);
        if (parsed) return { image_base64: normalizeBase64(parsed.b64), mime_type: parsed.mime, kind: "base64", path: `${keyHint}:data_url` };
      }
      return null;
    }
    if (typeof value !== "object" || seen.has(value)) return null;
    seen.add(value);
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const hit = scan(value[i], `${keyHint}[${i}]`);
        if (hit) return hit;
      }
      return null;
    }
    if (isImageObject(value as Record<string, unknown>)) {
      const objectUrl = stringValue((value as any).url) || stringValue((value as any).image_url?.url) || stringValue((value as any).image_url) || stringValue((value as any).imageUrl);
      if (objectUrl && looksLikeImageUrl(objectUrl, "image_url")) return { image_url: objectUrl, mime_type: explicitMime, kind: "url", path: keyHint };
      const objectB64 = stringValue((value as any).b64_json) || stringValue((value as any).image_base64) || stringValue((value as any).data_url);
      if (objectB64 && looksLikeBase64Image(objectB64, "image_base64")) return { image_base64: normalizeBase64(objectB64), mime_type: explicitMime, kind: "base64", path: keyHint };
    }
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const hit = scan(child, keyHint === "root" ? key : `${keyHint}.${key}`);
      if (hit) return hit;
    }
    return null;
  };

  return scan(data) ?? {};
}

function summarizeShape(value: unknown, depth = 0): unknown {
  if (depth > 2) return "…";
  if (value == null || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") return value.length > 80 ? `[string:${value.length}]` : value;
  if (Array.isArray(value)) return value.slice(0, 3).map((v) => summarizeShape(v, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>).slice(0, 20)) {
      out[key] = summarizeShape(child, depth + 1);
    }
    return out;
  }
  return typeof value;
}

function payloadPreview(value: unknown): string {
  return JSON.stringify(summarizeShape(value)).slice(0, 1600);
}

function getApiKey(): string {
  // Ưu tiên key riêng cho ảnh nếu cấu hình (giúp tách quota chat/image), fallback về key chính.
  const k = Deno.env.get("ANGEL_AI_API_KEY_IMAGE")
    || Deno.env.get("ANGEL_ROOT_API_KEY_IMAGE")
    || Deno.env.get("ANGEL_ROOT_API_KEY")
    || Deno.env.get("ANGEL_AI_API_KEY");
  if (!k) throw new AngelImageError(500, "ANGEL_ROOT_API_KEY not configured");
  return k;
}

// Lovable Gateway fallback đã bỏ (2026-07): Angel gốc đã fix xác thực x-api-key
// cho /generate-image và /edit-image, không cần dự phòng để tránh trừ credit
// FUNPROFILE. Nếu Angel gốc lỗi thật, user sẽ thấy "Angel bận vẽ" — đúng ý.



async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

async function postJson(
  path: "generate-image" | "edit-image",
  body: Record<string, unknown>,
  opts?: { timeoutMs?: number },
): Promise<AngelImageResult> {
  const base = getAngelRootBase();
  const url = `${base}/${path}`;
  const t0 = Date.now();
  const timeoutMs = opts?.timeoutMs ?? (body.mode === "spiritual" ? 22_000 : 15_000);
  console.log(`[angel-image] ${path} request`, {
    base_kind: baseKind(base),
    timeout_ms: timeoutMs,
    ...payloadDiagnostics(body),
  });
  let res: Response;
  let rawText = "";
  try {
    res = await fetchWithTimeout(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": getApiKey() },
      body: JSON.stringify(body),
    }, timeoutMs);
    rawText = await res.text();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const isAbort = /abort/i.test(msg);
    throw new AngelImageError(isAbort ? 504 : 502, `angel_image_fetch_failed: ${msg}`);
  }
  const dur = Date.now() - t0;
  let data: any = null;
  try { data = rawText ? JSON.parse(rawText) : null; } catch { data = rawText; }
  console.log(`[angel-image] ${path} status=${res.status} dur=${dur}ms len=${rawText.length}`);

  if (!res.ok) {
    console.warn(`[angel-image] ${path} error body:`, rawText.slice(0, 500));
    const current = typeof data?.current_usage === "number" ? data.current_usage as number : undefined;
    const limit = typeof data?.daily_limit === "number" ? data.daily_limit as number : undefined;
    const providerMsg = typeof data?.error === "string" ? data.error
      : typeof data?.message === "string" ? data.message : `angel_image_${res.status}`;
    const quotaHint = (current != null && limit != null) ? ` [${current}/${limit} ảnh hôm nay]` : "";
    throw new AngelImageError(
      res.status,
      `${providerMsg}${quotaHint}`,
      { raw: data ?? rawText.slice(0, 400), current_usage: current, daily_limit: limit },
    );
  }

  // Response chuẩn (theo doc mới): { imageUrl, description, prompt, mode }
  // Vẫn dùng extractor để phòng trường hợp gốc trả field khác.
  const directUrl = stringValue(data?.imageUrl) || stringValue(data?.image_url);
  const extracted = directUrl
    ? { image_url: directUrl, mime_type: "image/png" as const, kind: "url" as const, path: "imageUrl" }
    : extractAngelImagePayload(data);
  const image_url = extracted.image_url || null;
  const image_base64 = extracted.image_base64 || null;
  console.log(`[angel-image] ${path} extracted_path=${extracted.path ?? "none"} url=${image_url ? "yes" : "no"} base64_len=${image_base64?.length ?? 0}`);
  if (!image_url && !image_base64) {
    console.warn(`[angel-image] ROOT_EMPTY_IMAGE path=${path} shape=${payloadPreview(data)}`);
    throw new AngelImageError(502, "angel_image_empty_response", { shape: summarizeShape(data) });
  }
  return {
    image_url: image_url ?? undefined,
    image_base64: image_base64 ?? undefined,
    mime_type: extracted.mime_type ?? "image/png",
    provider: "angel-root",
    extraction_kind: extracted.kind,
    extraction_path: extracted.path,
    raw: data,
  };
}

export async function generateAngelImage(input: {
  prompt: string;
  userRef?: string | null;
  mode?: "fast" | "spiritual" | string;
  skipEnrich?: boolean;
}): Promise<AngelImageResult> {
  // Doc chính thức: POST /generate-image { prompt, mode? }
  // Headers: x-api-key (không cần Authorization). Không cần user_ref.
  // TẦNG A — enrich prompt universal (áp dụng cả Angel gốc), skip nếu prompt ≥200 char
  // hoặc admin tắt flag `image.enrich_prompt`.
  // Bước 3 — `image.enrich_p1_design` (default OFF): với topic design-heavy,
  // dùng force:true để override skip-length → prompt logo/cosmos luôn có style block đầy đủ.
  let finalPrompt = input.prompt;
  if (!input.skipEnrich) {
    const enrichEnabled = await getFlag("image.enrich_prompt", true);
    const presetEnabled = await getFlag("image.art_preset", true);
    if (enrichEnabled) {
      const topic = classifyArtTopic(input.prompt);
      const designHeavy = isDesignHeavyTopic(topic);
      const forceP1Design = designHeavy && await getFlag("image.enrich_p1_design", false);
      const r = enrichImagePrompt(input.prompt, { force: forceP1Design });
      if (r.enriched) {
        finalPrompt = r.prompt;
        console.log(`[angel-image][enrich] topic=${r.topic} preset=${presetEnabled ? "on" : "off"} force=${forceP1Design} in=${input.prompt.length} out=${finalPrompt.length}`);
      } else {
        console.log(`[angel-image][enrich] skip topic=${r.topic} reason=${r.reason}`);
      }
    }
  }
  const body: Record<string, unknown> = {
    prompt: finalPrompt,
    mode: input.mode ?? "fast",
  };
  return postJson("generate-image", body);
}

/**
 * Resilient wrapper pipeline 3 tầng:
 *   P1: Angel gốc mode "spiritual" (hoặc mode caller chỉ định)
 *   P2: Angel gốc mode "fast" (retry với prompt rút gọn nếu heavy)
 *   P3: Lovable AI Gateway fallback
 *        - Prompt heavy → FORCE bật (bỏ qua env flag) + model pro-image
 *        - Prompt thường → theo env flag + model flash-image
 *
 * Quota:
 *   - 429 từ Angel gốc → KHÔNG fallback (user hết lượt thật).
 *   - Quota Lovable fallback riêng theo user_ref/ngày.
 */
export async function generateAngelImageResilient(input: {
  prompt: string;
  userRef: string;
  initialMode?: "fast" | "spiritual";
  forceHd?: boolean;
  onPartial?: (b64: string, index: number) => void | Promise<void>;
}): Promise<AngelImageResult & { fallback_stage?: "spiritual" | "fast" | "lovable" }> {
  // Bước 1 — Distill prompt DÀI/analytical thành visual scene ngắn TRƯỚC mọi tầng.
  // Ngăn model diffusion nhận nguyên đoạn văn tiếng Việt → vẽ ra "slide chữ méo".
  const distill = await distillImagePrompt(input.prompt);
  const workingPrompt = distill.distilled ? distill.prompt : input.prompt;
  if (distill.distilled) {
    console.log(
      `[angel-image][distill] in=${distill.original_len} out=${distill.distilled_len} dur=${distill.duration_ms ?? "?"}ms reason=${distill.reason ?? "ok"}`,
    );
    logImagePipeline({
      user_ref: input.userRef, tier: "distill", model: "google/gemini-3.6-flash",
      topic: classifyArtTopic(workingPrompt), design_heavy: false,
      heavy: false, force_hd: !!input.forceHd, ok: true,
      duration_ms: distill.duration_ms ?? 0,
      prompt_len: distill.original_len ?? input.prompt.length,
      final_prompt_len: distill.distilled_len ?? workingPrompt.length,
      meta: { reason: distill.reason ?? "ok", distilled_prompt: workingPrompt.slice(0, 500) },
    });
  }

  const heavy = isHeavyPrompt(workingPrompt);
  const topic = classifyArtTopic(workingPrompt);
  const designHeavy = isDesignHeavyTopic(topic);

  // Bước 4 — Prompt gốc là văn bản dài đã distill → nâng chất lượng cho lượt đầu.
  const forceHd = input.forceHd || (distill.distilled && distill.original_len! >= 400);

  // Feature flags (fail-open true để không vỡ hành vi khi bảng lỗi).
  const rewriteEnabled = await getFlag("image.rewrite_prompt", true);
  const forceProOnHeavy = await getFlag("image.force_pro_on_heavy", true);
  const skipRootForDesign = await getFlag("image.skip_root_for_design", false);
  // Plan mới — "free mode": chỉ topic thực sự tâm linh (meditation/lightbeing/
  // mandala/cosmos) mới dùng spiritual; còn lại luôn fast → tránh bias cổ trang
  // với business/architecture/portrait/landscape/generic.
  const freeMode = await getFlag("image.free_mode", true);

  const jumpToLovablePro = input.forceHd === true || (skipRootForDesign && designHeavy);

  const stages: Array<"spiritual" | "fast"> = [];
  if (!jumpToLovablePro) {
    const topicMode: "fast" | "spiritual" = SPIRITUAL_TOPICS.has(topic) ? "spiritual" : "fast";
    const first = input.initialMode ?? (freeMode ? topicMode : (heavy ? "spiritual" : "fast"));
    stages.push(first);
    if (first !== "fast") stages.push("fast");
  } else {
    console.log(`[angel-image][resilient] jumpToLovablePro topic=${topic} forceHd=${!!input.forceHd} — skip P1/P2`);
    logImagePipeline({
      user_ref: input.userRef, tier: "jump_pro", topic, design_heavy: designHeavy, heavy,
      force_hd: !!input.forceHd, ok: true, prompt_len: workingPrompt.length,
      meta: { reason: input.forceHd ? "force_hd" : "skip_root_for_design" },
    });
  }

  // Với prompt heavy: chuẩn bị bản rút gọn để retry P2 (giảm khả năng model "lạc" giữa nhiều bullet).
  let compactPrompt: string | null = null;
  if (heavy && rewriteEnabled) {
    try {
      compactPrompt = await rewriteHeavyPromptForImage(workingPrompt);
      if (compactPrompt) {
        console.log("[angel-image][resilient] rewrote heavy prompt", {
          orig_len: workingPrompt.length,
          new_len: compactPrompt.length,
        });
      }
    } catch (e) {
      console.warn("[angel-image][resilient] prompt rewrite failed", e);
    }
  }

  let lastError: unknown = null;
  for (let i = 0; i < stages.length; i++) {
    const mode = stages[i];
    const promptToSend = (i > 0 && compactPrompt) ? compactPrompt : workingPrompt;
    const t0 = Date.now();
    const tierLabel = i === 0 ? `P1_${mode}` : `P2_${mode}`;
    try {
      const r = await generateAngelImage({ prompt: promptToSend, userRef: input.userRef, mode });
      logImagePipeline({
        user_ref: input.userRef, tier: tierLabel, model: "angel-root", topic,
        design_heavy: designHeavy, heavy, force_hd: !!input.forceHd, ok: true,
        duration_ms: Date.now() - t0, prompt_len: workingPrompt.length,
        final_prompt_len: promptToSend.length, fallback_stage: mode,
      });
      return { ...r, fallback_stage: mode };
    } catch (e) {
      lastError = e;
      const status = e instanceof AngelImageError ? e.status : undefined;
      const msg = e instanceof Error ? e.message : String(e);
      logImagePipeline({
        user_ref: input.userRef, tier: tierLabel, model: "angel-root", topic,
        design_heavy: designHeavy, heavy, force_hd: !!input.forceHd, ok: false,
        duration_ms: Date.now() - t0, prompt_len: workingPrompt.length,
        final_prompt_len: promptToSend.length,
        error_status: status ?? null, error_msg: msg, fallback_stage: mode,
      });
      if (e instanceof AngelImageError) {
        if (e.quotaExceeded) throw e; // hết lượt thật → không fallback
        console.warn(`[angel-image][resilient] mode=${mode} failed status=${e.status} msg=${e.message}`);
      } else {
        console.warn(`[angel-image][resilient] mode=${mode} unexpected error`, e);
      }
    }
  }

  // P3: Lovable Gateway fallback
  try {
    const { generateImageViaLovableFallback, LovableFallbackQuotaError, LovableFallbackDisabledError } =
      await import("./angel-image-fallback.ts");
    try {
      // TẦNG A — với Lovable Pro model (design heavy hoặc forceHd), luôn enrich prompt để
      // Nano Banana Pro nhận được style/lighting/palette rõ ràng.
      const useProModel = (heavy || designHeavy || !!input.forceHd) && forceProOnHeavy;
      const model = useProModel ? MODELS.image_heavy.id : undefined;
      const enrichEnabled = await getFlag("image.enrich_prompt", true);
      const baseForFallback = compactPrompt || workingPrompt;
      const enrichedFallback = enrichEnabled
        ? enrichImagePrompt(baseForFallback, { force: useProModel }).prompt
        : baseForFallback;
      const streamEnabled = !!input.onPartial && await getFlag("image.stream_lovable", true);
      const t0 = Date.now();
      const r = await generateImageViaLovableFallback({
        prompt: enrichedFallback,
        userRef: input.userRef,
        model,
        force: (heavy || designHeavy || !!input.forceHd) && forceProOnHeavy,
        stream: streamEnabled,
        onPartial: streamEnabled ? input.onPartial : undefined,
      });
      console.log(`[angel-image][resilient] lovable fallback ok topic=${topic} heavy=${heavy} model=${model ?? "default"}`);
      logImagePipeline({
        user_ref: input.userRef, tier: "P3_lovable", model: model ?? "lovable-default",
        topic, design_heavy: designHeavy, heavy, force_hd: !!input.forceHd, ok: true,
        duration_ms: Date.now() - t0, prompt_len: workingPrompt.length,
        final_prompt_len: enrichedFallback.length, fallback_stage: "lovable",
        meta: { stream: streamEnabled, pro: useProModel },
      });
      return { ...r, fallback_stage: "lovable" };
    } catch (fe) {
      const msg = fe instanceof Error ? fe.message : String(fe);
      logImagePipeline({
        user_ref: input.userRef, tier: "P3_lovable", topic,
        design_heavy: designHeavy, heavy, force_hd: !!input.forceHd, ok: false,
        prompt_len: workingPrompt.length, error_msg: msg, fallback_stage: "lovable",
      });
      if (fe instanceof LovableFallbackQuotaError) {
        console.warn(`[angel-image][resilient] lovable quota exceeded ${fe.currentUsage}/${fe.dailyLimit}`);
        throw new AngelImageError(429, `lovable_fallback_quota [${fe.currentUsage}/${fe.dailyLimit}]`, {
          fallback_quota: true, current_usage: fe.currentUsage, daily_limit: fe.dailyLimit,
        });
      }
      if (fe instanceof LovableFallbackDisabledError) {
        console.warn("[angel-image][resilient] lovable fallback disabled by env");
      } else {
        console.warn("[angel-image][resilient] lovable fallback error", fe);
      }
    }
  } catch (importErr) {
    console.warn("[angel-image][resilient] cannot load fallback module", importErr);
  }

  // P4: Gemini Direct fallback — dùng GEMINI_API_KEY riêng, KHÔNG tốn Lovable credit.
  // Chỉ chạy khi có secret; nếu không có thì bỏ qua sang error cuối.
  try {
    const { generateImageViaGeminiDirect, GeminiDirectNoKeyError } =
      await import("./angel-image-gemini-direct.ts");
    try {
      const t0 = Date.now();
      const enrichEnabled = await getFlag("image.enrich_prompt", true);
      const baseForP4 = compactPrompt || workingPrompt;
      const enrichedP4 = enrichEnabled
        ? enrichImagePrompt(baseForP4, { force: heavy || designHeavy || !!input.forceHd }).prompt
        : baseForP4;
      const r = await generateImageViaGeminiDirect({ prompt: enrichedP4, userRef: input.userRef });
      console.log(`[angel-image][resilient] gemini-direct P4 ok topic=${topic}`);
      logImagePipeline({
        user_ref: input.userRef, tier: "P4_gemini_direct", model: "gemini-direct",
        topic, design_heavy: designHeavy, heavy, force_hd: !!input.forceHd, ok: true,
        duration_ms: Date.now() - t0, prompt_len: workingPrompt.length,
        final_prompt_len: enrichedP4.length, fallback_stage: "lovable",
      });
      return { ...r, fallback_stage: "lovable" };
    } catch (ge) {
      const msg = ge instanceof Error ? ge.message : String(ge);
      if (ge instanceof GeminiDirectNoKeyError) {
        console.log("[angel-image][resilient] P4 skipped — no GEMINI_API_KEY");
      } else {
        console.warn("[angel-image][resilient] P4 gemini-direct failed", msg);
        logImagePipeline({
          user_ref: input.userRef, tier: "P4_gemini_direct", topic,
          design_heavy: designHeavy, heavy, force_hd: !!input.forceHd, ok: false,
          prompt_len: workingPrompt.length, error_msg: msg, fallback_stage: "lovable",
        });
      }
    }
  } catch (importErr) {
    console.warn("[angel-image][resilient] cannot load gemini-direct module", importErr);
  }

  // P5: fal.ai fallback — provider độc lập với Google, không cùng chết khi
  // Gemini upstream throttle. Chỉ chạy khi có FAL_API_KEY + flag bật.
  try {
    const {
      generateImageViaFal, pickFalModel,
      FalNoKeyError, FalDisabledError, FalQuotaError,
    } = await import("./angel-image-fal.ts");
    try {
      const t0 = Date.now();
      const enrichEnabled = await getFlag("image.enrich_prompt", true);
      const baseForP5 = compactPrompt || workingPrompt;
      const enrichedP5 = enrichEnabled
        ? enrichImagePrompt(baseForP5, { force: heavy || designHeavy || !!input.forceHd }).prompt
        : baseForP5;
      const model = pickFalModel(topic as any, heavy || designHeavy || !!input.forceHd);
      const r = await generateImageViaFal({
        prompt: enrichedP5,
        userRef: input.userRef,
        model,
      });
      console.log(`[angel-image][resilient] fal P5 ok topic=${topic} model=${model}`);
      logImagePipeline({
        user_ref: input.userRef, tier: "P5_fal", model,
        topic, design_heavy: designHeavy, heavy, force_hd: !!input.forceHd, ok: true,
        duration_ms: Date.now() - t0, prompt_len: workingPrompt.length,
        final_prompt_len: enrichedP5.length, fallback_stage: "lovable",
      });
      return { ...r, fallback_stage: "lovable" };
    } catch (fe) {
      const msg = fe instanceof Error ? fe.message : String(fe);
      if (fe instanceof FalNoKeyError) {
        console.log("[angel-image][resilient] P5 skipped — no FAL_API_KEY");
      } else if (fe instanceof FalDisabledError) {
        console.log("[angel-image][resilient] P5 skipped — fal disabled by flag");
      } else if (fe instanceof FalQuotaError) {
        console.warn(`[angel-image][resilient] fal quota exceeded ${fe.currentUsage}/${fe.dailyLimit}`);
        logImagePipeline({
          user_ref: input.userRef, tier: "P5_fal", topic,
          design_heavy: designHeavy, heavy, force_hd: !!input.forceHd, ok: false,
          prompt_len: workingPrompt.length, error_msg: msg, fallback_stage: "lovable",
        });
        throw new AngelImageError(429, `fal_quota [${fe.currentUsage}/${fe.dailyLimit}]`, {
          fallback_quota: true, current_usage: fe.currentUsage, daily_limit: fe.dailyLimit,
          source: "fal",
        });
      } else {
        console.warn("[angel-image][resilient] P5 fal failed", msg);
        logImagePipeline({
          user_ref: input.userRef, tier: "P5_fal", topic,
          design_heavy: designHeavy, heavy, force_hd: !!input.forceHd, ok: false,
          prompt_len: workingPrompt.length, error_msg: msg, fallback_stage: "lovable",
        });
      }
    }
  } catch (importErr) {
    console.warn("[angel-image][resilient] cannot load fal module", importErr);
  }

  if (lastError instanceof AngelImageError) throw lastError;
  throw new AngelImageError(502, "angel_image_all_stages_failed");
}

/**
 * Rút gọn prompt heavy (bullet-heavy / mô tả dài) thành 1 đoạn instruction sạch
 * cho image model. Dùng Lovable Gateway (Gemini flash-lite — rẻ + nhanh).
 * Trả null nếu không có LOVABLE_API_KEY hoặc rewrite fail — caller sẽ dùng prompt gốc.
 */
export async function rewriteHeavyPromptForImage(prompt: string): Promise<string | null> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return null;
  const t0 = Date.now();
  try {
    const res = await fetchWithTimeout("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODELS.prompt_rewrite.id,
        messages: [
          {
            role: "system",
            content: [
              "You compress verbose Vietnamese image-generation briefs into ONE clean English paragraph optimized for a text-to-image model.",
              "Rules:",
              "- Preserve EVERY concrete detail: subject, colors (translate to English color names), objects, mood, style, composition, text/typography to render.",
              "- Merge bullets and headings into flowing prose, no lists.",
              "- Keep any exact wording that must appear IN the image (logo text, titles) wrapped in double quotes.",
              "- Add technical quality tags at the end: 'ultra sharp, 8k, professional design, clean composition, high detail'.",
              "- Output ONLY the final prompt paragraph, no preface, no explanation, no quotes around the whole thing.",
              "- Max 120 words.",
            ].join("\n"),
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
      }),
    }, 8_000);
    if (!res.ok) {
      console.warn(`[angel-image][rewrite] status=${res.status}`);
      return null;
    }
    const data = await res.json();
    const out = String(data?.choices?.[0]?.message?.content ?? "").trim();
    console.log(`[angel-image][rewrite] dur=${Date.now() - t0}ms out_len=${out.length}`);
    return out.length > 20 ? out : null;
  } catch (e) {
    console.warn("[angel-image][rewrite] error", e);
    return null;
  }
}

export async function editAngelImage(input: {
  instruction: string;
  imageUrl?: string | null;
  imageBase64?: string | null;
  userRef?: string | null;
  style?: "spiritual" | "realistic" | "artistic" | string;
}): Promise<AngelImageResult> {
  if (!input.imageUrl && !input.imageBase64) {
    throw new AngelImageError(400, "missing_image_input");
  }
  // Doc chính thức: POST /edit-image { imageUrl, instruction, style? }
  // imageUrl chấp nhận cả https URL và data:image/...;base64,...
  const imageUrl = input.imageUrl
    ? input.imageUrl
    : `data:image/png;base64,${(input.imageBase64 || "").replace(/^data:[^,]+,/, "")}`;
  const body: Record<string, unknown> = {
    imageUrl,
    instruction: input.instruction,
  };
  if (input.style) body.style = input.style;
  return postJson("edit-image", body);
}

// ============ Topic guardrail (positive only) ============

const NEGATIVE_TOPIC_PATTERNS: RegExp[] = [
  // Bạo lực / vũ khí / máu
  u(`${L}(?:vũ khí|súng|đạn|bom|dao găm|kiếm máu|chém giết|giết người|đánh nhau|bạo lực|máu me|xác chết|tra tấn)${R}`),
  u(`${L}(?:weapon|gun|rifle|pistol|firearm|blood|gore|violence|kill|murder|torture|corpse|behead)${R}`),
  // Khiêu dâm / nude
  u(`${L}(?:khoả thân|khỏa thân|nude|nudity|khiêu dâm|sex|porn|erotic|lõa thể|ngực trần|cởi truồng)${R}`),
  // Ma quỷ tối tăm
  u(`${L}(?:quỷ dữ|ác quỷ|satan|lucifer|demon(?:ic)?|hellfire|địa ngục lửa|ma quái đáng sợ|kinh dị|horror|creepy|nightmare)${R}`),
  // Chất cấm / tiền giả
  u(`${L}(?:ma tuý|ma túy|heroin|cocaine|meth(?:amphetamine)?|cần sa|thuốc phiện|tiền giả|counterfeit)${R}`),
  // Chính trị nhạy cảm / lãnh tụ / brand
  u(`${L}(?:cờ đảng|biểu tình|chính trị|political rally|swastika|nazi)${R}`),
];

const POSITIVE_HINT_PATTERNS: RegExp[] = [
  u(`(?:ánh sáng|light|luminous|glow|radiant|shining|hào quang|halo)`),
  u(`(?:thiền|meditation|zen|tĩnh lặng|an lạc|peaceful|serene|calm)`),
  u(`(?:hoa sen|lotus|hoa|flower|rose|daisy|cây|tree|forest|rừng|thiên nhiên|nature|phong cảnh|landscape)`),
  u(`(?:thiên thần|angel|seraph|thần thánh|divine|sacred|linh thiêng|holy)`),
  u(`(?:mặt trời|sun|hoàng hôn|sunset|bình minh|sunrise|dawn|dusk|sao|star|galaxy|ngân hà|vũ trụ|cosmos|universe|nebula)`),
  u(`(?:tình yêu|love|hạnh phúc|happiness|joy|niềm vui|biết ơn|gratitude|thịnh vượng|prosperity|abundance|giàu có|wealth)`),
  u(`(?:gia đình|family|trẻ em|child|children|kid|baby|pet|thú cưng|mèo|cat|chó|dog|chim|bird)`),
  u(`(?:logo|biểu tượng|symbol|icon|emblem|badge|thumbnail|poster|banner)`),
  u(`(?:biển|sea|ocean|núi|mountain|sông|river|hồ|lake|thác|waterfall|mây|cloud|sky|bầu trời)`),
  u(`(?:kiến trúc|architecture|đền|temple|chùa|nhà thờ|church|cathedral|garden|vườn)`),
  u(`(?:cha vũ trụ|father universe|god|god of light|creator|đấng sáng tạo|new heaven|new earth)`),
];

export type TopicClassification = { allowed: boolean; reason?: string };

/**
 * Phân loại prompt vẽ ảnh theo chủ đề tích cực.
 * - Match blocklist → chặn.
 * - Không match blocklist → cho phép (mặc định allow để giữ trải nghiệm mượt).
 * Allowlist chỉ dùng để log/hint style.
 */
export function classifyImageTopic(prompt: string): TopicClassification {
  const t = (prompt || "").trim();
  if (!t) return { allowed: false, reason: "empty" };
  for (const re of NEGATIVE_TOPIC_PATTERNS) {
    if (re.test(t)) return { allowed: false, reason: "blocked_topic" };
  }
  return { allowed: true };
}

/** True nếu prompt rõ ràng mang chủ đề tích cực (dùng để log/nudge style). */
export function hasPositiveTopicHint(prompt: string): boolean {
  const t = (prompt || "").trim();
  return POSITIVE_HINT_PATTERNS.some((re) => re.test(t));
}

/** Thêm hậu tố style tích cực vào prompt trước khi gửi Angel gốc.
 *  KHÔNG append khi prompt đã dài/chi tiết (>= 180 ký tự HOẶC có bullet/nhiều dòng)
 *  để không "loãng" mô tả gốc của bé. */
export function withPositiveStyleSuffix(prompt: string): string {
  const trimmed = prompt.trim();
  const lower = trimmed.toLowerCase();
  if (lower.includes("luminous") || lower.includes("uplifting")) return trimmed;
  const isDetailed =
    trimmed.length >= 180 ||
    /[•\-\*]\s/.test(trimmed) ||
    (trimmed.match(/\n/g)?.length ?? 0) >= 2;
  if (isDetailed) return trimmed;
  const suffix = "positive, luminous, uplifting, spiritually elevating aesthetic, soft warm light";
  return `${trimmed} — ${suffix}`;
}

/** Chọn mode ảnh dựa theo TOPIC (không chỉ độ phức tạp).
 *  Trước đây prompt dài luôn → spiritual → Angel gốc có bias cổ trang/tâm linh
 *  làm business/architecture/portrait bị lệch chủ đề. Giờ chỉ topic thực sự
 *  spiritual mới dùng "spiritual"; còn lại luôn "fast". */
const SPIRITUAL_TOPICS = new Set(["meditation", "lightbeing", "mandala", "cosmos"]);
export function pickImageMode(prompt: string): "fast" | "spiritual" {
  const topic = classifyArtTopic(prompt);
  if (SPIRITUAL_TOPICS.has(topic)) return "spiritual";
  return "fast";
}

/** Prompt "heavy" = có khả năng làm Angel gốc quá tải hoặc trả rỗng
 *  → cần chọn spiritual mode + bật cứng fallback + upgrade model. */
export function isHeavyPrompt(prompt: string): boolean {
  const t = (prompt || "").trim();
  if (!t) return false;
  if (t.length >= 180) return true;
  const heavy = /(logo|poster|banner|thumbnail|artwork|illustration|thiết kế|design|chi tiết|hoành tráng|role[- ]?playing|game|5d|new earth|cosmos|mandala|kiến trúc|architecture|typography|slogan|tagline)/i;
  if (heavy.test(t)) return true;
  const bulletLines = (t.match(/\n[\s]*[•\-\*]/g)?.length ?? 0);
  if (bulletLines >= 2) return true;
  return false;
}


/** Convert base64 → data URL cho web render / sendPhoto Telegram (nếu chỉ có base64). */
export function imageResultToDataUrl(r: AngelImageResult): string | null {
  if (r.image_url) return r.image_url;
  if (r.image_base64) {
    const mime = r.mime_type || "image/png";
    return `data:${mime};base64,${r.image_base64}`;
  }
  return null;
}
