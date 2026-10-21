import assert from "npm:assert@2.1.0";

Deno.test("caption commands run before settings, translation, memory and AI", async () => {
  const originalGet = Deno.env.get;
  const originalFetch = globalThis.fetch;
  const originalServe = Deno.serve;
  const originalLog = console.log;
  const originalWarn = console.warn;
  const env: Record<string, string> = {
    SUPABASE_URL: "https://db.fixture.invalid",
    SUPABASE_ANON_KEY: "fixture-only",
    SUPABASE_SERVICE_ROLE_KEY: "fixture-only",
    COMMUNITY_GUARD_BOT_TOKEN: "fixture-only",
    CAPTION_INTERNAL_TOKEN: "fixture-only",
  };
  const starts: Record<string, unknown>[] = [];
  const stops: Record<string, unknown>[] = [];
  const replies: string[] = [];
  let settingsReads = 0;
  let aiCalls = 0;
  let rejectStart = false;
  Deno.env.get = (name) => env[name];
  Deno.serve = (() => ({})) as unknown as typeof Deno.serve;
  console.log = () => {};
  console.warn = () => {};
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.hostname === "api.telegram.org") {
      if (url.pathname.endsWith("/sendMessage")) {
        replies.push(JSON.parse(String(init?.body)).text);
        return Response.json({ ok: true, result: { message_id: 900 } });
      }
      throw new Error("Unexpected Telegram call");
    }
    if (url.hostname !== "db.fixture.invalid") {
      aiCalls++;
      throw new Error("No AI or real network allowed");
    }
    if (url.pathname.endsWith("/angel-caption")) {
      const body = JSON.parse(String(init?.body));
      assert.equal(new Headers(init?.headers).get("x-caption-token"), "fixture-only");
      if (url.searchParams.get("action") === "start") {
        starts.push(body);
        return rejectStart
          ? Response.json({ error: "fixture" }, { status: 400 })
          : Response.json({ caption_url: "https://app.fixture.invalid/captions/test" });
      }
      stops.push(body);
      return Response.json({ ok: true });
    }
    if (url.pathname.endsWith("/telegram_community_settings")) {
      settingsReads++;
      throw new Error("Caption must not load settings");
    }
    if (url.pathname.endsWith("/caption_sessions")) {
      assert.equal(url.searchParams.get("created_by_telegram_id"), "eq.42");
      return Response.json({ id: "fixture-session", public_code: "test" });
    }
    return new Response(null, { status: 204 });
  };
  try {
    const { handlePrivateMessage } = await import("./index.ts");
    const send = (text: string) => handlePrivateMessage({
      message_id: 81, chat: { id: 42, type: "private" },
      from: { id: 42, first_name: "Fixture" }, text,
    });
    await send("/caption https://zoom.us/j/123");
    assert.equal(starts.length, 1);
    assert.equal(starts[0].meeting_url, "https://zoom.us/j/123");
    assert.equal(starts[0].telegram_user_id, 42);
    assert.equal(starts[0].telegram_chat_id, 42);
    await send("/caption@fixture_bot https://meet.google.com/abc-defg-hij");
    assert.equal(starts.length, 2);
    await send("/caption");
    assert.equal(starts.length, 2);
    await send("/caption_stop@fixture_bot");
    assert.deepEqual(stops, [{ session_id: "fixture-session" }]);
    await send("/caption_invalid");
    assert.equal(starts.length, 2);
    rejectStart = true;
    await send("/caption https://zoom.us/j/456");
    assert.equal(starts.length, 3);
    delete env.CAPTION_INTERNAL_TOKEN;
    await send("/caption https://zoom.us/j/789");
    assert.equal(starts.length, 3);
    assert.equal(replies.length, 7);
    assert.equal(settingsReads, 0);
    assert.equal(aiCalls, 0);
  } finally {
    Deno.env.get = originalGet;
    globalThis.fetch = originalFetch;
    Deno.serve = originalServe;
    console.log = originalLog;
    console.warn = originalWarn;
  }
});