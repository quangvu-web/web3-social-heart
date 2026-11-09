import { describe, expect, it } from "bun:test";
import { resolveAuthBootstrapState, type AuthBootstrapInput } from "./authBootstrapState";

const input = (o: Partial<AuthBootstrapInput>): AuthBootstrapInput => ({
  isLoading: false,
  bootstrapError: null,
  profileError: null,
  hasSession: false,
  hasProfile: false,
  ...o,
});

describe("resolveAuthBootstrapState", () => {
  it("có phiên và có hồ sơ → ready", () => {
    expect(resolveAuthBootstrapState(input({ hasSession: true, hasProfile: true }))).toBe("ready");
  });

  it("khách chưa đăng nhập → ready", () => {
    expect(resolveAuthBootstrapState(input({}))).toBe("ready");
  });

  it("lỗi khởi tạo phiên → fatal dù đã có hồ sơ", () => {
    expect(resolveAuthBootstrapState(input({ bootstrapError: new Error("x"), hasSession: true, hasProfile: true }))).toBe("fatal");
  });

  it("còn đang tải → loading, không báo lỗi", () => {
    expect(resolveAuthBootstrapState(input({ isLoading: true, profileError: new Error("x") }))).toBe("loading");
  });

  it("LỖI HỒ SƠ khi phiên còn hiệu lực → profile-unavailable, KHÔNG phải fatal", () => {
    expect(resolveAuthBootstrapState(input({
      hasSession: true,
      hasProfile: false,
      profileError: new Error("profile bootstrap timeout"),
    }))).toBe("profile-unavailable");
  });

  it("có phiên nhưng chưa có hồ sơ và chưa có lỗi → ready (chờ sự kiện auth, không chặn)", () => {
    expect(resolveAuthBootstrapState(input({ hasSession: true, hasProfile: false }))).toBe("ready");
  });

  it("có lỗi hồ sơ nhưng đã tải được hồ sơ → ready", () => {
    expect(resolveAuthBootstrapState(input({
      hasSession: true,
      hasProfile: true,
      profileError: new Error("x"),
    }))).toBe("ready");
  });
});
