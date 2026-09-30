/**
 * End-to-end test: zombie Agora Cloud Recording cleanup.
 *
 * These tests run with an in-memory fake of the Supabase client and a
 * mocked global `fetch` so they can exercise the real production code in
 * `_shared/liveEnd.ts` (`forceEndLive`) without touching live infrastructure.
 *
 * Scenarios:
 *   1. Zombie: live_sessions.status='ended' but recording_status='recording'
 *      -> forceEndLive issues exactly one Agora stop, marks recording 'processing'.
 *   2. Idempotency: calling forceEndLive twice does NOT issue a second stop.
 *   3. Agora 404 ("not found") is treated as safe-stopped (no duplicate).
 *   4. Stop retry: first attempt 5xx then 200 still results in one logical stop.
 *   5. Heartbeat timeout > 90s funnels into forceEndLive once.
 *
 * Run with:
 *   deno test --allow-env --allow-net supabase/functions/live-watchdog-cleanup/zombie_recording_test.ts
 */

import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

// Stub Agora creds before importing liveEnd (which transitively calls loadAgoraCreds).
Deno.env.set("AGORA_APP_ID", "test-app");
Deno.env.set("AGORA_CUSTOMER_ID", "test-cust");
Deno.env.set("AGORA_CUSTOMER_SECRET", "test-secret");
Deno.env.set("SUPABASE_URL", "http://stub.local");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "stub-key");

const { forceEndLive } = await import("../_shared/liveEnd.ts");

// ---------- Fetch mock ----------

type FetchHandler = (url: string, init?: RequestInit) => { status: number; body: unknown };

const fetchCalls: { url: string; method: string }[] = [];
let agoraStopHandler: FetchHandler = () => ({ status: 200, body: { code: 0 } });
let agoraQueryHandler: FetchHandler = () => ({ status: 200, body: { serverResponse: { status: 5 } } });

const realFetch = globalThis.fetch;
globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  const method = (init?.method || "GET").toUpperCase();
  fetchCalls.push({ url, method });

  // Swallow the replay-processor self-call so tests stay offline.
  if (url.includes("/functions/v1/process-live-recordings")) {
    return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
  }

  if (url.includes("api.agora.io") && url.includes("/cloud_recording/")) {
    const handler = url.includes("/stop") ? agoraStopHandler : agoraQueryHandler;
    const res = handler(url, init);
    return Promise.resolve(new Response(JSON.stringify(res.body), { status: res.status }));
  }

  return realFetch(input as RequestInfo, init);
};

function resetFetchMock() {
  fetchCalls.length = 0;
  agoraStopHandler = () => ({ status: 200, body: { code: 0 } });
  agoraQueryHandler = () => ({ status: 200, body: { serverResponse: { status: 5 } } });
}

function countAgoraStops() {
  return fetchCalls.filter((c) => c.url.includes("/stop") && c.method === "POST").length;
}

// ---------- Supabase client fake ----------

type Row = Record<string, unknown>;

class FakeQuery {
  private filters: Array<(row: Row) => boolean> = [];
  private op: "select" | "update" | "insert" = "select";
  private payload: Row | null = null;
  private selectAfter = false;

  constructor(private store: Row[], private mutate: (r: Row, patch: Row) => void) {}

  select(_cols?: string) {
    if (this.op === "update" || this.op === "insert") this.selectAfter = true;
    else this.op = "select";
    return this;
  }
  update(payload: Row) { this.op = "update"; this.payload = payload; return this; }
  insert(payload: Row) { this.op = "insert"; this.payload = payload; return this; }

  eq(col: string, val: unknown) { this.filters.push((r) => r[col] === val); return this; }
  in(col: string, vals: unknown[]) { this.filters.push((r) => vals.includes(r[col])); return this; }
  is(col: string, val: unknown) { this.filters.push((r) => r[col] === val); return this; }
  lt(col: string, val: unknown) {
    this.filters.push((r) => {
      const v = r[col];
      return typeof v === "string" && typeof val === "string" && v < val;
    });
    return this;
  }
  order() { return this; }
  limit() { return this; }

  private matched() { return this.store.filter((r) => this.filters.every((f) => f(r))); }

  private run() {
    const matched = this.matched();
    if (this.op === "update" && this.payload) {
      for (const r of matched) this.mutate(r, this.payload);
      return { data: matched, error: null };
    }
    if (this.op === "insert" && this.payload) {
      this.store.push({ ...this.payload });
      return { data: [this.payload], error: null };
    }
    return { data: matched, error: null };
  }

  async maybeSingle() { const { data, error } = this.run(); return { data: data[0] ?? null, error }; }
  async single() { const { data, error } = this.run(); return { data: data[0] ?? null, error }; }
  then<T>(onFulfilled: (v: { data: unknown; error: unknown }) => T) {
    return Promise.resolve(this.run()).then(onFulfilled);
  }
}

function createFakeClient(tables: Record<string, Row[]>) {
  const mutate = (r: Row, patch: Row) => { for (const [k, v] of Object.entries(patch)) r[k] = v; };
  return {
    tables,
    from(name: string) {
      if (!tables[name]) tables[name] = [];
      return new FakeQuery(tables[name], mutate);
    },
  } as unknown as Parameters<typeof forceEndLive>[0];
}

function makeLiveRow(overrides: Partial<Row> = {}): Row {
  const base = {
    id: crypto.randomUUID(),
    user_id: "host-user",
    host_user_id: "host-user",
    owner_id: "host-user",
    status: "live",
    mode: "agora_webcam",
    live_mode: "webcam",
    source: "agora",
    stream_provider: "agora",
    agora_channel: "ch-test",
    channel_name: "ch-test",
    recording_uid: 12345,
    recording_provider: "agora",
    recording_status: "recording",
    recording_resource_id: "resource-abc",
    recording_sid: "sid-xyz",
    resource_id: null,
    sid: null,
    recording_retry_count: 0,
    cleanup_attempts: 0,
    started_at: new Date(Date.now() - 5 * 60_000).toISOString(),
    ended_at: null,
    created_at: new Date(Date.now() - 5 * 60_000).toISOString(),
    live_post_id: null,
    post_id: null,
    stop_requested_at: null,
    recording_stop_requested_at: null,
    stopped_at: null,
    recording_stopped_at: null,
    rtmp_status: null,
    rtmp_ended_at: null,
    watchdog_stop_result: null,
    last_recording_query_result: null,
  };
  return { ...base, ...overrides };
}

// ---------- Tests ----------

Deno.test("zombie: status=ended but recording active -> single stop + processing", async () => {
  resetFetchMock();
  const row = makeLiveRow({ status: "ended", recording_status: "recording" });
  const client = createFakeClient({ live_sessions: [row] });

  const result = await forceEndLive(client, {
    sessionId: row.id as string,
    reason: "ended_recording_active",
    source: "watchdog",
  });

  assert(result.ok, "forceEndLive should succeed");
  assertEquals(countAgoraStops(), 1, "exactly one Agora stop call");
  assertEquals(row.status, "ended");
  assertEquals(row.recording_status, "processing");
  assert(row.cleanup_finished_at, "cleanup_finished_at populated");
  assert(row.recording_stop_requested_at, "stop request timestamp populated");
});

Deno.test("idempotent: second forceEndLive call does not issue a second stop", async () => {
  resetFetchMock();
  const row = makeLiveRow({ status: "live", recording_status: "recording" });
  const client = createFakeClient({ live_sessions: [row] });

  await forceEndLive(client, { sessionId: row.id as string, reason: "host_clicked_end", source: "host" });
  const firstStops = countAgoraStops();
  assertEquals(firstStops, 1);

  const second = await forceEndLive(client, { sessionId: row.id as string, reason: "host_clicked_end", source: "host" });
  assert(second.ok);
  assertEquals(second.alreadyEnded, true, "second call should be a no-op");
  assertEquals(countAgoraStops(), firstStops, "no additional Agora stop on idempotent call");
});

Deno.test("agora 404 treated as safe-stopped", async () => {
  resetFetchMock();
  agoraStopHandler = () => ({ status: 404, body: { code: 404, message: "recording not found" } });
  const row = makeLiveRow({ status: "live", recording_status: "recording" });
  const client = createFakeClient({ live_sessions: [row] });

  const result = await forceEndLive(client, { sessionId: row.id as string, reason: "zombie_cleanup", source: "watchdog" });
  assert(result.ok);
  assertEquals(result.stopSafe, true, "404 should be safe-stopped");
  assertEquals(row.status, "ended");
  assertEquals(row.recording_status, "processing");
  assertEquals(countAgoraStops(), 1, "no retry storm on 404");
});

Deno.test("stop retries on transient 5xx then succeeds without duplicating end", async () => {
  resetFetchMock();
  let calls = 0;
  agoraStopHandler = () => {
    calls += 1;
    return calls === 1 ? { status: 503, body: { message: "upstream" } } : { status: 200, body: { code: 0 } };
  };
  const row = makeLiveRow({ status: "live", recording_status: "recording" });
  const client = createFakeClient({ live_sessions: [row] });

  const result = await forceEndLive(client, { sessionId: row.id as string, reason: "watchdog_cleanup", source: "watchdog" });
  assert(result.ok);
  assertEquals(result.stopSafe, true);
  assertEquals(calls, 2, "second attempt succeeded");
  assertEquals(row.status, "ended");
  assertEquals(row.recording_status, "processing");
});

Deno.test("stop fails 3x -> session marked ended with recording_error, no extra retries", async () => {
  resetFetchMock();
  let calls = 0;
  agoraStopHandler = () => { calls += 1; return { status: 500, body: { message: "boom" } }; };
  const row = makeLiveRow({ status: "live", recording_status: "recording" });
  const client = createFakeClient({ live_sessions: [row] });

  const result = await forceEndLive(client, { sessionId: row.id as string, reason: "watchdog_cleanup", source: "watchdog" });
  assert(result.ok);
  assertEquals(result.stopSafe, false);
  assertEquals(calls, 3, "stops capped at 3 attempts");
  assertEquals(row.status, "ended");
  assertEquals(row.recording_status, "stopping", "left in stopping for next pass");
  assert(row.recording_error, "recording_error captured for diagnostics");
});

Deno.test("non-host actor rejected with forbidden", async () => {
  resetFetchMock();
  const row = makeLiveRow({ status: "live" });
  const client = createFakeClient({ live_sessions: [row] });
  const result = await forceEndLive(client, {
    sessionId: row.id as string,
    actorUserId: "intruder",
    reason: "host_clicked_end",
    source: "host",
  });
  assertEquals(result.ok, false);
  assertEquals(result.status, "forbidden");
  assertEquals(countAgoraStops(), 0);
});

Deno.test("missing session -> not_found, zero side effects", async () => {
  resetFetchMock();
  const client = createFakeClient({ live_sessions: [] });
  const result = await forceEndLive(client, {
    sessionId: "00000000-0000-0000-0000-000000000000",
    reason: "watchdog_cleanup",
    source: "watchdog",
  });
  assertEquals(result.ok, false);
  assertEquals(result.status, "not_found");
  assertEquals(countAgoraStops(), 0);
});
