type DeleteResponse = { ok: boolean; status?: number; data?: { ok?: unknown; error_code?: number; description?: string; error?: string } | null };
type NoticeEvent = { action: string; reason: string };

/** Only allowlisted categories leave this boundary; never log raw API descriptions. */
export async function attemptModerationDelete(request: () => Promise<DeleteResponse>): Promise<{
  deleted: boolean; errorCode?: number; failure?: string;
}> {
  try {
    const result = await request();
    if (result.ok === true) return { deleted: true };
    const description = typeof result.data?.description === "string" ? result.data.description.toLowerCase() : "";
    const failure = result.status === 500 && result.data?.error === "COMMUNITY_GUARD_BOT_TOKEN is not configured" ? "configuration_unavailable"
      : result.status === 0 ? "transport_error"
      : result.data?.ok !== false ? "invalid_response"
      : /not enough rights to delete|need administrator rights|not an administrator/.test(description) ? "permission_denied"
      : description.includes("message can't be deleted") ? "message_not_deletable"
      : description.includes("message to delete not found") ? "message_not_found"
      : "telegram_error";
    return { deleted: false, errorCode: result.data?.error_code, failure };
  } catch {
    return { deleted: false, failure: "transport_error" };
  }
}

/** Claim BEFORE sending. An ambiguous send/crash keeps the claim: at most one attempt.
 * Audit of the original moderation outcome must precede this helper.
 */
export async function sendModerationFailureNotice(params: {
  groupId: number; messageId: number;
  claim: () => Promise<string | null>;
  send: () => Promise<{ ok: boolean }>;
  audit: (event: NoticeEvent) => Promise<unknown>;
}): Promise<void> {
  let decision: string | null = null;
  try { decision = await params.claim(); } catch { /* Unknown claim must not send. */ }
  if (decision !== "claimed") {
    await params.audit({
      action: decision === "duplicate" || decision === "cooldown" ? "moderation_notice_suppressed" : "moderation_notice_unavailable",
      reason: decision === "duplicate" || decision === "cooldown" ? decision : "durable_claim_unverified",
    });
    return;
  }
  let sent = false;
  try { sent = (await params.send()).ok === true; } catch { /* Delivery may be ambiguous; do not release claim. */ }
  await params.audit({ action: sent ? "moderation_notice_sent" : "moderation_notice_send_failed", reason: sent ? "telegram_confirmed" : "delivery_unconfirmed_claim_retained" });
}

export const MODERATION_FAILURE_NOTICE = "⚠️ Một số tin nhắn chưa được moderation tự động xóa. Quản trị viên vui lòng kiểm tra nhật ký Telegram Operations để xem từng lỗi xóa và kết quả hạn chế tài khoản. Cảnh báo được giới hạn một lần mỗi 5 phút trong nhóm.";

export function resolveDeletePermission(ok: boolean, member?: { status?: string; can_delete_messages?: boolean }): boolean | null {
  if (!ok || !member) return null;
  if (member.status === "creator") return true;
  if (member.status === "administrator") return typeof member.can_delete_messages === "boolean" ? member.can_delete_messages : null;
  if (["member", "restricted", "left", "kicked"].includes(member.status ?? "")) return false;
  return null;
}
