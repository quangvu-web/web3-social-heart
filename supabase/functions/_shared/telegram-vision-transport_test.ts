import assert from "node:assert/strict";
import { askAngel, buildImageAnalysisContext } from "./telegram-community.ts";

Deno.test("DM image grounding survives provider recovery and strict-mirror anti-repeat", async () => {
  const originalGet = Deno.env.get;
  const originalFetch = globalThis.fetch;
  const context = buildImageAnalysisContext(
    "FUN Profile — Hẹn gặp lúc 19:00 MYT.",
    "Soạn lời hồi đáp",
  );
  const reply =
    "Angel thấy lời mời FUN Profile hẹn gặp lúc 19:00 MYT trong ảnh, bé có thể trả lời xác nhận tham gia nhé.";
  const inputs: Array<Array<{ role: string; content: string }>> = [];
  let fail = false;
  let duplicate = false;
  const admin = {
    from() {
      let columns = "";
      const chain: Record<string, unknown> = {};
      for (
        const method of [
          "eq",
          "gte",
          "gt",
          "order",
          "limit",
          "insert",
          "update",
          "upsert",
        ]
      ) chain[method] = () => chain;
      chain.select = (value: string) => {
        columns = value;
        return chain;
      };
      chain.maybeSingle = chain.single = () =>
        Promise.resolve({ data: null, error: null });
      chain.then = (resolve: (result: unknown) => unknown) =>
        resolve({
          data: duplicate && columns === "bot_reply"
            ? [{ bot_reply: reply }]
            : [],
          error: null,
        });
      return chain;
    },
  };
  Deno.env.get = (name) =>
    ({
      ANGEL_AI_CHAT_URL: "https://ai.fixture.invalid/angel-chat",
      ANGEL_AI_API_KEY: "fixture",
      LOVABLE_API_KEY: "fixture",
    } as Record<string, string>)[name];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    assert.ok(
      ["ai.fixture.invalid", "ai.gateway.lovable.dev"].includes(url.hostname),
      "fixture only",
    );
    const body = JSON.parse(String(init?.body ?? "{}"));
    inputs.push(body.messages);
    if (fail) {
      return Response.json({ error: "temporary fixture failure" }, {
        status: 503,
      });
    }
    return url.hostname === "ai.gateway.lovable.dev"
      ? Response.json({ choices: [{ message: { content: reply } }] })
      : Response.json({ text: reply });
  };
  try {
    const params = {
      question: context,
      originalUserMessage: "Soạn lời hồi đáp",
      imageAnalysisContext: context,
      systemPrompt: "",
      forcedLangBucket: "vi" as const,
      adminClient: admin as never,
      conversationContext: {
        chatId: 123,
        userId: 123,
        chatType: "private",
        triggerSource: "dm",
      },
    };
    await askAngel(params);
    assert.ok(inputs.length >= 1);
    assert.ok(
      inputs.every((messages) =>
        messages.some((m) =>
          m.role === "user" && m.content.includes("19:00 MYT")
        )
      ),
    );
    inputs.length = 0;
    fail = true;
    await askAngel(params);
    assert.ok(inputs.length >= 2, "must exercise recovery requests");
    assert.ok(
      inputs.every((messages) =>
        messages.some((m) =>
          m.role === "user" && m.content.includes("19:00 MYT")
        )
      ),
      "all recovery requests retain image",
    );
    inputs.length = 0;
    fail = false;
    duplicate = true;
    await askAngel(params);
    const retry = inputs.find((messages) =>
      messages.some((m) => m.content.includes("ANTI-REPEAT RULE"))
    );
    assert.ok(retry, "must exercise anti-repeat");
    assert.ok(
      retry!.at(-1)!.content.includes("19:00 MYT"),
      "strict mirror last user includes both image and anti-repeat rule",
    );
  } finally {
    Deno.env.get = originalGet;
    globalThis.fetch = originalFetch;
  }
});
