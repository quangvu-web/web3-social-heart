import assert from "npm:assert";
import { handleDiscussionComment } from "./angel-discussion-comment.ts";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

Deno.test("discussion replies use actual member username and channel forwards use default", async () => {
  const originalGet = Deno.env.get;
  const originalFetch = globalThis.fetch;
  Deno.env.get = (name: string) => ({ SUPABASE_URL: "https://fixture.invalid", SUPABASE_SERVICE_ROLE_KEY: "fixture-only" } as Record<string, string>)[name];
  globalThis.fetch = async () => Response.json({ enabled: true, meta: { channel_ids: [-9] } });
  const query = { select() { return this; }, eq() { return this; }, order() { return this; }, limit() { return Promise.resolve({ data: [] }); }, insert() { return Promise.resolve({ error: null }); } };
  const admin = { from() { return query; } } as unknown as SupabaseClient;
  const post = { message_id: 1, text: "Thông điệp nguyên văn về niềm vui và sự biết ơn trong cuộc sống hàng ngày của mỗi người.", chat: { id: -42 }, is_automatic_forward: true, sender_chat: { id: -9, type: "channel", username: "Camly_Duong" }, from: { id: 9, username: "Camly_Duong", is_bot: true } };
  try {
    for (const [message, expected] of [[{ message_id: 2, text: "Ý nghĩa là gì?", chat: { id: -42 }, from: { id: 42, username: "@CAMLY_DUONG", first_name: "unrelated" }, reply_to_message: post }, "@CAMLY_DUONG"], [post, null]] as const) {
      let context: Record<string, unknown> = {};
      const handled = await handleDiscussionComment(admin, message, { settings: {}, askAngel(params) { context = params.conversationContext as Record<string, unknown>; return Promise.resolve("Angel chia sẻ một góc nhìn ấm áp và ý nghĩa."); }, sendMessage() { return Promise.resolve({ ok: true }); } });
      assert.equal(handled, true);
      assert.equal(context.username ?? null, expected);
    }
  } finally { Deno.env.get = originalGet; globalThis.fetch = originalFetch; }
});
