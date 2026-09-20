import { beforeEach, afterEach, expect, mock, test } from 'bun:test';
import { Window } from 'happy-dom';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const browser = new Window({ url: 'https://fun.example/auth?oauth_callback=google' });
for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'Event', 'InputEvent', 'KeyboardEvent', 'CustomEvent', 'MutationObserver', 'ResizeObserver', 'localStorage', 'sessionStorage']) {
  Object.defineProperty(globalThis, key, { configurable: true, value: key === 'window' ? browser : browser[key] });
}
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, getComputedStyle: browser.getComputedStyle.bind(browser), requestAnimationFrame: browser.requestAnimationFrame.bind(browser), cancelAnimationFrame: browser.cancelAnimationFrame.bind(browser) });
const googleSession = { user: { id: 'google-user' }, access_token: 'first-factor-token' };
let session: typeof googleSession | null;
let response: { data: unknown; error: Error | null };
let starts: number;
let startAuthorization: string | undefined;
let otpValid: boolean;
let profileCreatedAt: string;
let createdWallets: string[];
let oauthRedirect: string;
let listeners = new Set<(event: string, value: unknown) => void>();
const emit = (event: string) => listeners.forEach(listener => listener(event, session));
mock.module('../../src/integrations/supabase/client', () => ({ supabase: {
  auth: {
    signInWithOAuth: async ({ options }: { options: { redirectTo: string } }) => { oauthRedirect = options.redirectTo; return { error: null }; },
    getSession: async () => ({ data: { session }, error: null }),
    onAuthStateChange: (listener: (event: string, value: unknown) => void) => {
      listeners.add(listener);
      return { data: { subscription: { unsubscribe: () => listeners.delete(listener) } } };
    },
    setSession: async ({ access_token }: { access_token: string }) => { session = { ...googleSession, access_token }; emit('SIGNED_IN'); return { error: null }; },
    signOut: async () => { session = null; emit('SIGNED_OUT'); return { error: null }; },
  },
  from: () => ({
    select: () => ({ eq: () => ({ count: 1, error: null, maybeSingle: async () => ({ data: { created_at: profileCreatedAt }, error: null }) }) }),
    update: () => ({ eq: async () => ({ error: null }) }),
  }),
  functions: { invoke: async (name: string, options?: { body?: { user_id: string }; headers?: { Authorization?: string } }) => {
    if (name === 'create-custodial-wallet') { createdWallets.push(options?.body?.user_id || ''); return { data: { success: true }, error: null }; }
    if (name === 'telegram-2fa-verify') return otpValid
      ? { data: { success: true, user_id: 'google-user', access_token: 'verified-token', refresh_token: 'verified-refresh' }, error: null }
      : { data: { success: false, error: 'Invalid Telegram OTP' }, error: null };
    starts++; startAuthorization = options?.headers?.Authorization; return response;
  } },
} }));
mock.module('../../src/i18n/LanguageContext', () => ({ useLanguage: () => ({ t: (key: string) => key }) }));
mock.module('../../src/components/layout/LanguageSwitcher', () => ({ default: () => null }));
mock.module('../../src/features/auth/AuthTabs', () => ({ AuthTabs: () => <div>Login methods</div> }));
mock.module('../../src/features/auth/wallet/EmailVerifyGate', () => ({ EmailVerifyGate: () => null }));
mock.module('../../src/contexts/AuthContext', () => ({ useAuth: () => ({ session, profile: { law_of_light_accepted: true }, isLoading: false, bootstrapError: null }) }));
const { SocialLogin } = await import('../../src/modules/auth/components/SocialLogin');
const { default: Auth } = await import('../../src/modules/auth/pages/Auth');
const { LawOfLightGuard } = await import('../../src/modules/auth/components/LawOfLightGuard');
let root: Root;
let container: HTMLDivElement;
async function mount({ accepted = true, guarded = false, url = '/auth?oauth_callback=google' } = {}) {
  if (accepted) localStorage.setItem('law_of_light_accepted_pending', 'true');
  await act(async () => {
    root.render(<MemoryRouter initialEntries={[url]}><Routes>
      <Route path="/auth" element={guarded ? <LawOfLightGuard><Auth /></LawOfLightGuard> : <Auth />} />
      <Route path="/" element={<div>Authenticated feed</div>} />
      <Route path="/law-of-light" element={<div>Law acceptance</div>} />
    </Routes></MemoryRouter>);
  });
}
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); listeners = new Set();
  sessionStorage.setItem('google_oauth_2fa_pending', 'true');
  session = googleSession; starts = 0; startAuthorization = undefined; otpValid = true; profileCreatedAt = '2020-01-01'; createdWallets = []; oauthRedirect = '';
  response = { data: { success: true, requires_telegram_2fa: true, challenge_id: 'challenge-1', user_id: 'google-user' }, error: null };
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

test('the routed Google callback displays Telegram OTP before the feed', async () => {
  await mount();
  expect(container.textContent).toContain('Telegram code');
  expect(container.textContent).not.toContain('Authenticated feed');
  expect(session).toBeNull();
  expect(starts).toBe(1);
  expect(startAuthorization).toBe('Bearer first-factor-token');
});
test('Telegram service failure blocks login and clears the first-factor session', async () => {
  response = { data: null, error: new Error('service unavailable') };
  await mount();
  expect(container.textContent).not.toContain('Authenticated feed');
  expect(container.querySelector('[role="alert"]')).not.toBeNull();
  expect(session).toBeNull();
  expect(sessionStorage.getItem('google_oauth_2fa_pending')).toBeNull();
});
test('a malformed challenge cannot complete login', async () => {
  response = { data: { success: true, requires_telegram_2fa: true }, error: null };
  await mount();
  expect(container.textContent).not.toContain('Authenticated feed');
  expect(session).toBeNull();
  expect(sessionStorage.getItem('google_oauth_2fa_pending')).toBeNull();
});
test('accounts with Telegram 2FA explicitly disabled can continue', async () => {
  response = { data: { success: true, requires_telegram_2fa: false }, error: null };
  await mount();
  expect(container.textContent).toContain('Authenticated feed');
  expect(sessionStorage.getItem('google_oauth_2fa_pending')).toBeNull();
});
test('a late SIGNED_IN event starts the Telegram challenge once', async () => {
  session = null;
  await mount();
  await act(async () => { session = googleSession; emit('SIGNED_IN'); await new Promise(resolve => setTimeout(resolve, 20)); });
  expect(container.textContent).toContain('Telegram code');
  expect(starts).toBe(1);
});
test('the law guard allows the OAuth callback even after pending acceptance was cleared', async () => {
  await mount({ accepted: false, guarded: true });
  expect(container.textContent).toContain('Telegram code');
  expect(container.textContent).not.toContain('Law acceptance');
});

test('the pending marker also handles callbacks whose query string was lost', async () => {
  await mount({ url: '/auth' });
  expect(container.textContent).toContain('Telegram code');
});
test('cancelling Telegram verification returns to login without a session', async () => {
  await mount();
  const back = [...container.querySelectorAll('button')].find(button => button.textContent === 'Back');
  await act(async () => back!.click());
  expect(container.textContent).toContain('Login methods');
  expect(session).toBeNull();
  expect(sessionStorage.getItem('google_oauth_2fa_pending')).toBeNull();
});

async function submitOtp() {
  const input = container.querySelector('input')!;
  await act(async () => { input.value = '123456'; Simulate.change(input); });
  const verify = [...container.querySelectorAll('button')].find(button => button.textContent?.includes('Verify Telegram'))!;
  expect(verify.disabled).toBe(false);
  await act(async () => verify.click());
}
test('a valid Telegram OTP restores the session and completes Google login', async () => {
  await mount();
  await submitOtp();
  expect(container.textContent).toContain('Authenticated feed');
  expect(session?.access_token).toBe('verified-token');
  expect(sessionStorage.getItem('google_oauth_2fa_pending')).toBeNull();
});
test('an invalid Telegram OTP keeps the user on the challenge without a session', async () => {
  otpValid = false;
  await mount();
  await submitOtp();
  expect(container.textContent).toContain('Telegram code');
  expect(container.textContent).not.toContain('Authenticated feed');
  expect(session).toBeNull();
});

test('SSO receives only the session issued after Telegram verification', async () => {
  const originalFetch = globalThis.fetch;
  const authorizations: string[] = [];
  globalThis.fetch = (async (_url, init) => {
    authorizations.push(new Headers(init?.headers).get('Authorization') || '');
    return new Response('{}', { headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  try {
    await mount({ url: '/auth?oauth_callback=google&sso_flow=true&return_to=https%3A%2F%2Ffun.example%2Fauthorize' });
    expect(authorizations).toEqual([]);
    await submitOtp();
    expect(authorizations).toEqual(['Bearer verified-token']);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Google signup runs account setup before completing login', async () => {
  profileCreatedAt = new Date().toISOString();
  response = { data: { success: true, requires_telegram_2fa: false }, error: null };
  await mount();
  expect(createdWallets).toEqual(['google-user']);
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 850)); });
  expect(container.textContent).toContain('Authenticated feed');
});
test('the Google launch URL preserves the SSO return destination', async () => {
  browser.history.replaceState(null, '', '/auth?sso_flow=true&return_to=https%3A%2F%2Ffun.example%2Fauthorize');
  try {
    await act(async () => root.render(<SocialLogin />));
    await act(async () => container.querySelector('button')!.click());
    const callback = new URL(oauthRedirect);
    expect(callback.searchParams.get('oauth_callback')).toBe('google');
    expect(callback.searchParams.get('sso_flow')).toBe('true');
    expect(callback.searchParams.get('return_to')).toBe('https://fun.example/authorize');
  } finally {
    browser.history.replaceState(null, '', '/auth?oauth_callback=google');
  }
});
