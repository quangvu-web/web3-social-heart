import { describe, expect, it } from "bun:test";
import { formatMyt } from "./formatMyt";

describe("formatMyt", () => {
  it("formats a timestamp in Malaysia time regardless of host timezone", () => {
    expect(formatMyt("2025-01-01T00:00:00.000Z")).toContain("08:00");
  });

  it("returns a safe label for invalid input", () => {
    expect(formatMyt("not-a-date")).toBe("Thời gian không hợp lệ");
  });
});
