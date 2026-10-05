import assert from "npm:assert@2.1.0";
import type { CommunitySettings, TelegramMessage } from "./telegram-community.ts";

Deno.test("group handler passes reply relationships to AI without widening triggers", async () => {
  const originalGet = Deno.env.get;
  const originalFetch = globalThis.fetch;
  const originalServe = Deno.serve;
  const originalLog = console.log;
  const env: Record<string, string> = { SUPABASE_URL: "https://db.fixture.invalid", SUPABASE_ANON_KEY: "fixture-only", SUPABASE_SERVICE_ROLE_KEY: "fixture-only", COMMUNITY_GUARD_BOT_TOKEN: "fixture-only", ANGEL_AI_CHAT_URL: "https://ai.fixture.invalid/angel-chat", ANGEL_AI_API_KEY: "fixture-only", LOVABLE_API_KEY: "fixture-only" };
  Deno.env.get = (name) => env[name];
  Deno.serve = (() => ({})) as unknown as typeof Deno.serve;
  console.log = () => {};
  let eventReads = 0;
  let failAi = false;
  let recoveryMode = "none";
  const sent: string[] = [];
  const aiInputs: string[] = [];
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
    if (url.hostname === "ai.gateway.lovable.dev") {
      aiInputs.push(JSON.stringify(body.messages));
      return Response.json({ choices: [{ message: { content: "Bé Ly đang mời bé Thu Trang chia sẻ góc nhìn. Angel góp lời với vai trò người quan sát." } }] });
    }
    if (url.hostname === "ai.fixture.invalid") {
      aiInputs.push(JSON.stringify(body.messages));
      if (recoveryMode === "empty_once") { recoveryMode = "none"; return Response.json({ text: "" }); }
      if (recoveryMode === "transient_once") { recoveryMode = "none"; return Response.json({ error: "fixture transient" }, { status: 503 }); }
      if (recoveryMode === "gateway") return Response.json({ error: "fixture funcore unavailable" }, { status: 503 });
      if (failAi) return Response.json({ error: "fixture provider unavailable" }, { status: 402 });
      return Response.json({ text: "Bé Ly đang mời bé Thu Trang chia sẻ góc nhìn trong việc phân tích credit. Angel chỉ góp lời quan sát cuộc trao đổi." });
    }
    assert.equal(url.hostname, "db.fixture.invalid", "no real network request is allowed");
    if (url.pathname.endsWith("/telegram_event_messages")) {
      eventReads++;
      return Response.json([]);
    }
    if (url.pathname.endsWith("/telegram_ai_conversations") && url.searchParams.get("select") === "user_message,bot_reply,error,created_at") return Response.json([{ user_message: "Bé có tâm gì, trong việc này?", bot_reply: "Angel nghĩ bé Other đang có một ý định khác trong việc này.", error: null, created_at: new Date().toISOString() }]);
    if (url.pathname.endsWith("/angel_feature_flags")) return Response.json([{ enabled: ["eq.router.strict_mirror", "eq.router.stale_fallback_on_error"].includes(url.searchParams.get("key") ?? ""), meta: {} }]);
    if (init?.method === "HEAD") return new Response(null, { headers: { "content-range": "*/0" } });
    if (init?.method && !["GET", "HEAD"].includes(init.method)) return new Response(null, { status: 204 });
    return Response.json([]);
  };
  try {
    const { handleGroupAiMention } = await import("../telegram-community-webhook/index.ts");
    const message: TelegramMessage = { message_id: 81, chat: { id: -1003431575368, type: "supergroup" }, from: { id: 10, first_name: "Ly", username: "Camly_Duong" }, text: "Bé có tâm gì, trong việc này?", reply_to_message: { message_id: 80, from: { id: 20, first_name: "Thu Trang", username: "fixture_trang" }, text: "Phân tích mức tiêu hao credit." } };
    const settings = { ai_enabled: true, always_reply_admins: true, always_reply_on_mention: true, always_reply_on_reply_to_bot: true, help_intent_ai_enabled: false, positive_engagement_enabled: false, event_followup_enabled: true, ai_system_prompt: "", ai_style_prompt: "Rewrite warmly but keep speakers." } as CommunitySettings;
    await handleGroupAiMention(message, settings);
    const inputs = aiInputs.map(input => JSON.parse(input) as Array<{ role: string; content: string }>);
    const composed = inputs.find(messages => messages.some(m => m.content.includes("TELEGRAM_GROUP_CONTEXT_JSON")));
    assert.ok(composed, "actual askAngel payload must retain reply metadata");
    const context = JSON.parse(composed!.find(m => m.content.includes("TELEGRAM_GROUP_CONTEXT_JSON"))!.content.split("TELEGRAM_GROUP_CONTEXT_JSON\n")[1]);
    assert.equal(context.current_sender.username, "Camly_Duong");
    assert.equal(context.reply_author.display_name, "Thu Trang");
    assert.equal(context.recipient.target, "reply_author");
    assert.equal(context.angel_role, "observer");
    assert.ok(composed!.some(m => m.content.includes("never answer on that person's behalf")));
    assert.equal(context.new_message.text, message.text);
    assert.equal(context.response_task, message.text);
    assert.ok(!JSON.stringify(composed).includes("mentioning Angel"));
    assert.ok(inputs.every(messages => messages.some(m => m.content.includes("TELEGRAM_GROUP_CONTEXT_JSON"))), "secondary generation must not discard speaker relations");
    assert.equal(eventReads, 0);
    const before = sent.length;
    await handleGroupAiMention({ ...message, message_id: 82 }, { ...settings, always_reply_admins: false });
    assert.equal(sent.length, before, "member reply does not add a reply trigger");
    aiInputs.length = 0;
    await handleGroupAiMention({ ...message, message_id: 83, text: "Bé là ai?", reply_to_message: { message_id: 79, from: { id: 7, is_bot: true }, text: "Angel ở đây." } }, settings);
    const factualPayload = aiInputs.map(input => JSON.parse(input)).find(messages => messages.some((m: {content: string}) => m.content.includes("TELEGRAM_GROUP_CONTEXT_JSON")));
    assert.ok(factualPayload, "factual mirror must not drop structured context");
    const botContext = JSON.parse(factualPayload.find((m: {content: string}) => m.content.includes("TELEGRAM_GROUP_CONTEXT_JSON")).content.split("TELEGRAM_GROUP_CONTEXT_JSON\n")[1]);
    assert.equal(botContext.recipient.target, "angel");
    for (const [index, mode] of ["empty_once", "transient_once", "gateway"].entries()) {
      aiInputs.length = 0;
      recoveryMode = mode;
      await handleGroupAiMention({ ...message, message_id: 90 + index }, { ...settings, ai_style_prompt: "" } as CommunitySettings);
      assert.ok(aiInputs.length >= 2, `must exercise ${mode} recovery`);
      assert.ok(aiInputs.every(input => JSON.parse(input).some((m: {content: string}) => m.content.includes("TELEGRAM_GROUP_CONTEXT_JSON"))), `${mode} recovery retains relationships`);
    }
    recoveryMode = "none";
    failAi = true;
    await handleGroupAiMention({ ...message, message_id: 84 }, settings);
    assert.ok(!sent.at(-1)?.includes("bé Other"), "provider failure must not reuse reply about another member");
  } finally { Deno.env.get = originalGet; globalThis.fetch = originalFetch; Deno.serve = originalServe; console.log = originalLog; }
});
