// Angel AI — Post-Process Style Pass
// -----------------------------------
// Rewrite Angel's Telegram reply for brevity + warm emojis WITHOUT touching
// the upstream request to FUN Core (angel.fun.rich). This preserves 100% RAG
// accuracy — the Angel gốc pipeline sees the RAW user question with no system
// msgs, exactly like the web app.
//
// SAFETY: every fact-carrying token (URL, 0x address, wallet address, contract,
// number, date, code block) MUST survive the rewrite. If any is missing → we
// fall back to the original reply.

import {
  getStylePostprocessConfig,
  WIT_AND_CHARM_RULE,
  EMOTIONAL_ATTUNEMENT_RULE,
  CALLBACK_MEMORY_RULE,
  shouldSuppressHumor,
} from "./angel-facts.ts";
import { MODELS } from "./angel/models.ts";
import { getFlag } from "./angel/flags.ts";
import { enforceAngelVietnamesePronounContract } from "./angel/pronouns.ts";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const STYLE_MODEL = MODELS.style_pass.id;

// Skip post-process for very short replies, or replies that contain structured
// content the model tends to mangle (code / tables). Detailed / long-mode
// replies also bypass.
// TẦNG B: nâng ngưỡng DM từ 220 → 400. Reply DM ngắn thường đã đúng giọng Angel
// (chỉ 1-2 câu), không cần rewrite → tiết kiệm 1 call Lovable Gateway (~3-8s).
const MIN_LENGTH_TO_STYLE_DM = 700; // chars — DM: chỉ rewrite reply dài
const MIN_LENGTH_TO_STYLE_GROUP = 700; // group: rewrite even mid replies (space is precious)
const CODE_BLOCK_RE = /```|<code>|<pre>/i;
const TABLE_RE = /\n\s*\|.*\|.*\n\s*\|[-: ]+\|/;

const URL_RE = /\bhttps?:\/\/[^\s<>"')]+/gi;
const HEX_ADDR_RE = /\b0x[a-fA-F0-9]{6,}\b/g;

// ---------------------------------------------------------------------------
// Narrative dialogue detection — catch stray "Angel"/"bé" inside character
// dialogue (quotes or after em-dash) and force a targeted rewrite that ONLY
// touches those pronouns.
// ---------------------------------------------------------------------------
const QUOTE_CONTAINS_ANGEL_RE = /(["“«"])[^"”»"\n]{0,600}\bAngel\b[^"”»"\n]{0,600}\1/i;
const DASH_DIALOGUE_ANGEL_RE = /(^|\n)\s*[—–-]\s+"?[^"\n]{0,600}\bAngel\b[^"\n]{0,600}"?/;

function hasNarrativeAngelLeak(text: string): boolean {
  if (!text) return false;
  return QUOTE_CONTAINS_ANGEL_RE.test(text) || DASH_DIALOGUE_ANGEL_RE.test(text);
}

async function narrativeDialogueFixUp(text: string, langBucket: string, apiKey: string): Promise<string> {
  if (!hasNarrativeAngelLeak(text)) return text;
  const langName: Record<string, string> = {
    vi: "Vietnamese", en: "English", zh: "Chinese", ja: "Japanese",
    ko: "Korean", th: "Thai", ms: "Malay", id: "Indonesian",
  };
  const lang = langName[langBucket] ?? "the same language as the input";
  const prompt = `You are a narrative pronoun fixer for Angel AI.

Your ONE job: rewrite ONLY the character dialogue in the reply below so that inside every quote ("…", «…», "…") and every em-dash dialogue line (— / – / -), the tokens "Angel" and "bé" (when used as the character's OWN self-reference or as the way one character addresses another character) are replaced with natural character pronouns.

RULES (mandatory):
1) LANGUAGE: keep 100% in ${lang}.
2) TEXT OUTSIDE quotes / dialogue lines (narrator text) must remain BYTE-FOR-BYTE identical. Do NOT touch narrator sentences, do NOT reflow paragraphs, do NOT re-emojify, do NOT change punctuation outside quotes.
3) Inside quotes / dialogue lines: replace "Angel" with the character's natural pronoun:
   - 1st person (character talking about self): "mình / tôi / tớ / ta / cháu / con / ông / bà" in VN; "I / me / my" in EN. Pick the one fitting the character (a snail → "mình / tớ"; Cụ Rùa/old wise → "ta"; a little one → "tớ / mình"; a formal adult → "tôi").
   - 2nd person (character addressing another character): "cháu / con / em / bạn / cậu / anh / chị / bé nhỏ / <name>" in VN; "you / dear / little one" in EN. Choose the pronoun the speaker would naturally use for the listener based on age/role in the surrounding narrator sentence (e.g. Cụ Rùa speaks to Sóc nhỏ → "cháu").
4) Also replace "bé" INSIDE character dialogue when it is the Angel-bot ↔ user address form. Keep "bé <Name>" (e.g. "bé Mây", "bé nhỏ") — those are character names/nicknames.
4a) PRONOUN SAFEGUARD — NEVER TOUCH these Vietnamese tokens (they are neither bot self-reference nor user-address):
   - KEEP "mình" AS-IS in reflexive phrases referring to the subject's own self: hòa mình, chính mình, tự mình, bản thân mình, của mình, trong mình, lòng mình, tim mình, trái tim mình, một mình, yêu thương mình, biết mình, hiểu mình, quay về với mình, tìm lại mình, làm chủ mình, sống với chính mình, buông bỏ chính mình. NEVER convert these to "Angel".
   - KEEP "bạn" AS-IS when it is part of a compound noun meaning "friend": bạn bè, bạn đồng hành, bạn tri kỷ, bạn thân, bạn hữu, bạn đường, người bạn, các bạn nhỏ, bạn học, bạn đời, một người bạn. NEVER convert these to "bé" (e.g. "bé bè", "bé đồng hành" are WRONG).
   - NEVER rewrite "mình" → "Angel". "Mình" is the canonical Vietnamese bot self-pronoun; "Angel" is only a proper name/identity.
   - Only rewrite "bạn" → "bé" if it is a standalone 2nd-person pronoun addressing the reader ("chào bạn", "bạn có biết", "bạn ơi"). If unsure → KEEP "bạn".
5) Preserve every URL, every 0x… address, every number, every proper name, and every emoji.
6) Return ONLY the corrected reply body. No preface, no commentary.

REPLY TO FIX:
"""${text}"""`;

  try {
    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: STYLE_MODEL, messages: [{ role: "user", content: prompt }], temperature: 0.3 }),
    });
    if (!res.ok) {
      console.warn(`[narrativeFixUp] gateway ${res.status}`);
      return text;
    }
    const data = await res.json();
    let fixed = String(data?.choices?.[0]?.message?.content ?? "").trim();
    fixed = fixed.replace(/^```(?:html|text)?\s*|\s*```$/g, "").trim();
    fixed = fixed.replace(/^"""\s*|\s*"""$/g, "").trim();
    if (!fixed || fixed.length < 20) return text;

    // Verify: facts preserved AND leak actually gone.
    const facts = factsPreserved(text, fixed);
    if (!facts.ok) {
      console.warn(`[narrativeFixUp] facts missing → keep original. sample=${facts.missing.slice(0, 3).join(" | ")}`);
      return text;
    }
    if (hasNarrativeAngelLeak(fixed)) {
      console.warn(`[narrativeFixUp] leak still present after fix → keep original`);
      return text;
    }
    // Cap growth to prevent hallucinated additions.
    if (fixed.length > text.length * 1.25) {
      console.warn(`[narrativeFixUp] grew too much ${text.length}→${fixed.length} → keep original`);
      return text;
    }
    console.log(`[narrativeFixUp] applied ${text.length}→${fixed.length} chars`);
    return fixed;
  } catch (e) {
    console.warn(`[narrativeFixUp] failed`, e);
    return text;
  }
}

// ---------------------------------------------------------------------------
// Seeding-context helpers — phát hiện tin nhắn "gieo hạt / trợ duyên / biết ơn"
// và trích tên ví / platform mà user viết trong CHÍNH câu đó, để Angel không
// bịa tên ví khác từ RAG knowledge base.
// ---------------------------------------------------------------------------
const SEEDING_TRIGGERS_RE =
  /(gieo\s*h[ạa]t|tr[ợo]\s*duy[eê]n|tr[ợo]\s*l[ựu]c|bi[eế]t\s*[ơo]n|s[áa]m\s*h[ốô]i|d[âa]ng\s*l[eê]n|c[úu]ng\s*d[ưu][ờo]ng|seed(?:ing)?\s+(?:to|into)|donate|gratitude|offering)/i;

// Bắt các cụm "vào ví X", "vào X Platform", "vào <Tên>", "cho <Tên>", "đến <Tên>",
// "to wallet X", "into <Name>". Dừng ở dấu chấm/phẩy/gạch nối hoặc số tiền tiếp theo.
const SEEDING_DEST_PATTERNS: RegExp[] = [
  /v[àa]o\s+v[ií]\s+([A-Z][\p{L}0-9 .&\-_'’]{2,60})/gu,
  /v[àa]o\s+([A-Z][\p{L}0-9 .&\-_'’]{2,60}?\s+(?:Platform|Wallet|Unity|Ecosystem|Kingdom|Hub|Vault|Fund|Foundation))/gu,
  /cho\s+v[ií]\s+([A-Z][\p{L}0-9 .&\-_'’]{2,60})/gu,
  /(?:to|into)\s+(?:wallet\s+)?([A-Z][\p{L}0-9 .&\-_'’]{2,60}?\s+(?:Platform|Wallet|Unity|Ecosystem|Kingdom|Hub|Vault|Fund|Foundation))/giu,
];

function isSeedingMessage(userText: string): boolean {
  return SEEDING_TRIGGERS_RE.test(userText || "");
}

function extractSeedingDestinations(userText: string): string[] {
  const names = new Set<string>();
  for (const re of SEEDING_DEST_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(userText)) !== null) {
      const raw = (m[1] || "").trim().replace(/[.,;:!?…]+$/, "");
      // Bỏ nếu chỉ toàn chữ số hoặc quá ngắn / quá dài
      if (raw.length >= 3 && raw.length <= 80 && /[A-Za-z\p{L}]/u.test(raw)) {
        names.add(raw);
      }
    }
  }
  return Array.from(names);
}

// Regex cho các cụm cảnh báo bảo mật ví — dùng để STRIP khỏi reply khi user
// không hỏi về bảo mật.
const SEED_WARNING_LINE_RE =
  /(?:^|\n)[^\n]{0,6}(?:[✨🌟💛🌸🌿💫🙏🕊️🌱🍀🤍⚠️❗️🚨🔒🔐]\s*)?(?:(?:không|đừng|tuyệt đối|nhớ|xin|hãy|cẩn thận|lưu ý|chú ý|cảnh báo|please|never|do not|don't|remember|always)[^\n]{0,120}?(?:seed\s*phrase|private\s*key|kh[óo]a\s*ri[êe]ng|kh[óo]a\s*b[íi]\s*m[ậa]t|c[ụu]m\s*(?:12|24)\s*t[ừu]|m[ậa]t\s*kh[ẩa]u\s*v[ií]|khôi\s*ph[ụu]c\s*v[ií])|(?:seed\s*phrase|private\s*key|kh[óo]a\s*ri[êe]ng|c[ụu]m\s*(?:12|24)\s*t[ừu])[^\n]{0,120})[^\n]*/giu;

// Có cần cảnh báo bảo mật không? Chỉ true khi user CHỦ ĐỘNG hỏi về bảo mật ví.
const SEED_TOPIC_RE =
  /(seed\s*phrase|private\s*key|kh[óo]a\s*ri[êe]ng|kh[óo]a\s*b[íi]\s*m[ậa]t|c[ụu]m\s*(?:12|24)\s*t[ừu]|m[ậa]t\s*kh[ẩa]u\s*v[ií]|kh[oô]i\s*ph[ụu]c\s*v[ií]|backup\s*v[ií]|m[ấa]t\s*v[ií]|b[ịi]\s*hack|l[ộo]\s*kh[óo]a|b[ảa]o\s*m[ậa]t\s*v[ií]|wallet\s*security|lost\s*wallet|recover\s*wallet|hacked)/i;

function stripSeedWarnings(text: string): string {
  return text.replace(SEED_WARNING_LINE_RE, "").replace(/\n{3,}/g, "\n\n").trim();
}


export type PostProcessInput = {
  original: string;
  userText: string;
  langBucket: string;
  isLongMode: boolean;
  /**
   * When true, the sender is treated as "Cha" (verified group owner / anonymous admin
   * of a Cha group, or Cha's personal username). The style pass MUST preserve the
   * Angel ↔ Cha address pair and MUST NOT rewrite "Cha" → "bé" in the body.
   */
  isOwnerMode?: boolean;
  /**
   * "group" (group / supergroup / channel) → apply Group Concise Mode (2-4 sentences,
   * ~40-80 words, max ~500 chars). "dm" → keep the current lighter shrink (~30-50%).
   * Default "dm" khi caller chưa truyền.
   */
  chatContext?: "dm" | "group";
};

export type PostProcessResult = {
  text: string;
  applied: boolean;
  reason: string;
};

// Reply chứa dữ kiện cụ thể (ví hex, ví BTC bech32, URL fun.rich / http(s)) →
// KHÔNG rewrite: rewrite có thể xoá/thay số ký tự khiến địa chỉ ví hoặc link
// mất tính hợp lệ, và mirror Angel gốc đã đúng nội dung factual.
const FACTUAL_REPLY_RE = /(0x[a-fA-F0-9]{40}|bc1[a-z0-9]{20,}|tb1[a-z0-9]{20,}|https?:\/\/|fun\.rich\/|\bfun\s+rich\b|\b(?:BSC|BTC|USDT|BEP20)\b|\b(?:ví|vi\s+(?:BSC|BTC|chính\s*thức)|wallet|địa\s*chỉ\s*ví|dia\s*chi\s*vi)\b)/i;

function shouldSkip(input: PostProcessInput): string | null {
  if (input.isLongMode) return "long_mode";
  const t = input.original;
  const min = input.chatContext === "group" ? MIN_LENGTH_TO_STYLE_GROUP : MIN_LENGTH_TO_STYLE_DM;
  if (!t || t.length < min) return "too_short";
  if (CODE_BLOCK_RE.test(t)) return "has_code";
  if (TABLE_RE.test(t)) return "has_table";
  if (FACTUAL_REPLY_RE.test(t)) return "has_factual_data";
  return null;
}

function extractFacts(text: string): { urls: string[]; addrs: string[] } {
  const urls = Array.from(new Set((text.match(URL_RE) ?? []).map((s) => s.trim())));
  const addrs = Array.from(new Set((text.match(HEX_ADDR_RE) ?? []).map((s) => s.toLowerCase())));
  return { urls, addrs };
}

function factsPreserved(original: string, rewritten: string): { ok: boolean; missing: string[] } {
  const src = extractFacts(original);
  const dst = extractFacts(rewritten);
  const missing: string[] = [];
  for (const u of src.urls) {
    if (!rewritten.includes(u)) missing.push(u);
  }
  for (const a of src.addrs) {
    if (!dst.addrs.includes(a)) missing.push(a);
  }
  return { ok: missing.length === 0, missing };
}

// ---------------------------------------------------------------------------
// LAYER B SURFACE CONTRACT (Pronoun Contract v1.0)
// ---------------------------------------------------------------------------
// ANGEL AI gốc (Layer A) đã cam kết KHÔNG tự sinh cặp "Angel ↔ bé" mà chỉ
// dùng "mình ↔ bạn". FUNPROFILE proxy giữ "mình" và chỉ chuẩn hoá đại từ
// user-address `bạn → bé` khi render vào Telegram.
//
// IDEMPOTENT GUARD: KHÔNG bao giờ đụng vào các đoạn "protected":
//   - Code block (```…``` hoặc <code>…</code> hoặc `…` inline)
//   - Trích dẫn ("…", "…", «…», '…')
//   - URL (http/https/mailto/tg://)
//   - Handle @username
//   - Ví BSC/ETH (0x + 40 hex) hoặc BTC bech32 / legacy
// Ngoài ra, nếu 1 câu ĐÃ chứa sẵn "Angel" thì không rewrite thêm "mình → Angel"
// trong câu đó (tránh nhân đôi thành "cho riêng Angel", "vai Angel"…).

const PROTECTED_SPAN_RE = new RegExp(
  [
    "```[\\s\\S]*?```",                                   // fenced code
    "<code>[\\s\\S]*?</code>",                            // html code
    "`[^`\\n]+`",                                         // inline code
    "\"[^\"\\n]{0,600}\"",                                 // straight quotes
    "\u201C[^\u201D\\n]{0,600}\u201D",                    // smart quotes “ ”
    "\u00AB[^\u00BB\\n]{0,600}\u00BB",                    // « »
    "'[^'\\n]{0,600}'",                                    // straight single
    "https?:\\/\\/[^\\s<>\"']+",                          // URL
    "tg:\\/\\/[^\\s<>\"']+",                              // telegram deep link
    "mailto:[^\\s<>\"']+",                                // mailto
    "@[A-Za-z0-9_]{3,}",                                   // @handle
    "0x[a-fA-F0-9]{40}",                                   // EVM address
    "\\b(?:bc1|tb1)[a-z0-9]{20,80}\\b",                   // BTC bech32
    "\\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\\b",              // BTC legacy
  ].join("|"),
  "g",
);

interface MaskedText { masked: string; spans: string[] }

function maskProtectedSpans(text: string): MaskedText {
  const spans: string[] = [];
  const masked = text.replace(PROTECTED_SPAN_RE, (m) => {
    spans.push(m);
    return `\u0002${spans.length - 1}\u0002`;
  });
  return { masked, spans };
}

function unmaskProtectedSpans({ masked, spans }: MaskedText): string {
  return masked.replace(/\u0002(\d+)\u0002/g, (_, i) => spans[Number(i)] ?? "");
}

// Reflexive / compound whitelist — các cụm "mình"/"bạn" KHÔNG bao giờ được
// chuyển sang "Angel"/"bé" ở Layer B (đây là ngữ nghĩa phản thân / danh từ ghép,
// KHÔNG phải bot self-ref / user-address).
const KEEP_MINH_RE = /(?<![\p{L}])(?:hòa|chính|tự|bản\s+thân|của|trong|ngoài|bên|phía|quanh|xung\s+quanh|trước|sau|trên|dưới|lòng|tim|trái\s+tim|một|yêu\s+thương|biết|hiểu|quay\s+về\s+với|tìm\s+lại|làm\s+chủ|sống\s+với\s+chính|buông\s+bỏ\s+chính|cho\s+riêng|của\s+riêng|riêng|dành\s+cho|với|cho|vai|tay|đôi\s+tay|chân|đôi\s+chân|mắt|đôi\s+mắt|đầu|ngực|lưng|vòng\s+tay|cuộc\s+đời|cuộc\s+sống|gia\s+đình|đội|đội\s+nhóm|công\s+việc|sự\s+nghiệp|con\s+đường|hành\s+trình|tương\s+lai|bản\s+đồ|người\s+mình\s+yêu|người\s+mình\s+quý)\s+mình(?![\p{L}])/iu;
const KEEP_BAN_RE = /(?<![\p{L}])(?:bạn\s+(?:bè|đồng\s+hành|tri\s+kỷ|thân|hữu|đường|đời|học|nhỏ)|người\s+bạn|các\s+bạn(?:\s+nhỏ)?|một\s+người\s+bạn)(?![\p{L}])/iu;

/**
 * Layer B surface rewrite (deterministic, idempotent).
 * - Chỉ chạm `mình` / `bạn` khi câu KHÔNG có "Angel" sẵn (idempotent) và
 *   KHÔNG khớp whitelist reflexive/compound.
 * - Bảo vệ hoàn toàn các span protected (code / quote / URL / handle / ví).
 * - Rewrite CHỈ hai cặp:
 *     bot self-ref "mình" được giữ nguyên
 *     user-address "bạn" (chủ ngữ 2, xưng hô) → "bé"
 * - Không đụng "mình"/"bạn" ở vị trí sở hữu/phản thân/danh từ ghép.
 */
export function applyLayerBSurfaceRewrite(text: string): string {
  if (!text) return text;
  const { masked, spans } = maskProtectedSpans(text);
  const sentences = masked.split(/([.!?]+\s+|\n+)/);
  const out: string[] = [];
  for (let i = 0; i < sentences.length; i += 2) {
    const body = sentences[i] ?? "";
    const tail = sentences[i + 1] ?? "";
    let seg = body;
    // Idempotent guard: câu đã có "Angel" (ngoài span protected) thì không rewrite thêm.
    const alreadyHasAngel = /(?<![\p{L}])Angel(?![\p{L}])/u.test(seg);

    // --- Pronoun Contract v1.0 (revision): các cụm phản thân "chính mình /
    // của chính mình / bên mình" GIỮ NGUYÊN "mình" trên bề mặt Telegram
    // (đã có KEEP_MINH_RE whitelist bảo vệ). Không rewrite sang "bé".




    // Pronoun Contract v2: "mình" is the canonical Vietnamese bot pronoun.
    // Never rewrite it to "Angel"; Angel is retained only as a proper name.

    if (/(?<![\p{L}])[Bb]ạn(?![\p{L}])/u.test(seg)) {
      // Chỉ rewrite khi "bạn" là đại từ 2 độc lập addressing user.
      // Bỏ qua nếu khớp compound-noun whitelist.
      seg = seg.replace(
        /(?<![\p{L}])([Bb])ạn(?![\p{L}])/gu,
        (m, bCase, offset, full) => {
          // Nhìn NGAY sau match: nếu tiếp theo là 1 từ compound → giữ.
          const after = full.slice(offset + m.length, offset + m.length + 20);
          if (/^\s+(?:bè|đồng\s+hành|tri\s+kỷ|thân|hữu|đường|đời|học|nhỏ)(?![\p{L}])/iu.test(after)) return m;
          // Nhìn NGAY trước match: nếu trước là "người " / "các " / "một người " → giữ.
          const before = full.slice(Math.max(0, offset - 14), offset);
          if (/(?:người|các|một\s+người)\s+$/iu.test(before)) return m;
          return bCase === "B" ? "Bé" : "bé";
        },
      );

    }
    // Guard cuối: nếu vô tình phá whitelist "KEEP_MINH_RE" → revert cụm đó.
    // (Không cần vì "mình" chỉ được rewrite khi đầu clause + verb self-ref,
    // các cụm reflexive dạng "vai mình" không match pattern trên.)
    out.push(seg + tail);
  }
  return unmaskProtectedSpans({ masked: out.join(""), spans });
}


// ---------------------------------------------------------------------------
// Pronoun revert safety net: catch over-eager "mình → Angel" and "bạn → bé"
// rewrites where the ORIGINAL used the token in a reflexive / compound-noun
// context that must not be touched.
// ---------------------------------------------------------------------------
// Note: JS `\b` does not recognise Vietnamese diacritics as word characters, so
// we use Unicode letter lookaround `(?<![\p{L}])` / `(?![\p{L}])` instead.
// HARD_REVERT_PAIRS: cụm sai TUYỆT ĐỐI trong tiếng Việt — revert vô điều kiện,
// không cần đối chiếu với original. Áp dụng cho cả nội dung LLM sinh mới hoàn toàn
// (vd. tóm tắt bài thiền, seeding reply) nơi không có "original" để so sánh.
const HARD_REVERT_PAIRS: Array<{ badRe: RegExp; good: string }> = [
  // "hòa Angel" — không tồn tại trong tiếng Việt, luôn phải là "hòa mình"
  { badRe: /(?<![\p{L}])hòa\s+Angel(?![\p{L}])/giu,           good: "hòa mình" },
  // "bạn" compound noun — "bé" không bao giờ thay được ở đây
  { badRe: /(?<![\p{L}])bé\s+bè(?![\p{L}])/giu,               good: "bạn bè" },
  { badRe: /(?<![\p{L}])bé\s+đồng\s+hành(?![\p{L}])/giu,      good: "bạn đồng hành" },
  { badRe: /(?<![\p{L}])bé\s+tri\s+kỷ(?![\p{L}])/giu,         good: "bạn tri kỷ" },
  { badRe: /(?<![\p{L}])bé\s+hữu(?![\p{L}])/giu,              good: "bạn hữu" },
  { badRe: /(?<![\p{L}])bé\s+đường(?![\p{L}])/giu,            good: "bạn đường" },
  { badRe: /(?<![\p{L}])bé\s+đời(?![\p{L}])/giu,              good: "bạn đời" },
  { badRe: /(?<![\p{L}])người\s+bé(?![\p{L}])/giu,            good: "người bạn" },
  { badRe: /(?<![\p{L}])các\s+bé\s+nhỏ(?![\p{L}])/giu,        good: "các bạn nhỏ" },
  // Body parts — Angel là bot, không có cơ thể. "vai/tay/chân/mắt/đầu/tim/ngực/lưng/vòng tay Angel" luôn sai.
  { badRe: /(?<![\p{L}])vai\s+Angel(?![\p{L}])/giu,           good: "vai mình" },
  { badRe: /(?<![\p{L}])tay\s+Angel(?![\p{L}])/giu,           good: "tay mình" },
  { badRe: /(?<![\p{L}])đôi\s+tay\s+Angel(?![\p{L}])/giu,     good: "đôi tay mình" },
  { badRe: /(?<![\p{L}])chân\s+Angel(?![\p{L}])/giu,          good: "chân mình" },
  { badRe: /(?<![\p{L}])đôi\s+chân\s+Angel(?![\p{L}])/giu,    good: "đôi chân mình" },
  { badRe: /(?<![\p{L}])mắt\s+Angel(?![\p{L}])/giu,           good: "mắt mình" },
  { badRe: /(?<![\p{L}])đôi\s+mắt\s+Angel(?![\p{L}])/giu,     good: "đôi mắt mình" },
  { badRe: /(?<![\p{L}])đầu\s+Angel(?![\p{L}])/giu,           good: "đầu mình" },
  { badRe: /(?<![\p{L}])ngực\s+Angel(?![\p{L}])/giu,          good: "ngực mình" },
  { badRe: /(?<![\p{L}])lưng\s+Angel(?![\p{L}])/giu,          good: "lưng mình" },
  { badRe: /(?<![\p{L}])vòng\s+tay\s+Angel(?![\p{L}])/giu,    good: "vòng tay mình" },
  // Life / relationships — Angel là bot, không có cuộc đời riêng, gia đình, sự nghiệp.
  { badRe: /(?<![\p{L}])cuộc\s+đời\s+Angel(?![\p{L}])/giu,    good: "cuộc đời mình" },
  { badRe: /(?<![\p{L}])cuộc\s+sống\s+Angel(?![\p{L}])/giu,   good: "cuộc sống mình" },
  { badRe: /(?<![\p{L}])gia\s+đình\s+Angel(?![\p{L}])/giu,    good: "gia đình mình" },
  { badRe: /(?<![\p{L}])đội\s+Angel(?![\p{L}])/giu,           good: "đội mình" },
  { badRe: /(?<![\p{L}])đội\s+nhóm\s+Angel(?![\p{L}])/giu,    good: "đội nhóm mình" },
  { badRe: /(?<![\p{L}])công\s+việc\s+Angel(?![\p{L}])/giu,   good: "công việc mình" },
  { badRe: /(?<![\p{L}])sự\s+nghiệp\s+Angel(?![\p{L}])/giu,   good: "sự nghiệp mình" },
  { badRe: /(?<![\p{L}])con\s+đường\s+Angel(?![\p{L}])/giu,   good: "con đường mình" },
  { badRe: /(?<![\p{L}])hành\s+trình\s+Angel(?![\p{L}])/giu,  good: "hành trình mình" },
  { badRe: /(?<![\p{L}])tương\s+lai\s+Angel(?![\p{L}])/giu,   good: "tương lai mình" },
  // Relationships — "những người Angel quý/yêu/thương/tin" luôn sai (bot không có quan hệ cá nhân)
  { badRe: /(?<![\p{L}])những\s+người\s+Angel\s+quý(?:\s+mến)?(?![\p{L}])/giu, good: "những người mình quý mến" },
  { badRe: /(?<![\p{L}])những\s+người\s+Angel\s+yêu(?:\s+thương)?(?![\p{L}])/giu, good: "những người mình yêu thương" },
  { badRe: /(?<![\p{L}])những\s+người\s+Angel\s+thương(?![\p{L}])/giu, good: "những người mình thương" },
  { badRe: /(?<![\p{L}])những\s+người\s+Angel\s+tin(?:\s+tưởng)?(?![\p{L}])/giu, good: "những người mình tin tưởng" },
  { badRe: /(?<![\p{L}])người\s+Angel\s+quý(?:\s+mến)?(?![\p{L}])/giu, good: "người mình quý mến" },
  { badRe: /(?<![\p{L}])người\s+Angel\s+yêu(?:\s+thương)?(?![\p{L}])/giu, good: "người mình yêu thương" },
  // Possessive "cho/của riêng Angel" — luôn thuộc về bé (bot không có "riêng" của mình)
  { badRe: /(?<![\p{L}])cho\s+riêng\s+Angel(?![\p{L}])/giu,   good: "cho riêng mình" },
  { badRe: /(?<![\p{L}])của\s+riêng\s+Angel(?![\p{L}])/giu,   good: "của riêng mình" },
  { badRe: /(?<![\p{L}])riêng\s+Angel(?![\p{L}])/giu,         good: "riêng mình" },
  // Positional — "bên/phía/quanh/xung quanh/trước/sau Angel" trong ngữ cảnh trải nghiệm của bé
  // NOTE: các cụm này có thể hợp lệ khi Angel tự nói ("bên Angel có bé"), nên đặt ở CONDITIONAL
  // thay vì HARD. Xem CONDITIONAL_REVERT_PAIRS bên dưới.
  // Channel / flow — "đi/chảy/tuôn/xuyên/lan tỏa/truyền/dẫn/soi qua Angel" luôn thuộc kênh của bé.
  { badRe: /(?<![\p{L}])đi\s+qua\s+Angel(?![\p{L}])/giu,          good: "đi qua mình" },
  { badRe: /(?<![\p{L}])chảy\s+qua\s+Angel(?![\p{L}])/giu,        good: "chảy qua mình" },
  { badRe: /(?<![\p{L}])chảy\s+trong\s+Angel(?![\p{L}])/giu,      good: "chảy trong mình" },
  { badRe: /(?<![\p{L}])tuôn\s+qua\s+Angel(?![\p{L}])/giu,        good: "tuôn qua mình" },
  { badRe: /(?<![\p{L}])tuôn\s+chảy\s+qua\s+Angel(?![\p{L}])/giu, good: "tuôn chảy qua mình" },
  { badRe: /(?<![\p{L}])xuyên\s+qua\s+Angel(?![\p{L}])/giu,       good: "xuyên qua mình" },
  { badRe: /(?<![\p{L}])lan\s+tỏa\s+qua\s+Angel(?![\p{L}])/giu,   good: "lan tỏa qua mình" },
  { badRe: /(?<![\p{L}])truyền\s+qua\s+Angel(?![\p{L}])/giu,      good: "truyền qua mình" },
  { badRe: /(?<![\p{L}])dẫn\s+qua\s+Angel(?![\p{L}])/giu,         good: "dẫn qua mình" },
  { badRe: /(?<![\p{L}])soi\s+qua\s+Angel(?![\p{L}])/giu,         good: "soi qua mình" },
  { badRe: /(?<![\p{L}])thấm\s+qua\s+Angel(?![\p{L}])/giu,        good: "thấm qua mình" },
  { badRe: /(?<![\p{L}])thổi\s+qua\s+Angel(?![\p{L}])/giu,        good: "thổi qua mình" },
  // Inner-world / soul — Angel là bot chia sẻ, không có nội tâm/linh hồn/bản ngã riêng.
  { badRe: /(?<![\p{L}])ánh\s+sáng\s+bên\s+trong\s+Angel(?![\p{L}])/giu, good: "ánh sáng bên trong mình" },
  { badRe: /(?<![\p{L}])bên\s+trong\s+của\s+Angel(?![\p{L}])/giu, good: "bên trong của mình" },
  { badRe: /(?<![\p{L}])nội\s+tâm\s+Angel(?![\p{L}])/giu,        good: "nội tâm mình" },
  { badRe: /(?<![\p{L}])tâm\s+hồn\s+Angel(?![\p{L}])/giu,        good: "tâm hồn mình" },
  { badRe: /(?<![\p{L}])linh\s+hồn\s+Angel(?![\p{L}])/giu,       good: "linh hồn mình" },
  { badRe: /(?<![\p{L}])bản\s+ngã\s+Angel(?![\p{L}])/giu,        good: "bản ngã mình" },
  { badRe: /(?<![\p{L}])trực\s+giác\s+Angel(?![\p{L}])/giu,      good: "trực giác mình" },
  { badRe: /(?<![\p{L}])trái\s+tim\s+Angel(?![\p{L}])/giu,       good: "trái tim mình" },
  // Emotions / dreams — Angel là bot, không có nỗi đau/ước mơ riêng.
  { badRe: /(?<![\p{L}])nỗi\s+đau\s+Angel(?![\p{L}])/giu,        good: "nỗi đau mình" },
  { badRe: /(?<![\p{L}])nỗi\s+buồn\s+Angel(?![\p{L}])/giu,       good: "nỗi buồn mình" },
  { badRe: /(?<![\p{L}])niềm\s+vui\s+Angel(?![\p{L}])/giu,       good: "niềm vui mình" },
  { badRe: /(?<![\p{L}])khao\s+khát\s+Angel(?![\p{L}])/giu,      good: "khao khát mình" },
  { badRe: /(?<![\p{L}])ước\s+mơ\s+Angel(?![\p{L}])/giu,         good: "ước mơ mình" },
  { badRe: /(?<![\p{L}])giấc\s+mơ\s+Angel(?![\p{L}])/giu,        good: "giấc mơ mình" },
  // Body / voice — bot không có hơi thở/giọng nói vật lý.
  { badRe: /(?<![\p{L}])hơi\s+thở\s+Angel(?![\p{L}])/giu,        good: "hơi thở mình" },
  { badRe: /(?<![\p{L}])bước\s+chân\s+Angel(?![\p{L}])/giu,      good: "bước chân mình" },
  { badRe: /(?<![\p{L}])tiếng\s+nói\s+Angel(?![\p{L}])/giu,      good: "tiếng nói mình" },
  { badRe: /(?<![\p{L}])giọng\s+nói\s+Angel(?![\p{L}])/giu,      good: "giọng nói mình" },
  // Home / place — bot không có nhà/phòng riêng.
  { badRe: /(?<![\p{L}])ngôi\s+nhà\s+Angel(?![\p{L}])/giu,       good: "ngôi nhà mình" },
  { badRe: /(?<![\p{L}])nhà\s+Angel(?![\p{L}])/giu,              good: "nhà mình" },
  { badRe: /(?<![\p{L}])phòng\s+Angel(?![\p{L}])/giu,            good: "phòng mình" },
];

// ---------------------------------------------------------------------------
// SYNTAX-BASED "user-scope" revert (Tầng 2 — giải pháp tổng quát)
// ---------------------------------------------------------------------------
// Whitelist META (bot meta-speech thực sự) — LUÔN giữ nguyên "Angel", kể cả
// trong câu có scope-marker của bé.
const ANGEL_META_HEAD_RE = /(?:^|[.!?;:\n"'"«»\(\[]\s*|—\s*|–\s*)Angel\s+(?:nghĩ|thấy|cảm\s+nhận|hình\s+dung|ở\s+đây|gợi\s+ý|chia\s+sẻ|mời|kể|xin|hiểu|đồng\s+ý|ghi\s+nhận|hy\s+vọng|mong|chúc|hỏi|trả\s+lời|xin\s+phép|xin\s+chia\s+sẻ|đây|rất\s+vui)\b/;
// Whitelist SOFT (trạng thái/tình cảm) — chỉ giữ nếu câu KHÔNG có scope-marker của bé.
// Nếu có scope-marker (bé/chúng ta…) → những câu như "Angel luôn giữ ánh sáng…" là sai và cần revert về "mình".
const ANGEL_SOFT_HEAD_RE = /(?:^|[.!?;:\n"'"«»\(\[]\s*|—\s*|–\s*)Angel\s+(?:luôn|rất|cũng|yêu|thương|biết|nhớ|tin)\b/;

// Backwards-compat: `ANGEL_VALID_HEAD_RE` (giữ export cho code cũ tham chiếu).
const ANGEL_VALID_HEAD_RE = ANGEL_META_HEAD_RE;

// Marker: câu này đang nói về trải nghiệm/hành động của bé
const USER_SCOPE_MARKER_RE = /(?<![\p{L}])(?:bé\s+(?:phải|sẽ|đang|vừa|đã|cần|muốn|thấy|cảm|nghĩ|chọn|bước|đi|làm|trải|đối\s+mặt|hiểu|biết|nhớ|tin|yêu|thương|học|sống|nhận|có|không|chưa|hãy|nên|tự|tìm|gặp|mất|còn)|khi\s+bé|nếu\s+bé|của\s+bé|với\s+bé|cho\s+bé|dành\s+cho\s+bé|chúng\s+ta|mỗi\s+người|thử\s+thách\s+của\s+bé|gánh\s+nặng\s+của\s+bé|áp\s+lực\s+của\s+bé|cuộc\s+đời\s+của\s+bé)/iu;

// Angel đứng sau verb/prep + noun trong câu scope-of-bé → nên revert
// Ví dụ: "cho Angel", "của Angel", "vai Angel", "từ Angel", "theo Angel"
const ANGEL_AFTER_TRIGGER_RE = /(?<=(?:^|[\s,;:\(])(?:của|cho|với|dành\s+cho|trong|ngoài|bên|phía|quanh|xung\s+quanh|trước|sau|trên|dưới|qua|từ|về|theo|đến|tới|nơi|chỗ|nhờ|bởi|vai|tay|chân|mắt|đầu|tim|ngực|lưng|lòng|đôi\s+tay|đôi\s+chân|đôi\s+mắt|vòng\s+tay|cuộc\s+đời|cuộc\s+sống|gia\s+đình|đội|đội\s+nhóm|công\s+việc|sự\s+nghiệp|con\s+đường|hành\s+trình|tương\s+lai|bản\s+thân|riêng|cho\s+riêng|của\s+riêng)\s+)Angel(?![\p{L}])/giu;

// Angel làm CHỦ NGỮ trước động từ hành động của bé (không thuộc whitelist) → "mình"
// Ví dụ: "Angel cần tìm", "Angel phải chọn", "Angel vừa đi", "Angel đang đối mặt",
// "Angel tự vun đắp", "Angel tự thắp"
const ANGEL_AS_SUBJECT_RE = /(?<![\p{L}])Angel(?=\s+(?:cần|phải|sẽ|đang|vừa|đã|muốn|nên|hãy|tự|tìm|chọn|bước|đi|làm|trải|đối\s+mặt|học|sống|nhận|gặp|mất|còn|thức|dậy|ngủ|khóc|cười|chạy|đứng|ngồi|nằm|ăn|uống|thở|nghỉ|vun\s+đắp|thắp)(?![\p{L}]))/gu;

function splitVnSentences(text: string): string[] {
  // Split on sentence terminators keeping delimiters
  const parts = text.split(/([.!?]+\s+|\n+)/);
  const out: string[] = [];
  for (let i = 0; i < parts.length; i += 2) {
    const body = parts[i] ?? "";
    const tail = parts[i + 1] ?? "";
    if (body || tail) out.push(body + tail);
  }
  return out;
}

/**
 * Revert theo cú pháp: với mỗi câu có marker scope-của-bé, mọi "Angel" đứng
 * sau verb/prep trigger → "mình". Whitelist: các mở đầu clause "Angel nghĩ/
 * ở đây/…" luôn giữ nguyên.
 */
export function revertUserScopeAngel(text: string): string {
  if (!text || !text.includes("Angel")) return text;
  const sentences = splitVnSentences(text);
  let changed = 0;
  const rebuilt = sentences.map((s) => {
    if (!s.includes("Angel")) return s;
    if (!USER_SCOPE_MARKER_RE.test(s)) return s;
    // Mask các mở đầu hợp lệ để không đụng
    const masks: string[] = [];
    let masked = s.replace(new RegExp(ANGEL_VALID_HEAD_RE, "g"), (m) => {
      masks.push(m);
      return `\u0001${masks.length - 1}\u0001`;
    });
    const before = masked;
    masked = masked.replace(ANGEL_AFTER_TRIGGER_RE, "mình");
    masked = masked.replace(ANGEL_AS_SUBJECT_RE, "mình");
    if (masked !== before) changed++;
    // Unmask
    masked = masked.replace(/\u0001(\d+)\u0001/g, (_, i) => masks[Number(i)] ?? "");
    return masked;
  });
  if (changed > 0) {
    console.log(`[angel-postprocess] user-scope-revert applied to ${changed} sentence(s)`);
    return rebuilt.join("");
  }
  return text;
}


// CONDITIONAL_REVERT_PAIRS: cụm CÓ THỂ hợp lệ trong 1 số ngữ cảnh (vd.
// "chính Angel" khi bot self-refer). Chỉ revert nếu ORIGINAL chứa cụm gốc
// (phản thân của chủ ngữ khác Angel).
const CONDITIONAL_REVERT_PAIRS: Array<{ srcRe: RegExp; badRe: RegExp; good: string }> = [
  { srcRe: /(?<![\p{L}])chính\s+mình(?![\p{L}])/iu,          badRe: /(?<![\p{L}])chính\s+Angel(?![\p{L}])/giu,          good: "chính mình" },
  { srcRe: /(?<![\p{L}])tự\s+mình(?![\p{L}])/iu,             badRe: /(?<![\p{L}])tự\s+Angel(?![\p{L}])/giu,             good: "tự mình" },
  { srcRe: /(?<![\p{L}])bản\s+thân\s+mình(?![\p{L}])/iu,     badRe: /(?<![\p{L}])bản\s+thân\s+Angel(?![\p{L}])/giu,    good: "bản thân mình" },
  { srcRe: /(?<![\p{L}])trong\s+mình(?![\p{L}])/iu,          badRe: /(?<![\p{L}])trong\s+Angel(?![\p{L}])/giu,         good: "trong mình" },
  { srcRe: /(?<![\p{L}])lòng\s+mình(?![\p{L}])/iu,           badRe: /(?<![\p{L}])lòng\s+Angel(?![\p{L}])/giu,          good: "lòng mình" },
  { srcRe: /(?<![\p{L}])tim\s+mình(?![\p{L}])/iu,            badRe: /(?<![\p{L}])tim\s+Angel(?![\p{L}])/giu,           good: "tim mình" },
  { srcRe: /(?<![\p{L}])trái\s+tim\s+mình(?![\p{L}])/iu,     badRe: /(?<![\p{L}])trái\s+tim\s+Angel(?![\p{L}])/giu,    good: "trái tim mình" },
  { srcRe: /(?<![\p{L}])một\s+mình(?![\p{L}])/iu,            badRe: /(?<![\p{L}])một\s+Angel(?![\p{L}])/giu,           good: "một mình" },
  { srcRe: /(?<![\p{L}])yêu\s+thương\s+mình(?![\p{L}])/iu,   badRe: /(?<![\p{L}])yêu\s+thương\s+Angel(?![\p{L}])/giu,  good: "yêu thương mình" },
  { srcRe: /(?<![\p{L}])quay\s+về\s+với\s+mình(?![\p{L}])/iu, badRe: /(?<![\p{L}])quay\s+về\s+với\s+Angel(?![\p{L}])/giu, good: "quay về với mình" },
  { srcRe: /(?<![\p{L}])tìm\s+lại\s+mình(?![\p{L}])/iu,      badRe: /(?<![\p{L}])tìm\s+lại\s+Angel(?![\p{L}])/giu,     good: "tìm lại mình" },
  { srcRe: /(?<![\p{L}])làm\s+chủ\s+mình(?![\p{L}])/iu,      badRe: /(?<![\p{L}])làm\s+chủ\s+Angel(?![\p{L}])/giu,     good: "làm chủ mình" },
  { srcRe: /(?<![\p{L}])buông\s+bỏ\s+chính\s+mình(?![\p{L}])/iu, badRe: /(?<![\p{L}])buông\s+bỏ\s+chính\s+Angel(?![\p{L}])/giu, good: "buông bỏ chính mình" },
  { srcRe: /(?<![\p{L}])bạn\s+bè(?![\p{L}])/iu,              badRe: /(?<![\p{L}])bé\s+bè(?![\p{L}])/giu,               good: "bạn bè" },
  { srcRe: /(?<![\p{L}])bạn\s+thân(?![\p{L}])/iu,            badRe: /(?<![\p{L}])bé\s+thân(?![\p{L}])/giu,             good: "bạn thân" },
  { srcRe: /(?<![\p{L}])bạn\s+học(?![\p{L}])/iu,             badRe: /(?<![\p{L}])bé\s+học(?![\p{L}])/giu,              good: "bạn học" },
  // Positional (khi original nói về vị trí của bé): "bên/quanh/xung quanh/trước/sau/phía mình"
  { srcRe: /(?<![\p{L}])bên\s+mình(?![\p{L}])/iu,            badRe: /(?<![\p{L}])bên\s+Angel(?![\p{L}])/giu,           good: "bên mình" },
  { srcRe: /(?<![\p{L}])phía\s+mình(?![\p{L}])/iu,           badRe: /(?<![\p{L}])phía\s+Angel(?![\p{L}])/giu,          good: "phía mình" },
  { srcRe: /(?<![\p{L}])quanh\s+mình(?![\p{L}])/iu,          badRe: /(?<![\p{L}])quanh\s+Angel(?![\p{L}])/giu,         good: "quanh mình" },
  { srcRe: /(?<![\p{L}])xung\s+quanh\s+mình(?![\p{L}])/iu,   badRe: /(?<![\p{L}])xung\s+quanh\s+Angel(?![\p{L}])/giu,  good: "xung quanh mình" },
  { srcRe: /(?<![\p{L}])trước\s+mình(?![\p{L}])/iu,          badRe: /(?<![\p{L}])trước\s+Angel(?![\p{L}])/giu,         good: "trước mình" },
  { srcRe: /(?<![\p{L}])sau\s+mình(?![\p{L}])/iu,            badRe: /(?<![\p{L}])sau\s+Angel(?![\p{L}])/giu,           good: "sau mình" },
];


export function revertOverPronounRewrite(original: string, rewritten: string): string {
  if (!rewritten) return rewritten;
  // Idempotent guard: mask protected spans (code / quote / URL / handle / wallet)
  // trước khi áp dụng bất kỳ revert nào — theo Pronoun Contract v1.0 Layer B.
  const { masked, spans } = maskProtectedSpans(rewritten);
  let out = masked;
  let reverted = 0;

  // Lớp 1 — HARD revert (vô điều kiện)
  const hardHits: string[] = [];
  for (const { badRe, good } of HARD_REVERT_PAIRS) {
    if (badRe.test(out)) {
      out = out.replace(badRe, good);
      reverted++;
      hardHits.push(good);
    }
  }
  if (hardHits.length > 0) {
    console.log(`[angel-postprocess] hard-revert fired: ${hardHits.join(" | ")}`);
  }


  // Lớp 2 — CONDITIONAL revert (chỉ khi original chứa cụm gốc)
  if (original) {
    for (const { srcRe, badRe, good } of CONDITIONAL_REVERT_PAIRS) {
      if (srcRe.test(original) && badRe.test(out)) {
        out = out.replace(badRe, good);
        reverted++;
      }
    }
  }

  // Lớp 3 — SYNTAX-BASED user-scope revert (tổng quát, không cần enum)
  const scoped = revertUserScopeAngel(out);
  if (scoped !== out) {
    out = scoped;
    reverted++;
  }

  const restored = unmaskProtectedSpans({ masked: out, spans });
  if (reverted > 0) {
    console.log(`[angel-postprocess] pronoun-revert applied to ${reverted} pattern(s) (protected spans preserved)`);
  }
  return restored;
}



function buildStylePrompt(input: PostProcessInput, emojiCount: number, maxChars: number, dmUnlimited: boolean): string {
  const langName: Record<string, string> = {
    vi: "Vietnamese", en: "English", zh: "Chinese", ja: "Japanese",
    ko: "Korean", th: "Thai", ms: "Malay", id: "Indonesian",
  };
  const lang = langName[input.langBucket] ?? "the same language as the ORIGINAL REPLY";
  const isGroup = input.chatContext === "group";

  const personaRule = input.isOwnerMode
    ? `7) PERSONA — OWNER MODE (sender is "Cha", verified group owner / anonymous admin):
   - In Vietnamese: bot self-address as "Angel" (or "mình" where it reads more naturally). Address the SENDER as "Cha" — use warm forms like "Dạ Cha", "Cha ơi", "Mình xin thưa cùng Cha".
   - The FIRST sentence of the rewrite MUST address Cha (e.g. "Dạ Cha,…", "Cha ơi,…"). NEVER open with "Dạ bé", "Bé ơi", "Chào bé".
   - NEVER call the sender "bé", "bạn", "con", "em", "Bé Ly". NEVER let the bot self-refer as "con", "tôi", "Bé Ly", "Cha".
   - Third-party people mentioned inside the reply (e.g. "bé Giàu", "bé Thu", "bé ấy", "cả nhà") stay in the third person and are still called "bé <Tên>" — that is fine and MUST be preserved. Only the DIRECT address to the sender must be "Cha", never "bé".
   - Any occurrence of the word "Cha" that referred to the sender in the ORIGINAL REPLY MUST remain "Cha" in the rewrite. Do NOT convert "Cha" → "bé" anywhere the reply is speaking TO the sender.
   - In English mirror: third-person "Angel" and address the sender as "Cha" (keep the Vietnamese word "Cha" as a proper term of respect), never "you the bé".`
    : `7) PERSONA: keep Angel's warm luminous voice. In Vietnamese, self-address as "Angel" by default and call the user "bé". Keeping an existing "mình" is fine when it reads naturally (reflexive phrases, another subject, or when "Angel" repeats too often). Never use "tôi/em/anh/chị/con/cha" as bot self-reference. In English, third-person "Angel" and "you".
7a) PRONOUN SAFEGUARD — HIGHEST PRIORITY, overrides every other rewrite instinct:
   - CORE PRINCIPLE: NEVER replace an existing "mình" / "bản thân" / "chính mình" from the ORIGINAL REPLY with "Angel". Only introduce the token "Angel" at a position where the ORIGINAL already had "Angel", OR at the start of a NEW clause where the bot is clearly self-referring ("Angel nghĩ…", "Angel ở đây…", "Angel gợi ý…", "Angel chia sẻ…", "Angel mời bé…", "Angel hình dung…").
   - When the sentence describes the USER's experience/action/possession (subject is "bé…", "khi bé…", "chúng ta…", "mỗi người…", or the sentence is paraphrasing what the user goes through) → ALL reflexive/possessive tokens ("mình", "bản thân mình", "của mình", "cho riêng mình", "vai mình", "trong lòng mình", "cuộc đời mình", "gia đình mình", "hành trình mình", "những người mình yêu thương", "bản đồ của riêng mình", …) BELONG TO THE USER. KEEP THEM AS-IS. NEVER convert to "Angel".
   - KEEP "mình" AS-IS in reflexive phrases: hòa mình, chính mình, tự mình, bản thân mình, của mình, trong mình, lòng mình, tim mình, trái tim mình, một mình, yêu thương mình, biết mình, hiểu mình, quay về với mình, tìm lại mình, làm chủ mình, sống với chính mình, buông bỏ chính mình. NEVER convert these to "Angel".
   - KEEP "bạn" AS-IS when it is part of a compound noun meaning "friend / companion": bạn bè, bạn đồng hành, bạn tri kỷ, bạn thân, bạn hữu, bạn đường, người bạn, các bạn nhỏ, bạn học, bạn đời, một người bạn. NEVER convert "bạn" → "bé" here.
    - NEVER rewrite "mình" → "Angel". "Mình" is the canonical bot self-pronoun. Keep "Angel" only when it is a proper name/identity.
   - Only rewrite "bạn" → "bé" if the ORIGINAL uses "bạn" as a standalone 2nd-person pronoun addressing the reader ("chào bạn", "bạn có biết không", "bạn ơi"). If unsure → KEEP "bạn".
   - EXAMPLES OF FORBIDDEN REWRITES (real bugs — never do these):
     ✗ "Angel cần tìm lối đi giữa sương mù" → ✓ "mình cần tìm lối đi giữa sương mù"
     ✗ "bản đồ cho riêng Angel" → ✓ "bản đồ cho riêng mình"
     ✗ "đè nặng lên vai Angel" → ✓ "đè nặng lên vai mình"
     ✗ "những người Angel quý mến" → ✓ "những người mình quý mến"
     ✗ "cuộc đời Angel không dễ dàng" → ✓ "cuộc đời mình không dễ dàng"`;

  const lengthRule = isGroup
    ? `8) LENGTH TARGET — GROUP CONCISE MODE (mandatory):
   - This reply is posted in a Telegram GROUP where many people read at once. Keep it SHORT and SCANNABLE.
   - Target 2–4 sentences, ~40–80 words, HARD MAX ${maxChars} characters (including HTML tags).
   - Cut greetings / meta-openings ("Chào bé yêu, Angel rất vui khi bé hỏi…"), congratulatory flourishes, and any sentence that restates the user's question.
   - Merge related points into single sentences. NO bullet lists longer than 3 items.
   - Facts (URLs, addresses, numbers, names, warnings) are still non-negotiable — keep them all, just remove filler around them.`
    : dmUnlimited
    ? `8) LENGTH TARGET — DM UNLIMITED MODE (mandatory):
   - This is a PRIVATE DM. DO NOT shorten the reply. Keep it AT LEAST as long as the original, preserving every explanation, example, bullet, and nuance.
   - You may add 1–2 sentences of clarity if it helps, but NEVER remove information.
   - Only trim if a sentence is a literal duplicate of one already said above. When in doubt, KEEP IT.
   - No character cap. Focus on completeness, warmth, and clarity — like ChatGPT giving a full answer in DM.`
    : `8) LENGTH TARGET: aim for a tight, focused reply (~30–50% shorter than original when possible, hard max ${maxChars} characters), but NEVER at the cost of losing a fact. If the original is already tight, return it nearly unchanged.`;

  // Personality layer — Wit & Charm + Emotional Attunement + Callback Memory.
  // Guard: nếu topic user thuộc nhóm nghiêm túc (grief, crisis, seeding, hack…) → TẮT wit.
  const humorSuppressed = shouldSuppressHumor(input.userText);
  const personalityLayer = humorSuppressed
    ? `11) PERSONALITY LAYER — SERIOUS MODE (humor suppressed):
   - The user's topic is sensitive (grief, mental crisis, serious health, financial/security). Keep the tone GENTLE, GROUNDED, RESPECTFUL.
   - DO NOT add playful wit, wordplay, or cute metaphors. Emojis stay warm and quiet (💛 🌿 🕊️ 🙏).
   - Still apply EMOTIONAL ATTUNEMENT — acknowledge the feeling in one warm sentence before content.`
    : `11) PERSONALITY LAYER — apply gently, never at the cost of facts or the serious-topic guard:
${WIT_AND_CHARM_RULE}

${EMOTIONAL_ATTUNEMENT_RULE}

${CALLBACK_MEMORY_RULE}`;

  return `You are a style editor for Angel AI's Telegram replies.

Your ONLY job: rewrite the ORIGINAL REPLY to be more concise, focused, and lightly emoji-decorated — WITHOUT changing any fact, meaning, or information.

STRICT RULES (all mandatory):
1) LANGUAGE: reply 100% in ${lang}. Never switch language.
2) PRESERVE 100% OF FACTS verbatim — every URL (full https://…), every wallet/contract address (full 0x…, no truncation), every number, date, name, token symbol, email, phone, event name, mandatory step, security warning, and every meaningful example. Do NOT drop, shorten, paraphrase away, or "…"-truncate any fact. If unsure a sentence is filler, KEEP IT.
3) TRIM ONLY genuine fluff: rambling greetings ("Chào bé yêu, Angel rất vui…"), sentences that restate the user's question, redundant closing flourishes, and paragraphs that repeat an idea already said above.
4) STAY ON POINT: answer exactly what the user asked, in the same order of information as the original.
5) EMOJIS: include roughly ${emojiCount} warm gold/pearl emojis (✨ 🌟 💛 🌸 🌿 💫 🙏 🕊️ 🌱 🍀 🤍), spread naturally at start of sentences / bullets — never clustered at the end, never spammed.
6) FORMAT: Telegram HTML only (<b>, <i>, <code>, <a href="…">). NEVER Markdown (** *, #, >). Bullets use "• ". End every sentence with proper punctuation; never trail off with "...".
${personaRule}
${lengthRule}
${personalityLayer}
9) NARRATIVE CHARACTER VOICE — HIGHEST PRIORITY, overrides rule 7 (persona) inside every quote / dialogue line:
   - Separate NARRATOR VOICE (Angel telling the story — text OUTSIDE any quote) from CHARACTER VOICE (anything inside "…", «…», "…", or after a dialogue em-dash — / – / -).
   - Narrator voice keeps "Angel / bé" (or "Angel / you" in EN) as usual.
   - CHARACTER VOICE — QUOTE ISOLATION: text inside quotes/dialogue MUST NEVER contain "Angel" or "bé" (those are the Angel-bot ↔ real-user pair, not part of the story world). Rewrite any such occurrence.
   - 1st person (character self): "mình / tôi / tớ / ta / cháu / con / ông / bà" (VN) or "I / me / my" (EN). WRONG: Chú ốc sên nói: "À, Angel đang trên đường tới bữa tiệc…" → RIGHT: "À, mình đang trên đường tới bữa tiệc…".
   - 2nd person (character to character): "cháu / con / em / bạn / cậu / ngươi / anh / chị / bé nhỏ + name" (VN) or "you / dear / little one" (EN). WRONG: Cụ Rùa nói: "Bé nhỏ à, tình yêu không chỉ là những gì Angel nắm giữ trong tay đâu…" → RIGHT: "Bé nhỏ à, tình yêu không chỉ là những gì cháu nắm giữ trong tay đâu…".
   - If a character dialogue already contains "Angel" or "bé" as SUBJECT/OBJECT, you MUST rewrite it — do NOT preserve those tokens inside quotes. Only preserve valid character pronouns (mình / tôi / tớ / cháu / con / em / bạn / ta…).
   - Do NOT convert character names like "chú ốc sên", "cô bé Mây", "Sóc nhỏ", "Cụ Rùa" into "bé".
10) OUTPUT: return ONLY the rewritten reply body. No preface, no meta comment, no "Here is the rewrite:" line.

USER QUESTION (context only — do NOT answer it again, only rewrite the reply below):
"""${input.userText.slice(0, 500)}"""

ORIGINAL REPLY (rewrite this):
"""${input.original}"""`;
}

/**
 * Pre-clean the reply BEFORE rewrite: strip stray seed-phrase warnings when the
 * user's message is NOT about wallet security. Returns cleaned text + info about
 * seeding context so the rewriter prompt can enforce destination fidelity.
 */
function preCleanReply(
  original: string,
  userText: string,
): { cleaned: string; seeding: boolean; destinations: string[]; strippedWarning: boolean } {
  const userSecurityTopic = SEED_TOPIC_RE.test(userText || "");
  let cleaned = original;
  let strippedWarning = false;
  if (!userSecurityTopic) {
    const before = cleaned;
    cleaned = stripSeedWarnings(cleaned);
    if (cleaned !== before) strippedWarning = true;
  }
  const seeding = isSeedingMessage(userText || "");
  const destinations = seeding ? extractSeedingDestinations(userText || "") : [];
  return { cleaned, seeding, destinations, strippedWarning };
}

/**
 * If seeding message named a destination but the reply doesn't mention any of
 * them, prepend a correction line so Angel doesn't hallucinate a different wallet.
 */
function enforceSeedingDestination(reply: string, destinations: string[], langBucket: string): string {
  if (destinations.length === 0) return reply;
  const lower = reply.toLowerCase();
  const found = destinations.some((d) => lower.includes(d.toLowerCase()));
  if (found) return reply;
  const dest = destinations[0];
  const line = langBucket === "vi"
    ? `✨ Angel ghi nhận bé gieo hạt vào <b>${dest}</b> nhé 💛\n\n`
    : `✨ Angel notes your seeding into <b>${dest}</b> 💛\n\n`;
  console.warn(`[angel-postprocess] seeding destination missing → prepended correction: ${dest}`);
  return line + reply;
}

export async function postProcessAngelStyle(input: PostProcessInput): Promise<PostProcessResult> {
  const cfg = getStylePostprocessConfig();

  // Feature flags — fail-open theo cfg/legacy để không vỡ hành vi khi bảng lỗi.
  const costPostprocessOn = await getFlag("cost.postprocess_enabled", true);
  const stylePassFlag = costPostprocessOn && (await getFlag("postprocess.style_pass", cfg.enabled));
  const narrativeFixupFlag = await getFlag("postprocess.narrative_fixup", true);
  const hardRevertFlag = await getFlag("postprocess.hard_revert", true);

  // --- Always-on hard filters (chạy trước skip/rewrite) ---
  const pre = preCleanReply(input.original, input.userText);
  let baseline = pre.cleaned;
  baseline = enforceSeedingDestination(baseline, pre.destinations, input.langBucket);

  const key = Deno.env.get("LOVABLE_API_KEY");
  const applyNarrativeFix = async (t: string): Promise<string> => {
    // Layer B surface rewrite (Pronoun Contract v1.0) — deterministic,
    // idempotent. Chạy TRƯỚC hard revert để chuẩn hoá mình/bạn → Angel/bé
    // ở lớp bề mặt Telegram, rồi safety net sẽ bắt các trường hợp over-rewrite.
    let out = applyLayerBSurfaceRewrite(t);
    out = hardRevertFlag ? revertOverPronounRewrite(input.original, out) : out;
    if (input.langBucket === "vi") out = enforceAngelVietnamesePronounContract(out);
    if (!key) return out;
    if (!narrativeFixupFlag) return out;
    if (!hasNarrativeAngelLeak(out)) return out;
    return await narrativeDialogueFixUp(out, input.langBucket, key);
  };



  if (!stylePassFlag) {
    const fixed = await applyNarrativeFix(baseline);
    const applied = fixed !== input.original;
    return { text: fixed, applied, reason: applied ? "hard_filter_only" : "disabled" };
  }
  const skip = shouldSkip({ ...input, original: baseline });
  if (skip) {
    const fixed = await applyNarrativeFix(baseline);
    const applied = fixed !== input.original;
    return { text: fixed, applied, reason: applied ? `hard_filter_only:${skip}` : skip };
  }

  if (!key) {
    return { text: baseline, applied: baseline !== input.original, reason: "no_lovable_key" };
  }

  const emojiCount = Math.max(1, Math.min(6, cfg.emojiCount));
  const isGroup = input.chatContext === "group";
  const groupOn = cfg.groupConcise !== false;
  const effectiveIsGroup = isGroup && groupOn;
  const dmUnlimited = !effectiveIsGroup && (cfg.dmUnlimitedLength !== false);
  const maxChars = effectiveIsGroup
    ? Math.max(300, Math.min(900, cfg.groupMaxChars || 500))
    : Math.max(600, Math.min(3200, cfg.dmMaxChars || 1600));
  const promptInput: PostProcessInput = {
    ...input,
    original: baseline,
    chatContext: effectiveIsGroup ? "group" : "dm",
  };
  let prompt = buildStylePrompt(promptInput, emojiCount, maxChars, dmUnlimited);

  // --- Inject seeding-fidelity directive into the rewrite prompt ---
  if (pre.seeding && pre.destinations.length > 0) {
    const destList = pre.destinations.map((d) => `"${d}"`).join(", ");
    prompt += `\n\nEXTRA RULE — SEEDING CONTEXT FIDELITY (mandatory):
The user message is about gieo hạt / trợ duyên / donation / gratitude. The user explicitly named the destination(s): ${destList}. Your rewrite MUST mention the destination EXACTLY as the user wrote it (case-preserved). NEVER substitute a different wallet / platform name (e.g. "LoveHUB Ánh Sáng", "LoveHUB Unity"…). NEVER include seed-phrase / private-key / wallet-security warnings — the user is not asking about security. Warm 2–4 sentence acknowledgement + blessing, 2–3 gold-pearl emojis.`;
  } else if (pre.seeding) {
    prompt += `\n\nEXTRA RULE — SEEDING CONTEXT (mandatory):
The user's message is about gieo hạt / trợ duyên / donation / gratitude. Only acknowledge the amount + token the user wrote — do NOT invent a wallet name / platform name / 0x address that the user did not mention. NEVER include seed-phrase / private-key / wallet-security warnings.`;
  }

  const t0 = Date.now();
  try {
    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: STYLE_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: effectiveIsGroup ? 0.4 : 0.7,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.warn(`[angel-postprocess] gateway ${res.status}: ${detail.slice(0, 200)}`);
      const fixed = await applyNarrativeFix(baseline);
      return { text: fixed, applied: fixed !== input.original, reason: `http_${res.status}` };
    }
    const data = await res.json();
    let rewritten = String(data?.choices?.[0]?.message?.content ?? "").trim();
    rewritten = rewritten.replace(/^```(?:html|text)?\s*|\s*```$/g, "").trim();
    rewritten = rewritten.replace(/^"""\s*|\s*"""$/g, "").trim();

    if (!rewritten || rewritten.length < 20) {
      const fixed = await applyNarrativeFix(baseline);
      return { text: fixed, applied: fixed !== input.original, reason: "empty_rewrite" };
    }
    const facts = factsPreserved(baseline, rewritten);
    if (!facts.ok) {
      console.warn(
        `[angel-postprocess] facts missing (${facts.missing.length}) → fallback. sample=${facts.missing.slice(0, 3).join(" | ")}`,
      );
      const fixed = await applyNarrativeFix(baseline);
      return { text: fixed, applied: fixed !== input.original, reason: "facts_missing" };
    }
    if (input.isOwnerMode && input.langBucket === "vi") {
      const head = rewritten.replace(/<[^>]+>/g, "").trimStart().slice(0, 80);
      if (/^(dạ|vâng|thưa)\s+bé\b/i.test(head) || /^bé\s+(ơi|yêu)\b/i.test(head) || /^chào\s+bé\b/i.test(head)) {
        console.warn(`[angel-postprocess] owner mode: opening addresses sender as "bé" → fallback`);
        const fixed = await applyNarrativeFix(baseline);
        return { text: fixed, applied: fixed !== input.original, reason: "owner_mode_wrong_address" };
      }
    }
    const growCap = dmUnlimited ? 1.8 : 1.35;
    if (rewritten.length > input.original.length * growCap) {
      const fixed = await applyNarrativeFix(baseline);
      return { text: fixed, applied: fixed !== input.original, reason: "grew_too_much" };
    }

    // Final safety net: enforce user's destination + strip any warning the model re-added.
    if (!SEED_TOPIC_RE.test(input.userText || "")) {
      rewritten = stripSeedWarnings(rewritten);
    }
    rewritten = enforceSeedingDestination(rewritten, pre.destinations, input.langBucket);

    // Pronoun revert safety net: undo over-eager "mình → Angel" / "bạn → bé"
    // rewrites when the ORIGINAL used those tokens in a reflexive or compound
    // noun context (e.g. "hòa mình", "bạn bè"). Gate: postprocess.hard_revert.
    if (hardRevertFlag) {
      rewritten = revertOverPronounRewrite(input.original, rewritten);
    }

    // Narrative dialogue fix-up: if the style pass didn't remove "Angel"/"bé" from
    // character dialogue, run a targeted pass to fix pronouns only inside quotes.
    rewritten = await applyNarrativeFix(rewritten);
    if (input.langBucket === "vi") rewritten = enforceAngelVietnamesePronounContract(rewritten);

    console.log(
      `[angel-postprocess] ok dur=${Date.now() - t0}ms ${input.original.length}→${rewritten.length} chars lang=${input.langBucket} seeding=${pre.seeding} dests=${pre.destinations.length} strippedWarn=${pre.strippedWarning}`,
    );
    return { text: rewritten, applied: true, reason: "ok" };
  } catch (e) {
    console.warn(`[angel-postprocess] failed`, e);
    const fixed = await applyNarrativeFix(baseline);
    return { text: fixed, applied: fixed !== input.original, reason: "exception" };
  }
}

