import assert from "node:assert/strict";
import { withAiUsageContext, recordAiAttempt, aiUsageMeta } from "./ai-usage-context.ts";
Deno.test("AI provider usage stays isolated across overlapping requests and includes fallback attempts",async()=>{
 let release!:()=>void;const gate=new Promise<void>(r=>release=r);
 const one=withAiUsageContext(async()=>{recordAiAttempt("gemini");await gate;recordAiAttempt("lovable");return aiUsageMeta();});
 const two=await withAiUsageContext(async()=>{recordAiAttempt("lovable");await Promise.resolve();return aiUsageMeta();});
 release();assert.deepEqual(await one,{provider:"mixed",ai_providers:["gemini","lovable"],ai_attempts:{gemini:1,lovable:1}});
 assert.deepEqual(two,{provider:"lovable",ai_providers:["lovable"],ai_attempts:{lovable:1}});
 assert.equal(aiUsageMeta(),undefined);
});
