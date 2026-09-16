/**
 * Detect "authoritative" documents — nội dung được coi là nguồn chính thức, cần
 * ưu tiên khi RAG trả về (Angel AI gốc có thể dùng metadata.authoritative để
 * boost score và không bị các mảnh chunk khác lấn át).
 *
 * Pattern mặc định: Tài khoản Fun.Rich chính thức của bé <tên>
 *   - "Fun.Rich" / "FUN.RICH" / "funrich" / "Fun Rich" đều match
 *   - Có thể xuất hiện ở title HOẶC trong 500 ký tự đầu content
 */

const AUTHORITATIVE_TITLE_REGEX =
  /t[àa]i\s*kho[aả]n\s+fun[\s.]*rich\s+ch[ií]nh\s*th[ứu]c\s+c[uủ]a\s+b[éeè]/i;

export function detectAuthoritative(
  title: string | null | undefined,
  content?: string | null,
): boolean {
  const t = (title || "").trim();
  if (t && AUTHORITATIVE_TITLE_REGEX.test(t)) return true;
  const head = (content || "").slice(0, 500);
  if (head && AUTHORITATIVE_TITLE_REGEX.test(head)) return true;
  return false;
}

/** Trả về metadata tag bổ sung để merge vào payload push. */
export function authoritativeMetadata(
  title: string | null | undefined,
  content?: string | null,
): Record<string, unknown> {
  return detectAuthoritative(title, content)
    ? { authoritative: true, priority: "high", tags: ["authoritative", "fun_rich_official"] }
    : {};
}
