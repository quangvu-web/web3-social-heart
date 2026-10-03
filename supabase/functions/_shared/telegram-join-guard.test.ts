import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  attemptJoinGateAction,
  attemptJoinGateRemoval,
  joinGateFailureDisposition,
  scanJoinName,
  normalizeJoinName,
  avatarVerdictBlocks,
  joinGateRemovalOutcome,
} from "./telegram-join-guard.ts";

Deno.test("normalizeJoinName strips accents, leet and zero-width", () => {
  assertEquals(normalizeJoinName("S3xy​ Gái Gọi"), "sexy gai goi");
});

Deno.test("scanJoinName blocks adult / shop / gambling names", () => {
  assertEquals(scanJoinName("Hot Sexy Girl")?.keyword, "sexy");
  assertEquals(scanJoinName("BUBU Store acc")?.keyword, "bubu store");
  assertEquals(scanJoinName("789bet vip")?.keyword, "789bet");
  assertEquals(scanJoinName("同城约炮小妹")?.keyword, "约炮");
});

Deno.test("scanJoinName is safe for normal names and substrings", () => {
  assertEquals(scanJoinName("Nguyen Van An"), null);
  assertEquals(scanJoinName("Essex Trading"), null);
  assertEquals(scanJoinName("Camly Coin"), null);
});

Deno.test("scanJoinName honours allowlist and extra keywords", () => {
  assertEquals(scanJoinName("Sexy Angel", { allowlist: ["sexy angel"] }), null);
  assertEquals(scanJoinName("Spam King", { extraKeywords: ["spam king"] })?.source, "group");
});

Deno.test("avatarVerdictBlocks respects threshold", () => {
  assertEquals(avatarVerdictBlocks("explicit", "explicit"), true);
  assertEquals(avatarVerdictBlocks("suspicious", "explicit"), false);
  assertEquals(avatarVerdictBlocks("suspicious", "suspicious"), true);
  assertEquals(avatarVerdictBlocks("safe", "suspicious"), false);
});

Deno.test("join gate only treats Telegram-confirmed removal as successful", () => {
  assertEquals(joinGateRemovalOutcome(true), "removed");
  assertEquals(joinGateRemovalOutcome(false), "failed");
});

Deno.test("join gate maps Telegram rejection and thrown API errors to removal failure", async () => {
  assertEquals(await attemptJoinGateRemoval(async () => ({ ok: false })), {
    outcome: "failed",
    failure: "telegram_rejected",
    errorCode: null,
  });
  assertEquals(await attemptJoinGateRemoval(async () => { throw new Error("network"); }), {
    outcome: "failed",
    failure: "telegram_exception",
    errorCode: null,
  });
  assertEquals(await attemptJoinGateRemoval(async () => ({ ok: true })), {
    outcome: "removed",
    failure: null,
    errorCode: null,
  });
});

Deno.test("join gate invokes the selected kick or ban action and accepts only confirmed success", async () => {
  for (const action of ["kick", "ban"] as const) {
    let called: string | null = null;
    const handlers = {
      kick: async () => { called = "kick"; return { ok: true }; },
      ban: async () => { called = "ban"; return { ok: true }; },
    };
    assertEquals(await attemptJoinGateAction(action, handlers), {
      outcome: "removed",
      failure: null,
      errorCode: null,
    });
    assertEquals(called, action);
  }
});

Deno.test("failed join-gate removal continues to CAPTCHA only when verification is enabled", () => {
  assertEquals(joinGateFailureDisposition("removed", true), "stop_removed");
  assertEquals(joinGateFailureDisposition("failed", true), "continue_to_verification");
  assertEquals(joinGateFailureDisposition("failed", false), "stop_unremoved");
  assertEquals(joinGateFailureDisposition("not_required", false), "continue_join_flow");
});
