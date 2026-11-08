import assert from "npm:assert@2.1.0";
import {
  type ApprovedReply,
  canUseApprovedLibrary,
  isStandaloneLibraryQuestion,
  normalizeLibraryQuestion,
  selectApprovedReply,
} from "./approved-replies-policy.ts";
import { findApprovedReply } from "./approved-replies.ts";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

const now = Date.parse("2026-11-08T00:00:00Z");
const row = (patch: Partial<ApprovedReply> = {}): ApprovedReply => ({
  id: "one",
  question: "CAMLY là gì?",
  answer: "Nội dung đã kiểm chứng.",
  match_keys: ["camly là gì", "giới thiệu camly"],
  language: "vi",
  group_id: -1001,
  status: "approved",
  expires_at: "2026-12-08T00:00:00Z",
  revision: 1,
  ...patch,
});
Deno.test("approved library preserves negation, accents, numbers and only accepts approved aliases", () => {
  assert.equal(normalizeLibraryQuestion("  CAMLY  là gì?!  "), "camly là gì");
  assert.equal(normalizeLibraryQuestion("CAMLY là gì?"), "camly là gì");
  assert.equal(
    selectApprovedReply([row()], "Giới thiệu CAMLY!", -1001, "vi", now)?.id,
    "one",
  );
  for (
    const question of [
      "CAMLY không là gì",
      "camly la gi",
      "giới thiệu 2 CAMLY",
      "CAMLY dùng thế nào?",
    ]
  ) {
    assert.equal(
      selectApprovedReply([row()], question, -1001, "vi", now),
      null,
    );
  }
});
Deno.test("draft, revoked, expired, invalid-expiry and wrong language/scope never answer", () => {
  for (
    const patch of [
      { status: "draft" },
      { status: "revoked" },
      { expires_at: "bad" },
      { expires_at: new Date(now).toISOString() },
      { language: "en" },
      { group_id: -1002 },
    ]
  ) {
    assert.equal(
      selectApprovedReply([row(patch)], "CAMLY là gì?", -1001, "vi", now),
      null,
    );
  }
  assert.equal(
    selectApprovedReply(
      [row({ group_id: null })],
      "CAMLY là gì?",
      1001,
      "vi",
      now,
    ),
    null,
  );
  assert.equal(
    selectApprovedReply([row()], "CAMLY là gì?", -1001, "auto", now),
    null,
  );
});
Deno.test("local approved answer takes precedence; ambiguous local/global matches miss", () => {
  const global = row({ id: "global", group_id: null });
  assert.equal(
    selectApprovedReply([global, row()], "CAMLY là gì?", -1001, "vi", now)?.id,
    "one",
  );
  assert.equal(
    selectApprovedReply([global], "CAMLY là gì?", -1002, "vi", now)?.id,
    "global",
  );
  assert.equal(
    selectApprovedReply(
      [row(), row({ id: "two" }), global],
      "CAMLY là gì?",
      -1001,
      "vi",
      now,
    ),
    null,
  );
  assert.equal(
    selectApprovedReply(
      [global, { ...global, id: "two" }],
      "CAMLY là gì?",
      -1001,
      "vi",
      now,
    ),
    null,
  );
});
Deno.test("followups, live data, links and personal wallet questions cannot reuse answers", () => {
  for (
    const q of [
      "tiếp đi cha",
      "hôm nay CAMLY ra sao",
      "my wallet balance",
      "CAMLY là gì\nở đây",
      "https://example.test/camly",
      "@user CAMLY là gì",
    ]
  ) assert.equal(isStandaloneLibraryQuestion(q), false);
});
Deno.test("media, replies, quoted context, tools, engagement and translation bypass curated library", () => {
  const context = {
    messageType: "text",
    hasReply: false,
    hasPhoto: false,
    hasQuotedContext: false,
    builderActive: false,
    toolRequest: false,
    automaticEngagement: false,
    translationRequest: false,
  };
  assert.equal(canUseApprovedLibrary(context), true);
  for (
    const key of [
      "hasReply",
      "hasPhoto",
      "hasQuotedContext",
      "builderActive",
      "toolRequest",
      "automaticEngagement",
      "translationRequest",
    ]
  ) assert.equal(canUseApprovedLibrary({ ...context, [key]: true }), false);
  for (
    const messageType of ["photo", "document", "forward", "caption", "preview"]
  ) assert.equal(canUseApprovedLibrary({ ...context, messageType }), false);
});

function fixture(
  data: ApprovedReply[] | null,
  error: { code: string } | null = null,
) {
  const reads: unknown[][] = [];
  const query = {
    select: (...v: unknown[]) => {
      reads.push(["select", ...v]);
      return query;
    },
    eq: (...v: unknown[]) => {
      reads.push(["eq", ...v]);
      return query;
    },
    contains: (...v: unknown[]) => {
      reads.push(["contains", ...v]);
      return query;
    },
    or: (...v: unknown[]) => {
      reads.push(["or", ...v]);
      return query;
    },
    gt: (...v: unknown[]) => {
      reads.push(["gt", ...v]);
      return query;
    },
    limit: (...v: unknown[]) => {
      reads.push(["limit", ...v]);
      return query;
    },
    abortSignal: (_signal: AbortSignal) => Promise.resolve({ data, error }),
  };
  return { reads, db: { from: () => query } as unknown as SupabaseClient };
}
Deno.test("lookup uses exact indexed keys, fresh scope, language and expiry on every request", async () => {
  const f = fixture([row({ expires_at: "2099-01-01T00:00:00Z" })]);
  assert.equal(
    (await findApprovedReply(f.db, "CAMLY là gì?", -1001, "vi"))?.id,
    "one",
  );
  assert.ok(
    f.reads.some((v) =>
      JSON.stringify(v) ===
        JSON.stringify(["contains", "match_keys", ["camly là gì"]])
    ),
  );
  assert.ok(
    f.reads.some((v) =>
      v[0] === "or" && v[1] === "group_id.is.null,group_id.eq.-1001"
    ),
  );
  assert.ok(f.reads.some((v) => v[0] === "gt" && v[1] === "expires_at"));
  const before = f.reads.length;
  await findApprovedReply(f.db, "CAMLY là gì?", -1001, "vi");
  assert.ok(f.reads.length > before);
});
Deno.test("database errors, ambiguous results and overfull retrieval fall through to normal AI", async () => {
  assert.equal(
    await findApprovedReply(
      fixture(null, { code: "42P01" }).db,
      "CAMLY là gì?",
      -1001,
      "vi",
    ),
    null,
  );
  assert.equal(
    await findApprovedReply(
      fixture(Array.from({ length: 20 }, () => row())).db,
      "CAMLY là gì?",
      -1001,
      "vi",
    ),
    null,
  );
  const f = fixture([]);
  assert.equal(await findApprovedReply(f.db, "tiếp đi cha", -1001, "vi"), null);
  assert.equal(f.reads.length, 0);
});
