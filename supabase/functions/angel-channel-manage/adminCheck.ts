/**
 * Admin check via public.has_role(_user_id uuid, _role app_role) RPC (SECURITY DEFINER).
 * Không truy vấn trực tiếp bảng user_roles (service_role không có quyền SELECT trên production).
 */

export type HasRoleRpcClient = {
  rpc: (
    fn: "has_role",
    args: { _user_id: string; _role: "admin" },
  ) => PromiseLike<{ data: unknown; error: { message?: string; code?: string } | null }>;
};

export type AdminCheckResult =
  | { ok: true }
  | { ok: false; status: 403; code: "ADMIN_REQUIRED"; error: string }
  | { ok: false; status: 500; code: "ADMIN_CHECK_FAILED"; error: string };

export async function checkIsAdmin(client: HasRoleRpcClient, userId: string): Promise<AdminCheckResult> {
  try {
    const { data, error } = await client.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (error) {
      // Chỉ log mã lỗi — không log JWT, secret hay user data.
      console.error("[angel-channel-manage] has_role rpc failed", { code: error.code ?? "unknown" });
      return { ok: false, status: 500, code: "ADMIN_CHECK_FAILED", error: "Không thể kiểm tra quyền admin" };
    }
    if (data !== true) {
      return { ok: false, status: 403, code: "ADMIN_REQUIRED", error: "Admin only" };
    }
    return { ok: true };
  } catch {
    console.error("[angel-channel-manage] has_role rpc threw");
    return { ok: false, status: 500, code: "ADMIN_CHECK_FAILED", error: "Không thể kiểm tra quyền admin" };
  }
}
