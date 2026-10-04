import assert from "npm:assert";
import { askAngel } from "./telegram-community.ts";

Deno.test("askAngel applies sender addressing to DM/group/follow-up, preview, image and fallback", async () => {
  const originalGet = Deno.env.get;
  const originalFetch = globalThis.fetch;
  const requests: Array<Record<string, unknown>> = [];
  let fail = false;
  let fixtureReply = 'Mình sẽ chia sẻ với bé. “Tôi chào bạn.”';
  Deno.env.get = (name: string) => ({ ANGEL_AI_BASE_URL: "https://fixture.invalid", ANGEL_AI_API_KEY: "fixture-only" } as Record<string, string>)[name];
  globalThis.fetch = async (_input, init) => {
    requests.push(JSON.parse(String(init?.body ?? "{}")));
    return fail ? new Response("fixture unavailable", { status: 503 }) : Response.json({ text: fixtureReply });
  };
  try {
    for (const triggerSource of ["dm", "group_mention", "event_followup", "meditation_reply"]) {
      const reply = await askAngel({ question: "xin chia sẻ điều tốt đẹp", forcedLangBucket: "vi", systemPrompt: "", conversationContext: { chatId: -42, chatType: triggerSource === "dm" ? "private" : "supergroup", userId: 42, username: "@CAMLY_DUONG", triggerSource } });
      assert.ok(reply.includes("Angel sẽ chia sẻ với bé Ly"), reply);
      assert.ok(reply.includes('“Tôi chào bạn.”'), reply);
    }
    const preview = await askAngel({ question: "xin chia sẻ điều tốt đẹp", systemPrompt: "", forcedLangBucket: "vi", userLabel: "Camly_Duong", addressRuleOverride: "Gọi người gửi là Cha, tự xưng mình" });
    assert.ok(preview.includes("Angel sẽ chia sẻ với bé."), preview);
    assert.ok(!preview.includes("bé Ly"), preview);
    fixtureReply = "Angel cảm ơn bé Ly đã chia sẻ.";
    for (const context of [{ chatId: 101, chatType: "private", username: "ordinary", userId: 101, triggerSource: "dm" }, { chatId: -101, chatType: "supergroup", triggerSource: "broadcast" }]) {
      const ordinary = await askAngel({ question: "Tên hiển thị Camly_Duong; nhắc @Camly_Duong", userLabel: "Camly_Duong", forcedLangBucket: "vi", systemPrompt: "", conversationContext: context });
      assert.equal(ordinary, "Angel cảm ơn bé đã chia sẻ.");
    }
    for (const [raw, expected] of [["> Mình sẽ giúp bạn.", "&gt; Mình sẽ giúp bạn."], ["<blockquote>Tôi sẽ giúp bạn.</blockquote>", "&lt;blockquote&gt;Tôi sẽ giúp bạn.&lt;/blockquote&gt;"]]) {
      fixtureReply = raw;
      const quote = await askAngel({ question: "xin chia sẻ điều tốt đẹp", systemPrompt: "", forcedLangBucket: "vi", conversationContext: { chatId: -105, chatType: "supergroup", username: "Camly_Duong", triggerSource: "group_mention" } });
      assert.equal(quote, expected);
    }
    const image = await askAngel({ question: "vẽ một bông hoa", systemPrompt: "", forcedLangBucket: "vi", outImage: {}, conversationContext: { chatId: -99, chatType: "supergroup", username: "Camly_Duong", userId: 52, triggerSource: "group_mention" } });
    assert.ok(image.includes("Bé Ly ơi"), image);
    fail = true;
    const fallback = await askAngel({ question: "xin giúp giải thích một điều mới", systemPrompt: "", forcedLangBucket: "vi", conversationContext: { chatId: 123, chatType: "private", username: "Camly_Duong", userId: 123, triggerSource: "dm" } });
    assert.ok(fallback.includes("bé Ly") || fallback.includes("Bé Ly"), fallback);
    assert.ok(requests.length > 0);
  } finally {
    Deno.env.get = originalGet;
    globalThis.fetch = originalFetch;
  }
});
Deno.test("Vietnamese language lock requires Angel self-address", async () => {
  const { angelLanguageDirective } = await import("./telegram-community.ts");
  assert.ok(angelLanguageDirective("vi").includes('tự xưng "Angel"'));
  assert.ok(!angelLanguageDirective("vi").includes('tự xưng "mình"'));
});
