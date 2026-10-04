import assert from "npm:assert";

Deno.test("weekly AI analysis has no sender identity and uses default addressing", async () => {
  const originalServe = Deno.serve;
  const originalGet = Deno.env.get;
  const originalFetch = globalThis.fetch;
  Deno.serve = (() => ({})) as unknown as typeof Deno.serve;
  Deno.env.get = (name) => name === "LOVABLE_API_KEY" ? "fixture-only" : undefined;
  let systems = "";
  globalThis.fetch = async (input, init) => {
    assert.ok(String(input).startsWith("https://ai.gateway.lovable.dev/"));
    const body = JSON.parse(String(init?.body));
    systems = body.messages.filter((m: { role: string }) => m.role === "system").map((m: { content: string }) => m.content).join("\n");
    return Response.json({ choices: [{ message: { content: 'Tôi sẽ chia sẻ với bé Ly. “Tôi chào bạn.”' } }] });
  };
  try {
    const { aiLossAnalysis } = await import("../telegram-community-weekly-report/index.ts");
    const reply = await aiLossAnalysis("Aggregate fixture stats only; mention @Camly_Duong");
    assert.equal(reply, 'Angel sẽ chia sẻ với bé. “Tôi chào bạn.”');
    assert.ok(systems.includes("TELEGRAM ADDRESS CONTRACT"));
  } finally { Deno.serve = originalServe; Deno.env.get = originalGet; globalThis.fetch = originalFetch; }
});
