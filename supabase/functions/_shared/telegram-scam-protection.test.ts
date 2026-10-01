import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  assessTelegramScamRisk,
  enforceScamDeletion,
  type ScamModerationContext,
} from "./telegram-scam-protection.ts";

const xezopointMessage = {
  text:
    "Hãy kiểm tra công ty thanh toán uy tín này 👇👇👇👇\n\nhttps://xezopoint.com/register?ref=19\n\nHọ cung cấp tỷ lệ hoàn trả 10%, 30%, 50%, và thậm chí 100%, tùy thuộc vào gói bạn chọn.",
  urls: ["https://xezopoint.com/register?ref=19"],
};

const context: ScamModerationContext = {
  chatId: -4766615209,
  messageId: 101,
  userId: 77,
  username: "member",
  messageType: "text",
  scamStrictMode: false,
  antiSpamEnabled: true,
  scamProtectionEnabled: true,
};

Deno.test("member high-confidence referral scam is deleted", async () => {
  const assessment = assessTelegramScamRisk({
    ...xezopointMessage,
    strictMode: false,
  });
  let deleteCalls = 0;
  const result = await enforceScamDeletion({
    context,
    assessment,
    deleteMessage: async () => {
      deleteCalls++;
      return { ok: true };
    },
    log: () => undefined,
  });
  assertEquals(result, "deleted");
  assertEquals(deleteCalls, 1);
});

Deno.test("administrator high-confidence scam is deleted", async () => {
  const assessment = assessTelegramScamRisk({
    ...xezopointMessage,
    strictMode: false,
  });
  const result = await enforceScamDeletion({
    context: { ...context, isAdmin: true },
    assessment,
    deleteMessage: async () => ({ ok: true }),
    log: () => undefined,
  });
  assertEquals(result, "deleted");
});

Deno.test("creator and anonymous admin high-confidence scams are deleted", async () => {
  const assessment = assessTelegramScamRisk({
    ...xezopointMessage,
    strictMode: false,
  });
  for (
    const actor of [
      { isAdmin: true, senderChatId: null },
      { isAdmin: true, senderChatId: -4766615209 },
    ]
  ) {
    const result = await enforceScamDeletion({
      context: { ...context, ...actor },
      assessment,
      deleteMessage: async () => ({ ok: true }),
      log: () => undefined,
    });
    assertEquals(result, "deleted");
  }
});

Deno.test("admin normal message is kept", () => {
  const result = assessTelegramScamRisk({
    text: "Chào cả nhà, buổi thiền bắt đầu lúc 20h.",
    urls: [],
    strictMode: false,
  });
  assertEquals(result.shouldDelete, false);
});

Deno.test("admin trusted normal URL is kept", () => {
  const result = assessTelegramScamRisk({
    text: "Xem thông tin tại https://fun.rich/events",
    urls: ["https://fun.rich/events"],
    trustedDomains: ["fun.rich"],
    strictMode: false,
  });
  assertEquals(result.shouldDelete, false);
});

Deno.test("member normal message is kept", () => {
  const result = assessTelegramScamRisk({
    text: "Cảm ơn mọi người 💛",
    urls: [],
    strictMode: false,
  });
  assertEquals(result.shouldDelete, false);
});

Deno.test("xezopoint referral cashback sample is high-risk", () => {
  const result = assessTelegramScamRisk({
    ...xezopointMessage,
    strictMode: false,
  });
  assertEquals(result.shouldDelete, true);
  assertEquals(result.matchedRules.includes("blocked_domain"), true);
});

Deno.test("unknown external URL with a 100 percent profit claim is high-risk", () => {
  const result = assessTelegramScamRisk({
    text:
      "Đầu tư ngay, lợi nhuận 100% tại https://new-investment.example/offer",
    urls: ["https://new-investment.example/offer"],
    strictMode: false,
  });
  assertEquals(result.shouldDelete, true);
  assertEquals(
    result.matchedRules.includes("unrealistic_return_percentage"),
    true,
  );
});

Deno.test("unknown referral URL with investment solicitation is high-risk", () => {
  const result = assessTelegramScamRisk({
    text: "Đăng ký tham gia đầu tư tại https://project.example/join?ref=abc",
    urls: ["https://project.example/join?ref=abc"],
    strictMode: false,
  });
  assertEquals(result.shouldDelete, true);
  assertEquals(result.matchedRules.includes("referral_parameter"), true);
});

Deno.test("strict mode does not disable high-confidence admin scam protection", async () => {
  const assessment = assessTelegramScamRisk({
    ...xezopointMessage,
    strictMode: false,
  });
  const result = await enforceScamDeletion({
    context: { ...context, isAdmin: true, scamStrictMode: false },
    assessment,
    deleteMessage: async () => ({ ok: true }),
    log: () => undefined,
  });
  assertEquals(result, "deleted");
});

Deno.test("strict mode uses a lower threshold for suspicious financial links", () => {
  const message = {
    text:
      "Đăng ký nhận lợi nhuận từ chương trình đầu tư: https://newdomain.example/join",
    urls: ["https://newdomain.example/join"],
  };
  assertEquals(
    assessTelegramScamRisk({ ...message, strictMode: false }).shouldDelete,
    false,
  );
  assertEquals(
    assessTelegramScamRisk({ ...message, strictMode: true }).shouldDelete,
    true,
  );
});

Deno.test("missing delete permission is logged and does not throw", async () => {
  const events: Array<Record<string, unknown>> = [];
  let deleteAttempted = false;
  const result = await enforceScamDeletion({
    context,
    assessment: assessTelegramScamRisk({
      ...xezopointMessage,
      strictMode: false,
    }),
    deleteMessage: async () => {
      deleteAttempted = true;
      return {
        ok: false,
        error_code: 400,
        description: "not enough rights to delete messages",
      };
    },
    checkDeletePermission: async () => ({
      canDeleteMessages: false,
      status: "member",
    }),
    log: (event) => {
      events.push(event);
    },
  });
  assertEquals(deleteAttempted, true);
  assertEquals(result, "delete_failed");
  assertEquals(
    events.some((event) =>
      event.event === "delete_failed" &&
      event.reason === "missing_delete_permission"
    ),
    true,
  );
});
