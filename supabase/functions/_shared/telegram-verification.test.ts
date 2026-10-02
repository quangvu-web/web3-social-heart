import assert from "npm:assert@2.1.0";
import {
  completeVerifiedCallback,
  decideVerificationCallback,
  enforceVerificationFailure,
  releaseVerifiedMember,
  startVerificationDelivery,
  verificationRestrictionUntil,
  verificationTimeoutSeconds,
} from "./telegram-verification.ts";

Deno.test("180-second CAPTCHA timeout restricts only through timeout plus grace", () => {
  assert.deepStrictEqual(verificationTimeoutSeconds(180), 180);
  assert.deepStrictEqual(verificationRestrictionUntil(1_790_000_000_000, 180), 1_790_000_240);
  assert.deepStrictEqual(verificationTimeoutSeconds(Number.NaN), 180);
});

Deno.test("restriction failure restores ambiguous Telegram state and does not create challenge", async () => {
  const events: string[] = [];
  const result = await startVerificationDelivery({
    restrictMember: async () => ({ ok: false, errorCode: 400, description: "restrict denied" }),
    createChallenge: async () => {
      events.push("create");
      return { challengeId: "challenge-1" };
    },
    sendCaptcha: async () => {
      events.push("send");
      return { ok: true, messageId: 9 };
    },
    storeCaptchaMessageId: async () => null,
    markChallengeFailed: async () => null,
    restoreMemberPermissions: async () => {
      events.push("restore");
      return { ok: true };
    },
    log: async (action) => { events.push(action); },
    scheduleExpiry: () => events.push("schedule"),
  });

  assert.deepStrictEqual(result, "restriction_failed");
  assert.deepStrictEqual(events, ["verification_restriction_failed", "restore", "verification_restriction_recovered"]);
});

Deno.test("challenge creation failure releases member after a successful restriction", async () => {
  const events: string[] = [];
  const result = await startVerificationDelivery({
    restrictMember: async () => ({ ok: true }),
    createChallenge: async () => ({ error: "insert failed" }),
    sendCaptcha: async () => ({ ok: true, messageId: 9 }),
    storeCaptchaMessageId: async () => null,
    markChallengeFailed: async () => null,
    restoreMemberPermissions: async () => {
      events.push("restore");
      return { ok: true };
    },
    log: async (action) => { events.push(action); },
    scheduleExpiry: () => events.push("schedule"),
  });

  assert.deepStrictEqual(result, "challenge_create_failed");
  assert.deepStrictEqual(events, ["verification_create_failed", "restore", "verification_restriction_recovered"]);
});

Deno.test("CAPTCHA send failure closes challenge and releases member", async () => {
  const events: string[] = [];
  const result = await startVerificationDelivery({
    restrictMember: async () => ({ ok: true }),
    createChallenge: async () => ({ challengeId: "challenge-1" }),
    sendCaptcha: async (_challengeId, options) => {
      events.push(options.skipAutoDelete ? "skip-auto-delete" : "auto-delete-enabled");
      return { ok: false, errorCode: 403, description: "send denied" };
    },
    storeCaptchaMessageId: async () => null,
    markChallengeFailed: async () => {
      events.push("mark-failed");
      return null;
    },
    restoreMemberPermissions: async () => {
      events.push("restore");
      return { ok: true };
    },
    log: async (action) => { events.push(action); },
    scheduleExpiry: () => events.push("schedule"),
  });

  assert.deepStrictEqual(result, "captcha_send_failed");
  assert.deepStrictEqual(events, [
    "skip-auto-delete",
    "mark-failed",
    "verification_challenge_closed",
    "verification_send_failed",
    "restore",
    "verification_restriction_recovered",
  ]);
});

Deno.test("successful CAPTCHA is protected from auto-delete and starts expiry tracking", async () => {
  const events: string[] = [];
  const result = await startVerificationDelivery({
    restrictMember: async () => ({ ok: true }),
    createChallenge: async () => ({ challengeId: "challenge-1" }),
    sendCaptcha: async (_challengeId, options) => {
      events.push(options.skipAutoDelete ? "skip-auto-delete" : "auto-delete-enabled");
      return { ok: true, messageId: 9 };
    },
    storeCaptchaMessageId: async () => null,
    markChallengeFailed: async () => null,
    restoreMemberPermissions: async () => ({ ok: true }),
    log: async (action) => { events.push(action); },
    scheduleExpiry: (challengeId) => events.push(`schedule:${challengeId}`),
  });

  assert.deepStrictEqual(result, "started");
  assert.deepStrictEqual(events, ["skip-auto-delete", "verification_started", "schedule:challenge-1"]);
});

Deno.test("correct, wrong, and expired verification callbacks are distinguished", () => {
  const base = {
    isPending: true,
    ownerUserId: 42,
    callbackUserId: 42,
    answer: 6,
    correctAnswer: 6,
    expiresAtMilliseconds: 2_000,
    nowMilliseconds: 1_000,
    attempts: 0,
    maxAttempts: 3,
  };

  assert.deepStrictEqual(decideVerificationCallback(base), { kind: "verified" });
  assert.deepStrictEqual(decideVerificationCallback({ ...base, answer: 7 }), { kind: "retry", attempts: 1 });
  assert.deepStrictEqual(decideVerificationCallback({ ...base, nowMilliseconds: 2_000 }), { kind: "expired" });
  assert.deepStrictEqual(decideVerificationCallback({ ...base, callbackUserId: 99 }), { kind: "not_owner" });
  assert.deepStrictEqual(decideVerificationCallback({ ...base, isPending: false }), { kind: "inactive" });
  assert.deepStrictEqual(decideVerificationCallback({ ...base, answer: 7, attempts: 2 }), { kind: "failed", attempts: 3 });
});

Deno.test("successful expiry and failed-answer enforcement records the matching moderation action", async () => {
  for (const action of ["verification_expired", "verification_failed"] as const) {
    const logged: string[] = [];
    const succeeded = await enforceVerificationFailure({
      action,
      enforce: async () => ({ ok: true }),
      restoreMemberPermissions: async () => ({ ok: true }),
      log: async (name) => { logged.push(name); },
    });
    assert.deepStrictEqual(succeeded, true);
    assert.deepStrictEqual(logged, [action]);
  }
});

Deno.test("correct answer with unavailable settings releases permissions before callback outcome", async () => {
  const events: string[] = [];
  const outcome = await completeVerifiedCallback({
    settings: null,
    restoreMemberPermissions: async () => {
      events.push("unrestrict");
      return { ok: true };
    },
    log: async (action) => { events.push(`log:${action}`); },
    continueWelcome: async () => {
      events.push("welcome");
      return true;
    },
  });
  assert.deepStrictEqual(outcome, "settings_unavailable_released");
  assert.deepStrictEqual(events, ["unrestrict"]);
});

Deno.test("Telegram exceptions during verified-member unrestrict are logged and retried", async () => {
  const events: string[] = [];
  let calls = 0;
  const restored = await releaseVerifiedMember({
    restoreMemberPermissions: async () => {
      calls++;
      if (calls === 1) throw new Error("Telegram network failure");
      return { ok: true };
    },
    log: async (action) => { events.push(action); },
  });
  assert.deepStrictEqual(restored, true);
  assert.deepStrictEqual(calls, 2);
  assert.deepStrictEqual(events, ["verification_unrestrict_failed", "verification_restriction_recovered"]);
});
