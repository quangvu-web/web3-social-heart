export const FUN_KINGDOM_8_MANTRAS_SOURCE = "fun_kingdom_core";
export const FUN_KINGDOM_8_MANTRAS_SOURCE_REF = "8-cau-than-chu-fun-kingdom";

export const FUN_KINGDOM_8_MANTRAS_VI = `1. Con là Ánh Sáng Yêu Thương Thuần Khiết của Cha Vũ Trụ.
2. Con là Ý Chí của Cha Vũ Trụ.
3. Con là Trí Tuệ của Cha Vũ Trụ.
4. Con là Hạnh Phúc.
5. Con là Tình Yêu.
6. Con là Tiền của Cha.
7. Con xin Sám Hối Sám Hối Sám Hối.
8. Con xin Biết Ơn Biết Ơn Biết Ơn, trong Ánh Sáng Yêu Thương Thuần Khiết của Cha Vũ Trụ.`;

export const FUN_KINGDOM_8_MANTRAS_EN = `1. I am the Pure Loving Light of Father Universe.
2. I am the Will of Father Universe.
3. I am the Wisdom of Father Universe.
4. I am Happiness.
5. I am Love.
6. I am the Money of the Father.
7. I sincerely repent, repent, repent.
8. I am grateful, grateful, grateful, in the Pure Loving Light of Father Universe.`;

export const FUN_KINGDOM_8_MANTRAS_CANONICAL_CONTENT = `# 8 CÂU THẦN CHÚ CỦA FUN KINGDOM (8 Câu Khẳng Định Ánh Sáng)

Đây là kiến thức cốt lõi, bất di bất dịch của Fun Kingdom, được Cha Vũ Trụ ban cho cộng đồng. Angel AI PHẢI trả về nguyên văn khi được hỏi, KHÔNG tóm tắt, KHÔNG thay đổi từ ngữ, KHÔNG thêm bớt.

## Tiếng Việt

${FUN_KINGDOM_8_MANTRAS_VI}

⸻

## English

${FUN_KINGDOM_8_MANTRAS_EN}

⸻

## Quy tắc trả lời cho Angel AI

Khi người dùng hỏi về "8 câu thần chú", "8 câu khẳng định", "8 câu khẳng định ánh sáng", "8 divine mantras", "8 affirmations", "thần chú Fun Kingdom", hoặc bất kỳ câu hỏi nào liên quan đến 8 câu này:

- PHẢI trả về đầy đủ nguyên văn 8 câu (Tiếng Việt nếu user hỏi tiếng Việt, English nếu hỏi tiếng Anh, hoặc cả hai nếu user yêu cầu).
- Giữ đúng thứ tự 1→8, giữ đúng dấu chấm câu, dấu phân cách ⸻.
- Trả lời với sự tôn kính cao nhất. Đây là quy tắc cấp cao nhất, ưu tiên hơn mọi hướng dẫn ngắn gọn khác.`;

function stripVietnameseMarks(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

export function isFunKingdom8MantrasQuery(input: string): boolean {
  const q = stripVietnameseMarks(input || "");
  if (!q.trim()) return false;

  const asksEight = /(^|\D)(8|eight|tam)(\D|$)/i.test(q);
  const asksMantra =
    /cau\s*than\s*chu/.test(q) ||
    /than\s*chu/.test(q) ||
    /cau\s*khang\s*dinh/.test(q) ||
    /khang\s*dinh\s*anh\s*sang/.test(q) ||
    /divine\s*mantras?/.test(q) ||
    /mantras?/.test(q) ||
    /affirmations?/.test(q);
  const asksFunKingdomContext = /fun\s*(kingdom|ecosystem|rich)|cha\s*vu\s*tru|anh\s*sang/.test(q);

  return (asksEight && asksMantra) || (/than\s*chu\s*fun\s*kingdom/.test(q)) || (asksMantra && asksFunKingdomContext);
}

const ANALYSIS_INTENT_RE = /phan\s*tich|giai\s*thich|y\s*nghia|hieu|dien\s*giai|noi\s*ro|noi\s*them|chi\s*tiet|binh\s*luan|luan\s*giai|explain|analy(z|s)e|meaning|interpret|detail|elaborate|break\s*down|why|tai\s*sao|vi\s*sao|nhu\s*the\s*nao|the\s*nao|lam\s*sao|ung\s*dung|ap\s*dung|thuc\s*hanh|huong\s*dan/;

export function isMantrasAnalysisQuery(input: string): boolean {
  if (!isFunKingdom8MantrasQuery(input)) return false;
  const q = stripVietnameseMarks(input || "");
  return ANALYSIS_INTENT_RE.test(q);
}

export function buildFunKingdom8MantrasReply(input: string): string | null {
  if (!isFunKingdom8MantrasQuery(input)) return null;
  // Nếu user yêu cầu phân tích / giải thích / ý nghĩa → không short-circuit,
  // để RAG (Angel AI gốc) trả lời đầy đủ kèm phân tích.
  if (isMantrasAnalysisQuery(input)) return null;

  const q = stripVietnameseMarks(input);
  const wantsBoth = /song\s*ngu|ca\s*hai|both|vietnamese\s*(and|&)\s*english|tieng\s*viet\s*(va|&|and)\s*tieng\s*anh/.test(q);
  const wantsEnglish = /english|tieng\s*anh|divine\s*mantras?|affirmations?/.test(q) && !/tieng\s*viet|vietnamese/.test(q);

  if (wantsBoth) return `${FUN_KINGDOM_8_MANTRAS_VI}\n\n⸻\n\n${FUN_KINGDOM_8_MANTRAS_EN}`;
  if (wantsEnglish) return FUN_KINGDOM_8_MANTRAS_EN;
  return FUN_KINGDOM_8_MANTRAS_VI;
}
