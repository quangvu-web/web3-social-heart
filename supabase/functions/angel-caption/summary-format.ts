// The caller must escape transcript-derived text before adding Telegram HTML tags.
export function formatSummaryForTelegram(escapedBody: string): string {
  const withBold = escapedBody.replace(/\*\*([^*\n]+?)\*\*/g, "<b>$1</b>");
  return withBold
    .split("\n")
    .map((line) => {
      let formatted = line.replace(/^- /, "• ");
      // Some model replies prefix an already dashed Q&A label with another list dash.
      formatted = formatted.replace(/^• <b>- (Câu hỏi|Trả lời|Q|A):<\/b>/, "• <b>$1:</b>");
      if (/^#+\s*/.test(formatted)) {
        formatted = formatted.replace(/^#+\s*/, "");
        if (!/^<b>.*<\/b>$/.test(formatted)) formatted = `<b>${formatted}</b>`;
      }
      return formatted.replace(/\*/g, "");
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}
