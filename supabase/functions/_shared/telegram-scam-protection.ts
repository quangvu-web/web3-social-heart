export type ScamRiskAssessment = {
  shouldDelete: boolean;
  riskScore: number;
  threshold: number;
  matchedRules: string[];
  urls: string[];
};

export type ScamModerationContext = {
  chatId: number;
  messageId: number;
  userId?: number | null;
  username?: string | null;
  senderChatId?: number | null;
  isAdmin?: boolean;
  messageType: string;
  scamStrictMode: boolean;
  antiSpamEnabled: boolean;
  scamProtectionEnabled: boolean;
};

export type ScamModerationEvent = Record<string, unknown> & { event: string };

export function assessTelegramScamRisk(input: {
  text: string;
  urls: string[];
  trustedDomains?: string[];
  blockedDomains?: string[];
  strictMode: boolean;
}): ScamRiskAssessment {
  const normalizedText = input.text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const trusted = (input.trustedDomains ?? []).map(normalizeDomain).filter(
    Boolean,
  );
  const blocked = (input.blockedDomains ?? ["xezopoint.com"]).map(
    normalizeDomain,
  ).filter(Boolean);
  const urls = [
    ...new Set(input.urls.map((url) => url.trim()).filter(Boolean)),
  ];
  const hosts = urls.map(getHost).filter(Boolean);
  const blockedMatch = hosts.some((host) =>
    blocked.some((domain) => hostMatches(host, domain))
  );
  const isReferral = urls.some((raw) => {
    try {
      const url = new URL(raw.startsWith("www.") ? `https://${raw}` : raw);
      if (
        trusted.some((domain) =>
          hostMatches(normalizeDomain(url.hostname), domain)
        )
      ) return false;
      return [...url.searchParams.keys()].some((key) =>
        /^(?:ref|ref_id|referral|affiliate|aff|invite|partner|promo|campaign)$/i
          .test(key)
      );
    } catch {
      return false;
    }
  });
  const externalUrl = hosts.some((host) =>
    !trusted.some((domain) => hostMatches(host, domain))
  );
  const financialSolicitation =
    /\b(?:dau tu|investment|invest|roi|loi nhuan|sinh loi|loi tuc|hoan tra|hoan von|cash ?back|cashback|rebate|commission|affiliate|chi?t khau|hoa hong|earn|payout|return)\b/i
      .test(normalizedText);
  const invitation =
    /\b(?:hay kiem tra|dang ky|tham gia|chon goi|tuy thuoc|register|sign up|join|click|invest now)\b/i
      .test(normalizedText);
  const percentages = [...normalizedText.matchAll(/\b(\d{1,3})\s*%/g)].map((
    m,
  ) => Number(m[1]));
  const hasPercent = percentages.length > 0;
  const extremeReturn = percentages.some((n) => n >= 50);

  const matchedRules: string[] = [];
  let riskScore = 0;
  const add = (rule: string, score: number) => {
    if (!matchedRules.includes(rule)) matchedRules.push(rule);
    riskScore += score;
  };

  if (blockedMatch) add("blocked_domain", 100);
  if (externalUrl) add("unknown_external_url", 2);
  if (isReferral) add("referral_parameter", 3);
  if (financialSolicitation) add("financial_solicitation", 2);
  if (invitation) add("investment_invitation", 2);
  if (hasPercent) add("percentage_claim", 1);
  if (extremeReturn) add("unrealistic_return_percentage", 3);

  // A domain alone or a benign external link alone never crosses either
  // threshold. Multiple independent financial-scam signals are required.
  const threshold = input.strictMode ? 4 : 7;
  return {
    shouldDelete: blockedMatch || riskScore >= threshold,
    riskScore,
    threshold,
    matchedRules,
    urls,
  };
}

function normalizeDomain(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/^https?:\/\//, "")
    .replace(/^www\./, "");
  return normalized.split(/[/:?#]/, 1)[0].replace(/\.$/, "");
}

function getHost(rawUrl: string): string {
  try {
    return normalizeDomain(
      new URL(rawUrl.startsWith("www.") ? `https://${rawUrl}` : rawUrl)
        .hostname,
    );
  } catch {
    return "";
  }
}

function hostMatches(host: string, domain: string): boolean {
  return Boolean(
    host && domain && (host === domain || host.endsWith(`.${domain}`)),
  );
}

export async function enforceScamDeletion(params: {
  context: ScamModerationContext;
  assessment: ScamRiskAssessment;
  deleteMessage: () => Promise<
    { ok: boolean; errorCode?: number | string; errorDescription?: string }
  >;
  checkDeletePermission?: () => Promise<
    {
      canDeleteMessages: boolean | null;
      status?: string;
      errorDescription?: string;
    }
  >;
  log: (event: ScamModerationEvent) => void | Promise<void>;
}): Promise<"not_scam" | "deleted" | "delete_failed"> {
  if (!params.assessment.shouldDelete) return "not_scam";

  const base = {
    chat_id: params.context.chatId,
    message_id: params.context.messageId,
    user_id: params.context.userId ?? null,
    username: params.context.username ?? null,
    sender_chat_id: params.context.senderChatId ?? null,
    is_admin: params.context.isAdmin ?? false,
    message_type: params.context.messageType,
    urls: params.assessment.urls.map(redactUrl),
    risk_score: params.assessment.riskScore,
    risk_threshold: params.assessment.threshold,
    matched_rules: params.assessment.matchedRules,
    scam_strict_mode: params.context.scamStrictMode,
    anti_spam_enabled: params.context.antiSpamEnabled,
    scam_protection_enabled: params.context.scamProtectionEnabled,
  };
  await safeLog(params.log, {
    ...base,
    event: "scam_detected",
    action: "delete",
  });
  await safeLog(params.log, {
    ...base,
    event: "delete_attempt",
    action: "delete",
  });

  let result: {
    ok: boolean;
    errorCode?: number | string;
    errorDescription?: string;
  };
  try {
    result = await params.deleteMessage();
  } catch (error) {
    result = {
      ok: false,
      errorDescription: `Request failed (${
        error instanceof Error ? error.name : "unknown error"
      })`,
    };
  }
  if (result.ok) {
    await safeLog(params.log, {
      ...base,
      event: "delete_success",
      action: "deleted",
    });
    return "deleted";
  }

  let permission: {
    canDeleteMessages: boolean | null;
    status?: string;
    errorDescription?: string;
  } | undefined;
  try {
    permission = await params.checkDeletePermission?.();
  } catch (error) {
    permission = {
      canDeleteMessages: null,
      status: "unknown",
      errorDescription: `Permission check failed (${
        error instanceof Error ? error.name : "unknown error"
      })`,
    };
  }
  const missingPermission = permission?.canDeleteMessages === false;
  await safeLog(params.log, {
    ...base,
    event: "delete_failed",
    action: "delete_failed",
    reason: missingPermission
      ? "missing_delete_permission"
      : "telegram_delete_error",
    telegram_error_code: result.errorCode ?? null,
    telegram_error_description: result.errorDescription ?? null,
    bot_status: permission?.status ?? null,
    can_delete_messages: permission?.canDeleteMessages ?? null,
    permission_error_description: permission?.errorDescription ?? null,
  });
  return "delete_failed";
}

async function safeLog(
  log: (event: ScamModerationEvent) => void | Promise<void>,
  event: ScamModerationEvent,
) {
  try {
    await log(event);
  } catch {
    // Logging failures must never abort message moderation or webhook handling.
  }
}

function redactUrl(raw: string): string {
  try {
    const url = new URL(raw.startsWith("www.") ? `https://${raw}` : raw);
    return `${url.protocol}//${url.hostname}${url.pathname}`.slice(0, 240);
  } catch {
    return raw.slice(0, 240);
  }
}
