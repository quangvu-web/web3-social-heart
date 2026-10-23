import assert from 'npm:assert@2.1.0';
import ts from 'npm:typescript@5.8.3';
import * as guestRules from './guest.ts';

function harness() {
  const counters = { getUser: 0, privateData: 0, model: 0 };
  let handler: (req: Request) => Promise<Response> = async () => new Response(null);
  const source = Deno.readTextFileSync(new URL('./index.ts', import.meta.url)).replace(/import[\s\S]*?from\s*['"][^'"]+['"];\s*/g, '');
  const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  const injected = {
    Deno: { env: { get: (key: string) => ({ SUPABASE_URL: 'https://example.test', SUPABASE_ANON_KEY: 'public-test', SUPABASE_SERVICE_ROLE_KEY: 'server-test' })[key] }, serve: (cb: typeof handler) => { handler = cb; } },
    createClient: () => ({ auth: { getUser: async () => { counters.getUser++; return { data: { user: null }, error: null }; } } }),
    withUsage: (_name: string, _label: string, cb: typeof handler) => cb,
    getAngelProvider: () => 'funcore',
    callAngelCore: async (params: { forceProvider: string; messages: unknown[] }) => {
      assert.equal(params.forceProvider, 'lovable'); counters.model++; return { text: 'Public reply', provider: 'lovable' };
    },
    enforceAngelVietnamesePronounContract: (text: string) => text,
    OFFICIAL_FACTS: 'Public FUN Profile facts',
    ...guestRules,
    enforceGuestRate: async () => 'allowed',
    loadAngelRuleOverrides: () => { counters.privateData++; throw Error('private access'); },
    getAngelMemorySettings: () => { counters.privateData++; throw Error('private access'); },
    getRollingSummarySettings: () => { counters.privateData++; throw Error('private access'); },
  };
  new Function(...Object.keys(injected), code)(...Object.values(injected));
  const request = (body: unknown, authorization = 'Bearer public-test', key = 'public-test') => handler(new Request('https://example.test/functions/v1/angel-chat', {
    method: 'POST', headers: { Authorization: authorization, apikey: key, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }));
  return { request, counters };
}

Deno.test('signed-in path still verifies JWT and rejects invalid users', async () => {
  const h = harness();
  const response = await h.request({ messages: [{ role: 'user', content: 'hello' }] }, 'Bearer invalid');
  assert.equal(response.status, 401);
  assert.equal(h.counters.getUser, 1);
  assert.equal(h.counters.model, 0);
});
Deno.test('guest uses text-only public model without personal memory or user data', async () => {
  const h = harness();
  const response = await h.request({ guest: true, guest_id: '12345678-1234-4123-8123-123456789abc', messages: [{ role: 'user', content: 'What is gratitude?' }] });
  assert.equal(response.status, 200);
  assert.equal(h.counters.getUser, 0);
  assert.equal(h.counters.privateData, 0);
  assert.equal(h.counters.model, 1);
});
Deno.test('guest image request returns bilingual login invitation with zero model calls', async () => {
  const h = harness();
  const response = await h.request({ guest: true, guest_id: '12345678-1234-4123-8123-123456789abc', messages: [{ role: 'user', content: 'vẽ cho tôi một bức tranh' }] });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).reply, guestRules.GUEST_IMAGE_MESSAGE);
  assert.equal(h.counters.model, 0);
  assert.equal(h.counters.privateData, 0);
});
Deno.test('guest cannot use an arbitrary caller key', async () => {
  const h = harness();
  const response = await h.request({ guest: true, guest_id: '12345678-1234-4123-8123-123456789abc', messages: [{ role: 'user', content: 'hello' }] }, 'Bearer bad', 'bad');
  assert.equal(response.status, 401);
  assert.equal(h.counters.model, 0);
});