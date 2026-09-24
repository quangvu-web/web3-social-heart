import { beforeEach, afterEach, expect, mock, test } from 'bun:test';
import { Window } from 'happy-dom';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import { FunctionsHttpError, FunctionsFetchError } from '@supabase/supabase-js';
const browser = new Window({ url: 'http://localhost/auth' });
for (const key of ['window','document','navigator','HTMLElement','HTMLInputElement','Event','InputEvent','KeyboardEvent','CustomEvent','MutationObserver','ResizeObserver','localStorage','sessionStorage']) {
  Object.defineProperty(globalThis, key, { configurable: true, value: key === 'window' ? browser : browser[key] });
}
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true, getComputedStyle: browser.getComputedStyle.bind(browser), requestAnimationFrame: browser.requestAnimationFrame.bind(browser), cancelAnimationFrame: browser.cancelAnimationFrame.bind(browser) });
let result: {data: any; error: any};
let calls: {name: string; body: any}[];
let messages: string[];
let successes: string[];
let completed: string[];
let sessions: number;
let pending: Promise<typeof result> | null;
mock.module('../../src/integrations/supabase/client', () => ({ supabase: {
 functions: { invoke: async (name: string, {body}: any) => {calls.push({name,body}); return pending ?? result;} },
 auth: { setSession: async () => {sessions++; return {error:null};}, getSession: async () => ({data:{session:{user:{id:'test-user'}}}}) },
 from: () => ({update: () => ({eq: async () => ({error:null})})}),
} }));
mock.module('sonner', () => ({toast:{error:(s:string)=>messages.push(s),success:(s:string)=>successes.push(s)}}));
// Exercise the real translations and saved-language provider.
const { LanguageProvider } = await import('../../src/i18n/LanguageContext');
const { EmailOtpLogin } = await import('../../src/modules/auth/components/EmailOtpLogin');
let root: Root, container: HTMLDivElement;
beforeEach(() => {
 localStorage.clear(); messages=[];successes=[];completed=[];sessions=0;calls=[];pending=null;
 result={data:{success:true,email_sent:true},error:null};
 container=document.createElement('div');document.body.append(container);root=createRoot(container);
});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();});
async function mount(lang='vi') {
 localStorage.setItem('fun_profile_language',lang);
 await act(async()=>root.render(<LanguageProvider><EmailOtpLogin onSuccess={id=>completed.push(id)}/></LanguageProvider>));
 await act(async()=>{const el=container.querySelector('input')!;el.value=' Test@Example.COM ';Simulate.change(el);});
}
async function send(){await act(async()=>container.querySelector('button')!.click());}
async function verify(){await act(async()=>{const el=container.querySelector('input')!;el.value='123456';Simulate.change(el);});await send();}
function http(status:number,body:unknown){return {data:null,error:new FunctionsHttpError(new Response(typeof body==='string'?body:JSON.stringify(body),{status}))};}
test('429 from the deployed function is translated rather than exposing the SDK error',async()=>{
 await mount();result=http(429,{success:false,error:'Too many OTP requests. Please wait before trying again (max 3 per hour).',retry_after_seconds:3600});await send();
 expect(messages[0]).toContain('3');expect(messages[0]).toContain('giờ');expect(messages[0]).not.toContain('Edge Function');expect(container.querySelector('#email')).not.toBeNull();
});
test('normalizes the same email for sending and verifying',async()=>{await mount();await send();result={data:{success:true,user_id:'test-user',access_token:'fake',refresh_token:'fake'},error:null};await verify();expect(calls.map(c=>c.body.identifier)).toEqual(['test@example.com','test@example.com']);expect(completed).toEqual(['test-user']);});
test('Enter plus repeated clicks cannot send duplicate requests',async()=>{await mount();let resolve!: (r:typeof result)=>void;pending=new Promise(r=>resolve=r);await act(async()=>{const input=container.querySelector('input')!;Simulate.keyDown(input,{key:'Enter'});Simulate.keyDown(input,{key:'Enter'});container.querySelector('button')!.click();});expect(calls.length).toBe(1);await act(async()=>resolve(result));});
for (const data of [{success:true,email_sent:false},{success:true},{success:false,error_code:'email_delivery_failed'}]) {
 test(`does not advance when delivery is unconfirmed: ${JSON.stringify(data)}`,async()=>{await mount();result={data,error:null};await send();expect(container.querySelector('#email')).not.toBeNull();expect(successes).toEqual([]);expect(messages.length).toBe(1);});
}
for (const [status,body] of [[500,{error:'permission denied private database detail'}],[502,'<html>upstream secret</html>'],[401,{message:'Invalid JWT'}],[404,{message:'not found'}]] as const) {
 test(`safe localized message for ${status}`,async()=>{await mount();result=http(status,body);await send();expect(messages).toEqual(['Không gửi được yêu cầu đăng nhập. Vui lòng thử lại sau.']);});
}
test('network failure respects saved English',async()=>{await mount('en');result={data:null,error:new FunctionsFetchError(new Error('offline'))};await send();expect(messages[0]).toBe('Email sign-in is temporarily unavailable. Please try again shortly.');});
for(const [error,want] of [['Invalid OTP code','Mã OTP không hợp lệ'],['OTP expired or not found. Please request a new one.','Mã OTP đã hết hạn']]) {
 test(`verification rejection stays on OTP: ${error}`,async()=>{await mount();await send();result=http(400,{success:false,error});await verify();expect(messages).toEqual([want]);expect(completed).toEqual([]);expect(sessions).toBe(0);});
}
test('required Telegram challenge never sets an email-only session',async()=>{await mount();await send();result={data:{success:true,requires_telegram_2fa:true,challenge_id:'c',user_id:'test-user'},error:null};await verify();expect(container.textContent).toContain('Telegram');expect(sessions).toBe(0);expect(completed).toEqual([]);});
test('malformed required Telegram challenge cannot fall through to tokens',async()=>{await mount();await send();result={data:{success:true,requires_telegram_2fa:true,user_id:'test-user',access_token:'fake',refresh_token:'fake'},error:null};await verify();expect(sessions).toBe(0);expect(completed).toEqual([]);expect(messages.length).toBe(1);});
test('no saved language defaults to Vietnamese even in an English browser',async()=>{await act(async()=>root.render(<LanguageProvider><EmailOtpLogin onSuccess={()=>{}}/></LanguageProvider>));expect(container.querySelector('button')!.textContent).toContain('Gửi');});
test('verify rate limit does not claim the email sending quota was exhausted',async()=>{await mount();await send();result=http(429,{success:false,error:'Too many failed attempts. Please request a new OTP.'});await verify();expect(messages[0]).toContain('xác thực');expect(messages[0]).not.toContain('3 yêu cầu');expect(sessions).toBe(0);});
