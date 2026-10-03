export type EscalatedModerationOutcome =
  | "ban_succeeded"
  | "message_deleted_ban_failed"
  | "moderation_failed";

export function escalatedModerationOutcome(input: {
  messageDeleted: boolean;
  memberBanned: boolean;
}): EscalatedModerationOutcome {
  if (input.memberBanned) return "ban_succeeded";
  return input.messageDeleted ? "message_deleted_ban_failed" : "moderation_failed";
}

export function violationActionOutcome(input: {
  deleted: boolean;
  countWarning: boolean;
  banAttempted: boolean;
  banSucceeded: boolean;
  muteAttempted: boolean;
  muteSucceeded: boolean;
  warningStateAvailable?: boolean;
}): string {
  if (input.banAttempted) {
    if (input.banSucceeded) return input.deleted ? "banned" : "banned_message_delete_failed";
    return input.deleted ? "deleted_ban_failed" : "moderation_failed";
  }
  if (input.muteAttempted) {
    if (input.muteSucceeded) return input.deleted ? "muted" : "muted_message_delete_failed";
    return input.deleted ? "deleted_mute_failed" : "moderation_failed";
  }
  if (input.warningStateAvailable === false) {
    return input.deleted ? "deleted_warning_state_unavailable" : "moderation_failed";
  }
  if (!input.deleted) return "delete_failed";
  return input.countWarning ? "deleted_warned" : "deleted_warned_no_escalation";
}

export function moderationStateDecision(
  hasIdentifiedUser: boolean,
  stateAvailable: boolean,
): "process" | "stop_unverified" {
  return hasIdentifiedUser && !stateAvailable ? "stop_unverified" : "process";
}
