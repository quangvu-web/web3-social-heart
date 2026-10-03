import assert from "npm:assert@2.1.0";
import { resolveAdminRoleCheck } from "./telegram-admin-auth.ts";

Deno.test("admin role true is allowed", () => {
  assert.deepStrictEqual(resolveAdminRoleCheck(true), { allowed: true });
});

Deno.test("admin role false remains a forbidden user", () => {
  assert.deepStrictEqual(resolveAdminRoleCheck(false), { allowed: false, reason: "not_admin" });
});

Deno.test("has_role RPC failure is unverified, not a non-admin result", () => {
  assert.deepStrictEqual(resolveAdminRoleCheck(null, "57014"), {
    allowed: false,
    reason: "unverified",
    errorCode: "57014",
  });
});
