import assert from "npm:assert@2.1.0";
import { callAngelCore } from "./angel-core.ts";
import { resolveGroupReplyLanguage } from "./telegram-community.ts";

Deno.test("FUN Core mirror carries only an explicitly trusted group language policy without changing the RAG question", async () => {
  const originalFetch = globalThis.fetch;
  const key = "ANGEL_AI_CHAT_URL";
  const previous = Deno.env.get(key);
  let sent: Record<string, unknown> = {};
  try {
    Deno.env.set(key, "https://fixture.invalid/functions/v1/angel-chat");
    globalThis.fetch = async (input, init) => {
      const req = new Request(input, init);
      assert.strictEqual(new URL(req.url).origin, "https://fixture.invalid");
      sent = await req.json();
      return Response.json({ response: "Fixture answer" });
    };
    for (const strictMirror of [true, false]) {
      for (const [question, language] of [
        ["Hôm nay thực hành lòng biết ơn thế nào?", "en"],
        ["How can I practice gratitude today?", "vi"],
        ["Translate to Vietnamese: I am grateful", "en"],
        ["Translate to English: Tôi biết ơn", "vi"],
      ]) {
        const policy = resolveGroupReplyLanguage(question, language).policyNote!;
        await callAngelCore({
          forceProvider: "funcore", strictMirror,
          trustedGroupLanguagePolicy: policy,
          messages: [{ role: "system", content: "Unrelated persona" }, { role: "user", content: question }],
        });
        assert.deepStrictEqual(sent.messages, [
          { role: "system", content: policy },
          { role: "user", content: question },
        ]);
        assert.strictEqual(sent.useKnowledge, true);
      }
    }
    // DM/auto keep the original mirror transport, including stripping arbitrary systems.
    await callAngelCore({ forceProvider: "funcore", strictMirror: true,
      messages: [{ role: "system", content: "Persona" }, { role: "assistant", content: "Old reply" }, { role: "user", content: "Original question" }],
    });
    assert.deepStrictEqual(sent.messages, [{ role: "user", content: "Original question" }]);
  } finally {
    globalThis.fetch = originalFetch;
    previous === undefined ? Deno.env.delete(key) : Deno.env.set(key, previous);
  }
});
