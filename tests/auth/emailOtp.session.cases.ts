import { expect, test } from 'bun:test';
import { runInNewContext } from 'node:vm';
import { createClient } from '@supabase/supabase-js';

test('the production client persists an OTP session across client recreation (mock auth network)', async () => {
  const storage = new Map<string,string>();
  const adapter = {getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>{storage.set(k,v);},removeItem:(k:string)=>{storage.delete(k);}};
  const source = (await Bun.file('src/integrations/supabase/client.ts').text())
    .replace(/^import .*;\n/gm,'')
    .replace('import.meta.env.VITE_SUPABASE_URL', "'https://otp-test.supabase.co'")
    .replace('import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY', "'fake-public-key'")
    .replace('export const supabase =', 'globalThis.testClient =');
  const js = new Bun.Transpiler({loader:'ts'}).transformSync(source);
  const make = () => {
    const context:any = {brokeredPreviewStorage:()=>adapter,createClient:(url:string,key:string,options:any)=>createClient(url,key,{...options,global:{fetch:async()=>new Response(JSON.stringify({id:'test-user',aud:'authenticated',role:'authenticated',email:'test@example.com'}),{status:200,headers:{'Content-Type':'application/json'}})}})};
    runInNewContext(js,context);return context.testClient;
  };
  const jwt = [Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600,sub:'test-user'})).toString('base64url'),Buffer.from('fake-signature').toString('base64url')].join('.');
  const first=make();
  const saved=await first.auth.setSession({access_token:jwt,refresh_token:'fake-refresh'});
  expect(saved.error).toBeNull();
  first.auth.stopAutoRefresh();
  const reloaded=make();
  expect((await reloaded.auth.getSession()).data.session?.user.id).toBe('test-user');
  reloaded.auth.stopAutoRefresh();
});
