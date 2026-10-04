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

import {
  effectiveMemberStatus,
  isMemberLeaveTransition,
  shouldProcessChatMemberJoin,
} from "./telegram-verification.ts";

// Regression: group -1004298473783 (2026-10-04). After CAPTCHA, the member stays
// "restricted"; later leave/rejoin arrive as restricted→restricted with is_member flipping.
Deno.test("restricted member leave/rejoin is detected via is_member for every group", () => {
  const leaveOld = effectiveMemberStatus("restricted", true);
  const leaveNew = effectiveMemberStatus("restricted", false);
  assertEquals([leaveOld, leaveNew], ["restricted", "left"]);
  assertEquals(isMemberLeaveTransition(leaveOld, leaveNew), true);
  assertEquals(classifyMemberEventType(leaveOld, leaveNew, true), "left");

  const rejoinOld = effectiveMemberStatus("restricted", false);
  const rejoinNew = effectiveMemberStatus("restricted", true);
  assertEquals(classifyMemberEventType(rejoinOld, rejoinNew, true), "rejoined");
  assertEquals(
    shouldProcessChatMemberJoin({ oldStatus: rejoinOld, newStatus: rejoinNew, isMember: true }),
    true,
  );
});

Deno.test("permission changes for a present member are not treated as join or leave", () => {
  const oldS = effectiveMemberStatus("member", true);
  const newS = effectiveMemberStatus("restricted", true);
  assertEquals(classifyMemberEventType(oldS, newS, false), null);
  assertEquals(isMemberLeaveTransition(oldS, newS), false);
  assertEquals(shouldProcessChatMemberJoin({ oldStatus: oldS, newStatus: newS, isMember: true }), false);
  const r1 = effectiveMemberStatus("restricted", true);
  assertEquals(shouldProcessChatMemberJoin({ oldStatus: r1, newStatus: r1, isMember: true }), false);
});

Deno.test("plain leave, kick and first join keep their existing classification", () => {
  assertEquals(effectiveMemberStatus("left", undefined), "left");
  assertEquals(effectiveMemberStatus(undefined, undefined), undefined);
  assertEquals(isMemberLeaveTransition("member", "left"), true);
  assertEquals(isMemberLeaveTransition("member", "kicked"), true);
  assertEquals(shouldProcessChatMemberJoin({ oldStatus: "left", newStatus: "member" }), true);
  assertEquals(shouldProcessChatMemberJoin({ oldStatus: undefined, newStatus: "member" }), true);
});
