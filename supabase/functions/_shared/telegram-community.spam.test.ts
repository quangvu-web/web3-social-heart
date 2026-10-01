import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  detectAutomatedCjkScam,
  detectTelegramScam,
  looksLikeMentionBait,
  looksLikeCjkPromo,
  looksLikeVietnameseAbuse,
} from "./telegram-community.ts";

Deno.test("referral cashback promotion: screenshot pattern is detected", () => {
  const detection = detectTelegramScam({
    text: "Hãy kiểm tra công ty thanh toán uy tín này 👇👇👇\nhttps://xezopoint.com/register?ref=19\nHọ cung cấp tỷ lệ hoàn trả 10%, 30%, 50%, và thậm chí 100%, tùy thuộc vào gói bạn chọn.",
  });
  assertEquals(detection.isScam, true);
  assertEquals(detection.reason, "referral_cashback_promo");
  assertEquals(detection.severity, "high");
});

Deno.test("referral cashback promotion: approved trusted destination is exempt", () => {
  const detection = detectTelegramScam({
    text: "Hoàn trả 100% theo chương trình: https://offers.fun.rich/register?ref=19",
  }, ["fun.rich"]);
  assertEquals(detection.isScam, false);
});

Deno.test("referral cashback promotion: link or cashback claims alone are not enough", () => {
  assertEquals(detectTelegramScam({ text: "https://example.com/register?ref=19" }).isScam, false);
  assertEquals(detectTelegramScam({ text: "Tỷ lệ hoàn trả 100% theo chính sách của nhóm." }).isScam, false);
});

Deno.test("mention_bait: 3 foreign bots, no real text → detected", () => {
  assertEquals(
    looksLikeMentionBait("@aoqaambot @akaozbot @qoanqqbot", "myofficialbot"),
    true,
  );
});

Deno.test("mention_bait: 2 foreign bots with only emoji/punct → detected", () => {
  assertEquals(
    looksLikeMentionBait("@fakebot1 @fakebot2 👀!!", "myofficialbot"),
    true,
  );
});

Deno.test("mention_bait: 1 bot mention → NOT detected", () => {
  assertEquals(
    looksLikeMentionBait("hey @somebot check this", "myofficialbot"),
    false,
  );
});

Deno.test("mention_bait: 2 bots but with real text → NOT detected", () => {
  assertEquals(
    looksLikeMentionBait(
      "@bota @botb are these safe to use in our group?",
      "myofficialbot",
    ),
    false,
  );
});

Deno.test("mention_bait: mentioning own bot doesn't count", () => {
  assertEquals(
    looksLikeMentionBait("@myofficialbot @otherbot", "myofficialbot"),
    false,
  );
});

Deno.test("cjk_promo: new 2026 variants caught", () => {
  assertEquals(looksLikeCjkPromo("全新项目2026 一单一单结算 有执行力的来"), true);
  assertEquals(looksLikeCjkPromo("充值抖音直播间刷礼物 全程担保收米"), true);
  assertEquals(looksLikeCjkPromo("新橡木 稳定赚钱包不按头"), true);
});

Deno.test("cjk_promo: payment-gateway laundering family caught", () => {
  const fullScam = "⚙️ 情义支付：API 自动化对接专家\n专为高频业务设计，稳定支持充U及多家三方通道下发。\n支持 API 接口无缝集成，亦可贴群手动。\n稳定通道，极低费率，欢迎商户入驻。\n🚀 联系对接商务点击下方！";
  assertEquals(looksLikeCjkPromo(fullScam), true);
  assertEquals(looksLikeCjkPromo("需要三方通道下发的老板联系"), true);
  assertEquals(looksLikeCjkPromo("充U 商户入驻 极低费率"), true);
  assertEquals(looksLikeCjkPromo("API自动化对接 欢迎入驻"), true);
});

Deno.test("cjk_promo: 代付方案 variant A caught", () => {
  const scam = "📢 商户代付方案\n需要代付服务支持？\n情义支付提供：\n💵 代付业务\n🔌 API接口\n🤝 商务协助\n欢迎咨询合作。";
  assertEquals(looksLikeCjkPromo(scam), true);
});

Deno.test("cjk_promo: 备付金 variant B caught", () => {
  const scam = "【情义支付｜安全发备付金服务】\n💰 安全发备付金业务开放\n支持：\n✅ 备付金下发\n✅ 商户代付需求\n✅ 业务对接支持\n同时支持多类三方通道资源匹配，满足不同业务场景需求。";
  assertEquals(looksLikeCjkPromo(scam), true);
});

Deno.test("cjk_promo: short 代付 brand phrases caught", () => {
  assertEquals(looksLikeCjkPromo("情义支付 代付业务"), true);
  assertEquals(looksLikeCjkPromo("备付金下发 商户对接支持"), true);
  assertEquals(looksLikeCjkPromo("商务咨询 代付通道"), true);
  assertEquals(looksLikeCjkPromo("情义官方频道 欢迎入驻"), true);
});

Deno.test("cjk_promo: benign CJK sentence not flagged", () => {
  assertEquals(looksLikeCjkPromo("大家好，今天我们一起冥想吧"), false);
});



Deno.test("cjk_promo: 抖音礼物代刷 2026 variant (充值抖币) caught", () => {
  const scam = `📣📣📣全新项目2026新橡木💯💯💯
⚡️有执行力的来，稳定赚钱包不按头
🖖抖音礼物代刷，工资一单一结算
🔰我们充值抖币你们进直播间刷礼物就行
🔆全程担保做单放心做
每天收入3500+
老板： @leishiyan`;
  assertEquals(looksLikeCjkPromo(scam), true);
  assertEquals(looksLikeCjkPromo("充值抖币 进直播间刷礼物"), true);
  assertEquals(looksLikeCjkPromo("每天收入3500+ 担保做单"), true);
});

Deno.test("automated_cjk_scam: direct foreign bot with buttons is blocked", () => {
  const detection = detectAutomatedCjkScam({
    from: { id: 8899, is_bot: true, username: "scam_project_bot" },
    text: "抖音礼物代刷，工资一单一结算 我们充值抖币你们进直播间刷礼物",
    reply_markup: {
      inline_keyboard: [[
        { text: "公群担保", url: "https://t.me/fake_channel" },
        { text: "日入8000项目", url: "https://example.invalid/project" },
      ]],
    },
  }, "funprofile_guard_bot");
  assertEquals(detection.isScam, true);
  assertEquals(detection.senderKind, "bot");
  assertEquals(detection.hasExternalButton, true);
});

Deno.test("automated_cjk_scam: inline bot caption variant is blocked", () => {
  const detection = detectAutomatedCjkScam({
    from: { id: 1001, is_bot: false, username: "spammer" },
    via_bot: { id: 1002, is_bot: true, username: "promo_inline_bot" },
    caption: "全新项目2026 有执行力的来 每天收入3500+ 全程担保做单",
  }, "funprofile_guard_bot");
  assertEquals(detection.isScam, true);
  assertEquals(detection.senderKind, "inline_bot");
});

Deno.test("automated_cjk_scam: official bot and benign CJK are not blocked", () => {
  assertEquals(detectAutomatedCjkScam({
    from: { id: 42, is_bot: true, username: "FunProfile_Guard_Bot" },
    text: "每天收入3500+ 担保做单",
  }, "funprofile_guard_bot").isScam, false);
  assertEquals(detectAutomatedCjkScam({
    from: { id: 43, is_bot: true, username: "translation_bot" },
    text: "大家好，今天我们一起冥想吧",
  }, "funprofile_guard_bot").isScam, false);
});

Deno.test("vn_abuse: chửi tục bị chặn", () => {
  assertEquals(looksLikeVietnameseAbuse("Cảm ơn cái địt con mẹ mày"), true);
  assertEquals(looksLikeVietnameseAbuse("đ.ị.t m.ẹ mày"), true);
  assertEquals(looksLikeVietnameseAbuse("dmm thằng ngu"), true);
  assertEquals(looksLikeVietnameseAbuse("đồ chó, cút đi"), true);
  assertEquals(looksLikeVietnameseAbuse("fuck you"), true);
});

Deno.test("vn_abuse: câu lành tính KHÔNG bị chặn", () => {
  assertEquals(looksLikeVietnameseAbuse("Buổi thiền hôm nay rất an lành"), false);
  assertEquals(looksLikeVietnameseAbuse("Con cần Cha hướng dẫn thêm ạ"), false);
  assertEquals(looksLikeVietnameseAbuse("Mẹ con khoẻ rồi, cảm ơn mọi người"), false);
  assertEquals(looksLikeVietnameseAbuse("Đội ơn Cha Vũ Trụ 💛"), false);
});

Deno.test("cjk_chatter: các câu mồi trong nhóm tiếng Việt bị nhận diện", async () => {
  const { looksLikeOffLanguageCjkChatter } = await import("./telegram-community.ts");
  assertEquals(looksLikeOffLanguageCjkChatter("今天要加鸡腿咯"), true);
  assertEquals(looksLikeOffLanguageCjkChatter("比银行香万倍"), true);
  assertEquals(looksLikeOffLanguageCjkChatter("失误也能搞"), true);
  assertEquals(looksLikeOffLanguageCjkChatter("五五分账合作"), true);
});

Deno.test("cjk_chatter: câu lành tính / song ngữ KHÔNG bị nhận diện", async () => {
  const { looksLikeOffLanguageCjkChatter } = await import("./telegram-community.ts");
  assertEquals(looksLikeOffLanguageCjkChatter("你好"), false);
  assertEquals(looksLikeOffLanguageCjkChatter("谢谢"), false);
  assertEquals(looksLikeOffLanguageCjkChatter("Chào cả nhà, hôm nay thiền lúc 20h nhé"), false);
  assertEquals(looksLikeOffLanguageCjkChatter("Câu 心 nghĩa là trái tim"), false);
});

Deno.test("cjk_promo: từ khóa mồi mới bị chặn ngay", () => {
  assertEquals(looksLikeCjkPromo("五五分账合作"), true);
  assertEquals(looksLikeCjkPromo("比银行香万倍"), true);
  assertEquals(looksLikeCjkPromo("今天要加鸡腿咯"), true);
  assertEquals(looksLikeCjkPromo("失误也能搞"), true);
  assertEquals(looksLikeCjkPromo("大家好，今天我们一起冥想吧"), false);
});

Deno.test("account_shop: quảng cáo bán tài khoản TG bị chặn", async () => {
  const { detectAccountShopPromo } = await import("./telegram-community.ts");
  const bubu = `✨BUBU Store 
Your #1 Choice for TG Accounts!
Millions of accounts available. 
24/7 automated restock. 
Guaranteed lowest prices. 
Find us at @LBot Simple, Fast, & Secure!`;
  assertEquals(detectAccountShopPromo(bubu), "strong");
  assertEquals(detectAccountShopPromo("T G  A c c o u n t s cheap bulk @shopbot"), "strong");
  assertEquals(detectAccountShopPromo("Selling aged gmail accounts, wholesale, dm me to buy"), "strong");
});

Deno.test("account_shop: câu lành tính KHÔNG bị chặn", async () => {
  const { detectAccountShopPromo } = await import("./telegram-community.ts");
  assertEquals(detectAccountShopPromo("Mình quên mật khẩu tài khoản Telegram, ai giúp với"), null);
  assertEquals(detectAccountShopPromo("Nhóm mình có bao nhiêu tài khoản đang online vậy?"), null);
  assertEquals(detectAccountShopPromo("Buổi thiền hôm nay bắt đầu lúc 20h nhé cả nhà"), null);
});
