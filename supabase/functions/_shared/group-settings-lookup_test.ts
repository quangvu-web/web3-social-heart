import assert from "npm:assert@2.1.0";
const assertEquals = (a: unknown, b: unknown) => assert.deepStrictEqual(a, b);
import {
  activeDomains,
  activeKeywords,
  checkAndUpdateAiRate,
  ensureSettings,
  getSettingsForGroup,
  loadGroupSettings,
  loadTrustedBotUsernames,
  loadTrustedTelegramHandles,
} from "./telegram-community.ts";

type Resp = { data: unknown; error: { code?: string } | null } | Error;

function fakeClient(responses: Resp[]) {
  let calls = 0;
  const client = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            const r = responses[Math.min(calls++, responses.length - 1)];
            if (r instanceof Error) throw r;
            return r;
          },
        }),
      }),
    }),
  };
  return { client: client as never, calls: () => calls };
}

Deno.test("managed group returns settings", async () => {
  const { client } = fakeClient([{ data: { group_id: 1 }, error: null }]);
  const r = await loadGroupSettings(client, 1);
  assertEquals(r, { ok: true, settings: { group_id: 1 } as never });
});

Deno.test("unmanaged group returns ok with null settings", async () => {
  const { client } = fakeClient([{ data: null, error: null }]);
  assertEquals(await loadGroupSettings(client, 1), { ok: true, settings: null });
});

Deno.test("transient error is retried once and succeeds", async () => {
  const f = fakeClient([{ data: null, error: { code: "57014" } }, { data: { group_id: 1 }, error: null }]);
  const r = await loadGroupSettings(f.client, 1);
  assertEquals(r.ok, true);
  assertEquals(f.calls(), 2);
});

Deno.test("persistent error is reported as failure, not unmanaged", async () => {
  const f = fakeClient([{ data: null, error: { code: "42501" } }]);
  assertEquals(await loadGroupSettings(f.client, 1), { ok: false, errorCode: "42501" });
});

Deno.test("thrown exception is reported as failure", async () => {
  const f = fakeClient([new Error("network")]);
  assertEquals(await loadGroupSettings(f.client, 1), { ok: false, errorCode: "exception" });
});


Deno.test("ensureSettings never inserts defaults when the settings lookup fails", async () => {
  let insertCalls = 0;
  const client = {
    from: () => ({
      select: () => ({
        order: () => ({
          limit: () => ({
            maybeSingle: async () => ({ data: null, error: { code: "42501" } }),
          }),
        }),
      }),
      insert: () => { insertCalls++; throw new Error("unexpected insert"); },
    }),
  };
  let failed = false;
  try { await ensureSettings(client as never); } catch { failed = true; }
  assertEquals(failed, true);
  assertEquals(insertCalls, 0);
});

Deno.test("active moderation lists throw on lookup failure", async () => {
  const client = {
    from: () => ({
      select: () => ({ eq: async () => ({ data: null, error: { code: "42501" } }) }),
    }),
  };
  let domainsFailed = false;
  let keywordsFailed = false;
  try { await activeDomains(client as never); } catch { domainsFailed = true; }
  try { await activeKeywords(client as never); } catch { keywordsFailed = true; }
  assertEquals(domainsFailed, true);
  assertEquals(keywordsFailed, true);
});

Deno.test("ensureSettings surfaces insert failures instead of reporting no configuration", async () => {
  const client = {
    from: () => ({
      select: () => ({ order: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
      insert: () => ({ select: () => ({ single: async () => ({ data: null, error: { code: "42501" } }) }) }),
    }),
  };
  let failed = false;
  try { await ensureSettings(client as never); } catch { failed = true; }
  assertEquals(failed, true);
});

Deno.test("group settings accessor surfaces lookup failure instead of returning null", async () => {
  const { client } = fakeClient([{ data: null, error: { code: "42501" } }]);
  let failed = false;
  try { await getSettingsForGroup(client, 1); } catch { failed = true; }
  assertEquals(failed, true);
});

Deno.test("AI rate limit read failure is thrown before creating an empty state", async () => {
  let upsertCalls = 0;
  const client = {
    from: () => ({
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: { code: "42501" } }) }) }) }),
      upsert: () => { upsertCalls++; return { error: null }; },
    }),
  };
  let failed = false;
  try { await checkAndUpdateAiRate(client as never, { chatId: 1, telegramUserId: 2, limitPerMinute: 10 }); } catch { failed = true; }
  assertEquals(failed, true);
  assertEquals(upsertCalls, 0);
});

Deno.test("trusted Telegram allowlists do not become empty on lookup errors", async () => {
  const client = {
    from: () => ({
      select: () => ({ or: async () => ({ data: null, error: { code: "42501" } }) }),
    }),
  };
  let handlesFailed = false;
  let botsFailed = false;
  try { await loadTrustedTelegramHandles(client as never, -9990001); } catch { handlesFailed = true; }
  try { await loadTrustedBotUsernames(client as never, -9990002); } catch { botsFailed = true; }
  assertEquals(handlesFailed, true);
  assertEquals(botsFailed, true);
});
