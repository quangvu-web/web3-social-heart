import { describe, expect, it } from "bun:test";
import { REQUIRED_JOIN_WEBHOOK_UPDATES, resolveWebhookUpdatesStatus } from "./telegramWebhookStatus";

describe("Telegram join and CAPTCHA webhook checklist", () => {
  it("distinguishes loading and API failure from confirmed missing updates", () => {
    expect(resolveWebhookUpdatesStatus({ loading: true, verified: false })).toEqual({ state: "loading", missing: [] });
    expect(resolveWebhookUpdatesStatus({ loading: false, verified: false, allowedUpdates: [] })).toEqual({ state: "unverified", missing: [] });
  });

  it("applies Telegram defaults when allowed_updates is omitted or empty", () => {
    expect(resolveWebhookUpdatesStatus({ loading: false, verified: true })).toEqual({ state: "missing", missing: ["chat_member"] });
    expect(resolveWebhookUpdatesStatus({ loading: false, verified: true, allowedUpdates: [] })).toEqual({ state: "missing", missing: ["chat_member"] });
  });

  it("flags each missing required update, including CAPTCHA callbacks", () => {
    for (const missing of REQUIRED_JOIN_WEBHOOK_UPDATES) {
      const allowedUpdates = REQUIRED_JOIN_WEBHOOK_UPDATES.filter((update) => update !== missing);
      expect(resolveWebhookUpdatesStatus({ loading: false, verified: true, allowedUpdates })).toEqual({ state: "missing", missing: [missing] });
    }
  });

  it("reports ready only when message, chat_member, and callback_query are enabled", () => {
    expect(resolveWebhookUpdatesStatus({ loading: false, verified: true, allowedUpdates: [...REQUIRED_JOIN_WEBHOOK_UPDATES] })).toEqual({ state: "ready", missing: [] });
  });
});
