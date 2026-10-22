import { describe, expect, test } from "bun:test";
import { changeCaptionOperators, parseTelegramId, PROJECT_OWNER_TELEGRAM_ID, searchCaptionCandidates } from "./captionOperators";

describe("Caption operator rules", () => {
  test("accepts positive numeric Telegram IDs, including owner 5373909526", () => {
    expect(parseTelegramId("5373909526")).toBe(PROJECT_OWNER_TELEGRAM_ID);
    for (const input of ["0", "-1", "1.5", "1e3", "abc", "", "9007199254740992"]) {
      expect(parseTelegramId(input)).toBeNull();
    }
  });
  test("adds an ID once and rejects duplicates", () => {
    expect(changeCaptionOperators([5373909526], 123456789, "add")).toEqual([5373909526, 123456789]);
    expect(() => changeCaptionOperators([5373909526], 5373909526, "add")).toThrow();
  });
  test("blocks deletion of the last operator, including duplicate entries", () => {
    expect(() => changeCaptionOperators([5373909526], 5373909526, "remove")).toThrow();
    expect(() => changeCaptionOperators([5373909526, 5373909526], 5373909526, "remove")).toThrow();
  });
  test("removes an operator when another remains", () => {
    expect(changeCaptionOperators([5373909526, 123456789], 123456789, "remove")).toEqual([5373909526]);
  });
  test("searches DM users by name, username and ID while excluding operators", () => {
    const users = [
      { telegram_user_id: 5373909526, first_name: "Vu", last_name: null, username: "owner" },
      { telegram_user_id: 123456789, first_name: "Lan", last_name: "Nguyen", username: "lan_test" },
    ];
    for (const query of ["Lan", "@lan_test", "123456789"]) {
      expect(searchCaptionCandidates(users, [5373909526], query).map((user) => user.telegram_user_id)).toEqual([123456789]);
    }
    expect(searchCaptionCandidates(users, [5373909526], "owner")).toEqual([]);
  });
});