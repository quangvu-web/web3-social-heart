export type WebhookInfo = {
  verified: boolean; response_valid: boolean; endpoint_matches?: boolean;
  pending_update_count?: number; last_error_date?: number | null;
  has_last_error?: boolean; allowed_updates?: string[];
};
const messages: Record<string, string> = {
  bot_token_missing: "Backend chưa cấu hình token bot.",
  webhook_secret_missing: "Backend chưa cấu hình secret webhook.",
  backend_endpoint_invalid: "Endpoint backend chưa được cấu hình hợp lệ.",
  telegram_transport_failed: "Kết nối Telegram lỗi hoặc quá thời gian chờ.",
  telegram_api_rejected: "Telegram trả lỗi HTTP hoặc từ chối yêu cầu.",
  telegram_response_invalid: "Phản hồi Telegram thiếu hoặc sai cấu trúc.",
  endpoint_mismatch: "Webhook chưa trỏ đúng endpoint. Hãy kiểm tra và chủ động đăng ký webhook.",
  required_updates_missing: "Webhook thiếu update bắt buộc. Hãy bấm Đăng ký webhook.",
  admin_request_failed: "Không đọc được phản hồi backend. Kiểm tra phiên đăng nhập và thử lại.",
  backend_response_invalid: "Backend chưa trả đủ thông tin chẩn đoán. Cần kiểm tra phiên bản function.",
};
const stages: Record<string, string> = {
  preflight: "Kiểm tra cấu hình", set_webhook: "Đăng ký webhook",
  get_webhook_info: "Đọc trạng thái Telegram", verify_webhook: "Đối chiếu cấu hình", admin_request: "Gọi backend",
};
const updates = ["message", "edited_message", "channel_post", "edited_channel_post", "callback_query", "chat_member", "my_chat_member", "other_update"];
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
export function webhookDiagnosticView(input: unknown, registering = false) {
  const data = record(input);
  const raw = record(data.webhook);
  const hasInfo = raw.response_valid === true && typeof raw.endpoint_matches === "boolean" &&
    typeof raw.pending_update_count === "number" && Number.isSafeInteger(raw.pending_update_count) && raw.pending_update_count >= 0 &&
    (raw.allowed_updates === undefined || (Array.isArray(raw.allowed_updates) && raw.allowed_updates.every(v => typeof v === "string")));
  const allowed = Array.isArray(raw.allowed_updates) ? raw.allowed_updates.filter((v): v is string => typeof v === "string" && updates.includes(v)) : undefined;
  const ready = hasInfo && raw.verified === true && raw.endpoint_matches === true &&
    ["message", "chat_member", "callback_query"].every(v => allowed?.includes(v));
  const webhook: WebhookInfo | null = hasInfo ? {
    verified: ready, response_valid: true, endpoint_matches: raw.endpoint_matches === true,
    pending_update_count: raw.pending_update_count as number,
    last_error_date: typeof raw.last_error_date === "number" && Number.isFinite(raw.last_error_date) ? raw.last_error_date : null,
    has_last_error: raw.has_last_error === true, allowed_updates: allowed,
  } : null;
  const candidate = typeof data.cause_code === "string" ? data.cause_code : data.code;
  const code = typeof candidate === "string" && Object.prototype.hasOwnProperty.call(messages, candidate) ? candidate : "backend_response_invalid";
  const stage = typeof data.stage === "string" && Object.prototype.hasOwnProperty.call(stages, data.stage) ? data.stage : "admin_request";
  const accepted = data.registration === "accepted";
  const verified = ready && (!registering || accepted);
  const state: "verified" | "unverified" | "error" = verified ? "verified" : accepted || hasInfo ? "unverified" : "error";
  const prefix = registering
    ? accepted ? "Yêu cầu đăng ký đã được gửi nhưng chưa xác minh được. " : "Đăng ký thất bại hoặc chưa xác nhận được kết quả. "
    : "Chưa xác minh được webhook. ";
  return { state, webhook,
    message: verified ? registering ? "Đã đăng ký và xác minh webhook." : "Đã xác minh endpoint và đủ update bắt buộc."
      : `${prefix}${messages[code]} Mã: ${code}. Giai đoạn: ${stages[stage]}.`,
  };
}

/** Discard raw SDK/HTTP errors, including errors carrying URLs or request bodies. */
export async function requestWebhookDiagnostic(
  invoke: () => Promise<{ data: unknown; error: unknown }>, registering = false,
) {
  try {
    const { data, error } = await invoke();
    if (!error) return webhookDiagnosticView(data, registering);
    const context = record(error).context;
    if (context instanceof Response) {
      try {
        const safe = await context.clone().json();
        if (typeof record(safe).code === "string") return webhookDiagnosticView(safe, registering);
      } catch { /* Never forward SDK or response text. */ }
    }
  } catch { /* Never forward transport exception text. */ }
  return webhookDiagnosticView({ code: "admin_request_failed", stage: "admin_request" }, registering);
}
