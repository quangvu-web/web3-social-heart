import assert from "npm:assert@2.1.0";

// Importing the production handler starts SDK housekeeping timers; network remains denied.
Deno.test({ name: "caption commands run before settings, translation, memory and AI", sanitizeOps: false, sanitizeResources: false, fn: async () => {
  const originalGet = Deno.env.get;
  const originalFetch = globalThis.fetch;
  const originalServe = Deno.serve;
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalSetInterval = globalThis.setInterval;
  const intervals: number[] = [];
  globalThis.setInterval = ((...args: Parameters<typeof setInterval>) => {
    const id = originalSetInterval(...args);
    intervals.push(id);
    return id;
  }) as typeof setInterval;
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
  const replyChats: unknown[] = [];
  let settingsReads = 0;
  let operatorIds: unknown = [5373909526, 42];
  let rejectSettings = false;
  let ownSession: Record<string, unknown> | null = { id: "fixture-session", public_code: "test" };
  let latestReads = 0;
  let aiCalls = 0;
  let rejectStart = false;
  let alreadyRunningStart = false;
  Deno.env.get = (name) => env[name];
  Deno.serve = (() => ({})) as unknown as typeof Deno.serve;
  console.log = () => {};
  console.warn = () => {};
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.hostname === "api.telegram.org") {
      if (url.pathname.endsWith("/sendMessage")) {
        const message = JSON.parse(String(init?.body));
        replies.push(message.text);
        replyChats.push(message.chat_id);
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
        if (alreadyRunningStart) {
          return Response.json({
            already_running: true,
            public_code: "existing-code",
            caption_url: "https://app.fixture.invalid/captions/existing-code",
            started_at: "2026-10-23T02:19:00.000Z",
          });
        }
        return rejectStart
          ? Response.json({ error: "fixture" }, { status: 400 })
          : Response.json({ caption_url: "https://app.fixture.invalid/captions/test" });
      }
      stops.push(body);
      return Response.json({ ok: true });
    }
    if (url.pathname.endsWith("/telegram_community_settings")) {
      settingsReads++;
      assert.equal(url.searchParams.get("select"), "caption_operator_ids");
      assert.equal(url.searchParams.get("order"), "created_at.asc");
      assert.equal(url.searchParams.get("limit"), "1");
      return rejectSettings
        ? Response.json({ message: "fixture lookup error" }, { status: 403 })
        : Response.json({ caption_operator_ids: operatorIds });
    }
    if (url.pathname.endsWith("/caption_sessions")) {
      assert.equal(url.searchParams.get("status"), "in.(joining,live)");
      assert.equal(url.searchParams.get("order"), "created_at.desc");
      assert.equal(url.searchParams.get("limit"), "1");
      if (url.searchParams.has("created_by_telegram_id")) {
        assert.match(url.searchParams.get("created_by_telegram_id") ?? "", /^eq\.(42|5373909526|5938169315)$/);
        return Response.json(ownSession);
      }
      latestReads++;
      return Response.json({ id: "latest-session", public_code: "latest" });
    }
    return new Response(null, { status: 204 });
  };
  try {
    const { handlePrivateMessage } = await import("./index.ts");
    const send = (text: string, userId = 42) => handlePrivateMessage({
      message_id: 81, chat: { id: userId, type: "private" },
      from: { id: userId, first_name: "Fixture" }, text,
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
    assert.match(replies.at(-1) ?? "", /Tóm tắt song ngữ sẽ được gửi tới bé; kết quả đăng nhóm sẽ được báo trong bản tóm tắt/);
    assert.doesNotMatch(replies.at(-1) ?? "", /sẽ được đăng vào nhóm cộng đồng/);
    await send("/caption_invalid");
    assert.equal(starts.length, 2);
    rejectStart = true;
    await send("/caption https://zoom.us/j/456");
    assert.equal(starts.length, 3);
    delete env.CAPTION_INTERNAL_TOKEN;
    await send("/caption https://zoom.us/j/789");
    assert.equal(starts.length, 3);
    assert.equal(replies.length, 7);
    assert.equal(settingsReads, 5);
    assert.equal(aiCalls, 0);
    // The initial operator can still start a session through the production handler.
    env.CAPTION_INTERNAL_TOKEN = "fixture-only";
    rejectStart = false;
    operatorIds = [5373909526];
    await send("/caption https://zoom.us/j/123", 5373909526);
    assert.equal(starts.length, 4);
    assert.equal(starts[3].telegram_user_id, 5373909526);
    // Non-operator: exactly one reply, no start call and no AI.
    const beforeDenied = replies.length;
    await send("/caption https://zoom.us/j/123", 5938169315);
    assert.equal(replies.length, beforeDenied + 1);
    assert.equal(starts.length, 4);
    assert.equal(aiCalls, 0);
    for (const deniedList of [[], null]) {
      operatorIds = deniedList;
      await send("/caption https://zoom.us/j/123", 5373909526);
      assert.equal(starts.length, 4);
    }
    rejectSettings = true;
    await send("/caption https://zoom.us/j/123", 5373909526);
    assert.equal(starts.length, 4);
    rejectSettings = false;
    // A non-operator creator retains their own stop; no global lookup is allowed.
    await send("/caption_stop", 5938169315);
    assert.equal(stops.length, 2);
    assert.deepEqual(stops[1], { session_id: "fixture-session" });
    assert.equal(latestReads, 0);
    // An operator's own session takes priority even when global sessions exist.
    operatorIds = [5373909526];
    await send("/caption_stop", 5373909526);
    assert.deepEqual(stops[2], { session_id: "fixture-session" });
    assert.equal(latestReads, 0);
    // Only operators without an own session can stop the newest global active session.
    ownSession = null;
    await send("/caption_stop", 5373909526);
    assert.deepEqual(stops[3], { session_id: "latest-session" });
    assert.equal(latestReads, 1);
    await send("/caption_stop", 5938169315);
    assert.equal(stops.length, 4);
    assert.equal(latestReads, 1);
    rejectSettings = true;
    await send("/caption_stop", 5373909526);
    assert.equal(stops.length, 4);
    assert.equal(latestReads, 1);
    // A duplicate start returns only the existing caption link to the requesting operator.
    rejectSettings = false;
    operatorIds = [5373909526];
    alreadyRunningStart = true;
    const beforeDuplicateReply = replies.length;
    await send("/caption https://zoom.us/j/123", 5373909526);
    assert.equal(starts.length, 5);
    assert.equal(replies.length, beforeDuplicateReply + 1);
    assert.match(replies.at(-1) ?? "", /đã có.*Angel Translator.*đang chạy/i);
    assert.match(replies.at(-1) ?? "", /https:\/\/app\.fixture\.invalid\/captions\/existing-code/);
    assert.equal(replyChats.at(-1), 5373909526);
  } finally {
    Deno.env.get = originalGet;
    globalThis.fetch = originalFetch;
    Deno.serve = originalServe;
    console.log = originalLog;
    console.warn = originalWarn;
    globalThis.setInterval = originalSetInterval;
    intervals.forEach(clearInterval);
  }
} });
