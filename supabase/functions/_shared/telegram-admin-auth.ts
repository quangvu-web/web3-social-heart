export type AdminRoleCheck =
  | { allowed: true }
  | { allowed: false; reason: "not_admin" }
  | { allowed: false; reason: "unverified"; errorCode: string };

export function resolveAdminRoleCheck(isAdmin: boolean | null, errorCode?: string | null): AdminRoleCheck {
  if (errorCode) return { allowed: false, reason: "unverified", errorCode };
  return isAdmin === true
    ? { allowed: true }
    : { allowed: false, reason: "not_admin" };
}
