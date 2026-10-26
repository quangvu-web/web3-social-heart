import assert from "node:assert/strict";
Deno.env.set("SUPABASE_URL","https://backend.test");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY","test-service");
Deno.env.set("LOVABLE_API_KEY","test-lovable");
Deno.env.set("GEMINI_API_KEY","test-gemini");
const {callAiGateway}=await import("./ai-gateway-retry.ts");
const {invalidateFlagCache,getFlag,getFlagMeta}=await import("./angel/flags.ts");
let flag:unknown=null,dbError=false,directStatus=200,gatewayStatus=200,directMode="status";
const usageEvents:any[]=[];
let onUsageEvent=()=>{};
let onUsageUpdate=()=>{};
const usageUpdates:any[]=[];
const {withUsage}=await import("./track-cloud-usage.ts");
const sent:Array<{url:string;body:any;auth:string|null}>=[];
const logs:unknown[][]=[];
const good={choices:[{message:{content:"Please sit for meditation."}}]};
const originalFetch=globalThis.fetch;
const originalWarn=console.warn,originalLog=console.log,originalInfo=console.info;
console.warn=(...args)=>{logs.push(args);};console.log=(...args)=>{logs.push(args);};console.info=(...args)=>{logs.push(args);};
globalThis.fetch=async(input,init)=>{
 const url=String(input);
 if(url.includes("backend.test/rest/v1/angel_feature_flags"))return Response.json(dbError?{message:"unavailable"}:flag,{status:dbError?503:200});
 const body=JSON.parse(String(init?.body??"{}"));
 if(url.includes("backend.test/rest/v1/cloud_usage_events")){if(init?.method==="PATCH"){usageUpdates.push(body);onUsageUpdate();return Response.json(null);}usageEvents.push(body);onUsageEvent();return Response.json({id:"usage-row-1"});}
 if(url.includes("googleapis.com")){
  if(directMode==="network")throw new Error("test-gemini provider failure");
  if(directMode==="timeout")return await new Promise((_resolve,reject)=>init?.signal?.addEventListener("abort",()=>reject(new DOMException("Timeout","AbortError")),{once:true}));
  if(directMode==="malformed"){sent.push({url,body,auth:null});return Response.json({choices:[]});}
 }
 sent.push({url,body,auth:new Headers(init?.headers).get("Authorization")});
 const status=url.includes("googleapis.com")?directStatus:gatewayStatus;
 return Response.json(status===200?good:{error:"test-gemini must never appear in logs"},{status,headers:{"retry-after":"0.001"}});
};
function reset(value:unknown=null){directMode="status";usageEvents.length=0;flag=value;dbError=false;directStatus=200;gatewayStatus=200;sent.length=0;logs.length=0;invalidateFlagCache();Deno.env.delete("AI_PROVIDER");Deno.env.set("GEMINI_API_KEY","test-gemini");}
const body={model:"google/gemini-3.1-flash-lite",messages:[{role:"user",content:"Xin mời ngồi thiền."}],temperature:0.2};
const opts={label:"caption-translate",maxAttempts:2,timeoutMs:15000};
Deno.test("absent provider flag defaults to lovable even if env requests gemini",async()=>{
 reset();Deno.env.set("AI_PROVIDER","gemini");const result=await callAiGateway(body,opts);
 assert.equal(sent.length,1);assert.match(sent[0].url,/ai.gateway.lovable.dev/);assert.deepEqual(sent[0].body,body);
 assert.equal((result as any).provider,"lovable");
});
Deno.test("verified caption model routes direct with unchanged messages and temperature",async()=>{
 reset({enabled:true,meta:{value:"gemini"}});const result=await callAiGateway(body,opts);
 assert.equal(sent.length,1);assert.equal(sent[0].url,"https://generativelanguage.googleapis.com/v1beta/openai/chat/completions");
 assert.equal(sent[0].body.model,"models/gemini-3.1-flash-lite");assert.deepEqual(sent[0].body.messages,body.messages);assert.equal(sent[0].body.temperature,0.2);assert.equal(sent[0].auth,"Bearer test-gemini");assert.equal((result as any).provider,"gemini");
});
Deno.test("stage1 keeps all other labels and image_url on Gateway",async()=>{
 for(const input of [{...opts,label:"caption-summarize"},{...opts,label:"chat"},{...opts,label:"ocr"}]){reset({enabled:true,meta:{value:"gemini"}});await callAiGateway(body,input);assert.match(sent[0].url,/ai.gateway.lovable.dev/);}
 reset({enabled:true,meta:{value:"gemini"}});await callAiGateway({...body,messages:[{role:"user",content:[{type:"image_url",image_url:{url:"https://image.test/a.png"}}]}]},opts);assert.match(sent[0].url,/ai.gateway.lovable.dev/);
});
Deno.test("missing Gemini key falls back without interrupting caption",async()=>{
 reset({enabled:true,meta:{value:"gemini"}});Deno.env.delete("GEMINI_API_KEY");const result=await callAiGateway(body,opts);
 assert.equal(result.ok,true);assert.equal(sent.length,1);assert.match(sent[0].url,/ai.gateway/);assert.match(JSON.stringify(logs),/provider_fallback.*missing_key/);
});
Deno.test("direct429 retries then falls back with exact original Gateway call and safe logs",async()=>{
 reset({enabled:true,meta:{value:"gemini"}});directStatus=429;const result=await callAiGateway(body,opts);
 assert.equal(result.ok,true);assert.equal(sent.length,3);assert.equal(sent.filter(x=>x.url.includes("googleapis")).length,2);assert.deepEqual(sent[2].body,body);assert.equal(sent[2].auth,"Bearer test-lovable");
 assert.match(JSON.stringify(logs),/provider_fallback/);assert.doesNotMatch(JSON.stringify(logs),/test-gemini/);
});
Deno.test("direct auth error does not retry and still falls back",async()=>{
 reset({enabled:true,meta:{value:"gemini"}});directStatus=401;const result=await callAiGateway(body,opts);assert.equal(result.ok,true);assert.equal(sent.length,2);
});
Deno.test("DB read error uses validated env fallback; missing or invalid flag does not",async()=>{
 reset();dbError=true;Deno.env.set("AI_PROVIDER","gemini");await callAiGateway(body,opts);assert.match(sent[0].url,/googleapis/);
 reset({enabled:true,meta:{value:"typo"}});Deno.env.set("AI_PROVIDER","gemini");await callAiGateway(body,opts);assert.match(sent[0].url,/ai.gateway/);
});
Deno.test("unmapped override model is never guessed or sent to Google",async()=>{
 reset({enabled:true,meta:{value:"gemini"}});await callAiGateway({...body,model:"google/not-verified"},opts);assert.equal(sent.length,1);assert.match(sent[0].url,/ai.gateway/);assert.match(JSON.stringify(logs),/unmapped_model/);
});
Deno.test("direct5xx retries then falls back",async()=>{
 reset({enabled:true,meta:{value:"gemini"}});directStatus=503;
 assert.equal((await callAiGateway(body,opts)).ok,true);assert.equal(sent.length,3);
});
Deno.test("direct network errors and timeout fall back without logging private error contents",async()=>{
 for(const mode of ["network","timeout"]){reset({enabled:true,meta:{value:"gemini"}});directMode=mode;
 const result=await callAiGateway(body,{...opts,maxAttempts:1,timeoutMs:2});assert.equal(result.ok,true);assert.match(JSON.stringify(logs),/provider_fallback/);assert.doesNotMatch(JSON.stringify(logs),/test-gemini/);}
});
Deno.test("empty direct completion falls back instead of losing a live caption",async()=>{
 reset({enabled:true,meta:{value:"gemini"}});directMode="malformed";assert.equal((await callAiGateway(body,opts)).ok,true);assert.equal(sent.length,2);assert.match(sent[1].url,/ai.gateway/);
});
Deno.test("prototype property names cannot bypass the verified model allowlist",async()=>{
 reset({enabled:true,meta:{value:"gemini"}});await callAiGateway({...body,model:"toString"},opts);assert.equal(sent.length,1);assert.match(sent[0].url,/ai.gateway/);
});
Deno.test("cloud usage keeps one event and actual mixed providers on fallback",async()=>{
 reset({enabled:true,meta:{value:"gemini"}});directStatus=429;
 const handler=withUsage("angel-caption","Caption",async()=>{await callAiGateway(body,opts);return new Response("ok");});
 const received=new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error("usage event not sent")),200);onUsageEvent=()=>{clearTimeout(timer);resolve();};});
 await handler(new Request("https://caption.test/"));
 await received;
 assert.equal(usageEvents.length,1);assert.equal(usageEvents[0].function_name,"angel-caption");
 assert.equal(usageEvents[0].meta.provider,"mixed");assert.deepEqual(usageEvents[0].meta.ai_attempts,{gemini:2,lovable:1});
 for(const [message,context] of logs.filter(([message])=>String(message).startsWith("[ai-gateway]"))){assert.ok(context&&typeof context==="object");assert.equal((context as any).label,"caption-translate");assert.ok((context as any).provider);assert.ok((context as any).model);}
});
Deno.test("background AI updates provider metadata on the same usage event after webhook ACK",async()=>{
 reset({enabled:true,meta:{value:"gemini"}});usageUpdates.length=0;
 let release!:()=>void;const gate=new Promise<void>(r=>release=r);let background!:Promise<unknown>;
 const inserted=new Promise<void>(r=>onUsageEvent=r);
 const handler=withUsage("angel-caption","Caption",()=>{background=(async()=>{await gate;await callAiGateway(body,opts);})();return new Response("ACK");});
 const response=await handler(new Request("https://caption.test/"));assert.equal(await response.text(),"ACK");
 await inserted;assert.equal(usageEvents.length,1);
 const updated=new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error("background metadata missing")),200);onUsageUpdate=()=>{clearTimeout(timer);resolve();};});
 release();await background;await updated;
 assert.equal(usageEvents.length,1);assert.equal(usageUpdates.at(-1).meta.provider,"gemini");assert.deepEqual(usageUpdates.at(-1).meta.ai_attempts,{gemini:1});
});
Deno.test("disabled provider stays lovable and existing boolean/meta flags retain their contract",async()=>{
 reset({enabled:false,meta:{value:"gemini",marker:"retained"}});await callAiGateway(body,opts);assert.match(sent[0].url,/ai.gateway/);
 assert.equal(await getFlag("cost.postprocess_enabled",true),false);
 assert.deepEqual(await getFlagMeta("cost.postprocess_enabled"),{value:"gemini",marker:"retained"});
 reset();assert.equal(await getFlag("cost.postprocess_enabled",true),true);
});
Deno.test("restore test boundary",()=>{globalThis.fetch=originalFetch;console.warn=originalWarn;console.log=originalLog;console.info=originalInfo;});
