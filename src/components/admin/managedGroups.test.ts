import { describe, expect, test } from "bun:test";
import { filterManagedGroups, hasManagedGroupId, managedGroupDisplayName } from "./managedGroups";

const groups = [
  { group_id: -1001234567890, group_title: "FUN Community" },
  { group_id: -1009876543210, group_title: null },
];

describe("Managed Groups display and search", () => {
  test("shows a stored group title with its full ID available", () => {
    expect(managedGroupDisplayName(groups[0].group_title)).toBe("FUN Community");
    expect(groups[0].group_id).toBe(-1001234567890);
  });

  test("uses a fallback for legacy groups without a title", () => {
    expect(managedGroupDisplayName(groups[1].group_title)).toBe("Chưa có tên nhóm");
  });

  test("filters by title or complete numeric group ID", () => {
    expect(filterManagedGroups(groups, "fun")).toEqual([groups[0]]);
    expect(filterManagedGroups(groups, "9876543210")).toEqual([groups[1]]);
  });

  test("detects duplicate group IDs independent of title", () => {
    expect(hasManagedGroupId(groups, -1001234567890)).toBe(true);
    expect(hasManagedGroupId(groups, -1001111111111)).toBe(false);
  });
});
