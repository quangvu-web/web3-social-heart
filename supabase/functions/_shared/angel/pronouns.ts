// Canonical Vietnamese Pronoun Contract for every Angel Telegram output.
// Keep this deterministic: it must run even when all optional AI style passes are off.
// v3: "Angel/bé" is the primary convention; "mình" stays allowed where it reads naturally.

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