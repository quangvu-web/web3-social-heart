import assert from "npm:assert@2.1.0";
import { rateLimitUnavailableDecision } from "./telegram-rate-limit.ts";

Deno.test("rate limiter failure never fails open", () => {
  assert.deepStrictEqual(rateLimitUnavailableDecision(), { allowed: false, count: 0 });
});
