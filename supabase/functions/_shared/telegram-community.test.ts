import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  enforceVietnamesePronouns,
  findBlockedKeyword,
  stripUrlsForKeyword,
} from "./telegram-community.ts";

Deno.test("enforceVietnamesePronouns keeps reflexive 'mình' referring to bé", () => {
  assertEquals(
    enforceVietnamesePronouns("bé hãy cảm nhận mình không còn là một cá thể"),
    "bé hãy cảm nhận mình không còn là một cá thể",
  );
  assertEquals(
    enforceVietnamesePronouns("bé yêu chính mình nhiều hơn nhé"),
    "bé yêu chính mình nhiều hơn nhé",
  );
  assertEquals(
    enforceVietnamesePronouns("đây là món quà của mình dành cho bé"),
    "đây là món quà của mình dành cho bé",
  );
});

Deno.test("enforceVietnamesePronouns rewrites bot self-reference 'mình' → 'Angel'", () => {
  assertEquals(
    enforceVietnamesePronouns("Mình luôn ở đây với bé"),
    "Angel luôn ở đây với bé",
  );
  assertEquals(
    enforceVietnamesePronouns("mình sẽ kể cho bé nghe"),
    "Angel sẽ kể cho bé nghe",
  );
});

Deno.test("enforceVietnamesePronouns still converts 'chúng mình' → 'chúng ta'", () => {
  assertEquals(
    enforceVietnamesePronouns("chúng mình cùng thở nào"),
    "chúng ta cùng thở nào",
  );
});


const KW = [
  { keyword: "sex", severity: "high" },
  { keyword: "porn", severity: "high" },
];

Deno.test("stripUrlsForKeyword strips http/www/t.me/bare-domains", () => {
  assertEquals(
    stripUrlsForKeyword("a https://fb.com/SexThing b").includes("sex"),
    false,
  );
  assertEquals(
    stripUrlsForKeyword("see www.site.com/sex-page now").includes("sex"),
    false,
  );
  assertEquals(
    stripUrlsForKeyword("join t.me/sexgroup ok").includes("sex"),
    false,
  );
  assertEquals(
    stripUrlsForKeyword("visit example.io/sex/123 thx").includes("sex"),
    false,
  );
});

Deno.test("findBlockedKeyword: Facebook URL slug 'SEx' is SAFE", () => {
  assertEquals(
    findBlockedKeyword(
      "share https://www.facebook.com/share/v/1SExkz19Zd/ nhé",
      KW,
    ),
    null,
  );
});

Deno.test("findBlockedKeyword: plain 'sex' in text IS blocked", () => {
  const hit = findBlockedKeyword("ban co xem sex khong", KW);
  assertEquals(hit?.keyword, "sex");
});

Deno.test("findBlockedKeyword: clean link only is SAFE", () => {
  assertEquals(
    findBlockedKeyword("xem https://camlycoin.com/post/abc-Sexxy-slug", KW),
    null,
  );
});

Deno.test("findBlockedKeyword: keyword in text + safe link together", () => {
  const hit = findBlockedKeyword(
    "porn nhe https://safe.com/abc",
    KW,
  );
  assertEquals(hit?.keyword, "porn");
});

import {
  detectTelegramPreviewSpam,
  detectMeditationInvite,
  detectMeditationTopicLanguage,
  buildMeditationSummaryQuestion,
  detectTranslationTargetLanguage,
  resolveAngelLanguageBucket,
  detectExternalBotPromotion,
  extractText,
  classifyMessageType,
  renderEventAssistantPrompt,
  angelLanguageDirective,
  replyViolatesAngelLanguageBucket,
  detectFactualLookupQuery,
} from "./telegram-community.ts";

Deno.test("detectFactualLookupQuery: catches Fun Rich Bé Ly account lookup", () => {
  const hit = detectFactualLookupQuery("Alo cho con biết tài khoản chính thức fun rich bé Ly");
  assertEquals(hit.matched, true);
});

Deno.test("detectFactualLookupQuery: catches no-dot fun rich/link/wallet variants", () => {
  assertEquals(detectFactualLookupQuery("link fun rich camlyd chính thức là gì cha").matched, true);
  assertEquals(detectFactualLookupQuery("cho bé xin ví BSC của Bé Ly").matched, true);
  assertEquals(detectFactualLookupQuery("địa chỉ ví BTC chính thức camly ở đâu").matched, true);
});

Deno.test("detectTelegramPreviewSpam: t.me link_preview is flagged", () => {
  const hit = detectTelegramPreviewSpam({
    link_preview_options: { url: "https://t.me/Msk69_bot" },
  });
  if (!hit) throw new Error("expected hit");
  assertEquals(hit.kind, "link_preview_telegram");
});

Deno.test("detectTelegramPreviewSpam: external_reply channel card is flagged", () => {
  const hit = detectTelegramPreviewSpam({
    external_reply: { chat: { id: -100123, type: "channel", title: "暴" } },
  });
  if (!hit) throw new Error("expected hit");
});

Deno.test("detectTelegramPreviewSpam: forward_from_channel is flagged", () => {
  const hit = detectTelegramPreviewSpam({
    forward_from_chat: { id: -100, type: "channel", title: "X" },
  });
  if (!hit) throw new Error("expected hit");
});

Deno.test("detectTelegramPreviewSpam: clean text is safe", () => {
  assertEquals(detectTelegramPreviewSpam({ text: "hello world" }), null);
});

Deno.test("detectExternalBotPromotion: @Msk69_bot flagged", () => {
  const r = detectExternalBotPromotion("xem @Msk69_bot nhé", "funrich_community_bot", new Set(["funrich_community_bot"]));
  assertEquals(r, "msk69_bot");
});

Deno.test("detectExternalBotPromotion: own bot safe", () => {
  assertEquals(
    detectExternalBotPromotion("ping @funrich_community_bot", "funrich_community_bot", new Set(["funrich_community_bot"])),
    null,
  );
});

Deno.test("extractText: includes caption + link_preview url + sender_chat title", () => {
  const txt = extractText({
    caption: "暴 高中生",
    link_preview_options: { url: "https://t.me/Msk69_bot" },
    sender_chat: { id: 1, type: "channel", title: "Joy Niehaus" },
  });
  if (!txt.includes("暴")) throw new Error("missing caption");
  if (!txt.includes("t.me/Msk69_bot")) throw new Error("missing link_preview url");
  if (!txt.includes("Joy Niehaus")) throw new Error("missing sender_chat title");
});

Deno.test("classifyMessageType: forward / preview / photo / text", () => {
  assertEquals(classifyMessageType({ forward_from_chat: { id: 1 } }), "forward");
  assertEquals(classifyMessageType({ external_reply: { chat: { id: 1 } } }), "preview");
  assertEquals(classifyMessageType({ photo: [{ file_id: "x" }] }), "photo");
  assertEquals(classifyMessageType({ text: "hi" }), "text");
});

Deno.test("detectMeditationInvite: Zoom thiền caption extracts topic", () => {
  const hit = detectMeditationInvite({
    caption: `<b>ZOOM THIỀN MỘT THÁNG</b>
💖 <b>Chủ đề:</b> Nâng tầm cuộc sống, nâng tầm năng lượng. Chú Địa Tạng Vương Bồ Tát.
Zoom: https://zoom.us/j/8808082024?pwd=abc
ID: 88 08 08 2024
PW: 999`,
  });
  if (!hit) throw new Error("expected meditation invite");
  assertEquals(hit.topic, "Nâng tầm cuộc sống, nâng tầm năng lượng. Chú Địa Tạng Vương Bồ Tát");
  assertEquals(hit.zoomLink.includes("zoom.us/j/8808082024"), true);
});

Deno.test("detectMeditationInvite: accepts ascii topic label", () => {
  const hit = detectMeditationInvite({
    text: `ZOOM THIEN
Chu de: Crystal Sphere. Om Mani Padme Hum.
Join Zoom: https://zoom.us/j/123456789?pwd=abc`,
  });
  if (!hit) throw new Error("expected meditation invite");
  assertEquals(hit.topic, "Crystal Sphere. Om Mani Padme Hum");
});

Deno.test("detectMeditationInvite: accepts English meditation topic label", () => {
  const hit = detectMeditationInvite({
    caption: `✨⚡️🌟 ZOOM MEDITATION – A LIFETIME OF LIGHT IS NOW OPEN!

TOPIC: Connecting with the Universe to manifest your dreams, visualizing a future of success and happiness.
Join Zoom now! https://zoom.us/j/8808082024?pwd=abc
ID: 88 08 08 2024 | PW: 999`,
  });
  if (!hit) throw new Error("expected English meditation invite");
  assertEquals(hit.topic, "Connecting with the Universe to manifest your dreams, visualizing a future of success and happiness");
});

Deno.test("detectMeditationTopicLanguage: English topic returns en", () => {
  assertEquals(
    detectMeditationTopicLanguage("Connecting with the Universe to manifest your dreams"),
    "en",
  );
});

Deno.test("detectMeditationTopicLanguage: Vietnamese topic returns vi", () => {
  assertEquals(
    detectMeditationTopicLanguage("Thiền Năng Lượng Vũ Trụ chữa lành"),
    "vi",
  );
});

Deno.test("buildMeditationSummaryQuestion: English topic enforces English", () => {
  const question = buildMeditationSummaryQuestion({
    topic: "Connecting with the Universe to manifest your dreams",
    template: `Bạn là Angel. Hãy tóm tắt chủ đề "{{topic}}" bằng tiếng Việt.`,
  });
  if (!/reply 100% in English/i.test(question)) throw new Error("missing English guard");
  if (!question.includes("do NOT use Vietnamese words")) throw new Error("missing Vietnamese-word guard");
  if (!question.includes("Connecting with the Universe")) throw new Error("missing topic");
});

Deno.test("buildMeditationSummaryQuestion: Vietnamese topic uses custom template", () => {
  const question = buildMeditationSummaryQuestion({
    topic: "Thiền Năng Lượng Vũ Trụ",
    template: `Tóm tắt bằng tiếng Việt: {{topic}}`,
  });
  assertEquals(question, "Tóm tắt bằng tiếng Việt: Thiền Năng Lượng Vũ Trụ");
});

Deno.test("buildMeditationSummaryQuestion: explicit English language overrides VI topic", () => {
  const question = buildMeditationSummaryQuestion({
    topic: "Làm mới, tái tạo cơ thể, kích hoạt các Neuron thần kinh",
    language: "en",
  });
  if (!/reply 100% in English/i.test(question)) throw new Error("missing English guard");
  if (!question.includes("Làm mới")) throw new Error("must keep original topic phrase");
});

Deno.test("detectMeditationInvite: English frame + Vietnamese topic -> language=en", () => {
  const hit = detectMeditationInvite({
    caption: `✨⚡️🌟 ZOOM MEDITATION – A LIFETIME OF LIGHT IS NOW OPEN!

TIME (Nigeria Time): 06:00 AM on July 03, 2026
TOPIC: Làm mới, tái tạo cơ thể, kích hoạt các Neuron thần kinh. 23Feb2024.
Join Zoom now! https://zoom.us/j/8808082024?pwd=abc
ID: 88 08 08 2024 | PW: 999`,
  });
  if (!hit) throw new Error("expected invite");
  assertEquals(hit.language, "en");
});

Deno.test("detectMeditationInvite: screenshot English Zoom topic returns English language", () => {
  const hit = detectMeditationInvite({
    caption: `✨⚡️🌟 ZOOM MEDITATION – A LIFETIME OF LIGHT IS NOW OPEN! ✨⚡️🌟

🌞 TIME (Nigeria Time): 06:00 AM on July 04, 2026
💖 TOPIC: Eng: Diving Deep into Every Layer of the Heart-Mind: Coaching and Awakening Consciousness and Intellect to Move Together as One. February 29, 2024.

📍 Zoom Schedule (Nigeria Time): (11:00 PM-1:00 AM, 6:00–8:00 AM, 2:00–4:00 PM)
🔗 Join Zoom now! https://zoom.us/j/8808082024?pwd=ZuWAc0s0yxCppowVAUGamsdzna9Md.1
🆔 ID: 88 08 08 2024 | 🔑 PW: 999`,
  });
  if (!hit) throw new Error("expected invite");
  assertEquals(hit.language, "en");
  assertEquals(
    hit.topic,
    "Eng: Diving Deep into Every Layer of the Heart-Mind: Coaching and Awakening Consciousness and Intellect to Move Together as One. February 29, 2024",
  );
});

Deno.test("resolveAngelLanguageBucket: forced English beats Vietnamese admin summary template", () => {
  const question = buildMeditationSummaryQuestion({
    topic: "Eng: Diving Deep into Every Layer of the Heart-Mind",
    template: `Bạn là Angel. Hãy tóm tắt chủ đề "{{topic}}" bằng tiếng Việt và gọi cả nhà là bé.`,
    language: "en",
  });
  assertEquals(resolveAngelLanguageBucket(question), "en");
  assertEquals(resolveAngelLanguageBucket(question, "en"), "en");
});

Deno.test("resolveAngelLanguageBucket: original English user message beats Vietnamese wrapper", () => {
  const original = "I need help";
  const wrapped = `Tin nhắn của bé: """${original}"""\nHãy trả lời ấm áp bằng tiếng Việt.`;
  assertEquals(resolveAngelLanguageBucket(original), "en");
  assertEquals(resolveAngelLanguageBucket(wrapped), "vi");
  assertEquals(resolveAngelLanguageBucket(wrapped, resolveAngelLanguageBucket(original)), "en");
});

Deno.test("angelLanguageDirective: English forbids Vietnamese address terms", () => {
  const directive = angelLanguageDirective("en");
  if (!directive.includes("English output only")) throw new Error("missing English lock");
  if (!directive.includes('"bé"')) throw new Error("missing bé guard");
  assertEquals(replyViolatesAngelLanguageBucket("Angel luôn sẵn sàng đồng hành cùng bé yêu đây ạ! 💛", "en"), true);
  assertEquals(replyViolatesAngelLanguageBucket("Angel is here to help you. What would you like to explore first? 💛", "en"), false);
});

Deno.test("resolveAngelLanguageBucket: expected user prompt languages", () => {
  assertEquals(resolveAngelLanguageBucket("Can you help me with FUN Profile?"), "en");
  assertEquals(resolveAngelLanguageBucket("What is the password?"), "en");
  assertEquals(resolveAngelLanguageBucket("Angel ơi giúp bé"), "vi");
  assertEquals(resolveAngelLanguageBucket("PW là gì?"), "vi");
});

Deno.test("translation intent target overrides Vietnamese request language", () => {
  assertEquals(detectTranslationTargetLanguage("Dịch sang tiếng Anh giúp bé nhé"), "en");
  assertEquals(resolveAngelLanguageBucket("Dịch sang tiếng Anh giúp bé nhé"), "en");
  assertEquals(detectTranslationTargetLanguage("translate to Vietnamese: I am grateful"), "vi");
  assertEquals(resolveAngelLanguageBucket("translate to Vietnamese: I am grateful"), "vi");
});

Deno.test("detectMeditationInvite: Vietnamese label -> language=vi", () => {
  const hit = detectMeditationInvite({
    text: `ZOOM THIỀN
Chủ đề: Bình an nội tâm và chữa lành
https://zoom.us/j/123456789?pwd=abc`,
  });
  if (!hit) throw new Error("expected invite");
  assertEquals(hit.language, "vi");
});

Deno.test("detectMeditationInvite: missing required parts is safe", () => {
  assertEquals(detectMeditationInvite({ text: "Chủ đề: Bình an nội tâm" }), null);
  assertEquals(detectMeditationInvite({ text: "ZOOM THIỀN https://zoom.us/j/123456789" }), null);
  assertEquals(detectMeditationInvite({ text: "Team meeting\nTopic: Weekly sync\nhttps://zoom.us/j/123456789" }), null);
});


Deno.test("renderEventAssistantPrompt: renders custom variables safely", () => {
  const text = renderEventAssistantPrompt(
    "Topic={{topic}}\nTime={{time}}\nZoom={{zoom_link}}\nID={{zoom_id}}\nPW={{zoom_password}}\nLive={{livestream_links}}",
    {
      topic: "Thiền <bình an>",
      event_time: "20:00",
      event_date: "01/07/2026",
      timezone: "Malaysia",
      zoom_link: "https://zoom.us/j/123456789?pwd=abc",
      zoom_id: "123 456 789",
      zoom_password: "999",
      livestream_links: ["https://youtube.com/live/abc", "https://facebook.com/live/xyz"],
    },
  );
  if (!text.includes("Topic=Thiền &lt;bình an&gt;")) throw new Error("missing escaped topic");
  if (!text.includes("Time=20:00 · 01/07/2026 · Malaysia")) throw new Error("missing time");
  if (!text.includes("Zoom=https://zoom.us/j/123456789?pwd=abc")) throw new Error("missing zoom link");
  if (!text.includes("ID=123 456 789")) throw new Error("missing zoom id");
  if (!text.includes("PW=999")) throw new Error("missing zoom password");
  if (!text.includes("https://youtube.com/live/abc")) throw new Error("missing livestream");
});

Deno.test("renderEventAssistantPrompt: blank template uses default summary blocks", () => {
  const text = renderEventAssistantPrompt("", {
    topic: "Bình an nội tâm",
    zoom_link: "https://zoom.us/j/123456789",
    zoom_id: "123456789",
    zoom_password: "999",
  });
  if (!text.includes("Angel thấy thông báo tham gia Zoom")) throw new Error("missing intro");
  if (!text.includes("<b>Chủ đề:</b>")) throw new Error("missing topic block");
  if (!text.includes("<b>Tham gia Zoom:</b>")) throw new Error("missing zoom block");
});

Deno.test("detectTelegramPreviewSpam: raw t.me channel link in text is flagged", () => {
  const hit = detectTelegramPreviewSpam({ text: "xem https://t.me/bcgzsxll/5 đi" });
  if (!hit) throw new Error("expected hit");
  assertEquals(hit.kind, "tg_channel_link");
});

Deno.test("detectTelegramPreviewSpam: t.me allowlisted handle is safe", () => {
  const trusted = new Set(["funrich_community", "funrich_community_bot"]);
  assertEquals(
    detectTelegramPreviewSpam(
      { text: "see https://t.me/funrich_community/123" },
      { trustedHandles: trusted },
    ),
    null,
  );
});

Deno.test("detectTelegramPreviewSpam: t.me invite link flagged", () => {
  const hit = detectTelegramPreviewSpam({ text: "join https://t.me/+AbCdEf123" });
  if (!hit) throw new Error("expected hit");
  assertEquals(hit.kind, "tg_invite_link");
});

Deno.test("detectTelegramPreviewSpam: own bot deeplink is safe", () => {
  assertEquals(
    detectTelegramPreviewSpam(
      { text: "open https://t.me/funrich_community_bot?start=ref" },
      { ownBot: "funrich_community_bot" },
    ),
    null,
  );
});

Deno.test("detectTelegramPreviewSpam: forwarded text with t.me link flagged", () => {
  const hit = detectTelegramPreviewSpam({
    text: "https://t.me/bcgzsxll/5",
    forward_origin: { type: "user" },
  });
  if (!hit) throw new Error("expected hit");
  assertEquals(hit.kind, "tg_channel_link");
});

import { looksLikeCjkRomanceBait } from "./telegram-community.ts";

Deno.test("looksLikeCjkRomanceBait: honey-trap opener flagged", () => {
  assertEquals(looksLikeCjkRomanceBait("你的眼神，像小鹿湿漉漉的"), true);
  assertEquals(looksLikeCjkRomanceBait("姐姐想找个哥哥疼你呀"), true);
  assertEquals(looksLikeCjkRomanceBait("有人包养干爹同城约吗"), true);
  assertEquals(looksLikeCjkRomanceBait("你的声音，像风铃叮咚响"), true);
  assertEquals(looksLikeCjkRomanceBait("想把你，藏进我的童话书里"), true);
  assertEquals(looksLikeCjkRomanceBait("你的声音，像风铃叮咚响\n想把你，藏进我的童话书里"), true);
});

Deno.test("looksLikeCjkRomanceBait: clean CJK text safe", () => {
  assertEquals(looksLikeCjkRomanceBait("大家好，今天天气不错"), false);
  assertEquals(looksLikeCjkRomanceBait("FUN Ecosystem 是一个项目"), false);
  assertEquals(looksLikeCjkRomanceBait("今天风铃声音很好听"), false);
  assertEquals(looksLikeCjkRomanceBait("我喜欢童话书"), false);
});
