import assert from "npm:assert@2.1.0";
import { sendModerationFailureNotice } from "../functions/_shared/telegram-moderation-notice.ts";

// Disposable PostgreSQL, Unix socket only; never uses DATABASE_URL or a remote host.
Deno.test("durable notice claims prevent concurrent/retried sends and apply rolling group cooldown", async () => {
  const temp = await Deno.makeTempDir({ prefix: "telegram-notice-fixture-" });
  const data = `${temp}/data`;
  let started = false;
  const command = async (cmd: string, args: string[]) => {
    const output = await new Deno.Command(cmd, { args, stdout: "piped", stderr: "piped" }).output();
    if (!output.success) throw new Error(`${cmd} fixture command failed: ${new TextDecoder().decode(output.stderr)}`);
    return new TextDecoder().decode(output.stdout).trim();
  };
  const sql = (query: string) => command("psql", ["-X", "-h", temp, "-p", "6547", "-U", "fixture", "-d", "postgres", "-At", "-v", "ON_ERROR_STOP=1", "-c", query]);
  try {
    await command("initdb", ["-D", data, "-U", "fixture", "-A", "trust", "--no-locale"]);
    await command("pg_ctl", ["-D", data, "-l", `${temp}/server.log`, "-o", `-F -k ${temp} -h '' -p 6547`, "-w", "start"]);
    started = true;
    await sql("CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;");
    await sql(await Deno.readTextFile(new URL("./telegram-moderation-notices.sql", import.meta.url)));
    let sends = 0;
    const events: string[] = [];
    const run = (groupId: number, messageId: number) => sendModerationFailureNotice({
      groupId, messageId,
      claim: () => sql(`SET ROLE service_role; SELECT public.tg_claim_moderation_failure_notice(${groupId}, ${messageId});`).then(s => s.split("\n").at(-1) ?? null),
      send: async () => { sends++; return { ok: true }; },
      audit: async event => { events.push(event.action); },
    });
    await Promise.all(Array.from({ length: 12 }, () => run(-1001, 1)));
    assert.strictEqual(sends, 1, "same update has only one send attempt across connections");
    assert.strictEqual(events.filter(e => e === "moderation_notice_suppressed").length, 11);
    await Promise.all(Array.from({ length: 12 }, (_, i) => run(-1001, i + 2)));
    assert.strictEqual(sends, 1, "many failures in one group stay quiet during cooldown");
    assert.strictEqual(await sql("SELECT count(*) FROM public.telegram_moderation_notice_events WHERE group_id=-1001"), "13");
    await run(-1002, 1);
    assert.strictEqual(sends, 2, "groups are independent");
    // Advance local fixture state to exercise rolling expiry without a five-minute wait.
    await sql("UPDATE public.telegram_moderation_notice_groups SET last_claimed_at=clock_timestamp()-interval '301 seconds' WHERE group_id=-1001");
    await run(-1001, 1); await run(-1001, 2);
    assert.strictEqual(sends, 2, "both sent and suppressed messages remain deduped after cooldown");
    await Promise.all(Array.from({ length: 12 }, (_, i) => run(-1001, i + 30)));
    assert.strictEqual(sends, 3, "only one new message wins after rolling expiry");
    assert.strictEqual(await sql("SELECT has_function_privilege('anon', 'public.tg_claim_moderation_failure_notice(bigint,bigint)', 'EXECUTE') OR has_function_privilege('authenticated', 'public.tg_claim_moderation_failure_notice(bigint,bigint)', 'EXECUTE')"), "f");
    assert.strictEqual(await sql("SELECT bool_and(relrowsecurity) FROM pg_class WHERE relname IN ('telegram_moderation_notice_events','telegram_moderation_notice_groups')"), "t");
    // Unknown send does not release the reservation for a webhook retry.
    await sendModerationFailureNotice({ groupId: -1003, messageId: 1,
      claim: () => sql("SELECT public.tg_claim_moderation_failure_notice(-1003,1)"),
      send: async () => { throw new Error("synthetic network failure"); },
      audit: async event => { events.push(event.action); },
    });
    assert.strictEqual(events.at(-1), "moderation_notice_send_failed");
    assert.strictEqual(await sql("SELECT public.tg_claim_moderation_failure_notice(-1003,1)"), "duplicate");
  } finally {
    if (started) await command("pg_ctl", ["-D", data, "-m", "immediate", "-w", "stop"]);
    await Deno.remove(temp, { recursive: true });
  }
});
