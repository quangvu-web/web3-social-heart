import assert from "node:assert/strict";
import ts from "npm:typescript@5.8.3";

const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
const helpers = source.slice(source.indexOf("// Lazy work factories"), source.indexOf("// ---------- Action: start"));
const handlers = source.slice(source.indexOf("interface TranscriptEvent"), source.indexOf("// ---------- Action: stop"));
const isolated = ts.transpileModule(`
let admin, recall, summary;
export function configure(a, r, s) { admin = a; recall = r; summary = s; }
function getAdmin() { return admin; }
function recallFetch(...args) { return recall(...args); }
function runSummarize(...args) { return summary(...args); }
function json(value, status = 200) { return Response.json(value, {status}); }
async function verifySvixSignature() { return true; }
${helpers}
${handlers}
export { handleRecallWebhook, reconcileOrphanSessions, reconcileOnTouch, scheduleCaptionWork };
`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const mod = await import(`data:application/javascript,${encodeURIComponent(isolated)}`);

type Session = { id: string; status: string; recall_bot_id: string; created_at: string; chat_announced_at: string | null; ended_at?: string };
function fixture(rows: Session[], writeError = false) {
  const tasks: Promise<unknown>[] = [];
  const summaries: string[] = [];
  const calls: string[] = [];
  const bounds: { statuses?: unknown[]; cutoffs: string[]; limit?: number } = { cutoffs: [] };
  const runtime = globalThis as typeof globalThis & { EdgeRuntime?: { waitUntil(task: Promise<unknown>): void } };
  runtime.EdgeRuntime = { waitUntil(task) { tasks.push(task); } };
  const admin = { from() {
    const filters: Array<(row: Session) => boolean> = [];
    let patch: Record<string, unknown> | undefined;
    const query = {
      select() { return query; },
      eq(key: keyof Session, value: unknown) { filters.push((r) => r[key] === value); return query; },
      is(key: keyof Session, value: unknown) { filters.push((r) => r[key] === value); return query; },
      in(key: keyof Session, values: unknown[]) { bounds.statuses = values; filters.push((r) => values.includes(r[key])); return query; },
      not() { return query; },
      lt(key: keyof Session, value: string) { bounds.cutoffs.push(value); filters.push((r) => String(r[key]) < value); return query; },
      order() { return query; }, limit(value: number) { bounds.limit = value; return query; },
      update(value: Record<string, unknown>) { patch = value; return query; },
      maybeSingle() { return Promise.resolve({ data: rows.find((r) => filters.every((f) => f(r))) ?? null }); },
      then(resolve: (value: unknown) => unknown) {
        let matched = rows.filter((r) => filters.every((f) => f(r)));
        if (!patch) matched = matched.slice(0, Number(bounds.limit ?? rows.length));
        if (patch && !writeError) matched.forEach((r) => Object.assign(r, patch));
        return Promise.resolve(resolve({ data: matched, count: matched.length, error: writeError ? { code: "fixture" } : null }));
      },
    };
    return query;
  } };
  mod.configure(admin, async (path: string) => { calls.push(path); return { ok: true, data: { status_changes: [{ code: "in_call_recording" }, { code: "done" }] } }; },
    async (_admin: unknown, id: string) => { summaries.push(id); });
  return { tasks, summaries, calls, bounds, async drain() { for (let i = 0; i < tasks.length; i++) await tasks[i]; delete runtime.EdgeRuntime; } };
}
function row(id = "session-1", status = "live", ageMinutes = 10): Session {
  return { id, status, recall_bot_id: `bot-${id}`, created_at: new Date(Date.now() - ageMinutes * 60_000).toISOString(), chat_announced_at: new Date().toISOString() };
}
function webhook(code: string, botId = "bot-session-1") {
  return mod.handleRecallWebhook(new Request("https://fixture.invalid", {
    method: "POST", body: JSON.stringify({ event: "bot.status_change", data: { bot: { id: botId }, data: { code } } }),
  }));
}

Deno.test("Terminal ACK completes below 2 seconds without waiting for a slow summary", async () => {
  const session = row();
  const f = fixture([session]);
  let finish: (() => void) | undefined;
  const blocked = new Promise<void>((resolve) => { finish = resolve; });
  mod.configure({ from: () => ({ select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: session }),
    update() { session.status = "ended"; session.ended_at = new Date().toISOString(); return this; }, then(resolve: (v: unknown) => unknown) { return Promise.resolve(resolve({ count: 1, error: null })); } }) },
    async () => { throw new Error("No Recall call on terminal ACK"); }, () => blocked);
  const began = performance.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("ACK blocked")), 1900); });
  const response = await Promise.race([webhook("call_ended"), timeout]).finally(() => { if (timer !== undefined) clearTimeout(timer); });
  assert.equal(response.status, 200);
  assert.ok(performance.now() - began < 2000);
  assert.equal(session.status, "ended");
  assert.ok(session.ended_at);
  finish?.();
  await f.drain();
});

Deno.test("call_ended then done schedules one summary and stale live cannot reopen", async () => {
  const session = row(); const f = fixture([session]);
  await webhook("call_ended"); const endedAt = session.ended_at;
  await webhook("done"); await webhook("in_call_recording"); await f.drain();
  assert.equal(session.status, "ended"); assert.equal(session.ended_at, endedAt);
  assert.deepEqual(f.summaries, [session.id]);
});

Deno.test("Persistence failure returns 503 for Recall retry and does not summarize", async () => {
  const session = row(); const f = fixture([session], true);
  assert.equal((await webhook("done")).status, 503);
  await f.drain(); assert.equal(session.status, "live"); assert.equal(f.summaries.length, 0);
});

Deno.test("Fatal closes as failed without summary; latest live status keeps bot active", async () => {
  const session = row(); const f = fixture([session]);
  await webhook("fatal"); await f.drain(); assert.equal(session.status, "failed"); assert.equal(f.summaries.length, 0);
  const active = row("active"); const g = fixture([active]);
  mod.configure({ from: () => ({ select() { return this; }, in() { return this; }, not() { return this; }, is() { return this; }, lt() { return this; }, order() { return this; }, limit() { return Promise.resolve({ data: [active] }); } }) },
    async () => ({ ok: true, data: { status_changes: [{ code: "done" }, { code: "in_call_recording" }] } }),
    async () => { throw new Error("Active bot must not summarize"); });
  await mod.reconcileOrphanSessions(); await g.drain(); assert.equal(active.status, "live");
});

Deno.test("Reconcile-on-touch closes done orphan and summarizes without blocking caller", async () => {
  const session = row(); const f = fixture([session]);
  mod.reconcileOnTouch(new Request("https://fixture.invalid?action=start"));
  await f.drain(); assert.equal(session.status, "ended"); assert.ok(session.ended_at);
  assert.deepEqual(f.summaries, [session.id]); assert.equal(f.calls.length, 1);
});

Deno.test("Reconciliation limits to five joining/live sessions and skips those under three minutes", async () => {
  const young = row("young", "live", 2);
  const ended = row("ended", "ended");
  const rows = [young, ended, ...Array.from({ length: 7 }, (_, i) => row(`old-${i}`, i % 2 ? "joining" : "live"))];
  const f = fixture(rows); await mod.reconcileOrphanSessions(); await f.drain();
  assert.equal(f.bounds.limit, 5); assert.deepEqual(f.bounds.statuses, ["joining", "live"]);
  assert.ok(Math.abs(Date.parse(f.bounds.cutoffs[0]) - (Date.now() - 180_000)) < 1000);
  assert.ok(Math.abs(Date.parse(f.bounds.cutoffs[1]) - (Date.now() - 120_000)) < 1000);
  assert.equal(f.calls.length, 5); assert.equal(f.summaries.length, 5); assert.equal(young.status, "live");
  assert.equal(rows[8].status, "live");
});

Deno.test("Authenticated fallback carries token, catches failure, and never recursively reconciles", async () => {
  const f = fixture([]); await f.drain();
  const originalFetch = globalThis.fetch;
  const oldUrl = Deno.env.get("SUPABASE_URL"); const oldToken = Deno.env.get("CAPTION_INTERNAL_TOKEN");
  Deno.env.set("SUPABASE_URL", "https://fixture.invalid"); Deno.env.set("CAPTION_INTERNAL_TOKEN", "fixture-token");
  let called = 0;
  globalThis.fetch = async (url, init) => {
    called++; assert.equal(String(url), "https://fixture.invalid/functions/v1/angel-caption?action=summarize");
    assert.equal(new Headers(init?.headers).get("x-caption-token"), "fixture-token");
    assert.equal(new Headers(init?.headers).get("x-caption-background"), "1");
    assert.equal(JSON.parse(String(init?.body)).session_id, "session-1");
    throw new Error("fixture network error");
  };
  try {
    mod.scheduleCaptionWork("summarize", "session-1");
    mod.reconcileOnTouch(new Request("https://fixture.invalid", { headers: { "x-caption-background": "1" } }));
    await new Promise((resolve) => setTimeout(resolve, 0)); assert.equal(called, 1);
  } finally {
    globalThis.fetch = originalFetch;
    if (oldUrl === undefined) Deno.env.delete("SUPABASE_URL"); else Deno.env.set("SUPABASE_URL", oldUrl);
    if (oldToken === undefined) Deno.env.delete("CAPTION_INTERNAL_TOKEN"); else Deno.env.set("CAPTION_INTERNAL_TOKEN", oldToken);
  }
});
