import assert from "npm:assert@2.1.0";
import { handleBotInvite, type InviteUpdate } from "../functions/_shared/telegram-unauthorized-invite.ts";

Deno.test("real DB invite claims serialize retry, permit reinvite and protect managed groups", async () => {
  const temp = await Deno.makeTempDir({ prefix: "tgi-" });
  const data = `${temp}/data`;
  let started = false;
  const command = async (cmd: string, args: string[]) => {
    const output = await new Deno.Command(cmd, { args, clearEnv: true, env: { PATH: Deno.env.get("PATH") ?? "/opt/homebrew/bin:/usr/bin:/bin", LC_ALL: "C" }, stdout: "piped", stderr: "piped" }).output();
    if (!output.success) throw new Error(`${cmd} fixture failed: ${new TextDecoder().decode(output.stderr)}`);
    return new TextDecoder().decode(output.stdout).trim();
  };
  // Explicit local Unix socket; no DATABASE_URL or inherited remote connection configuration.
  const sql = (query: string) => command("psql", ["-X", "-h", temp, "-p", "6548", "-U", "fixture", "-d", "postgres", "-At", "-v", "ON_ERROR_STOP=1", "-c", query]);
  try {
    await command("initdb", ["-D", data, "-U", "fixture", "-A", "trust", "--no-locale"]);
    await command("pg_ctl", ["-D", data, "-l", `${temp}/server.log`, "-o", `-F -k ${temp} -h '' -p 6548`, "-w", "start"]);
    started = true;
    await sql("CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE TABLE public.telegram_community_settings(group_id bigint PRIMARY KEY)");
    await sql(await Deno.readTextFile(new URL("../migrations/20261005020000_telegram_unauthorized_bot_invites.sql", import.meta.url)));
    assert.strictEqual(await sql(await Deno.readTextFile(new URL("./telegram-unauthorized-invite-preflight.sql", import.meta.url))), "t|t|t|t|t");
    let sends = 0, leaves = 0;
    const audit: string[] = [];
    const run = (updateId: number, date = 1791158400, groupId = -1001) => {
      const update: InviteUpdate = { update_id: updateId, my_chat_member: {
        chat: { id: groupId, type: "supergroup" }, date,
        old_chat_member: { status: "left" }, new_chat_member: { status: "member", user: { id: 7, is_bot: true } },
      } };
      return handleBotInvite(update, {
        lookup: async () => "unmanaged", // Test the atomic RPC recheck even with a stale caller lookup.
        claim: e => sql(`SET ROLE service_role; SELECT public.tg_claim_unauthorized_bot_invite(${e.chatId},${e.botId},${e.updateId},${e.eventDate})`).then(s => s.split("\n").at(-1) ?? null),
        send: async () => { sends++; return { ok: true }; },
        leave: async () => { leaves++; return { ok: true }; },
        audit: async action => { audit.push(action); },
      });
    };
    await Promise.all(Array.from({ length: 12 }, () => run(100)));
    assert.deepStrictEqual([sends, leaves], [1, 1]);
    await run(100);
    assert.deepStrictEqual([sends, leaves], [1, 1]);
    await run(101); // Distinct reinvite, even within the same Telegram second.
    await run(100);
    assert.deepStrictEqual([sends, leaves], [2, 2]);
    await sql("INSERT INTO public.telegram_community_settings VALUES(-1002)");
    await run(102, 1791158402, -1002);
    assert.deepStrictEqual([sends, leaves], [2, 2]);
    assert.ok(audit.includes("unauthorized_group_now_managed"));
    assert.strictEqual(await sql("SELECT count(*) FROM public.telegram_unauthorized_bot_invites"), "2");
    assert.strictEqual(await sql("SELECT relrowsecurity FROM pg_class WHERE oid='public.telegram_unauthorized_bot_invites'::regclass"), "t");
    assert.strictEqual(await sql("SELECT has_function_privilege('anon','public.tg_claim_unauthorized_bot_invite(bigint,bigint,bigint,bigint)','EXECUTE') OR has_function_privilege('authenticated','public.tg_claim_unauthorized_bot_invite(bigint,bigint,bigint,bigint)','EXECUTE') OR has_table_privilege('anon','public.telegram_unauthorized_bot_invites','SELECT')"), "f");
    // Settings-query failure must abort RPC; dropping only the local fixture dependency.
    await sql("ALTER TABLE public.telegram_community_settings RENAME TO fixture_settings_unavailable");
    await assert.rejects(() => run(103));
    assert.deepStrictEqual([sends, leaves], [2, 2]);
    assert.strictEqual(await sql("SELECT count(*) FROM public.telegram_unauthorized_bot_invites"), "2");
  } finally {
    if (started) await command("pg_ctl", ["-D", data, "-m", "immediate", "-w", "stop"]);
    await Deno.remove(temp, { recursive: true });
  }
});
