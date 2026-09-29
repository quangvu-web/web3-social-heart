import { describe, expect, it } from "bun:test";
import { canMutateVerifiedAdminData, getAdminLoadState } from "./adminLoadState";

describe("admin data load states", () => {
  it("distinguishes loading, failure, verified empty, and populated data", () => {
    expect(getAdminLoadState({ loading: true, error: false, loaded: false, hasRows: false })).toBe("loading");
    expect(getAdminLoadState({ loading: false, error: true, loaded: false, hasRows: false })).toBe("error");
    expect(getAdminLoadState({ loading: false, error: false, loaded: true, hasRows: false })).toBe("empty");
    expect(getAdminLoadState({ loading: false, error: false, loaded: true, hasRows: true })).toBe("success");
  });

  it("blocks mutations unless the empty or populated state was verified", () => {
    expect(canMutateVerifiedAdminData("loading")).toBe(false);
    expect(canMutateVerifiedAdminData("error")).toBe(false);
    expect(canMutateVerifiedAdminData("empty")).toBe(true);
    expect(canMutateVerifiedAdminData("success")).toBe(true);
  });
});
