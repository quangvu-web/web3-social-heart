import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  pushToAngelKnowledge,
  testAngelKnowledgeConnection,
} from "./angel-knowledge.ts";

Deno.test("Angel knowledge ingest reports persistence failures and allows safe retry", async (t) => {
  const originalFetch = globalThis.fetch;
  const originalSetTimeout = globalThis.setTimeout;
  const originalKey = Deno.env.get("ANGEL_KNOWLEDGE_INGEST_KEY");
  const originalLegacyKey = Deno.env.get("ANGEL_AI_API_KEY");
  const originalSupabaseUrl = Deno.env.get("SUPABASE_URL");
  const originalServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const calls: Array<{ body: Record<string, unknown>; key: string | null }> =
    [];
  let responseQueue: Response[] = [];

  const restore = () => {
    globalThis.fetch = originalFetch;
    globalThis.setTimeout = originalSetTimeout;
    if (originalKey === undefined) {
      Deno.env.delete("ANGEL_KNOWLEDGE_INGEST_KEY");
    } else Deno.env.set("ANGEL_KNOWLEDGE_INGEST_KEY", originalKey);
    if (originalLegacyKey === undefined) Deno.env.delete("ANGEL_AI_API_KEY");
    else Deno.env.set("ANGEL_AI_API_KEY", originalLegacyKey);
    if (originalSupabaseUrl === undefined) Deno.env.delete("SUPABASE_URL");
    else Deno.env.set("SUPABASE_URL", originalSupabaseUrl);
    if (originalServiceRoleKey === undefined) {
      Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
    } else Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", originalServiceRoleKey);
  };

  try {
    Deno.env.delete("ANGEL_KNOWLEDGE_INGEST_KEY");
    Deno.env.set("ANGEL_AI_API_KEY", "legacy-only-test-key");
    Deno.env.delete("SUPABASE_URL");
    Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
    globalThis.fetch = async (input, init) => {
      calls.push({
        body: JSON.parse(String(init?.body)) as Record<string, unknown>,
        key: new Headers(init?.headers).get("x-api-key"),
      });
      const next = responseQueue.shift();
      if (!next) throw new Error("test response queue empty");
      return next;
    };

    await t.step(
      "missing dedicated secret is explicit and never calls endpoint",
      async () => {
        const result = await pushToAngelKnowledge({
          source: "telegram_channel",
          source_ref: "10:1",
          title: "test",
          content: "test",
        });
        assertEquals(result.code, "ANGEL_KNOWLEDGE_SECRET_MISSING");
        assertEquals(result.skipped, true);
        assertEquals(calls.length, 0);
        Deno.env.delete("ANGEL_AI_API_KEY");
      },
    );

    await t.step("connection check sends read-only status action", async () => {
      Deno.env.set("ANGEL_KNOWLEDGE_INGEST_KEY", "test-only-key");
      responseQueue = [
        new Response(JSON.stringify({ items: [] }), { status: 200 }),
      ];
      const result = await testAngelKnowledgeConnection();
      assertEquals(result.ok, true);
      assertEquals(calls.at(-1)?.body.action, "status");
      assertEquals(calls.at(-1)?.body.source_refs, ["__connection_check__"]);
      Deno.env.delete("ANGEL_KNOWLEDGE_INGEST_KEY");
    });

    Deno.env.set("ANGEL_KNOWLEDGE_INGEST_KEY", "test-only-key");

    await t.step(
      "successful upsert is counted only after status confirms persistence",
      async () => {
        responseQueue = [
          new Response(JSON.stringify({ ok: true, reference: "doc-ref-123" }), {
            status: 200,
          }),
          new Response(
            JSON.stringify({
              items: [{ source_ref: "10:2a", status: "persisted" }],
            }),
            { status: 200 },
          ),
        ];
        const result = await pushToAngelKnowledge({
          source: "telegram_channel",
          source_ref: "10:2a",
          title: "test",
          content: "test",
        }, { verify: true });
        assertEquals(result.ok, true);
        assertEquals("sentCount" in result ? result.sentCount : undefined, 1);
        assertEquals(
          "persistedCount" in result ? result.persistedCount : undefined,
          1,
        );
      },
    );

    await t.step(
      "HTTP errors are classified without echoing response body",
      async () => {
        for (const status of [401, 503]) {
          responseQueue = [
            new Response(JSON.stringify({ error: "upstream detail" }), {
              status,
            }),
          ];
          const result = await pushToAngelKnowledge({
            source: "telegram_channel",
            source_ref: `10:${status}`,
            title: "test",
            content: "test",
          });
          assertEquals(result.code, "ANGEL_KNOWLEDGE_HTTP_ERROR");
          assertEquals(result.status, status);
          assertEquals(result.error?.includes("upstream detail"), false);
          assertEquals(calls.at(-1)?.key, "test-only-key");
        }
      },
    );

    await t.step(
      "HTTP 2xx with no persisted reference fails verification",
      async () => {
        responseQueue = [
          new Response(
            JSON.stringify({
              ok: true,
              results: [{ source_ref: "10:3", status: "accepted" }],
            }),
            { status: 200 },
          ),
          new Response(JSON.stringify({ items: [] }), { status: 200 }),
        ];
        const result = await pushToAngelKnowledge({
          source: "telegram_channel",
          source_ref: "10:3",
          title: "test",
          content: "test",
        }, { verify: true });
        assertEquals(result.code, "ANGEL_KNOWLEDGE_NOT_PERSISTED");
        assertEquals("sentCount" in result ? result.sentCount : undefined, 1);
        assertEquals(
          "persistedCount" in result ? result.persistedCount : undefined,
          0,
        );
      },
    );

    await t.step("network errors are classified", async () => {
      globalThis.fetch = async () => {
        throw new TypeError("simulated network failure");
      };
      const result = await pushToAngelKnowledge({
        source: "telegram_channel",
        source_ref: "10:4",
        title: "test",
        content: "test",
      });
      assertEquals(result.code, "ANGEL_KNOWLEDGE_NETWORK_ERROR");
    });

    await t.step("aborted requests are classified as timeout", async () => {
      globalThis.setTimeout = ((handler: () => void) =>
        originalSetTimeout(handler, 0)) as typeof setTimeout;
      globalThis.fetch = async (_input, init) =>
        await new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")), { once: true });
        });
      const result = await pushToAngelKnowledge({
        source: "telegram_channel",
        source_ref: "10:timeout",
        title: "test",
        content: "test",
      });
      assertEquals(result.code, "ANGEL_KNOWLEDGE_TIMEOUT");
      globalThis.setTimeout = originalSetTimeout;
    });

    await t.step(
      "repush after a failed attempt persists on retry",
      async () => {
        globalThis.fetch = async (_input, init) => {
          const body = JSON.parse(String(init?.body)) as Record<
            string,
            unknown
          >;
          calls.push({
            body,
            key: new Headers(init?.headers).get("x-api-key"),
          });
          if (body.action === "status") {
            return new Response(
              JSON.stringify({
                items: [{ source_ref: "10:5", status: "persisted" }],
              }),
              { status: 200 },
            );
          }
          return responseQueue.shift() ??
            new Response(
              JSON.stringify({ ok: true, reference: "doc-safe-ref" }),
              { status: 200 },
            );
        };
        responseQueue = [new Response("unavailable", { status: 502 })];
        const failed = await pushToAngelKnowledge({
          source: "telegram_channel",
          source_ref: "10:5",
          title: "test",
          content: "test",
        }, { verify: true });
        assertEquals(failed.ok, false);

        const retried = await pushToAngelKnowledge({
          source: "telegram_channel",
          source_ref: "10:5",
          title: "test",
          content: "test",
        }, { verify: true });
        assertEquals(retried.ok, true);
        assertEquals("sentCount" in retried ? retried.sentCount : undefined, 1);
        assertEquals(
          "persistedCount" in retried ? retried.persistedCount : undefined,
          1,
        );
        assertStringIncludes(String(retried.reference), "doc-safe-ref");
      },
    );
  } finally {
    restore();
  }
});
