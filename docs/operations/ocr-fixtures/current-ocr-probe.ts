import assert from "npm:assert@2.1.0";
import { runOcrOnPhoto } from "../../../supabase/functions/_shared/telegram-ocr.ts";
const png = await Deno.readFile(new URL("./vietnamese.png", import.meta.url));
const originalGet = Deno.env.get,
  originalFetch = globalThis.fetch,
  originalWarn = console.warn;
let hasKey = true,
  mime = "image/png",
  declared = png.length,
  status = 200,
  text = "FUN Profile",
  calls = 0;
Deno.env.get = (key) =>
  key === "LOVABLE_API_KEY"
    ? (hasKey ? "fixture-only" : undefined)
    : key === "COMMUNITY_GUARD_BOT_TOKEN"
    ? "fixture-only"
    : undefined;
console.warn = () => {};
globalThis.fetch = async (input, init) => {
  const url = new URL(String(input));
  if (url.hostname === "api.telegram.org") {
    if (url.pathname.endsWith("getFile")) {
      return Response.json({
        ok: true,
        result: {
          file_path: mime === "image/png" ? "fixture.png" : "fixture.txt",
          file_size: declared,
        },
      });
    }
    return new Response(
      mime === "image/png" ? png : new TextEncoder().encode("fixture text"),
      { headers: { "content-type": mime } },
    );
  }
  assert.equal(url.hostname, "ai.gateway.lovable.dev", "all network is mocked");
  calls++;
  const body = JSON.parse(String(init?.body));
  assert.equal(body.model, "google/gemini-3.1-flash-lite");
  assert.equal(
    body.messages[1].content[0].text,
    "Extract all readable text from this image.",
  );
  assert.ok(
    body.messages[1].content[1].image_url.url.startsWith(
      "data:image/png;base64,",
    ),
  );
  assert.ok(
    !body.messages[1].content[1].image_url.url.includes("api.telegram.org"),
  );
  return status === 200
    ? Response.json({ choices: [{ message: { content: text } }] })
    : Response.json({ error: "fixture rejection" }, { status });
};
Deno.test("audit: Gemini OCR request and same-instance cache", async () => {
  assert.deepEqual(await runOcrOnPhoto("fixture-file", "audit-success"), {
    status: "text",
    text: "FUN Profile",
  });
  assert.deepEqual(await runOcrOnPhoto("fixture-file", "audit-success"), {
    status: "text",
    text: "FUN Profile",
  });
  assert.equal(calls, 1);
});
Deno.test("audit: missing key and invalid/large media do not call model", async () => {
  const before = calls;
  hasKey = false;
  await runOcrOnPhoto("fixture-file", "audit-missing");
  hasKey = true;
  mime = "text/plain";
  await runOcrOnPhoto("fixture-file", "audit-mime");
  mime = "image/png";
  declared = 11 * 1024 * 1024;
  await runOcrOnPhoto("fixture-file", "audit-size");
  declared = png.length;
  assert.equal(calls, before);
});
Deno.test("audit: unavailable OCR must be distinguishable from valid empty OCR", async () => {
  text = "";
  const empty = await runOcrOnPhoto("fixture-file", "audit-empty");
  status = 403;
  const failed = await runOcrOnPhoto("fixture-file", "audit-failure");
  assert.notDeepEqual(
    failed,
    empty,
    "unavailable must differ from valid empty",
  );
});
Deno.test("audit: concurrent same-image requests should coalesce", async () => {
  status = 200;
  text = "FUN Profile";
  const before = calls;
  await Promise.all([
    runOcrOnPhoto("fixture-file", "audit-concurrent"),
    runOcrOnPhoto("fixture-file", "audit-concurrent"),
  ]);
  assert.equal(calls - before, 1, "parallel calls must share one scan");
});
Deno.test("audit cleanup", () => {
  Deno.env.get = originalGet;
  globalThis.fetch = originalFetch;
  console.warn = originalWarn;
});
