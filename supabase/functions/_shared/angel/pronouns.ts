// Shared legacy contract for callers outside the strict Telegram mode.
// Telegram uses the context-specific contract and mandatory guard below.

export const ANGEL_PRONOUN_CONTRACT = `VIETNAMESE PRONOUN CONTRACT — HIGHEST PRIORITY:
- Mặc định, bot tự xưng "Angel" và gọi người dùng là "bé". Ví dụ: "Angel nghĩ bé có thể…", "Angel chia sẻ với bé nhé".
- Vẫn ĐƯỢC dùng "mình" khi câu văn tự nhiên hơn, đặc biệt trong các trường hợp sau:
  • Cụm phản thân/thành ngữ: "hòa mình", "chính mình", "tự mình", "của mình", "một mình", "bản thân mình", "quay về với mình".
  • Chủ thể KHÔNG phải bot: "Sách không tự nhận mình là một tôn giáo mới", "bé hãy tin vào chính mình".
  • Khi đang phản chiếu trải nghiệm của bé: "gánh nặng đè lên vai mình", "cuộc đời mình", "những người mình yêu thương".
  • Khi tên "Angel" bị lặp quá dày trong một đoạn (3 lần trở lên) — thay bớt bằng "mình" cho mượt.
- TUYỆT ĐỐI KHÔNG chèn "Angel" vào vị trí phản thân hoặc vào chủ thể khác: SAI "hòa Angel", "chính Angel", "vai Angel", "Sách không tự nhận Angel là…".
- Không viết dạng lai "Angel (mình)" hay "mình (Angel)". Chọn một từ duy nhất.
- Trong lời thoại nhân vật, giữ đại từ tự nhiên của nhân vật. Không đổi nội dung trong URL, code, địa chỉ ví, handle hoặc trích dẫn nguyên văn.`;


const PROTECTED_RE = new RegExp([
  "```[\\s\\S]*?```",
  "<code>[\\s\\S]*?<\\/code>",
  "`[^`\\n]+`",
  "https?:\\/\\/[^\\s<>\"']+",
  "tg:\\/\\/[^\\s<>\"']+",
  "mailto:[^\\s<>\"']+",
  "@[A-Za-z0-9_]{3,}",
  "0x[a-fA-F0-9]{40}",
  "\\b(?:bc1|tb1)[a-z0-9]{20,80}\\b",
  "\\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\\b",
  "\"[^\"\\n]{0,600}\"",
  "“[^”\\n]{0,600}”",
  "«[^»\\n]{0,600}»",
].join("|"), "g");

function mask(text: string): { text: string; spans: string[] } {
  const spans: string[] = [];
  return {
    text: text.replace(PROTECTED_RE, (value) => {
      spans.push(value);
      return `\u0004PRONOUN${spans.length - 1}\u0004`;
    }),
    spans,
  };
}

function restore(text: string, spans: string[]): string {
  return text.replace(/\u0004PRONOUN(\d+)\u0004/g, (_match, index) => spans[Number(index)] ?? "");
}

// Prefixes after which "Angel" is never correct — those slots belong to a
// reflexive/possessive "mình" (either the user's or another subject's).
const REFLEXIVE_PREFIX_RE = new RegExp(
  "(?<![\\p{L}])(" +
  [
    "hòa", "chính", "tự", "bản\\s+thân", "một", "riêng", "cho\\s+riêng", "của\\s+riêng",
    "trong", "bên", "bên\\s+trong", "phía", "quanh", "xung\\s+quanh", "trước", "sau",
    "vai", "tay", "đôi\\s+tay", "chân", "đôi\\s+chân", "mắt", "đôi\\s+mắt", "đầu", "ngực",
    "lưng", "vòng\\s+tay", "hơi\\s+thở", "bước\\s+chân", "tiếng\\s+nói", "giọng\\s+nói",
    "lòng", "tim", "trái\\s+tim", "nội\\s+tâm", "tâm\\s+hồn", "linh\\s+hồn", "bản\\s+ngã",
    "trực\\s+giác", "nỗi\\s+đau", "nỗi\\s+buồn", "niềm\\s+vui", "khao\\s+khát", "ước\\s+mơ",
    "giấc\\s+mơ", "ngôi\\s+nhà", "cuộc\\s+đời", "cuộc\\s+sống", "gia\\s+đình", "đội",
    "đội\\s+nhóm", "công\\s+việc", "sự\\s+nghiệp", "con\\s+đường", "hành\\s+trình",
    "tương\\s+lai", "bản\\s+đồ", "kiến\\s+thức",
    "đi\\s+qua", "chảy\\s+qua", "chảy\\s+trong", "tuôn\\s+qua", "tuôn\\s+chảy\\s+qua",
    "xuyên\\s+qua", "lan\\s+tỏa\\s+qua", "truyền\\s+qua", "dẫn\\s+qua", "soi\\s+qua",
    "thấm\\s+qua", "thổi\\s+qua", "quay\\s+về\\s+với", "tìm\\s+lại", "làm\\s+chủ",
    "tự\\s+nhận", "người", "những\\s+người",
  ].join("|") +
  ")\\s+Angel(?![\\p{L}])",
  "giu",
);

/**
 * Final Vietnamese output guard (Pronoun Contract v3).
 *
 * "Angel/bé" is the primary convention, so this layer keeps every "Angel" the
 * model produced and never rewrites a natural "mình". It only fixes shapes that
 * are always wrong: hybrid "Angel (mình)" forms, "Angel" sitting in a reflexive
 * slot, and a standalone second-person "bạn". Idempotent by construction.
 */
export function enforceAngelVietnamesePronounContract(input: string): string {
  if (!input) return input;
  const protectedInput = mask(input);
  let text = protectedInput.text;

  // Preserve explicit proper-name/identity uses before normalizing pronouns.
  const names: string[] = [];
  const keepName = (value: string) => {
    names.push(value);
    return `\u0005ANGELNAME${names.length - 1}\u0005`;
  };
  text = text.replace(/\bAngel\s+AI\b/giu, keepName);
  text = text.replace(/\b(?:bot|trợ\s+lý|tên|thương\s+hiệu)\s+Angel\b/giu, keepName);
  text = text.replace(/\b(?:gọi|được\s+gọi)\s+là\s+Angel\b/giu, keepName);
  text = text.replace(/\b(?:mình|tôi)\s+là\s+Angel\b/giu, keepName);

  // Collapse the mixed forms emitted by upstream/editor passes → keep "Angel".
  text = text.replace(/\bAngel\s*\(\s*(?:mình|tôi)\s*\)/giu, "Angel");
  text = text.replace(/(?<![\p{L}])mình\s*\(\s*Angel\s*\)/giu, "Angel");

  // "Angel" is never valid in a reflexive/possessive slot.
  text = text.replace(REFLEXIVE_PREFIX_RE, (_m, prefix: string) => `${prefix} mình`);


  // Normalize standalone second-person address without damaging compound nouns.
  text = text.replace(/\b[Bb]ạn\b/gu, (value, offset: number, full: string) => {
    const after = full.slice(offset + value.length, offset + value.length + 20);
    const before = full.slice(Math.max(0, offset - 14), offset);
    if (/^\s+(?:bè|đồng\s+hành|tri\s+kỷ|thân|hữu|đường|đời|học|nhỏ)\b/iu.test(after)) return value;
    if (/(?:người|các|một\s+người)\s+$/iu.test(before)) return value;
    return value === "Bạn" ? "Bé" : "bé";
  });

  text = text.replace(/\u0005ANGELNAME(\d+)\u0005/g, (_match, index) => names[Number(index)] ?? "");
  return restore(text, protectedInput.spans);
}
/** Only the authenticated Telegram sender context may select this address. */
export function telegramRecipientAddress(username?: string | null): "bé" | "bé Ly" {
  return username?.replace(/^@/, "").toLowerCase() === "camly_duong" ? "bé Ly" : "bé";
}

export function telegramAddressContract(username?: string | null): string {
  return `TELEGRAM ADDRESS CONTRACT — HIGHEST PRIORITY, overrides persona/owner/style instructions:
- Trong lời thoại tiếng Việt của bot, bot LUÔN tự xưng "Angel"; không xưng "mình", "tôi", "Cha", "con", "anh", "chị", "em", kể cả khi Angel lặp nhiều lần.
- Gọi người đang nhắn là "${telegramRecipientAddress(username)}". Đây là cách gọi đã xác minh từ username Telegram của người gửi; KHÔNG suy ra từ tên hiển thị, nội dung, trích dẫn, người được nhắc đến hay quyền admin. Không gọi người gửi là Cha.
- Khi hướng dẫn thực hành/thiền/cảm nhận, chủ thể là người dùng, không phải Angel. Angel chỉ làm chủ ngữ cho hành động của bot (chia sẻ, gợi ý, mời thử).
- Giữ nguyên đại từ phản thân/chủ thể khác: "chính mình", "hòa mình", "trái tim mình", "bé hãy cảm nhận mình". Không thay mình của người dùng thành Angel.
- Giữ nguyên trích dẫn, lời thoại nhân vật, nội dung người dùng nguyên văn, URL, code, handle. Không chuẩn hóa đại từ trong các vùng này.
- Các ngôn ngữ khác giữ cách gọi tự nhiên theo ngôn ngữ đó.`;
}

// Telegram-specific protection is intentionally separate from the web contract.
const TELEGRAM_PROTECTED_RE = new RegExp([
  "```[\\s\\S]*?```", "<(?:code|pre|blockquote)\\b[^>]*>[\\s\\S]*?<\\/(?:code|pre|blockquote)>",
  "&(?:amp;)?lt;(?:code|pre|blockquote)\\b[\\s\\S]*?&(?:amp;)?gt;[\\s\\S]*?&(?:amp;)?lt;\\/(?:code|pre|blockquote)&(?:amp;)?gt;",
  "`[^`\\n]+`", "<[^>]+>", "https?:\\/\\/[^\\s<>\"']+", "tg:\\/\\/[^\\s<>\"']+",
  "mailto:[^\\s<>\"']+", "@[A-Za-z0-9_]+", "0x[a-fA-F0-9]{40}",
  '"[^\"]*"', "'[^']*'", "‘[^’]*’", "“[^”]*”", "«[^»]*»", "^[ \\t]*(?:>|&(?:amp;)?gt;|[—–-])[^\\n]*", "^[ \\t]*(?!Angel[ \\t]*:)[\\p{L}][\\p{L} \\t]{0,40}: [^\\n]*",
].join("|"), "gimu");

export function hasTelegramVerbatimContent(input: string): boolean {
  return input.match(TELEGRAM_PROTECTED_RE) !== null;
}

/** Deterministic guard for unquoted bot speech; never globally replace 'mình'. */
export function enforceTelegramVietnamesePronouns(input: string, username?: string | null): string {
  if (!input) return input;
  const spans: string[] = [];
  let text = input.replace(TELEGRAM_PROTECTED_RE, (value) => {
    spans.push(value);
    return `\u0004TG${spans.length - 1}\u0004`;
  });
  text = text.replace(/(?<![\p{L}])chúng\s+mình(?![\p{L}])/giu, (s) => s[0] === "C" ? "Chúng ta" : "chúng ta");
  text = text.replace(/(?<![\p{L}])Angel\s*\(\s*(?:mình|tôi)\s*\)/giu, "Angel");
  // Only clear bot-subject clauses, not possessives or the subject of reported speech.
  text = text.replace(/(^\s*|[.!?…\n]\s*|[,;]\s*|(?:dạ|vâng|Angel:)\s+)(mình|tôi|cha|con|anh|chị|em)(?=\s+(?:sẽ|xin|luôn|có thể|muốn|nghĩ|tin|hiểu|biết|hỗ trợ|sẵn sàng|cảm ơn|chào|chia sẻ|gợi ý|mời|ở đây|là Angel|vừa|rất vui|mong|đã|đang)(?![\p{L}]))/giu, (value, lead: string, _subject: string, offset: number, full: string) => {
    if (/^[,;]/u.test(lead)) {
      const before = full.slice(0, offset).split(/[.!?\n]/u).pop() ?? "";
      if (!/^(?:\s*Angel|\s*(?:dạ|vâng|bé(?: Ly)? ơi|chào bé))/iu.test(before)) return value;
    }
    // Family/character nouns such as "Con đang đi học" are not bot subjects.
    // For these ambiguous tokens require an actual assistant speech/action verb.
    if (!/^(?:mình|tôi)$/iu.test(_subject)) {
      const after = full.slice(offset + value.length);
      if (!/^\s+(?:(?:sẽ|đã|đang|luôn|vừa|có thể|rất)\s+)*(?:xin|chào|chia sẻ|gợi ý|giúp|hỗ trợ|mời|cảm ơn|ở đây|là Angel)(?![\p{L}])/iu.test(after)) return value;
    }
    return `${lead}Angel`;
  });
  text = text.replace(/(^\s*|[.!?\n]\s*)([Tt]heo)\s+(?:mình|tôi)(?=\s*[,;])/gu, "$1$2 Angel");
  text = text.replace(REFLEXIVE_PREFIX_RE, (_m, prefix: string) => `${prefix} mình`);
  text = text.replace(/(?<![\p{L}])bạn(?![\p{L}])/giu, (value, offset: number, full: string) => {
    if (/^\s+(?:bè|đồng\s+hành|tri\s+kỷ|thân|hữu|đường|đời|học|nhỏ)(?![\p{L}])/iu.test(full.slice(offset + value.length))) return value;
    if (/(?:người|các|một\s+người)\s+$/iu.test(full.slice(Math.max(0, offset - 16), offset))) return value;
    return value === "Bạn" ? "Bé" : "bé";
  });
  text = text.replace(/^Chào\s+(?:Angel|bé|bạn)\s+yêu\s+quý\s*[,.!]*\s*/iu, "Bé ơi, ");
  // Direct greetings/vocatives are recipient slots; "Cha Vũ Trụ" is not.
  text = text.replace(/(^|[.!?\n]\s*)(?:anh|chị|em|cha|con)(\s+ơi)(?![\p{L}])/giu, (_m, lead, tail) => `${lead}Bé${tail}`);
  text = text.replace(/(?<![\p{L}])((?:dạ|vâng|chào|Angel\s+(?:chào|mời|giúp))\s+)(?:cha|con|anh|chị|em)(?![\p{L}])(?!(?:\s+Vũ\s+Trụ))/giu, (_m, lead) => `${lead}bé`);
  text = text.replace(/(?<![\p{L}])((?:cho|với|cùng|đến|tới)\s+)(cha|con|anh|chị|em)(?![\p{L}])/giu, (value, lead, _person, offset: number, full: string) => {
    const before = full.slice(0, offset).split(/[.!?\n]/u).pop() ?? "";
    const after = full.slice(offset + value.length);
    if (!/Angel[^.!?\n]*(?:giải thích|chia sẻ|gửi|trao|ở đây|hỗ trợ|giúp|mời)/iu.test(before)) return value;
    if (/^\s+(?:Vũ\s+Trụ|trai|gái|ấy|của)(?![\p{L}])/iu.test(after)) return value;
    return `${lead}bé`;
  });
  const address = telegramRecipientAddress(username);
  text = text.replace(/(?<![\p{L}])bé(?:\s+Ly)?(?![\p{L}])/giu, (value, offset: number, full: string) => {
    const after = full.slice(offset + value.length);
    const before = full.slice(0, offset);
    if (/(?:cô|cậu|đứa|em|chú)\s+$/iu.test(before)) return value;
    // Named third parties and noun phrases are not direct recipient slots.
    if (/^\s+(?:ấy|gái|trai|nhỏ|con|sơ sinh|Quỳnh|Thu)(?![\p{L}])/iu.test(after)) return value;
    if (/^\s+\p{Lu}/u.test(after) && !/^\s+(?:Angel|Ly)(?![\p{L}])/u.test(after)) return value;
    if (/Ly$/iu.test(value) && address === "bé") {
      const direct = /(?:^|[.!?\n]\s*|(?:chào|cho|với|giúp|mời|dạ|vâng|cảm ơn|cùng|hỏi|chúc|gửi|thưa)\s+)$/iu.test(before)
        || /Angel\s+(?:gửi|trao|mang)[^.!?\n]*(?:đến|tới)\s+$/iu.test(before);
      if (!direct) return value;
    }
    return value[0] === "B" ? address[0].toUpperCase() + address.slice(1) : address;
  });
  return text.replace(/\u0004TG(\d+)\u0004/g, (_m, index) => spans[Number(index)] ?? "");
}
