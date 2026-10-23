import assert from 'npm:assert@2.1.0';
import { enforceGuestRate, guestImageIntent, validGuestId } from './guest.ts';
const id = '12345678-1234-4123-8123-123456789abc';

Deno.test('guest identity must be a UUID v4', () => {
  assert.equal(validGuestId(id), true);
  assert.equal(validGuestId('fake'), false);
});
Deno.test('Vietnamese and English image requests are blocked', () => {
  assert.equal(guestImageIntent('vẽ cho tôi một bức tranh'), true);
  assert.equal(guestImageIntent('draw me a picture'), true);
  assert.equal(guestImageIntent('What is FUN Profile?'), false);
});
Deno.test('5 per minute and 60 per day are checked independently for guest and hashed IP', async () => {
  const calls: Record<string, unknown>[] = [];
  assert.equal(await enforceGuestRate({ rpc: async (_name, args) => {
    calls.push(args); return { data: { allowed: true }, error: null };
  } }, id, '192.0.2.10'), 'allowed');
  assert.equal(calls.length, 4);
  assert.deepEqual(calls.map(c => [c.p_limit, c.p_window_ms]), [[5, 60000], [60, 86400000], [5, 60000], [60, 86400000]]);
  assert.equal(calls.some(c => String(c.p_key).includes('192.0.2.10')), false);
});
Deno.test('sixth minute request is denied even with a fresh guest identity', async () => {
  assert.equal(await enforceGuestRate({ rpc: async (_name, args) => ({ data: { allowed: !(String(args.p_key).includes('minute:ip:')) }, error: null }) }, id, '192.0.2.11'), 'limited');
});
Deno.test('sixty-first daily request is denied', async () => {
  assert.equal(await enforceGuestRate({ rpc: async (_name, args) => ({ data: { allowed: args.p_limit !== 60 }, error: null }) }, id, '192.0.2.11'), 'limited');
});
Deno.test('rate limit errors and missing IP never fail open', async () => {
  assert.equal(await enforceGuestRate({ rpc: async () => ({ data: null, error: 'failed' }) }, id, '192.0.2.11'), 'unavailable');
  assert.equal(await enforceGuestRate({ rpc: async () => { throw Error('offline'); } }, id, '192.0.2.11'), 'unavailable');
  assert.equal(await enforceGuestRate({ rpc: async () => ({ data: { allowed: true }, error: null }) }, id, ''), 'unavailable');
});