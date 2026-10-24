import assert from "node:assert/strict";
import ts from "npm:typescript@5.8.3";
const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
const handler = source.slice(
  source.indexOf("export async function handleGroupAiMention"),
  source.indexOf("// EdgeRuntime is a Deno Deploy"),
);
const builder = source.slice(
  source.indexOf("function directTelegramText"),
  source.indexOf("type TelegramEventType"),
);
const code = ts.transpileModule(
  `
 export const visionCalls=[],questions=[],mediaCalls=[],replies=[],cacheReads=[],marks=[];
 let config={};
 export function configure(v={}){config=v;for(const a of [visionCalls,questions,mediaCalls,replies,cacheReads,marks])a.length=0;}
 function getClients(){return {adminClient:{rpc:async()=>({})}};}
 async function getChatMember(){return {data:{result:{status:config.memberStatus??'member'}}};}
 async function getBotInfo(){return {id:7,username:'fixture_bot'};}
 function fullName(){return 'Test';}
 function detectHelpIntent(t){return t.includes('giúp');}function detectPositiveEngagement(t){return t.includes('biết ơn');}
 async function positiveEngagementAllowed(){return {allowed:true};}
 function buildTelegramGroupContext(m){return m.reply_to_message?{reply_author:{display_name:'Other'},response_task:m.text??m.caption}:null;}
 function detectCommunitySupportRequest(){return false;}
 const DEFAULT_POSITIVE_ENGAGEMENT_PROMPT='{{content}}',DEFAULT_HELP_INTENT_PROMPT='{{content}}';
 async function getSettingsForGroup(){if(config.settingsError)throw Error('fixture unavailable');return config.groupSettings===null?null:{group_id:-1001,group_vision_enabled:true,reply_language:'en',...config.groupSettings};}
 function resolveGroupReplyLanguage(_p,lang){return {bucket:lang==='en'?'en':'vi',botVoiceBucket:lang,policyNote:lang==='en'?'English policy':'Vietnamese policy'};}
 function addressRuleForActor(){return '';}
 async function acquireAiMessageLock(){return {acquired:config.lock!==false};}
 async function hasActiveMiniAppBuilderMode(){return false;}
 function classifyAiDecision(){return {category:'factual',cacheable:true};}
 async function sha256Hex(t){return t;}function normalizeAiCachePrompt(t){return t;}
 function classifyMessageType(){return 'photo';}
 async function repeatedAiSpamDetected(){return false;}
 const FUN_PROFILE_PLATFORM_FACTS='fixture facts';
 function getAngelProvider(){return 'funcore';}
 async function getAiCachedResponse(p){cacheReads.push(p);return config.answerCache??null;}
 async function checkAiDecisionLimit(){return {allowed:config.rate!==false};}
 function detectEventFollowupIntent(){return null;}function eventFollowupSenderText(){return '';}
 function hasAnalyzableImage(m){return !!m.photo?.length||m.document?.mime_type?.startsWith('image/');}
 function pickLargestPhotoFileId(m){return {fileId:m.photo?.at(-1).file_id??m.document?.file_id};}
 function detectImageIntent(t){return t.includes('Sửa ảnh')?{mode:'edit'}:null;}
 async function tryFetchTelegramMedia(id){mediaCalls.push(id);return {base64:'fixture',mime:'image/png'};}
 async function describeTelegramImage(m,caption){visionCalls.push({m,caption});return 'description'in config?config.description:'FUN Profile; Hẹn gặp lúc 19:00 MYT';}
 function buildImageAnalysisContext(desc,caption){return 'IMAGE_ANALYSIS_CONTEXT '+desc+' REQUEST '+caption;}
 async function getFlag(){return false;}
 async function withTyping(_id,cb){return cb();}
 async function askAngel(params){questions.push(params);return 'Reply grounded in image.';}
 async function sendMessage(_id,text){replies.push(text);}
 async function saveAiCachedResponse(){}async function logAiRuntime(){}async function logAiAudit(){}
 async function markAiMessageLock(p){marks.push(p);}function estimateTokens(){return 1;}
 ${builder}
 ${handler}
`,
  {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;
const f = await import(
  "data:application/javascript," + encodeURIComponent(code)
);
const photos = [{ file_id: "small", file_unique_id: "small" }, {
  file_id: "large",
  file_unique_id: "large",
}];
const message = {
  chat: { id: -1001, type: "supergroup" },
  from: { id: 42, first_name: "Test" },
  message_id: 100,
  photo: photos,
  caption: "@fixture_bot Ảnh có chữ gì?",
};
const settings = {
  ai_enabled: true,
  always_reply_owner: true,
  always_reply_admins: true,
  positive_engagement_enabled: true,
};
Deno.test("group mention grounds one largest current photo, bypasses caption answer cache and retains English policy", async () => {
  f.configure({ answerCache: "WRONG old image answer" });
  await f.handleGroupAiMention(message, settings);
  assert.equal(f.visionCalls.length, 1);
  assert.equal(f.visionCalls[0].m.photo.at(-1).file_id, "large");
  assert.equal(f.questions.length, 1);
  assert.match(f.questions[0].question, /19:00 MYT/);
  assert.match(f.questions[0].imageAnalysisContext, /19:00 MYT/);
  assert.equal(f.questions[0].forcedLangBucket, "en");
  assert.equal(f.questions[0].languagePolicyNote, "English policy");
  assert.equal(f.questions[0].attachments, undefined);
  assert.equal(f.cacheReads.length, 0);
  assert.equal(f.mediaCalls.length, 0);
});
Deno.test("reply photo is used only without current photo, preserving speaker context and parent group cache scope", async () => {
  const reply = {
    message_id: 99,
    photo: [{ file_id: "reply-large" }],
    from: { id: 55, first_name: "Other", is_bot: false },
  };
  f.configure();
  await f.handleGroupAiMention({
    ...message,
    photo: undefined,
    caption: undefined,
    text: "@fixture_bot Ảnh này ghi gì?",
    reply_to_message: reply,
  }, settings);
  assert.equal(f.visionCalls.length, 1);
  assert.equal(f.visionCalls[0].m.photo[0].file_id, "reply-large");
  assert.equal(f.visionCalls[0].m.chat.id, -1001);
  assert.equal(
    f.questions[0].telegramGroupContext.reply_author.display_name,
    "Other",
  );
  f.configure();
  await f.handleGroupAiMention(
    { ...message, reply_to_message: reply },
    settings,
  );
  assert.equal(f.visionCalls[0].m.photo.at(-1).file_id, "large");
});
Deno.test("only explicit calls allow vision, including owner/admin mentions, ask and photo reply-to-bot", async () => {
  for (const memberStatus of ["creator", "administrator", "member"]) {
    f.configure({ memberStatus });
    await f.handleGroupAiMention(message, settings);
    assert.equal(f.visionCalls.length, 1, memberStatus);
  }
  for (
    const m of [{ ...message, caption: "/ask Ảnh ghi gì?" }, {
      ...message,
      caption: undefined,
      reply_to_message: { from: { id: 7, is_bot: true } },
    }]
  ) {
    f.configure();
    await f.handleGroupAiMention(m, settings);
    assert.equal(f.visionCalls.length, 1);
  }
  for (
    const [memberStatus, caption] of [
      ["creator", "Hẹn gặp tối nay"],
      ["administrator", "Hẹn gặp tối nay"],
      ["member", "giúp bé với"],
      ["member", "biết ơn"],
      ["member", "Ảnh thông thường"],
    ]
  ) {
    f.configure({ memberStatus });
    await f.handleGroupAiMention({ ...message, caption }, settings);
    assert.equal(f.visionCalls.length, 0, caption);
    assert.equal(f.mediaCalls.length, 0, caption);
  }
});
Deno.test("group switch and lookup failure suppress description/raw photo while text replies remain unchanged", async () => {
  for (
    const config of [{ groupSettings: { group_vision_enabled: false } }, {
      settingsError: true,
    }, { groupSettings: null }]
  ) {
    f.configure(config);
    await f.handleGroupAiMention(message, settings);
    assert.equal(f.visionCalls.length, 0);
    assert.equal(f.mediaCalls.length, 0);
    assert.equal(f.questions[0].question, "Ảnh có chữ gì?");
    assert.equal(f.questions[0].attachments, undefined);
  }
});
Deno.test("null vision is truthful and never asks text AI to invent an image; lock/rate/other commands do not spend vision", async () => {
  f.configure({ description: null });
  await f.handleGroupAiMention(message, settings);
  assert.equal(f.questions.length, 0);
  assert.match(f.replies[0], /could not read|unable to read/i);
  assert.equal(f.marks.at(-1).status, "responded");
  for (const config of [{ lock: false }, { rate: false }]) {
    f.configure(config);
    await f.handleGroupAiMention(message, settings);
    assert.equal(f.visionCalls.length, 0);
  }
  f.configure();
  await f.handleGroupAiMention(
    { ...message, caption: "/play @fixture_bot" },
    settings,
  );
  assert.equal(f.visionCalls.length, 0);
});

Deno.test("raw image documents cannot bypass disabled/missing group settings or explicit-call cost gate", async () => {
  const imageDocument = {
    ...message,
    photo: undefined,
    document: { file_id: "document-image", mime_type: "image/png" },
  };
  for (
    const config of [{ groupSettings: { group_vision_enabled: false } }, {
      settingsError: true,
    }, { groupSettings: null }]
  ) {
    f.configure(config);
    await f.handleGroupAiMention(imageDocument, settings);
    assert.equal(f.mediaCalls.length, 0);
    assert.equal(f.questions[0].attachments, undefined);
  }
  f.configure({ memberStatus: "administrator" });
  await f.handleGroupAiMention(
    { ...imageDocument, caption: "giúp bé với" },
    settings,
  );
  assert.equal(f.mediaCalls.length, 0);
  f.configure();
  await f.handleGroupAiMention(imageDocument, settings);
  assert.equal(
    f.mediaCalls.length,
    1,
    "explicit authorized document retains existing media route",
  );
});
