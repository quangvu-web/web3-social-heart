import { COMMUNITY_WEBHOOK_ALLOWED_UPDATES, safeCommunityWebhookStatus } from "./telegram-webhook-config.ts";

type Stage = "preflight" | "set_webhook" | "get_webhook_info" | "verify_webhook";
type Code = "bot_token_missing" | "webhook_secret_missing" | "backend_endpoint_invalid" |
  "telegram_transport_failed" | "telegram_api_rejected" | "telegram_response_invalid" |
  "endpoint_mismatch" | "required_updates_missing";

/** Dedicated administrative transport: bounded request, no raw errors or URLs escape. */
export async function diagnoseCommunityWebhook(options: {
  action: "get_webhook_info" | "register_webhook";
  token?: string;
  secret?: string;
  backendUrl: string;
  fetcher?: typeof fetch;
  timeoutMs?: number;
  log?: (entry: { stage: Stage; code: Code }) => void;
}) {
  let registration: "not_requested" | "failed" | "accepted" = options.action === "register_webhook" ? "failed" : "not_requested";
  const failure = (stage: Stage, code: Code) => {
    options.log?.({ stage, code });
    return {
      success: false, registration, stage,
      code: registration === "accepted" ? "webhook_registered_unverified" : code,
      cause_code: code,
      webhook: { verified: false, response_valid: false, error_code: code },
    };
  };
  if (!options.token?.trim()) return failure("preflight", "bot_token_missing");
  if (options.action === "register_webhook" && !options.secret?.trim()) return failure("preflight", "webhook_secret_missing");
  let endpoint: string;
  try {
    const base = new URL(options.backendUrl);
    if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash) throw new Error();
    endpoint = `${base.origin}/functions/v1/telegram-community-webhook`;
  } catch { return failure("preflight", "backend_endpoint_invalid"); }

  const call = async (method: "setWebhook" | "getWebhookInfo", body: Record<string, unknown>): Promise<
    { ok: true; data: Record<string, unknown> } | { ok: false; code: Code }
  > => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 10_000);
    try {
      const response = await (options.fetcher ?? fetch)(`https://api.telegram.org/bot${options.token}/${method}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body), signal: controller.signal,
      });
      if (!response.ok) { await response.body?.cancel(); return { ok: false, code: "telegram_api_rejected" }; }
      let data: unknown;
      try { data = await response.json(); }
      catch { return { ok: false, code: controller.signal.aborted ? "telegram_transport_failed" : "telegram_response_invalid" }; }
      if (!data || typeof data !== "object" || Array.isArray(data)) return { ok: false, code: "telegram_response_invalid" };
      const value = data as Record<string, unknown>;
      if (value.ok === false) return { ok: false, code: "telegram_api_rejected" };
      if (value.ok !== true) return { ok: false, code: "telegram_response_invalid" };
      return { ok: true, data: value };
    } catch { return { ok: false, code: "telegram_transport_failed" }; }
    finally { clearTimeout(timer); }
  };
  if (options.action === "register_webhook") {
    const set = await call("setWebhook", {
      url: `${endpoint}?secret=${encodeURIComponent(options.secret!)}`,
      secret_token: options.secret, allowed_updates: [...COMMUNITY_WEBHOOK_ALLOWED_UPDATES],
      drop_pending_updates: false,
    });
    if (!set.ok) return failure("set_webhook", set.code);
    if (set.data.result !== true) return failure("set_webhook", "telegram_response_invalid");
    registration = "accepted";
  }
  const get = await call("getWebhookInfo", {});
  if (!get.ok) return failure("get_webhook_info", get.code);
  const webhook = safeCommunityWebhookStatus({ ok: true, data: get.data }, endpoint);
  if (!("response_valid" in webhook)) return failure("get_webhook_info", "telegram_response_invalid");
  const code = webhook.error_code as Code | undefined;
  if (code) options.log?.({ stage: "verify_webhook", code });
  return { success: webhook.verified, registration, stage: "verify_webhook" as Stage,
    code: code && registration === "accepted" ? "webhook_registered_unverified" : code,
    cause_code: code, webhook };
}
