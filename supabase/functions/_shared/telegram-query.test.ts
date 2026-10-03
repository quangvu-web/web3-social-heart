import assert from "npm:assert@2.1.0";
import { assertQuerySucceeded, resolveTelegramAdminCheck } from "./telegram-query.ts";

Deno.test("query result with database error throws instead of masking it", () => {
  assert.throws(
    () => assertQuerySucceeded({ data: null, error: { code: "42501" } }, "domain whitelist"),
    /domain whitelist query failed \(42501\)/,
  );
});

Deno.test("successful empty result remains an empty result", () => {
  assert.deepStrictEqual(assertQuerySucceeded({ data: [], error: null }, "domain whitelist"), []);
});

import { assertTelegramActionSucceeded } from "./telegram-query.ts";

Deno.test("Telegram API rejection is not reported as a successful report send", () => {
  assert.throws(
    () => assertTelegramActionSucceeded({ ok: false, status: 502 }, "daily report send"),
    /daily report send failed \(502\)/,
  );
});

Deno.test("Telegram API success passes report send verification", () => {
  assert.doesNotThrow(() => assertTelegramActionSucceeded({ ok: true, status: 200 }, "daily report send"));
});

Deno.test("admin status lookup failure is unverified, not a non-admin result", () => {
  assert.deepStrictEqual(resolveTelegramAdminCheck({ ok: false, error_code: 502 }), {
    verified: false,
    errorCode: "502",
  });
  assert.deepStrictEqual(resolveTelegramAdminCheck({ ok: true, status: "administrator" }), {
    verified: true,
    isAdmin: true,
  });
  assert.deepStrictEqual(resolveTelegramAdminCheck({ ok: true, status: "member" }), {
    verified: true,
    isAdmin: false,
  });
});
