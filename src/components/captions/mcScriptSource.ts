export type McCaptionSource = { speaker_name: string | null; source_lang: string | null; text_source: string };

// Explicitly load a bounded passage; never concatenate different speakers or translations.
export function recentMcSource(lines: McCaptionSource[]) {
  const latest = lines.at(-1);
  if (!latest || latest.source_lang !== "vi") throw new Error("Dòng cuối chưa phải lời nói tiếng Việt. Bé có thể dán đoạn cần biên tập vào ô bên dưới.");
  const chosen: string[] = [];
  for (let i = lines.length - 1; i >= 0 && chosen.length < 6; i--) {
    const line = lines[i];
    if (line.source_lang !== "vi" || line.speaker_name !== latest.speaker_name) break;
    const text = line.text_source.trim();
    if (!text) break;
    if ([text, ...chosen].join("\n").length > 6000) break;
    chosen.unshift(text);
    if (!latest.speaker_name?.trim()) break;
  }
  if (!chosen.length) throw new Error("Đoạn cuối quá dài. Bé dán một đoạn tối đa 6.000 ký tự để biên tập nhé.");
  return { text: chosen.join("\n"), count: chosen.length, speaker: latest.speaker_name };
}
