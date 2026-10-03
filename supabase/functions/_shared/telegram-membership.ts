export type MemberEventWriteResult =
  | { kind: "not_applicable"; eventType: null }
  | {
    kind: "inserted" | "duplicate";
    eventType: string;
    eventId?: string;
    processingStatus?: JoinEventProcessingStatus;
  }
  | { kind: "error"; eventType: string; errorCode: string };

export type JoinEventProcessingStatus = "pending" | "processing" | "failed" | "done" | "needs_review" | null;

const PRESENT_STATUSES = new Set(["member", "restricted", "administrator", "creator"]);
const ABSENT_STATUSES = new Set(["left", "kicked"]);

export function classifyMemberEventType(
  oldStatus: string | undefined,
  newStatus: string | undefined,
  actorIsSelf: boolean,
): string | null {
  const oldValue = oldStatus ?? "";
  const newValue = newStatus ?? "";
  if (!newValue) return null;
  if (PRESENT_STATUSES.has(newValue) && oldValue === "") return "join";
  if (PRESENT_STATUSES.has(newValue) && ABSENT_STATUSES.has(oldValue)) return "rejoined";
  if (PRESENT_STATUSES.has(oldValue) && newValue === "left") return "left";
  if (PRESENT_STATUSES.has(oldValue) && newValue === "kicked") return actorIsSelf ? "left" : "kicked";
  if (oldValue === "" && newValue === "kicked") return "banned";
  if (oldValue === "kicked" && newValue === "left") return "unbanned";
  return null;
}

function safeErrorCode(code: unknown): string {
  return typeof code === "string" && /^[A-Za-z0-9_]{1,32}$/.test(code) ? code : "unknown";
}

export function resolveMemberEventWrite(
  eventType: string | null,
  rows: readonly unknown[] | null,
  error: { code?: unknown } | null,
): MemberEventWriteResult {
  if (!eventType) return { kind: "not_applicable", eventType: null };
  if (error) return { kind: "error", eventType, errorCode: safeErrorCode(error.code) };
  if (rows === null) return { kind: "error", eventType, errorCode: "missing_result" };
  return rows?.length
    ? { kind: "inserted", eventType }
    : { kind: "duplicate", eventType };
}
