import { describe, expect, it } from "bun:test";
import { createLatestGroupSettingsRequest } from "./telegramGroupSettingsLoad";

describe("latest group settings request", () => {
  it("does not allow an older group's slower response to replace the newly selected group", () => {
    const requests = createLatestGroupSettingsRequest();
    const firstGroupRequest = requests.begin();
    const secondGroupRequest = requests.begin();

    expect(requests.isCurrent(firstGroupRequest)).toBe(false);
    expect(requests.isCurrent(secondGroupRequest)).toBe(true);
  });
});
