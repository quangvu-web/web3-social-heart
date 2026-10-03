import assert from "npm:assert@2.1.0";
import { escalatedModerationOutcome } from "./telegram-moderation-outcome.ts";

Deno.test("moderation only reports a ban when Telegram confirms the ban", () => {
  assert.strictEqual(escalatedModerationOutcome({ messageDeleted: true, memberBanned: true }), "ban_succeeded");
  assert.strictEqual(escalatedModerationOutcome({ messageDeleted: true, memberBanned: false }), "message_deleted_ban_failed");
  assert.strictEqual(escalatedModerationOutcome({ messageDeleted: false, memberBanned: false }), "moderation_failed");
});

import { moderationStateDecision, violationActionOutcome } from "./telegram-moderation-outcome.ts";

Deno.test("violation action labels require Telegram confirmation", () => {
  assert.strictEqual(violationActionOutcome({ deleted: true, countWarning: true, banAttempted: true, banSucceeded: false, muteAttempted: false, muteSucceeded: false }), "deleted_ban_failed");
  assert.strictEqual(violationActionOutcome({ deleted: true, countWarning: true, banAttempted: true, banSucceeded: true, muteAttempted: false, muteSucceeded: false }), "banned");
  assert.strictEqual(violationActionOutcome({ deleted: false, countWarning: true, banAttempted: false, banSucceeded: false, muteAttempted: true, muteSucceeded: true }), "muted_message_delete_failed");
  assert.strictEqual(violationActionOutcome({ deleted: false, countWarning: false, banAttempted: false, banSucceeded: false, muteAttempted: false, muteSucceeded: false }), "delete_failed");
});

Deno.test("unavailable warning state never becomes a zero-count warning or escalation", () => {
  assert.strictEqual(violationActionOutcome({
    deleted: true,
    countWarning: true,
    banAttempted: false,
    banSucceeded: false,
    muteAttempted: false,
    muteSucceeded: false,
    warningStateAvailable: false,
  }), "deleted_warning_state_unavailable");
});

Deno.test("missing moderation state for an identified user stops rate-based evaluation", () => {
  assert.strictEqual(moderationStateDecision(true, false), "stop_unverified");
  assert.strictEqual(moderationStateDecision(true, true), "process");
  assert.strictEqual(moderationStateDecision(false, false), "process");
});
