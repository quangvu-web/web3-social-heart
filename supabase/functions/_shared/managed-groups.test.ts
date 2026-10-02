import { describe, expect, test } from "bun:test";
import { loadManagedGroupTitles } from "./managed-groups";

const allowlist = [
  { id: "managed-1", group_id: -1001234567890 },
  { id: "managed-2", group_id: -1009876543210 },
];

describe("managed group title loading", () => {
  test("uses titles from telegram_group_config only", async () => {
    let configReadCount = 0;
    const result = await loadManagedGroupTitles({
      readAllowlist: async () => ({ data: allowlist, error: null }),
      readTelegramGroupConfigTitles: async (ids) => {
        configReadCount++;
        expect(ids).toEqual(allowlist.map((group) => group.group_id));
        return { data: [{ group_id: allowlist[0].group_id, group_title: "FUN Community" }], error: null };
      },
      onMetadataError: () => { throw new Error("unexpected metadata failure"); },
    });

    expect(configReadCount).toBe(1);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.groups).toEqual([
        { ...allowlist[0], group_title: "FUN Community" },
        { ...allowlist[1], group_title: null },
      ]);
    }
  });

  test("metadata failure preserves allowlist IDs and reports a safe failure state", async () => {
    const loggedCodes: Array<string | undefined> = [];
    const result = await loadManagedGroupTitles({
      readAllowlist: async () => ({ data: allowlist, error: null }),
      readTelegramGroupConfigTitles: async () => ({
        data: null,
        error: { code: "42501", message: "permission denied for table telegram_group_config" },
      }),
      onMetadataError: (code) => { loggedCodes.push(code); },
    });

    expect(result.success).toBe(true);
    expect(loggedCodes).toEqual(["42501"]);
    if (result.success) {
      expect(result.titleLookupFailed).toBe(true);
      expect(result.groups.map((group) => group.group_id)).toEqual(allowlist.map((group) => group.group_id));
      expect(result.groups.every((group) => group.group_title === null)).toBe(true);
      expect(JSON.stringify(result)).not.toContain("permission denied");
    }
  });

  test("allowlist failure remains a list failure and skips metadata lookup", async () => {
    let metadataCalled = false;
    const result = await loadManagedGroupTitles({
      readAllowlist: async () => ({ data: null, error: { code: "42501", message: "allowlist read failed" } }),
      readTelegramGroupConfigTitles: async () => {
        metadataCalled = true;
        return { data: [], error: null };
      },
      onMetadataError: () => undefined,
    });
    expect(result).toEqual({ success: false, error: "allowlist read failed" });
    expect(metadataCalled).toBe(false);
  });
});
