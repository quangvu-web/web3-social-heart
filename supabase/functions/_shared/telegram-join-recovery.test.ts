import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  joinDeliveryFailureDisposition,
  joinEventCompletionStatus,
  joinEventDispatchDecision,
  parseJoinEventRecordResult,
  telegramDeliveryFailure,
} from "./telegram-join-recovery.ts";

Deno.test("new and retryable join events are claimable while terminal and legacy events are not", () => {
  assertEquals(
    joinEventDispatchDecision({ status: "pending", inserted: true }),
    "claim",
  );
  assertEquals(
    joinEventDispatchDecision({ status: "failed", inserted: false }),
    "claim",
  );
  assertEquals(
    joinEventDispatchDecision({ status: "done", inserted: false }),
    "skip_terminal",
  );
  assertEquals(
    joinEventDispatchDecision({ status: "needs_review", inserted: false }),
    "skip_terminal",
  );
  assertEquals(
    joinEventDispatchDecision({ status: null, inserted: false }),
    "skip_legacy",
  );
});

Deno.test("explicit Telegram rejection is retryable but an ambiguous send result needs review", () => {
  assertEquals(joinDeliveryFailureDisposition("telegram_rejected"), "retry");
  assertEquals(joinDeliveryFailureDisposition("preflight_failure"), "retry");
  assertEquals(
    joinDeliveryFailureDisposition("transport_ambiguous"),
    "needs_review",
  );
  assertEquals(telegramDeliveryFailure(403), "telegram_rejected");
  assertEquals(telegramDeliveryFailure(429), "telegram_rejected");
  assertEquals(telegramDeliveryFailure(500), "transport_ambiguous");
  assertEquals(telegramDeliveryFailure(0), "transport_ambiguous");
  assertEquals(telegramDeliveryFailure(undefined), "transport_ambiguous");
});

Deno.test("a sent side effect is never retried when a later database step fails", () => {
  assertEquals(joinEventCompletionStatus("started", "sent"), "done");
  assertEquals(joinEventCompletionStatus("welcome_sent", "sent"), "done");
  assertEquals(
    joinEventCompletionStatus("captcha_message_persist_failed", "sent"),
    "needs_review",
  );
  assertEquals(
    joinEventCompletionStatus("join_flow_exception", "sending"),
    "needs_review",
  );
  assertEquals(
    joinEventCompletionStatus("welcome_failed", "not_sent"),
    "failed",
  );
  assertEquals(
    joinEventCompletionStatus("settings_lookup_failed", "not_sent"),
    "failed",
  );
});

Deno.test("join-event RPC result parser rejects malformed or missing records", () => {
  assertEquals(
    parseJoinEventRecordResult([{
      id: "event-1",
      processing_status: "pending",
      inserted: true,
    }]),
    {
      id: "event-1",
      status: "pending",
      inserted: true,
    },
  );
  assertEquals(
    parseJoinEventRecordResult([{
      id: "legacy-1",
      processing_status: null,
      inserted: false,
    }]),
    {
      id: "legacy-1",
      status: null,
      inserted: false,
    },
  );
  assertEquals(parseJoinEventRecordResult([]), null);
  assertEquals(
    parseJoinEventRecordResult([{
      id: "x",
      processing_status: "surprise",
      inserted: false,
    }]),
    null,
  );
});
