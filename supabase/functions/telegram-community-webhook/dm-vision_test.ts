import assert from "node:assert/strict";
import ts from "npm:typescript@5.8.3";
import { buildDmImageFollowup, detectImageFollowup } from "../_shared/telegram-dm-image-context.ts";
import { buildDmTextFollowup, buildDmDefinitionQuestion, buildDmDetailedQuestion, detectTextFollowup, dmTextDepthPolicy } from "../_shared/telegram-dm-text-context.ts";
const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
const translationSourceHelper = source.slice(source.indexOf("function extractInlineTranslationSource"), source.indexOf("async function getPendingDmTranslationTarget"));
const handler = source.slice(
  source.indexOf("export async function handlePrivateMessage"),
  source.indexOf("async function handleVerificationCallback"),
);
const code = ts.transpileModule(
  `
 export const replies=[],questions=[],visionCalls=[],mediaCalls=[];
 let description='FUN Profile. Nền trắng, chữ Hẹn gặp lúc 19:00 MYT.';
 let imageContext=null, textContext=null, aiReply='Lời hồi đáp dựa trên ảnh';
 export function configure(v){description=v;imageContext=null;textContext=null;aiReply='Lời hồi đáp dựa trên ảnh';replies.length=questions.length=visionCalls.length=mediaCalls.length=0;}
 export function setAiReply(v){aiReply=v;}
 const detectImageFollowup=${detectImageFollowup.toString()};
 const buildDmImageFollowup=${buildDmImageFollowup.toString()};
 const buildDmTextFollowup=${buildDmTextFollowup.toString()};
 const buildDmDefinitionQuestion=${buildDmDefinitionQuestion.toString()};
 const buildDmDetailedQuestion=${buildDmDetailedQuestion.toString()};
 const dmTextDepthPolicy=${dmTextDepthPolicy.toString()};
 const detectTextFollowup=${detectTextFollowup.toString()};
 async function beginDmTextTurn(){const previous=textContext;textContext=null;return {previous,finish:async c=>{textContext=c;}};}
 async function beginDmImageTurn(){const previous=imageContext;imageContext=null;return {previous,finish:async c=>{imageContext=c;}};}
 function extractText(m){return m.text??m.caption??'';}
 function getClients(){return {adminClient:{}};}
 async function sendMessage(_id,text){replies.push(text);return {ok:true};}
 async function trackBotDmReply(){} async function trackDmEvent(){}
 async function sendChatAction(){} async function ensureSettings(){return {};}
 async function isCaptionOperator(){return false;}
 async function checkAndUpdateAiRate(){return {allowed:true,count:1};}
 function detectTranslationTargetLanguage(t){return t.includes('sang tiếng Anh')?'en':null;}
 async function getPendingDmTranslationTarget(){return null;}
 ${translationSourceHelper}
 function telegramReplyAssistantContext(){return null;}
 function resolveAngelLanguageBucket(t){return t==='English draft'?'en':'vi';}
 function hasAnalyzableImage(m){return !!m.photo?.length;}
 function pickLargestPhotoFileId(m){return {fileId:m.photo.at(-1).file_id};}
 async function tryFetchTelegramMedia(id){mediaCalls.push(id);return {base64:'fixture',mime:'image/png'};}
 async function describeTelegramImage(m,caption){visionCalls.push({m,caption});return description;}
 function buildImageAnalysisContext(desc,caption){return 'IMAGE_ANALYSIS_CONTEXT '+desc+' USER_REQUEST '+caption;}
 function detectImageIntent(text,hasImage){return hasImage&&text==='Sửa ảnh này'?{mode:'edit'}:null;}
 function createTelegramImageStreamer(){return {};}
 async function getFlag(){return true;}
 async function withTyping(_id,cb){return cb();}
 async function askAngel(params){questions.push(params);return aiReply;}
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

Deno.test("image → reply draft → shorter → English → polite carries the same image and latest answer through strict mirror input", async () => {
  f.configure('Người hỏi: "Do you desire salvation?"');
  await f.handlePrivateMessage(image);
  for (const [index, text] of ["con nên trả lời sao", "ngắn hơn", "dịch sang tiếng Anh", "lịch sự hơn"].entries()) {
    await f.handlePrivateMessage({ ...image, photo: undefined, message_id: index + 2, text });
    const call = f.questions.at(-1);
    assert.ok(call.question.includes("Do you desire salvation?"), text);
    assert.ok(call.question.includes("Lời hồi đáp dựa trên ảnh"), text);
    assert.equal(call.originalUserMessage, text);
    assert.equal(call.imageAnalysisContext, call.question);
    assert.equal(call.attachments, undefined);
  }
  assert.equal(f.visionCalls.length, 1);
});

Deno.test("new topic clears image; a missing source asks one concrete question without AI guessing", async () => {
  f.configure("Ảnh cũ");
  await f.handlePrivateMessage(image);
  await f.handlePrivateMessage({ ...image, photo: undefined, message_id: 2, text: "Giải thích blockchain" });
  assert.equal(f.questions.at(-1).question, "Giải thích blockchain");
  await f.handlePrivateMessage({ ...image, photo: undefined, message_id: 3, text: "con nên trả lời sao" });
  assert.equal(f.questions.length, 3);
  assert.ok(f.questions.at(-1).textConversationContext.includes("Giải thích blockchain"));
  assert.ok(!f.questions.at(-1).question.includes("Ảnh cũ"));
});

Deno.test("explicit reply to another message never borrows latest image", async () => {
  f.configure("Ảnh cũ");
  await f.handlePrivateMessage(image);
  await f.handlePrivateMessage({ ...image, photo: undefined, message_id: 2, text: "con nên trả lời sao",
    reply_to_message: { message_id: 99, text: "Một chủ đề khác", from: { id: 42 } } });
  assert.equal(f.questions.at(-1).imageAnalysisContext, undefined);
  assert.equal(f.questions.at(-1).question, "con nên trả lời sao");
});

Deno.test("English draft stays English when polished; inline translation takes priority over image context", async () => {
  f.configure("Question in image");
  f.setAiReply("English draft");
  await f.handlePrivateMessage(image);
  await f.handlePrivateMessage({ ...image, photo: undefined, message_id: 2, text: "lịch sự hơn" });
  assert.equal(f.questions.at(-1).forcedLangBucket, "en");
  await f.handlePrivateMessage({ ...image, photo: undefined, message_id: 3, text: "dịch sang tiếng Anh: Xin chào" });
  assert.equal(f.questions.at(-1).imageAnalysisContext, undefined);
  assert.match(f.questions.at(-1).question, /SOURCE TEXT:\n"""Xin chào/);
  assert.equal(f.questions.at(-1).forcedLangBucket, "en");
});

Deno.test("start resets the image thread", async () => {
  f.configure("Ảnh cũ");
  await f.handlePrivateMessage(image);
  await f.handlePrivateMessage({ ...image, photo: undefined, message_id: 2, text: "/start" });
  await f.handlePrivateMessage({ ...image, photo: undefined, message_id: 3, text: "con nên trả lời sao" });
  assert.equal(f.questions.length, 1);
  assert.match(f.replies.at(-1), /gửi lại ảnh hoặc đoạn tin nhắn/);
});

Deno.test("shorten without an image thread keeps the ordinary text conversation route", async () => {
  f.configure("unused");
  await f.handlePrivateMessage({ ...image, photo: undefined, text: "ngắn hơn" });
  assert.equal(f.questions[0].question, "ngắn hơn");
  assert.equal(f.questions[0].imageAnalysisContext, undefined);
});

Deno.test("screenshot regression: reply draft → rồi sao nữa cha → tiếp đi → ý đó là sao keeps the latest task and answer", async () => {
  f.configure('Fath hỏi: "Do you desire salvation?"');
  await f.handlePrivateMessage(image);
  const turns = [
    { request: "con nên trả lời sao", reply: 'Bé có thể gửi: "Cảm ơn Fath đã chia sẻ."' },
    { request: "rồi sao nữa cha", reply: "Bé có thể gửi bản nháp nếu phù hợp rồi chờ Fath phản hồi." },
    { request: "tiếp đi cha", reply: "Bản nháp đã đủ để gửi. Khi Fath phản hồi thật, bé có thể gửi lại để Angel hỗ trợ." },
    { request: "ý đó là sao", reply: "Ý là bé chờ câu trả lời thật từ Fath trước khi soạn tiếp." },
  ];
  for (const [i, turn] of turns.entries()) {
    f.setAiReply(turn.reply);
    await f.handlePrivateMessage({ ...image, photo: undefined, message_id: i + 2, text: turn.request });
    const call = f.questions.at(-1);
    assert.equal(call.originalUserMessage, turn.request);
    assert.equal(call.imageAnalysisContext, call.question);
    assert.ok(call.question.includes("Do you desire salvation?"));
    if (i > 0) {
      assert.ok(call.question.includes(JSON.stringify(turns[i - 1].request)));
      assert.ok(call.question.includes(JSON.stringify(turns[i - 1].reply)));
    }
  }
  assert.equal(f.questions.length, 5);
  assert.equal(f.visionCalls.length, 1);
  assert.equal(f.mediaCalls.length, 0);
});

Deno.test("continuation after a new topic must not resurrect the old image thread", async () => {
  f.configure("Ảnh cũ của Fath");
  await f.handlePrivateMessage(image);
  await f.handlePrivateMessage({ ...image, photo: undefined, message_id: 2, text: "Giải thích blockchain" });
  for (const [i, text] of ["rồi sao nữa cha", "tiếp đi", "ý đó là sao"].entries()) {
    await f.handlePrivateMessage({ ...image, photo: undefined, message_id: i + 3, text });
    assert.ok(f.questions.at(-1).textConversationContext.includes("Giải thích blockchain"));
    assert.ok(!f.questions.at(-1).question.includes("Ảnh cũ của Fath"));
    assert.equal(f.questions.at(-1).imageAnalysisContext, undefined);
  }
});

Deno.test("text screenshot: definition → tiếp đi cha preserves topic and last answer without image context", async () => {
  f.configure("unused");
  const dm = { ...image, photo: undefined };
  f.setAiReply("Tự do tuyệt đối là một lý tưởng triết học, có nhiều cách hiểu.");
  await f.handlePrivateMessage({ ...dm, text: "tự do tuyệt đối là gì" });
  assert.match(f.questions[0].question, /DM_DEFINITION_TASK/);
  assert.equal(f.questions[0].originalUserMessage, "tự do tuyệt đối là gì");
  for (const [i, text] of ["tiếp đi cha", "ý đó là sao", "ngắn hơn"].entries()) {
    await f.handlePrivateMessage({ ...dm, message_id: i + 2, text });
    const call = f.questions.at(-1);
    assert.equal(call.originalUserMessage, text);
    assert.equal(call.textConversationContext, call.question);
    assert.ok(call.question.includes("tự do tuyệt đối là gì"));
    assert.ok(call.question.includes("lý tưởng triết học"));
    assert.equal(call.imageAnalysisContext, undefined);
  }
  assert.equal(f.visionCalls.length, 0);
  await f.handlePrivateMessage({ ...dm, message_id: 5, text: "Blockchain hoạt động thế nào?" });
  await f.handlePrivateMessage({ ...dm, message_id: 6, text: "tiếp đi cha" });
  assert.ok(f.questions.at(-1).question.includes("Blockchain hoạt động thế nào?"));
  assert.ok(!f.questions.at(-1).question.includes("tự do tuyệt đối là gì"));
});

Deno.test("missing/reset text context asks one clarification; a photo clears the old text thread", async () => {
  f.configure("Ảnh mới");
  const dm = { ...image, photo: undefined };
  await f.handlePrivateMessage({ ...dm, text: "tiếp đi cha" });
  assert.equal(f.questions.length, 0);
  assert.match(f.replies.at(-1), /gửi lại câu hỏi/);
  await f.handlePrivateMessage({ ...dm, message_id: 2, text: "Giải thích blockchain" });
  await f.handlePrivateMessage({ ...dm, message_id: 3, text: "/start" });
  await f.handlePrivateMessage({ ...dm, message_id: 4, text: "tiếp đi cha" });
  assert.equal(f.questions.length, 1);
  await f.handlePrivateMessage({ ...image, message_id: 5 });
  await f.handlePrivateMessage({ ...dm, message_id: 6, text: "tiếp đi cha" });
  assert.ok(f.questions.at(-1).imageAnalysisContext.includes("Ảnh mới"));
  assert.equal(f.questions.at(-1).textConversationContext, undefined);
});

Deno.test("adaptive depth: definition → continue → deep analysis → shorter; new detailed topic replaces old topic", async () => {
  f.configure("unused");
  const dm = { ...image, photo: undefined };
  await f.handlePrivateMessage({ ...dm, text: "tự do tuyệt đối là gì" });
  await f.handlePrivateMessage({ ...dm, message_id: 2, text: "tiếp đi cha" });
  assert.match(f.questions.at(-1).question, /2–3 ý MỚI/);
  await f.handlePrivateMessage({ ...dm, message_id: 3, text: "phân tích sâu hơn cha" });
  assert.ok(f.questions.at(-1).question.includes('"topic":"tự do tuyệt đối là gì"'));
  assert.match(f.questions.at(-1).question, /không ép số câu/);
  await f.handlePrivateMessage({ ...dm, message_id: 4, text: "ngắn hơn" });
  assert.match(f.questions.at(-1).question, /Rút gọn đúng yêu cầu/);
  await f.handlePrivateMessage({ ...dm, message_id: 5, text: "Hãy phân tích chi tiết blockchain" });
  assert.match(f.questions.at(-1).question, /DM_DETAILED_TASK/);
  assert.ok(!f.questions.at(-1).question.includes("tự do tuyệt đối"));
  await f.handlePrivateMessage({ ...dm, message_id: 6, text: "phân tích sâu" });
  assert.ok(f.questions.at(-1).question.includes('"topic":"Hãy phân tích chi tiết blockchain"'));
  assert.equal(f.visionCalls.length, 0);
});
