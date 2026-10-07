import assert from "npm:assert@2.1.0";
import { runOcrOnPhoto } from "./telegram-ocr.ts";

// Only HTTP/env/log boundaries are replaced. Cache and single-flight are real.
async function fixture(
  id: string,
  test: (f: {
    run: (suffix?: string) => ReturnType<typeof runOcrOnPhoto>;
    calls: () => number;
    set: (
      options: { key?: boolean; missingMedia?: boolean; mode?: string },
    ) => void;
    logs: unknown[][];
  }) => Promise<void>,
) {
  const originalFetch = globalThis.fetch, originalGet = Deno.env.get;
  const originalLog = console.log,
    originalWarn = console.warn,
    originalError = console.error;
  const logs: unknown[][] = [];
  let calls = 0, key = true, missingMedia = false, mode = "text";
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
  Deno.env.get = (name) =>
    ["LOVABLE_API_KEY", "COMMUNITY_GUARD_BOT_TOKEN"].includes(name) && key
      ? "fixture-only"
      : undefined;
  console.log = console.warn = console.error = (...args) => {
    logs.push(args);
  };
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.hostname === "api.telegram.org") {
      if (url.pathname.endsWith("getFile")) {
        return missingMedia
          ? Response.json({
            ok: false,
            error_code: 404,
            description: "fixture missing",
          }, { status: 404 })
          : Response.json({
            ok: true,
            result: { file_path: "fixture.png", file_size: png.length },
          });
      }
      return new Response(png, { headers: { "content-type": "image/png" } });
    }
    assert.equal(
      url.hostname,
      "ai.gateway.lovable.dev",
      "no real network allowed",
    );
    calls++;
    const body = JSON.parse(String(init?.body));
    assert.equal(body.model, "google/gemini-3.1-flash-lite");
    assert.ok(
      body.messages[1].content[1].image_url.url.startsWith(
        "data:image/png;base64,",
      ),
    );
    if (mode === "network") throw new TypeError("PRIVATE_PROVIDER_MESSAGE");
    if (mode === "api") {
      return Response.json({ error: "PRIVATE_PROVIDER_MESSAGE" }, {
        status: 403,
      });
    }
    if (mode === "invalid") return Response.json({ choices: [] });
    return Response.json({
      choices: [{
        message: { content: mode === "empty" ? "" : "FUN Profile fixture" },
      }],
    });
  };
  try {
    await test({
      run: (suffix = "") =>
        runOcrOnPhoto("fixture-file", `regression-${id}${suffix}`),
      calls: () => calls,
      set: (options) => {
        key = options.key ?? key;
        missingMedia = options.missingMedia ?? missingMedia;
        mode = options.mode ?? mode;
      },
      logs,
    });
  } finally {
    globalThis.fetch = originalFetch;
    Deno.env.get = originalGet;
    console.log = originalLog;
    console.warn = originalWarn;
    console.error = originalError;
  }
}

Deno.test("OCR text is explicit and success cache avoids another paid call", () =>
  fixture("text", async (f) => {
    assert.deepEqual(await f.run(), {
      status: "text",
      text: "FUN Profile fixture",
    });
    assert.deepEqual(await f.run(), {
      status: "text",
      text: "FUN Profile fixture",
    });
    assert.equal(f.calls(), 1);
  }));
Deno.test("OCR valid empty is a cached success, not unavailable", () =>
  fixture("empty", async (f) => {
    f.set({ mode: "empty" });
    assert.deepEqual(await f.run(), { status: "empty", text: "" });
    await f.run();
    assert.equal(f.calls(), 1);
  }));
Deno.test("OCR API rejection is unavailable and logs never echo provider body", () =>
  fixture("api", async (f) => {
    f.set({ mode: "api" });
    assert.deepEqual(await f.run(), {
      status: "unavailable",
      reason: "api_error",
      httpStatus: 403,
    });
    assert.ok(!JSON.stringify(f.logs).includes("PRIVATE_PROVIDER_MESSAGE"));
  }));
Deno.test("OCR exhausted network errors are unavailable", () =>
  fixture("network", async (f) => {
    f.set({ mode: "network" });
    assert.deepEqual(await f.run(), {
      status: "unavailable",
      reason: "transport_error",
    });
    assert.equal(f.calls(), 3);
    assert.ok(!JSON.stringify(f.logs).includes("PRIVATE_PROVIDER_MESSAGE"));
  }));
Deno.test("OCR missing configuration skips model and remains unavailable", () =>
  fixture("key", async (f) => {
    f.set({ key: false });
    assert.deepEqual(await f.run(), {
      status: "unavailable",
      reason: "missing_configuration",
    });
    assert.equal(f.calls(), 0);
  }));
Deno.test("OCR missing media is unavailable without an AI call", () =>
  fixture("media", async (f) => {
    f.set({ missingMedia: true });
    assert.deepEqual(await f.run(), {
      status: "unavailable",
      reason: "media_unavailable",
    });
    assert.equal(f.calls(), 0);
  }));
Deno.test("OCR malformed success is unavailable and never cached as empty", () =>
  fixture("invalid", async (f) => {
    f.set({ mode: "invalid" });
    assert.deepEqual(await f.run(), {
      status: "unavailable",
      reason: "invalid_response",
      httpStatus: 200,
    });
    f.set({ mode: "text" });
    assert.deepEqual(await f.run(), {
      status: "text",
      text: "FUN Profile fixture",
    });
    assert.equal(f.calls(), 2);
  }));
Deno.test("OCR concurrent same-image calls share one paid request", () =>
  fixture("concurrent", async (f) => {
    const results = await Promise.all([f.run(), f.run(), f.run()]);
    assert.equal(f.calls(), 1);
    assert.deepEqual(
      results,
      Array(3).fill({ status: "text", text: "FUN Profile fixture" }),
    );
  }));
Deno.test("OCR shared failure releases the flight and allows a fresh retry", () =>
  fixture("retry", async (f) => {
    f.set({ mode: "api" });
    const results = await Promise.all([f.run(), f.run()]);
    assert.deepEqual(
      results,
      Array(2).fill({
        status: "unavailable",
        reason: "api_error",
        httpStatus: 403,
      }),
    );
    assert.equal(f.calls(), 1);
    f.set({ mode: "text" });
    assert.deepEqual(await f.run(), {
      status: "text",
      text: "FUN Profile fixture",
    });
    assert.equal(f.calls(), 2);
  }));
Deno.test("OCR different identities never share cache or in-flight result", () =>
  fixture("different", async (f) => {
    await f.run("A");
    f.set({ mode: "empty" });
    assert.deepEqual(await f.run("B"), { status: "empty", text: "" });
    assert.deepEqual(await f.run("A"), {
      status: "text",
      text: "FUN Profile fixture",
    });
    assert.equal(f.calls(), 2);
    await Promise.all([f.run("C"), f.run("D")]);
    assert.equal(f.calls(), 4);
  }));
Deno.test("OCR success cache expires after six hours", () =>
  fixture("expiry", async (f) => {
    const now = Date.now;
    let clock = now();
    Date.now = () => clock;
    try {
      await f.run();
      clock += 6 * 60 * 60_000 - 1;
      await f.run();
      assert.equal(f.calls(), 1);
      clock += 1;
      f.set({ mode: "empty" });
      assert.deepEqual(await f.run(), { status: "empty", text: "" });
      assert.equal(f.calls(), 2);
    } finally {
      Date.now = now;
    }
  }));
Deno.test("OCR missing unique IDs use separate file identities and cannot collide with unique IDs", () =>
  fixture("fallback", async (f) => {
    assert.deepEqual(await runOcrOnPhoto("fallback-file-A", ""), {
      status: "text",
      text: "FUN Profile fixture",
    });
    f.set({ mode: "empty" });
    assert.deepEqual(await runOcrOnPhoto("fallback-file-B", ""), {
      status: "empty",
      text: "",
    });
    assert.deepEqual(await runOcrOnPhoto("another-file", "fallback-file-A"), {
      status: "empty",
      text: "",
    });
    assert.deepEqual(await runOcrOnPhoto("fallback-file-A", ""), {
      status: "text",
      text: "FUN Profile fixture",
    });
    assert.equal(f.calls(), 3);
  }));
