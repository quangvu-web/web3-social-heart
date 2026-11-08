// Shared by the admin editor and the bot. Preserve accents, negation and numbers.
export function normalizeLibraryQuestion(value: string): string {
  return value.normalize("NFC").toLowerCase().replace(/\s+/gu, " ").trim()
    .replace(/[?!.。]+$/u, "").trim();
}

export function isStandaloneLibraryQuestion(value: string): boolean {
  const q = normalizeLibraryQuestion(value);
  return q.length >= 8 && q.length <= 300 && !/[\r\n]/u.test(value) &&
    !/\bhttps?:\/\/|@|\b0x[0-9a-f]{8}/iu.test(q) &&
    !/(?:tiếp đi|tiếp tục|rồi sao|ý đó|ở trên|vừa rồi|hôm nay|hiện tại|mới nhất|giá hiện|tài khoản của|ví của|continue|today|latest|my account|my wallet|that answer)/iu
      .test(q);
}

export function canUseApprovedLibrary(context: {
  messageType: string;
  hasReply: boolean;
  hasPhoto: boolean;
  hasQuotedContext: boolean;
  builderActive: boolean;
  toolRequest: boolean;
  automaticEngagement: boolean;
  translationRequest: boolean;
}): boolean {
  return context.messageType === "text" && !context.hasReply &&
    !context.hasPhoto && !context.hasQuotedContext &&
    !context.builderActive && !context.toolRequest &&
    !context.automaticEngagement && !context.translationRequest;
}

export interface ApprovedReply {
  id: string;
  question: string;
  answer: string;
  match_keys: string[];
  language: string;
  group_id: number | null;
  status: string;
  expires_at: string;
  revision: number;
}

export function selectApprovedReply(
  rows: ApprovedReply[],
  question: string,
  groupId: number,
  language: string,
  now = Date.now(),
): ApprovedReply | null {
  if (
    !Number.isSafeInteger(groupId) || groupId >= 0 ||
    !["vi", "en"].includes(language) || !isStandaloneLibraryQuestion(question)
  ) return null;
  const key = normalizeLibraryQuestion(question);
  const matches = rows.filter((r) =>
    r.status === "approved" && r.language === language &&
    (r.group_id === null || r.group_id === groupId) &&
    Date.parse(r.expires_at) > now &&
    r.match_keys?.includes(key) && r.answer.trim().length > 0
  );
  const local = matches.filter((r) => r.group_id === groupId);
  const scoped = local.length ? local : matches;
  // An ambiguous answer is a miss, even if one row is newer.
  return scoped.length === 1 ? scoped[0] : null;
}
