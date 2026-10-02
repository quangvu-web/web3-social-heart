import assert from "npm:assert@2.1.0";
import {
  completeVerifiedCallback,
  decideVerificationCallback,
  enforceVerificationFailure,
  isRecoverableVerificationStatus,
  isJoinedMembershipState,
  isStaleVerificationEnforcement,
  resolveJoinFlow,
  releaseVerifiedMember,
  verificationClaimOutcome,
  welcomeLogMessageId,
  startVerificationDelivery,
  verificationRestrictionUntil,
  verificationTimeoutSeconds,
} from "./telegram-verification.ts";

Deno.test("verification remains active when welcome messages are disabled", () => {
  assert.deepStrictEqual(resolveJoinFlow({ verificationEnabled: true, welcomeEnabled: false }), "verify");
  assert.deepStrictEqual(resolveJoinFlow({ verificationEnabled: true, welcomeEnabled: true }), "verify");
  assert.deepStrictEqual(resolveJoinFlow({ verificationEnabled: false, welcomeEnabled: true }), "welcome");
  assert.deepStrictEqual(resolveJoinFlow({ verificationEnabled: false, welcomeEnabled: false }), "skip");
});

Deno.test("a restricted user counts as joined only when Telegram says they are still a member", () => {
  assert.strictEqual(isJoinedMembershipState("member"), true);
  assert.strictEqual(isJoinedMembershipState("restricted", true), true);
  assert.strictEqual(isJoinedMembershipState("restricted", false), false);
  assert.strictEqual(isJoinedMembershipState("left"), false);
});

Deno.test("verification claim outcome prevents a duplicate callback from repeating completion", () => {
  assert.deepStrictEqual(verificationClaimOutcome({ count: 1, hasError: false }), "claimed");
  assert.deepStrictEqual(verificationClaimOutcome({ count: 0, hasError: false }), "already_claimed");
  assert.deepStrictEqual(verificationClaimOutcome({ count: null, hasError: false }), "unavailable");
  assert.deepStrictEqual(verificationClaimOutcome({ count: null, hasError: true }), "unavailable");
});

Deno.test("a failed permission restoration remains retryable after the original CAPTCHA expires", () => {
  assert.deepStrictEqual(isRecoverableVerificationStatus("pending"), true);
  assert.deepStrictEqual(isRecoverableVerificationStatus("release_failed"), true);
  assert.deepStrictEqual(isRecoverableVerificationStatus("verified"), false);
  assert.deepStrictEqual(isRecoverableVerificationStatus("failed"), false);
});

Deno.test("only stale enforcement claims can be reclaimed after a webhook interruption", () => {
  const now = Date.parse("2026-10-02T00:02:00.000Z");
  assert.deepStrictEqual(isStaleVerificationEnforcement({
    status: "enforcement_processing",
    updatedAt: "2026-10-02T00:00:59.000Z",
    nowMilliseconds: now,
  }), true);
  assert.deepStrictEqual(isStaleVerificationEnforcement({
    status: "enforcement_processing",
    updatedAt: "2026-10-02T00:01:30.000Z",
    nowMilliseconds: now,
  }), false);
  assert.deepStrictEqual(isStaleVerificationEnforcement({
    status: "verified",
    updatedAt: "2026-10-02T00:00:00.000Z",
    nowMilliseconds: now,
  }), false);
});

Deno.test("welcome log uses the Telegram welcome message ID, not the CAPTCHA message ID", () => {
  assert.deepStrictEqual(welcomeLogMessageId(9001), 9001);
  assert.deepStrictEqual(welcomeLogMessageId(undefined), null);
});

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

Deno.test("permission-denied challenge insert and failing moderation log still release member", async () => {
  // Mirrors production: service_role lacks INSERT on challenges and moderation logs.
  const events: string[] = [];
  const result = await startVerificationDelivery({
    restrictMember: async () => ({ ok: true }),
    createChallenge: async () => { throw new Error("permission denied for table telegram_community_verification_challenges"); },
    sendCaptcha: async () => { events.push("send"); return { ok: true, messageId: 9 }; },
    storeCaptchaMessageId: async () => null,
    markChallengeFailed: async () => null,
    restoreMemberPermissions: async () => { events.push("restore"); return { ok: true }; },
    log: async () => { throw new Error("permission denied for table telegram_community_moderation_logs"); },
    scheduleExpiry: () => events.push("schedule"),
  });

  assert.deepStrictEqual(result, "challenge_create_failed");
  assert.deepStrictEqual(events, ["restore"]);
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
      return "welcome_sent";
    },
  });
  assert.deepStrictEqual(outcome, "settings_unavailable_released");
  assert.deepStrictEqual(events, ["unrestrict"]);
});

Deno.test("correct CAPTCHA with a failed settings query logs the lookup failure, releases permissions, and skips welcome", async () => {
  const events: string[] = [];
  const params = {
    settings: null,
    settingsLookupErrorCode: "42501",
    restoreMemberPermissions: async () => {
      events.push("unrestrict");
      return { ok: true };
    },
    log: async (action: string) => { events.push(`log:${action}`); },
    continueWelcome: async () => {
      events.push("welcome");
      return "welcome_sent" as const;
    },
  };

  const outcome = await completeVerifiedCallback(params);

  assert.deepStrictEqual(outcome, "settings_unavailable_released");
  assert.deepStrictEqual(events, ["log:verification_settings_lookup_failed", "unrestrict"]);
});

Deno.test("successful CAPTCHA reports welcome and permission failures separately", async () => {
  const settings = { id: "group" };
  const welcomeFailed = await completeVerifiedCallback({
    settings,
    restoreMemberPermissions: async () => ({ ok: true }),
    log: async () => undefined,
    continueWelcome: async () => "welcome_failed",
  });
  const permissionsFailed = await completeVerifiedCallback({
    settings,
    restoreMemberPermissions: async () => ({ ok: true }),
    log: async () => undefined,
    continueWelcome: async () => "permissions_restore_failed",
  });

  assert.deepStrictEqual(welcomeFailed, "welcome_failed");
  assert.deepStrictEqual(permissionsFailed, "permissions_restore_failed");
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
