import { describe, expect, it } from "bun:test";
import { getTelegramWebhookStatus, sanitizeWebhookUrl } from "./telegramWebhookStatus";

const expectedUrl = "https://project.supabase.co/functions/v1/telegram-community-webhook";

describe("Telegram webhook status", () => {
  it("keeps a matching webhook in monitoring until a reply is actually verified", () => {
    expect(getTelegramWebhookStatus({ url: expectedUrl, pending_update_count: 0 }, expectedUrl, 1_000_000).state)
      .toBe("monitor");
  });

  it("reports missing and unexpected webhook targets as errors", () => {
    expect(getTelegramWebhookStatus({ url: "" }, expectedUrl, 1_000_000).state).toBe("error");
    expect(getTelegramWebhookStatus({ url: "https://other.example/hook" }, expectedUrl, 1_000_000).state).toBe("error");
  });

  it("treats only recent Telegram delivery errors as current errors", () => {
    expect(getTelegramWebhookStatus({
      url: expectedUrl,
      last_error_date: 999_500,
      last_error_message: "delivery failed",
    }, expectedUrl, 1_000_000_000).state).toBe("error");
    expect(getTelegramWebhookStatus({
      url: expectedUrl,
      last_error_date: 900_000,
      last_error_message: "old delivery failed",
    }, expectedUrl, 1_000_000_000).state).toBe("monitor");
  });

  it("never shows or copies query credentials or an unknown path", () => {
    expect(sanitizeWebhookUrl(`${expectedUrl}?secret=abc123&token=hidden`)).toBe(expectedUrl);
    expect(sanitizeWebhookUrl("https://project.supabase.co/private/bot-token?secret=abc123"))
      .toBe("https://project.supabase.co/…");
  });
});
