import assert from "node:assert/strict";
import { formatSummaryForTelegram } from "./summary-format.ts";

Deno.test("formats section headings, bullets, and paired bold inside a sentence", () => {
  const body = "🎯 **1) Chủ đề chính / Main topic**\n- Một **ý quan trọng** trong họp.\n**- Q:** Vì sao?";
  assert.equal(
    formatSummaryForTelegram(body),
    "🎯 <b>1) Chủ đề chính / Main topic</b>\n• Một <b>ý quan trọng</b> trong họp.\n<b>- Q:</b> Vì sao?",
  );
});

Deno.test("removes stray asterisks and formats accidental Markdown headings", () => {
  const body = "### Tiêu đề *lạc\n# **Đã đậm**\n- Ghi chú*\n\n\n\nTiếp theo";
  assert.equal(
    formatSummaryForTelegram(body),
    "<b>Tiêu đề lạc</b>\n<b>Đã đậm</b>\n• Ghi chú\n\nTiếp theo",
  );
});

Deno.test("preserves escaped transcript characters while adding only safe Telegram tags", () => {
  const escapedBody = "- A &lt; B &amp; C, **x &gt; y**";
  assert.equal(
    formatSummaryForTelegram(escapedBody),
    "• A &lt; B &amp; C, <b>x &gt; y</b>",
  );
});
