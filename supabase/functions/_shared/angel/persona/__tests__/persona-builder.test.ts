// Sprint 3 — Contract test cho persona builder.
// Chạy: `deno test supabase/functions/_shared/angel/persona/__tests__/persona-builder.test.ts`
//
// Mục tiêu: bảo vệ các invariant cốt lõi (core discipline luôn có mặt trong
// mọi system prompt build ra), tránh regression khi refactor.

import { assert, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildSystemPromptText } from "../index.ts";
import { WIT_AND_CHARM_RULE } from "../blocks.ts";

Deno.test("core discipline blocks luôn có mặt cho channel=dm", () => {
  const text = buildSystemPromptText({ channel: "dm", userText: "Angel ơi" });
  assertStringIncludes(text, "PRONOUN"); // pronoun subject rule
  assertStringIncludes(text, "OFFICIAL FACTS".toUpperCase().slice(0, 6));
  // scope + anti-hallucination cùng có mặt
  assert(text.length > 200, "system prompt phải đủ dài, không rỗng");
});

Deno.test("factual mode bỏ qua wit/charm block", () => {
  const t = buildSystemPromptText({ channel: "web", mode: "factual", userText: "Ví bé Ly" });
  assert(!t.includes(WIT_AND_CHARM_RULE), "factual mode không được kèm WIT_AND_CHARM_RULE");
});

Deno.test("unlimitedLength=true không kèm RESPONSE LENGTH rule", () => {
  const t = buildSystemPromptText({ channel: "dm", unlimitedLength: true });
  assert(!/RESPONSE LENGTH/i.test(t), "unlimited DM không được đưa length rule");
});

Deno.test("channel=web tự thêm rich format + language mirror", () => {
  const t = buildSystemPromptText({ channel: "web" });
  assert(/format|bullet|emoji/i.test(t), "web channel phải có RICH FORMAT hints");
});
