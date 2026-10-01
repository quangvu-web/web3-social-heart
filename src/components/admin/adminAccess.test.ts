import { describe, expect, it } from "bun:test";
import { resolveAdminAccess, type AdminAccessDeps } from "./adminAccess";

const deps = (o: Partial<AdminAccessDeps>): AdminAccessDeps => ({
  getUserId: async () => "u1",
  hasRole: async () => ({ data: true, error: null }),
  refreshSession: async () => {},
  ...o,
});

describe("resolveAdminAccess", () => {
  it("true → granted", async () => {
    expect(await resolveAdminAccess(deps({}))).toEqual({ status: "granted", userId: "u1" });
  });
  it("false → denied", async () => {
    expect(await resolveAdminAccess(deps({ hasRole: async () => ({ data: false, error: null }) })))
      .toEqual({ status: "denied", userId: "u1" });
  });
  it("không có phiên → no-session", async () => {
    expect((await resolveAdminAccess(deps({ getUserId: async () => null }))).status).toBe("no-session");
  });
  it("lỗi lần đầu, làm mới phiên rồi thành công → granted", async () => {
    let n = 0; let refreshed = false;
    const r = await resolveAdminAccess(deps({
      hasRole: async () => (n++ === 0 ? { data: null, error: { code: "PGRST301" } } : { data: true, error: null }),
      refreshSession: async () => { refreshed = true; },
    }));
    expect(r.status).toBe("granted");
    expect(refreshed).toBe(true);
  });
  it("lỗi RPC liên tục → error, không phải denied", async () => {
    const r = await resolveAdminAccess(deps({ hasRole: async () => ({ data: null, error: { code: "500" } }) }));
    expect(r.status).toBe("error");
  });
  it("mạng lỗi → error", async () => {
    const r = await resolveAdminAccess(deps({ hasRole: async () => { throw new Error("x"); } }));
    expect(r).toEqual({ status: "error", reason: "network" });
  });
  it("dữ liệu lạ (null) → error, không phải denied", async () => {
    const r = await resolveAdminAccess(deps({ hasRole: async () => ({ data: null, error: null }) }));
    expect(r.status).toBe("error");
  });
});
