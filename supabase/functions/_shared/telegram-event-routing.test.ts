import assert from "npm:assert@2.1.0";
import type { CommunitySettings, TelegramMessage } from "./telegram-community.ts";

Deno.test("ordinary admin post continues to content AI, stores no event, and retains permission guards", async () => {
  const originalGet = Deno.env.get;
  const originalFetch = globalThis.fetch;
  const originalServe = Deno.serve;
  const originalLog = console.log;
  const env: Record<string, string> = { SUPABASE_URL: "https://db.fixture.invalid", SUPABASE_ANON_KEY: "fixture-only", SUPABASE_SERVICE_ROLE_KEY: "fixture-only", COMMUNITY_GUARD_BOT_TOKEN: "fixture-only", ANGEL_AI_CHAT_URL: "https://ai.fixture.invalid/angel-chat", ANGEL_AI_API_KEY: "fixture-only" };
  Deno.env.get = (name) => env[name];
  Deno.serve = (() => ({})) as unknown as typeof Deno.serve;
  const safeLogs: unknown[][] = [];
  console.log = (...args: unknown[]) => { if (String(args[0]).startsWith("[EVENT_")) safeLogs.push(args); };
  let eventWrites = 0, eventReads = 0, aiCalls = 0;
  const sent: string[] = [];
  const aiInputs: string[] = [];
  let storedEvent: Record<string, unknown> = { chat_id: -1002974118000, message_id: 1, status: "active", raw_text: "Join via Zoom", created_at: new Date().toISOString(), zoom_link: null, zoom_id: null };
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    const body = JSON.parse(String(init?.body ?? "{}"));
    if (url.hostname === "api.telegram.org") {
      const method = url.pathname.split("/").at(-1);
      if (method === "getMe") return Response.json({ ok: true, result: { id: 7, username: "fixture_bot" } });
      if (method === "getChatMember") return Response.json({ ok: true, result: { status: "administrator" } });
      if (method === "sendChatAction") return Response.json({ ok: true, result: true });
      if (method === "sendMessage") { sent.push(body.text); return Response.json({ ok: true, result: { message_id: 900 } }); }
      throw new Error("unexpected Telegram method in fixture");
    }
    if (url.hostname === "ai.fixture.invalid") {
      aiCalls++; aiInputs.push(JSON.stringify(body.messages));
      return Response.json({ text: "Richard's introduction highlights learning, service and community connection." });
    }
    assert.equal(url.hostname, "db.fixture.invalid", "no real network request is allowed");
    if (url.pathname.endsWith("/telegram_event_messages")) {
      if (init?.method && init.method !== "GET") eventWrites++; else eventReads++;
      // Simulate a weak legacy active record: it must never hijack this article.
      return Response.json([storedEvent]);
    }
    if (url.pathname.endsWith("/angel_feature_flags")) return Response.json([{ enabled: false, meta: {} }]);
    if (init?.method === "HEAD") return new Response(null, { headers: { "content-range": "*/0" } });
    if (init?.method && !["GET", "HEAD"].includes(init.method)) return new Response(null, { status: 204 });
    return Response.json([]);
  };
  try {
    const { handleEventAssistant, handleGroupAiMention } = await import("../telegram-community-webhook/index.ts");
    const text = "Welcome Richard E. Warren, a community speaker sharing learning and service. Meet Richard via Zoom; register/join our community to explore his work.";
    const message: TelegramMessage = { message_id: 8, chat: { id: -1002974118000, type: "supergroup" }, from: { id: 10, is_bot: false, first_name: "Fixture" }, text };
    const settings = { ai_enabled: true, always_reply_admins: true, always_reply_on_mention: false, always_reply_on_reply_to_bot: false, help_intent_ai_enabled: false, positive_engagement_enabled: false, event_assistant_enabled: true, event_followup_enabled: true, ai_system_prompt: "" } as CommunitySettings;
    assert.equal(await handleEventAssistant(message, settings), false);
    await handleGroupAiMention(message, settings);
    const otherGroup = { ...message, message_id: 10, chat: { id: -1001649798056, type: "supergroup" } };
    assert.equal(await handleEventAssistant(otherGroup, settings), false);
    await handleGroupAiMention(otherGroup, settings);
    assert.equal(eventWrites, 0);
    assert.equal(eventReads, 0);
    assert.ok(aiCalls > 0);
    assert.ok(aiInputs.some(input => input.includes("Richard E. Warren")));
    assert.ok(sent.some(text => text.includes("Richard's introduction")));
    assert.ok(sent.every(text => !text.includes("does not see a Zoom link or ID")));
    assert.ok(safeLogs.length > 0);
    assert.ok(!JSON.stringify(safeLogs).includes("Richard"));
    storedEvent = { ...storedEvent, raw_text: "Workshop: join via Zoom\nTopic: Learning\nTime: 19:00 MYT\nDate: 05/10/2026" };
    const explicit = { ...message, message_id: 11, text: "Do we have a Zoom link?", reply_to_message: { ...message, message_id: 1 } };
    const aiBefore = aiCalls;
    await handleGroupAiMention(explicit, settings);
    assert.equal(sent.at(-1), "Angel does not see a Zoom link or ID in this announcement yet.", "honest missing-detail reply is valid for a real event and explicit request");
    assert.equal(aiCalls, aiBefore, "clear event follow-up should use its intended route");
    const before = sent.length;
    await handleGroupAiMention({ ...message, message_id: 9 }, { ...settings, always_reply_admins: false });
    assert.equal(sent.length, before, "fix must not broaden bot reply permission");
  } finally { Deno.env.get = originalGet; globalThis.fetch = originalFetch; Deno.serve = originalServe; console.log = originalLog; }
});
