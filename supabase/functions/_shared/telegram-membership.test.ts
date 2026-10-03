import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  classifyMemberEventType,
  resolveMemberEventWrite,
} from "./telegram-membership.ts";

Deno.test("member event writes distinguish irrelevant, inserted, duplicate, and failed results", () => {
  assertEquals(resolveMemberEventWrite(null, [], null), { kind: "not_applicable", eventType: null });
  assertEquals(resolveMemberEventWrite("join", [{ event_type: "join" }], null), { kind: "inserted", eventType: "join" });
  assertEquals(resolveMemberEventWrite("join", [], null), { kind: "duplicate", eventType: "join" });
  assertEquals(resolveMemberEventWrite("join", null, null), { kind: "error", eventType: "join", errorCode: "missing_result" });
  assertEquals(resolveMemberEventWrite("join", null, { code: "42501" }), { kind: "error", eventType: "join", errorCode: "42501" });
});

Deno.test("member event type is stable for a repeated Telegram transition", () => {
  assertEquals(classifyMemberEventType("", "member", true), "join");
  assertEquals(classifyMemberEventType("left", "member", true), "rejoined");
  assertEquals(classifyMemberEventType("kicked", "restricted", true), "rejoined");
});
