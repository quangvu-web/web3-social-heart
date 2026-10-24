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

Deno.test("group image context retains replied speaker and English policy through strict mirror", async () => {
  const { buildTelegramGroupContext } = await import(
    "./telegram-group-context.ts"
  );
  const { resolveGroupReplyLanguage } = await import("./telegram-community.ts");
  const originalGet = Deno.env.get;
  const originalFetch = globalThis.fetch;
  const inputs: Array<Array<{ role: string; content: string }>> = [];
  const question = "Ảnh này có chữ gì?";
  const context = buildImageAnalysisContext(
    "FUN Profile. Hẹn gặp lúc 19:00 MYT.",
    question,
  );
  const message = {
    message_id: 101,
    chat: { id: -1001, type: "supergroup" },
    from: { id: 42, first_name: "Requester" },
    text: question,
    reply_to_message: {
      message_id: 100,
      chat: { id: -1001, type: "supergroup" },
      from: { id: 55, first_name: "Other", is_bot: false },
      photo: [{
        file_id: "image",
        file_unique_id: "image",
        width: 100,
        height: 100,
      }],
    },
  };
  Deno.env.get = (name) =>
    ({
      ANGEL_AI_CHAT_URL: "https://ai.fixture.invalid/angel-chat",
      ANGEL_AI_API_KEY: "fixture",
    } as Record<string, string>)[name];
  globalThis.fetch = async (input, init) => {
    assert.equal(new URL(String(input)).hostname, "ai.fixture.invalid");
    const body = JSON.parse(String(init?.body ?? "{}"));
    inputs.push(body.messages);
    return Response.json({
      text:
        "The picture contains FUN Profile and a meeting invitation for 19:00 MYT.",
    });
  };
  try {
    const policy = resolveGroupReplyLanguage(question, "en");
    const reply = await askAngel({
      question: context,
      originalUserMessage: question,
      imageAnalysisContext: context,
      systemPrompt: "",
      forcedLangBucket: policy.bucket,
      fallbackLangBucket: policy.botVoiceBucket,
      languagePolicyNote: policy.policyNote,
      telegramGroupContext: buildTelegramGroupContext(
        message as never,
        7,
        "fixture_bot",
      ),
      conversationContext: {
        chatId: -1001,
        groupId: -1001,
        chatType: "supergroup",
        userId: 42,
        triggerSource: "group_ai:mention",
      },
    });
    assert.match(reply, /19:00 MYT/);
    assert.equal(inputs.length, 1);
    assert.ok(
      inputs[0].some((m) =>
        m.role === "system" && m.content === policy.policyNote
      ),
    );
    const lastUser = inputs[0].find((m) => m.role === "user")!.content;
    assert.ok(lastUser.includes("19:00 MYT"));
    assert.ok(lastUser.includes("Other"));
    assert.ok(lastUser.includes("IMAGE_ANALYSIS_CONTEXT"));
    assert.ok(lastUser.includes("TUYỆT ĐỐI KHÔNG"));
  } finally {
    Deno.env.get = originalGet;
    globalThis.fetch = originalFetch;
  }
});
