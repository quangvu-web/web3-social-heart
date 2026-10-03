export type QueryResult<T> = { data: T | null; error: { code?: string } | null };

/** Return query data only after a successful database response. */
export function assertQuerySucceeded<T>(result: QueryResult<T>, resource: string): T {
  if (result.error) {
    const code = result.error.code ?? "unknown";
    throw new Error(`${resource} query failed (${code})`);
  }
  return result.data as T;
}

export type TelegramActionResult = { ok: boolean; status?: number };

export type TelegramAdminCheckResult =
  | { verified: true; isAdmin: boolean }
  | { verified: false; errorCode: string };

export function resolveTelegramAdminCheck(result: {
  ok: boolean;
  status?: string | null;
  error_code?: number;
}): TelegramAdminCheckResult {
  if (!result.ok) {
    return { verified: false, errorCode: result.error_code ? String(result.error_code) : "telegram_rejected" };
  }
  if (!result.status) return { verified: false, errorCode: "missing_status" };
  return {
    verified: true,
    isAdmin: result.status === "creator" || result.status === "administrator",
  };
}

export function assertTelegramActionSucceeded(result: TelegramActionResult, action: string): void {
  if (!result.ok) {
    const status = typeof result.status === "number" ? ` (${result.status})` : "";
    throw new Error(`${action} failed${status}`);
  }
}
