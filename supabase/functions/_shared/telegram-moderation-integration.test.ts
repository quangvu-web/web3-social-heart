import assert from "npm:assert@2.1.0";
import { applyViolation, type CommunitySettings } from "./telegram-community.ts";

Deno.test("applyViolation retains actual delete failure and suppresses a replay via the durable RPC", async () => {
  const originalFetch = globalThis.fetch;
  const originalToken = Deno.env.get("COMMUNITY_GUARD_BOT_TOKEN");
  Deno.env.set("COMMUNITY_GUARD_BOT_TOKEN", "fixture-only");
  try {
    for (const fixture of [
      { body: { ok: false, error_code: 400, description: "Bad Request: not enough rights to delete messages" }, failure: "permission_denied" },
      { body: { ok: false, error_code: 400, description: "Bad Request: message can't be deleted" }, failure: "message_not_deletable" },
      { body: null, failure: "invalid_response" },
      { body: null, failure: "transport_error", network: true },
    ]) {
      const logs: Array<{ action: string; reason: string; message_id: number }> = [];
      let sends = 0;
      let claimed = false;
      const client = {
        from: (table: string) => {
          if (table === "telegram_community_settings") return {
            select: () => ({ eq: (_key: string, groupId: number) => {
              assert.strictEqual(groupId, -1001);
              return { maybeSingle: async () => ({ data: { moderation_failure_notice_enabled: true }, error: null }) };
            } }),
          };
          if (table === "telegram_community_user_state") return {
            upsert: () => ({ select: () => ({ single: async () => ({ data: { warning_count: 0 }, error: null }) }) }),
          };
          assert.strictEqual(table, "telegram_community_moderation_logs");
          return { insert: async (row: typeof logs[number]) => { logs.push(row); return { error: null }; } };
        },
        rpc: async (name: string, args: Record<string, number>) => {
          assert.strictEqual(name, "tg_claim_moderation_failure_notice");
          assert.deepStrictEqual(args, { p_group_id: -1001, p_message_id: 9 });
          const decision = claimed ? "duplicate" : "claimed";
          claimed = true;
          return { data: decision, error: null };
        },
      };
      globalThis.fetch = async (input) => {
        const method = String(input).split("/").at(-1);
        if (method === "deleteMessage") {
          if (fixture.network) throw new TypeError("synthetic network failure");
          return fixture.body ? Response.json(fixture.body, { status: 400 }) : new Response("invalid json");
        }
        assert.strictEqual(method, "sendMessage", "all external calls are intercepted");
        sends++;
        return Response.json({ ok: true, result: { message_id: 99 } });
      };
      const params = {
        adminClient: client as unknown as Parameters<typeof applyViolation>[0]["adminClient"],
        settings: {} as CommunitySettings,
        chatId: -1001, messageId: 9, user: { id: 77 },
        reason: "SCAM_PROMOTION:fixture", messageText: "synthetic fixture", countWarning: false,
      };
      await applyViolation(params);
      await applyViolation(params);
      const outcomes = logs.filter(row => row.action === "delete_failed");
      assert.strictEqual(outcomes.length, 2, "each failed attempt stays visible to admins");
      assert.ok(outcomes.every(row => row.reason.startsWith("SCAM_PROMOTION:fixture;") && row.reason.endsWith(fixture.failure)));
      assert.strictEqual(sends, 1, "replay never resends full failure notice");
      assert.ok(logs.some(row => row.action === "moderation_notice_suppressed" && row.reason === "duplicate"));
    }
  } finally {
    globalThis.fetch = originalFetch;
    if (originalToken === undefined) Deno.env.delete("COMMUNITY_GUARD_BOT_TOKEN");
    else Deno.env.set("COMMUNITY_GUARD_BOT_TOKEN", originalToken);
  }
});
