import assert from "npm:assert@2.1.0";
import ts from "npm:typescript@5.8.3";

// Run the production start handler against an in-memory DB/Recall fixture.
const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
const handlers = source.slice(
  source.indexOf("interface ActiveSession"),
  source.indexOf("// ---------- Action: recall-webhook"),
);
const isolated = ts.transpileModule(
  `
let admin, recallState, createdBots = 0;
export function configure(a, r) { admin = a; recallState = r; createdBots = 0; }
export function botCount() { return createdBots; }
function getAdmin() { return admin; }
function checkInternalToken() { return true; }
function reconcileOnTouch() {}
function detectPlatform(v) { try { const h = new URL(v).hostname.toLowerCase(); return /(^|\\.)zoom\\.(us|com)$/.test(h) ? "zoom" : h === "meet.google.com" ? "google_meet" : h === "teams.microsoft.com" || h === "teams.live.com" ? "teams" : null; } catch { return null; } }
function isValidMeetingUrl(v) { return detectPlatform(v) !== null; }
function extractMeetingKey(v) { try { const u = new URL(v); const host = u.hostname.toLowerCase(); const path = u.pathname.replace(/\\/+$/, ""); if (/(^|\\.)zoom\\.(us|com)$/i.test(host)) { const m = path.match(/\\/j\\/(\\d+)/i); if (m) return "zoom:" + m[1]; } if (host === "meet.google.com") { const m = path.match(/\\/([a-z]{3}-[a-z]{4}-[a-z]{3})(\\/|$)/i); if (m) return "meet:" + m[1].toLowerCase(); } return host + path.toLowerCase() || null; } catch { return null; } }
function generatePublicCode() { return "fixture-code"; }
function captionUrl(code) { return "https://caption.invalid/" + code; }
function json(value, status = 200) { return Response.json(value, { status }); }
const Deno = { env: { get(name) { return name === "SUPABASE_URL" ? "https://db.invalid" : ""; } } };
async function createRecallBot() { createdBots++; return { ok: true, botId: "bot-new" }; }
async function recallFetch() { return recallState(); }
async function closeCaptionSession(admin, session, finalStatus) { const { error, count } = await admin.from("caption_sessions").update({ status: finalStatus }).eq("id", session.id).eq("status", session.status); if (error) throw new Error("caption_close_write_failed"); return count === 1; }
${handlers}
export { handleStart };
`,
  {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
    },
  },
).outputText;
const mod = await import(
  `data:application/javascript,${encodeURIComponent(isolated)}`
);

type Row = Record<string, any>;
function fixture(
  initial: Row[] = [],
  { botStatus = "in_call_recording", lookupError = false } = {},
) {
  const rows = initial.map((row) => ({ ...row }));
  let inserted = 0;
  const active = (row: Row) =>
    ["pending", "joining", "live"].includes(row.status);
  const admin = {
    from(table: string) {
      const filters: Array<(row: Row) => boolean> = [];
      let patch: Row | null = null;
      let insert: Row | null = null;
      const query: any = {
        select() {
          return query;
        },
        eq(key: string, value: unknown) {
          filters.push((row) => row[key] === value);
          return query;
        },
        in(key: string, values: unknown[]) {
          filters.push((row) => values.includes(row[key]));
          return query;
        },
        order() {
          return query;
        },
        limit() {
          return query;
        },
        maybeSingle() {
          if (lookupError) {
            return Promise.resolve({
              data: null,
              error: { code: "fixture_lookup_failed" },
            });
          }
          return Promise.resolve({
            data: rows.filter((row) =>
              filters.every((test) => test(row))
            ).sort((a, b) =>
              b.created_at.localeCompare(a.created_at)
            )[0] ?? null,
            error: null,
          });
        },
        insert(value: Row) {
          insert = value;
          return query;
        },
        single() {
          if (table !== "caption_sessions" || !insert) {
            return Promise.resolve({
              data: null,
              error: { code: "fixture_error" },
            });
          }
          if (
            rows.some((row) =>
              row.meeting_key === insert!.meeting_key && active(row)
            )
          ) {
            return Promise.resolve({ data: null, error: { code: "23505" } });
          }
          const row = {
            ...insert,
            id: `session-${++inserted}`,
            created_at: new Date().toISOString(),
            started_at: null,
          };
          rows.push(row);
          return Promise.resolve({ data: row, error: null });
        },
        update(value: Row) {
          patch = value;
          return query;
        },
        then(resolve: (value: unknown) => unknown) {
          const matched = rows.filter((row) =>
            filters.every((test) => test(row))
          );
          matched.forEach((row) => Object.assign(row, patch));
          return Promise.resolve(
            resolve({ data: matched, count: matched.length, error: null }),
          );
        },
      };
      return query;
    },
  };
  mod.configure(
    admin,
    () =>
      Promise.resolve({
        ok: true,
        status: 200,
        data: { status_changes: [{ code: botStatus }] },
      }),
  );
  return {
    rows,
    get inserted() {
      return inserted;
    },
    get botCount() {
      return mod.botCount();
    },
  };
}
function start(url: string) {
  return mod.handleStart(
    new Request("https://caption.invalid?action=start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ meeting_url: url }),
    }),
  );
}
function oldSession(key: string, overrides: Row = {}) {
  return {
    id: "existing",
    public_code: "old-code",
    meeting_key: key,
    meeting_url: "https://zoom.us/j/8808082024",
    status: "live",
    recall_bot_id: "bot-old",
    created_at: new Date(Date.now() - 60_000).toISOString(),
    started_at: new Date(Date.now() - 55_000).toISOString(),
    ...overrides,
  };
}

Deno.test("same Zoom meeting including a different pwd reuses the running caption without another bot/session", async () => {
  const f = fixture([oldSession("zoom:8808082024")]);
  const response = await start("https://zoom.us/j/8808082024?pwd=different");
  const body = await response.json();
  assert.equal(body.already_running, true);
  assert.equal(body.public_code, "old-code");
  assert.equal(body.caption_url, "https://caption.invalid/old-code");
  assert.equal(f.rows.length, 1);
  assert.equal(f.botCount, 0);
});

Deno.test("simultaneous starts for one key are arbitrated by the partial unique index", async () => {
  const f = fixture([]);
  const [a, b] = await Promise.all([
    start("https://zoom.us/j/8808082024?pwd=a"),
    start("https://zoom.us/j/8808082024?pwd=b"),
  ]);
  const [aBody, bBody] = await Promise.all([a.json(), b.json()]);
  assert.equal(f.rows.length, 1);
  assert.equal(f.botCount, 1);
  assert.deepEqual(
    [aBody.already_running ?? false, bBody.already_running ?? false].sort(),
    [false, true],
  );
});

Deno.test("an ended prior session does not block starting that meeting again", async () => {
  const f = fixture([oldSession("zoom:8808082024", { status: "ended" })]);
  const response = await start("https://zoom.us/j/8808082024");
  assert.equal(response.status, 200);
  assert.equal(f.rows.length, 2);
  assert.equal(f.botCount, 1);
});

Deno.test("a live row with a Recall bot already done is closed and replaced", async () => {
  const f = fixture([oldSession("zoom:8808082024")], { botStatus: "done" });
  const response = await start("https://zoom.us/j/8808082024");
  assert.equal(response.status, 200);
  assert.equal(f.rows[0].status, "ended");
  assert.equal(f.rows.length, 2);
  assert.equal(f.botCount, 1);
});

Deno.test("different meeting keys start independently", async () => {
  const f = fixture([]);
  const [a, b] = await Promise.all([
    start("https://zoom.us/j/111"),
    start("https://zoom.us/j/222"),
  ]);
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
  assert.equal(f.rows.length, 2);
  assert.equal(f.botCount, 2);
});

Deno.test("a failed active-session lookup fails closed before creating a row or Recall bot", async () => {
  const f = fixture([], { lookupError: true });
  const response = await start("https://zoom.us/j/8808082024");
  assert.equal(response.status, 503);
  assert.equal(f.rows.length, 0);
  assert.equal(f.botCount, 0);
});
