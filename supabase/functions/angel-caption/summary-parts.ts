// Input is the already escaped/formatted Telegram HTML, never raw model markup.
export function telegramTextLength(html: string): number {
  return html.replace(/<\/?b>/g, "").replace(/&(?:amp|lt|gt);/g, (entity) =>
    ({ "&amp;": "&", "&lt;": "<", "&gt;": ">" })[entity]!).length;
}

export function splitSummaryMessages(text: string): string[] {
  // Keep the established short-message envelope; its final DM status fits the
  // remaining Telegram 4096-character allowance (reason is capped at 160).
  if (telegramTextLength(text) <= 3800) return [text];
  const contentLimit = 3530; // Reserve label + 245 characters for final DM status.
  const labelParts = (parts: string[]) => parts.map((part, index) => `(phần ${index + 1}/${parts.length})\n${part}`);
  // Prefer the requested 1–2 / 3–4 boundary, even when Q&A could fit in part 1.
  const qaStart = text.search(/^❓/mu);
  if (qaStart > 0) {
    const preferred = [text.slice(0, qaStart), text.slice(qaStart)];
    if (preferred.every(part => telegramTextLength(part) <= contentLimit)) return labelParts(preferred);
  }
  const sections = text.split(/(?=^(?:🎯|💡|❓|✅))/mu).filter(Boolean);
  const blocks: string[] = [];
  for (const section of sections) {
    if (telegramTextLength(section) <= contentLimit) { blocks.push(section); continue; }
    // Continuation lines stay attached to their bullet, including multiline Q&A.
    const bullets = section.split(/(?=^(?:• |- ))/mu).filter(Boolean);
    for (const bullet of bullets) {
      if (telegramTextLength(bullet) > contentLimit) {
        throw new Error("summary bullet exceeds Telegram message budget");
      }
      blocks.push(bullet);
    }
  }
  const parts: string[] = [];
  let current = "";
  for (const block of blocks) {
    if (current && telegramTextLength(current + block) > contentLimit) {
      parts.push(current); current = "";
    }
    current += block;
  }
  if (current) parts.push(current);
  return labelParts(parts);
}
