export type AdminAccessResult =
  | { status: "granted"; userId: string }
  | { status: "denied"; userId: string }
  | { status: "no-session" }
  | { status: "error"; reason: string };

type RpcResult = { data: unknown; error: { message?: string; code?: string } | null };

export interface AdminAccessDeps {
  getUserId: () => Promise<string | null>;
  hasRole: (userId: string) => Promise<RpcResult>;
  refreshSession: () => Promise<void>;
}

/**
 * Xác định quyền admin. Chỉ trả "denied" khi has_role trả đúng false.
 * Lỗi RPC/mạng được thử lại một lần sau khi làm mới phiên, sau đó trả "error".
 */
export async function resolveAdminAccess(deps: AdminAccessDeps): Promise<AdminAccessResult> {
  let userId: string | null;
  try {
    userId = await deps.getUserId();
  } catch {
    return { status: "error", reason: "session" };
  }
  if (!userId) return { status: "no-session" };

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { data, error } = await deps.hasRole(userId);
      if (!error) {
        if (data === true) return { status: "granted", userId };
        if (data === false) return { status: "denied", userId };
        return { status: "error", reason: "unexpected-response" };
      }
      if (attempt === 0) {
        await deps.refreshSession().catch(() => undefined);
        continue;
      }
      return { status: "error", reason: error.code ?? "rpc" };
    } catch {
      if (attempt === 0) {
        await deps.refreshSession().catch(() => undefined);
        continue;
      }
      return { status: "error", reason: "network" };
    }
  }
  return { status: "error", reason: "rpc" };
}
