export type TelegramVerificationResult = {
  ok: boolean;
  description?: string;
  errorCode?: number | string;
};

export type VerificationDeliveryResult = TelegramVerificationResult & {
  messageId?: number;
};

export type VerificationStartOutcome =
  | "started"
  | "restriction_failed"
  | "challenge_create_failed"
  | "captcha_send_failed"
  | "captcha_message_persist_failed";

export type VerificationCallbackDecision =
  | { kind: "inactive" }
  | { kind: "not_owner" }
  | { kind: "expired" }
  | { kind: "verified" }
  | { kind: "retry"; attempts: number }
  | { kind: "failed"; attempts: number };

export type VerificationFailureLogAction = "verification_expired" | "verification_failed";
export const VERIFICATION_ENFORCEMENT_LEASE_MS = 60_000;

export type VerifiedCallbackOutcome =
  | "settings_unavailable_released"
  | "settings_unavailable_release_failed"
  | "permissions_restore_failed"
  | "welcome_sent"
  | "welcome_skipped"
  | "welcome_failed";

export function resolveJoinFlow(settings: {
  verificationEnabled: boolean;
  welcomeEnabled: boolean;
}): "verify" | "welcome" | "skip" {
  if (settings.verificationEnabled) return "verify";
  return settings.welcomeEnabled ? "welcome" : "skip";
}

export function isJoinedMembershipState(
  status: string | null | undefined,
  isMember?: boolean,
): boolean {
  if (status === "member") return true;
  return status === "restricted" && isMember !== false;
}

export function verificationClaimOutcome(input: {
  count: number | null;
  hasError: boolean;
}): "claimed" | "already_claimed" | "unavailable" {
  if (input.hasError || input.count === null) return "unavailable";
  if (input.count === 1) return "claimed";
  if (input.count === 0) return "already_claimed";
  return "unavailable";
}

export function isRecoverableVerificationStatus(status: string | null | undefined): boolean {
  return status === "pending" || status === "release_failed";
}

export function isStaleVerificationEnforcement(input: {
  status: string | null | undefined;
  updatedAt: string | null | undefined;
  nowMilliseconds: number;
}): boolean {
  if (input.status !== "enforcement_processing" || !input.updatedAt) return false;
  const updatedAt = Date.parse(input.updatedAt);
  return Number.isFinite(updatedAt) && input.nowMilliseconds - updatedAt >= VERIFICATION_ENFORCEMENT_LEASE_MS;
}

export function welcomeLogMessageId(messageId: number | undefined): number | null {
  return typeof messageId === "number" && Number.isFinite(messageId) ? messageId : null;
}

export async function completeVerifiedCallback<TSettings>(params: {
  settings: TSettings | null;
  settingsLookupErrorCode?: string | null;
  restoreMemberPermissions: () => Promise<TelegramVerificationResult>;
  log: (action: string, reason: string) => Promise<void>;
  continueWelcome: (settings: TSettings) => Promise<Exclude<VerifiedCallbackOutcome, "settings_unavailable_released" | "settings_unavailable_release_failed">>;
}): Promise<VerifiedCallbackOutcome> {
  if (!params.settings) {
    if (params.settingsLookupErrorCode !== undefined) {
      await safeLog(
        params.log,
        "verification_settings_lookup_failed",
        `group_settings_query_failed:${params.settingsLookupErrorCode ?? "unknown"}`,
      );
    }
    const restored = await releaseVerifiedMember({
      restoreMemberPermissions: params.restoreMemberPermissions,
      log: params.log,
    });
    return restored ? "settings_unavailable_released" : "settings_unavailable_release_failed";
  }

  return await params.continueWelcome(params.settings);
}

export async function enforceVerificationFailure(params: {
  action: VerificationFailureLogAction;
  enforce: () => Promise<TelegramVerificationResult>;
  restoreMemberPermissions: () => Promise<TelegramVerificationResult>;
  log: (action: string, reason: string) => Promise<void>;
}): Promise<boolean> {
  let result = await runTelegramOperation(params.enforce);
  if (result.ok) {
    await safeLog(params.log, params.action, "telegram_enforcement_succeeded");
    return true;
  }

  await safeLog(params.log, "verification_enforcement_failed", describeFailure(result));
  const restored = await runTelegramOperation(params.restoreMemberPermissions);
  await safeLog(
    params.log,
    restored.ok ? "verification_restriction_recovered" : "verification_recovery_unrestrict_failed",
    restored.ok ? "restored after enforcement failure" : describeFailure(restored),
  );
  return false;
}

export async function releaseVerifiedMember(params: {
  restoreMemberPermissions: () => Promise<TelegramVerificationResult>;
  log: (action: string, reason: string) => Promise<void>;
}): Promise<boolean> {
  const result = await runTelegramOperation(params.restoreMemberPermissions);
  if (result.ok) return true;

  await safeLog(params.log, "verification_unrestrict_failed", describeFailure(result));
  const retry = await runTelegramOperation(params.restoreMemberPermissions);
  if (retry.ok) {
    await safeLog(params.log, "verification_restriction_recovered", "restored on retry after successful CAPTCHA");
    return true;
  }
  await safeLog(params.log, "verification_unrestrict_retry_failed", describeFailure(retry));
  return false;
}

export function verificationTimeoutSeconds(configuredSeconds: number): number {
  return Number.isFinite(configuredSeconds) && configuredSeconds > 0
    ? Math.max(Math.floor(configuredSeconds), 60)
    : 180;
}

export function verificationRestrictionUntil(
  nowMilliseconds: number,
  configuredSeconds: number,
): number {
  // A short grace allows the expiry handler to process a pending challenge.
  // Recovery paths explicitly unrestrict members when challenge setup fails.
  return Math.floor(nowMilliseconds / 1000) + verificationTimeoutSeconds(configuredSeconds) + 60;
}

export function decideVerificationCallback(input: {
  isPending: boolean;
  ownerUserId: number;
  callbackUserId: number | undefined;
  answer: number;
  correctAnswer: number;
  expiresAtMilliseconds: number;
  nowMilliseconds: number;
  attempts: number;
  maxAttempts: number;
}): VerificationCallbackDecision {
  if (!input.isPending) return { kind: "inactive" };
  if (!input.callbackUserId || input.callbackUserId !== input.ownerUserId) {
    return { kind: "not_owner" };
  }
  if (input.expiresAtMilliseconds <= input.nowMilliseconds) return { kind: "expired" };
  if (input.answer === input.correctAnswer) return { kind: "verified" };

  const attempts = input.attempts + 1;
  return attempts >= input.maxAttempts
    ? { kind: "failed", attempts }
    : { kind: "retry", attempts };
}

export async function startVerificationDelivery(params: {
  restrictMember: () => Promise<TelegramVerificationResult>;
  createChallenge: () => Promise<{ challengeId?: string; error?: string }>;
  sendCaptcha: (
    challengeId: string,
    options: { skipAutoDelete: true },
  ) => Promise<VerificationDeliveryResult>;
  storeCaptchaMessageId: (challengeId: string, messageId: number) => Promise<string | null>;
  markChallengeFailed: (challengeId: string) => Promise<string | null>;
  restoreMemberPermissions: () => Promise<TelegramVerificationResult>;
  deleteCaptcha?: (messageId: number) => Promise<void>;
  log: (action: string, reason: string, messageId?: number | null) => Promise<void>;
  scheduleExpiry: (challengeId: string) => void;
}): Promise<VerificationStartOutcome> {
  const restrictResult = await runTelegramOperation(params.restrictMember);
  if (!restrictResult.ok) {
    await safeLog(params.log, "verification_restriction_failed", describeFailure(restrictResult));
    await restorePermissions(params, null);
    return "restriction_failed";
  }

  let challenge: { challengeId?: string; error?: string };
  try {
    challenge = await params.createChallenge();
  } catch (error) {
    challenge = { error: describeThrown(error) };
  }
  if (!challenge.challengeId) {
    await safeLog(params.log, "verification_create_failed", challenge.error ?? "challenge insert returned no id");
    await restorePermissions(params, null);
    return "challenge_create_failed";
  }

  const challengeId = challenge.challengeId;
  let delivery: VerificationDeliveryResult;
  try {
    delivery = await params.sendCaptcha(challengeId, { skipAutoDelete: true });
  } catch (error) {
    delivery = { ok: false, description: describeThrown(error) };
  }
  if (!delivery.ok || typeof delivery.messageId !== "number") {
    const failure = delivery.ok ? "Telegram returned no CAPTCHA message_id" : describeFailure(delivery);
    await failChallenge(params, challengeId, failure);
    await safeLog(params.log, "verification_send_failed", failure);
    await restorePermissions(params, null);
    return "captcha_send_failed";
  }

  let persistError: string | null;
  try {
    persistError = await params.storeCaptchaMessageId(challengeId, delivery.messageId);
  } catch (error) {
    persistError = describeThrown(error);
  }
  if (persistError) {
    await failChallenge(params, challengeId, persistError);
    await safeLog(params.log, "verification_message_persist_failed", persistError, delivery.messageId);
    try {
      await params.deleteCaptcha?.(delivery.messageId);
    } catch (error) {
      await safeLog(params.log, "verification_captcha_cleanup_failed", describeThrown(error), delivery.messageId);
    }
    await restorePermissions(params, delivery.messageId);
    return "captcha_message_persist_failed";
  }

  await safeLog(params.log, "verification_started", "chat_member", delivery.messageId);
  params.scheduleExpiry(challengeId);
  return "started";
}

async function restorePermissions(
  params: {
    restoreMemberPermissions: () => Promise<TelegramVerificationResult>;
    log: (action: string, reason: string, messageId?: number | null) => Promise<void>;
  },
  messageId: number | null,
) {
  const result = await runTelegramOperation(params.restoreMemberPermissions);
  if (result.ok) {
    await safeLog(params.log, "verification_restriction_recovered", "member permissions restored", messageId);
    return;
  }
  await safeLog(
    params.log,
    "verification_recovery_unrestrict_failed",
    describeFailure(result),
    messageId,
  );
}

async function failChallenge(
  params: {
    markChallengeFailed: (challengeId: string) => Promise<string | null>;
    log: (action: string, reason: string, messageId?: number | null) => Promise<void>;
  },
  challengeId: string,
  cause: string,
) {
  let updateError: string | null;
  try {
    updateError = await params.markChallengeFailed(challengeId);
  } catch (error) {
    updateError = describeThrown(error);
  }
  if (updateError) {
    await safeLog(params.log, "verification_challenge_status_update_failed", updateError);
  }
  // A transient database error must not leave a failed CAPTCHA eligible for
  // the expiry job; retry the terminal-state write once while recording both.
  if (updateError) {
    try {
      const retryError = await params.markChallengeFailed(challengeId);
      if (retryError) {
        await safeLog(params.log, "verification_challenge_status_retry_failed", retryError);
      }
    } catch (error) {
      await safeLog(params.log, "verification_challenge_status_retry_failed", describeThrown(error));
    }
  }
  await safeLog(params.log, "verification_challenge_closed", cause);
}

async function runTelegramOperation<T extends TelegramVerificationResult>(
  operation: () => Promise<T>,
): Promise<TelegramVerificationResult> {
  try {
    return await operation();
  } catch (error) {
    return { ok: false, description: describeThrown(error) };
  }
}

function describeFailure(result: TelegramVerificationResult): string {
  const description = result.description?.trim() || "Telegram operation failed";
  return result.errorCode === undefined ? description : `${result.errorCode}: ${description}`;
}

function describeThrown(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

async function safeLog(
  log: (action: string, reason: string, messageId?: number | null) => Promise<void>,
  action: string,
  reason: string,
  messageId?: number | null,
) {
  try {
    await log(action, reason.slice(0, 240), messageId);
  } catch (error) {
    console.error("[telegram-verification] moderation log failed", {
      action,
      error: describeThrown(error),
    });
  }
}
