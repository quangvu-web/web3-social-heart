import { afterEach, beforeEach, expect, mock, test } from 'bun:test';
import { Window } from 'happy-dom';
import React, { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const browser = new Window({ url: 'https://fun.example/admin' });
for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'Event', 'DocumentFragment', 'Node', 'Element', 'MutationObserver', 'ResizeObserver']) {
  Object.defineProperty(globalThis, key, { configurable: true, value: key === 'window' ? browser : Reflect.get(browser, key) });
}
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, getComputedStyle: browser.getComputedStyle.bind(browser) });
type Result = { data: unknown; error: Error | null };
let failed = true;
const result = (single = false): Result => ({ data: failed ? null : single ? null : [], error: failed ? new Error('test: backend unavailable') : null });
class ReadQuery implements PromiseLike<Result> {
  select() { return this; }
  order() { return this; }
  limit() { return this; }
  eq() { return this; }
  in() { return this; }
  gte() { return this; }
  lte() { return this; }
  or() { return this; }
  maybeSingle() { return Promise.resolve(result(true)); }
  then<T = Result, U = never>(resolve?: (value: Result) => T | PromiseLike<T>, reject?: (reason: unknown) => U | PromiseLike<U>) {
    return Promise.resolve(result()).then(resolve, reject);
  }
}
// Only backend reads are mocked: no mutation methods exist in this test client.
mock.module('../../src/integrations/supabase/client', () => ({ supabase: {
  from: () => new ReadQuery(), rpc: async () => result(),
  functions: { invoke: async () => ({ data: failed ? null : { keys: [] }, error: result().error }) },
} }));
const { default: Feedback } = await import('../../src/components/admin/FeedbackTab');
const { default: Rewards } = await import('../../src/components/admin/RewardApprovalTab');
const { default: Members } = await import('../../src/components/admin/MemberAnalyticsTab');
const { default: DmUsers } = await import('../../src/components/admin/BotDmUsersSection');
const { default: Keys } = await import('../../src/components/admin/SecurityAppKeysTab');
const { default: Flags } = await import('../../src/components/admin/AdminFeatureFlagsTab');
const { default: Persona } = await import('../../src/components/admin/AdminAngelPersonaTab');
const { default: Prompts } = await import('../../src/components/admin/AdminPromptVersionsTab');
const { default: Conversations } = await import('../../src/components/admin/AdminAiConversationsTab');
const { default: Allowlists } = await import('../../src/components/admin/TelegramAllowlistsTab');
const { default: FatherChannel } = await import('../../src/components/admin/TelegramFatherChannelTab');
let root: Root;
let container: HTMLDivElement;
let client: QueryClient;
beforeEach(() => {
  failed = true;
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); client.clear(); container.remove(); });
async function mount(ui: ReactNode) {
  await act(async () => root.render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>));
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
}
function button(label: string) {
  const target = [...container.querySelectorAll('button')].find(b => b.textContent?.includes(label));
  expect(target).toBeDefined();
  return target!;
}
test('DM failure does not present zero KPIs or allow export; retry verifies empty data', async () => {
  await mount(<DmUsers />);
  expect(container.textContent).toContain('Không tải được dữ liệu DM');
  expect([...container.querySelectorAll('.tabular-nums')].map(el => el.textContent)).toEqual(Array(4).fill('Chưa xác minh'));
  expect(container.textContent).not.toContain('Hiển thị 0 / 0');
  expect(button('CSV').disabled).toBe(true);
  failed = false;
  await act(async () => button('Thử lại').click());
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
  expect(container.textContent).toContain('Chưa có bản ghi DM trong tập dữ liệu tải được.');
  expect([...container.querySelectorAll('.tabular-nums')].map(el => el.textContent)).toEqual(['0','0','0','0%']);
});
test('feedback failure does not show an unverified zero count', async () => {
  await mount(<Feedback />);
  expect(container.textContent).toContain('Không xác minh được dữ liệu feedback');
  expect(container.querySelector('h3')?.textContent).toContain('Chưa xác minh');
});
test('reward failure does not show zero users in the approval heading', async () => {
  await mount(<Rewards adminId="test-admin" onRefresh={() => {}} />);
  expect(container.textContent).toContain('Không tải được dữ liệu thưởng');
  expect(container.textContent).not.toContain('(0 users)');
});
test('member chart panels show load errors instead of empty charts', async () => {
  await mount(<Members />);
  for (const heading of ['Joins vs Leaves', 'Top Invite Links']) {
    const title = [...container.querySelectorAll('h3')].find(h => h.textContent === heading)!;
    expect(title.parentElement?.parentElement?.textContent).toContain('Không tải được');
  }
});
for (const [name, element, errorText, emptyText] of [
  ['keys', <Keys />, 'Chưa thể xác nhận trạng thái key.', 'Chưa có key.'],
  ['flags', <Flags />, 'Không tải được cấu hình', 'Chưa có flag nào.'],
  ['persona', <Persona />, 'Không tải được persona;', 'Chưa có bản ghi persona riêng'],
  ['prompts', <Prompts />, 'Không thể xác minh lịch sử', 'Chưa có version nào.'],
  ['conversations', <Conversations />, 'Không tải được dữ liệu.', 'Không có hội thoại trong phạm vi đã chọn.'],
  ['allowlists', <Allowlists />, 'Không tải được danh sách handle.', 'Chưa có handle nào.'],
  ['father channel', <FatherChannel />, 'Không xác minh được cấu hình nhóm.', 'Chưa có nhóm Telegram nào'],
] as const) {
  test(`${name}: failed reads stay distinct from verified empty/default data`, async () => {
    await mount(element);
    expect(container.textContent).toContain(errorText);
    expect(container.textContent).not.toContain(emptyText);
    if (name === 'persona') {
      expect(button('Lưu tất cả').disabled).toBe(true);
      expect([...container.querySelectorAll('textarea')].every(input => input.disabled)).toBe(true);
    }
    if (name === 'keys') expect(button('Generate').disabled).toBe(true);
    if (name === 'prompts') expect(button('Snapshot version mới').disabled).toBe(true);
  });
}
