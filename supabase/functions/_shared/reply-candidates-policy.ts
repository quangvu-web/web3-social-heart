import { isStandaloneLibraryQuestion, normalizeLibraryQuestion } from "./approved-replies-policy.ts";

export const candidateFlagKey = (group: number) => `library.capture.group.${group}`;
export const validCandidateGroup = (group: number) => Number.isSafeInteger(group) && group < 0;
export function canCollectReplyCandidate(context: { standalone: boolean; forwarded: boolean; illustrated: boolean; hasAttachment: boolean; hasImageContext: boolean }) {
  return context.standalone && !context.forwarded && !context.illustrated && !context.hasAttachment && !context.hasImageContext;
}
export type CandidateSource = {
  id: string;
  group_id: number;
  chat_type: string;
  source: string;
  provider: string;
  error: string | null;
  reply_message_id: number | null;
  trigger_source: string;
  user_message: string;
  bot_reply: string | null;
  language: string | null;
  full_name?: string | null;
  username?: string | null;
};

// A conservative shortlist, NOT a factual/quality verdict. Human review is mandatory.
const privateOrTransient = /https?:\/\/|www\.|[\w.+-]+@[\w.-]+\.[a-z]{2,}|@[\w]{3,}|0x[0-9a-f]{8,}|\d[\d ()+.-]{7,}\d|\b(?:api.?key|password|private key|seed phrase|otp)\b|mật khẩu|khóa bí mật|số dư|số điện thoại|địa chỉ nhà|tài khoản của|ví của|hôm nay|hiện tại|mới nhất|ngày mai|hôm qua|today|tomorrow|yesterday|latest|my wallet|my account|current price|FAQ-TEST-/iu;
const contextual = /tiếp đi|tiếp tục|rồi sao|ở trên|vừa rồi|như đã nói|trong ảnh|bức ảnh|đoạn này|bài này|continue|as mentioned|this image|that message/iu;
const fallback = /đang bận|thử lại sau|try again later|a bit busy|preparing an answer|không thể kết nối|unable to connect/iu;

export function candidateDraft(source: CandidateSource, now = Date.now()) {
  if (!validCandidateGroup(source.group_id) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(source.id) ||
    !["group", "supergroup"].includes(source.chat_type) || source.source !== "telegram" ||
    source.provider !== "funcore" || source.error !== null || source.reply_message_id !== null ||
    typeof source.trigger_source !== "string" || !source.trigger_source.startsWith("group_ai:") || source.trigger_source === "group_ai:positive_community" ||
    typeof source.user_message !== "string" || typeof source.bot_reply !== "string" ||
    !["vi", "en"].includes(source.language ?? "") || !isStandaloneLibraryQuestion(source.user_message)) return null;
  const question = source.user_message.trim();
  const raw = source.bot_reply?.trim() ?? "";
  // Only the Telegram formatting tags we know how to turn into plain text are accepted.
  if (/<(?!\/?(?:b|strong|i|em|u|s|strike|del|code|pre|blockquote)\s*>)[^>]*>/iu.test(raw)) return null;
  const answer = raw.replace(/<\/?(?:b|strong|i|em|u|s|strike|del|code|pre|blockquote)\s*>/giu, "")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
  const combined = `${question}\n${answer}`;
  if (answer.length < 80 || answer.length > 3500 || /<[^>]*>/u.test(answer) ||
    privateOrTransient.test(combined) || contextual.test(combined) || fallback.test(answer)) return null;
  for (const name of [source.full_name, source.username]) {
    if (name && name.trim().length >= 3 && answer.toLocaleLowerCase().includes(name.trim().toLocaleLowerCase())) return null;
  }
  const hasVietnamese = /[ăâđêôơưàảãáạằẳẵắặầẩẫấậèẻẽéẹềểễếệìỉĩíịòỏõóọồổỗốộờởỡớợùủũúụừửữứựỳỷỹýỵ]/iu.test(answer);
  if ((source.language === "vi" && !hasVietnamese) || (source.language === "en" && hasVietnamese)) return null;
  return {
    question, answer, aliases: [] as string[], language: source.language!, group_id: source.group_id,
    status: "draft" as const, source_conversation_id: source.id,
    expires_at: new Date(now + 30 * 86400000).toISOString(),
  };
}

// Stable primary key across live capture, rescans and concurrent workers. Never upsert content.
export async function candidateDraftId(group: number, language: string, question: string) {
  const bytes = new TextEncoder().encode(JSON.stringify(["reply-candidate-v1", group, language, normalizeLibraryQuestion(question)]));
  const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-8${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}
