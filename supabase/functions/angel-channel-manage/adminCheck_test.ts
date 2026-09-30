import { assertEquals } from "jsr:@std/assert@1";
import { checkIsAdmin, type HasRoleRpcClient } from "./adminCheck.ts";

function mockClient(result: { data: unknown; error: { message?: string; code?: string } | null }) {
  const calls: unknown[] = [];
  const client: HasRoleRpcClient = {
    rpc: (fn, args) => {
      calls.push({ fn, args });
      return Promise.resolve(result);
    },
  };
  return { client, calls };
}

const USER_ID = "00000000-0000-0000-0000-000000000001";

Deno.test("has_role true → cho phép tiếp tục", async () => {
  const { client, calls } = mockClient({ data: true, error: null });
  const res = await checkIsAdmin(client, USER_ID);
  assertEquals(res, { ok: true });
  assertEquals(calls, [{ fn: "has_role", args: { _user_id: USER_ID, _role: "admin" } }]);
});

Deno.test("has_role false → 403 ADMIN_REQUIRED", async () => {
  const { client } = mockClient({ data: false, error: null });
  const res = await checkIsAdmin(client, USER_ID);
  assertEquals(res.ok, false);
  if (!res.ok) {
    assertEquals(res.status, 403);
    assertEquals(res.code, "ADMIN_REQUIRED");
  }
});

Deno.test("has_role lỗi → ADMIN_CHECK_FAILED an toàn, không lộ chi tiết", async () => {
  const { client } = mockClient({ data: null, error: { code: "42501", message: "permission denied secret-detail" } });
  const res = await checkIsAdmin(client, USER_ID);
  assertEquals(res.ok, false);
  if (!res.ok) {
    assertEquals(res.status, 500);
    assertEquals(res.code, "ADMIN_CHECK_FAILED");
    assertEquals(res.error.includes("secret-detail"), false);
  }
});

Deno.test("has_role throw → ADMIN_CHECK_FAILED", async () => {
  const client: HasRoleRpcClient = { rpc: () => Promise.reject(new Error("network")) };
  const res = await checkIsAdmin(client, USER_ID);
  assertEquals(res.ok ? 0 : res.status, 500);
});
