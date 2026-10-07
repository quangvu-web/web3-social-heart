import assert from "npm:assert@2.1.0";

Deno.test("webhook OCR unavailable keeps benign photos and still moderates caption/URL rules", async () => {
  const get = Deno.env.get, fetch = globalThis.fetch, serve = Deno.serve;
  const log = console.log, warn = console.warn, error = console.error;
  const globals = globalThis as unknown as {
    EdgeRuntime?: { waitUntil: (p: Promise<unknown>) => void };
  };
  const runtime = globals.EdgeRuntime;
  const work: Promise<unknown>[] = [],
    logs: unknown[][] = [],
    actions: string[] = [];
  const writes: Record<string, unknown>[] = [];
  let handler: (req: Request) => Response | Promise<Response>;
  let ocrCalls = 0, scanEnabled = true;
  const env: Record<string, string> = {
    SUPABASE_URL: "https://db.fixture.invalid",
    SUPABASE_ANON_KEY: "fixture-only",
    SUPABASE_SERVICE_ROLE_KEY: "fixture-only",
    COMMUNITY_GUARD_BOT_TOKEN: "fixture-only",
    COMMUNITY_GUARD_WEBHOOK_SECRET: "fixture-only",
    LOVABLE_API_KEY: "fixture-only",
  };
  Deno.env.get = (name) => env[name];
  Deno.serve = ((callback: typeof handler) => {
    handler = callback;
    return {};
  }) as unknown as typeof Deno.serve;
  globals.EdgeRuntime = {
    waitUntil: (p) => {
      work.push(p);
    },
  };
  console.log = console.warn = console.error = (...args) => {
    logs.push(args);
  };
  const state = {
    id: "fixture-state",
    joined_at: new Date().toISOString(),
    warning_count: 0,
    message_count: 0,
    message_count_window_start: new Date().toISOString(),
  };
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    const body = JSON.parse(String(init?.body ?? "{}"));
    if (url.hostname === "ai.gateway.lovable.dev") {
      ocrCalls++;
      return Response.json({ error: "PRIVATE_PROVIDER_MESSAGE" }, {
        status: 403,
      });
    }
    if (url.hostname === "api.telegram.org") {
      const method = url.pathname.split("/").at(-1)!;
      if (method === "getMe") {
        return Response.json({
          ok: true,
          result: { id: 7, username: "fixture_bot" },
        });
      }
      if (method === "getChatMember") {
        return Response.json({ ok: true, result: { status: "member" } });
      }
      if (method === "getFile") {
        return Response.json({
          ok: true,
          result: { file_path: "fixture.png", file_size: 12 },
        });
      }
      if (url.pathname.includes("/file/")) {
        return new Response(
          new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]),
          { headers: { "content-type": "image/png" } },
        );
      }
      actions.push(method);
      assert.ok(
        ["deleteMessage", "sendMessage"].includes(method),
        "unavailable never causes member restriction or unexpected Telegram calls",
      );
      return Response.json({
        ok: true,
        result: method === "sendMessage" ? { message_id: 990 } : true,
      });
    }
    assert.equal(
      url.hostname,
      "db.fixture.invalid",
      "all network is intercepted",
    );
    if (url.pathname.endsWith("/telegram_community_settings")) {
      return Response.json([{
        group_id: -1001,
        anti_spam_enabled: true,
        scam_protection_enabled: true,
        enable_ocr_scan: scanEnabled,
        new_user_restriction_hours: 24,
        max_messages_per_minute: 0,
        block_telegram_previews: true,
        block_external_bots: true,
        block_scam_keywords: true,
        warning_limit: 999,
        ai_enabled: false,
        always_reply_admins: false,
        event_assistant_enabled: false,
        positive_engagement_enabled: false,
        help_intent_ai_enabled: false,
      }]);
    }
    if (url.pathname.endsWith("/telegram_community_user_state")) {
      if (init?.method === "PATCH") return new Response(null, { status: 204 });
      return Response.json(state);
    }
    if (
      url.pathname.endsWith("/telegram_community_moderation_logs") &&
      init?.method === "POST"
    ) writes.push(body);
    if (init?.method === "HEAD") {
      return new Response(null, { headers: { "content-range": "*/0" } });
    }
    if (init?.method && !["GET", "HEAD"].includes(init.method)) {
      return new Response(null, { status: 204 });
    }
    return Response.json([]);
  };
  try {
    await import("../telegram-community-webhook/index.ts");
    const send = async (id: number, caption: string) => {
      const result = await handler(
        new Request("https://webhook.fixture.invalid", {
          method: "POST",
          headers: { "X-Telegram-Bot-Api-Secret-Token": "fixture-only" },
          body: JSON.stringify({
            update_id: id,
            message: {
              message_id: id,
              chat: { id: -1001, type: "supergroup" },
              from: { id: 77, first_name: "Fixture" },
              caption,
              photo: [{
                file_id: "fixture-photo",
                file_unique_id: `moderation-${id}`,
                width: 100,
                height: 100,
              }],
            },
          }),
        }),
      );
      assert.equal(result.status, 200);
      while (work.length) await Promise.all(work.splice(0));
      assert.ok(
        !writes.some((row) => row.action === "error"),
        "fixture must reach moderation without swallowed handler errors",
      );
    };
    await send(1, "Một hình ảnh thường ngày.");
    assert.equal(ocrCalls, 1);
    assert.deepEqual(
      actions,
      [],
      "OCR error alone never deletes, warns or restricts",
    );
    await send(2, "địt mẹ");
    assert.equal(ocrCalls, 2);
    assert.ok(
      actions.includes("deleteMessage"),
      "caption heuristic still runs after OCR error",
    );
    assert.ok(
      writes.some((row) => String(row.reason).startsWith("vietnamese_abuse")),
    );
    assert.ok(
      !writes.some((row) => String(row.reason).startsWith("OCR_RISK_CONTENT")),
    );
    assert.ok(
      logs.some((row) => row[0] === "[community] ocr_scan_unavailable"),
    );
    assert.ok(!JSON.stringify(logs).includes("PRIVATE_PROVIDER_MESSAGE"));
    await send(4, "https://fixture.xyz/info");
    assert.equal(ocrCalls, 3);
    assert.ok(
      writes.some((row) => String(row.reason).startsWith("suspicious_tld:")),
      "URL rule after OCR still runs",
    );
    scanEnabled = false;
    const before = ocrCalls;
    await send(3, "Một hình ảnh thường ngày.");
    assert.equal(
      ocrCalls,
      before,
      "existing group OCR switch remains effective",
    );
  } finally {
    Deno.env.get = get;
    globalThis.fetch = fetch;
    Deno.serve = serve;
    console.log = log;
    console.warn = warn;
    console.error = error;
    if (runtime) globals.EdgeRuntime = runtime;
    else delete globals.EdgeRuntime;
  }
});
