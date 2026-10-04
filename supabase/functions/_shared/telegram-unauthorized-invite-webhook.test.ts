import assert from "npm:assert@2.1.0";

Deno.test("actual webhook routes dual updates/retries once and returns 503 before any effect on lookup failure", async () => {
  const env = { SUPABASE_URL: "https://fixture.invalid", SUPABASE_ANON_KEY: "fixture-key", SUPABASE_SERVICE_ROLE_KEY: "fixture-key", COMMUNITY_GUARD_BOT_TOKEN: "fixture-only", COMMUNITY_GUARD_WEBHOOK_SECRET: "fixture-secret" };
  const originals = Object.fromEntries(Object.keys(env).map(key => [key, Deno.env.get(key)]));
  const originalFetch = globalThis.fetch;
  const originalServe = Deno.serve;
  let handler: ((request: Request) => Promise<Response>) | undefined;
  let sends = 0, leaves = 0;
  let settingsMode: "managed" | "unmanaged" | "error" = "unmanaged";
  let claimMode: "available" | "error" = "available";
  const claims = new Set<string>();
  const audits: string[] = [];
  const myUpdate = (id = 100, date = 1791158400) => ({ update_id: id, my_chat_member: {
    chat: { id: -1001, type: "supergroup", title: "Fixture" }, date,
    old_chat_member: { status: "left", user: { id: 7, is_bot: true } },
    new_chat_member: { status: "member", user: { id: 7, is_bot: true } },
  } });
  const serviceMessage = { update_id: 99, message: { message_id: 9, date: 1791158400,
    chat: { id: -1001, type: "supergroup", title: "Fixture" },
    new_chat_members: [{ id: 7, is_bot: true, username: "funrich_community_bot" }],
  } };
  try {
    for (const [key, value] of Object.entries(env)) Deno.env.set(key, value);
    Deno.serve = ((callback: typeof handler) => { handler = callback; return {}; }) as typeof Deno.serve;
    globalThis.fetch = async (input, init) => {
      const url = new URL(String(input));
      const route = url.pathname.split("/").at(-1);
      if (url.hostname === "api.telegram.org") {
        if (route === "sendMessage") { sends++; return Response.json({ ok: true, result: { message_id: 90 } }); }
        if (route === "leaveChat") { leaves++; return Response.json({ ok: true, result: true }); }
        throw new Error("unexpected Telegram method in local fixture");
      }
      assert.strictEqual(url.hostname, "fixture.invalid", "no external transport is allowed");
      if (route === "telegram_community_settings") {
        if (settingsMode === "error") return Response.json({ code: "fixture_lookup_error" }, { status: 503 });
        return Response.json(settingsMode === "managed" ? [{ group_id: -1001 }] : []);
      }
      if (route === "tg_claim_unauthorized_bot_invite") {
        if (claimMode === "error") return Response.json({ code: "fixture_rpc_error" }, { status: 503 });
        const key = JSON.stringify(JSON.parse(String(init?.body)));
        const decision = claims.has(key) ? "duplicate" : "claimed";
        claims.add(key);
        return Response.json(decision);
      }
      if (route === "telegram_community_moderation_logs") {
        audits.push(JSON.parse(String(init?.body)).action);
        return new Response(null, { status: 201 });
      }
      // Background rule/verification/usage reads or audit writes have no fixture records.
      return Response.json([]);
    };
    await import("../telegram-community-webhook/index.ts");
    assert.ok(handler, "actual Deno.serve handler was captured without opening a server");
    const deliver = (update: unknown) => handler!(new Request("https://fixture.invalid/hook", {
      method: "POST", headers: { "Content-Type": "application/json", "X-Telegram-Bot-Api-Secret-Token": env.COMMUNITY_GUARD_WEBHOOK_SECRET }, body: JSON.stringify(update),
    }));
    const results = await Promise.all([deliver(serviceMessage), ...Array.from({ length: 6 }, () => deliver(myUpdate()))]);
    assert.ok(results.every(response => response.status === 200));
    assert.deepStrictEqual([sends, leaves], [1, 1]);
    assert.ok(audits.includes("unauthorized_group_secondary_update"));
    assert.ok(audits.includes("unauthorized_group_left"));
    await deliver({ update_id: 105, message: { message_id: 10, date: 1791158400, text: "Fixture ordinary message", chat: { id: -1001, type: "supergroup" } } });
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.deepStrictEqual([sends, leaves], [1, 1], "ordinary messages cannot repeat the leave");
    await deliver(myUpdate(101, 1791158401)); await deliver(myUpdate());
    assert.deepStrictEqual([sends, leaves], [2, 2]);
    settingsMode = "error";
    assert.strictEqual((await deliver(myUpdate(102))).status, 503);
    assert.deepStrictEqual([sends, leaves], [2, 2]);
    settingsMode = "unmanaged"; claimMode = "error";
    assert.strictEqual((await deliver(myUpdate(102))).status, 503);
    assert.deepStrictEqual([sends, leaves], [2, 2]);
    claimMode = "available";
    assert.strictEqual((await deliver(myUpdate(102))).status, 200);
    assert.deepStrictEqual([sends, leaves], [3, 3]);
    settingsMode = "managed";
    assert.strictEqual((await deliver(myUpdate(103))).status, 200);
    assert.deepStrictEqual([sends, leaves], [3, 3]);
    assert.ok(audits.includes("authorized_group_joined"));
    // Permission change is not another invitation.
    settingsMode = "unmanaged";
    const changed = myUpdate(104); changed.my_chat_member.old_chat_member.status = "member";
    changed.my_chat_member.new_chat_member.status = "administrator";
    await deliver(changed);
    assert.deepStrictEqual([sends, leaves], [3, 3]);
    await new Promise(resolve => setTimeout(resolve, 0)); // Drain nonblocking usage fixture writes.
  } finally {
    globalThis.fetch = originalFetch;
    Deno.serve = originalServe;
    for (const [key, value] of Object.entries(originals)) {
      if (value === undefined) Deno.env.delete(key); else Deno.env.set(key, value);
    }
  }
});
