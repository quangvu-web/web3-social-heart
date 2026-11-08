import assert from "npm:assert@2.1.0";
import { candidateDraft, candidateDraftId, candidateFlagKey, canCollectReplyCandidate, type CandidateSource } from "./reply-candidates-policy.ts";
import { collectReplyCandidate, saveReplyCandidate, type CandidateDatabase } from "./reply-candidates.ts";

const source = (patch: Partial<CandidateSource> = {}): CandidateSource => ({
  id: "12345678-1234-4234-8234-123456789012", group_id: -1001, chat_type: "supergroup", source: "telegram",
  provider: "funcore", error: null, reply_message_id: null, trigger_source: "group_ai:help_intent",
  user_message: "Lòng biết ơn là gì?", language: "vi",
  bot_reply: "<b>Lòng biết ơn</b> là sự ghi nhận những điều tốt đẹp đã nhận được. Bé có thể thực hành bằng cách trân trọng sự giúp đỡ và nói lời cảm ơn chân thành.",
  ...patch,
});

function fixture() {
  let enabled: boolean | null = true;
  let fail = "";
  let ambiguousRead = false;
  const records = new Map<string, Record<string, unknown>>();
  const writes: Record<string, unknown>[] = [];
  const operations: string[] = [];
  const db: CandidateDatabase = { from(table) {
    let payload: Record<string, unknown> | null = null;
    const filters: Record<string, unknown> = {};
    const q: any = {
      select() { return q; }, eq(k: string, v: unknown) { filters[k] = v; return q; },
      contains(k: string, v: unknown) { filters[k] = v; return q; }, limit() { return q; },
      abortSignal(signal: AbortSignal) { assert.ok(signal instanceof AbortSignal); return q; },
      insert(p: Record<string, unknown>) { payload = p; return q; },
      then(resolve: (v: unknown) => void) { resolve(result()); },
      async maybeSingle() { return result(); },
    };
    function result() {
      operations.push(table + (payload ? ":insert" : ":read"));
      if (fail === table) return { data: null, error: { code: "offline" } };
      if (table === "angel_feature_flags") {
        assert.equal(filters.key, candidateFlagKey(-1001));
        return { data: enabled === null ? null : { enabled }, error: null };
      }
      if (payload) {
        writes.push(payload);
        if (records.has(String(payload.id))) return { error: { code: "23505" } };
        records.set(String(payload.id), structuredClone(payload)); return { error: null };
      }
      if (ambiguousRead) return { data: [], error: null }; // simultaneous readers both miss
      return { data: [...records.values()].filter(r => r.group_id === filters.group_id && r.language === filters.language).map(r => ({ id: r.id })), error: null };
    }
    return q;
  }};
  return { db, writes, records, operations, enable: (v: boolean | null) => enabled = v, fail: (v: string) => fail = v, race: () => ambiguousRead = true };
}

Deno.test("candidate drafts remain scoped, expire, preserve source and strip only known markup", () => {
  const route = { standalone: true, forwarded: false, illustrated: false, hasAttachment: false, hasImageContext: false };
  assert.equal(canCollectReplyCandidate(route), true);
  for (const key of ["forwarded", "illustrated", "hasAttachment", "hasImageContext"] as const) assert.equal(canCollectReplyCandidate({ ...route, [key]: true }), false);
  assert.equal(canCollectReplyCandidate({ ...route, standalone: false }), false);
  const draft = candidateDraft(source(), 0)!;
  assert.equal(draft.status, "draft"); assert.equal(draft.group_id, -1001);
  assert.equal(draft.expires_at, "1970-01-31T00:00:00.000Z");
  assert.equal(draft.source_conversation_id, source().id);
  assert.deepEqual(draft.aliases, []); assert.ok(!draft.answer.includes("<b>"));
});

Deno.test("DM, reply context, errors, fallback providers, language mismatch and transient/private content are excluded", () => {
  for (const patch of [
    { chat_type: "private" }, { source: "web_chat" }, { group_id: 1001 }, { reply_message_id: 12 },
    { provider: "lovable" }, { provider: "stale" }, { error: "recovered retry" },
    { trigger_source: "group_ai:positive_community" }, { trigger_source: "dm" }, { language: "en" }, { language: null },
    { user_message: "Tiếp tục đi Angel" }, { user_message: "Số dư ví của bé là bao nhiêu?" },
    { bot_reply: source().bot_reply + " Liên hệ hello@example.test" },
    { bot_reply: source().bot_reply + " https://example.test" },
    { bot_reply: source().bot_reply + " OTP 1234567890" },
    { bot_reply: source().bot_reply + " FAQ-TEST-01" },
    { bot_reply: source().bot_reply + " Trong ảnh có nội dung quan trọng." },
    { bot_reply: source().bot_reply + " Angel đang bận, thử lại sau." },
    { bot_reply: "<a href='https://example.test'>" + source().bot_reply + "</a>" },
    { bot_reply: source().bot_reply + " Chào Minh An!", full_name: "Minh An" },
    { bot_reply: "a".repeat(3501) },
  ] satisfies Partial<CandidateSource>[]) assert.equal(candidateDraft(source(patch)), null, JSON.stringify(patch));
});

Deno.test("candidate identity deduplicates normalized questions without crossing scope/language/negation", async () => {
  const id = await candidateDraftId(-1001, "vi", "  LÒNG biết ơn là gì?!");
  assert.equal(id, await candidateDraftId(-1001, "vi", "Lòng biết ơn là gì"));
  for (const [g, l, q] of [[-1002, "vi", "Lòng biết ơn là gì"], [-1001, "en", "Lòng biết ơn là gì"], [-1001, "vi", "Lòng biết ơn không là gì"]] as const)
    assert.notEqual(id, await candidateDraftId(g, l, q));
});

Deno.test("live capture fails closed for absent/disabled/unreadable group settings", async () => {
  for (const state of [false, null]) {
    const f = fixture(); f.enable(state); await collectReplyCandidate(f.db, source()); assert.equal(f.writes.length, 0);
  }
  const f = fixture(); f.fail("angel_feature_flags"); await collectReplyCandidate(f.db, source()); assert.equal(f.writes.length, 0);
});

Deno.test("rescan and concurrent live capture never overwrite reviewed, edited or revoked drafts", async () => {
  const f = fixture(); f.race();
  assert.equal(await saveReplyCandidate(f.db, source()), "created");
  const original = [...f.records.values()][0]; original.status = "revoked"; original.answer = "Nội dung được người duyệt sửa.";
  assert.equal(await saveReplyCandidate(f.db, source({ bot_reply: source().bot_reply + " Câu mới." })), "skipped");
  assert.equal(f.records.size, 1); assert.equal(original.status, "revoked"); assert.equal(original.answer, "Nội dung được người duyệt sửa.");
  assert.ok(f.writes.every(p => p.status === "draft" && !p.approved_by && !p.approved_at));
});

Deno.test("existing aliases skip creation and database outages do not escape the live logger", async () => {
  const f = fixture(); await collectReplyCandidate(f.db, source()); await collectReplyCandidate(f.db, source());
  assert.equal(f.writes.length, 1);
  const broken = fixture(); broken.fail("telegram_approved_replies");
  await collectReplyCandidate(broken.db, source()); assert.equal(broken.writes.length, 0);
  await assert.rejects(() => saveReplyCandidate(broken.db, source()), /candidate_lookup_unavailable/);
});

Deno.test({ name: "real conversation logger only collects explicitly eligible, successfully persisted group logs", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  const originalGet = Deno.env.get;
  const originalInterval = globalThis.setInterval;
  const timers: ReturnType<typeof setInterval>[] = [];
  Deno.env.get = () => undefined;
  globalThis.setInterval = ((...args: Parameters<typeof setInterval>) => {
    const timer = originalInterval(...args); timers.push(timer); return timer;
  }) as typeof setInterval;
  try {
    const { logAngelConversation } = await import("./telegram-community.ts");
    const f = fixture();
    const conversations: Record<string, unknown>[] = [];
    let failed = false;
    const db = { from(table: string) {
      if (table !== "telegram_ai_conversations") return f.db.from(table as "angel_feature_flags");
      return { insert: (row: Record<string, unknown>) => {
        conversations.push(row); return Promise.resolve({ error: failed ? { message: "fixture log unavailable" } : null });
      } };
    } } as unknown as Parameters<typeof logAngelConversation>[0];
    const ctx = { chatId: -1001, groupId: -1001, chatType: "supergroup", triggerSource: "group_ai:help_intent" };
    const data = { userMessage: source().user_message, botReply: source().bot_reply, provider: "funcore", language: "vi" };
    await logAngelConversation(db, ctx, data);
    assert.equal(f.writes.length, 0); assert.equal(conversations[0].id, undefined);
    failed = true;
    await logAngelConversation(db, { ...ctx, libraryCandidateAllowed: true }, data);
    assert.equal(f.writes.length, 0);
    failed = false;
    await logAngelConversation(db, { ...ctx, libraryCandidateAllowed: true }, data);
    assert.equal(f.writes.length, 1);
    assert.equal(f.writes[0].source_conversation_id, conversations[2].id);
    assert.equal(conversations[2].libraryCandidateAllowed, undefined, "internal opt-in is not a database column");
  } finally {
    timers.forEach(clearInterval); globalThis.setInterval = originalInterval; Deno.env.get = originalGet;
  }
} });
