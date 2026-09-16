/**
 * Angel Context Bridge
 *
 * Khi user trả lời xác nhận ngắn ("dạ có", "vâng", "ừ", "tiếp", "ok", "dạ bé
 * muốn"...) ngay sau một câu hỏi mở của Angel, RAG upstream không có đủ tín
 * hiệu để retrieve đúng chunk → dễ nhảy chủ đề. Bridge này:
 *   1) Nhận diện confirmation-only turn (bao gồm dạng có "bé" xen giữa).
 *   2) Trích câu hỏi cuối của assistant từ history.
 *   3) Rewrite user query thành một câu mở rộng bám sát chủ đề đó.
 *
 * KHÔNG đổi persona, KHÔNG đổi post-process, KHÔNG tăng cost.
 */

// Patterns FULL-MATCH trên chuỗi đã normalize (lowercase, bỏ dấu câu cuối,
// bỏ prefix "bé" xen giữa). Cho phép trailing filler ngắn (ạ, nhé, nha, đi,
// thêm, nữa, tiếp, nghe, chút, với, nè, đó, ạ) để "dạ bé muốn nghe thêm ạ"
// vẫn khớp nhưng "bé muốn Angel giải thích..." thì KHÔNG.
// Note: KHÔNG dùng \b ở cuối vì ký tự Vietnamese có dấu không phải word-char
// trong regex ASCII → \b lỗi. Dùng full-match với trailing filler thay thế.
const TAIL = "(?:\\s+(?:[ạa]|nh[ée]|nha|đi|th[êe]m|n[ữu]a|ti[ếe]p|nghe|ch[úu]t|v[ớo]i|n[èe]|đ[óo]))*";
function P(body: string): RegExp {
  return new RegExp(`^(?:${body})${TAIL}$`, "i");
}

const CONFIRMATION_PATTERNS: RegExp[] = [
  P("d[ạa]\\s*c[óo]"),
  P("c[óo]"),
  P("v[âa]ng"),
  P("[ừu]"),
  P("[ừu]m+"),
  P("okie+"),
  P("ok"),
  P("oke"),
  P("okay"),
  P("đ[ưu][ợo]c"),
  P("d[ạa]\\s*đ[ưu][ợo]c"),
  P("duoc"),
  P("ti[ếe]p(?:\\s*t[ụu]c)?"),
  P("k[ểe](?:\\s*ti[ếe]p|\\s*nghe|\\s*n[ữu]a|\\s*th[êe]m)?"),
  P("n[óo]i(?:\\s*ti[ếe]p|\\s*nghe|\\s*th[êe]m)?"),
  P("chia\\s*s[ẻe](?:\\s*th[êe]m|\\s*ti[ếe]p|\\s*n[ữu]a)?"),
  P("nghe(?:\\s*n[ữu]a|\\s*th[êe]m)?"),
  P("mu[ốo]n"),
  P("r[ấa]t\\s*mu[ốo]n"),
  P("d[ạa]\\s*mu[ốo]n"),
  P("d[ạa]\\s*(?:r[ấa]t\\s*|c[ũu]ng\\s*)*mu[ốo]n"),
  P("c[ũu]ng\\s*mu[ốo]n"),
  P("đ[ồo]ng\\s*[ýy]"),
  P("d[ạa]\\s*đ[ồo]ng\\s*[ýy]"),
  P("th[êe]m"),
  P("n[ữu]a"),
  P("h[ểa]y\\s*(?:k[ểe]|n[óo]i|chia\\s*s[ẻe])(?:\\s*th[êe]m|\\s*ti[ếe]p)?"),
  P("yes"),
  P("sure"),
  P("please"),
  P("go\\s*on"),
  P("continue"),
  P("tell\\s*me\\s*more"),
];

const NEGATION_RE = /(kh[ôo]ng|ch[ưu]a|kh[ỏo]i|th[ôo]i)\b/i;

const EMOJI_RE = /[\p{Extended_Pictographic}]/gu;

/**
 * META_QUESTION_RE — nhận diện các câu Angel tự yêu cầu user "nhắc lại câu hỏi",
 * "nói rõ hơn", "Angel chưa hiểu"… Đây là kết quả của một lần bridge hụt trước
 * đó. TUYỆT ĐỐI không dùng những câu này làm anchor cho context bridge, nếu
 * không sẽ tạo vòng lặp meta (bot mãi hỏi lại chính câu hỏi hụt).
 */
export const META_QUESTION_RE = /(nh[ắa]c\s*l[ạa]i\s*(c[âa]u\s*h[ỏo]i|[ýy]|[đd][iề]u|n[ộo]i\s*dung)|c[âa]u\s*h[ỏo]i\s*c[ụu]\s*th[ểe]|b[ée]\s*(c[óo]\s*th[ểe]\s*)?n[óo]i\s*r[õo]\s*h[ơo]n|angel\s*ch[ưu]a\s*(hi[ểe]u|r[õo]|n[ắa]m)|angel\s*(kh[ôo]ng|ch[ưu]a)\s*(n[gh]he|hi[ểe]u)\s*r[õo]|b[ée]\s*(mu[ốo]n|c[óo])?\s*chia\s*s[ẻe]\s*(th[êe]m|r[õo])|b[ée]\s*đ[ãa]\s*h[ỏo]i\s*g[ìi]|clarify\s+your\s+question|rephrase|repeat\s+(your\s+)?question|what\s+do\s+you\s+mean)/i;

export function isMetaQuestion(text: string): boolean {
  return META_QUESTION_RE.test(text ?? "");
}

/** Bỏ hết emoji + whitespace/dấu câu cuối, chuyển về lowercase để test regex. */
function normalize(text: string): string {
  let t = text.replace(EMOJI_RE, " ").trim();
  t = t.replace(/[.!,\?…]+$/g, "").trim();
  // Gộp khoảng trắng thừa.
  t = t.replace(/\s+/g, " ");
  return t;
}

/**
 * Bỏ prefix xưng hô "bé" chỉ dùng cho detection. VD:
 *   "dạ bé muốn"       → "dạ muốn"
 *   "bé muốn nghe"     → "muốn nghe"
 *   "cho bé nghe"      → "nghe"
 *   "dạ bé cũng muốn"  → "dạ cũng muốn"
 */
function stripBePrefix(text: string): string {
  let t = text;
  // "cho bé ..." → bỏ luôn "cho bé"
  t = t.replace(/^cho\s+b[ée]\s+/i, "");
  // "dạ/vâng bé ..." → "dạ ..."
  t = t.replace(/^(d[ạa]|v[âa]ng)\s+b[ée]\s+/i, "$1 ");
  // "bé ..." đầu câu → bỏ
  t = t.replace(/^b[ée]\s+/i, "");
  return t.trim();
}

export function isConfirmationOnly(text: string): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  if (!trimmed) return false;
  // Nới trần: 60 ký tự.
  if (trimmed.length > 60) return false;

  const cleaned = normalize(trimmed);
  if (!cleaned) {
    // Chỉ toàn emoji → coi là confirmation nếu là emoji "gật đầu/like".
    return /[👍👌✅🙆🫡🥰💛❤️✨🌟]/u.test(trimmed);
  }

  // Guard negation: "bé không muốn", "chưa muốn", "thôi khỏi"...
  if (NEGATION_RE.test(cleaned)) return false;

  const stripped = stripBePrefix(cleaned);
  const candidates = [cleaned, stripped];
  return candidates.some((c) =>
    c && CONFIRMATION_PATTERNS.some((re) => re.test(c)),
  );
}

/**
 * Trích câu hỏi mở cuối cùng từ assistant turn gần nhất.
 * Nếu câu hỏi quá ngắn (<15 ký tự) → gộp thêm 1 câu văn trước để giữ ngữ cảnh.
 */
/** Nội dung có ý nghĩa (không phải chỉ emoji/dấu câu/whitespace) sau khi strip. */
function meaningfulLength(text: string): number {
  return text.replace(EMOJI_RE, "").replace(/[\s\p{P}\p{S}]/gu, "").length;
}

export function extractLastAssistantQuestion(
  messages: Array<{ role: string; content: string }>,
): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "assistant") continue;
    const content = String(m.content ?? "").trim();
    if (!content) continue;
    // Skip trivial turns (thinking ticker, emoji-only placeholder…)
    if (meaningfulLength(content) < 20) continue;
    // Skip meta-question turns (Angel yêu cầu user nhắc lại câu hỏi) — nếu dùng
    // làm anchor sẽ tạo vòng lặp meta.
    if (META_QUESTION_RE.test(content)) continue;



    const sentences = content.split(/(?<=[.!?…])\s+/);
    for (let j = sentences.length - 1; j >= 0; j--) {
      const s = sentences[j].trim();
      if (!s) continue;
      const hasQ = s.includes("?");
      const softQ = /(có\s*mu[ốo]n|b[ée]\s*(mu[ốo]n|th[ửu]|th[ấa]y|ngh[ĩi])|angel\s*(k[ểe]|chia\s*s[ẻe]|n[óo]i)\s*(th[êe]m|ti[ếe]p)|would\s+you\s+like|shall\s+i|tell\s+me)/i.test(s);
      if (hasQ || softQ) {
        // Nếu câu hỏi quá ngắn hoặc chứa đại từ tham chiếu ("trong đó", "điều này"...),
        // gộp thêm câu văn trước để giữ chủ đề thật (VD: "FUN Ecosystem ... Trong đó?").
        const needsPreviousContext = s.length < 15 || /\b(trong\s*đ[óo]|đi[ềe]u\s*n[àa]y|vi[ệe]c\s*n[àa]y|ch[ủu]\s*đ[ềe]\s*n[àa]y|b[ấa]t\s*k[ỳi].*n[àa]o|platform\s*n[àa]o|this|that|these|it)\b/i.test(s);
        if (needsPreviousContext && j > 0) {
          const prev = sentences[j - 1]?.trim() ?? "";
          const merged = `${prev} ${s}`.trim();
          return merged.slice(-260);
        }
        return s.slice(-260);
      }
    }
    // Fallback: câu cuối của turn assistant gần nhất.
    return sentences[sentences.length - 1]?.trim().slice(-260) || null;
  }
  return null;
}

/**
 * MIXED CONFIRMATION — câu bắt đầu bằng cụm xác nhận rồi có phần follow-up.
 * VD: "Dạ bé muốn, dự án nổi bật của họ là gì", "Có, kể chi tiết thêm đi".
 */
const MIXED_CONFIRMATION_HEAD_RE =
  /^\s*(?:d[ạa]\s+)?(?:b[ée]\s+)?(?:d[ạa]|v[âa]ng|[ừu]m?|okie+|oke|okay|ok|đ[ưu][ợo]c|c[óo]|mu[ốo]n|c[ũu]ng\s+mu[ốo]n|r[ấa]t\s+mu[ốo]n|d[ạa]\s+mu[ốo]n|d[ạa]\s+c[óo]|d[ạa]\s+b[ée]\s+mu[ốo]n|b[ée]\s+mu[ốo]n|yes|sure|please)\b[\s,;.:\-–—]+\S/i;

export function isMixedConfirmationTurn(text: string): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (isConfirmationOnly(trimmed)) return false;
  if (NEGATION_RE.test(trimmed)) return false;
  if (trimmed.length > 240) return false;
  return MIXED_CONFIRMATION_HEAD_RE.test(trimmed);
}

/**
 * UNRESOLVED REFERENCE — câu chứa đại từ ngôi 3 / chỉ định mà KHÔNG kèm chủ
 * thể rõ. Bridge cần resolve chủ thể từ câu Angel vừa nói.
 */
const PRONOUN_REF_RE =
  /\b(h[ọo]|n[óo]|h[ắa]n|b[ọo]n\s+h[ọo]|ch[ỗo]\s+đ[óo]|c[áa]i\s+đ[óo]|đi[ềe]u\s+đ[óo]|dự\s+án\s+đ[óo]|platform\s+đ[óo]|team\s+đ[óo]|quỹ\s+đ[óo]|nh[óo]m\s+đ[óo]|c[ôo]ng\s+ty\s+đ[óo]|they|them|it|that|those|these)\b/i;

// KHÔNG include "Angel", "Camly", "Cha", "Mẹ Camly" — đây là self-reference
// của bot, không phải chủ đề user muốn nghe. Sanity check ở
// `extractSubjectFromQuestion` và `buildContextBridgedQuery` sẽ loại chúng.
const KNOWN_ENTITY_RE = /\b(a16z|PLP|FUN|LoveHUB|VVU|BSC|BTC|USDT|BNB|ETH|Ethereum|Bitcoin)\b/;
/** Self-reference của bot / founder — KHÔNG được chọn làm subject bridge. */
export const SELF_REF_RE = /^(?:Angel(?:\s*AI)?|B[ée]|Cha|M[ẹe](?:\s+Camly)?|Camly(?:\s+Duong)?|D[ạa]|Founder)$/i;
const PROPER_NOUN_RE = /[A-ZĐÀÁẢÃẠÂẦẤẨẪẬĂẰẮẲẴẶÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴ][A-Za-zĐàáảãạâầấẩẫậăằắẳẵặèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ0-9]{1,}/;

/** Regex strip preamble kiểu "Bé (có) muốn Angel chia sẻ/kể/... thêm (về) …". */
const ANGEL_PREAMBLE_RE =
  /^\s*(?:b[ée]\s+)?(?:c[óo]\s+)?mu[ốo]n\s+angel\s+(?:chia\s*s[ẻe]|k[ểe]|n[óo]i|g[ợo]i\s*[ýy]|gi[ảa]i\s*th[íi]ch|ph[âa]n\s*t[íi]ch|b[àa]n|đ[àa]o\s*s[âa]u)\s*(?:th[êe]m|ti[ếe]p|r[õo]\s+h[ơo]n|k[ỹy]\s+h[ơo]n|s[âa]u\s+h[ơo]n)?\s*(?:v[ềe]\s+)?/i;
const ANGEL_PREAMBLE_ALT_RE =
  /^\s*(?:b[ée]\s+)?(?:c[óo]\s+)?mu[ốo]n\s+angel\s+/i;

export function hasUnresolvedReference(text: string): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (trimmed.length > 240) return false;
  if (!PRONOUN_REF_RE.test(trimmed)) return false;
  if (KNOWN_ENTITY_RE.test(trimmed)) return false;
  const rest = trimmed.replace(/^\S+\s*/, "");
  if (PROPER_NOUN_RE.test(rest)) return false;
  return true;
}

export function shouldBridge(text: string): boolean {
  return isConfirmationOnly(text) || isMixedConfirmationTurn(text) || hasUnresolvedReference(text);
}

function isSelfRef(candidate: string | null | undefined): boolean {
  if (!candidate) return false;
  return SELF_REF_RE.test(candidate.trim());
}

/** Trích chủ thể chính từ câu hỏi Angel (heuristic — không gọi LLM). */
export function extractSubjectFromQuestion(question: string): string | null {
  if (!question) return null;
  let q = question.trim();

  // Bước A — strip preamble self-reference để noun-phrase pipeline chạy đúng.
  //   "Bé có muốn Angel chia sẻ thêm về những lĩnh vực … không?"
  //   → "những lĩnh vực … không?"
  q = q.replace(ANGEL_PREAMBLE_RE, "").replace(ANGEL_PREAMBLE_ALT_RE, "").trim();
  if (!q) q = question.trim();

  // Bước B — known-entity (bỏ self-ref).
  const known = q.match(KNOWN_ENTITY_RE);
  if (known && !isSelfRef(known[0])) return known[0];

  // Bước C — quoted string.
  const quoted = q.match(/["'“”‘’]([^"'“”‘’]{2,60})["'“”‘’]/);
  if (quoted && !isSelfRef(quoted[1])) return quoted[1].trim();

  // Bước D — noun-phrase fallback: "về X không?" / "X không?" (chạy TRƯỚC
  // proper-noun để bắt được cụm 2-3 từ như "Fun Cosmos", "PureLove Protocol").
  const np = q.match(/(?:về|cho|của|đến|cách|vào|trong|với)\s+([^,.?!]{4,120}?)\s*(?:kh[ôo]ng|nh[ée]|nha|ch[ưu]a|n[èe]|hay|ho[ặa]c)\s*\??\s*$/i)
    ?? q.match(/^\s*([^,.?!]{4,120}?)\s*(?:kh[ôo]ng|nh[ée]|nha|ch[ưu]a|n[èe]|hay|ho[ặa]c)\s*\??\s*$/i);
  if (np && np[1]) {
    const s = np[1].trim().replace(/\s+/g, " ");
    if (s.length >= 4 && s.length <= 120) {
      // Nếu noun-phrase chứa known-entity → ưu tiên rút gọn về entity đó.
      const inner = s.match(KNOWN_ENTITY_RE);
      if (inner && !isSelfRef(inner[0]) && s.length > 60) return inner[0];
      // Loại self-ref đứng đầu ("angel …") nếu còn sót.
      const cleaned = s.replace(/^(?:angel(?:\s+ai)?|b[ée]|cha|m[ẹe]\s+camly)\s+/i, "").trim();
      if (cleaned && cleaned.length >= 4 && !isSelfRef(cleaned)) return cleaned;
    }
  }

  // Bước E — proper noun đơn lẻ (last resort, bỏ self-ref).
  const propers = q.match(new RegExp(PROPER_NOUN_RE.source, "g")) ?? [];
  const filtered = propers.filter((p) => !isSelfRef(p));
  if (filtered.length > 0) {
    filtered.sort((a, b) => b.length - a.length);
    return filtered[0];
  }
  return null;
}

/**
 * Build query expansion khi phát hiện confirmation-only / mixed / unresolved ref.
 */
export function buildContextBridgedQuery(
  userText: string,
  messages: Array<{ role: string; content: string }>,
): string | null {
  const trimmed = userText.trim();
  if (!trimmed) return null;
  const question = extractLastAssistantQuestion(messages);
  if (!question) return null;

  // SANITY: subject không được là self-ref của bot (Angel/Bé/Cha/Camly...).
  const rawSubject = extractSubjectFromQuestion(question);
  const subject = rawSubject && !isSelfRef(rawSubject) && rawSubject.trim().length >= 2
    ? rawSubject
    : null;

  const NO_SELF_TOPIC =
    "TUYỆT ĐỐI KHÔNG mô tả về chính Angel/AI/Founder/Mẹ Camly khi user chỉ đang xác nhận muốn nghe tiếp một chủ đề khác — bám sát nội dung câu hỏi Angel vừa đặt.";

  if (isConfirmationOnly(trimmed)) {
    return [
      `Bé xác nhận "${trimmed}" cho câu Angel vừa hỏi ở lượt trước:`,
      `"${question}"`,
      subject
        ? `Chủ đề bé đang xác nhận muốn nghe tiếp là: **${subject}**. Angel BẮT BUỘC trả lời ĐÚNG về "${subject}" — chia sẻ cụ thể, chi tiết, có ví dụ/gợi ý thực hành nếu phù hợp.`
        : `Chủ đề bé xác nhận là chính câu Angel vừa hỏi ở trên — Angel BẮT BUỘC bám sát nội dung câu hỏi đó, trả lời cụ thể, chi tiết, có ví dụ/gợi ý thực hành nếu phù hợp.`,
      `TUYỆT ĐỐI KHÔNG: đổi sang chủ đề khác, nhắc lại các mạch cũ không nằm trong câu hỏi trên, mở topic mới, hoặc trả lời chung chung kiểu "cảm ơn bé xác nhận".`,
      NO_SELF_TOPIC,
    ].join("\n");
  }

  if (isMixedConfirmationTurn(trimmed)) {
    return [
      `Bé vừa xác nhận và hỏi thêm ngay trong lượt này. Nội dung bé gửi:`,
      `"${trimmed}"`,
      `Câu Angel vừa hỏi ở lượt trước để giữ ngữ cảnh:`,
      `"${question}"`,
      subject
        ? `Chủ thể đang được nói tới là: ${subject}. Angel BẮT BUỘC bám sát chủ thể này — mọi đại từ ("họ", "nó", "cái đó"...) trong câu hỏi thêm của bé đều đang trỏ về ${subject}.`
        : `Angel BẮT BUỘC bám sát đúng chủ thể trong câu hỏi liền trước — mọi đại từ trong câu hỏi thêm của bé đều đang trỏ về chủ thể đó.`,
      `Trả lời trực tiếp, cụ thể vào phần bé hỏi thêm — TUYỆT ĐỐI KHÔNG đổi sang chủ đề khác.`,
      NO_SELF_TOPIC,
    ].join("\n");
  }

  if (hasUnresolvedReference(trimmed)) {
    return [
      `Bé đang hỏi tiếp bằng đại từ tham chiếu. Nội dung bé gửi:`,
      `"${trimmed}"`,
      `Câu Angel vừa nói ở lượt trước để giữ ngữ cảnh:`,
      `"${question}"`,
      subject
        ? `Đại từ trong câu bé ("họ", "nó", "cái đó"...) đang trỏ về: ${subject}. Angel BẮT BUỘC trả lời đúng về ${subject}, KHÔNG được nhảy sang chủ đề khác.`
        : `Các đại từ trong câu bé đang trỏ về chủ thể của câu Angel vừa nói. Angel BẮT BUỘC bám đúng chủ thể đó.`,
      NO_SELF_TOPIC,
    ].join("\n");
  }

  return null;
}

/** Rule system prompt chèn cuối chuỗi system (recency weight cao nhất). */
export const CONTEXT_CONTINUITY_RULE = [
  "CONTEXT_CONTINUITY_RULE (HIGHEST PRIORITY):",
  "Nếu turn user cuối là câu xác nhận ngắn (VD: \"dạ có\", \"có\", \"vâng\", \"ừ\", \"ok\", \"okie\", \"được\", \"tiếp\", \"tiếp tục\", \"kể tiếp\", \"muốn\", \"dạ bé muốn\", \"bé muốn nghe\", \"cho bé nghe\", \"kể đi\", \"nói đi\", \"thêm đi\", \"yes\", \"sure\", \"continue\"...),",
  "BẮT BUỘC bám sát chủ đề của CÂU HỎI Angel vừa đặt trong turn assistant liền trước.",
  "Nếu turn user chứa đại từ tham chiếu (\"họ\", \"nó\", \"cái đó\", \"chỗ đó\", \"dự án đó\", \"platform đó\", \"they\", \"it\", \"that\"…) mà không nêu lại chủ thể, BẮT BUỘC hiểu đại từ đó đang trỏ về chủ thể trong câu Angel vừa nói ở lượt trước — KHÔNG được nhảy sang chủ thể khác.",
  "Trả lời trực tiếp, cụ thể vào đúng chủ đề đó — chia sẻ chi tiết, ví dụ, gợi ý thực hành.",
  "TUYỆT ĐỐI KHÔNG: mở chủ đề mới, kể chuyện không liên quan, đưa nội dung generic ngoài ngữ cảnh câu hỏi.",
  "English/other languages: apply the same continuity rule — stay on the exact topic and subject of the last thing Angel said.",
].join("\n");
