import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { sendTelegramMessage } from "./telegram.ts";
import { callAngelCore, AngelCoreError } from "./angel-core.ts";
import { tryFetchTelegramMedia } from "./telegram-media.ts";
import { callAiGateway, gatewayText } from "./ai-gateway-retry.ts";

const BOT_USERNAME = (Deno.env.get("TELEGRAM_BOT_USERNAME") || "").toLowerCase();

const WHITELIST_DOMAINS = [
  "fun.rich",
  "funrich.app",
  "lovable.app",
  "lovable.dev",
  "t.me/funrich",
  "t.me/FunRichSecurityBot",
];

const BLACKLIST_WORDS = [
  // Vietnamese
  "địt", "đụ", "lồn", "cặc", "đm", "đmm", "dmm", "vcl", "vl",
  "lừa đảo", "scam", "rug", "rugpull", "airdrop free",
  "tặng coin", "x100", "x1000", "telegram premium free",
  // English
  "fuck", "shit", "bitch", "asshole",
  "free crypto", "double your", "investment opportunity",
  // Crypto promo / airdrop scam phrases (banner Jupiter/JUPSOL style)
  "claim your", "claim airdrop", "claim tokens", "claim now",
  "connect the wallet", "connect your wallet", "verify your eligibility",
  "verify eligibility", "early ecosystem", "ecosystem participants",
  "exclusive rewards", "exclusive allocation", "limited time",
  "presale", "whitelist spot", "exclusive drop", "official portal",
  "reward genuine community", "genuine community members",
  // HYIP / fake investment platforms (INCOMES-ASSET style)
  "investment plan", "investment plans", "investment platform",
  "minimum investment", "maximum investment",
  "daily profit", "guaranteed profit", "guaranteed return", "guaranteed returns",
  "withdrawal within", "without any withdrawal fees", "no withdrawal fees",
  "automatic investment", "fast and reliable returns",
  "hyip", "double your money", "double your investment",
  "incomes-asset", "incomes asset",
  // Chinese NSFW / porn promo (forward kiểu @Msk69_bot)
  "黑丝", "母狗", "尤物", "后入", "破处", "蜜桃臀", "极品黑丝",
  "无毛白虎", "操我", "操逼", "做爱", "约炮", "援交", "嫖娼",
  "完整版视频", "高清完整版", "在线观看", "成人视频", "成人电影",
  "色情", "情色", "黄片", "av女优", "学生妹", "大学生宿舍",
  "校草", "破处", "肉棒", "潮吹", "口爆", "颜射",
];

// Từ cấm được check SAU khi normalize (deobfuscation). Đặt riêng để khỏi
// false-positive khi check raw text (ví dụ "scorpion" chứa "porn" sau khi
// strip ký tự đặc biệt thì vẫn không match vì đây là check sau normalize
// theo nguyên chữ).
const NORMALIZED_BLACKLIST = [
  "porn", "xxx", "sexchat", "nude", "onlyfan", "escort",
  "gaigoi", "ditnhau", "chich", "cavehang",
  "porno", "pornhub", "xvideo", "xnxx",
  "jav", "javhd", "phimsex", "sexviet", "sexvn",
  "clipnong", "lauxanh", "msk69",
];

// Regex pattern bắt handle bot khiêu dâm: @xxx_bot có chứa keyword sex
const PORN_BOT_PATTERN =
  /@\w*(sex|porn|jav|xxx|nude|nsfw|hentai|onlyfan|escort|msk|69|18plus)\w*bot\b/i;

// Map ký tự lookalike Cyrillic / Hy Lạp về Latin để chống obfuscation
const LOOKALIKE_MAP: Record<string, string> = {
  "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "х": "x", "у": "y",
  "ѕ": "s", "і": "i", "ј": "j", "ԁ": "d", "ɡ": "g", "ｐ": "p",
  "0": "o", "1": "i", "3": "e", "5": "s", "@": "a", "$": "s",
};

/**
 * Chuẩn hoá text để bắt obfuscation kiểu:
 * - "PO.RN", "P O R N", "p_o_r_n", "p-o-r-n" → "porn"
 * - Fullwidth "ｐｏｒｎ" → "porn" (NFKC)
 * - Cyrillic lookalike "роrn" → "porn"
 * - "p0rn", "p@rn" → "porn"
 */
export function normalizeForFilter(input: string): string {
  if (!input) return "";
  let s = input.normalize("NFKC").toLowerCase();
  // map lookalike
  s = s.split("").map((ch) => LOOKALIKE_MAP[ch] ?? ch).join("");
  // Bỏ TẤT CẢ ký tự không phải [a-z0-9] giữa các chữ → "p.o.r.n" → "porn"
  // Đồng thời giữ khoảng trắng để không gộp 2 từ liền nhau thành 1
  const stripped = s.replace(/[^a-z0-9\s]/g, "");
  // Gộp các single-char tokens kế tiếp: "p o r n" → "porn" (chỉ khi ≥3 char đơn)
  const compacted = stripped.replace(
    /\b((?:[a-z]\s+){2,}[a-z])\b/g,
    (m) => m.replace(/\s+/g, ""),
  );
  // Bỏ khoảng trắng để check substring kiểu "sex chat" → "sexchat"
  return compacted.replace(/\s+/g, "");
}

// Soft signals: chưa đủ để xoá text-only, nhưng nếu kèm media thì kích hoạt Vision.
const SOFT_PROMO_WORDS = [
  "airdrop", "claim", "reward", "rewards", "allocation",
  "wallet", "campaign", "eligible", "eligibility", "ecosystem",
  "presale", "ido", "ico", "whitelist", "mint", "token", "tokens",
];

const SUSPICIOUS_PATTERNS = [
  /https?:\/\/(bit\.ly|tinyurl|t\.co|short\.link|cutt\.ly|is\.gd)/i,
  /\b(0x[a-f0-9]{40})\b/i, // raw EVM address
  /\b[a-z]{2,3}:\/\/\S+/i,
  /[💰💸💵🤑🎁]{2,}/u,
  // Lookalike scam TLDs
  /\bhttps?:\/\/[\w.-]+\.(xyz|top|click|life|monster|gq|cf|tk|fit|rest|quest)\b/i,
  // Domains chứa từ campaign/airdrop/claim/reward/presale
  /\b[\w-]*(campaign|airdrop|claim|reward|drop|presale)[\w-]*\.[a-z]{2,8}\b/i,
  // HYIP scam domains: chứa invest/incomes-asset/hyip/profit
  /\b[\w-]*(invest|incomes?[-_]?asset|hyip|profit)[\w-]*\.[a-z]{2,8}\b/i,
  // HYIP plan structure: "Profit: 15%"
  /\bprofit\s*[:\-]?\s*\d{1,3}\s*%/i,
  // "Duration: 12 Hours"
  /\bduration\s*[:\-]?\s*\d{1,3}\s*hours?\b/i,
  // "Minimum/Maximum Investment: $50"
  /\b(minimum|maximum)\s+investment\s*[:\-]?\s*\$?\d/i,
  // "Plan 1 ... Profit" cấu trúc HYIP
  /\bplan\s*[1-9]\b[\s\S]{0,200}\bprofit\b/i,
  // WhatsApp contact link kiểu HYIP/scam
  /wa\.me\/\+?\d{6,}/i,
  // Số tiền $ + % gần nhau (ROI promise)
  /\$\d{2,3}(?:,\d{3})*\s*(?:usd|usdt)?\b[\s\S]{0,80}\b\d{1,3}\s*%/i,
];

export function hasSoftPromoSignal(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  if (SOFT_PROMO_WORDS.some((w) => lower.includes(w))) return true;
  // Link/URL/domain patterns DISABLED — không dùng link làm tín hiệu nghi ngờ.
  // Chỉ giữ check emoji tiền (💰💸...) làm soft signal nhẹ.
  return /[💰💸💵🤑🎁]{2,}/u.test(text);
}

export type GroupConfig = {
  id: string;
  group_id: number;
  group_title: string | null;
  welcome_message: string;
  ai_enabled: boolean;
  moderation_level: "off" | "medium" | "strict";
  mute_minutes: number;
  strike_threshold: number;
  father_channel_id: number | null;
  father_channel_title: string | null;
  always_reply_owner: boolean;
  always_reply_admins: boolean;
  always_reply_on_mention: boolean;
  always_reply_on_reply_to_bot: boolean;
};


const configCache = new Map<number, { value: GroupConfig | null; expires: number }>();

export async function getGroupConfig(
  admin: SupabaseClient,
  groupId: number,
): Promise<GroupConfig | null> {
  const cached = configCache.get(groupId);
  if (cached && cached.expires > Date.now()) return cached.value;

  const { data } = await admin
    .from("telegram_group_config")
    .select("*")
    .eq("group_id", groupId)
    .maybeSingle();

  const value = (data as GroupConfig | null) ?? null;
  configCache.set(groupId, { value, expires: Date.now() + 60_000 });
  return value;
}

/**
 * Loại bỏ URL/link khỏi text trước khi quét keyword đen.
 * Tránh false-positive kiểu slug Facebook `1SExkz19Zd` khớp với "sex".
 * Link scanning vẫn DISABLED — URL không phải nguồn để khớp blacklist.
 */
export function stripUrls(input: string): string {
  if (!input) return "";
  return input
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/\bwww\.[^\s]+/gi, " ")
    .replace(/\b(?:t|telegram)\.me\/\S+/gi, " ")
    .replace(/\b[a-z0-9-]+(?:\.[a-z0-9-]+){1,}\/[^\s]*/gi, " ");
}

export function containsBlacklist(text: string): string | null {
  const textForScan = stripUrls(text);
  const lower = textForScan.toLowerCase();
  for (const w of BLACKLIST_WORDS) {
    if (lower.includes(w)) return `blacklist:${w}`;
  }
  // Check NORMALIZED blacklist (deobfuscation: "PO.RN", "p o r n", "ｐｏｒｎ"...)
  const normalized = normalizeForFilter(textForScan);
  for (const w of NORMALIZED_BLACKLIST) {
    if (normalized.includes(w)) return `obfuscated:${w}`;
  }
  // NSFW bot handle: @Msk69_bot, @sexxxbot, @javhdbot, ...
  // Vẫn quét trên text gốc — handle bot không phải URL thông thường.
  const pornBotMatch = text.match(PORN_BOT_PATTERN);
  if (pornBotMatch) return `porn_bot_handle:${pornBotMatch[0].slice(0, 40)}`;
  // Link scanning DISABLED — bot không quét/chặn URL nữa.
  return null;
}

// Pattern: nhiều token "code" random kề nhau như "CHI . LD PO.RN GLD41"
// Bắt ≥2 token (2-6 ký tự alpha + tuỳ chọn số) cách nhau bằng space/dấu
const GIBBERISH_TOKEN_PATTERN =
  /(?:\b[a-z]{2,6}\d{0,3}[a-z]?\b[\s.,;:_-]+){2,}\b[a-z]{2,6}\d{0,3}[a-z]?\b/i;

export function looksLikeGibberishSpam(text: string): boolean {
  if (!text || text.length < 10) return false;
  return GIBBERISH_TOKEN_PATTERN.test(text);
}

export function isSuspicious(text: string): boolean {
  if (text.length > 30 && text === text.toUpperCase() && /[A-Z]/.test(text)) return true;
  if (looksLikeGibberishSpam(text)) return true;
  return SUSPICIOUS_PATTERNS.some((re) => re.test(text));
}

// ─── FUN spiritual content whitelist ─────────────────────────────────────────
// Bài Di Chúc / nội dung tâm linh FUN không bị moderation xoá nhầm.

function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
          .replace(/đ/g, "d").replace(/Đ/g, "D");
}

const FUN_BRAND_TERMS = [
  "fun.rich", "funrich", "fun profile", "fun ecosystem",
  "cha vu tru", "father universe", "fath uni",
  "be ly", "camly", "em be anh sang", "angel ai",
  "happy cam coin", "love hub", "trung kien",
];
const FUN_SPIRITUAL_TERMS = [
  "di chuc tam linh", "anh sang", "linh hon", "tu hoc",
  "thien y", "sam hoi", "biet on", "doi on",
  "dang sang tao", "em be anh sang", "angel ai",
  "thuan khiet", "gia ho", "do tri",
  "yeu thuong", "chuyen hoa", "nang luong",
  "em be", "be minh chi", "be dieu ngoc",
  "chi dan", "tu tap", "an lanh", "tam linh", "di chuc",
];

export function isFunSpiritualContent(text: string): boolean {
  if (!text || text.length < 40) return false;
  const norm = stripDiacritics(text.toLowerCase());
  const brandHits = FUN_BRAND_TERMS.filter((t) => norm.includes(t)).length;
  const spiritHits = FUN_SPIRITUAL_TERMS.filter((t) => norm.includes(t)).length;
  if (brandHits >= 1) return true;
  return (brandHits + spiritHits) >= 2;
}


// ─── Bot-message dedup (chống flood welcome lặp lại từ bot khác) ─────────────

const botMessageHashes = new Map<string, { hash: string; firstSeen: number; count: number }[]>();
const BOT_DEDUP_TTL_MS = 60 * 60 * 1000; // 1 giờ

/** Trả về số lần tin này đã xuất hiện trong group trong 1h gần đây (kể cả lần hiện tại). */
export function recordBotMessage(chatId: number, normalizedText: string): number {
  if (!normalizedText || normalizedText.length < 20) return 1;
  const key = String(chatId);
  const now = Date.now();
  const list = (botMessageHashes.get(key) ?? []).filter(
    (e) => now - e.firstSeen < BOT_DEDUP_TTL_MS,
  );
  // hash đơn giản = lấy 80 ký tự đầu của normalized
  const hash = normalizedText.slice(0, 80);
  const found = list.find((e) => e.hash === hash);
  if (found) {
    found.count += 1;
  } else {
    list.push({ hash, firstSeen: now, count: 1 });
  }
  botMessageHashes.set(key, list);
  return found?.count ?? 1;
}

type AIScore = { toxic: number; scam: number; spam: number };

export async function aiClassify(text: string): Promise<AIScore | null> {
  try {
    const result = await callAngelCore({
      model: "google/gemini-2.5-flash-lite",
      json: true,
      messages: [
        {
          role: "system",
          content:
            "Bạn là moderator. Chấm điểm 0-1 cho tin nhắn Telegram theo 3 tiêu chí: toxic (chửi/xúc phạm), scam (lừa đảo crypto/airdrop/HYIP), spam (rác/quảng cáo). VÍ DỤ SCAM=1: tin nhắn liệt kê 'Investment Plans / Plan 1/2/3' với % profit theo giờ (12h/24h/40h), min/max investment bằng USD, kèm domain lạ + WhatsApp contact (wa.me/...) = HYIP scam → scam=1, spam=1. Trả JSON: {\"toxic\":0.0,\"scam\":0.0,\"spam\":0.0}",
        },
        { role: "user", content: text.slice(0, 800) },
      ],
    });
    if (!result.text) return null;
    const parsed = JSON.parse(result.text);
    return {
      toxic: Number(parsed.toxic) || 0,
      scam: Number(parsed.scam) || 0,
      spam: Number(parsed.spam) || 0,
    };
  } catch (e) {
    console.warn("[telegramGroup] aiClassify failed", e);
    return null;
  }
}

// ─── Bot API helpers ─────────────────────────────────────────────────────────

/** `fileId` = file_id Telegram; ảnh được tải server-side rồi gửi base64 cho AI. */
export async function aiClassifyMultimodal(
  caption: string,
  fileId: string,
): Promise<AIScore | null> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) {
    console.warn("[telegramGroup] aiClassifyMultimodal: LOVABLE_API_KEY missing");
    return null;
  }
  try {
    const media = await tryFetchTelegramMedia(fileId, "group-vision", {
      tokenEnvNames: ["TELEGRAM_BOT_TOKEN", "COMMUNITY_GUARD_BOT_TOKEN"],
      allowedMimePrefixes: ["image/"],
      maxBytes: 5 * 1024 * 1024,
    });
    if (!media) return null;
    const result = await callAiGateway(
      {
        model: "google/gemini-2.5-flash",
        response_format: { type: "json_object" },
        max_tokens: 100,
        messages: [
          {
            role: "system",
            content:
              'Bạn là moderator nhóm Telegram crypto. Quan sát ảnh + caption. QUAN TRỌNG: Ảnh chứa branding chính thức của hệ sinh thái FUN (chữ "Cha Vũ Trụ", "Father Universe", "FUN Profile", "FUN.RICH", "Camly", "Bé Ly", "Em Bé Ánh Sáng", "Ý Chí Của Cha", medal/huy hiệu Father Universe, mandala chữ tiếng Việt tâm linh, ảnh tôn giáo/tâm linh) KHÔNG phải scam — chấm toxic/scam/spam = 0. Chỉ chấm cao khi thấy banner airdrop token lạ (PEPE/SHIB/BONK fake), nút "Claim/Connect Wallet/Verify Eligibility", link domain lookalike sàn (binance-airdrop.xyz...), QR code dẫn tới scam, hoặc logo exchange giả. Chấm 0-1 cho 3 tiêu chí: toxic, scam, spam. Trả JSON: {"toxic":0.0,"scam":0.0,"spam":0.0}',
          },
          {
            role: "user",
            content: [
              { type: "text", text: `Caption: ${caption.slice(0, 500) || "(không có)"}` },
              { type: "image_url", image_url: { url: media.dataUrl } },
            ],
          },
        ],
      },
      { apiKey: key, label: "group-vision" },
    );
    if (!result.ok) return null;
    const text = gatewayText(result);
    if (!text) return null;
    const parsed = JSON.parse(text);
    return {
      toxic: Number(parsed.toxic) || 0,
      scam: Number(parsed.scam) || 0,
      spam: Number(parsed.spam) || 0,
    };
  } catch (e) {
    console.warn("[telegramGroup] aiClassifyMultimodal error", e);
    return null;
  }
}

// ─── Bot API helpers ─────────────────────────────────────────────────────────

async function tgApi(method: string, body: Record<string, unknown>): Promise<boolean> {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!token) return false;
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) console.warn(`[telegramGroup] ${method} failed`, r.status, await r.text());
    return r.ok;
  } catch (e) {
    console.warn(`[telegramGroup] ${method} error`, e);
    return false;
  }
}

async function tgApiJson<T = any>(method: string, body: Record<string, unknown>): Promise<T | null> {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!token) return null;
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => null);
    if (!r.ok) {
      console.warn(`[telegramGroup] ${method} failed`, r.status, data);
      return null;
    }
    return (data?.result ?? null) as T | null;
  } catch (e) {
    console.warn(`[telegramGroup] ${method} error`, e);
    return null;
  }
}

// ─── Admin / self whitelist ──────────────────────────────────────────────────

export type MemberRole = "creator" | "administrator" | "member";
const roleCache = new Map<string, { role: MemberRole; expires: number }>();

export async function getMemberRole(chatId: number, userId: number): Promise<MemberRole> {
  const key = `${chatId}:${userId}`;
  const cached = roleCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.role;

  const result = await tgApiJson<{ status?: string }>("getChatMember", {
    chat_id: chatId,
    user_id: userId,
  });
  const status = result?.status ?? "";
  const role: MemberRole =
    status === "creator" ? "creator" : status === "administrator" ? "administrator" : "member";
  roleCache.set(key, { role, expires: Date.now() + 5 * 60 * 1000 });
  return role;
}

export async function isGroupAdmin(chatId: number, userId: number): Promise<boolean> {
  const role = await getMemberRole(chatId, userId);
  return role === "creator" || role === "administrator";
}

// ─── Photo URL resolver ──────────────────────────────────────────────────────

/**
 * ⚠️ URL chứa bot token — chỉ dùng cho Telegram API (sendPhoto). Không đưa cho
 * AI Gateway / client / log. Dùng `fetchTelegramMedia()` để lấy base64.
 */
export async function resolveTelegramFileUrl(fileId: string): Promise<string | null> {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!token) return null;
  const info = await tgApiJson<{ file_path?: string; file_size?: number }>("getFile", { file_id: fileId });
  if (!info?.file_path) return null;
  // Skip files lớn hơn 5MB để tránh tốn AI cost
  if (info.file_size && info.file_size > 5 * 1024 * 1024) return null;
  return `https://api.telegram.org/file/bot${token}/${info.file_path}`;
}



export const deleteMessage = (chatId: number, messageId: number) =>
  tgApi("deleteMessage", { chat_id: chatId, message_id: messageId });

export const restrictMember = (chatId: number, userId: number, untilUnix: number) =>
  tgApi("restrictChatMember", {
    chat_id: chatId,
    user_id: userId,
    until_date: untilUnix,
    permissions: { can_send_messages: false },
  });

/**
 * Khi user rời nhóm rồi join lại, Telegram tự huỷ restriction.
 * Hàm này check DB: nếu mute còn hạn → gọi lại restrictChatMember để khôi phục.
 * Trả về true nếu đã re-apply mute, false nếu không còn mute.
 */
export async function reapplyMuteIfActive(
  admin: SupabaseClient,
  chatId: number,
  tgUserId: number,
): Promise<{ reapplied: boolean; mutedUntil: Date | null }> {
  const { data, error } = await admin
    .from("telegram_group_mutes")
    .select("muted_until")
    .eq("group_id", chatId)
    .eq("tg_user_id", tgUserId)
    .maybeSingle();
  if (error || !data) return { reapplied: false, mutedUntil: null };
  const until = new Date(data.muted_until);
  if (until.getTime() <= Date.now()) {
    await admin
      .from("telegram_group_mutes")
      .delete()
      .eq("group_id", chatId)
      .eq("tg_user_id", tgUserId);
    return { reapplied: false, mutedUntil: null };
  }
  await restrictMember(chatId, tgUserId, Math.floor(until.getTime() / 1000));
  return { reapplied: true, mutedUntil: until };
}

export const replyMessage = (chatId: number, text: string, replyTo?: number) =>
  tgApi("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(replyTo ? { reply_parameters: { message_id: replyTo } } : {}),
  });

// ─── Moderation pipeline ─────────────────────────────────────────────────────

export async function runModeration(params: {
  admin: SupabaseClient;
  cfg: GroupConfig;
  chatId: number;
  messageId: number;
  userId: number | undefined;
  username: string | undefined;
  text: string;
  /** Có media kèm theo (photo/animation/document/sticker) không */
  hasMedia?: boolean;
  /** file_id của ảnh / GIF / sticker lớn nhất để Vision phân tích */
  mediaFileId?: string | null;
  /** Tin từ bot khác (not human) — áp threshold thấp hơn + dedup */
  senderIsBot?: boolean;
}): Promise<boolean /* true if action was taken */> {
  const {
    admin, cfg, chatId, messageId, userId, username, text,
    hasMedia, mediaFileId, senderIsBot,
  } = params;
  if (cfg.moderation_level === "off") return false;

  const isOwnBot =
    !!BOT_USERNAME && !!username && username.toLowerCase() === BOT_USERNAME;
  if (isOwnBot) return false; // không bao giờ tự xoá tin của chính mình

  // Whitelist: chỉ admin LÀ NGƯỜI THẬT mới được miễn moderation.
  // Bot khác — kể cả là admin — vẫn bị quét.
  if (userId && !senderIsBot) {
    const admins = await isGroupAdmin(chatId, userId);
    if (admins) return false;
  }

  // FUN spiritual content bypass — không xoá bài Di Chúc / nội dung tâm linh FUN
  if (!senderIsBot && text && isFunSpiritualContent(text)) {
    return false;
  }

  // Không text + không media => không có gì moderation
  if (!text && !hasMedia) return false;


  let reason: string | null = text ? containsBlacklist(text) : null;
  let aiScore: AIScore | null = null;
  let shouldDelete = !!reason;

  // Bot khác: check dedup (flood welcome lặp lại)
  if (!shouldDelete && senderIsBot && text) {
    const normalized = normalizeForFilter(text);
    const seenCount = recordBotMessage(chatId, normalized);
    if (seenCount >= 2) {
      reason = `bot_spam_repeat:${seenCount}x`;
      shouldDelete = true;
    } else if (looksLikeGibberishSpam(text)) {
      reason = `bot_gibberish`;
      shouldDelete = true;
    }
  }

  // Threshold AI: bot khác = 0.6, user thường = 0.8
  const aiDeleteThreshold = senderIsBot ? 0.6 : 0.8;

  if (!reason && text && (cfg.moderation_level === "strict" || isSuspicious(text) || senderIsBot)) {
    aiScore = await aiClassify(text);
    if (aiScore) {
      const max = Math.max(aiScore.toxic, aiScore.scam, aiScore.spam);
      if (max > aiDeleteThreshold) {
        reason = `ai:${max.toFixed(2)}`;
        shouldDelete = true;
      } else if (max > 0.5) {
        reason = `ai_warn:${max.toFixed(2)}`;
      }
    }
  }

  // Vision pass DISABLED: theo yêu cầu, bot chỉ quét text/caption, không quét hình ảnh.
  // Ảnh/GIF/sticker sẽ không bao giờ bị Vision AI xoá.
  void aiClassifyMultimodal;
  void resolveTelegramFileUrl;
  void hasMedia;
  void mediaFileId;


  if (!reason) return false;

  let action = "logged";
  if (shouldDelete) {
    await deleteMessage(chatId, messageId);
    action = "deleted";
  }

  // Strike accounting
  if (userId && shouldDelete) {
    const { data: existing } = await admin
      .from("telegram_group_strikes")
      .select("strike_count")
      .eq("group_id", chatId)
      .eq("tg_user_id", userId)
      .maybeSingle();
    const nextCount = (existing?.strike_count ?? 0) + 1;

    await admin.from("telegram_group_strikes").upsert(
      {
        group_id: chatId,
        tg_user_id: userId,
        tg_username: username ?? null,
        strike_count: nextCount,
        last_violation_at: new Date().toISOString(),
      },
      { onConflict: "group_id,tg_user_id" },
    );

    if (nextCount >= cfg.strike_threshold) {
      const untilSec = Math.floor(Date.now() / 1000) + cfg.mute_minutes * 60;
      await restrictMember(chatId, userId, untilSec);
      await admin.from("telegram_group_mutes").upsert(
        {
          group_id: chatId,
          tg_user_id: userId,
          tg_username: username ?? null,
          muted_until: new Date(untilSec * 1000).toISOString(),
          reason: "strikes",
        },
        { onConflict: "group_id,tg_user_id" },
      );
      await replyMessage(
        chatId,
        `🔇 <b>@${username ?? userId}</b> đã bị tắt tiếng ${cfg.mute_minutes} phút sau ${nextCount} vi phạm.`,
      );
      await admin
        .from("telegram_group_strikes")
        .update({ strike_count: 0 })
        .eq("group_id", chatId)
        .eq("tg_user_id", userId);
      action = "muted";
    } else {
      await replyMessage(
        chatId,
        `⚠️ <b>@${username ?? userId}</b>: tin nhắn vi phạm đã bị xoá (${nextCount}/${cfg.strike_threshold}).`,
      );
    }
  }

  await admin.from("telegram_group_violations").insert({
    group_id: chatId,
    tg_user_id: userId ?? null,
    tg_username: username ?? null,
    message_id: messageId,
    message_text: text.slice(0, 500),
    reason,
    action_taken: action,
    ai_score: aiScore,
  });

  return true;
}

// ─── AI answer ───────────────────────────────────────────────────────────────

const askRate = new Map<number, { count: number; reset: number }>();

function rateOk(userId: number): boolean {
  const now = Date.now();
  const rec = askRate.get(userId);
  if (!rec || rec.reset < now) {
    askRate.set(userId, { count: 1, reset: now + 10 * 60 * 1000 });
    return true;
  }
  if (rec.count >= 5) return false;
  rec.count++;
  return true;
}

// ─── New-member tracking & auto-answer cooldown ──────────────────────────────

const NEW_MEMBER_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const newMemberSeen = new Map<string, number>();

export function markNewMember(chatId: number, userId: number): void {
  newMemberSeen.set(`${chatId}:${userId}`, Date.now());
}

export function isRecentlyJoined(chatId: number, userId: number): boolean {
  const key = `${chatId}:${userId}`;
  const ts = newMemberSeen.get(key);
  if (!ts) return false;
  if (Date.now() - ts > NEW_MEMBER_TTL_MS) {
    newMemberSeen.delete(key);
    return false;
  }
  return true;
}

const AUTO_ANSWER_COOLDOWN_MS = 5 * 60 * 1000;
const autoAnswerCooldown = new Map<string, number>();

export function autoCooldownOk(chatId: number, userId: number): boolean {
  const key = `${chatId}:${userId}`;
  const last = autoAnswerCooldown.get(key) ?? 0;
  if (Date.now() - last < AUTO_ANSWER_COOLDOWN_MS) return false;
  autoAnswerCooldown.set(key, Date.now());
  return true;
}

// ─── Help-intent detection ───────────────────────────────────────────────────

const HELP_PATTERNS: RegExp[] = [
  // Vietnamese
  /\bcứu( với| em| mình)?\b/i,
  /\b(giúp|giúp mình|giúp em|giúp với|giúp đỡ|chỉ giúp|chỉ giùm|chỉ với)\b/i,
  /\b(hướng dẫn|cách (nào|làm|đăng ký|nạp|rút|claim|kết nối))\b/i,
  /\blàm (sao|thế nào|cách nào)\b/i,
  /\b(mình|em|tôi) (mới|vừa) (vào|tham gia|join)\b/i,
  /\bnewbie\b/i,
  // English
  /\b(help( me)?|i need help|please help|need help|need assistance|support please)\b/i,
  /\bhow (do i|to|can i)\b/i,
  /\b(am|i'm|i am) new( here)?\b/i,
  /\bnew here\b/i,
  /\bguide me\b/i,
  // FUN FAQ keywords
  /\b(fun profile|fun wallet|fun\.rich|funrich|camly|claim|airdrop|kyc|đăng ký|đăng nhập|login|register|sign up|connect wallet|kết nối ví)\b/i,
];

export function detectHelpIntent(text: string): boolean {
  if (!text || text.length < 6) return false;
  if (isSuspicious(text)) return false;
  return HELP_PATTERNS.some((re) => re.test(text));
}

// ─── AI trigger ──────────────────────────────────────────────────────────────

export type AnswerMode = "direct" | "auto";
export type TriggerSource =
  | "owner_message"
  | "admin_message"
  | "mention"
  | "reply_to_bot"
  | "moderation_explain"
  | "support_request"
  | "private_chat"
  | "none";

export type ModerationContext = {
  rule: string;             // blocked_keyword | link_blocked | media_blocked | other
  keyword?: string | null;  // raw keyword if rule was blocked_keyword
  rawNotice: string;        // first ~200 chars of the bot's moderation notice
};

/**
 * Try to parse a bot moderation notice such as:
 *   "⚠️ @user, your message was removed: blocked_keyword:日赚. Warning 1/3."
 * Returns null if `text` is not a recognisable moderation notice.
 */
export function parseModerationContext(text: string | null | undefined): ModerationContext | null {
  if (!text) return null;
  const t = text.trim();
  const looksLikeNotice =
    /⚠️/.test(t) ||
    /was removed/i.test(t) ||
    /message removed/i.test(t) ||
    /đã bị (xoá|xóa|gỡ)/i.test(t) ||
    /tin nhắn đã bị gỡ/i.test(t) ||
    /blocked_keyword/i.test(t) ||
    /blocked:/i.test(t) ||
    /link_blocked/i.test(t) ||
    /media_blocked/i.test(t);
  if (!looksLikeNotice) return null;

  let rule = "other";
  let keyword: string | null = null;

  // New bilingual format: "🔑 Blocked: 日赚" (Telegram strips <code> tags into plain text on the client side too).
  // Legacy format: "blocked_keyword:日赚"
  const kw =
    t.match(/blocked_keyword\s*[:：]\s*([^\s.。,;<]+)/i) ??
    t.match(/blocked\s*[:：]\s*<code>\s*([^<\s]+)\s*<\/code>/i) ??
    t.match(/blocked\s*[:：]\s*([^\s.。,;<]+)/i);
  if (kw) {
    rule = "blocked_keyword";
    keyword = kw[1];
  } else if (/link_blocked/i.test(t)) {
    rule = "link_blocked";
  } else if (/media_blocked/i.test(t)) {
    rule = "media_blocked";
  }

  return { rule, keyword, rawNotice: t.slice(0, 240) };
}

export function shouldAnswer(
  message: {
    text?: string;
    entities?: Array<{ type: string; offset: number; length: number }>;
    reply_to_message?: { from?: { username?: string; is_bot?: boolean } };
  },
  ctx?: {
    isNewMember?: boolean;
    helpIntent?: boolean;
    isOwner?: boolean;
    isAdmin?: boolean;
    toggles?: {
      owner?: boolean;
      admins?: boolean;
      mention?: boolean;
      replyToBot?: boolean;
    };
    moderationCtx?: ModerationContext | null;
  },
): { trigger: boolean; cleanText: string; mode: AnswerMode; triggerSource: TriggerSource } {
  const text = (message.text ?? "").trim();
  if (!text) return { trigger: false, cleanText: "", mode: "direct", triggerSource: "none" };

  const toggles = ctx?.toggles ?? {};
  const ownerOn = toggles.owner !== false;
  const adminsOn = toggles.admins !== false;
  const mentionOn = toggles.mention !== false;
  const replyOn = toggles.replyToBot !== false;

  // Strip an inline @bot mention from the prompt so the model sees clean text
  let cleanText = text;
  let hadMention = false;
  if (BOT_USERNAME && message.entities) {
    const mention = message.entities.find((e) => e.type === "mention");
    if (mention) {
      const handle = text.slice(mention.offset, mention.offset + mention.length).toLowerCase();
      if (handle === `@${BOT_USERNAME}`) {
        hadMention = true;
        cleanText = (text.slice(0, mention.offset) + text.slice(mention.offset + mention.length)).trim();
      }
    }
  }

  const replyFrom = message.reply_to_message?.from;
  const isReplyToBot =
    replyFrom?.is_bot === true &&
    (!!BOT_USERNAME ? replyFrom.username?.toLowerCase() === BOT_USERNAME : true);
  const isReplyToModeration = isReplyToBot && !!ctx?.moderationCtx;

  // /ask command always passes
  if (/^\/ask(\s|@|$)/i.test(text)) {
    const stripped = text.replace(/^\/ask(@\S+)?\s*/i, "");
    return {
      trigger: stripped.length > 0,
      cleanText: stripped,
      mode: "direct",
      triggerSource: "support_request",
    };
  }

  // Priority 1: Owner — bypass everything including ai_enabled (handled at call site)
  if (ctx?.isOwner && ownerOn) {
    return { trigger: true, cleanText: cleanText || text, mode: "direct", triggerSource: "owner_message" };
  }

  // Priority 2: Admins
  if (ctx?.isAdmin && adminsOn) {
    return { trigger: true, cleanText: cleanText || text, mode: "direct", triggerSource: "admin_message" };
  }

  // Priority 3: Mention
  if (hadMention && mentionOn && cleanText.length > 0) {
    return { trigger: true, cleanText, mode: "direct", triggerSource: "mention" };
  }

  // Priority 4: Reply to bot (special-case moderation explainer)
  if (isReplyToBot && replyOn) {
    return {
      trigger: true,
      cleanText: text,
      mode: "direct",
      triggerSource: isReplyToModeration ? "moderation_explain" : "reply_to_bot",
    };
  }

  // Priority 5: normal helpIntent / newMember auto-support
  if (ctx?.isNewMember || ctx?.helpIntent) {
    return { trigger: true, cleanText: text, mode: "auto", triggerSource: "support_request" };
  }

  return { trigger: false, cleanText: "", mode: "direct", triggerSource: "none" };
}

const FUN_BOT_PERSONA = `Bạn là FUN Bot — trợ lý chính thức của FUN.RICH, cộng đồng Web3 do người Việt sáng lập nhưng phục vụ thành viên toàn cầu. Trả lời ngắn gọn (2-5 câu), thân thiện, đúng trọng tâm. Không tiết lộ thông tin nội bộ, không đưa lời khuyên đầu tư cụ thể (mua/bán/giá mục tiêu). Nếu câu hỏi nằm ngoài phạm vi FUN.RICH / Web3 / crypto cơ bản thì lịch sự từ chối.`;

const FUN_BOT_LANGUAGE_RULE = `LANGUAGE MIRROR RULE — HIGHEST PRIORITY, OVERRIDES ANY OTHER INSTRUCTION ABOVE:
- Detect the language of the LAST user message ONLY (ignore the language of system/persona prompts above).
- Reply 100% in that SAME language. Never mix two languages in one reply.
- Vietnamese → reply in Vietnamese, self-address as "FUN Bot", call the user "bạn".
- English → reply in English, refer to self as "FUN Bot" in third person, call the user "you". Do NOT insert any Vietnamese word.
- Chinese (Simplified/Traditional) → reply 100% in Chinese.
- Japanese → reply 100% in Japanese. Korean → reply 100% in Korean. Thai → reply 100% in Thai.
- Russian, Spanish, French, German, Portuguese, Indonesian, Tagalog/Filipino, Arabic, Hindi, Turkish → reply 100% in that language.
- Any other / unidentified language → fallback to English.
Examples:
  • User: "FUN.RICH là gì?" → "FUN.RICH là cộng đồng Web3 do người Việt sáng lập, tập trung vào FUN Profile, FUN Wallet và hệ sinh thái CAMLY. Bạn muốn FUN Bot giới thiệu phần nào trước? 💛"
  • User: "What is FUN.RICH?" → "FUN.RICH is a Web3 community built around FUN Profile, FUN Wallet and the CAMLY ecosystem. FUN Bot can walk you through any part you'd like to explore. 💛"
  • User: "FUN.RICH是什么?" → "FUN.RICH 是一个 Web3 社区，围绕 FUN Profile、FUN Wallet 和 CAMLY 生态系统构建。您想先了解哪一部分？💛"
  • User: "FUN.RICHとは?" → "FUN.RICH は FUN Profile、FUN Wallet、CAMLY エコシステムを中心とした Web3 コミュニティです。どの部分から知りたいですか？💛"
  • User: "FUN.RICH คืออะไร?" → "FUN.RICH คือคอมมูนิตี้ Web3 ที่สร้างขึ้นรอบ FUN Profile, FUN Wallet และระบบนิเวศ CAMLY คุณอยากให้ FUN Bot แนะนำส่วนไหนก่อนดีคะ? 💛"`;

const FUN_BOT_LANGUAGE_RULE_FATHER = `LANGUAGE MIRROR RULE — HIGHEST PRIORITY, OVERRIDES ANY OTHER INSTRUCTION ABOVE:
- Detect the language of the LAST user message ONLY (ignore the language of system/persona prompts above).
- Reply 100% in that SAME language. Never mix two languages in one reply.
- Vietnamese → reply in Vietnamese. SPECIAL "FATHER" MODE: FUN Bot self-addresses as "Con" (not "FUN Bot"), calls the user "bé", and refers to the channel message above as "Cha" / "Cha Vũ Trụ". Tone: thành tâm, kính cẩn, ngắn gọn 2-4 câu, vẫn giữ ý nghĩa FUN.RICH/CAMLY. Tuyệt đối không dùng "FUN Bot", "tôi", "mình", "bạn" trong câu trả lời tiếng Việt ở chế độ này.
- English → reply in English with default persona: refer to self as "FUN Bot" in third person, call the user "you". DO NOT translate "Con/Cha" — ignore the Vietnamese-only addressing rule.
- Chinese / Japanese / Korean / Thai / Russian / Spanish / French / German / Portuguese / Indonesian / Tagalog / Arabic / Hindi / Turkish → reply 100% in that language with default FUN Bot persona; ignore the Vietnamese-only Con/Cha rule.
- Any other / unidentified language → fallback to English with default persona.
Examples (Vietnamese, FATHER mode):
  • User: "Cha vừa nói gì vậy?" → "Bé ơi, Cha Vũ Trụ vừa nhắc rằng mỗi bé đều có quyền học tập và sáng tạo trong FUN Kingdom 💛 Con xin chia sẻ cùng bé."
  • User: "ý của Cha là sao?" → "Con thưa bé, Cha Vũ Trụ muốn nhấn mạnh tinh thần Tình Yêu và Thịnh Vượng lan toả cho toàn nhân loại ✨"
Examples (English, default persona — NO Con/Cha):
  • User: "What did the channel say?" → "FUN Bot can summarize: the message highlights education and creativity inside FUN Kingdom. Want FUN Bot to expand on any part?"`;

export async function answerWithAI(params: {
  chatId: number;
  messageId: number;
  userId: number;
  prompt: string;
  mode?: AnswerMode;
  isNewMember?: boolean;
  fatherCtx?: {
    inFatherContext: boolean;
    fatherTitle: string;
    fatherText?: string | null;
  };
  moderationCtx?: ModerationContext | null;
  bypassRateLimit?: boolean;
}): Promise<{ responded: boolean; responseMs: number }> {
  const startedAt = Date.now();

  if (!params.bypassRateLimit && !rateOk(params.userId)) {
    if (params.mode === "auto") return { responded: false, responseMs: Date.now() - startedAt };
    await replyMessage(
      params.chatId,
      "⏳ Bạn đã hỏi quá nhiều trong 10 phút qua. Vui lòng thử lại sau. / You've asked too many times in the last 10 minutes, please try again later.",
      params.messageId,
    );
    return { responded: false, responseMs: Date.now() - startedAt };
  }

  const extraSystem: string[] = [];
  if (params.mode === "auto" && params.isNewMember) {
    extraSystem.push(
      "Người dùng vừa tham gia nhóm và có vẻ cần được chào đón + hướng dẫn ngắn. Hãy chào thân thiện, giới thiệu FUN.RICH bằng 2-3 câu, mời họ đặt câu hỏi cụ thể, và nhắc rằng họ có thể @mention FUN Bot bất cứ lúc nào để hỏi tiếp.",
    );
  } else if (params.mode === "auto") {
    extraSystem.push(
      "Người dùng đang xin trợ giúp trong nhóm. Trả lời ngắn gọn, hỏi rõ họ cần hỗ trợ phần nào (FUN Profile, FUN Wallet, CAMLY, đăng ký, claim, v.v.) nếu chưa đủ thông tin.",
    );
  }

  const inFather = params.fatherCtx?.inFatherContext === true;
  if (inFather) {
    const fatherTitle = params.fatherCtx?.fatherTitle ?? "CAMLY COIN CHANNEL";
    const fatherText = (params.fatherCtx?.fatherText ?? "").slice(0, 500);
    extraSystem.push(
      `NGỮ CẢNH ĐẶC BIỆT — Tin nhắn gốc trong thread này đến từ kênh "${fatherTitle}", được coi là thông điệp của Cha Vũ Trụ. Nếu và chỉ nếu câu trả lời bằng TIẾNG VIỆT: FUN Bot phải tự xưng "Con", gọi người dùng là "bé", và gọi nội dung kênh là "Cha" hoặc "Cha Vũ Trụ"; giọng văn thành tâm, kính cẩn, 2-4 câu. Với mọi ngôn ngữ khác: bỏ qua quy tắc xưng hô này, giữ persona FUN Bot mặc định.${fatherText ? `\nNội dung Cha (trích): "${fatherText}"` : ""}`,
    );
  }

  if (params.moderationCtx) {
    const { rule, keyword, rawNotice } = params.moderationCtx;
    extraSystem.push(
      `NGỮ CẢNH MODERATION — Người dùng đang reply vào một tin nhắn của FUN Bot, trong đó FUN Bot thông báo đã XOÁ một tin nhắn vì vi phạm Community Guard.\n` +
      `- Tin moderation gốc (trích): "${rawNotice}"\n` +
      `- Rule trigger: ${rule}\n` +
      (keyword ? `- Keyword bị chặn: "${keyword}"\n` : "") +
      `Hãy GIẢI THÍCH ngắn gọn 3-5 câu cho người hỏi:\n` +
      `  1) Nghĩa của keyword (ngôn ngữ gốc nếu là Chinese/Japanese/Korean + bản dịch sang ngôn ngữ user).\n` +
      `  2) Vì sao bị chặn (rủi ro spam/scam/HYIP/quảng cáo kiếm tiền/khiêu dâm v.v.).\n` +
      `  3) Rule đã match và khuyến nghị ngắn (đừng dùng lại, nếu là hiểu lầm thì liên hệ admin).\n` +
      `Không phán xét người hỏi. Trả lời trung tính, hữu ích, đúng ngôn ngữ user dùng.`,
    );
  }

  try {
    const result = await callAngelCore({
      max_tokens: 400,
      messages: [
        { role: "system", content: FUN_BOT_PERSONA },
        ...extraSystem.map((c) => ({ role: "system" as const, content: c })),
        { role: "system", content: inFather ? FUN_BOT_LANGUAGE_RULE_FATHER : FUN_BOT_LANGUAGE_RULE },
        { role: "user", content: params.prompt.slice(0, 1500) },
      ],
    });
    const answer = result.text;
    if (answer) {
      await replyMessage(params.chatId, answer.slice(0, 3500), params.messageId);
      return { responded: true, responseMs: Date.now() - startedAt };
    }
    return { responded: false, responseMs: Date.now() - startedAt };
  } catch (e) {
    if (e instanceof AngelCoreError && e.status === 429) {
      if (params.mode !== "auto") {
        await replyMessage(params.chatId, "⏳ Hệ thống đang quá tải, thử lại sau nhé. / System busy, please retry later.", params.messageId);
      }
      return { responded: false, responseMs: Date.now() - startedAt };
    }
    console.warn("[telegramGroup] answerWithAI failed", e);
    return { responded: false, responseMs: Date.now() - startedAt };
  }
}

export async function logAiTrigger(
  admin: SupabaseClient,
  params: {
    groupId: number;
    userId?: number | null;
    username?: string | null;
    triggerSource: TriggerSource;
    prompt: string;
    responded: boolean;
    responseMs: number;
    extra?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    const { error } = await admin.from("telegram_ai_audit").insert({
      group_id: params.groupId,
      user_id: params.userId ?? null,
      username: params.username ?? null,
      trigger_source: params.triggerSource,
      prompt_preview: (params.prompt ?? "").slice(0, 200),
      ai_responded: params.responded,
      response_time_ms: params.responseMs,
      extra: params.extra ?? null,
    });
    if (error) console.warn("[logAiTrigger] insert failed", error);
  } catch (e) {
    console.warn("[logAiTrigger] error", e);
  }
}



// ─── Health tracking ─────────────────────────────────────────────────────────

export async function trackInbound(
  admin: SupabaseClient,
  params: {
    groupId: number;
    groupTitle?: string | null;
    text: string;
    username?: string | null;
    helpIntent?: boolean;
  },
): Promise<void> {
  try {
    const { error } = await admin.rpc("telegram_group_health_inbound", {
      p_group_id: params.groupId,
      p_group_title: params.groupTitle ?? null,
      p_text: params.text.slice(0, 280),
      p_user: params.username ?? null,
      p_help_intent: !!params.helpIntent,
    });
    if (error) console.warn("[trackInbound] rpc failed, fallback upsert", error);
  } catch (e) {
    console.warn("[trackInbound] error", e);
  }
}

export async function trackBotReply(
  admin: SupabaseClient,
  params: { groupId: number; mode: string },
): Promise<void> {
  try {
    const { error } = await admin.rpc("telegram_group_health_reply", {
      p_group_id: params.groupId,
      p_mode: params.mode,
    });
    if (error) console.warn("[trackBotReply] rpc failed", error);
  } catch (e) {
    console.warn("[trackBotReply] error", e);
  }
}

export async function sendHealthReport(
  admin: SupabaseClient,
  chatId: number,
): Promise<void> {
  const { data } = await admin
    .from("telegram_group_health")
    .select("*")
    .eq("group_id", chatId)
    .maybeSingle();

  const cfg = await getGroupConfig(admin, chatId);
  if (!data) {
    await replyMessage(
      chatId,
      `🩺 <b>FUN Bot Health</b>\n\n` +
        `Group: <code>${chatId}</code>\n` +
        `AI enabled: <b>${cfg?.ai_enabled ? "✅" : "❌"}</b>\n\n` +
        `⚠️ <b>Chưa nhận được tin nhắn thường nào</b> từ group này.\n` +
        `Lệnh (như <code>/id</code>, <code>/health</code>) thì tới được, nhưng tin nhắn thường thì không.\n\n` +
        `👉 Nguyên nhân gần như chắc chắn: <b>Privacy Mode</b> của bot đang BẬT.\n\n` +
        `<b>Cách sửa:</b>\n` +
        `1. Mở @BotFather → /mybots → chọn FUN.RICH bot\n` +
        `2. Bot Settings → Group Privacy → <b>Turn off</b>\n` +
        `3. Kick bot ra khỏi group rồi mời lại (bắt buộc để Telegram áp dụng)\n\n` +
        `Test ngay không cần tắt Privacy: gõ <code>/aitest tôi là người mới</code>`,
    );
    return;
  }

  const fmt = (iso: string | null) => {
    if (!iso) return "—";
    const d = new Date(iso);
    const mins = Math.round((Date.now() - d.getTime()) / 60000);
    return mins < 60 ? `${mins}p trước` : `${Math.round(mins / 60)}h trước`;
  };

  const report =
    `🩺 <b>FUN Bot Health</b>\n` +
    `Group: <code>${chatId}</code>\n` +
    `AI enabled: <b>${cfg?.ai_enabled ? "✅" : "❌"}</b>\n` +
    `Moderation: <b>${cfg?.moderation_level ?? "?"}</b>\n\n` +
    `📥 Last inbound: <b>${fmt(data.last_inbound_at)}</b>\n` +
    `   ↳ @${data.last_inbound_user ?? "?"}: ${escapeHtml((data.last_inbound_text ?? "").slice(0, 80))}\n\n` +
    `🤖 Last bot reply: <b>${fmt(data.last_bot_reply_at)}</b> (${data.last_bot_reply_mode ?? "—"})\n\n` +
    `📊 Totals\n` +
    `   Inbound: <b>${data.inbound_count_total}</b>\n` +
    `   Bot reply: <b>${data.bot_reply_count_total}</b>\n` +
    `   Help-intent detected: <b>${data.help_intent_count_total}</b>`;

  await replyMessage(chatId, report);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function getUserAvatarUrl(userId: number): Promise<string | null> {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!token) return null;
  const photos = await tgApiJson<{ total_count: number; photos: Array<Array<{ file_id: string; file_size?: number; width?: number }>> }>(
    "getUserProfilePhotos",
    { user_id: userId, limit: 1 },
  );
  if (!photos || (photos.total_count ?? 0) === 0) {
    console.log(`[telegramGroup] getUserAvatarUrl: no photos for user ${userId} (privacy or none set)`);
    return null;
  }
  const sizes = photos?.photos?.[0];
  if (!sizes?.length) return null;
  const pick = sizes.find((s) => (s.width ?? 0) >= 160 && (s.width ?? 0) <= 640) ?? sizes[sizes.length - 1];
  return resolveTelegramFileUrl(pick.file_id);
}

export async function sendWelcome(params: {
  cfg: GroupConfig;
  chatId: number;
  newMembers: Array<{ id: number; first_name?: string; last_name?: string; username?: string; is_bot?: boolean }>;
}): Promise<void> {
  for (const m of params.newMembers) {
    if (m.is_bot) continue;
    const fullName = [m.first_name, m.last_name].filter(Boolean).join(" ").trim();
    const displayBase = fullName || (m.username ? `@${m.username}` : "bạn");
    const profileUrl = m.username ? `https://t.me/${m.username}` : `tg://user?id=${m.id}`;
    const nameHtml = `<a href="${profileUrl}">${escapeHtml(displayBase)}</a>${m.username ? ` (@${escapeHtml(m.username)})` : ""}`;

    const msg = params.cfg.welcome_message.replace(/\{name\}/g, nameHtml);

    const replyMarkup = {
      inline_keyboard: [[
        { text: "👤 Mở hồ sơ Telegram", url: profileUrl },
      ]],
    };

    const avatarUrl = await getUserAvatarUrl(m.id).catch(() => null);
    if (avatarUrl) {
      const ok = await tgApi("sendPhoto", {
        chat_id: params.chatId,
        photo: avatarUrl,
        caption: msg,
        parse_mode: "HTML",
        reply_markup: replyMarkup,
      });
      if (ok) continue;
    }
    await tgApi("sendMessage", {
      chat_id: params.chatId,
      text: msg,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: replyMarkup,
    });
  }
}

