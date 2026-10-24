import assert from "node:assert/strict";
import ts from "npm:typescript@5.8.3";
const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
const handler = source.slice(
  source.indexOf("export async function handlePrivateMessage"),
  source.indexOf("async function handleVerificationCallback"),
);
const code = ts.transpileModule(
  `
 export const replies=[],questions=[],visionCalls=[],mediaCalls=[];
 let description='FUN Profile. Nền trắng, chữ Hẹn gặp lúc 19:00 MYT.';
 export function configure(v){description=v;replies.length=questions.length=visionCalls.length=mediaCalls.length=0;}
 function extractText(m){return m.text??m.caption??'';}
 function getClients(){return {adminClient:{}};}
 async function sendMessage(_id,text){replies.push(text);return {ok:true};}
 async function trackBotDmReply(){} async function trackDmEvent(){}
 async function sendChatAction(){} async function ensureSettings(){return {};}
 async function isCaptionOperator(){return false;}
 async function checkAndUpdateAiRate(){return {allowed:true,count:1};}
 function detectTranslationTargetLanguage(){return null;}
 async function getPendingDmTranslationTarget(){return null;}
 function extractInlineTranslationSource(){return '';}
 function telegramReplyAssistantContext(){return null;}
 function resolveAngelLanguageBucket(){return 'vi';}
 function hasAnalyzableImage(m){return !!m.photo?.length;}
 function pickLargestPhotoFileId(m){return {fileId:m.photo.at(-1).file_id};}
 async function tryFetchTelegramMedia(id){mediaCalls.push(id);return {base64:'fixture',mime:'image/png'};}
 async function describeTelegramImage(m,caption){visionCalls.push({m,caption});return description;}
 function buildImageAnalysisContext(desc,caption){return 'IMAGE_ANALYSIS_CONTEXT '+desc+' USER_REQUEST '+caption;}
 function detectImageIntent(text,hasImage){return hasImage&&text==='Sửa ảnh này'?{mode:'edit'}:null;}
 function createTelegramImageStreamer(){return {};}
 async function getFlag(){return true;}
 async function withTyping(_id,cb){return cb();}
 async function askAngel(params){questions.push(params);return 'Lời hồi đáp dựa trên ảnh';}
 function buildMenuText(){return 'Menu';}function menuMarkup(){return {};}
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
  `data:application/javascript,${encodeURIComponent(code)}`
);
const image = {
  chat: { id: 123, type: "private" },
  from: { id: 42, first_name: "Test" },
  message_id: 1,
  photo: [{ file_id: "small" }, { file_id: "largest" }],
};
Deno.test("Bé Ly request passes one vision description and caption to chat without second attachment analysis", async () => {
  f.configure("FUN Profile, 19:00 MYT");
  const caption = "Soạn tin nhắn trả lời cho tin nhắn hình này nhé Angel";
  await f.handlePrivateMessage({ ...image, caption });
  assert.equal(f.visionCalls.length, 1);
  assert.ok(f.questions[0].question.includes("19:00 MYT"));
  assert.ok(f.questions[0].question.includes(caption));
  assert.equal(f.questions[0].attachments, undefined);
  assert.equal(f.mediaCalls.length, 0);
});
Deno.test("captionless photo is described rather than sent as an empty question", async () => {
  f.configure("Ảnh mẫu FUN Profile");
  await f.handlePrivateMessage(image);
  assert.equal(f.visionCalls.length, 1);
  assert.ok(f.questions[0].question.includes("Ảnh mẫu FUN Profile"));
  assert.ok(f.questions[0].originalUserMessage.length > 0);
});
Deno.test("null vision returns truthful temporary failure and never asks AI to guess", async () => {
  f.configure(null);
  await f.handlePrivateMessage({ ...image, caption: "Ảnh này nói gì?" });
  assert.equal(f.questions.length, 0);
  assert.equal(f.replies.length, 1);
  assert.match(f.replies[0], /lần này.*chưa đọc được ảnh/i);
});
Deno.test("photo captions starting slash preserve commands and do not call vision", async () => {
  for (
    const caption of [
      "/start",
      "/caption https://zoom.us/j/1",
      "/play",
      "/stop_play",
      "/unknown",
    ]
  ) {
    f.configure("unexpected");
    await f.handlePrivateMessage({ ...image, caption });
    assert.equal(f.visionCalls.length, 0, caption);
    assert.equal(f.mediaCalls.length, 0, caption);
  }
});
Deno.test("text-only chat and explicit image editing retain their existing routes", async () => {
  f.configure("Picture");
  await f.handlePrivateMessage({
    ...image,
    photo: undefined,
    text: "Xin chào",
  });
  assert.equal(f.visionCalls.length, 0);
  assert.equal(f.questions[0].question, "Xin chào");
  for (const description of ["Picture", null]) {
    f.configure(description);
    await f.handlePrivateMessage({ ...image, caption: "Sửa ảnh này" });
    assert.equal(f.questions[0].attachments.length, 1);
    assert.equal(f.visionCalls.length, 0);
    assert.equal(f.questions[0].question, "Sửa ảnh này");
  }
});
