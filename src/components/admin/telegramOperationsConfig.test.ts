import { describe, expect, it } from "bun:test";
import { adminNavigationGroups, buildAdminTabSearch, resolveAdminTab } from "./telegramOperationsConfig";

describe("Telegram Operations navigation", () => {
  it("maps every existing admin screen exactly once", () => {
    const values = adminNavigationGroups.flatMap((group) => group.items.map((item) => item.value));

    expect(values).toHaveLength(31);
    expect(new Set(values).size).toBe(31);
    expect(values).toContain("cloud-usage");
    expect(values).toContain("prompt-versions");
    expect(values).toContain("feature-flags");
    expect(values).toContain("ai-ops");
  });

  it("resolves a valid direct-link tab and falls back for unknown tabs", () => {
    expect(resolveAdminTab("?tab=telegram")).toBe("telegram");
    expect(resolveAdminTab("?tab=unknown")).toBe("overview");
    expect(resolveAdminTab("")).toBe("overview");
  });

  it("changes the tab while preserving other URL state", () => {
    expect(buildAdminTabSearch("?range=24h&tab=telegram", "dm-bot")).toBe("?range=24h&tab=dm-bot");
    expect(buildAdminTabSearch("", "overview")).toBe("?tab=overview");
  });
});
