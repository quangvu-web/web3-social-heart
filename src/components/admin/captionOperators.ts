export const PROJECT_OWNER_TELEGRAM_ID = 5373909526;

export function parseTelegramId(input: string): number | null {
  const value = input.trim();
  if (!/^\d+$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function changeCaptionOperators(ids: number[], id: number, action: "add" | "remove"): number[] {
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Telegram ID phải là số nguyên dương hợp lệ.");
  const current = [...new Set(ids)];
  if (action === "add") {
    if (current.includes(id)) throw new Error("Telegram ID này đã được cấp quyền.");
    return [...current, id];
  }
  if (!current.includes(id)) throw new Error("Telegram ID này không còn trong danh sách.");
  if (current.length <= 1) throw new Error("Không thể xóa operator cuối cùng. Hãy thêm người được cấp quyền khác trước.");
  return current.filter((value) => value !== id);
}

export interface CaptionDmUser {
  telegram_user_id: number;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
}

export function searchCaptionCandidates(users: CaptionDmUser[], ids: number[], search: string): CaptionDmUser[] {
  const query = search.trim().toLocaleLowerCase().replace(/^@/, "");
  return users.filter((user) => !ids.includes(user.telegram_user_id) &&
    `${user.first_name ?? ""} ${user.last_name ?? ""} ${user.username ?? ""} ${user.telegram_user_id}`
      .toLocaleLowerCase().includes(query));
}