import assert from "npm:assert@2.1.0";
const assertEquals = (a: unknown, b: unknown) => assert.deepStrictEqual(a, b);
import { loadGroupSettings } from "./telegram-community.ts";

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
