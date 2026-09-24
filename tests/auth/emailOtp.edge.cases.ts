import { beforeEach, expect, test } from 'bun:test';
import { runInNewContext } from 'node:vm';

// Run the actual Deno handlers; replace only hosted DB, mail and Telegram boundaries.
let rateCalls: any[], writes: any[], sent: number, sessions: number;
let rateError: boolean, insertError: boolean, deleteError: boolean, fetchError: boolean;
let updateError: boolean;
let delivery: 'ok'|'error'|'throw'|'missing';
let record: any, telegram: any;
const client = {
 rpc: async (name:string,args:any) => {
  if(name==='check_rate_limit') {rateCalls.push(args);return {data:rateError?null:{allowed:rateCalls.length<=3,remaining:3-rateCalls.length},error:rateError?{message:'private db detail'}:null};}
  return {data:'user-1',error:null};
 },
 from: (table:string) => {
  let op='',value:any,filters:[string,string,any][]=[];
  const query:any = {
   select:()=>{op='select';return query;},delete:()=>{op='delete';return query;},insert:(v:any)=>{op='insert';value=v;return query;},update:(v:any)=>{op='update';value=v;return query;},
   eq:(k:string,v:any)=>{filters.push(['eq',k,v]);return query;},gt:(k:string,v:any)=>{filters.push(['gt',k,v]);return query;},order:()=>query,limit:()=>query,
   maybeSingle:async()=>{
    if(table==='profiles')return {data:{id:'user-1'},error:null};
    const match=record && filters.every(([cmp,k,v])=>cmp==='eq'?record[k]===v:record[k]>v);
    return {data:match?{...record}:null,error:fetchError?{message:'private db detail'}:null};
   },
   then:(resolve:any,reject:any)=>Promise.resolve().then(()=>{
    writes.push({table,op,value,filters});
    const matched = record && filters.every(([cmp,k,v])=>cmp==='eq'?record[k]===v:record[k]>v);
    if(table==='otp_codes'&&op==='update'&&matched&&!updateError)Object.assign(record,value);
    return {count:matched?1:0,error:(op==='update'&&updateError)||(op==='insert'&&insertError)||(op==='delete'&&deleteError)?{code:'42501',message:'private db detail'}:null};
   }).then(resolve,reject),
  }; return query;
 },
 auth:{admin:{getUserById:async()=>({data:{user:{id:'user-1'}},error:null}),generateLink:async()=>({data:{properties:{action_link:'https://example.test?token=fake&type=magiclink'}},error:null})},verifyOtp:async()=>{sessions++;return {data:{session:{access_token:'fake-access',refresh_token:'fake-refresh'}},error:null};}},
};
async function load(name:string){
 const source=await Bun.file(`supabase/functions/${name}/index.ts`).text();
 const js=new Bun.Transpiler({loader:'ts'}).transformSync(source.replace(/^import .*;\n/gm,''));
 let handler!:(r:Request)=>Promise<Response>;
 runInNewContext(js, {Request,Response,URL,crypto,Date,Math,Uint8Array,console:{log(){},warn(){},error(){}},
  createClient:()=>client,
  Resend:class {emails={send:async()=>{sent++;if(delivery==='throw')throw new Error('provider secret');return {data:delivery==='ok'?{id:'mail-1'}:null,error:delivery==='error'?{message:'provider secret'}:null};}};},
  createTelegramChallenge:async()=>telegram,
  Deno:{serve:(h:any)=>{handler=h;},env:{get:(k:string)=>k==='RESEND_API_KEY'?(delivery==='missing'?undefined:'fake-key'):'fake-config'}},
 });return handler;
}
const request=await load('sso-otp-request');const verify=await load('sso-otp-verify');
function req(body:unknown){return new Request('http://local.test',{method:'POST',body:JSON.stringify(body),headers:{'Content-Type':'application/json'}});}
beforeEach(()=>{rateCalls=[];writes=[];updateError=false;sent=0;sessions=0;rateError=false;insertError=false;deleteError=false;fetchError=false;delivery='ok';telegram={ok:false,code:'not_enabled'};record={id:'otp-1',identifier:'test@example.com',type:'email',code:'123456',is_used:false,attempts:0,max_attempts:5,expires_at:new Date(Date.now()+300000).toISOString()};});
test('successful send requires email provider acceptance and normalized storage',async()=>{const r=await request(req({identifier:' Test@Example.COM ',type:'email'}));expect(r.status).toBe(200);expect(await r.json()).toMatchObject({success:true,email_sent:true});expect(writes.find(w=>w.op==='insert').value.identifier).toBe('test@example.com');expect(rateCalls[0]).toMatchObject({p_key:'otp_request:test@example.com',p_limit:3,p_window_ms:3600000});});
for(const mode of ['error','throw','missing'] as const)test(`delivery ${mode} cannot return success`,async()=>{delivery=mode;const r=await request(req({identifier:'test@example.com'}));expect(r.status).toBeGreaterThanOrEqual(500);expect(await r.json()).toMatchObject({success:false,email_sent:false,error_code:'email_delivery_failed'});});
test('fourth request in an hour is rejected without sending another email',async()=>{for(let i=0;i<3;i++)expect((await request(req({identifier:'test@example.com'}))).status).toBe(200);const r=await request(req({identifier:'test@example.com'}));expect(r.status).toBe(429);expect(sent).toBe(3);});
test('database rate limiter failure never fails open',async()=>{rateError=true;const r=await request(req({identifier:'test@example.com'}));expect(r.status).toBe(503);expect(sent).toBe(0);expect(writes).toEqual([]);});
for(const kind of ['insert','delete'])test(`database ${kind} failure does not send mail`,async()=>{insertError=kind==='insert';deleteError=kind==='delete';const r=await request(req({identifier:'test@example.com'}));expect(r.status).toBe(500);expect(sent).toBe(0);expect(JSON.stringify(await r.json())).not.toContain('private db detail');});
for(const identifier of [null,{},123,'not-email'])test(`invalid input is rejected before rate quota: ${JSON.stringify(identifier)}`,async()=>{const r=await request(req({identifier}));expect(r.status).toBe(400);expect(rateCalls).toEqual([]);expect(sent).toBe(0);});
test('correct OTP creates a session once, reused OTP is rejected',async()=>{let r=await verify(req({identifier:' Test@Example.COM ',code:'123456'}));expect(r.status).toBe(200);expect(await r.json()).toMatchObject({success:true,access_token:'fake-access'});r=await verify(req({identifier:'test@example.com',code:'123456'}));expect(r.status).toBe(400);expect(sessions).toBe(1);});
test('wrong OTP increases attempts and creates no session',async()=>{const r=await verify(req({identifier:'test@example.com',code:'000000'}));expect(r.status).toBe(400);expect(record.attempts).toBe(1);expect(sessions).toBe(0);});
test('expired OTP creates no session',async()=>{record.expires_at=new Date(Date.now()-1000).toISOString();expect((await verify(req({identifier:'test@example.com',code:'123456'}))).status).toBe(400);expect(sessions).toBe(0);});
test('database read errors are service errors, not expired OTP',async()=>{fetchError=true;const r=await verify(req({identifier:'test@example.com',code:'123456'}));expect(r.status).toBe(500);expect(sessions).toBe(0);});
test('Telegram enabled returns only a challenge, never tokens',async()=>{telegram={ok:true,challengeId:'challenge-1',expiresInSeconds:300};const r=await verify(req({identifier:'test@example.com',code:'123456'}));expect(await r.json()).toMatchObject({requires_telegram_2fa:true,challenge_id:'challenge-1'});expect(sessions).toBe(0);});
test('Telegram failure cannot fall through to session creation',async()=>{telegram={ok:false,code:'delivery_failed',error:'private service detail'};const r=await verify(req({identifier:'test@example.com',code:'123456'}));expect(r.status).toBe(500);expect(sessions).toBe(0);});

test('failed OTP consumption never creates a session',async()=>{updateError=true;const r=await verify(req({identifier:'test@example.com',code:'123456'}));expect(r.status).toBe(500);expect(sessions).toBe(0);expect(record.is_used).toBe(false);});
test('failed attempt counter write returns a service error',async()=>{updateError=true;const r=await verify(req({identifier:'test@example.com',code:'000000'}));expect(r.status).toBe(500);expect(sessions).toBe(0);});
test('verify limiter failure cannot create a session',async()=>{rateError=true;const r=await verify(req({identifier:'test@example.com',code:'123456'}));expect(r.status).toBe(503);expect(sessions).toBe(0);});
