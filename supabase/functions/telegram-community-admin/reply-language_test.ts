import assert from "npm:assert@2.1.0";

Deno.test("update_settings validates language and group before writing; updates only the selected group", async () => {
  const originalServe = Deno.serve;
  const originalFetch = globalThis.fetch;
  const envNames = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
  const previousEnv = envNames.map((key) => Deno.env.get(key));
  let handler: (req: Request) => Response | Promise<Response>;
  const rows = [
    { id: "test-group", group_id: -1001, reply_language: "auto", ai_enabled: true },
    { id: "other-group", group_id: -1002, reply_language: "en", ai_enabled: false },
  ];
  let writes = 0;
  let settingsReads = 0;
  try {
    Deno.env.set("SUPABASE_URL", "https://fixture.invalid");
    Deno.env.set("SUPABASE_ANON_KEY", "fixture-anon");
    Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "fixture-service");
    Deno.serve = ((callback: typeof handler) => { handler = callback; return {}; }) as typeof Deno.serve;
    globalThis.fetch = async (input, init) => {
      const req = new Request(input, init);
      const url = new URL(req.url);
      assert.strictEqual(url.origin, "https://fixture.invalid");
      if (url.pathname === "/auth/v1/user") return Response.json({ id: "admin-fixture" });
      if (url.pathname === "/rest/v1/rpc/has_role") return Response.json(true);
      assert.strictEqual(url.pathname, "/rest/v1/telegram_community_settings");
      const row = rows.find((r) => url.searchParams.get("group_id") === `eq.${r.group_id}` || url.searchParams.get("id") === `eq.${r.id}`);
      if (req.method === "PATCH") {
        if (!row) throw new Error("write must target a specific existing settings row");
        Object.assign(row, await req.json());
        writes++;
        return new Response(null, { status: 204 });
      }
      settingsReads++;
      return Response.json(row ?? null);
    };
    await import("./index.ts");
    const update = (payload: Record<string, unknown>) => handler(new Request("https://fixture.invalid/admin", {
      method: "POST", headers: { Authorization: "Bearer fixture-user", "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_settings", payload }),
    }));
    for (const reply_language of ["vi", "en", "auto"]) {
      const response = await update({ group_id: -1001, reply_language });
      assert.strictEqual(response.status, 200);
      const body = await response.json();
      assert.strictEqual(body.settings.reply_language, reply_language);
      assert.strictEqual(rows[0].reply_language, reply_language);
      assert.strictEqual(rows[0].ai_enabled, true);
      assert.strictEqual(rows[1].reply_language, "en");
    }
    assert.strictEqual(writes, 3);
    const readsBeforeInvalid = settingsReads;
    for (const reply_language of ["fr", "", "EN", null, true, 1, {}, []]) {
      const response = await update({ group_id: -1001, reply_language });
      assert.strictEqual(response.status, 400);
      assert.match((await response.json()).error, /reply_language.*auto.*en.*vi/);
    }
    for (const group_id of [undefined, null, 0, 123, -1.5, "-1001", false, -Number.MAX_SAFE_INTEGER - 1]) {
      const response = await update({ group_id, reply_language: "vi" });
      assert.strictEqual(response.status, 400);
      assert.match((await response.json()).error, /group_id/);
    }
    assert.strictEqual(writes, 3);
    assert.strictEqual(settingsReads, readsBeforeInvalid, "malformed input must not fall back to another group");
    const unknown = await update({ group_id: -9999, reply_language: "vi" });
    assert.strictEqual(unknown.status, 400);
    assert.strictEqual(writes, 3);
  } finally {
    Deno.serve = originalServe;
    globalThis.fetch = originalFetch;
    envNames.forEach((key, i) => previousEnv[i] === undefined ? Deno.env.delete(key) : Deno.env.set(key, previousEnv[i]!));
  }
});
