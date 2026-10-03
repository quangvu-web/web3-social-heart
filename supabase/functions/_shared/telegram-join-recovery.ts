export type JoinEventProcessingStatus =
  | "pending"
  | "processing"
  | "failed"
  | "done"
  | "needs_review"
  | null;
export type JoinDeliveryFailure =
  | "telegram_rejected"
  | "preflight_failure"
  | "transport_ambiguous";
export type JoinDeliveryState = "not_sent" | "sending" | "sent" | "uncertain";

/** Decide whether a recorded join should attempt an atomic database claim. */
export function joinEventDispatchDecision(input: {
  status: JoinEventProcessingStatus;
  inserted: boolean;
}): "claim" | "skip_terminal" | "skip_legacy" {
  if (input.status === null) return "skip_legacy";
  if (input.status === "done" || input.status === "needs_review") {
    return "skip_terminal";
  }
  return "claim";
}

/** Never retry a Telegram send after an ambiguous network outcome. */
export function joinDeliveryFailureDisposition(
  failure: JoinDeliveryFailure,
): "retry" | "needs_review" {
  return failure === "transport_ambiguous" ? "needs_review" : "retry";
}

/** Telegram 5xx may follow an accepted side effect; only a definite 4xx is retry-safe. */
export function telegramDeliveryFailure(
  status: number | undefined,
): JoinDeliveryFailure {
  if (status === undefined || status === 0 || status >= 500) {
    return "transport_ambiguous";
  }
  return "telegram_rejected";
}

const COMPLETED_JOIN_OUTCOMES = new Set([
  "started",
  "existing_challenge_reused",
  "welcome_sent",
  "welcome_and_verification_disabled",
  "settings_missing",
  "join_guard_removed",
]);

export function joinEventCompletionStatus(
  outcome: string,
  delivery: JoinDeliveryState,
): "done" | "failed" | "needs_review" {
  if (delivery === "uncertain" || delivery === "sending") return "needs_review";
  if (delivery === "sent" && !COMPLETED_JOIN_OUTCOMES.has(outcome)) {
    return "needs_review";
  }
  return COMPLETED_JOIN_OUTCOMES.has(outcome) ? "done" : "failed";
}

export function parseJoinEventRecordResult(value: unknown): {
  id: string;
  status: JoinEventProcessingStatus;
  inserted: boolean;
} | null {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== "object") return null;
  const candidate = row as Record<string, unknown>;
  const allowed = new Set([
    "pending",
    "processing",
    "failed",
    "done",
    "needs_review",
    null,
  ]);
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.inserted !== "boolean" ||
    !allowed.has(candidate.processing_status as JoinEventProcessingStatus)
  ) {
    return null;
  }
  return {
    id: candidate.id,
    status: candidate.processing_status as JoinEventProcessingStatus,
    inserted: candidate.inserted,
  };
}
