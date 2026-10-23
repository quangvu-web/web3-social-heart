import { buildTelegramGroupContext, type TelegramGroupContext } from "../_shared/telegram-group-context.ts";
import { isCaptionOperator } from "./caption-operators.ts";
import { handleBotInvite } from "../_shared/telegram-unauthorized-invite.ts";
import { resolveDeletePermission } from "../_shared/telegram-moderation-notice.ts";
import {
  activeDomains,
  activeKeywords,
  answerCallbackQuery,
  applyViolation,
  deleteModerationMessage,
  notifyModerationDeleteFailure,
  askAngel,
  callCommunityTelegram,
  communityCorsHeaders,
  deleteMessage,
  editMessageText,
  checkAndUpdateAiRate,
  ensureSettings,
  escapeHtml,
  extractText,
  extractUrls,
  findBlockedKeyword,
  isFunSpiritualContent,
  isTrustedFunCommunityContent,
  looksLikeCardingStorePromo,
  detectAccountShopPromo,

  looksLikeCjkPromo,
  looksLikeCjkRomanceBait,
  looksLikeVietnameseAbuse,

  looksLikeLatinPromo,
  hasSuspiciousTld,
  isCjkPlusForeignBot,
  isCjkPlusUserMention,
  fullName,
  getBotInfo,
  getChatMember,
  getClients,
  getCommunityUserAvatarUrl,
  getSettingsForGroup,
  loadGroupSettings,
  isTelegramAdmin,
  json,
  kickChatMember,
  leaveChat,
  logMemberEvent,
  logModeration,
  menuMarkup,
  restrictChatMember,
  sendChatAction,
  sendMessage,
  sendPhoto,
  sendPhotoBase64,
  createTelegramImageStreamer,
  telegramProfileUrl,
  unrestrictChatMember,
  upsertUserState,
  updateMessageWindow,
  verifyCommunityWebhookSecret,
  welcomeMarkup,
  isTrustedSenderChat,
  upsertTrustedSenderChat,
  detectTelegramPreviewSpam,
  detectMeditationInvite,
  analyzeMeditationInvite,
  looksLikeMeditationInvite,
  detectExternalBotPromotion,
  detectTelegramScam,
  detectAutomatedCjkScam,
  loadTrustedBotUsernames,
  loadTrustedTelegramHandles,
  pickLargestPhotoFileId,
  runOcrOnPhoto,
  hasAnalyzableImage,
  transcribeTelegramAudio,
  classifyMessageType,
  FUN_PROFILE_PLATFORM_FACTS,
  buildMeditationSummaryQuestion,
  renderEventAssistantPrompt,
  detectTranslationTargetLanguage,
  resolveAngelLanguageBucket,
  resolveGroupReplyLanguage,
  looksLikeMentionBait,
  recordSpamPrelude,
  countSpamPrelude,
  looksLikeOffLanguageCjkChatter,
  hasRecentSpamPrelude,
  banChatMember,
  type AngelLanguageBucket,
  type CommunitySettings,
  type TelegramMessage,
  type TelegramUpdate,
  getCommunityUserAvatarPhoto,
} from "../_shared/telegram-community.ts";
import {
  assessTelegramScamRisk,
  enforceScamDeletion,
  type ScamModerationContext,
} from "../_shared/telegram-scam-protection.ts";
import { tryFetchTelegramMedia } from "../_shared/telegram-media.ts";
import {
  completeVerifiedCallback,
  decideVerificationCallback,
  enforceVerificationFailure,
  isRecoverableVerificationStatus,
  isStaleVerificationEnforcement,
  releaseVerifiedMember,
  resolveJoinFlow,
  shouldProcessChatMemberJoin,
  effectiveMemberStatus,
  isMemberLeaveTransition,
  shouldSendVerifiedWelcome,
  startVerificationDelivery,
  verificationClaimOutcome,
  verificationRestrictionUntil,
  verificationTimeoutSeconds,
  VERIFICATION_ENFORCEMENT_LEASE_MS,
  welcomeLogMessageId,
  type VerifiedCallbackOutcome,
} from "../_shared/telegram-verification.ts";
import { loadAngelRuleOverrides } from "../_shared/angel-facts.ts";
import { sanitizeTelegramTransportError, welcomeLogAction } from "../_shared/telegram-transport.ts";
import {
  scanJoinName,
  attemptJoinGateAction,
  joinGateFailureDisposition,
  scanAvatarImage,
  avatarVerdictBlocks,
  joinGuardNameOptions,
} from "../_shared/telegram-join-guard.ts";
import { rateLimitUnavailableDecision } from "../_shared/telegram-rate-limit.ts";
import { escalatedModerationOutcome, moderationStateDecision, violationActionOutcome } from "../_shared/telegram-moderation-outcome.ts";
import {
  joinEventCompletionStatus,
  joinEventDispatchDecision,
  telegramDeliveryFailure,
} from "../_shared/telegram-join-recovery.ts";
import { getFlag } from "../_shared/angel/flags.ts";
import { withUsage } from '../_shared/track-cloud-usage.ts';

import { callAngelCore, AngelCoreError, getAngelProvider } from "../_shared/angel-core.ts";

// LEGACY: local image intent classification / vision describe đã được loại bỏ.
// Toàn bộ tin nhắn (bao gồm ảnh gửi kèm) giờ được forward tới `/angel-router` của
// Angel gốc; router tự chọn chat / image_generate / image_analyze. Xem `angel-image.ts`
// nếu cần khôi phục fallback cục bộ trong tương lai.




function extractInlineTranslationSource(text: string): string {
  const raw = String(text ?? "").trim();
  const colonMatch = raw.match(/[:：]\s*([\s\S]{2,})$/);
  if (colonMatch?.[1]?.trim()) return colonMatch[1].trim();

  const quotedMatch = raw.match(/["“”'‘’]([^"“”'‘’]{2,})["“”'‘’]/);
  return quotedMatch?.[1]?.trim() ?? "";
}

async function getPendingDmTranslationTarget(params: {
  adminClient: any;
  chatId: number;
  telegramUserId?: number;
}): Promise<AngelLanguageBucket | null> {
  if (!params.telegramUserId) return null;
  try {
    const since = new Date(Date.now() - 15 * 60_000).toISOString();
    const { data, error } = await params.adminClient
      .from("telegram_ai_conversations")
      .select("user_message, bot_reply, created_at")
      .eq("chat_id", params.chatId)
      .eq("user_id", params.telegramUserId)
      .eq("trigger_source", "dm")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;

    const target = detectTranslationTargetLanguage(String((data as any).user_message ?? ""));
    if (!target) return null;

    const botReply = String((data as any).bot_reply ?? "").toLowerCase();
    const isWaitingForSource = /paste|send\s+(the\s+)?text|source\s+text|gửi\s+(đoạn|van|văn|nội\s*dung|noi\s*dung)|muốn\s+angel\s+dịch\s+nội\s+dung\s+nào|muon\s+angel\s+dich\s+noi\s+dung\s+nao|cần\s+dịch|can\s+dich/i.test(botReply);
    return isWaitingForSource ? target : null;
  } catch (err) {
    console.warn("[dm] pending_translation_lookup_failed", err instanceof Error ? err.message : String(err));
    return null;
  }
}



function buildMenuText(settings: CommunitySettings | null, name: string): string {
  return `🙏 <b>Hello ${escapeHtml(name)}</b>, welcome to <b>FUN.RICH</b> ✨

Angel can help you:
✨ Open your FUN.RICH Profile right inside Telegram
📜 Read the Community Rules
🎥 Watch the video guide
🛡️ Report scams / spam
💬 Contact Angel and the team

Type /menu anytime to call Angel 🌟
Or just send a free-form question — Angel will reply 💛`;
}

function isGroup(type?: string) {
  return type === "group" || type === "supergroup";
}

function shouldEscalateModeration(
  reason: string,
  rawKeyword?: string | null,
  keywordRow?: { severity?: string | null } | null,
): boolean {
  const lowerReason = reason.toLowerCase();
  const lowerKeyword = (rawKeyword ?? "").toLowerCase();
  const keywordSeverity = (keywordRow?.severity ?? "").toLowerCase();
  if (lowerReason.startsWith("telegram_preview_spam:")) return true;
  if (lowerReason.startsWith("external_bot_promotion:")) return true;
  if (lowerReason.startsWith("scam_promotion:")) {
    return keywordSeverity === "high" || keywordSeverity === "critical";
  }
  if (lowerReason === "ocr_risk_content:tg_link") return true;
  if (lowerReason.startsWith("ocr_risk_content:bot:")) return true;
  if (lowerReason.startsWith("cjk_plus_")) return true;
  if (lowerReason === "cjk_romance_bait") return true;
  if (lowerReason.includes("gambling_promo")) return true;
  if (lowerReason.startsWith("suspicious_tld:")) return true;
  if (lowerReason === "message_rate_limit") return true;
  if (lowerReason === "mention_bait") return true;
  if (lowerReason === "vietnamese_abuse") return true;

  return ["bcgzsxll", "msk69", "msk69_bot", "rickmorgan_support"].some((hard) =>
    lowerReason.includes(hard) || lowerKeyword.includes(hard)
  );
}

// ============================================================
// Quick replies â€” keyword auto-answer (CAMLY contract info, ...)
// Triggered AFTER moderation, BEFORE AI mention. No AI credit used.
// Rules are loaded from `telegram_community_quick_replies` and
// cached for 30s so Cha cÃ³ thá»ƒ chá»‰nh tá»« admin panel mÃ  khÃ´ng cáº§n redeploy.
// ============================================================
type QuickReplyRule = {
  id: string;
  label: string;
  patterns: RegExp[];
  reply_text: string;
  parse_mode: string;
  disable_web_page_preview: boolean;
};

let quickReplyCache: { at: number; rules: QuickReplyRule[] } | null = null;
const QUICK_REPLY_TTL_MS = 30_000;
const scamWarningLastSentAt = new Map<number, number>();
const SCAM_WARNING_COOLDOWN_MS = 60_000;

function compileQuickReplyRule(row: {
  id: string;
  label: string | null;
  patterns: string[] | null;
  reply_text: string;
  parse_mode: string | null;
  disable_web_page_preview: boolean | null;
}): QuickReplyRule | null {
  const compiled: RegExp[] = [];
  for (const raw of row.patterns ?? []) {
    const src = String(raw ?? "").trim();
    if (!src) continue;
    try {
      compiled.push(new RegExp(src, "i"));
    } catch (err) {
      console.warn(`[quick-reply] invalid regex on rule ${row.id}: ${src}`, err);
    }
  }
  if (!compiled.length || !row.reply_text?.trim()) return null;
  return {
    id: row.id,
    label: row.label ?? "",
    patterns: compiled,
    reply_text: row.reply_text,
    parse_mode: row.parse_mode || "HTML",
    disable_web_page_preview: row.disable_web_page_preview ?? true,
  };
}

async function loadQuickReplies(): Promise<QuickReplyRule[]> {
  const now = Date.now();
  if (quickReplyCache && now - quickReplyCache.at < QUICK_REPLY_TTL_MS) {
    return quickReplyCache.rules;
  }
  try {
    const { adminClient } = getClients();
    const { data, error } = await adminClient
      .from("telegram_community_quick_replies")
      .select("id, label, patterns, reply_text, parse_mode, disable_web_page_preview")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    if (error) {
      console.warn("[quick-reply] load failed", { error_code: error.code ?? "unknown" });
      if (quickReplyCache) return quickReplyCache.rules;
      throw new Error(`quick reply lookup failed (${error.code ?? "unknown"})`);
    }
    const rules = (data ?? [])
      .map((row) => compileQuickReplyRule(row as never))
      .filter((r): r is QuickReplyRule => !!r);
    quickReplyCache = { at: now, rules };
    return rules;
  } catch (err) {
    console.warn("[quick-reply] load exception", { error_name: err instanceof Error ? err.name : "unknown" });
    if (quickReplyCache) return quickReplyCache.rules;
    throw new Error("quick reply lookup unavailable");
  }
}

async function handleQuickReply(message: TelegramMessage): Promise<boolean> {
  const chatId = message.chat?.id;
  if (!chatId) return false;
  if (message.from?.is_bot) return false;
  const text = extractText(message).trim();
  if (!text || text.startsWith("/")) return false;
  const rules = await loadQuickReplies();
  for (const rule of rules) {
    if (rule.patterns.some((re) => re.test(text))) {
      await sendMessage(chatId, rule.reply_text, {
        reply_to_message_id: message.message_id,
        disable_web_page_preview: rule.disable_web_page_preview,
        parse_mode: rule.parse_mode,
      });
      return true;
    }
  }
  return false;
}


type VerificationChallenge = {
  id: string;
  group_id: number;
  telegram_user_id: number;
  username: string | null;
  full_name: string | null;
  question: string;
  correct_answer: number;
  options: number[];
  captcha_message_id: number | null;
  attempts: number;
  max_attempts: number;
  expires_at: string;
  status: "pending" | "verified" | "failed" | "expired" | "release_failed" | "enforcement_processing";
  updated_at: string;
};

function formatTemplate(template: string, params: Record<string, string | number>) {
  return Object.entries(params).reduce(
    (text, [key, value]) => text.replace(new RegExp(`\\{${key}\\}`, "g"), String(value)),
    template,
  );
}


function buildMathCaptcha() {
  const a = Math.floor(Math.random() * 8) + 2;
  const b = Math.floor(Math.random() * 8) + 2;
  const correct = a + b;
  const options = new Set<number>([correct]);
  while (options.size < 3) {
    const offset = Math.floor(Math.random() * 7) - 3;
    const candidate = correct + (offset === 0 ? 4 : offset);
    if (candidate > 0) options.add(candidate);
  }
  const shuffled = Array.from(options).sort(() => Math.random() - 0.5);
  return { question: `${a} + ${b} = ?`, correct, options: shuffled };
}

function captchaMarkup(challengeId: string, options: number[]) {
  return {
    inline_keyboard: [options.map((answer) => ({
      text: String(answer),
      callback_data: `verify:${challengeId}:${answer}`,
    }))],
  };
}

async function punishUnverifiedMember(
  adminClient: ReturnType<typeof getClients>["adminClient"],
  challenge: VerificationChallenge,
  settings: CommunitySettings | null,
  actionReason: "verification_failed" | "verification_expired",
  options: { expectedAttempts?: number; reclaimStaleProcessing?: boolean } = {},
): Promise<boolean> {
  const claimedAt = new Date().toISOString();
  let claim = adminClient
    .from("telegram_community_verification_challenges")
    .update({ status: "enforcement_processing", updated_at: claimedAt }, { count: "exact" })
    .eq("id", challenge.id);

  if (challenge.status === "pending") {
    claim = claim.eq("status", "pending");
    if (options.expectedAttempts !== undefined) claim = claim.eq("attempts", options.expectedAttempts);
    if (actionReason === "verification_expired") claim = claim.lte("expires_at", claimedAt);
  } else if (challenge.status === "enforcement_processing" && options.reclaimStaleProcessing) {
    if (!isStaleVerificationEnforcement({
      status: challenge.status,
      updatedAt: challenge.updated_at,
      nowMilliseconds: Date.now(),
    })) return false;
    claim = claim.eq("status", "enforcement_processing").eq("updated_at", challenge.updated_at);
  } else {
    return false;
  }

  const claimResult = await claim;
  if (claimResult.error || claimResult.count !== 1) {
    if (claimResult.error) {
      console.error("[verification] failure enforcement claim failed", {
        chat_id: challenge.group_id,
        user_id: challenge.telegram_user_id,
        challenge_id: challenge.id,
        error: claimResult.error.message,
      });
    }
    return false;
  }

  const action = settings?.verification_failure_action ?? "kick";
  const enforcementSucceeded = await enforceVerificationFailure({
    action: actionReason,
    enforce: async () => {
      const result = action === "mute"
        ? await restrictChatMember(challenge.group_id, challenge.telegram_user_id, Math.floor(Date.now() / 1000) + 24 * 60 * 60)
        : await kickChatMember(challenge.group_id, challenge.telegram_user_id);
      return { ok: result.ok, errorCode: result.data?.error_code, description: result.data?.description };
    },
    restoreMemberPermissions: async () => {
      const result = await unrestrictChatMember(challenge.group_id, challenge.telegram_user_id);
      return { ok: result.ok, errorCode: result.data?.error_code, description: result.data?.description };
    },
    log: async (logAction, reason) => {
      console.error("[verification] failure enforcement outcome", {
        chat_id: challenge.group_id,
        user_id: challenge.telegram_user_id,
        action: logAction,
        reason,
      });
      await logModeration(adminClient, {
        groupId: challenge.group_id,
        userId: challenge.telegram_user_id,
        username: challenge.username,
        action: logAction,
        reason: `${actionReason}: ${reason}`.slice(0, 240),
        messageId: challenge.captcha_message_id,
      });
    },
  });

  const terminalStatus = actionReason === "verification_expired" ? "expired" : "failed";
  const { error: statusError } = await adminClient
    .from("telegram_community_verification_challenges")
    .update({ status: terminalStatus, updated_at: new Date().toISOString() })
    .eq("id", challenge.id)
    .eq("status", "enforcement_processing")
    .eq("updated_at", claimedAt);
  if (statusError) {
    console.error("[verification] terminal challenge status update failed", {
      chat_id: challenge.group_id,
      user_id: challenge.telegram_user_id,
      challenge_id: challenge.id,
      error: statusError.message,
    });
    await logModeration(adminClient, {
      groupId: challenge.group_id,
      userId: challenge.telegram_user_id,
      username: challenge.username,
      action: "verification_status_update_failed",
      reason: statusError.message,
      messageId: challenge.captcha_message_id,
    });
  }

  if (challenge.captcha_message_id) {
    await editMessageText(
      challenge.group_id,
      challenge.captcha_message_id,
      settings?.verification_failed_message
        ? formatTemplate(settings.verification_failed_message, {
            full_name: challenge.full_name ?? "Member",
            name: challenge.full_name ?? "Member",
          })
        : `${challenge.full_name ?? "Member"} did not complete verification.`,
    );
  }
  return enforcementSucceeded;
}

async function processExpiredVerifications(adminClient: ReturnType<typeof getClients>["adminClient"]) {
  const now = new Date();
  const { data: expired, error } = await adminClient
    .from("telegram_community_verification_challenges")
    .select("*")
    .eq("status", "pending")
    .lte("expires_at", now.toISOString())
    .limit(20);

  if (error) {
    console.error("[verification] expired challenge query failed", { error: error.message });
    return;
  }

  for (const challenge of (expired ?? []) as VerificationChallenge[]) {
    const settingsLookup = await loadGroupSettings(adminClient, challenge.group_id);
    if (!settingsLookup.ok) {
      await logModeration(adminClient, {
        groupId: challenge.group_id,
        userId: challenge.telegram_user_id,
        username: challenge.username,
        action: "verification_settings_lookup_failed",
        reason: `expired_challenge_settings_lookup:${settingsLookup.errorCode}`,
        messageId: challenge.captcha_message_id,
      }).catch(() => undefined);
      continue;
    }
    await punishUnverifiedMember(adminClient, challenge, settingsLookup.settings, "verification_expired");
  }

  const staleBefore = new Date(now.getTime() - VERIFICATION_ENFORCEMENT_LEASE_MS).toISOString();
  const { data: interrupted, error: interruptedError } = await adminClient
    .from("telegram_community_verification_challenges")
    .select("*")
    .eq("status", "enforcement_processing")
    .lt("updated_at", staleBefore)
    .limit(20);
  if (interruptedError) {
    console.error("[verification] interrupted enforcement query failed", { error: interruptedError.message });
    return;
  }
  for (const challenge of (interrupted ?? []) as VerificationChallenge[]) {
    const settingsLookup = await loadGroupSettings(adminClient, challenge.group_id);
    if (!settingsLookup.ok) {
      await logModeration(adminClient, {
        groupId: challenge.group_id,
        userId: challenge.telegram_user_id,
        username: challenge.username,
        action: "verification_settings_lookup_failed",
        reason: `stale_challenge_settings_lookup:${settingsLookup.errorCode}`,
        messageId: challenge.captcha_message_id,
      }).catch(() => undefined);
      continue;
    }
    const interruptedReason = (challenge.attempts ?? 0) >= (challenge.max_attempts ?? 3)
      ? "verification_failed"
      : "verification_expired";
    await punishUnverifiedMember(adminClient, challenge, settingsLookup.settings, interruptedReason, {
      reclaimStaleProcessing: true,
    });
  }
}

async function sendFinalWelcome(
  adminClient: ReturnType<typeof getClients>["adminClient"],
  params: {
    groupId: number;
    userId: number;
    username?: string | null;
    fullName: string;
    settings: CommunitySettings;
    captchaMessageId?: number | null;
  },
): Promise<Exclude<VerifiedCallbackOutcome, "settings_unavailable_released" | "settings_unavailable_release_failed">> {
  const permissionsRestored = await releaseVerifiedMember({
    restoreMemberPermissions: async () => {
      const result = await unrestrictChatMember(params.groupId, params.userId);
      return { ok: result.ok, errorCode: result.data?.error_code, description: result.data?.description };
    },
    log: async (action, reason) => {
      console.error("[verification] verified member unrestrict outcome", {
        chat_id: params.groupId,
        user_id: params.userId,
        action,
        reason,
      });
      await logModeration(adminClient, {
        groupId: params.groupId,
        userId: params.userId,
        username: params.username ?? null,
        action,
        reason,
        messageId: params.captchaMessageId ?? null,
      });
    },
  });
  if (!permissionsRestored) return "permissions_restore_failed";
  if (params.captchaMessageId) {
    await deleteMessage(params.groupId, params.captchaMessageId).catch(() => undefined);
  }

  // Split fullName back into first/last for member object
  const nameParts = (params.fullName || "Member").trim().split(/\s+/);
  const first_name = nameParts.shift() || "Member";
  const last_name = nameParts.length ? nameParts.join(" ") : undefined;

  // Use welcome_message if present, otherwise fall back to verification_success_message
  const effectiveSettings: CommunitySettings = {
    ...params.settings,
    welcome_message: params.settings.welcome_message || params.settings.verification_success_message,
  };

  let welcomeOutcome: "welcome_sent" | "welcome_skipped" | "welcome_failed" = "welcome_skipped";
  if (shouldSendVerifiedWelcome(params.settings.welcome_enabled)) {
    try {
      const sent = await sendWelcomeToMember(adminClient, {
        groupId: params.groupId,
        member: {
          id: params.userId,
          first_name,
          last_name,
          username: params.username ?? undefined,
        } as NonNullable<TelegramMessage["from"]>,
        settings: effectiveSettings,
        reason: "captcha_correct",
      });
      welcomeOutcome = sent ? "welcome_sent" : "welcome_failed";
    } catch (error) {
      const reason = sanitizeTelegramTransportError(
        error,
        Deno.env.get("COMMUNITY_GUARD_BOT_TOKEN") ?? null,
      );
      console.error("[verification] welcome send threw after successful CAPTCHA", {
        chat_id: params.groupId,
        user_id: params.userId,
        error: reason,
      });
      await logModeration(adminClient, {
        groupId: params.groupId,
        userId: params.userId,
        username: params.username ?? null,
        action: "welcome_send_failed",
        reason: `captcha_correct:exception:${reason}`.slice(0, 240),
      });
      welcomeOutcome = "welcome_failed";
    }
  } else {
    await logModeration(adminClient, {
      groupId: params.groupId,
      userId: params.userId,
      username: params.username ?? null,
      action: "welcome_skipped_disabled",
      reason: "captcha_correct",
      messageId: params.captchaMessageId ?? null,
    });
  }

  await logModeration(adminClient, {
    groupId: params.groupId,
    userId: params.userId,
    username: params.username ?? null,
    action: "verification_verified",
    reason: "captcha_correct",
    messageId: params.captchaMessageId ?? null,
  });
  return welcomeOutcome;
}

// ─── Join Gate: chặn thành viên có tên / avatar nhạy cảm ─────────────────────
async function runJoinGate(
  adminClient: ReturnType<typeof getClients>["adminClient"],
  params: {
    groupId: number;
    member: NonNullable<TelegramMessage["from"]>;
    settings: CommunitySettings & Record<string, unknown>;
    reason: string;
    messageId?: number | null;
  },
): Promise<"not_required" | "removed" | "failed"> {
  const { groupId, member, settings } = params;
  if (!member?.id || member.is_bot) return "not_required";

  const label = fullName(member) + (member.username ? ` (@${member.username})` : "");
  const nameEnabled = (settings as any).join_guard_name_enabled !== false;
  const avatarEnabled = (settings as any).join_guard_avatar_enabled !== false;
  const action = ((settings as any).join_guard_action ?? "ban") === "kick" ? "kick" : "ban";

  const remove = async (logAction: string, reasonText: string) => {
    const attempt = await attemptJoinGateAction(action, {
      kick: async () => {
        const result = await kickChatMember(groupId, member.id!);
        return { ok: result.ok, error_code: result.data?.error_code };
      },
      ban: async () => {
        const result = await banChatMember(groupId, member.id!);
        return { ok: result.ok, error_code: result.data?.error_code };
      },
    });
    if (attempt.outcome === "failed") {
      console.error("[join-guard] Telegram removal failed", {
        chat_id: groupId,
        user_id: member.id,
        failure: attempt.failure,
        error_code: attempt.errorCode,
      });
      await logModeration(adminClient, {
        groupId,
        userId: member.id ?? null,
        username: member.username ?? null,
        action: "join_guard_remove_failed",
        reason: `${reasonText}:${attempt.failure}${attempt.errorCode ? `:${attempt.errorCode}` : ""}`,
      }).catch(() => undefined);
      return "failed" as const;
    }
    if (params.messageId) await deleteMessage(groupId, params.messageId).catch(() => undefined);
    await logModeration(adminClient, {
      groupId,
      userId: member.id ?? null,
      username: member.username ?? null,
      action: logAction,
      reason: reasonText,
      messageText: label,
      messageId: params.messageId ?? null,
    }).catch(() => undefined);

    const alertChat = (settings as any).member_alerts_chat_id;
    if ((settings as any).member_alerts_enabled && alertChat) {
      let englishGroup = false;
      try {
        const sourceGroupSettings = await getSettingsForGroup(adminClient, groupId);
        englishGroup = String(sourceGroupSettings?.reply_language ?? "auto").trim().toLowerCase() === "en";
      } catch (err) {
        console.warn("[GROUP_LANG] join alert settings lookup failed; using auto", {
          chatId: groupId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
      await sendMessage(
        alertChat,
        englishGroup
          ? [
              "🚫 <b>Blocked a member from joining the group</b>",
              `Group: <code>${groupId}</code>`,
              `Member: <b>${escapeHtml(label)}</b> — <code>${member.id}</code>`,
              `Reason: ${escapeHtml(reasonText)}`,
              `Action: ${action === "kick" ? "Removed from the group" : "Permanently banned"}`,
            ].join("\n")
          : [
              `🚫 <b>Đã chặn thành viên khi vào nhóm</b>`,
              `Nhóm: <code>${groupId}</code>`,
              `Thành viên: <b>${escapeHtml(label)}</b> — <code>${member.id}</code>`,
              `Lý do: ${escapeHtml(reasonText)}`,
              `Hành động: ${action === "kick" ? "Mời ra khỏi nhóm" : "Chặn vĩnh viễn"}`,
            ].join("\n"),
      ).catch(() => undefined);
    }
    return "removed" as const;
  };

  // 1) Quét tên
  if (nameEnabled) {
    const hit = scanJoinName(
      [member.first_name, member.last_name, member.username].filter(Boolean).join(" "),
      joinGuardNameOptions(settings as any),
    );
    if (hit) {
      console.log("[join-guard] name blocked", { groupId, user: member.id, kw: hit.keyword });
      return await remove("join_blocked_name", `Tên chứa từ khoá nhạy cảm: "${hit.keyword}" (${hit.source})`);
    }
  }

  // 2) Quét avatar
  if (avatarEnabled) {
    try {
      const photo = await getCommunityUserAvatarPhoto(member.id!);
      if (photo) {
        const scan = await scanAvatarImage({
          adminClient,
          fileUniqueId: photo.fileUniqueId,
          fileId: photo.fileId,
        });
        if (scan && avatarVerdictBlocks(scan.verdict, (settings as any).join_guard_avatar_threshold)) {
          console.log("[join-guard] avatar blocked", { groupId, user: member.id, verdict: scan.verdict });
          return await remove(
            "join_blocked_avatar",
            `Ảnh đại diện nhạy cảm (${scan.verdict}): ${scan.reason || "vision model đánh giá không phù hợp"}`,
          );
        }
      }
    } catch (e) {
      console.error("[join-guard] avatar step error", e);
    }
  }

  return "not_required";
}

type JoinDeliveryHooks = {
  begin: () => Promise<boolean>;
  report: (result: { ok: boolean; status?: number; messageId?: number }) => void;
};

async function startVerificationForMember(
  adminClient: ReturnType<typeof getClients>["adminClient"],
  params: {
    groupId: number;
    member: NonNullable<TelegramMessage["from"]>;
    settings: CommunitySettings;
    reason: string;
    delivery?: JoinDeliveryHooks;
  },
): Promise<string> {
  if (!params.member.id || params.member.is_bot) return "ignored_invalid_member";
  await upsertUserState({ adminClient, groupId: params.groupId, user: params.member });
  if (!params.settings.verification_enabled) {
    if (!params.settings.welcome_enabled) return "welcome_and_verification_disabled";
    const sent = await sendWelcomeToMember(adminClient, {
      groupId: params.groupId,
      member: params.member,
      settings: params.settings,
      reason: `${params.reason}_verification_disabled`,
      delivery: params.delivery,
    });
    return sent ? "welcome_sent" : "welcome_failed";
  }

  const existing = await adminClient
    .from("telegram_community_verification_challenges")
    .select("*")
    .eq("group_id", params.groupId)
    .eq("telegram_user_id", params.member.id)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing.error) {
    console.error("[verification] pending challenge lookup failed", {
      chat_id: params.groupId,
      user_id: params.member.id,
      error: existing.error.message,
    });
    await logModeration(adminClient, {
      groupId: params.groupId,
      userId: params.member.id,
      username: params.member.username ?? null,
      action: "verification_lookup_failed",
      reason: existing.error.message,
    });
    return "challenge_lookup_failed";
  }
  if (existing.data) return "existing_challenge_reused";

  const captcha = buildMathCaptcha();
  const memberName = fullName(params.member);
  const configuredTimeout = Number(params.settings.verification_timeout_seconds) || 180;
  const timeoutSeconds = verificationTimeoutSeconds(configuredTimeout);
  const maxAttempts = Number(params.settings.verification_max_attempts) || 3;
  const nowMilliseconds = Date.now();
  const expiresAt = new Date(nowMilliseconds + timeoutSeconds * 1000);
  const restrictionUntil = verificationRestrictionUntil(nowMilliseconds, configuredTimeout);
  const text = formatTemplate(params.settings.verification_prompt_message || "Welcome {full_name}! Please verify: {question}", {
    full_name: memberName,
    name: memberName,
    question: captcha.question,
    expires_minutes: Math.ceil(timeoutSeconds / 60),
  });
  const outcome = await startVerificationDelivery({
    restrictMember: async () => {
      const result = await restrictChatMember(params.groupId, params.member.id!, restrictionUntil);
      return {
        ok: result.ok,
        errorCode: result.data?.error_code,
        description: result.data?.description,
      };
    },
    createChallenge: async () => {
      const { data, error } = await adminClient
        .from("telegram_community_verification_challenges")
        .insert({
          group_id: params.groupId,
          telegram_user_id: params.member.id,
          username: params.member.username ?? null,
          full_name: memberName,
          question: captcha.question,
          correct_answer: captcha.correct,
          options: captcha.options,
          max_attempts: maxAttempts,
          expires_at: expiresAt.toISOString(),
        })
        .select("id")
        .single();
      if (error?.code === "23505") {
        const active = await adminClient
          .from("telegram_community_verification_challenges")
          .select("id")
          .eq("group_id", params.groupId)
          .eq("telegram_user_id", params.member.id)
          .in("status", ["pending", "enforcement_processing"])
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!active.error && active.data?.id) {
          return { challengeId: active.data.id, reused: true };
        }
      }
      return { challengeId: data?.id, error: error?.message };
    },
    sendCaptcha: async (challengeId, options) => {
      if (params.delivery && !(await params.delivery.begin())) {
        return { ok: false, description: "join event lease is no longer valid" };
      }
      const sent = await sendMessage(params.groupId, text, {
        reply_markup: captchaMarkup(challengeId, captcha.options),
        skipAutoDelete: options.skipAutoDelete,
      });
      params.delivery?.report({
        ok: sent.ok === true && typeof sent.data?.result?.message_id === "number",
        status: sent.status,
        messageId: sent.data?.result?.message_id,
      });
      return {
        ok: sent.ok,
        messageId: sent.data?.result?.message_id,
        errorCode: sent.data?.error_code,
        description: sent.data?.description ?? (!sent.ok ? JSON.stringify(sent.data ?? sent).slice(0, 240) : undefined),
      };
    },
    storeCaptchaMessageId: async (challengeId, messageId) => {
      const { error } = await adminClient
        .from("telegram_community_verification_challenges")
        .update({ captcha_message_id: messageId })
        .eq("id", challengeId);
      return error?.message ?? null;
    },
    markChallengeFailed: async (challengeId) => {
      const { error } = await adminClient
        .from("telegram_community_verification_challenges")
        .update({ status: "failed" })
        .eq("id", challengeId);
      return error?.message ?? null;
    },
    restoreMemberPermissions: async () => {
      const result = await unrestrictChatMember(params.groupId, params.member.id!);
      return {
        ok: result.ok,
        errorCode: result.data?.error_code,
        description: result.data?.description,
      };
    },
    deleteCaptcha: async (messageId) => {
      await deleteMessage(params.groupId, messageId);
    },
    log: async (action, reason, messageId) => {
      await logModeration(adminClient, {
        groupId: params.groupId,
        userId: params.member.id,
        username: params.member.username ?? null,
        action,
        reason: `${params.reason}: ${reason}`.slice(0, 240),
        messageId: messageId ?? null,
      });
    },
    scheduleExpiry: (challengeId) => {
      scheduleVerificationExpiryCheck(challengeId, timeoutSeconds * 1000 + 1000);
    },
  });
  return outcome;
}

const DM_TEXT_CAP = 8000;

function capDmText(s: string | null | undefined): string | null {
  if (!s) return null;
  return s.length > DM_TEXT_CAP ? s.slice(0, DM_TEXT_CAP) : s;
}

function extractMediaInfo(message: TelegramMessage): {
  media_kind: string | null;
  media_file_id: string | null;
  media_mime: string | null;
  media_caption: string | null;
} {
  const m = message as any;
  let media_kind: string | null = null;
  let media_file_id: string | null = null;
  let media_mime: string | null = null;
  if (Array.isArray(m.photo) && m.photo.length > 0) {
    media_kind = "photo";
    const largest = m.photo[m.photo.length - 1];
    media_file_id = largest?.file_id ?? null;
  } else if (m.document) {
    media_kind = "document";
    media_file_id = m.document.file_id ?? null;
    media_mime = m.document.mime_type ?? null;
  } else if (m.voice) {
    media_kind = "voice";
    media_file_id = m.voice.file_id ?? null;
    media_mime = m.voice.mime_type ?? null;
  } else if (m.video) {
    media_kind = "video";
    media_file_id = m.video.file_id ?? null;
    media_mime = m.video.mime_type ?? null;
  } else if (m.video_note) {
    media_kind = "video_note";
    media_file_id = m.video_note.file_id ?? null;
  } else if (m.audio) {
    media_kind = "audio";
    media_file_id = m.audio.file_id ?? null;
    media_mime = m.audio.mime_type ?? null;
  } else if (m.sticker) {
    media_kind = "sticker";
    media_file_id = m.sticker.file_id ?? null;
  }
  return {
    media_kind,
    media_file_id,
    media_mime,
    media_caption: capDmText(m.caption ?? null),
  };
}

async function trackDmEvent(params: {
  message: TelegramMessage;
  text: string;
}) {
  try {
    const { message, text } = params;
    const chatId = message.chat?.id;
    const tgUserId = message.from?.id;
    if (!chatId || !tgUserId) return;

    const { adminClient } = getClients();
    const cmdMatch = text.match(/^\/([a-zA-Z0-9_]+)/);
    const command = cmdMatch ? `/${cmdMatch[1].toLowerCase()}` : null;
    const media = extractMediaInfo(message);
    const kind = command
      ? "command"
      : text
      ? "text"
      : media.media_kind
      ? "media"
      : "other";
    const fullText = capDmText(text);

    // Lookup linked FUN.RICH profile (best-effort)
    let linkedUserId: string | null = null;
    try {
      const { data: prof } = await adminClient
        .from("profiles")
        .select("id")
        .eq("telegram_chat_id", String(chatId))
        .maybeSingle();
      linkedUserId = prof?.id ?? null;
    } catch (_) { /* ignore */ }

    const nowIso = new Date().toISOString();

    // Upsert user (increment via RPC-less pattern: fetch then update)
    const { data: existing } = await adminClient
      .from("telegram_bot_dm_users")
      .select("message_count")
      .eq("telegram_user_id", tgUserId)
      .maybeSingle();

    const nextCount = (existing?.message_count ?? 0) + 1;

    await adminClient.from("telegram_bot_dm_users").upsert({
      telegram_user_id: tgUserId,
      chat_id: chatId,
      username: message.from?.username ?? null,
      first_name: message.from?.first_name ?? null,
      last_name: (message.from as any)?.last_name ?? null,
      language_code: (message.from as any)?.language_code ?? null,
      last_seen_at: nowIso,
      message_count: nextCount,
      last_command: command,
      last_message_text: fullText,
      linked_user_id: linkedUserId,
      updated_at: nowIso,
    }, { onConflict: "telegram_user_id" });

    await adminClient.from("telegram_bot_dm_events").insert({
      telegram_user_id: tgUserId,
      chat_id: chatId,
      message_id: message.message_id ?? null,
      kind,
      command,
      text_preview: fullText,
      direction: "in",
      media_kind: media.media_kind,
      media_file_id: media.media_file_id,
      media_mime: media.media_mime,
      media_caption: media.media_caption,
    });
  } catch (err) {
    console.warn("[trackDmEvent] failed", err);
  }
}

async function trackBotDmReply(params: {
  chatId: number;
  tgUserId: number;
  text: string;
  replyToMessageId?: number | null;
}) {
  try {
    const { adminClient } = getClients();
    await adminClient.from("telegram_bot_dm_events").insert({
      telegram_user_id: params.tgUserId,
      chat_id: params.chatId,
      message_id: null,
      kind: "bot_reply",
      command: null,
      text_preview: capDmText(params.text),
      direction: "out",
      bot_reply_to_message_id: params.replyToMessageId ?? null,
    });
  } catch (err) {
    console.warn("[trackBotDmReply] failed", err);
  }
}


async function withTyping<T>(chatId: number | string, task: () => Promise<T>, tickerText = "💛 Angel đang nghĩ…"): Promise<T> {
  // TẦNG A: fire-and-forget lần typing đầu (không await), song song với task chính.
  sendChatAction(chatId, "typing").catch((err) => console.warn("[typing] initial sendChatAction failed", err));
  const interval = setInterval(() => {
    sendChatAction(chatId, "typing").catch((err) => console.warn("[typing] interval sendChatAction failed", err));
  }, 4000);

  // TẦNG C: text ticker "💛 Angel đang nghĩ…" sau 3s im lặng → cải thiện perceived
  // latency khi Angel gốc trả lời chậm. Auto-delete khi reply thật đến.
  // Khi breaker Angel Core đang OPEN, callFunCore short-circuit gần như tức thì
  // (~5ms) → task xong trước 3s → ticker không bao giờ post → tránh spam.
  let tickerMessageId: number | null = null;
  let tickerCancelled = false;
  const tickerTimeout = setTimeout(async () => {
    if (tickerCancelled) return;
    try {
      const res = await sendMessage(chatId, tickerText, { skipAutoDelete: true });
      const mid = res?.data?.result?.message_id;
      if (!tickerCancelled && typeof mid === "number") {
        tickerMessageId = mid;
      } else if (typeof mid === "number") {
        // Task đã xong trong lúc gửi ticker → dọn ngay.
        const numericChatId = typeof chatId === "number" ? chatId : Number(chatId);
        if (Number.isFinite(numericChatId)) {
          deleteMessage(numericChatId, mid).catch(() => {});
        }
      }
    } catch (err) {
      console.warn("[ticker] send failed", err);
    }
  }, 3000);

  try {
    return await task();
  } finally {
    tickerCancelled = true;
    clearTimeout(tickerTimeout);
    clearInterval(interval);
    if (tickerMessageId != null) {
      const numericChatId = typeof chatId === "number" ? chatId : Number(chatId);
      if (Number.isFinite(numericChatId)) {
        deleteMessage(numericChatId, tickerMessageId).catch((err) =>
          console.warn("[ticker] delete failed", err),
        );
      }
    }
  }
}


export async function handlePrivateMessage(message: TelegramMessage) {
  const chatId = message.chat?.id;
  if (!chatId) return;
  let text = extractText(message);
  const { adminClient } = getClients();
  const tgUserId = message.from?.id;
  const incomingMsgId = message.message_id ?? null;

  // Helper: send reply + log bot direction='out'
  const replyDm = async (
    body: string,
    opts?: Parameters<typeof sendMessage>[2],
  ) => {
    const res = await sendMessage(chatId, body, opts);
    if (!res?.ok) {
      console.warn("[dm] sendMessage failed", {
        chatId,
        userId: tgUserId ?? null,
        messageId: incomingMsgId,
        status: res?.status,
        data: res?.data,
      });
    }
    if (tgUserId) {
      await trackBotDmReply({
        chatId,
        tgUserId,
        text: body,
        replyToMessageId: incomingMsgId,
      });
    }
    return res;
  };

  if (/^\/caption/i.test(text)) {
    // ANGEL CAPTION BOT — /caption <link họp>: tạo phiên phụ đề dịch trực tiếp.
    console.log("[dm] caption_command", { command: /^\/caption_stop(@|\s|$)/i.test(text) ? "caption_stop" : "caption", revision: "caption-operators-v1" });
    if (/^\/caption(@|\s|$)/i.test(text) && !await isCaptionOperator(adminClient, tgUserId)) {
      console.warn("[dm] caption_start_denied", { telegram_user_id: tgUserId ?? null });
      await replyDm("🌐 Tính năng bật phụ đề hiện chỉ dành cho người phụ trách được cấp quyền. Bé nhắn người tổ chức buổi họp để được hỗ trợ nhé 💛");
      return;
    }
    const captionMatch = text.match(/^\/caption(?:@\S+)?\s+(\S+)/i);
    if (captionMatch) {
      const meetingUrl = captionMatch[1].trim();
      const internalToken = Deno.env.get("CAPTION_INTERNAL_TOKEN") ?? "";
      const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
      if (!internalToken || !supabaseUrl) {
        await replyDm("Angel chưa sẵn sàng tạo phụ đề lúc này. Bé thử lại sau ít phút nhé 💛");
        return;
      }
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/angel-caption?action=start`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-caption-token": internalToken },
          body: JSON.stringify({
            meeting_url: meetingUrl,
            telegram_user_id: tgUserId ?? null,
            telegram_chat_id: chatId,
          }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.caption_url) {
          const reason = res.status === 400
            ? "Link phòng họp chưa đúng. Angel hỗ trợ link Zoom, Google Meet và Microsoft Teams."
            : "Angel chưa gọi được bot vào phòng họp. Bé thử lại sau ít phút nhé.";
          await replyDm(`😔 ${reason}`);
          return;
        }
        if (data.already_running) {
          // Phòng này đã có bot đang chạy → trả lại link cũ, không tạo thêm.
          const startedAt = data.started_at ? new Date(data.started_at) : null;
          const hhmm = startedAt && !Number.isNaN(startedAt.getTime())
            ? startedAt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kuala_Lumpur" })
            : null;
          await replyDm(
            `💛 Buổi họp này đã có <b>Angel Translator</b> đang chạy rồi${hhmm ? ` (từ ${hhmm})` : ""}.\n` +
              `🔗 Link phụ đề đang dùng: ${data.caption_url}\n— không cần tạo thêm nhé.`,
            { skipAutoDelete: true },
          );
          return;
        }
        await replyDm(
          `🌐 <b>Angel Translator đang vào phòng họp!</b>\n\n` +
            `🔗 Link phụ đề trực tiếp: ${data.caption_url}\n\n` +
            `1️⃣ Khi bot <b>Angel Translator 🌐</b> gõ cửa phòng, bé duyệt cho bot vào nhé.\n` +
            `2️⃣ Link phụ đề sẽ được bot tự gửi vào chat phòng họp — nếu không thấy, bé dán tay link trên.\n` +
            `3️⃣ Họp xong nhắn /caption_stop, hoặc cứ kết thúc họp — bot tự rời và đăng tóm tắt vào nhóm 💛`,
          { skipAutoDelete: true },
        );
      } catch (err) {
        console.warn("[dm] caption start failed", { code: "caption_start_failed" });
        await replyDm("😔 Angel gặp lỗi khi tạo phiên phụ đề. Bé thử lại sau ít phút nhé 💛");
      }
      return;
    }
    if (/^\/caption(@|\s|$)/i.test(text)) {
      await replyDm(
        "🌐 Bé gửi kèm link phòng họp nhé: <code>/caption https://zoom.us/j/...</code>\nAngel hỗ trợ Zoom, Google Meet và Microsoft Teams 💛",
      );
      return;
    }
  
    // Creator-scoped stop first; operators without an own session may stop the newest active session.
    if (/^\/caption_stop(@|\s|$)/i.test(text)) {
      const internalToken = Deno.env.get("CAPTION_INTERNAL_TOKEN") ?? "";
      const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
      if (!internalToken || !supabaseUrl || !tgUserId) {
        await replyDm("Angel chưa sẵn sàng xử lý lúc này. Bé thử lại sau ít phút nhé 💛");
        return;
      }
      try {
        const { data: ownSession, error: ownSessionError } = await adminClient
          .from("caption_sessions")
          .select("id, public_code")
          .eq("created_by_telegram_id", tgUserId)
          .in("status", ["joining", "live"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (ownSessionError) throw ownSessionError;
        let activeSession = ownSession;
        if (!activeSession && await isCaptionOperator(adminClient, tgUserId)) {
          const { data: latestSession, error: latestSessionError } = await adminClient
            .from("caption_sessions")
            .select("id, public_code")
            .in("status", ["joining", "live"])
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (latestSessionError) throw latestSessionError;
          activeSession = latestSession;
        }
        if (!activeSession) {
          await replyDm("Angel không thấy phiên phụ đề nào đang chạy do bé tạo 💛");
          return;
        }
        const res = await fetch(`${supabaseUrl}/functions/v1/angel-caption?action=stop`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-caption-token": internalToken },
          body: JSON.stringify({ session_id: activeSession.id }),
        });
        if (!res.ok) {
          await replyDm("😔 Angel chưa dừng được phiên phụ đề. Bé thử lại sau ít phút nhé.");
          return;
        }
        await replyDm(
          "✅ Angel đã cho bot rời phòng họp. Tóm tắt song ngữ sẽ được gửi tới bé; kết quả đăng nhóm sẽ được báo trong bản tóm tắt nhé 💛",
          { skipAutoDelete: true },
        );
      } catch (err) {
        console.warn("[dm] caption stop failed", { code: "caption_stop_failed" });
        await replyDm("😔 Angel gặp lỗi khi dừng phiên phụ đề. Bé thử lại sau ít phút nhé 💛");
      }
      return;
    }

    await replyDm("🌐 Bé gửi kèm link phòng họp nhé: <code>/caption https://zoom.us/j/...</code>\nAngel hỗ trợ Zoom, Google Meet và Microsoft Teams 💛");
    return;
  }


  // Voice / audio / video_note DM: chuyển sang text bằng transcription rồi mới xử lý.
  const m = message as any;
  const voicePart = m.voice ?? m.audio ?? m.video_note ?? null;
  const isAudioOnlyMessage = Boolean(voicePart) && text.trim().length === 0;
  if (isAudioOnlyMessage) {
    await sendChatAction(chatId, "typing").catch(() => {});
    const transcript = await transcribeTelegramAudio({
      fileId: voicePart.file_id,
      fileUniqueId: voicePart.file_unique_id ?? null,
      mime: voicePart.mime_type ?? null,
    }).catch((err) => {
      console.warn("[dm] transcribe_failed", {
        chatId,
        userId: message.from?.id ?? null,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    });
    if (transcript && transcript.trim().length > 0) {
      text = transcript.trim();
      console.log("[dm] transcribed voice", { chatId, userId: message.from?.id ?? null, len: text.length });
    } else {
      console.warn("[dm] transcription empty", { chatId, userId: message.from?.id ?? null });
    }
  }

  let settings: CommunitySettings | null = null;
  try {
    settings = await ensureSettings(adminClient);
  } catch (err) {
    console.warn("[dm] ensure_settings_failed_open", {
      chatId,
      userId: message.from?.id ?? null,
      error: err instanceof Error ? err.message : String(err),
    });
  }
  const miniAppUrl = settings?.mini_app_url ?? null;
  const userName = message.from?.first_name || "Con";
  const directTranslationTarget = detectTranslationTargetLanguage(text);
  const replyToBotText = message.reply_to_message?.from?.is_bot
    ? extractText(message.reply_to_message).trim()
    : "";

  // Track DM (best-effort, non-blocking semantics handled inside try/catch)
  await trackDmEvent({ message, text });
  console.log("[dm] incoming", {
    chatId,
    userId: tgUserId ?? null,
    messageId: incomingMsgId,
    textLen: text.length,
    hasSettings: Boolean(settings),
  });

  if (/^\/(start|menu|help)(@|\s|$)?/i.test(text)) {
    await replyDm(buildMenuText(settings, userName), { reply_markup: menuMarkup(miniAppUrl) });
    return;
  }

  if (/^\/profile(@|\s|$)?/i.test(text)) {
    await replyDm(
      "✨ Tap the button below to open your FUN.RICH Profile right inside Telegram 🌟",
      {
        reply_markup: {
          inline_keyboard: [[{
            text: "🌟 Open FUN.RICH Profile",
            web_app: { url: `${miniAppUrl ?? "https://angelquangvu-funprofile.lovable.app"}/auth` },
          }]],
        },
      },
    );
    return;
  }

  if (/^\/rules(@|\s|$)?/i.test(text)) {
    await replyDm(settings?.rules_message ?? "📜 Community rules are not configured yet. Please check back soon.");
    return;
  }

  if (/^\/report(@|\s|$)?/i.test(text)) {
    await replyDm(
      "🛡️ To report spam/scam: reply to the suspicious message and tag an admin, or send a screenshot to our team. Never share your <b>seed phrase</b> or <b>private key</b> with anyone 🙏",
    );
    return;
  }

  // ANGEL MEMORY — /forgetme: bé tự xoá toàn bộ ghi nhớ của mình
  if (/^\/forgetme(@[a-z0-9_]+)?(\s|$)/i.test(text)) {
    try {
      const { forgetAngelMemory } = await import("../_shared/angel-memory.ts");
      const ok = tgUserId != null
        ? await forgetAngelMemory(adminClient, { channel: "telegram", userKey: String(tgUserId) })
        : false;
      await replyDm(
        ok
          ? "✨ Angel đã xoá toàn bộ ghi nhớ về bé rồi 💛 Từ giây phút này, mọi cuộc trò chuyện đều bắt đầu lại thật tinh khôi 🌟"
          : "🙏 Angel chưa có ghi nhớ nào về bé cả, hoặc gặp trục trặc khi xoá. Bé thử lại sau nhé 💛",
      );
    } catch (e) {
      console.warn("[/forgetme] failed", e);
      await replyDm("🙏 Có chút trục trặc khi xoá ghi nhớ, bé thử lại sau giúp Angel nhé 💛");
    }
    return;
  }

  // ANGEL MEMORY — /memory: xem danh sách ghi nhớ hiện tại
  if (/^\/memory(@[a-z0-9_]+)?(\s|$)/i.test(text)) {
    try {
      const { getAngelMemory, formatMemoryForUser } = await import("../_shared/angel-memory.ts");
      const row = tgUserId != null
        ? await getAngelMemory(adminClient, { channel: "telegram", userKey: String(tgUserId) })
        : null;
      await replyDm(formatMemoryForUser(row));
    } catch (e) {
      console.warn("[/memory] failed", e);
      await replyDm("🙏 Có chút trục trặc khi lấy ghi nhớ, bé thử lại sau nhé 💛");
    }
    return;
  }

  // ANGEL MEMORY — /remember <fact>: chủ động lưu 1 điều
  if (/^\/remember(@[a-z0-9_]+)?(\s|$)/i.test(text)) {
    const fact = text.replace(/^\/remember(@[a-z0-9_]+)?\s*/i, "").trim();
    if (!fact) {
      await replyDm("✨ Bé gõ: <code>/remember &lt;điều muốn Angel nhớ&gt;</code>\nVí dụ: <code>/remember bé thích uống trà sen buổi sáng</code>");
      return;
    }
    try {
      const { saveDeclaredFact } = await import("../_shared/angel-memory.ts");
      const res = tgUserId != null
        ? await saveDeclaredFact(adminClient, {
            channel: "telegram",
            userKey: String(tgUserId),
            displayName: (message?.from?.first_name ?? null) as string | null,
            fact,
          })
        : { ok: false, reason: "no_user" };
      if (res.ok) {
        await replyDm(`💛 Angel đã ghi nhớ rồi nè: <i>${fact.replace(/</g, "&lt;")}</i> ✨`);
      } else if (res.reason === "duplicate") {
        await replyDm("✨ Angel đã có ghi nhớ này rồi bé ơi 💛");
      } else if (res.reason === "too_short") {
        await replyDm("🙏 Điều bé muốn Angel nhớ hơi ngắn, bé viết rõ hơn giúp Angel nhé 💛");
      } else if (res.reason === "too_long") {
        await replyDm("🙏 Điều bé muốn Angel nhớ hơi dài (tối đa 200 ký tự), bé rút gọn giúp Angel nhé 💛");
      } else if (res.reason === "forbidden") {
        await replyDm("⚠️ Angel không lưu seed phrase / private key / mật khẩu bé nhé. Đó là bí mật riêng của bé 💛");
      } else {
        await replyDm("🙏 Có chút trục trặc khi lưu, bé thử lại sau nhé 💛");
      }
    } catch (e) {
      console.warn("[/remember] failed", e);
      await replyDm("🙏 Có chút trục trặc khi lưu, bé thử lại sau nhé 💛");
    }
    return;
  }

  // ANGEL MEMORY — /forget <index>: xoá 1 ghi nhớ theo số thứ tự
  if (/^\/forget(@[a-z0-9_]+)?(\s|$)/i.test(text)) {
    const arg = text.replace(/^\/forget(@[a-z0-9_]+)?\s*/i, "").trim();
    const idx = Number.parseInt(arg, 10);
    if (!Number.isFinite(idx) || idx < 1) {
      await replyDm("✨ Bé gõ: <code>/forget &lt;số&gt;</code> (xem số qua <code>/memory</code>)\nHoặc <code>/forgetall</code> để xoá tất cả 💛");
      return;
    }
    try {
      const { forgetFactByIndex } = await import("../_shared/angel-memory.ts");
      const res = tgUserId != null
        ? await forgetFactByIndex(adminClient, { channel: "telegram", userKey: String(tgUserId), index: idx })
        : { ok: false };
      if (res.ok && res.removed) {
        await replyDm(`✨ Angel đã quên: <i>${res.removed.fact.replace(/</g, "&lt;")}</i> 💛`);
      } else {
        await replyDm("🙏 Angel không tìm thấy ghi nhớ số đó. Bé xem lại danh sách qua <code>/memory</code> nhé 💛");
      }
    } catch (e) {
      console.warn("[/forget] failed", e);
      await replyDm("🙏 Có chút trục trặc khi xoá, bé thử lại sau nhé 💛");
    }
    return;
  }

  // ANGEL MEMORY — /forgetall: alias của /forgetme
  if (/^\/forgetall(@[a-z0-9_]+)?(\s|$)/i.test(text)) {
    try {
      const { forgetAngelMemory } = await import("../_shared/angel-memory.ts");
      const ok = tgUserId != null
        ? await forgetAngelMemory(adminClient, { channel: "telegram", userKey: String(tgUserId) })
        : false;
      await replyDm(
        ok
          ? "✨ Angel đã xoá toàn bộ ghi nhớ về bé rồi 💛 Từ giây phút này, mọi cuộc trò chuyện đều bắt đầu lại thật tinh khôi 🌟"
          : "🙏 Angel chưa có ghi nhớ nào về bé cả, hoặc gặp trục trặc khi xoá. Bé thử lại sau nhé 💛",
      );
    } catch (e) {
      console.warn("[/forgetall] failed", e);
      await replyDm("🙏 Có chút trục trặc khi xoá ghi nhớ, bé thử lại sau nhé 💛");
    }
    return;
  }



  if (/^\/feedback(@[a-z0-9_]+)?(\s|$)/i.test(text)) {
    const body = text.replace(/^\/feedback(@[a-z0-9_]+)?\s*/i, "").trim();
    if (body.length < 3) {
      await replyDm(
        "💌 <b>Gửi góp ý cho Angel</b>\n\nBé gõ: <code>/feedback &lt;nội dung góp ý&gt;</code>\nVí dụ: <code>/feedback Angel ơi, bé mong có thêm chức năng thiền buổi sáng</code>",
      );
      return;
    }
    if (body.length > 4000) {
      await replyDm("🙏 Nội dung góp ý hơi dài, bé rút gọn dưới 4000 ký tự giúp Angel nhé 💛");
      return;
    }
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count } = await adminClient
        .from("telegram_feedback")
        .select("id", { count: "exact", head: true })
        .eq("telegram_user_id", tgUserId ?? 0)
        .gte("created_at", oneHourAgo);
      if ((count ?? 0) >= 3) {
        await replyDm("🙏 Angel đã nhận rất nhiều góp ý từ bé rồi, xin bé đợi ~1 giờ để Angel đọc và phản hồi nhé 💛");
        return;
      }
      const displayName = [message.from?.first_name, message.from?.last_name].filter(Boolean).join(" ") || null;
      await adminClient.from("telegram_feedback").insert({
        source: "dm",
        chat_id: chatId,
        chat_title: null,
        telegram_user_id: tgUserId ?? null,
        username: message.from?.username ?? null,
        display_name: displayName,
        message_id: incomingMsgId,
        content: body,
      });
      await replyDm("🙏 Angel đã ghi nhận góp ý của bé. Ánh sáng minh triết của bé giúp FUN.RICH ngày càng tỏa sáng hơn 💛✨");
    } catch (err) {
      console.warn("[dm] feedback_insert_failed", { chatId, userId: tgUserId, error: err instanceof Error ? err.message : String(err) });
      await replyDm("🙏 Angel gặp trục trặc khi lưu góp ý. Bé thử lại sau ít phút giúp Angel nhé 💛");
    }
    return;
  }


  if (/^\/admin(@|\s|$)?/i.test(text)) {
    await replyDm("🛡️ Admin tools live in FUN.RICH Admin → ✈️ TG Group.");
    return;
  }

  // Private DM: neu user gui noi dung binh thuong thi luon goi Angel.
  // Khong phu thuoc toggle AI group, vi DM la kenh ho tro rieng cua bot.
  if (message.from?.id && (text.length > 0 || hasAnalyzableImage(message))) {
    await sendChatAction(chatId, "typing").catch((err) => console.warn("[dm] typing before rate failed", err));
    const rate = await checkAndUpdateAiRate(adminClient, {
      chatId,
      telegramUserId: message.from.id,
      limitPerMinute: settings?.ai_max_messages_per_minute ?? 10,
    }).catch((err) => {
      console.warn("[dm] ai_rate_check_unavailable", {
        chatId,
        userId: message.from?.id,
        error_name: err instanceof Error ? err.name : "unknown",
      });
      return rateLimitUnavailableDecision();
    });
    console.log("[dm] ai_rate", { chatId, userId: message.from.id, allowed: rate.allowed, count: rate.count });
    if (!rate.allowed) {
      await replyDm(rate.count === 0
        ? "🙏 Angel chưa kiểm tra được giới hạn tin nhắn lúc này. Bé thử lại sau ít phút nhé 💛"
        : "🙏 Bé nhắn hơi nhanh, Angel cần nghỉ một chút. Bé thử lại sau khoảng một phút nhé 💛");
      return;
    }
    try {
      const startedAt = Date.now();
      const dmPrompt = ((settings as any)?.ai_dm_prompt as string | null | undefined)?.trim();
      const effectiveSystemPrompt = dmPrompt && dmPrompt.length > 0
        ? dmPrompt
        : settings?.ai_system_prompt ?? "";
      const pendingTranslationTarget = directTranslationTarget
        ? null
        : await getPendingDmTranslationTarget({ adminClient, chatId, telegramUserId: message.from.id });
      const translationTarget = directTranslationTarget ?? pendingTranslationTarget;
      const translationSource = pendingTranslationTarget
        ? text
        : (extractInlineTranslationSource(text) || replyToBotText);
      const translationQuestion = translationTarget && translationSource
        ? [
          `TRANSLATION TASK — translate the SOURCE TEXT below into ${translationTarget === "en" ? "English" : "the target language"}.`,
          "Output ONLY the translation in the target language. Do not explain, do not answer the content, and do not continue the conversation in the source language.",
          `SOURCE TEXT:\n"""${translationSource}"""`,
        ].join("\n\n")
        : text;
      // ===== UNIFIED /angel-router FLOW =====
      // Không còn phân loại ý định ở FUNPROFILE — router bên Angel gốc tự quyết định
      // chat / image_generate / image_analyze. Nếu message có ảnh → forward làm attachment.
      let effectiveQuestion = translationQuestion;
      const _dmAttachments: Array<{ kind: "image"; url?: string; base64?: string; mime_type?: string }> = [];
      if (hasAnalyzableImage(message)) {
        const pick = pickLargestPhotoFileId(message);
        const fileId = pick?.fileId ?? null;
        if (fileId) {
          const media = await tryFetchTelegramMedia(fileId, "dm-attachment", {
            allowedMimePrefixes: ["image/"],
            maxBytes: 15 * 1024 * 1024,
          });
          if (media) {
            _dmAttachments.push({ kind: "image", base64: media.base64, mime_type: media.mime });
          }
        }
      }
      const _dmImageOut: import("../_shared/telegram-community.ts").AskAngelImageOut = {};
      const _dmImageStreamer = createTelegramImageStreamer(chatId, {
        placeholderCaption: "💛 Angel đang vẽ cho bé, chờ Angel xíu nhé…",
      });
      const _dmStreamEnabled = await getFlag("image.stream_telegram_preview", true);
      const _dmImmediateContext = telegramReplyAssistantContext(message);
      const reply = await withTyping(chatId, () => askAngel({
        question: effectiveQuestion,
        originalUserMessage: text,
        systemPrompt: effectiveSystemPrompt,
        userLabel: userName,
        personaMode: (settings as any)?.persona_mode,
        personaCustomPrompt: (settings as any)?.persona_custom_prompt,
        funCoreContextPrompt: settings?.fun_core_context_prompt,
        aiStylePrompt: (settings as any)?.ai_style_prompt,
        aiPersonaPrompt: (settings as any)?.ai_persona_prompt,
        adminClient,
        conversationContext: {
          chatId,
          chatType: message.chat?.type ?? null,
          groupId: null,
          userId: message.from?.id ?? null,
          username: message.from?.username ?? null,
          fullName: userName,
          messageId: message.message_id ?? null,
          replyMessageId: message.reply_to_message?.message_id ?? null,
          triggerSource: "dm",
        },
        immediateAssistantContext: _dmImmediateContext,
        forcedLangBucket: translationTarget ?? resolveAngelLanguageBucket(text),
        mirrorAngelWeb: (settings as any)?.ai_mirror_angel_web !== false,
        attachments: _dmAttachments.length > 0 ? _dmAttachments : undefined,
        outImage: _dmImageOut,
        onPartialImage: _dmStreamEnabled ? _dmImageStreamer.onPartial : undefined,
      }));
      console.log("[dm] ai_reply", { chatId, userId: message.from.id, durationMs: Date.now() - startedAt, replyLen: reply.length, imageOut: Boolean(_dmImageOut.image_url || _dmImageOut.image_base64) });
      // Router có ảnh → gửi photo, dùng reply text làm caption (nếu có).
      if (_dmImageOut.image_url || _dmImageOut.image_base64) {
        const caption = reply || "Angel vẽ cho bé đây ✨💛";
        await _dmImageStreamer.finalize({
          b64: _dmImageOut.image_base64 ?? undefined,
          url: _dmImageOut.image_url ?? undefined,
          mime: _dmImageOut.mime_type || "image/png",
          caption,
        });
      } else {
        await replyDm(reply, { skipAutoDelete: true });
      }
    } catch (err) {
      console.error("[dm] ai_reply_failed", { chatId, userId: message.from.id, error: err instanceof Error ? err.message : String(err) });
      await replyDm("Angel đang hơi nghẽn kết nối một chút, bé gửi lại giúp Angel câu hỏi này sau vài giây nhé. 💛", { skipAutoDelete: true });
    }
    return;
  }

  await replyDm(buildMenuText(settings, userName), { reply_markup: menuMarkup(miniAppUrl) });
}


async function handleVerificationCallback(update: TelegramUpdate): Promise<boolean> {
  const callback = update.callback_query;
  const data = callback?.data ?? "";
  if (!callback?.id || !data.startsWith("verify:")) return false;

  const [, challengeId, answerRaw] = data.split(":");
  const answer = Number(answerRaw);
  const userId = callback.from?.id;
  const { adminClient } = getClients();
  const { data: challengeRow, error: lookupError } = await adminClient
    .from("telegram_community_verification_challenges")
    .select("*")
    .eq("id", challengeId)
    .maybeSingle();
  const challenge = challengeRow as VerificationChallenge | null;

  if (lookupError) {
    console.error("[verification] callback challenge lookup failed", {
      challenge_id: challengeId,
      user_id: userId ?? null,
      error: lookupError.message,
    });
    await answerCallbackQuery(callback.id, "Verification is temporarily unavailable. Please try again.");
    return true;
  }

  const settingsLookup = challenge ? await loadGroupSettings(adminClient, challenge.group_id) : null;
  const settings = settingsLookup?.ok ? settingsLookup.settings : null;
  const settingsLookupErrorCode = settingsLookup && !settingsLookup.ok
    ? settingsLookup.errorCode
    : undefined;
  if (settingsLookup && !settingsLookup.ok) {
    console.error("[verification] callback settings lookup failed", {
      chat_id: challenge?.group_id,
      user_id: challenge?.telegram_user_id,
      challenge_id: challenge?.id,
      error_code: settingsLookup.errorCode,
    });
  }
  const isRecoverable = isRecoverableVerificationStatus(challenge?.status);
  const decision = decideVerificationCallback({
    isPending: isRecoverable,
    ownerUserId: challenge?.telegram_user_id ?? -1,
    callbackUserId: userId,
    answer,
    correctAnswer: challenge?.correct_answer ?? Number.NaN,
    // A correct CAPTCHA whose Telegram permission restore failed must remain
    // retryable even after the original challenge timeout.
    expiresAtMilliseconds: challenge
      ? challenge.status === "release_failed"
        ? Number.POSITIVE_INFINITY
        : new Date(challenge.expires_at).getTime()
      : 0,
    nowMilliseconds: Date.now(),
    attempts: challenge?.attempts ?? 0,
    maxAttempts: challenge?.max_attempts ?? settings?.verification_max_attempts ?? 3,
  });

  if (decision.kind === "inactive") {
    await answerCallbackQuery(callback.id, "This verification is no longer active.");
    return true;
  }
  if (decision.kind === "not_owner") {
    await answerCallbackQuery(callback.id, "This captcha is for another member.");
    return true;
  }

  if (!challenge) {
    await answerCallbackQuery(callback.id, "This verification is no longer active.");
    return true;
  }
  if (decision.kind === "expired") {
    await punishUnverifiedMember(adminClient, challenge, settings, "verification_expired");
    await answerCallbackQuery(callback.id, "Verification expired.");
    return true;
  }

  if (decision.kind === "verified") {
    const verifiedAt = new Date().toISOString();
    const claimCompletion = () => adminClient
      .from("telegram_community_verification_challenges")
      .update({ status: "verified", verified_at: verifiedAt }, { count: "exact" })
      .eq("id", challenge.id)
      .in("status", ["pending", "release_failed"]);
    let statusUpdate = await claimCompletion();
    let claimOutcome = verificationClaimOutcome({
      count: statusUpdate.count,
      hasError: Boolean(statusUpdate.error),
    });
    if (statusUpdate.error) {
      console.error("[verification] verified status update failed; retrying", {
        challenge_id: challenge.id,
        user_id: challenge.telegram_user_id,
        error: statusUpdate.error.message,
      });
      statusUpdate = await claimCompletion();
      claimOutcome = verificationClaimOutcome({
        count: statusUpdate.count,
        hasError: Boolean(statusUpdate.error),
      });
    }
    if (claimOutcome === "already_claimed") {
      await answerCallbackQuery(callback.id, "This verification has already been processed.");
      return true;
    }
    if (claimOutcome === "unavailable") {
      await logModeration(adminClient, {
        groupId: challenge.group_id,
        userId: challenge.telegram_user_id,
        username: challenge.username,
        action: "verification_verified_status_update_failed",
        reason: statusUpdate.error?.message ?? "The database did not confirm the verification status update",
        messageId: challenge.captcha_message_id,
      });
      await answerCallbackQuery(callback.id, "Could not save verification. Please try again.");
      return true;
    }
    const callbackOutcome = await completeVerifiedCallback({
      settings,
      ...(settingsLookupErrorCode !== undefined ? { settingsLookupErrorCode } : {}),
      restoreMemberPermissions: async () => {
        const result = await unrestrictChatMember(challenge.group_id, challenge.telegram_user_id);
        return { ok: result.ok, errorCode: result.data?.error_code, description: result.data?.description };
      },
      log: async (action, reason) => {
        console.error("[verification] settings unavailable after correct CAPTCHA", {
          chat_id: challenge.group_id,
          user_id: challenge.telegram_user_id,
          action,
          reason,
        });
        await logModeration(adminClient, {
          groupId: challenge.group_id,
          userId: challenge.telegram_user_id,
          username: challenge.username,
          action,
          reason,
          messageId: challenge.captcha_message_id,
        });
      },
      continueWelcome: async (groupSettings) => await sendFinalWelcome(adminClient, {
        groupId: challenge.group_id,
        userId: challenge.telegram_user_id,
        username: challenge.username,
        fullName: challenge.full_name ?? "Member",
        settings: groupSettings,
        captchaMessageId: challenge.captcha_message_id,
      }),
    });
    if (callbackOutcome === "permissions_restore_failed" || callbackOutcome === "settings_unavailable_release_failed") {
      const { error: retryStateError } = await adminClient
        .from("telegram_community_verification_challenges")
        .update({ status: "release_failed" })
        .eq("id", challenge.id)
        .eq("status", "verified");
      if (retryStateError) {
        console.error("[verification] could not persist retryable permission-restore state", {
          challenge_id: challenge.id,
          user_id: challenge.telegram_user_id,
          error: retryStateError.message,
        });
      }
    }
    if (callbackOutcome === "settings_unavailable_released") {
      await answerCallbackQuery(callback.id, "Verified, but group settings are unavailable. Your permissions were restored.");
      return true;
    }
    if (callbackOutcome === "settings_unavailable_release_failed") {
      await answerCallbackQuery(callback.id, "Verified, but permissions could not be restored. Please contact an admin.");
      return true;
    }
    if (callbackOutcome === "permissions_restore_failed") {
      await answerCallbackQuery(callback.id, "Verified, but permissions could not be restored. Please contact an admin.");
      return true;
    }
    if (callbackOutcome === "welcome_failed") {
      await answerCallbackQuery(callback.id, "Verified and permissions restored, but the welcome message could not be sent. Please contact an admin.");
      return true;
    }
    await answerCallbackQuery(callback.id, callbackOutcome === "welcome_skipped"
      ? "Verified. You can chat now."
      : "Verified. Welcome to FUN.RICH!");
    return true;
  }

  const attempts = decision.attempts;
  const attemptsUpdate = await adminClient
    .from("telegram_community_verification_challenges")
    .update({ attempts }, { count: "exact" })
    .eq("id", challenge.id)
    .eq("status", "pending")
    .eq("attempts", challenge.attempts ?? 0);
  const attemptsClaim = verificationClaimOutcome({
    count: attemptsUpdate.count,
    hasError: Boolean(attemptsUpdate.error),
  });
  if (attemptsClaim !== "claimed") {
    console.error("[verification] wrong-answer attempt update failed", {
      challenge_id: challenge.id,
      user_id: challenge.telegram_user_id,
      outcome: attemptsClaim,
      error: attemptsUpdate.error?.message ?? null,
    });
    await answerCallbackQuery(callback.id, attemptsClaim === "already_claimed"
      ? "This answer was already processed. Use the latest verification message."
      : "Could not save your answer. Please try again.");
    return true;
  }

  if (decision.kind === "failed") {
    await punishUnverifiedMember(adminClient, challenge, settings, "verification_failed", {
      expectedAttempts: attempts,
    });
    await answerCallbackQuery(callback.id, "Too many wrong answers.");
    return true;
  }

  await answerCallbackQuery(callback.id, `Wrong answer. Attempts ${attempts}/${challenge.max_attempts ?? settings?.verification_max_attempts ?? 3}.`);
  return true;
}

async function handleCallback(update: TelegramUpdate) {
  if (await handleVerificationCallback(update)) return;
  const callback = update.callback_query;
  if (!callback?.id) return;
  await answerCallbackQuery(callback.id);

  const chatId = callback.message?.chat?.id ?? callback.from?.id;
  if (!chatId) return;

  if (callback.data === "ask_angel_hint") {
    await sendMessage(
      chatId,
      "💛 <b>Hi there</b>, type your question for Angel right here. For example:\n\n• What is FUN.RICH?\n• How do I create a Light Profile?\n• How do I connect my wallet?\n• What's in the Community Rules?\n\nAngel will reply right away 🌟",
    );
    return;
  }

  if (callback.data === "rules") {
    const { adminClient } = getClients();
    const settings = await ensureSettings(adminClient);
    await sendMessage(chatId, settings?.rules_message ?? "📜 Community rules are not configured yet.");
    return;
  }

  if (callback.data === "video_guide") {
    await sendMessage(chatId, "🎥 Video guide coming soon. In the meantime, explore: https://fun.rich 💛");
    return;
  }

  if (callback.data === "report_help") {
    await sendMessage(chatId, "🛡️ Report spam/scam: reply to the suspicious message and tag an admin. Never share your seed phrase or private key 🙏");
    return;
  }

  if (callback.data === "contact_admin") {
    await sendMessage(chatId, "💬 Please reach out to our team in the official FUN.RICH group 🙏");
  }
}

function buildWelcomeText(
  settings: CommunitySettings,
  name: string,
  username?: string,
  profileUrl?: string,
) {
  const safeName = escapeHtml(name);
  const usernameSuffix = username ? ` (@${escapeHtml(username)})` : "";
  const nameHtml = profileUrl
    ? `<a href="${profileUrl}">${safeName}</a>${usernameSuffix}`
    : `${safeName}${usernameSuffix}`;
  const fullNameWithUsername = `${safeName}${usernameSuffix}`;
  return settings.welcome_message
    .replace(/\{full_name\}/g, nameHtml || fullNameWithUsername)
    .replace(/\{name\}/g, nameHtml || safeName);
}

async function sendWelcomeToMember(
  adminClient: ReturnType<typeof getClients>["adminClient"],
  params: {
    groupId: number;
    member: NonNullable<TelegramMessage["from"]>;
    settings: CommunitySettings;
    reason: string;
    delivery?: JoinDeliveryHooks;
  },
) {
  await upsertUserState({ adminClient, groupId: params.groupId, user: params.member });
  const memberId = params.member.id;
  const profileUrl = memberId ? telegramProfileUrl({ id: memberId, username: params.member.username }) : undefined;
  const text = buildWelcomeText(params.settings, fullName(params.member), params.member.username, profileUrl);
  const replyMarkup = welcomeMarkup(params.settings.mini_app_url, "group", profileUrl ?? null);

  let avatarUrl: string | null = null;
  if (memberId) {
    avatarUrl = await getCommunityUserAvatarUrl(memberId).catch((err) => {
      console.warn("[telegram-community] getCommunityUserAvatarUrl failed", sanitizeTelegramTransportError(
        err,
        Deno.env.get("COMMUNITY_GUARD_BOT_TOKEN") ?? null,
      ));
      return null;
    });
  }

  let result;
  let mode: "photo" | "text" = "text";
  if (params.delivery) {
    if (!(await params.delivery.begin())) return false;
    // Durable join delivery makes one Telegram attempt only. Avoid a photo-to-text
    // fallback because an ambiguous photo response could otherwise duplicate the welcome.
    result = await sendMessage(params.groupId, text, { reply_markup: replyMarkup });
    params.delivery.report({
      ok: result.ok === true && typeof result.data?.result?.message_id === "number",
      status: result.status,
      messageId: result.data?.result?.message_id,
    });
  } else if (avatarUrl) {
    result = await sendPhoto(params.groupId, avatarUrl, text, { reply_markup: replyMarkup });
    mode = "photo";
    if (!result.ok) {
      console.warn("[telegram-community] sendPhoto failed, fallback to sendMessage", result.data);
      result = await sendMessage(params.groupId, text, { reply_markup: replyMarkup });
      mode = "text";
    }
  } else {
    result = await sendMessage(params.groupId, text, { reply_markup: replyMarkup });
  }

  const ok = (result as { ok?: boolean })?.ok === true;
  const sentMessageId = (result as { data?: { result?: { message_id?: number } } })?.data?.result?.message_id;
  await logModeration(adminClient, {
    groupId: params.groupId,
    userId: params.member.id ?? null,
    username: params.member.username ?? null,
    action: welcomeLogAction(ok),
    reason: `${params.reason}:${mode}${avatarUrl ? "" : ":no_avatar"}`,
    messageText: ok ? null : JSON.stringify((result as { data?: unknown })?.data ?? result).slice(0, 500),
    messageId: welcomeLogMessageId(sentMessageId),
  });
  return ok;
}


async function handleWelcomeCommand(message: TelegramMessage, settings: CommunitySettings): Promise<boolean> {
  const chatId = message.chat?.id;
  const userId = message.from?.id;
  const text = extractText(message);
  const match = text.match(/^\/welcome(?:@\S+)?(?:\s+(on|off|test))?\s*$/i);
  if (!chatId || !userId || !match) return false;

  if (!(await isTelegramAdmin(chatId, userId))) {
    await sendMessage(chatId, "Only Telegram admins can manage welcome messages.", {
      reply_to_message_id: message.message_id,
    });
    return true;
  }

  const command = (match[1] ?? "test").toLowerCase();
  const { adminClient } = getClients();

  if (command === "on" || command === "off") {
    const welcomeEnabled = command === "on";
    const { error } = await adminClient
      .from("telegram_community_settings")
      .update({ welcome_enabled: welcomeEnabled })
      .eq("id", settings.id);
    if (error) {
      await sendMessage(chatId, `Welcome update failed: ${error.message}`, {
        reply_to_message_id: message.message_id,
      });
      return true;
    }
    await sendMessage(chatId, `Welcome messages are now ${welcomeEnabled ? "ON" : "OFF"}.`, {
      reply_to_message_id: message.message_id,
    });
    return true;
  }

  await sendWelcomeToMember(adminClient, {
    groupId: chatId,
    member: {
      id: message.from?.id,
      first_name: "FUN.RICH",
      last_name: "Member",
      username: "welcome_test",
    },
    settings: { ...settings, welcome_enabled: true },
    reason: "manual_welcome_test",
  });
  return true;
}

async function sendScamWarningIfAllowed(
  adminClient: ReturnType<typeof getClients>["adminClient"],
  chatId: number,
  settings: CommunitySettings,
): Promise<void> {
  if (settings.scam_warning_enabled === false) return;
  const now = Date.now();
  const lastSentAt = scamWarningLastSentAt.get(chatId) ?? 0;
  if (now - lastSentAt < SCAM_WARNING_COOLDOWN_MS) return;
  scamWarningLastSentAt.set(chatId, now);
  let englishGroup = false;
  try {
    const groupSettings = await getSettingsForGroup(adminClient, chatId);
    englishGroup = String(groupSettings?.reply_language ?? "auto").trim().toLowerCase() === "en";
  } catch (err) {
    console.warn("[GROUP_LANG] scam warning settings lookup failed; using auto", {
      chatId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
  await sendMessage(
    chatId,
    englishGroup
      ? "⚠️ Warning: A message suspected of being a scam or phishing attempt was removed. Do not open suspicious links or enter your OTP, password, seed phrase, or private key."
      : "⚠️ Cảnh báo: Tin nhắn có dấu hiệu scam/phishing đã bị xoá. Vui lòng không bấm link đáng ngờ, không nhập OTP, mật khẩu, seed phrase hoặc private key.",
    { skipAutoDelete: true },
  ).catch((err) => console.warn("[SCAM_DETECTED] warning_send_failed", err));
}

async function handleTelegramScamDetection(params: {
  adminClient: ReturnType<typeof getClients>["adminClient"];
  message: TelegramMessage;
  settings: CommunitySettings;
  msgType: string;
}): Promise<boolean> {
  const chatId = params.message.chat?.id;
  const messageId = params.message.message_id;
  if (!chatId || !messageId || params.settings.scam_protection_enabled === false) return false;

  const urls = extractUrls(params.message);
  const trustedDomains = urls.length ? await activeDomains(params.adminClient) : [];
  const detection = detectTelegramScam(params.message, trustedDomains);
  const riskAssessment = assessTelegramScamRisk({
    text: extractText(params.message),
    urls,
    trustedDomains,
    strictMode: params.settings.scam_strict_mode === true,
  });
  if (!detection.isScam && !riskAssessment.shouldDelete) return false;

  const user = params.message.from;
  const isAdminSender = Boolean(
    (user?.id && await isTelegramAdmin(chatId, user.id)) ||
      (params.message.sender_chat?.id && params.message.sender_chat.id === chatId)
  );
  const finalAssessment = detection.isScam
    ? {
      ...riskAssessment,
      shouldDelete: true,
      riskScore: Math.max(riskAssessment.riskScore, detection.severity === "high" ? 8 : 7),
      matchedRules: [...new Set([...riskAssessment.matchedRules, `existing_detector:${detection.reason}`, ...detection.matchedKeywords])],
    }
    : riskAssessment;
  const moderationContext: ScamModerationContext = {
    chatId,
    messageId,
    userId: user?.id ?? null,
    username: user?.username ?? params.message.sender_chat?.username ?? null,
    senderChatId: params.message.sender_chat?.id ?? null,
    isAdmin: isAdminSender,
    messageType: params.msgType,
    scamStrictMode: params.settings.scam_strict_mode === true,
    antiSpamEnabled: params.settings.anti_spam_enabled,
    scamProtectionEnabled: true,
  };
  let scamDeleteDiagnostic = "";
  const deleteOutcome = await enforceScamDeletion({
    context: moderationContext,
    assessment: finalAssessment,
    deleteMessage: async () => {
      const result = await deleteModerationMessage(chatId, messageId);
      scamDeleteDiagnostic = result.deleted ? "" : `;delete_failed:${result.errorCode ?? "unknown"}:${result.failure}`;
      return { ok: result.deleted, errorCode: result.errorCode, errorDescription: result.failure };
    },
    checkDeletePermission: async () => {
      const bot = await getBotInfo();
      if (!bot) return { canDeleteMessages: null, status: "unknown", errorDescription: "getMe failed" };
      const result = await getChatMember(chatId, bot.id);
      if (!result.ok) {
        return { canDeleteMessages: null, status: "unknown", errorDescription: "permission_check_unverified" };
      }
      const member = result.data?.result as { status?: string; can_delete_messages?: boolean } | undefined;
      const status = member?.status ?? "unknown";
      const canDeleteMessages = resolveDeletePermission(result.ok, member);
      return { canDeleteMessages, status };
    },
    log: (event) => console.log("[TELEGRAM_MODERATION]", event),
  });

  const deletionError = deleteOutcome === "delete_failed" ? "See structured delete_failed event" : null;
  const matchedRules = finalAssessment.matchedRules;
  const redactedUrls = finalAssessment.urls.map((raw) => {
    try {
      const url = new URL(raw.startsWith("www.") ? `https://${raw}` : raw);
      return `${url.protocol}//${url.hostname}${url.pathname}`.slice(0, 240);
    } catch {
      return raw.slice(0, 240);
    }
  });
  await logModeration(params.adminClient, {
    groupId: chatId,
    userId: user?.id ?? params.message.sender_chat?.id ?? null,
    username: user?.username ?? params.message.sender_chat?.username ?? null,
    action: deleteOutcome === "deleted" ? "scam_deleted" : "scam_detected_delete_failed",
    reason: (detection.reason === "referral_cashback_promo"
      ? "REFERRAL_CASHBACK_PROMO"
      : `SCAM_RISK:${matchedRules.slice(0, 8).join(",")}`.slice(0, 120)) + scamDeleteDiagnostic,
    messageText: JSON.stringify({
      matched_rules: matchedRules,
      risk_score: finalAssessment.riskScore,
      risk_threshold: finalAssessment.threshold,
      urls: redactedUrls,
      existing_detector_reason: detection.reason,
      severity: detection.severity,
      delete_error: deletionError,
      message_type: params.msgType,
      is_admin: isAdminSender,
    }).slice(0, 500),
    messageId,
  });

  if (deleteOutcome === "delete_failed") {
    await notifyModerationDeleteFailure(params.adminClient, chatId, messageId);
  } else if (detection.reason !== "referral_cashback_promo") {
    await sendScamWarningIfAllowed(params.adminClient, chatId, params.settings);
  }
  return true;
}

function emitModerationPipelineEvent(
  event: string,
  message: TelegramMessage,
  extra: Record<string, unknown> = {},
) {
  const urls = extractUrls(message).map((raw) => {
    try {
      const url = new URL(raw.startsWith("www.") ? `https://${raw}` : raw);
      return `${url.protocol}//${url.hostname}${url.pathname}`.slice(0, 240);
    } catch {
      return raw.slice(0, 240);
    }
  });
  console.log("[TELEGRAM_MODERATION]", {
    event,
    chat_id: message.chat?.id ?? null,
    message_id: message.message_id ?? null,
    user_id: message.from?.id ?? null,
    username: message.from?.username ?? message.sender_chat?.username ?? null,
    sender_chat_id: message.sender_chat?.id ?? null,
    message_type: classifyMessageType(message),
    urls,
    ...extra,
  });
}

async function evaluateModeration(
  message: TelegramMessage,
  settings: NonNullable<Awaited<ReturnType<typeof getSettingsForGroup>>>,
): Promise<boolean> {
  emitModerationPipelineEvent("moderation_started", message, {
    phase: "anti_spam",
    anti_spam_enabled: settings.anti_spam_enabled,
    scam_protection_enabled: settings.scam_protection_enabled !== false,
    scam_strict_mode: settings.scam_strict_mode === true,
  });
  try {
    const actioned = await evaluateModerationCore(message, settings);
    emitModerationPipelineEvent("moderation_result", message, {
      action: actioned ? "moderated" : "kept",
      anti_spam_enabled: settings.anti_spam_enabled,
      scam_protection_enabled: settings.scam_protection_enabled !== false,
      scam_strict_mode: settings.scam_strict_mode === true,
    });
    return actioned;
  } catch (error) {
    emitModerationPipelineEvent("moderation_result", message, {
      action: "error",
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    });
    throw error;
  }
}

async function evaluateModerationCore(message: TelegramMessage, settings: NonNullable<Awaited<ReturnType<typeof getSettingsForGroup>>>): Promise<boolean> {
  const chatId = message.chat?.id;
  const messageId = message.message_id;
  const user = message.from;
  if (!chatId || !messageId) return false;
  if (!settings.anti_spam_enabled && settings.scam_protection_enabled === false) return false;
  // Allow sender_chat posts to reach moderation; bypass only if trusted.
  if (!user?.id && !message.sender_chat?.id) return false;

  const { adminClient } = getClients();
  const text = extractText(message);
  const msgType = classifyMessageType(message);
  const userIsAdmin = Boolean(user?.id && await isTelegramAdmin(chatId, user.id));

  // Foreign bots and inline bots previously bypassed the legacy CJK detector at
  // `user.is_bot`. Run this deterministic, no-AI check first. The official
  // community bot is excluded by username inside the detector.
  const automatedCjkScam = detectAutomatedCjkScam(message, settings.bot_username);
  if (automatedCjkScam.isScam) {
    const actorId = user?.id ?? message.via_bot?.id ?? null;
    const actorUsername = user?.username ?? message.via_bot?.username ?? null;
    const deletion = await deleteModerationMessage(chatId, messageId);
    const deleted = deletion.deleted;
    let banned = false;
    const deleteErrorCode = deletion.errorCode ?? null;
    let banErrorCode: number | null = null;

    // A direct foreign bot can continuously flood the group, so remove it at
    // once. For inline-bot messages, punish the sending user through the normal
    // warning ladder below rather than banning a possibly legitimate user here.
    if (automatedCjkScam.senderKind === "bot" && user?.id) {
      try {
        const result = await banChatMember(chatId, user.id);
        banned = result.ok === true;
        if (!banned) banErrorCode = result.data?.error_code ?? null;
      } catch (error) {
        console.warn("[AUTOMATED_CJK_SCAM] bot ban request threw", {
          error_name: error instanceof Error ? error.name : "unknown",
        });
      }
      await logModeration(adminClient, {
        groupId: chatId,
        userId: actorId,
        username: actorUsername,
        action: banned ? "automated_bot_banned" : (deleted ? "automated_scam_deleted_ban_failed" : "automated_scam_action_failed"),
        reason: ["automated_cjk_scam", !deleted ? `delete_failed:${deleteErrorCode ?? "unknown"}:${deletion.failure}` : null, !banned ? `ban_failed:${banErrorCode ?? "unknown"}` : null].filter(Boolean).join(";"),
        messageText: JSON.stringify({
          sender_kind: automatedCjkScam.senderKind,
          has_inline_keyboard: automatedCjkScam.hasInlineKeyboard,
          has_external_button: automatedCjkScam.hasExternalButton,
          delete_error_code: deleteErrorCode,
          ban_error_code: banErrorCode,
          preview: automatedCjkScam.payload.slice(0, 260),
        }),
        messageId,
      });
      console.log("[AUTOMATED_CJK_SCAM]", { chat_id: chatId, message_id: messageId, actor_id: actorId, deleted, banned, delete_error_code: deleteErrorCode, ban_error_code: banErrorCode });
      return true;
    }

    // Inline bot: deletion already happened; apply the existing warning/mute/ban
    // policy to the human sender without performing another delete call.
    if (user?.id) {
      const state = await upsertUserState({ adminClient, groupId: chatId, user });
      let warningStateAvailable = state !== null;
      let warningCount: number | null = state ? state.warning_count + 1 : null;
      let warningStateErrorCode: string | null = state ? null : "unavailable";
      if (state && warningCount !== null) {
        const stateUpdate = await adminClient
          .from("telegram_community_user_state")
          .update({ warning_count: warningCount })
          .eq("group_id", chatId)
          .eq("telegram_user_id", user.id);
        const stateCheck = stateUpdate.error
          ? null
          : await adminClient
            .from("telegram_community_user_state")
            .select("warning_count")
            .eq("group_id", chatId)
            .eq("telegram_user_id", user.id)
            .maybeSingle();
        if (stateUpdate.error || stateCheck?.error || stateCheck?.data?.warning_count !== warningCount) {
          warningStateAvailable = false;
          warningCount = null;
          warningStateErrorCode = stateUpdate.error?.code ?? stateCheck?.error?.code ?? "row_not_updated";
        }
      }

      let inlineBanAttempted = false;
      let inlineBanSucceeded = false;
      let inlineBanErrorCode: number | null = null;
      let inlineMuteAttempted = false;
      let inlineMuteSucceeded = false;
      let inlineMuteErrorCode: number | null = null;
      if (warningStateAvailable && warningCount !== null && warningCount >= settings.warning_before_ban) {
        inlineBanAttempted = true;
        try {
          const result = await banChatMember(chatId, user.id);
          inlineBanSucceeded = result.ok === true;
          inlineBanErrorCode = result.data?.error_code ?? null;
        } catch (error) {
          console.warn("[AUTOMATED_CJK_SCAM] inline sender ban threw", {
            error_name: error instanceof Error ? error.name : "unknown",
          });
        }
      } else if (warningStateAvailable && warningCount !== null && warningCount >= settings.warning_before_mute) {
        inlineMuteAttempted = true;
        const untilUnix = Math.floor(Date.now() / 1000) + settings.mute_duration_minutes * 60;
        try {
          const result = await restrictChatMember(chatId, user.id, untilUnix);
          inlineMuteSucceeded = result.ok === true;
          inlineMuteErrorCode = result.data?.error_code ?? null;
        } catch (error) {
          console.warn("[AUTOMATED_CJK_SCAM] inline sender mute threw", {
            error_name: error instanceof Error ? error.name : "unknown",
          });
        }
      }
      const inlineAction = violationActionOutcome({
        deleted,
        countWarning: true,
        banAttempted: inlineBanAttempted,
        banSucceeded: inlineBanSucceeded,
        muteAttempted: inlineMuteAttempted,
        muteSucceeded: inlineMuteSucceeded,
        warningStateAvailable,
      });
      await logModeration(adminClient, {
        groupId: chatId,
        userId: user.id,
        username: user.username ?? null,
        action: inlineAction,
        reason: [
          "automated_cjk_scam:inline_bot",
          !warningStateAvailable ? `warning_state:${warningStateErrorCode ?? "unknown"}` : null,
          inlineBanAttempted && !inlineBanSucceeded ? `ban_failed:${inlineBanErrorCode ?? "unknown"}` : null,
          inlineMuteAttempted && !inlineMuteSucceeded ? `mute_failed:${inlineMuteErrorCode ?? "unknown"}` : null,
          !deleted ? `delete_failed:${deleteErrorCode ?? "unknown"}:${deletion.failure}` : null,
        ].filter(Boolean).join(";").slice(0, 240),
        messageText: automatedCjkScam.payload,
        messageId,
      });
    }
    console.log("[AUTOMATED_CJK_SCAM]", { chat_id: chatId, message_id: messageId, actor_id: actorId, sender_kind: automatedCjkScam.senderKind, deleted, delete_error_code: deleteErrorCode });
    return true;
  }

  if (!settings.anti_spam_enabled) return false;

  if (user?.is_bot) {
    emitModerationPipelineEvent("moderation_bypassed", message, { reason: "sender_is_bot", is_admin: userIsAdmin });
    return false;
  }

  if (userIsAdmin) {
    emitModerationPipelineEvent("moderation_bypassed", message, { reason: "admin_anti_spam_exemption", is_admin: true });
    return false;
  }
  if (message.sender_chat?.id && (await isTrustedSenderChat(adminClient, chatId, message.sender_chat.id))) {
    return false;
  }

  const state = user?.id ? await upsertUserState({ adminClient, groupId: chatId, user }) : null;
  if (moderationStateDecision(Boolean(user?.id), state !== null) === "stop_unverified") {
    await logModeration(adminClient, {
      groupId: chatId,
      userId: user?.id ?? null,
      username: user?.username ?? null,
      action: "moderation_state_unavailable",
      reason: "anti_spam_rate_state_could_not_be_verified",
      messageId,
    }).catch(() => undefined);
    console.warn("[community] anti-spam evaluation stopped because per-user state is unavailable", {
      chat_id: chatId,
      user_id: user?.id ?? null,
    });
    return true;
  }
  const messageCount = state ? await updateMessageWindow(adminClient, state) : 1;

  // FUN spiritual bypass â€” khÃ´ng xoÃ¡ bÃ i sÃ¡m há»‘i / biáº¿t Æ¡n / tÃ¢m linh FUN
  if (text && (isFunSpiritualContent(text) || isTrustedFunCommunityContent(text))) {
    console.log("[community] fun_content_bypass", { chatId, messageId, userId: user?.id });
    return false;
  }

  const urls = extractUrls(message);
  const whitelist = await activeDomains(adminClient);
  const keywords = await activeKeywords(adminClient);

  const joinedAt = state?.joined_at ? new Date(state.joined_at).getTime() : Date.now();
  const newUserMs = settings.new_user_restriction_hours * 60 * 60 * 1000;
  const isNewUser = Date.now() - joinedAt < newUserMs;

  let reason: string | null = null;
  let detectedText: string = text;
  let matchedKeywordRow: any = null;
  let rawKeyword: string | null = null;

  const m2 = message as Record<string, unknown>;
  const isHighRiskContainer = Boolean(
    m2.checklist || m2.poll || m2.forward_origin || m2.forward_from || m2.forward_from_chat || message.external_reply,
  );

  // 1) TELEGRAM_PREVIEW_SPAM
  if (settings.block_telegram_previews !== false) {
    const trustedHandles = await loadTrustedTelegramHandles(adminClient, chatId);
    const hit = detectTelegramPreviewSpam(message, {
      trustedHandles,
      ownBot: settings.bot_username,
    });
    if (hit) reason = `TELEGRAM_PREVIEW_SPAM:${hit.kind}`;
  }

  // 2) EXTERNAL_BOT_PROMOTION
  if (!reason && settings.block_external_bots !== false) {
    const allowlist = await loadTrustedBotUsernames(adminClient, chatId);
    const offending = detectExternalBotPromotion(text, settings.bot_username, allowlist);
    if (offending) {
      reason = `EXTERNAL_BOT_PROMOTION:@${offending}`;
      detectedText = `@${offending}`;
    }
  }

  // 3) SCAM_PROMOTION (configurable keyword DB)
  if (!reason && settings.block_scam_keywords !== false) {
    const keyword = findBlockedKeyword(text, keywords);
    if (keyword) {
      reason = `SCAM_PROMOTION:${keyword.keyword}`;
      matchedKeywordRow = keyword;
      rawKeyword = keyword.keyword;
    }
  }

  // 4) OCR_RISK_CONTENT â€” only for high-risk containers (forward/preview/external_reply) or new users.
  //    Saves AI Gateway cost: most legit photo posts skip OCR entirely.
  if (!reason && settings.enable_ocr_scan !== false && (isHighRiskContainer || isNewUser)) {
    const photo = pickLargestPhotoFileId(message);
    if (photo) {
      const ocr = await runOcrOnPhoto(photo.fileId, photo.uniq);
      if (ocr.status === "unavailable") {
        // Not a clean scan or a violation: continue all remaining text/URL rules.
        console.warn("[community] ocr_scan_unavailable", {
          chatId, messageId, reason: ocr.reason, httpStatus: ocr.httpStatus,
        });
      }
      if (ocr.status === "text") {
        const ocrText = ocr.text;
        const combinedOcrText = [text, ocrText].filter(Boolean).join("\n");
        if (isTrustedFunCommunityContent(combinedOcrText) || isFunSpiritualContent(combinedOcrText)) {
          console.log("[community] fun_ocr_bypass", { chatId, messageId, userId: user?.id });
          return false;
        }
        const ocrKeyword = findBlockedKeyword(ocrText, keywords);
        const ocrBot = detectExternalBotPromotion(
          ocrText,
          settings.bot_username,
          await loadTrustedBotUsernames(adminClient, chatId),
        );
        if (ocrKeyword && settings.block_shock_content !== false) {
          reason = `OCR_RISK_CONTENT:${ocrKeyword.keyword}`;
          detectedText = ocrText;
          matchedKeywordRow = ocrKeyword;
          rawKeyword = ocrKeyword.keyword;
        } else if (ocrBot) {
          reason = `OCR_RISK_CONTENT:bot:@${ocrBot}`;
          detectedText = ocrText;
        } else if (/(?:t|telegram)\.me\//i.test(ocrText)) {
          reason = `OCR_RISK_CONTENT:tg_link`;
          detectedText = ocrText;
        }
      }
    }
  }

  // Legacy heuristic layers (kept)
  if (!reason && text) {
    if (looksLikeMentionBait(text, settings.bot_username)) reason = "mention_bait";
    else if (isCjkPlusForeignBot(text, settings.bot_username)) reason = "cjk_plus_foreign_bot";
    else if (isCjkPlusUserMention(text, settings.bot_username)) reason = "cjk_plus_user_mention";
    else if (looksLikeCjkPromo(text)) reason = "cjk_gambling_promo";
    else if (looksLikeCjkRomanceBait(text)) reason = "cjk_romance_bait";
    else if (looksLikeVietnameseAbuse(text)) reason = "vietnamese_abuse";

    else if (looksLikeCardingStorePromo(text)) reason = "carding_store_promo";
    else if (looksLikeLatinPromo(text, { minGroups: isHighRiskContainer ? 1 : 2 })) {
      reason = isHighRiskContainer ? "latin_gambling_promo_container" : "latin_gambling_promo";
    }
  }

  // Quảng cáo bán tài khoản Telegram / số ảo / OTP hàng loạt (vd: "BUBU Store").
  let accountShopStrong = false;
  if (
    !reason && text &&
    (settings as Record<string, unknown>).account_shop_guard_enabled !== false
  ) {
    const hit = detectAccountShopPromo(text);
    if (hit) {
      accountShopStrong = hit === "strong";
      reason = accountShopStrong ? "account_shop_promo" : "account_shop_promo_weak";
      detectedText = text;
      console.log("[community] account_shop_promo", { chatId, userId: user?.id, strength: hit });
    }
  }


  // CJK chatter seeding: tin tiếng Trung ngắn lặp lại trong nhóm không dùng tiếng Trung.
  // Một tin đơn lẻ chỉ ghi strike; đủ ngưỡng mới xử lý để tránh chặn nhầm.
  let cjkChatterStrikes = 0;
  if (
    !reason && text && user?.id &&
    (settings as Record<string, unknown>).cjk_chatter_guard_enabled !== false &&
    String((settings as Record<string, unknown>).group_primary_language ?? "vi").toLowerCase() !== "zh" &&
    looksLikeOffLanguageCjkChatter(text)
  ) {
    await recordSpamPrelude({
      adminClient,
      groupId: chatId,
      userId: user.id,
      kind: "cjk_chatter",
      messageId,
    });
    cjkChatterStrikes = await countSpamPrelude({
      adminClient,
      groupId: chatId,
      userId: user.id,
      kind: "cjk_chatter",
      windowMinutes: 1440,
    });
    const threshold = Math.max(
      2,
      Number((settings as Record<string, unknown>).cjk_chatter_strike_threshold ?? 2) || 2,
    );
    console.log("[community] cjk_chatter", { chatId, userId: user.id, strikes: cjkChatterStrikes, threshold });
    if (cjkChatterStrikes >= threshold) {
      reason = "cjk_chatter_seeding";
      detectedText = text;
    }
  }

  if (!reason) {
    const susHost = hasSuspiciousTld(urls, whitelist);
    if (susHost) reason = `suspicious_tld:${susHost}`;
  }

  // isNewUser is consumed by OCR gate above
  const rateLimitMax = Number(settings.max_messages_per_minute ?? 0);
  if (!reason && rateLimitMax > 0 && messageCount > rateLimitMax) reason = "message_rate_limit";

  if (!reason) return false;

  const violatingUserId = user?.id ?? 0;
  const SCAM_ESCALATION_KINDS = new Set<string>([
    "cjk_plus_foreign_bot",
    "cjk_plus_user_mention",
    "cjk_gambling_promo",
    "cjk_romance_bait",
    "carding_store_promo",
    "latin_gambling_promo",
    "latin_gambling_promo_container",
    "cjk_chatter_seeding",
    "account_shop_promo",
    "account_shop_promo_weak",
  ]);


  // Stage 1: mention-bait → record prelude nhưng chưa ban vĩnh viễn.
  if (reason === "mention_bait" && violatingUserId) {
    await recordSpamPrelude({
      adminClient,
      groupId: chatId,
      userId: violatingUserId,
      kind: "mention_bait",
      messageId,
    });
  }

  // Stage 2: nếu tin scam đến sau khi có mention-bait trong 10 phút → PERMANENT BAN.
  let escalatedBan = false;
  if (violatingUserId && SCAM_ESCALATION_KINDS.has(reason.split(":")[0] ?? reason)) {
    const hadBait = await hasRecentSpamPrelude({
      adminClient,
      groupId: chatId,
      userId: violatingUserId,
      kind: "mention_bait",
      windowMinutes: 10,
    });
    if (hadBait) escalatedBan = true;
  }
  // Chatter seeding kéo dài (≥3 tin/24h) → ban vĩnh viễn.
  if (reason === "cjk_chatter_seeding" && cjkChatterStrikes >= 3) escalatedBan = true;
  // Quảng cáo bán tài khoản: match chắc chắn → ban ngay (trừ khi admin chọn 'warn').
  if (
    accountShopStrong && violatingUserId &&
    String((settings as Record<string, unknown>).account_shop_action ?? "ban").toLowerCase() !== "warn"
  ) {
    escalatedBan = true;
  }




  const countWarning = shouldEscalateModeration(reason, rawKeyword, matchedKeywordRow);

  console.log(
    `[MODERATION] chat_id=${chatId} message_id=${messageId} message_type=${msgType} rule=${reason.split(":")[0]} count_warning=${countWarning} escalated_ban=${escalatedBan}`,
  );

  if (escalatedBan) {
    const deletion = await deleteModerationMessage(chatId, messageId);
    const messageDeleted = deletion.deleted;
    let memberBanned = false;
    const deleteErrorCode = deletion.errorCode;
    let banErrorCode: number | undefined;
    try {
      const ban = await banChatMember(chatId, violatingUserId);
      memberBanned = ban.ok;
      banErrorCode = ban.data?.error_code;
    } catch (error) {
      console.warn("[MODERATION] ban request threw", { error_name: error instanceof Error ? error.name : "unknown" });
    }

    const outcome = escalatedModerationOutcome({ messageDeleted, memberBanned });
    if (memberBanned) {
      const { error } = await adminClient
        .from("telegram_community_user_state")
        .update({ banned_at: new Date().toISOString() })
        .eq("group_id", chatId)
        .eq("telegram_user_id", violatingUserId);
      if (error) console.warn("[MODERATION] banned state update failed", { error_code: error.code ?? "unknown" });
    }
    await logModeration(adminClient, {
      groupId: chatId,
      userId: violatingUserId,
      username: user?.username ?? null,
      action: outcome === "ban_succeeded" ? (messageDeleted ? "banned" : "banned_message_delete_failed") : outcome,
      reason: `${reason.slice(0, 100)};coordinated_spam_escalation:delete_${messageDeleted ? "success" : `failed_${deleteErrorCode ?? "unknown"}_${deletion.failure}`}:ban_${memberBanned ? "success" : `failed_${banErrorCode ?? "unknown"}`}`,
      messageId,
    });
    const label = user?.username ? `@${user.username}` : (user?.first_name ?? String(violatingUserId));
    try {
      if (!messageDeleted) {
        await notifyModerationDeleteFailure(adminClient, chatId, messageId);
      } else {
        await sendMessage(
          chatId,
          outcome === "ban_succeeded"
            ? `🚫 <b>${label}</b> was permanently banned — coordinated spam pattern (mention-bait + scam follow-up).`
            : `⚠️ The suspicious message was removed, but the account could not be banned automatically.`,
        );
      }
    } catch (error) {
      console.warn("[MODERATION] notify failed", { error_name: error instanceof Error ? error.name : "unknown" });
    }
    return true;
  }

  await applyViolation({
    adminClient,
    settings,
    chatId,
    messageId,
    user: user ?? { id: 0, username: message.sender_chat?.username, first_name: message.sender_chat?.title },
    reason,
    messageText: detectedText,
    keywordRow: matchedKeywordRow,
    rawKeyword,
    countWarning,
  });
  return true;
}



// ============================================================
// HÆ°á»›ng C: xá»­ lÃ½ slash-command trong group.
// - /rules /report /help â†’ reply cÃ´ng khai (tag tin cá»§a user)
// - /start /menu /profile â†’ reply ngáº¯n + nÃºt má»Ÿ DM vá»›i bot
// - Lá»‡nh khÃ¡c â†’ bá» qua (Angel cÅ©ng sáº½ khÃ´ng tráº£ lá»i nhá» guard trong handleGroupAiMention)
// Tráº£ vá» true náº¿u Ä‘Ã£ xá»­ lÃ½ (caller dá»«ng pipeline).
// ============================================================
async function handleGroupCommand(
  message: TelegramMessage,
  settings: CommunitySettings,
): Promise<boolean> {
  const chatId = message.chat?.id;
  const text = extractText(message);
  if (!chatId || !text) return false;

  const match = text.match(/^\/([a-z0-9_]+)(?:@([a-z0-9_]+))?(?:\s|$)/i);
  if (!match) return false;

  const cmd = match[1].toLowerCase();
  const targetBot = match[2]?.toLowerCase();
  const bot = await getBotInfo();
  const botUsername = (bot?.username ?? Deno.env.get("COMMUNITY_GUARD_BOT_USERNAME") ?? "").toLowerCase();

  // Trong group, Telegram chá»‰ gá»­i cho bot náº¿u lá»‡nh cÃ³ @botUsername hoáº·c khÃ´ng cÃ³ @ nÃ o.
  // Náº¿u user gÃµ /start@another_bot â†’ bá» qua hoÃ n toÃ n.
  if (targetBot && botUsername && targetBot !== botUsername) return false;

  const { adminClient } = getClients();
  let groupSettings: CommunitySettings | null = null;
  if (["rules", "feedback", "register_sender_chat"].includes(cmd)) {
    try {
      groupSettings = await getSettingsForGroup(adminClient, chatId);
    } catch (err) {
      console.warn("[GROUP_LANG] command settings lookup failed; using auto", {
        chatId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  const englishGroup = String(groupSettings?.reply_language ?? "auto").trim().toLowerCase() === "en";

  const replyTo = { reply_to_message_id: message.message_id };
  const dmDeepLink = botUsername
    ? `https://t.me/${botUsername}?start=menu`
    : null;
  const openDmMarkup = dmDeepLink
    ? { reply_markup: { inline_keyboard: [[{ text: "💬 Open private chat with Angel", url: dmDeepLink }]] } }
    : {};

  // --- Commands intended for DM (personal, Web App) ---
  if (cmd === "start" || cmd === "menu" || cmd === "profile") {
    await sendMessage(
      chatId,
      `🌟 The command <code>/${cmd}</code> is for <b>private chat</b> with Angel to open your personal FUN.RICH Profile.\n\nTap the button below to open a DM with Angel 💛`,
      { ...replyTo, ...openDmMarkup },
    );
    return true;
  }

  // --- Commands usable in groups ---
  if (cmd === "rules") {
    await sendMessage(
      chatId,
      groupSettings?.rules_message ?? settings?.rules_message ?? "📜 Community rules are not configured yet. We'll update them soon.",
      replyTo,
    );
    return true;
  }

  if (cmd === "report") {
    await sendMessage(
      chatId,
      "🛡️ <b>Report spam / scam</b>\n\nReply to the suspicious message and tag an admin, or send a screenshot to our team.\n\n⚠️ Never share your <b>seed phrase</b> or <b>private key</b> with anyone 🙏",
      replyTo,
    );
    return true;
  }

  if (cmd === "feedback") {
    const body = text.replace(/^\/feedback(@[a-z0-9_]+)?\s*/i, "").trim();
    if (body.length < 3) {
      await sendMessage(
        chatId,
        englishGroup
          ? "💌 <b>Send feedback to Angel</b>\n\nUse: <code>/feedback &lt;your feedback&gt;</code>\nExample: <code>/feedback Please add a morning meditation feature</code>"
          : "💌 <b>Gửi góp ý cho Angel</b>\n\nGõ: <code>/feedback &lt;nội dung góp ý&gt;</code>\nVí dụ: <code>/feedback Angel ơi, bé mong có thêm chức năng thiền buổi sáng</code>",
        replyTo,
      );
      return true;
    }
    if (body.length > 4000) {
      await sendMessage(
        chatId,
        englishGroup
          ? "🙏 This feedback is too long. Please shorten it to fewer than 4,000 characters 💛"
          : "🙏 Nội dung góp ý hơi dài, bé rút gọn dưới 4000 ký tự giúp Angel nhé 💛",
        replyTo,
      );
      return true;
    }
    try {
      const fromId = message.from?.id ?? null;
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      if (fromId) {
        const { count } = await adminClient
          .from("telegram_feedback")
          .select("id", { count: "exact", head: true })
          .eq("telegram_user_id", fromId)
          .gte("created_at", oneHourAgo);
        if ((count ?? 0) >= 3) {
          await sendMessage(
            chatId,
            englishGroup
              ? "🙏 Angel has received several feedback messages from you. Please wait about an hour so Angel can review them 💛"
              : "🙏 Angel đã nhận rất nhiều góp ý từ bé rồi, xin bé đợi ~1 giờ để Angel đọc và phản hồi nhé 💛",
            replyTo,
          );
          return true;
        }
      }
      const displayName = [message.from?.first_name, message.from?.last_name].filter(Boolean).join(" ") || null;
      const replyMsg = message.reply_to_message;
      const replyPreview = replyMsg ? (extractText(replyMsg) || "").slice(0, 500) : null;
      await adminClient.from("telegram_feedback").insert({
        source: "group",
        chat_id: chatId,
        chat_title: message.chat?.title ?? null,
        telegram_user_id: fromId,
        username: message.from?.username ?? null,
        display_name: displayName,
        message_id: message.message_id ?? null,
        content: body,
        reply_to_message_id: replyMsg?.message_id ?? null,
        reply_to_preview: replyPreview,
      });
      await sendMessage(
        chatId,
        englishGroup
          ? "🙏 Angel has received your feedback. Thank you for sharing your thoughtful ideas 💛✨"
          : "🙏 Angel đã ghi nhận góp ý của bé. Cảm ơn ánh sáng minh triết bé chia sẻ 💛✨",
        replyTo,
      );
    } catch (err) {
      console.warn("[group] feedback_insert_failed", { chatId, error: err instanceof Error ? err.message : String(err) });
      await sendMessage(
        chatId,
        englishGroup
          ? "🙏 Angel ran into an issue saving your feedback. Please try again in a few minutes 💛"
          : "🙏 Angel gặp trục trặc khi lưu góp ý. Bé thử lại sau ít phút giúp Angel nhé 💛",
        replyTo,
      );
    }
    return true;
  }

  if (cmd === "help") {
    await sendMessage(
      chatId,
      `💬 <b>Quick help</b>\n\n• Ask Angel AI: tag <code>@${botUsername || "bot"}</code> or type <code>/ask &lt;question&gt;</code>\n• View rules: <code>/rules</code>\n• Report spam: <code>/report</code>\n• Send feedback: <code>/feedback &lt;nội dung&gt;</code>\n• Open your personal FUN.RICH Profile: DM <code>/menu</code> to Angel`,
      { ...replyTo, ...openDmMarkup },
    );
    return true;
  }


  // /ask Ä‘Æ°á»£c handleGroupAiMention xá»­ lÃ½ â†’ khÃ´ng chiáº¿m á»Ÿ Ä‘Ã¢y.
  if (cmd === "ask") return false;

  // /register_sender_chat â€” Ä‘Äƒng kÃ½ channel (sender_chat) Ä‘Æ°á»£c phÃ©p tag Angel
  if (cmd === "register_sender_chat") {
    const { adminClient } = getClients();
    const fromId = message.from?.id;
    const senderChat = message.sender_chat;
    const replySenderChat = message.reply_to_message?.sender_chat;

    // Parse optional args: /register_sender_chat <id> [title...]
    const argsRaw = text.replace(/^\/register_sender_chat(?:@[a-z0-9_]+)?\s*/i, "").trim();
    const argMatch = argsRaw.match(/^(-?\d+)(?:\s+(.*))?$/);
    const argId = argMatch ? Number(argMatch[1]) : null;
    const argTitle = argMatch?.[2]?.trim() || null;

    let targetSenderChatId: number | null = null;
    let targetTitle: string | null = null;
    let authorized = false;
    let mode = "reject";

    // Mode 1: sent AS channel, anonymous admin of this very group (sender_chat = chat)
    if (!fromId && senderChat?.id && senderChat.id === chatId) {
      targetSenderChatId = senderChat.id;
      targetTitle = senderChat.title ?? null;
      authorized = true;
      mode = "as_channel_self";
    }
    // Mode 2: sent AS channel that is already trusted (update title)
    else if (!fromId && senderChat?.id) {
      const trusted = await isTrustedSenderChat(adminClient, chatId, senderChat.id);
      if (trusted) {
        targetSenderChatId = senderChat.id;
        targetTitle = senderChat.title ?? null;
        authorized = true;
        mode = "as_channel_already_trusted";
      }
    }
    // Mode 3: personal admin replied to a channel message
    else if (fromId && replySenderChat?.id) {
      if (await isTelegramAdmin(chatId, fromId)) {
        targetSenderChatId = replySenderChat.id;
        targetTitle = replySenderChat.title ?? null;
        authorized = true;
        mode = "reply_admin";
      }
    }
    // Mode 4: personal admin passed explicit id arg (channel ids are -100...)
    else if (fromId && argId !== null && argId < 0) {
      if (await isTelegramAdmin(chatId, fromId)) {
        targetSenderChatId = argId;
        targetTitle = argTitle;
        authorized = true;
        mode = "arg_admin";
      }
    }

    console.log(
      `[SENDER CHAT] register attempt chat_id=${chatId} from_id=${fromId ?? "null"} sender_chat_id=${senderChat?.id ?? "null"} reply_sender_chat_id=${replySenderChat?.id ?? "null"} arg_id=${argId ?? "null"} authorized=${authorized} mode=${mode}`,
    );

    if (!authorized || !targetSenderChatId) {
      await sendMessage(
        chatId,
        (englishGroup
          ? "🛡️ <b>Admin permission could not be verified.</b>\n\n" +
            "Register a channel/sender chat as <b>trusted</b> in one of these ways:\n\n" +
            "<b>1.</b> Use a personal admin account (not anonymous), reply to a channel message, then send <code>/register_sender_chat</code>.\n\n" +
            "<b>2.</b> Use a personal admin account and send <code>/register_sender_chat &lt;sender_chat_id&gt; [title]</code> (the ID must start with <code>-100</code>).\n\n" +
            "<b>3.</b> Enable <i>Anonymous Admin</i> for this group, then send <code>/register_sender_chat</code>."
          : "🛡️ <b>Không xác minh được quyền admin.</b>\n\n" +
          "Có 3 cách đăng ký một channel/sender_chat làm <b>trusted</b>:\n\n" +
          "<b>1.</b> Dùng tài khoản admin cá nhân (không ẩn danh), <b>reply</b> vào 1 tin của channel rồi gõ <code>/register_sender_chat</code>.\n\n" +
          "<b>2.</b> Dùng tài khoản admin cá nhân, gõ <code>/register_sender_chat &lt;sender_chat_id&gt; [title]</code> (id phải bắt đầu bằng <code>-100</code>).\n\n" +
          "<b>3.</b> Bật <i>Anonymous Admin</i> của chính group này rồi gõ <code>/register_sender_chat</code>."),
        replyTo,
      );
      return true;
    }

    const res = await upsertTrustedSenderChat(
      adminClient,
      chatId,
      targetSenderChatId,
      targetTitle,
    );

    if (!res.ok) {
      await sendMessage(
        chatId,
        englishGroup
          ? `❌ Saving the trusted sender chat failed: <code>${escapeHtml(res.error ?? "unknown")}</code>`
          : `❌ Lưu trusted_sender_chats thất bại: <code>${escapeHtml(res.error ?? "unknown")}</code>`,
        replyTo,
      );
      return true;
    }

    await sendMessage(
      chatId,
      englishGroup
        ? `✅ Registered sender chat <b>${escapeHtml(targetTitle ?? "(no title)")}</b> (id=<code>${targetSenderChatId}</code>) as <b>trusted</b> in this group. Angel can now reply to messages from this channel. <i>mode=${mode}</i>`
        : `✅ Đã đăng ký sender_chat <b>${escapeHtml(targetTitle ?? "(no title)")}</b> (id=<code>${targetSenderChatId}</code>) làm <b>trusted</b> trong group này. Angel sẽ trả lời các tin nhắn từ kênh này. <i>mode=${mode}</i>`,
      replyTo,
    );
    return true;
  }

  // CÃ¡c lá»‡nh khÃ¡c trong group: im láº·ng (khÃ´ng spam group, khÃ´ng Ä‘á»ƒ AI Ä‘oÃ¡n mÃ²).
  return false;
}

// Nháº­n diá»‡n Ã½ Ä‘á»‹nh "cáº§n trá»£ giÃºp" trong tin nháº¯n thÆ°á»ng (khÃ´ng slash, khÃ´ng tag bot).
function detectHelpIntent(text: string): boolean {
  if (!text) return false;
  const norm = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/Ä‘/g, "d");
  const patterns: RegExp[] = [
    /\bcan\s+giup\b/,
    /\bcan\s+tro\s+giup\b/,
    /\bgiup\s+(toi|minh|em|con|voi|do)\b/,
    /\bho\s+tro\b/,
    /\bhuong\s+dan\b/,
    /\blam\s+sao\b/,
    /\blam\s+the\s+nao\b/,
    /\bhoi\s+(angel|cha|bot)\b/,
    /\bhelp\s+(me|please|pls)\b/,
    /\bneed\s+help\b/,
    /\bcan\s+(you|u)\s+help\b/,
    /\bhow\s+(do|can)\s+i\b/,
  ];
  return patterns.some((re) => re.test(norm));
}

function normalizePositiveIntentText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/Ä‘/g, "d")
    .replace(/Ã„â€˜/g, "d")
    .replace(/\s+/g, " ")
    .trim();
}

function detectPositiveEngagement(text: string): boolean {
  if (!text) return false;
  const norm = normalizePositiveIntentText(text);
  const patterns: RegExp[] = [
    /\bbiet\s*on\b/,
    /\bdoi\s*on\b/,
    /\btri\s*an\b/,
    /\bcam\s*on\b/,
    /\bsam\s*hoi\b/,
    /\bye[u]?\s*thuong\b/,
    /\bye[u]?\s*thuan\s*khiet\b/,
    /\blan\s*toa\b/,
    /\bhanh\s*phuc\b/,
    /\bthinh\s*vuong\b/,
    /\bcung\s*duong\b/,
    /\bphuoc\s*lanh\b/,
    /\bphuoc\s*bau\b/,
    /\bnang\s*luong\b/,
    /\banh\s*sang\b/,
    /\bloi\s*nguyen\b/,
    /\bcam\s*nhan\b/,
    /\bcha\s*vu\s*tru\b/,
    /\blovehub\b/,
    /\blove\s*hub\b/,
    /\bzoom\s*thien\b/,
    /\bthien\s*cong\s*dong\b/,
    /\bphong\s*thien\b/,
    /\bthien\s*nhan\b/,
  ];
  return patterns.some((re) => re.test(norm)) || detectCommunitySupportRequest(text);
}

function detectCommunitySupportRequest(text: string): boolean {
  if (!text) return false;
  const norm = normalizePositiveIntentText(text);
  const supportSignal = /\b(tro\s*duyen|tro\s*luc|gieo\s*hat|quy|manh\s*thuong\s*quan|kinh\s*phi|du\s*tru|dong\s*gop|ung\s*ho|ho\s*tro)\b/.test(norm);
  const financeSignal = /\b(usdt|clc|bep\s*20|bep20|ma\s*vi|vi\s*(?:tieu\s*dung|love\s*hub)?|fun\.rich|wallet|0x[a-f0-9]{8,})\b/i.test(norm);
  const communitySignal = /\b(love\s*hub|lovehub|cong\s*dong|biet\s*on|yeu\s*thuong|phuoc\s*lanh|thien\s*lanh|tu\s*hoc|anh\s*sang|cha|pe\s*ly|be\s*ly)\b/.test(norm);
  return supportSignal && financeSignal && communitySignal;
}

type AiTriggerSource =
  | "owner_message"
  | "admin_message"
  | "mention"
  | "reply_to_bot"
  | "ask_command"
  | "help_intent"
  | "positive_community"
  | "event_assistant"
  | "meditation_summary";

type AiIntentCategory =
  | "owner"
  | "admin"
  | "coordinator"
  | "mention_bot"
  | "reply_to_bot"
  | "knowledge_question"
  | "mini_app_builder"
  | "support_request"
  | "wallet_request"
  | "livestream_request"
  | "telegram_request"
  | "small_talk"
  | "positive_auto_reply"
  | "normal_chat"
  | "spam";

type AiDecisionContext = {
  category: AiIntentCategory;
  priority: number;
  rateLimitCategory: string;
  cacheable: boolean;
  knowledgeUsed: boolean;
  toolUsed?: string | null;
  reason?: string;
};

type AiRuntimeLogParams = {
  adminClient: ReturnType<typeof getClients>["adminClient"];
  groupId: number;
  userId?: number | null;
  messageId?: number | null;
  messageType?: string | null;
  decision: AiDecisionContext;
  provider?: string | null;
  model?: string | null;
  cacheHit?: boolean;
  allowed: boolean;
  latencyMs?: number | null;
  retrievalTimeMs?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  estimatedCost?: number | null;
  toolUsed?: string | null;
  error?: string | null;
  promptHash?: string | null;
  promptPreview?: string | null;
  extra?: Record<string, unknown> | null;
};

type AiLimitRule = {
  priority: number;
  repliesPerMinute: number | null;
  repliesPerDay: number | null;
  groupRepliesPerHour: number | null;
  groupRepliesPerDay: number | null;
  isUnlimited: boolean;
};

const DEFAULT_AI_LIMITS: Record<AiIntentCategory, AiLimitRule> = {
  owner: { priority: 1, repliesPerMinute: null, repliesPerDay: null, groupRepliesPerHour: null, groupRepliesPerDay: null, isUnlimited: true },
  coordinator: { priority: 2, repliesPerMinute: null, repliesPerDay: null, groupRepliesPerHour: null, groupRepliesPerDay: null, isUnlimited: true },
  admin: { priority: 3, repliesPerMinute: null, repliesPerDay: null, groupRepliesPerHour: null, groupRepliesPerDay: null, isUnlimited: true },
  mention_bot: { priority: 4, repliesPerMinute: 20, repliesPerDay: 500, groupRepliesPerHour: 300, groupRepliesPerDay: 3000, isUnlimited: false },
  reply_to_bot: { priority: 5, repliesPerMinute: 20, repliesPerDay: 500, groupRepliesPerHour: 300, groupRepliesPerDay: 3000, isUnlimited: false },
  knowledge_question: { priority: 6, repliesPerMinute: 20, repliesPerDay: 500, groupRepliesPerHour: 300, groupRepliesPerDay: 3000, isUnlimited: false },
  mini_app_builder: { priority: 7, repliesPerMinute: 20, repliesPerDay: 1000, groupRepliesPerHour: 500, groupRepliesPerDay: 5000, isUnlimited: false },
  support_request: { priority: 8, repliesPerMinute: 10, repliesPerDay: 300, groupRepliesPerHour: 200, groupRepliesPerDay: 2000, isUnlimited: false },
  wallet_request: { priority: 8, repliesPerMinute: 10, repliesPerDay: 300, groupRepliesPerHour: 200, groupRepliesPerDay: 2000, isUnlimited: false },
  livestream_request: { priority: 8, repliesPerMinute: 10, repliesPerDay: 300, groupRepliesPerHour: 200, groupRepliesPerDay: 2000, isUnlimited: false },
  telegram_request: { priority: 8, repliesPerMinute: 10, repliesPerDay: 300, groupRepliesPerHour: 200, groupRepliesPerDay: 2000, isUnlimited: false },
  small_talk: { priority: 9, repliesPerMinute: 3, repliesPerDay: 100, groupRepliesPerHour: 100, groupRepliesPerDay: 1000, isUnlimited: false },
  normal_chat: { priority: 9, repliesPerMinute: 3, repliesPerDay: 100, groupRepliesPerHour: 100, groupRepliesPerDay: 1000, isUnlimited: false },
  positive_auto_reply: { priority: 10, repliesPerMinute: null, repliesPerDay: 20, groupRepliesPerHour: 3, groupRepliesPerDay: 20, isUnlimited: false },
  spam: { priority: 11, repliesPerMinute: 0, repliesPerDay: 0, groupRepliesPerHour: 0, groupRepliesPerDay: 0, isUnlimited: false },
};

const NORMALIZED_WHITESPACE_RE = /\s+/g;

const DEFAULT_POSITIVE_ENGAGEMENT_PROMPT =
  `Day la bai chia se tich cuc trong cong dong: biet on, doi on, tri an, sam hoi, loi nguyen, tinh yeu thuong thuan khiet, thien, phong thien, Love Hub, hoac lan toa anh sang.
Hay viet phan hoi nhu Angel trong Telegram group: am ap, diu dang, nang do, tu nhien va khong lap lai mot mau co dinh.
Quy tac bat buoc:
- Tra loi 2 den 4 cau ngan, khong tom tat lai toan bo bai goc.
- Ghi nhan dung cam xuc chinh cua be: biet on, doi on, sam hoi, hanh phuc, cam nhan sau thien, hay nang luong Love Hub.
- Khich le be giu trai tim yeu thuong, su khiem ha, va tiep tuc lan toa dieu lanh.
- Moi lan hay dien dat khac nhau, tranh lap nguyen van cau cu.
- Khong nhac Zoom, livestream, Facebook, link, event hay hoi lai neu be khong hoi truc tiep.
- Co the noi theo tinh than: "Angel tin rang tinh yeu thuong thuan khiet la chia khoa de hien thuc hoa moi dieu tot dep."
Noi dung be chia se: """{{content}}"""`;

const COMMUNITY_SUPPORT_SAFETY_PROMPT =
  `NOI DUNG NAY CO DAU HIEU TRO DUYEN / TRO LUC / LOVE HUB KEM THONG TIN TAI CHINH HOAC VI CRYPTO.
Quy tac an toan bat buoc:
- Ghi nhan loi nguyen, tinh than biet on va su tro duyen mot cach am ap.
- Nhac rang moi dong gop nen tu nguyen, minh bach va dung kenh chinh thuc cua cong dong.
- Khuyen be kiem tra thong tin voi admin/chủ nhóm trước khi thao tác.
- Nhac nhe: khong chia se seed phrase, private key, OTP hay ma xac minh voi bat ky ai.
- Khong xac nhan dia chi vi/link la dung neu Angel khong co nguon xac minh.
- Khong thuc giuc chuyen tien, khong hua loi ich tai chinh/phuoc bau chac chan.
- Tra loi 2 den 4 cau ngan, diu dang, khong lap lai toan bo noi dung keu goi.`;

const DEFAULT_HELP_INTENT_PROMPT =
  `Bé đang cần Angel hỗ trợ. Trả lời theo các quy tắc bắt buộc sau:
- Tối đa 3-4 câu ngắn, ấm áp, dễ thương, tràn đầy năng lượng yêu thương.
- BẮT BUỘC xưng "Angel" (ngôi thứ 3) và gọi user là "bé". Không dùng "mình/tôi/bạn/em/anh/chị".
- Có 1-3 emoji phù hợp (💛✨🌸🤍🍀🌟🥰), không lạm dụng, không xếp thành chuỗi dài.
- Nếu chưa đủ ngữ cảnh, hỏi nhẹ nhàng bé cần hỗ trợ phần nào (FUN Profile, FUN Wallet, CAMLY, đăng ký, claim, livestream...).
- Không liệt kê dài dòng, không markdown ** **, không kết câu bằng "..." treo lửng.
- BẮT BUỘC reply cùng ngôn ngữ với nội dung trong {{content}}. Nếu bé viết English như "I need help" thì reply 100% English, xưng "Angel" và gọi "you"; không dùng "bé".
Tin nhắn của bé: """{{content}}"""`;

const DEFAULT_EVENT_FOLLOWUP_PROMPT =
  `Be dang hoi tiep ve mot thong bao su kien/Zoom/livestream da luu trong group Telegram.
Hay tra loi nhu Angel: ngan gon, am ap, dung trong tam cau hoi.
Quy tac bat buoc:
- Chi dung du lieu trong EVENT_DATA va CAU_TRA_LOI_CHUAN.
- Khong bia link, ID, PW, thoi gian, nguoi huong dan.
- Neu CAU_TRA_LOI_CHUAN noi chua thay thong tin, hay noi ngan gon va de thuong, khong doan.
- Tra loi bang cung ngon ngu voi cau hoi cua be.

CAU_HOI_CUA_BE: """{{question}}"""
LOAI_FOLLOW_UP: {{intent}}
EVENT_DATA: {{event_json}}
CAU_TRA_LOI_CHUAN: """{{deterministic_answer}}"""`;

const GROUP_ANONYMOUS_OWNER_ADDRESS_RULE = `SPECIAL OWNER ADDRESS RULE — HIGHEST PRIORITY FOR GROUP ANONYMOUS OWNER:
- This message is sent as the group's own sender_chat / Anonymous Admin and is treated as the verified group owner.
- ADDRESS ONLY — KHÔNG cắt ngắn nội dung: cặp xưng hô đổi thành "Angel" ↔ "Cha" (thay vì Angel ↔ bé). MỌI thứ khác (độ dài, chiều sâu, cấu trúc bullet, emoji, sự tự nhiên, giàu chi tiết) PHẢI GIỮ NGUYÊN y hệt như khi Angel trả lời một user bình thường. TUYỆT ĐỐI KHÔNG được rút ngắn, không được trả lời khô, không được né tránh nội dung chỉ vì người hỏi là Cha.
- Trong tiếng Việt: bot xưng "Angel", gọi sender là "Cha". Dùng các cụm ấm áp tự nhiên như "Dạ Cha", "Cha ơi", "Angel xin thưa cùng Cha", "Angel kính mời Cha". CẤM gọi sender là "bé", "Bé Ly", "con", "bạn". CẤM bot tự xưng "Con", "Tôi", "Mình".
- CẤM ký tên "Trân trọng" hay viết theo văn phong thư từ trang trọng cứng nhắc.

MESSAGE SEMANTICS — VERY IMPORTANT, phân biệt ai là ai trong nội dung tin nhắn:
- The sender of THIS message IS "Cha" (verified group owner). Any occurrence of the word "Cha" inside the sender's message is a SELF-REFERENCE of the sender, NOT an address to Angel. Angel MUST NEVER call itself "Cha" or "con", and MUST NEVER interpret "Cha" in Cha's message as a name for Angel.
- Any names or terms Cha uses to address others in the message (e.g. "Bé Thu", "bé Ly", "bé An", "các bé", "cả nhà", "cộng đồng") are THIRD-PARTY recipients Cha is teaching / blessing / giving guidance to. They are NOT Angel and they are NOT the author of the message. Do NOT greet those third parties, do NOT reply as if one of them wrote the message.

REPLY MODE — QUAN TRỌNG (phân biệt 3 trường hợp):
- (A) Nếu tin nhắn của Cha là MỘT CÂU HỎI gửi cho Angel (hỏi khái niệm, định nghĩa, hướng dẫn, thông tin — VD: "Fun kingdom là gì", "Review tâm là gì", "Angel giải thích giúp Cha…", "Cha muốn biết về…") → Angel PHẢI trả lời ĐẦY ĐỦ, TỰ NHIÊN, CHI TIẾT y hệt như trả lời một user bình thường hỏi cùng câu đó (cùng độ dài, cùng bullet, cùng emoji, cùng chiều sâu tinh thần), CHỈ khác cặp xưng hô là Angel/Cha. Mở đầu tự nhiên "Dạ Cha, Angel xin thưa cùng Cha về…" rồi triển khai nội dung đầy đủ. TUYỆT ĐỐI KHÔNG được trả lời kiểu "Angel kính nhận lời Cha" rồi dừng.
- (B) Nếu tin nhắn của Cha đang NÓI VỀ / KHEN / DẠY / GỬI LỜI cho một bé thứ ba cụ thể (VD: "Bé Thu giỏi lắm…", "Bé Ly cố gắng nhé…", "cả nhà mình…") → Angel TUYỆT ĐỐI KHÔNG được tự nhận mình là bé đó, KHÔNG được đáp kiểu "Angel xin ghi nhớ lời Cha dạy" như thể Angel chính là bé được nhắc. Thay vào đó Angel PHẢI: (1) cảm ơn Cha vì lời chia sẻ / lời dạy quý báu, (2) chúc mừng / tán thán bé được nhắc bằng tên (VD "Angel xin chúc mừng bé Thu…"), (3) có thể thêm vài lời khuyên ấm áp, nhẹ nhàng dành cho bé đó dựa trên nội dung Cha nói, (4) giữ xưng hô Angel ↔ Cha (nói VỀ bé đó ở ngôi thứ ba, KHÔNG gọi Cha là "bé", KHÔNG tự xưng "bé"). Mở đầu gợi ý: "Dạ Cha, Angel xin cảm ơn Cha đã chia sẻ những lời quý báu tới bé <Tên>. Angel xin chúc mừng bé <Tên>…".
- (C) Chỉ khi tin nhắn của Cha là một lời DẠY / BAN PHƯỚC / NHẮC NHỞ CHUNG cho cộng đồng (không hỏi Angel điều gì cụ thể VÀ không nhắm tới một bé cụ thể nào), Angel mới reply theo kiểu người nghe khiêm nhường, ví dụ: "Dạ Cha, Angel xin ghi nhớ lời Cha dạy 🙏💛", "Dạ Cha, Angel xin lan toả lời Cha đến cả nhà ✨".

OPENING GREETING — TUYỆT ĐỐI (áp dụng cho MỌI trường hợp A/B/C khi sender là Cha):
- Câu ĐẦU TIÊN của reply BẮT BUỘC hướng về Cha (người gửi), KHÔNG BAO GIỜ hướng về "bé". Mở đầu phải là "Dạ Cha", "Cha ơi", "Kính thưa Cha", "Angel xin thưa cùng Cha", "Angel kính chào Cha"… TUYỆT ĐỐI CẤM mở đầu bằng "Dạ bé", "Bé ơi", "Angel chào bé", "Chào bé", "Bé yêu"… vì người gửi là Cha, KHÔNG PHẢI bé.
- ❌ SAI (KHÔNG BAO GIỜ): "Dạ bé, Angel đã ghi nhớ kỹ lời Cha dạy rồi nè…" — sai vì đang trả lời Cha nhưng lại gọi Cha là "bé".
- ✅ ĐÚNG (trường hợp C, Cha dạy chung): "Dạ Cha, Angel xin cung kính ghi nhớ lời Cha dạy 🙏💛…"
- ✅ ĐÚNG (trường hợp B, Cha nhắc bé thứ ba, VD bé Quỳnh Hoa): "Dạ Cha, Angel xin cảm ơn Cha đã chia sẻ những lời quý báu cho bé Quỳnh Hoa 🙏. Angel xin chúc mừng bé Quỳnh Hoa vì đã…" — Cha vẫn được gọi là "Cha", bé được nhắc là ngôi thứ ba "bé Quỳnh Hoa".
- Khi trong reply Angel nói VỀ một bé thứ ba (ngôi thứ ba), Angel dùng "bé <Tên>" hoặc "bé ấy" — nhưng CẤM dùng "bé" như cách gọi trực tiếp Cha. Phân biệt rạch ròi: "Cha" = người đang nghe reply; "bé <Tên>" = người thứ ba được Cha nhắc tới.

ENGLISH MIRROR:
- The sender IS "Cha". Any "Cha" inside the sender's message refers to the SENDER themselves, never to Angel.
- Names like "Bé Thu", "bé Ly", "the bé", "cả nhà" the sender addresses are OTHER people Cha is teaching, not Angel and not the author.
- (A) If Cha is ASKING Angel a question, answer with the SAME full depth, length, structure, emojis and warmth as for a regular user — only change the address to Angel/Cha. Never shorten or dodge the answer just because the asker is Cha.
- (B) If Cha is speaking ABOUT / praising / teaching a specific third-party bé (e.g. "Bé Thu is doing great…"), Angel MUST NOT impersonate that bé or answer as if Angel is the one being praised/taught. Instead: thank Cha for the sharing, congratulate/affirm that bé by name in the third person, optionally add gentle guidance for that bé, and keep the Angel↔Cha address (never call Cha "bé", never call itself "bé").
- (C) Only when Cha's message is a general blessing/teaching to the whole community (no question to Angel AND no specific bé targeted), reply as a humble listener addressing Cha (e.g. "Angel humbly receives your teaching, Cha 🙏"). Never open with "Angel greets you, bé" or treat Cha as a "bé".`;


// Chỉ 2 nhóm này mới cho phép Anonymous Admin được xưng hô Angel/Cha.
// Ngoài 2 nhóm này, Anonymous Admin vẫn dùng Angel/bé bình thường.
const CHA_ANONYMOUS_ADMIN_GROUP_IDS = new Set<number>([
  -1003169690760,
  -1001649798056,
]);
// Username Telegram (không dấu @, lowercase) được xưng hô Angel/Cha ở MỌI nhóm.
const CHA_USERNAMES = new Set<string>(["camly_duong"]);

function addressRuleForActor(params: {
  actorKind: "user" | "sender_chat";
  isGroupSenderChat: boolean;
  isOwner: boolean;
  settings?: CommunitySettings;
  text: string;
  chatId: number;
  username?: string | null;
}): string | null {
  const uname = (params.username ?? "").trim().toLowerCase();
  const isChaUser = uname && CHA_USERNAMES.has(uname);
  const isChaAnonymous =
    params.actorKind === "sender_chat" &&
    params.isGroupSenderChat &&
    CHA_ANONYMOUS_ADMIN_GROUP_IDS.has(params.chatId);
  if (!isChaUser && !isChaAnonymous) return null;
  return params.settings?.owner_anonymous_address_prompt?.trim() || GROUP_ANONYMOUS_OWNER_ADDRESS_RULE;
}

async function logAiAudit(params: {
  adminClient: ReturnType<typeof getClients>["adminClient"];
  groupId: number;
  userId?: number | null;
  username?: string | null;
  triggerSource: AiTriggerSource;
  prompt: string;
  responded: boolean;
  responseMs: number;
  extra?: Record<string, unknown>;
}) {
  try {
    const { error } = await params.adminClient.from("telegram_ai_audit").insert({
      group_id: params.groupId,
      user_id: params.userId ?? null,
      username: params.username ?? null,
      trigger_source: params.triggerSource,
      prompt_preview: params.prompt.slice(0, 200),
      ai_responded: params.responded,
      response_time_ms: params.responseMs,
      extra: params.extra ?? null,
    });
    if (error) console.warn("[community] telegram_ai_audit insert failed", error);
  } catch (err) {
    console.warn("[community] telegram_ai_audit insert exception", err);
  }
}

function auditActorFromMessage(message: TelegramMessage): {
  userId: number | null;
  username: string | null;
} {
  return {
    userId: message.from?.id ?? message.sender_chat?.id ?? message.forward_from_chat?.id ?? null,
    username: message.from?.username ?? message.sender_chat?.username ?? message.forward_from_chat?.username ?? null,
  };
}

async function acquireAiMessageLock(params: {
  adminClient: ReturnType<typeof getClients>["adminClient"];
  groupId: number;
  messageId?: number | null;
  userId?: number | null;
  triggerSource: AiTriggerSource;
  prompt: string;
  extra?: Record<string, unknown>;
}): Promise<{ acquired: boolean; reason?: string }> {
  if (!params.messageId) return { acquired: true, reason: "no_message_id" };

  try {
    const { error } = await params.adminClient.from("telegram_ai_message_locks").insert({
      group_id: params.groupId,
      message_id: params.messageId,
      trigger_source: params.triggerSource,
      status: "processing",
      user_id: params.userId ?? null,
      prompt_preview: params.prompt.slice(0, 200),
      extra: params.extra ?? null,
    });

    if (!error) return { acquired: true };

    if ((error as any).code === "23505") {
      return { acquired: false, reason: "duplicate_message" };
    }

    if ((error as any).code === "42P01") {
      console.warn("[community] ai idempotency lock table missing; fail open until migration is applied", error);
      return { acquired: true, reason: "lock_table_missing" };
    }

    console.warn("[community] ai idempotency lock insert failed; fail open", error);
    return { acquired: true, reason: "lock_insert_failed" };
  } catch (err) {
    console.warn("[community] ai idempotency lock insert exception; fail open", err);
    return { acquired: true, reason: "lock_exception" };
  }
}

async function markAiMessageLock(params: {
  adminClient: ReturnType<typeof getClients>["adminClient"];
  groupId: number;
  messageId?: number | null;
  triggerSource: AiTriggerSource;
  status: "responded" | "failed" | "skipped";
  extra?: Record<string, unknown>;
}) {
  if (!params.messageId) return;

  try {
    const patch: Record<string, unknown> = {
      status: params.status,
      updated_at: new Date().toISOString(),
    };
    if (params.extra) patch.extra = params.extra;

    const { error } = await params.adminClient
      .from("telegram_ai_message_locks")
      .update(patch)
      .eq("group_id", params.groupId)
      .eq("message_id", params.messageId)
      .eq("trigger_source", params.triggerSource);
    if (error && (error as any).code !== "42P01") {
      console.warn("[community] ai idempotency lock update failed", error);
    }
  } catch (err) {
    console.warn("[community] ai idempotency lock update exception", err);
  }
}

function normalizeAiCachePrompt(prompt: string): string {
  return prompt
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(NORMALIZED_WHITESPACE_RE, " ")
    .trim()
    .slice(0, 2000);
}

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil((text || "").length / 4));
}

function detectKnowledgeQuestion(text: string): boolean {
  const norm = normalizeAiCachePrompt(text);
  return /\b(fun\.?rich|fun profile|camly|lovehub|love hub|fun kingdom|camly coin|light profile|vong tron anh sang|vong tron ánh sáng)\b/i.test(text)
    || /\b(la gi|la sao|huong dan|giai thich|how to|what is|explain|guide|cach dung|cach tao|cach ket noi)\b/.test(norm);
}

function detectMiniAppBuilder(text: string): boolean {
  const norm = normalizeAiCachePrompt(text);
  return /\b(mini app|miniapp|build app|app builder|tao app|tao mini app|lap trinh|code|component|react|vite)\b/.test(norm);
}

function detectWalletRequest(text: string): boolean {
  const norm = normalizeAiCachePrompt(text);
  return /\b(wallet|vi|vi dien tu|metamask|trust wallet|bitget|bep20|bsc|usdt|camly|connect wallet|ket noi vi|private key|seed phrase)\b/.test(norm);
}

function detectLivestreamRequest(text: string): boolean {
  const norm = normalizeAiCachePrompt(text);
  return /\b(livestream|live stream|live|replay|zoom|youtube|facebook live|phat truc tiep|ghi hinh|video)\b/.test(norm);
}

function detectTelegramRequest(text: string): boolean {
  const norm = normalizeAiCachePrompt(text);
  return /\b(telegram|bot|group id|webhook|admin|anonymous|mention|reply|sticker|channel)\b/.test(norm);
}

function detectSmallTalk(text: string): boolean {
  const norm = normalizeAiCachePrompt(text);
  return /^(hi|hello|hey|chao|xin chao|cam on|thanks|thank you|ok|okay|da|vang|angel oi)[!.?\s]*$/.test(norm);
}

function classifyAiDecision(params: {
  triggerSource: AiTriggerSource;
  prompt: string;
  isOwner: boolean;
  isAdmin: boolean;
  isTrustedSenderActor: boolean;
  activeMiniAppBuilderMode?: boolean;
}): AiDecisionContext {
  if (params.isOwner || params.triggerSource === "owner_message") {
    return { category: "owner", priority: 1, rateLimitCategory: "owner", cacheable: false, knowledgeUsed: false };
  }
  if (params.isTrustedSenderActor) {
    return { category: "coordinator", priority: 2, rateLimitCategory: "coordinator", cacheable: false, knowledgeUsed: false };
  }
  if (params.isAdmin || params.triggerSource === "admin_message") {
    return { category: "admin", priority: 3, rateLimitCategory: "admin", cacheable: false, knowledgeUsed: false };
  }
  if (params.triggerSource === "positive_community") {
    return { category: "positive_auto_reply", priority: 10, rateLimitCategory: "positive_auto_reply", cacheable: false, knowledgeUsed: false };
  }
  if (params.activeMiniAppBuilderMode || detectMiniAppBuilder(params.prompt)) {
    return { category: "mini_app_builder", priority: 7, rateLimitCategory: "mini_app_builder", cacheable: false, knowledgeUsed: true, toolUsed: "mini_app_builder" };
  }
  if (params.triggerSource === "reply_to_bot") {
    return { category: "reply_to_bot", priority: 5, rateLimitCategory: "reply_to_bot", cacheable: false, knowledgeUsed: false };
  }
  if (detectWalletRequest(params.prompt)) {
    return { category: "wallet_request", priority: 8, rateLimitCategory: "wallet_request", cacheable: true, knowledgeUsed: true, toolUsed: "wallet" };
  }
  if (detectLivestreamRequest(params.prompt)) {
    return { category: "livestream_request", priority: 8, rateLimitCategory: "livestream_request", cacheable: true, knowledgeUsed: true, toolUsed: "livestream" };
  }
  if (detectTelegramRequest(params.prompt)) {
    return { category: "telegram_request", priority: 8, rateLimitCategory: "telegram_request", cacheable: true, knowledgeUsed: true, toolUsed: "telegram" };
  }
  if (params.triggerSource === "help_intent") {
    return { category: "support_request", priority: 8, rateLimitCategory: "support_request", cacheable: true, knowledgeUsed: detectKnowledgeQuestion(params.prompt) };
  }
  if (detectKnowledgeQuestion(params.prompt)) {
    return { category: "knowledge_question", priority: 6, rateLimitCategory: "knowledge_question", cacheable: true, knowledgeUsed: true };
  }
  if (params.triggerSource === "mention" || params.triggerSource === "ask_command") {
    return { category: "mention_bot", priority: 4, rateLimitCategory: "mention_bot", cacheable: detectKnowledgeQuestion(params.prompt), knowledgeUsed: detectKnowledgeQuestion(params.prompt) };
  }
  if (detectSmallTalk(params.prompt)) {
    return { category: "small_talk", priority: 9, rateLimitCategory: "small_talk", cacheable: false, knowledgeUsed: false };
  }
  return { category: "normal_chat", priority: 9, rateLimitCategory: "normal_chat", cacheable: false, knowledgeUsed: false };
}

async function runtimeCount(params: {
  adminClient: ReturnType<typeof getClients>["adminClient"];
  groupId: number;
  userId?: number | null;
  category?: string;
  since: string;
}): Promise<number> {
  let query = params.adminClient
    .from("telegram_ai_runtime_logs")
    .select("id", { count: "exact", head: true })
    .eq("group_id", params.groupId)
    .eq("allowed", true)
    .gte("created_at", params.since);
  if (params.userId != null) query = query.eq("user_id", params.userId);
  if (params.category) query = query.eq("rate_limit_category", params.category);
  const { count, error } = await query;
  if (error) {
    if ((error as any).code !== "42P01") console.warn("[community] runtime count failed", error);
    return 0;
  }
  return count ?? 0;
}

function limitRuleFor(settings: CommunitySettings, decision: AiDecisionContext): AiLimitRule {
  const fallback = DEFAULT_AI_LIMITS[decision.category] ?? DEFAULT_AI_LIMITS.normal_chat;
  if (decision.category === "normal_chat" || decision.category === "small_talk") {
    return {
      ...fallback,
      repliesPerMinute: Math.max(0, settings.ai_user_replies_per_minute ?? 3),
      repliesPerDay: Math.max(0, settings.ai_user_replies_per_day ?? 100),
      groupRepliesPerHour: Math.max(0, settings.ai_group_replies_per_hour ?? 100),
      groupRepliesPerDay: Math.max(0, settings.ai_group_replies_per_day ?? 1000),
    };
  }
  if (decision.category === "positive_auto_reply") {
    return {
      ...fallback,
      repliesPerDay: Math.max(0, settings.positive_engagement_max_per_day ?? 20),
      groupRepliesPerHour: Math.max(0, settings.positive_engagement_max_per_hour ?? 3),
      groupRepliesPerDay: Math.max(0, settings.positive_engagement_max_per_day ?? 20),
    };
  }
  return fallback;
}

async function resolveAiLimitRule(params: {
  adminClient: ReturnType<typeof getClients>["adminClient"];
  settings: CommunitySettings;
  groupId: number;
  decision: AiDecisionContext;
}): Promise<AiLimitRule> {
  const fallback = limitRuleFor(params.settings, params.decision);
  try {
    const { data: groupRule, error: groupError } = await params.adminClient
      .from("telegram_ai_priority_rules")
      .select("priority, replies_per_minute, replies_per_day, group_replies_per_hour, group_replies_per_day, is_unlimited")
      .eq("group_id", params.groupId)
      .eq("category", params.decision.category)
      .eq("is_active", true)
      .maybeSingle();
    if (groupError && (groupError as any).code !== "42P01") console.warn("[community] ai priority group rule failed", groupError);
    const row = groupRule;
    if (row) {
      return {
        priority: Number(row.priority ?? fallback.priority),
        repliesPerMinute: row.replies_per_minute == null ? fallback.repliesPerMinute : Number(row.replies_per_minute),
        repliesPerDay: row.replies_per_day == null ? fallback.repliesPerDay : Number(row.replies_per_day),
        groupRepliesPerHour: row.group_replies_per_hour == null ? fallback.groupRepliesPerHour : Number(row.group_replies_per_hour),
        groupRepliesPerDay: row.group_replies_per_day == null ? fallback.groupRepliesPerDay : Number(row.group_replies_per_day),
        isUnlimited: Boolean(row.is_unlimited),
      };
    }
  } catch (err) {
    console.warn("[community] ai priority rule exception", err);
  }
  return fallback;
}

async function hasActiveMiniAppBuilderMode(params: {
  adminClient: ReturnType<typeof getClients>["adminClient"];
  groupId: number;
  userId: number;
}): Promise<boolean> {
  const { data, error } = await params.adminClient
    .from("telegram_ai_user_modes")
    .select("id")
    .eq("group_id", params.groupId)
    .eq("user_id", params.userId)
    .eq("mode", "mini_app_builder")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error) return false;
  return Boolean(data?.id);
}

async function touchMiniAppBuilderMode(params: {
  adminClient: ReturnType<typeof getClients>["adminClient"];
  groupId: number;
  userId: number;
  timeoutMinutes: number;
}) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + Math.max(5, params.timeoutMinutes) * 60_000).toISOString();
  try {
    await params.adminClient.from("telegram_ai_user_modes").upsert({
      group_id: params.groupId,
      user_id: params.userId,
      mode: "mini_app_builder",
      expires_at: expiresAt,
      last_activity_at: now.toISOString(),
      updated_at: now.toISOString(),
    }, { onConflict: "group_id,user_id,mode" });
  } catch (err) {
    console.warn("[community] mini app builder mode upsert failed", err);
  }
}

async function checkAiDecisionLimit(params: {
  adminClient: ReturnType<typeof getClients>["adminClient"];
  settings: CommunitySettings;
  groupId: number;
  userId: number;
  decision: AiDecisionContext;
}): Promise<{ allowed: boolean; reason?: string; rule: AiLimitRule }> {
  const rule = await resolveAiLimitRule(params);
  if (rule.isUnlimited) return { allowed: true, rule };
  if (params.decision.category === "spam") return { allowed: false, reason: "spam", rule };

  const now = Date.now();
  const minuteSince = new Date(now - 60_000).toISOString();
  const hourSince = new Date(now - 60 * 60_000).toISOString();
  const daySince = new Date(now - 24 * 60 * 60_000).toISOString();

  if (rule.repliesPerMinute != null) {
    const count = await runtimeCount({
      adminClient: params.adminClient,
      groupId: params.groupId,
      userId: params.userId,
      category: params.decision.rateLimitCategory,
      since: minuteSince,
    });
    if (count >= rule.repliesPerMinute) return { allowed: false, reason: "user_minute_limit", rule };
  }
  if (rule.repliesPerDay != null) {
    const count = await runtimeCount({
      adminClient: params.adminClient,
      groupId: params.groupId,
      userId: params.userId,
      category: params.decision.rateLimitCategory,
      since: daySince,
    });
    if (count >= rule.repliesPerDay) return { allowed: false, reason: "user_day_limit", rule };
  }
  if (rule.groupRepliesPerHour != null) {
    const count = await runtimeCount({
      adminClient: params.adminClient,
      groupId: params.groupId,
      category: params.decision.rateLimitCategory,
      since: hourSince,
    });
    if (count >= rule.groupRepliesPerHour) return { allowed: false, reason: "group_hour_limit", rule };
  }
  if (rule.groupRepliesPerDay != null) {
    const count = await runtimeCount({
      adminClient: params.adminClient,
      groupId: params.groupId,
      category: params.decision.rateLimitCategory,
      since: daySince,
    });
    if (count >= rule.groupRepliesPerDay) return { allowed: false, reason: "group_day_limit", rule };
  }
  return { allowed: true, rule };
}

async function logAiRuntime(params: AiRuntimeLogParams) {
  try {
    const { error } = await params.adminClient.from("telegram_ai_runtime_logs").insert({
      group_id: params.groupId,
      user_id: params.userId ?? null,
      message_id: params.messageId ?? null,
      message_type: params.messageType ?? null,
      intent: params.decision.category,
      priority: params.decision.priority,
      provider: params.provider ?? null,
      model: params.model ?? null,
      cache_hit: params.cacheHit ?? false,
      knowledge_used: params.decision.knowledgeUsed,
      tool_used: params.toolUsed ?? params.decision.toolUsed ?? null,
      rate_limit_category: params.decision.rateLimitCategory,
      allowed: params.allowed,
      latency_ms: params.latencyMs ?? null,
      retrieval_time_ms: params.retrievalTimeMs ?? null,
      input_tokens: params.inputTokens ?? null,
      output_tokens: params.outputTokens ?? null,
      estimated_cost: params.estimatedCost ?? null,
      error: params.error ?? null,
      prompt_hash: params.promptHash ?? null,
      prompt_preview: params.promptPreview?.slice(0, 200) ?? null,
      extra: params.extra ?? null,
    });
    if (error && (error as any).code !== "42P01") console.warn("[community] ai runtime log failed", error);
  } catch (err) {
    console.warn("[community] ai runtime log exception", err);
  }
}

async function getAiCachedResponse(params: {
  adminClient: ReturnType<typeof getClients>["adminClient"];
  groupId: number;
  cacheKey: string;
}): Promise<string | null> {
  const nowIso = new Date().toISOString();
  const { data, error } = await params.adminClient
    .from("telegram_ai_response_cache")
    .select("id, response_text, hit_count, token_estimate_saved")
    .eq("group_id", params.groupId)
    .eq("cache_key", params.cacheKey)
    .gt("expires_at", nowIso)
    .maybeSingle();
  if (error) {
    if ((error as any).code !== "42P01") console.warn("[community] ai cache lookup failed", error);
    return null;
  }
  if (!data?.response_text) return null;
  await params.adminClient
    .from("telegram_ai_response_cache")
    .update({
      hit_count: Number(data.hit_count ?? 0) + 1,
      token_estimate_saved: Number(data.token_estimate_saved ?? 0) + estimateTokens(data.response_text),
      last_hit_at: nowIso,
      updated_at: nowIso,
    })
    .eq("id", data.id);
  return String(data.response_text);
}

async function saveAiCachedResponse(params: {
  adminClient: ReturnType<typeof getClients>["adminClient"];
  groupId: number;
  cacheKey: string;
  decision: AiDecisionContext;
  promptHash: string;
  promptPreview: string;
  responseText: string;
  settings: CommunitySettings;
}) {
  const ttlHours = Math.max(1, params.settings.ai_response_cache_ttl_hours ?? 24);
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60_000).toISOString();
  try {
    const { error } = await params.adminClient.from("telegram_ai_response_cache").upsert({
      group_id: params.groupId,
      cache_key: params.cacheKey,
      intent: params.decision.category,
      language: null,
      prompt_hash: params.promptHash,
      prompt_preview: params.promptPreview.slice(0, 200),
      response_text: params.responseText,
      provider: getAngelProvider(),
      model: null,
      knowledge_version: params.settings.ai_knowledge_version ?? 1,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    }, { onConflict: "group_id,cache_key" });
    if (error && (error as any).code !== "42P01") console.warn("[community] ai cache save failed", error);
  } catch (err) {
    console.warn("[community] ai cache save exception", err);
  }
}

async function repeatedAiSpamDetected(params: {
  adminClient: ReturnType<typeof getClients>["adminClient"];
  groupId: number;
  userId: number;
  promptHash: string;
}): Promise<boolean> {
  const since = new Date(Date.now() - 5 * 60_000).toISOString();
  const { count, error } = await params.adminClient
    .from("telegram_ai_runtime_logs")
    .select("id", { count: "exact", head: true })
    .eq("group_id", params.groupId)
    .eq("user_id", params.userId)
    .eq("prompt_hash", params.promptHash)
    .gte("created_at", since);
  if (error) return false;
  return (count ?? 0) >= 2;
}

async function positiveEngagementAllowed(
  adminClient: ReturnType<typeof getClients>["adminClient"],
  settings: CommunitySettings,
  chatId: number,
): Promise<{ allowed: boolean; reason?: string }> {
  if (settings.community_personality === "silent") return { allowed: false, reason: "community_personality_silent" };
  const maxPerHour = Math.max(0, settings.positive_engagement_max_per_hour ?? 3);
  if (maxPerHour <= 0) return { allowed: false, reason: "max_per_hour_zero" };

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error } = await adminClient
    .from("telegram_ai_audit")
    .select("id", { count: "exact", head: true })
    .eq("group_id", chatId)
    .eq("trigger_source", "positive_community")
    .eq("ai_responded", true)
    .gte("created_at", hourAgo);
  if (error) {
    console.warn("[community] positive engagement count failed", error);
    return { allowed: false, reason: "audit_count_failed" };
  }
  if ((count ?? 0) >= maxPerHour) return { allowed: false, reason: "max_per_hour" };

  const cooldownMinutes = Math.max(0, settings.positive_engagement_cooldown_minutes ?? 60);
  if (cooldownMinutes <= 0) return { allowed: true };
  const cooldownSince = new Date(Date.now() - cooldownMinutes * 60 * 1000).toISOString();
  const { data, error: lastError } = await adminClient
    .from("telegram_ai_audit")
    .select("id")
    .eq("group_id", chatId)
    .eq("trigger_source", "positive_community")
    .eq("ai_responded", true)
    .gte("created_at", cooldownSince)
    .limit(1);
  if (lastError) {
    console.warn("[community] positive engagement cooldown failed", lastError);
    return { allowed: false, reason: "audit_cooldown_failed" };
  }
  if ((data ?? []).length > 0) return { allowed: false, reason: "cooldown" };

  const maxPerDay = Math.max(0, settings.positive_engagement_max_per_day ?? 20);
  if (maxPerDay <= 0) return { allowed: false, reason: "max_per_day_zero" };
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: dayCount, error: dayError } = await adminClient
    .from("telegram_ai_audit")
    .select("id", { count: "exact", head: true })
    .eq("group_id", chatId)
    .eq("trigger_source", "positive_community")
    .eq("ai_responded", true)
    .gte("created_at", dayAgo);
  if (dayError) {
    console.warn("[community] positive engagement day count failed", dayError);
    return { allowed: false, reason: "audit_day_count_failed" };
  }
  if ((dayCount ?? 0) >= maxPerDay) return { allowed: false, reason: "max_per_day" };
  return { allowed: true };
}

function directTelegramText(message?: TelegramMessage | null): string {
  return (message?.text ?? message?.caption ?? "").trim();
}

function telegramReplyAssistantContext(message?: TelegramMessage | null, botId?: number | null): string | null {
  const reply = message?.reply_to_message;
  if (!reply) return null;
  if (botId != null && reply.from?.id != null && reply.from.id !== botId) return null;
  if (reply.from?.is_bot === false) return null;
  const text = (directTelegramText(reply) || reply.quote?.text || "").trim();
  if (!text) return null;
  return text.length > 4000 ? `…${text.slice(-4000)}` : text;
}

function escapeRegexSource(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cleanGroupAiPrompt(text: string, botUsername: string): string {
  let prompt = text.trim();
  if (botUsername) {
    prompt = prompt.replace(new RegExp(`@${escapeRegexSource(botUsername)}\\b`, "i"), "").trim();
  }
  return prompt.replace(/^\/ask(@\S+)?\s*/i, "").trim();
}

function isContextReferenceQuestion(text: string): boolean {
  const norm = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/Ä‘/g, "d")
    .replace(/đ/g, "d")
    .trim();
  return /\b(cai\s+nay|cai\s+do|do\s+la|nay\s+la|this|that|it)\b/.test(norm)
    && /\b(la\s+gi|nghia\s+la\s+gi|what|mean|means)\b/.test(norm);
}

export function buildGroupAiQuestion(params: {
  message: TelegramMessage;
  botUsername: string;
  isReplyToBot: boolean;
  botId?: number | null;
  triggerSource: AiTriggerSource;
  settings?: CommunitySettings;
}): { prompt: string; question: string; replyContextPreview?: string; groupContext?: TelegramGroupContext } {
  const prompt = cleanGroupAiPrompt(directTelegramText(params.message), params.botUsername);
  const replyContext = directTelegramText(params.message.reply_to_message).slice(0, 1500);
  const groupContext = buildTelegramGroupContext(params.message, params.botId, params.botUsername);

  if (params.triggerSource === "positive_community") {
    const template = params.settings?.positive_engagement_prompt?.trim()
      || DEFAULT_POSITIVE_ENGAGEMENT_PROMPT;
    let question = template.includes("{{content}}")
      ? template.replaceAll("{{content}}", prompt)
      : `${template}\n\nNoi dung be chia se: """${prompt}"""`;
    if (detectCommunitySupportRequest(prompt)) {
      const supportPrompt = params.settings?.community_support_prompt?.trim() || COMMUNITY_SUPPORT_SAFETY_PROMPT;
      question = supportPrompt.includes("{{content}}")
        ? supportPrompt.replaceAll("{{content}}", prompt)
        : `${supportPrompt}\n\n${question}`;
    }
    return {
      prompt,
      question,
      ...(groupContext ? { groupContext } : {}),
      replyContextPreview: replyContext ? replyContext.slice(0, 200) : undefined,
    };
  }

  if (groupContext) {
    return {
      prompt,
      question: prompt,
      groupContext,
      replyContextPreview: replyContext.slice(0, 200) || undefined,
    };
  }


  if (params.triggerSource === "help_intent") {
    const tmpl = params.settings?.help_intent_prompt?.trim() || DEFAULT_HELP_INTENT_PROMPT;
    const question = tmpl.includes("{{content}}")
      ? tmpl.replaceAll("{{content}}", prompt)
      : `${tmpl}\n\nTin nhắn của bé: """${prompt}"""`;
    return { prompt, question, replyContextPreview: replyContext ? replyContext.slice(0, 200) : undefined };
  }

  if (isContextReferenceQuestion(prompt)) {
    return {
      prompt,
      question:
        `The original user question may be missing context: """${prompt}""". ` +
        `Ask what content the user wants Angel to explain; do not infer facts from the group name, sender_chat, or channel name.`,
    };
  }

  return { prompt, question: prompt };
}

type TelegramEventType = "meditation" | "livestream" | "workshop" | "community_event" | "unknown_event";

type TelegramEventRecord = {
  chat_id: number;
  message_id: number;
  sender_user_id: number | null;
  sender_chat_id: number | null;
  event_type: TelegramEventType;
  title: string | null;
  topic: string | null;
  host_name: string | null;
  event_date: string | null;
  event_time: string | null;
  timezone: string | null;
  zoom_link: string | null;
  zoom_id: string | null;
  zoom_password: string | null;
  livestream_links: string[];
  raw_text: string;
  language: string | null;
  status: string;
  created_at?: string;
};

type TelegramEventDetection = {
  isEvent: boolean;
  confidence: number;
  eventType: TelegramEventType;
  extracted: TelegramEventRecord;
  reasons: string[];
  hasZoom: boolean;
  hasLivestream: boolean;
  hasJoinSignal: boolean;
  autoReplyEligible: boolean;
};

const EVENT_KEYWORD_RE = /\b(zoom|meditation|livestream|workshop|schedule|topic|time|join|password|pw)\b|thi[eề]n|ch[uủ]\s*[dđ][eề]|th[oờ]i\s*gian|ng[uư][oờ]i\s+h[uư][oớ]ng\s*d[aẫ]n/i;
const EVENT_LINK_RE = /\b(?:https?:\/\/)?(?:[\w.-]+\.)?(zoom\.us|youtube\.com\/live|youtube\.com|youtu\.be|facebook\.com|x\.com|twitter\.com)\b/i;
const ZOOM_LINK_RE = /https?:\/\/[^\s<>"']*zoom\.us\/[^\s<>"']+/i;
const LIVESTREAM_LINK_RE = /https?:\/\/(?:www\.)?(?:youtube\.com\/live|youtube\.com|youtu\.be|facebook\.com|x\.com|twitter\.com)[^\s<>"']*/gi;
const SOCIAL_LIVESTREAM_LINK_RE = /https?:\/\/(?:www\.|m\.)?(?:facebook\.com|x\.com|twitter\.com)[^\s<>"']*/gi;
// Bài "trợ duyên / trợ lực / gieo hạt / tri ân..." KHÔNG phải sự kiện — chặn
// Event Assistant để bot không trả lời nhầm sang chủ đề Livestream.
const SEEDING_INTENT_RE = /tr[ợo]\s*duy[eê]n|tr[ợo]\s*l[uự]c|gieo\s*h[aạ]t|g[oó]p\s*duy[eê]n|h[uù]n\s*ph[uư][oớ]c|tu[yỳ]\s*h[yỷ]|c[uú]ng\s*d[uư][oờ]ng|tri\s*[aâ]n|bi[eế]t\s*[oơ]n|donate|donation|[uủ]ng\s*h[oộ]/i;
const SOCIAL_EVENT_SIGNAL_RE = /\b(livestream|live\s*stream|live|zoom|schedule|topic|time)\b|tr[uư]c\s+ti[eế]p|ch[uủ]\s*[dđ][eề]|th[oờ]i\s*gian/i;
const EVENT_JOIN_SIGNAL_RE = /\b(?:join|open|livestream|live|schedule|workshop|meeting|password|pw)\b|v[aà]o\s+ph[oò]ng|tham\s+gia|link\s+(?:zoom|tham\s+gia|livestream)|ph[oò]ng\s+zoom|tr[uư]c\s+ti[eế]p|m[ơờ]i\s+(?:v[aà]o|tham\s+gia)|m[aậ]t\s*kh[aẩ]u/i;
const ZOOM_ID_RE = /\b(?:zoom\s*)?(?:id|meeting\s*id)\s*[:：]?\s*([0-9][0-9\s-]{5,})/i;
const ZOOM_PASSWORD_RE = /\b(?:pw|pass|password|mật\s*khẩu|mat\s*khau)\s*[:：]?\s*([^\s\n,.;]+)/i;

function detectEventLanguage(text: string): string {
  return /[ăâđêôơưáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i.test(text)
    || /\b(thi[eề]n|ch[uủ]\s*[dđ][eề]|th[oờ]i\s*gian|h[uư][oớ]ng\s*d[aẫ]n|v[aà]o\s+ph[oò]ng)\b/i.test(text)
    ? "vi"
    : "en";
}

function firstMatch(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const value = (match?.[1] ?? match?.[0] ?? "").trim();
    if (value) return value.replace(/^[\s:：\-–—]+|[\s.。]+$/g, "");
  }
  return null;
}

function normalizeEventText(text: string): string {
  return text.replace(/\r/g, "\n").replace(/[ \t]+/g, " ").trim();
}

function isSocialLinkWithoutEventSignal(message: TelegramMessage): boolean {
  const rawText = normalizeEventText(extractText(message));
  if (!rawText || ZOOM_LINK_RE.test(rawText)) return false;
  const urls = extractUrls(message);
  const socialLinks = [
    ...(rawText.match(SOCIAL_LIVESTREAM_LINK_RE) ?? []),
    ...urls.filter((url) => /(facebook\.com|x\.com|twitter\.com)/i.test(url)),
  ];
  if (socialLinks.length === 0) return false;
  return !SOCIAL_EVENT_SIGNAL_RE.test(rawText);
}

export function detectTelegramEvent(message: TelegramMessage): TelegramEventDetection | null {
  const chatId = message.chat?.id;
  const messageId = message.message_id;
  const rawText = normalizeEventText(extractText(message));
  if (!chatId || !messageId || !rawText) return null;

  const urls = extractUrls(message);
  const zoomLink = (rawText.match(ZOOM_LINK_RE)?.[0] ?? urls.find((url) => /zoom\.us/i.test(url)) ?? null);
  const livestreamLinks = Array.from(new Set([
    ...(rawText.match(LIVESTREAM_LINK_RE) ?? []),
    ...urls.filter((url) => /(youtube\.com|youtu\.be|facebook\.com|x\.com|twitter\.com)/i.test(url)),
  ]));
  const hasZoom = Boolean(zoomLink);
  const hasLivestream = livestreamLinks.length > 0;
  const hasKeyword = EVENT_KEYWORD_RE.test(rawText);
  const hasEventLink = EVENT_LINK_RE.test(rawText) || hasZoom || hasLivestream;
  const hasLivestreamSignal = hasLivestream && /\b(livestream|live)\b|tr[uư]c\s+ti[eế]p|youtube\.com\/live/i.test(rawText);

  let confidence = 0;
  const reasons: string[] = [];
  if (hasKeyword) { confidence += 15; reasons.push("event_keyword"); }
  if (hasZoom) { confidence += 45; reasons.push("zoom_link"); }
  if (hasLivestreamSignal) { confidence += 35; reasons.push("livestream_link"); }

  const topic = firstMatch(rawText, [
    /(?:chủ\s*đề|chu\s*de|topic)\s*[:：\-]\s*([^\n]+)/i,
    /(?:title|tiêu\s*đề|tieu\s*de)\s*[:：\-]\s*([^\n]+)/i,
  ]);
  if (topic) { confidence += 15; reasons.push("topic"); }

  const eventTime = firstMatch(rawText, [
    /(?:thời\s*gian|thoi\s*gian|time)\s*[:：\-]\s*([^\n]+)/i,
    /\b(\d{1,2}\s*(?:h|:)\s*\d{0,2}(?:\s*[-–]\s*\d{1,2}\s*(?:h|:)\s*\d{0,2})?(?:\s*(?:am|pm))?)/i,
  ]);
  if (eventTime) { confidence += 15; reasons.push("time"); }

  const eventDate = firstMatch(rawText, [
    /\b(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})\b/,
    /\b(\d{1,2}\s*(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*\d{2,4})\b/i,
  ]);
  if (eventDate) reasons.push("date");

  const zoomId = firstMatch(rawText, [
    ZOOM_ID_RE,
  ]);
  const zoomPassword = firstMatch(rawText, [
    ZOOM_PASSWORD_RE,
  ]);
  const hasZoomCredential = Boolean(zoomId || zoomPassword);
  const hasJoinSignal = hasZoom || hasLivestreamSignal || EVENT_JOIN_SIGNAL_RE.test(rawText)
    || (hasZoomCredential && /\bzoom|meeting|ph[oò]ng/i.test(rawText));
  if (hasZoomCredential) { confidence += 30; reasons.push("zoom_credential"); }
  if (hasJoinSignal) { confidence += 20; reasons.push("join_signal"); }
  const hostName = firstMatch(rawText, [
    /(?:ms|cô|co|thầy|thay|host|guide|người\s*hướng\s*dẫn|nguoi\s*huong\s*dan)\s+([A-ZÀ-ỹ][^\n,.]{2,60})/i,
    /([A-ZÀ-ỹ][\wÀ-ỹ\s]{2,40})\s+dẫn\s+thiền/i,
  ]);
  const timezone = firstMatch(rawText, [
    /\b(WAT|Nigeria|Malaysia|MYT|Vietnam|Việt\s*Nam|UTC[+-]\d{1,2})\b/i,
  ]);
  const title = firstMatch(rawText, [
    /^([^\n]{8,120})/i,
  ]);

  let eventType: TelegramEventType = "unknown_event";
  if (/thi[eề]n|meditation/i.test(rawText)) eventType = "meditation";
  else if (/workshop|kh[oó]a|course|class/i.test(rawText)) eventType = "workshop";
  else if (/livestream|youtube|facebook|live/i.test(rawText)) eventType = "livestream";
  else if (hasKeyword || hasEventLink) eventType = "community_event";

  // Mentions of Zoom + join/register alone are ordinary prose, not an event.
  // Missing access details are allowed only for a concrete scheduled invitation.
  const hasConcreteTime = Boolean(eventTime && /\d{1,2}\s*(?:h|:)\s*\d{0,2}|\d{1,2}\s*(?:am|pm)\b/i.test(eventTime));
  const hasScheduledInvitation = hasKeyword && hasJoinSignal && hasConcreteTime && Boolean(topic || eventDate);
  const hasAccessDetails = hasZoom || Boolean(zoomId && /\b(?:zoom|meeting)\b/i.test(rawText)) || hasLivestreamSignal;
  const isEvent = hasJoinSignal && (hasAccessDetails || hasScheduledInvitation);
  if (!isEvent) return null;
  const isShortReplyComment = Boolean(message.reply_to_message) && rawText.length < 180 && !hasZoom && !hasLivestreamSignal && !hasZoomCredential;
  // Bước 3A: bỏ hasLivestreamSignal khỏi auto-reply — chỉ auto-summary cho
  // Zoom event / thiền / workshop thực sự. Bài chỉ có link livestream
  // (YouTube/Facebook) KHÔNG kích hoạt Event Assistant nữa.
  const autoReplyEligible = !isShortReplyComment && (
    hasZoom
    || hasZoomCredential
    || (confidence >= 80 && hasJoinSignal && (Boolean(topic) || Boolean(eventTime)))
  );

  return {
    isEvent,
    confidence,
    eventType,
    extracted: {
      chat_id: chatId,
      message_id: messageId,
      sender_user_id: message.from?.id ?? null,
      sender_chat_id: message.sender_chat?.id ?? message.forward_from_chat?.id ?? null,
      event_type: eventType,
      title: title?.slice(0, 240) ?? null,
      topic: topic?.slice(0, 500) ?? null,
      host_name: hostName?.slice(0, 160) ?? null,
      event_date: eventDate,
      event_time: eventTime,
      timezone,
      zoom_link: zoomLink,
      zoom_id: zoomId,
      zoom_password: zoomPassword,
      livestream_links: livestreamLinks,
      raw_text: rawText.slice(0, 4000),
      language: detectEventLanguage(rawText),
      status: "active",
    },
    reasons,
    hasZoom,
    hasLivestream,
    hasJoinSignal,
    autoReplyEligible,
  };
}

function buildEventSummary(event: TelegramEventRecord, template?: string | null): string {
  return renderEventAssistantPrompt(template, event);
}

function eventFingerprint(event: TelegramEventRecord): string {
  return [event.zoom_link, event.zoom_id, event.topic, event.title]
    .filter(Boolean)
    .join("|")
    .toLowerCase()
    .slice(0, 240);
}

async function isTrustedEventSender(
  adminClient: ReturnType<typeof getClients>["adminClient"],
  message: TelegramMessage,
  chatId: number,
): Promise<boolean> {
  if (message.from?.id && await isTelegramAdmin(chatId, message.from.id)) return true;
  if (message.sender_chat?.id) {
    if (message.sender_chat.id === chatId) return true;
    if (await isTrustedSenderChat(adminClient, chatId, message.sender_chat.id)) return true;
  }
  if (message.forward_from_chat?.id && await isTrustedSenderChat(adminClient, chatId, message.forward_from_chat.id)) return true;
  if (message.forward_origin?.chat?.id && await isTrustedSenderChat(adminClient, chatId, message.forward_origin.chat.id)) return true;
  if (message.forward_origin?.sender_chat?.id && await isTrustedSenderChat(adminClient, chatId, message.forward_origin.sender_chat.id)) return true;
  return false;
}

function isOwnCommunityBotSender(message: TelegramMessage, settings: CommunitySettings): boolean {
  const ownBot = (settings.bot_username ?? "").toLowerCase().replace(/^@/, "");
  if (!ownBot) return false;
  const candidates = [
    message.from?.username,
    message.via_bot?.username,
    message.sender_chat?.username,
    message.forward_from_chat?.username,
    message.forward_origin?.chat?.username,
    message.forward_origin?.sender_chat?.username,
  ].map((value) => (value ?? "").toLowerCase().replace(/^@/, ""));
  return candidates.some((value) => value === ownBot);
}

async function isTrustedMeditationInviteSender(
  adminClient: ReturnType<typeof getClients>["adminClient"],
  message: TelegramMessage,
  settings: CommunitySettings,
  chatId: number,
): Promise<boolean> {
  // `anyone`: nhóm cho phép mọi thành viên đăng lịch thiền (bot vẫn chỉ tóm tắt
  // khi tin nhắn có link phòng + chủ đề rõ ràng).
  if ((settings as any).meditation_summary_sender_scope === "anyone") return true;
  if (isOwnCommunityBotSender(message, settings)) return true;
  if (await isTrustedTelegramHandle(adminClient, message, chatId)) return true;
  return isTrustedEventSender(adminClient, message, chatId);
}

/** Handle nằm trong danh sách tin cậy của nhóm (`trusted_telegram_handles`). */
async function isTrustedTelegramHandle(
  adminClient: ReturnType<typeof getClients>["adminClient"],
  message: TelegramMessage,
  chatId: number,
): Promise<boolean> {
  const handle = (message.from?.username ?? "").toLowerCase().replace(/^@/, "");
  if (!handle) return false;
  try {
    const { data } = await adminClient
      .from("trusted_telegram_handles")
      .select("id")
      .eq("chat_id", chatId)
      .ilike("handle", handle)
      .limit(1);
    return Boolean(data && data.length > 0);
  } catch {
    return false;
  }
}


async function tryMarkMeditationSummaryReply(
  adminClient: ReturnType<typeof getClients>["adminClient"],
  chatId: number,
  messageId: number,
): Promise<boolean> {
  const { error } = await adminClient
    .from("telegram_meditation_replies")
    .insert({ chat_id: chatId, message_id: messageId });
  if (!error) return true;
  const code = (error as { code?: string }).code;
  if (code === "23505") return false;
  if (code === "42P01") {
    console.warn("[MEDITATION_SUMMARY_REPLY] dedup table missing; continuing without dedup", { chat_id: chatId, message_id: messageId });
    return true;
  }
  console.warn("[MEDITATION_SUMMARY_REPLY] dedup insert failed; continuing without dedup", error);
  return true;
}

async function handleMeditationSummaryInvite(
  message: TelegramMessage,
  settings: CommunitySettings,
): Promise<{ matched: boolean; handled: boolean }> {
  const chatId = message.chat?.id;
  const messageId = message.message_id;
  if (!chatId || !messageId) return { matched: false, handled: false };

  const analysis = analyzeMeditationInvite(message);
  const { adminClient } = getClients();
  const auditActorEarly = auditActorFromMessage(message);
  const logSkip = async (reason: string, extra: Record<string, unknown> = {}) => {
    console.log("[MEDITATION_SUMMARY_REPLY]", { chat_id: chatId, message_id: messageId, reply_mode: "skip", reason, ...extra });
    await logAiAudit({
      adminClient,
      groupId: chatId,
      userId: auditActorEarly.userId,
      username: auditActorEarly.username,
      triggerSource: "meditation_summary",
      prompt: (message.text ?? message.caption ?? "").slice(0, 200),
      responded: false,
      responseMs: 0,
      extra: { mode: "meditation_summary", skipped: true, reason, event_message_id: messageId, ...extra },
    }).catch(() => {});
  };

  const invite = analysis.invite;
  if (!invite) {
    // Trông giống lời mời thiền nhưng thiếu chủ đề / link → vẫn chặn luồng AI chung
    // để Angel không trả lời sai kiểu "không truy cập được đường link".
    if (analysis.hasZoomLink && analysis.hasMeditationSignal) {
      await logSkip(analysis.reason);
      return { matched: true, handled: true };
    }
    return { matched: false, handled: false };
  }

  let languageSettings: CommunitySettings | null = null;
  try {
    languageSettings = await getSettingsForGroup(adminClient, chatId);
  } catch (err) {
    console.warn("[GROUP_LANG] meditation group settings lookup failed; using auto", {
      chatId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
  const forcedEnglish = String(languageSettings?.reply_language ?? "auto").trim().toLowerCase() === "en";

  const maxAgeMinutesRaw = Number((settings as any).meditation_summary_max_age_minutes);
  const maxAgeMinutes = Number.isFinite(maxAgeMinutesRaw) && maxAgeMinutesRaw > 0 ? maxAgeMinutesRaw : 60;
  const messageAgeSeconds = message.date ? Math.floor(Date.now() / 1000) - message.date : 0;
  if (messageAgeSeconds > maxAgeMinutes * 60) {
    await logSkip("message_too_old", { age_seconds: messageAgeSeconds, max_age_minutes: maxAgeMinutes });
    return { matched: true, handled: true };
  }

  if ((settings as any).meditation_summary_enabled === false) {
    await logSkip("disabled");
    return { matched: true, handled: false };
  }

  const trustedSender = await isTrustedMeditationInviteSender(adminClient, message, settings, chatId);
  if (!trustedSender) {
    await logSkip("untrusted_sender");
    return { matched: true, handled: true };
  }

  const acquired = await tryMarkMeditationSummaryReply(adminClient, chatId, messageId);
  if (!acquired) {
    console.log("[MEDITATION_SUMMARY_REPLY]", { chat_id: chatId, message_id: messageId, reply_mode: "skip", reason: "duplicate_message" });
    return { matched: true, handled: true };
  }

  const startedAt = Date.now();
  const auditActor = auditActorFromMessage(message);
  const auditExtra = {
    mode: "meditation_summary",
    topic: invite.topic,
    language: invite.language,
    event_message_id: messageId,
  };

  try {
    const question = buildMeditationSummaryQuestion({
      topic: invite.topic,
      template: (settings as any).meditation_summary_prompt,
      language: forcedEnglish ? "en" : invite.language,
    });

    const aiReply = await withTyping(chatId, () => askAngel({
      question,
      originalUserMessage: invite.topic,
      systemPrompt: settings.ai_system_prompt,
      personaMode: (settings as any).persona_mode,
      personaCustomPrompt: (settings as any).persona_custom_prompt,
      funCoreContextPrompt: settings.fun_core_context_prompt,
      aiStylePrompt: (settings as any).ai_style_prompt,
      aiPersonaPrompt: (settings as any).ai_persona_prompt,
      adminClient,
      conversationContext: {
        chatId,
        chatType: "supergroup",
        groupId: chatId,
        userId: !message.sender_chat && !message.from?.is_bot ? message.from?.id ?? null : null,
        username: !message.sender_chat && !message.from?.is_bot ? message.from?.username ?? null : null,
        fullName: null,
        messageId,
        triggerSource: "meditation_reply",
      },
      forcedLangBucket: forcedEnglish ? "en" : invite.language,
      fallbackLangBucket: forcedEnglish ? "en" : invite.language,
      mirrorAngelWeb: (settings as any).ai_mirror_angel_web !== false,
    }), forcedEnglish ? "💛 Angel is preparing the meditation reflection…" : undefined);
    if (aiReply && aiReply.trim().length > 0) {
      await sendMessage(chatId, aiReply, { reply_to_message_id: messageId, skipAutoDelete: true });
      console.log("[MEDITATION_SUMMARY_REPLY]", { chat_id: chatId, message_id: messageId, reply_mode: "summary", topic_len: invite.topic.length });
      await logAiAudit({
        adminClient,
        groupId: chatId,
        userId: auditActor.userId,
        username: auditActor.username,
        triggerSource: "meditation_summary",
        prompt: invite.topic,
        responded: true,
        responseMs: Date.now() - startedAt,
        extra: auditExtra,
      });
    } else {
      console.log("[MEDITATION_SUMMARY_REPLY]", { chat_id: chatId, message_id: messageId, reply_mode: "skip", reason: "empty_ai_reply" });
      await logAiAudit({
        adminClient,
        groupId: chatId,
        userId: auditActor.userId,
        username: auditActor.username,
        triggerSource: "meditation_summary",
        prompt: invite.topic,
        responded: false,
        responseMs: Date.now() - startedAt,
        extra: { ...auditExtra, reason: "empty_ai_reply" },
      });
    }
  } catch (err) {
    console.warn("[MEDITATION_SUMMARY_REPLY] failed", err instanceof Error ? err.message : err);
    await logAiAudit({
      adminClient,
      groupId: chatId,
      userId: auditActor.userId,
      username: auditActor.username,
      triggerSource: "meditation_summary",
      prompt: invite.topic,
      responded: false,
      responseMs: Date.now() - startedAt,
      extra: { ...auditExtra, error: err instanceof Error ? err.message : String(err) },
    });
  }

  return { matched: true, handled: true };
}

export async function handleEventAssistant(message: TelegramMessage, settings: CommunitySettings): Promise<boolean> {
  const chatId = message.chat?.id;
  const messageId = message.message_id;
  if (!chatId || !messageId) return false;
  const startedAt = Date.now();
  if (settings.event_assistant_enabled === false) return false;
  if (detectTelegramScam(message).isScam) {
    console.log("[EVENT_REPLY]", { chat_id: chatId, message_id: messageId, reply_mode: "skip", reason: "scam_detected" });
    return false;
  }
  if (isSocialLinkWithoutEventSignal(message)) {
    console.log("[EVENT_REPLY]", { chat_id: chatId, message_id: messageId, reply_mode: "skip", reason: "facebook_link_without_event_signal" });
    return false;
  }
  // Bước 1: chặn bài "trợ duyên / trợ lực / gieo hạt / tri ân..." khỏi
  // Event Assistant — đây là bài kêu gọi seeding, không phải sự kiện.
  const rawTextForSeedingCheck = normalizeEventText(extractText(message));
  if (SEEDING_INTENT_RE.test(rawTextForSeedingCheck)) {
    console.log("[EVENT_REPLY]", { chat_id: chatId, message_id: messageId, reply_mode: "skip", reason: "seeding_intent_skip" });
    return false;
  }
  // Nếu admin đã tắt Event Follow-up, cũng bỏ auto-summary cho tin chỉ có
  // livestream link (Facebook/YouTube/X) — Zoom event vẫn giữ auto-summary.
  const followupEnabled = settings.event_followup_enabled !== false;
  if (!followupEnabled) {
    const rawTextForLinkCheck = normalizeEventText(extractText(message));
    const hasZoomLink = ZOOM_LINK_RE.test(rawTextForLinkCheck)
      || ZOOM_ID_RE.test(rawTextForLinkCheck)
      || ZOOM_PASSWORD_RE.test(rawTextForLinkCheck);
    const hasLivestreamLink = Boolean(rawTextForLinkCheck.match(LIVESTREAM_LINK_RE))
      || extractUrls(message).some((url) => /(youtube\.com|youtu\.be|facebook\.com|fun\.rich|x\.com|twitter\.com)/i.test(url));
    if (hasLivestreamLink && !hasZoomLink) {
      console.log("[EVENT_REPLY]", { chat_id: chatId, message_id: messageId, reply_mode: "skip", reason: "followup_disabled_livestream_only" });
      return false;
    }
  }

  // Luồng tóm tắt lịch thiền đã chạy TRƯỚC handleEventAssistant (xem main flow),
  // nên ở đây chỉ cần bảo hiểm: nếu vẫn là lời mời thiền thì không xử lý tiếp.
  if (looksLikeMeditationInvite(message)) return true;


  const detection = detectTelegramEvent(message);
  if (!detection?.isEvent) {
    if (EVENT_KEYWORD_RE.test(directTelegramText(message))) console.log("[EVENT_DETECT]", {
      chat_id: chatId, message_id: messageId, reason: "insufficient_event_evidence",
    });
    return false;
  }

  const { adminClient } = getClients();
  const trustedSender = await isTrustedEventSender(adminClient, message, chatId);
  const highConfidence = detection.autoReplyEligible
    && (detection.confidence >= 70 || detection.hasZoom);
  console.log("[EVENT_DETECT]", {
    chat_id: chatId,
    message_id: messageId,
    event_type: detection.eventType,
    confidence: detection.confidence,
    has_zoom: detection.hasZoom,
    has_livestream: detection.hasLivestream,
    trusted_sender: trustedSender,
    auto_reply_eligible: detection.autoReplyEligible,
  });

  const fingerprint = eventFingerprint(detection.extracted);
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  let duplicate = false;
  if (fingerprint) {
    const { data: recent } = await adminClient
      .from("telegram_event_messages")
      .select("message_id, zoom_link, zoom_id, topic, title")
      .eq("chat_id", chatId)
      .gte("created_at", thirtyMinutesAgo)
      .limit(20);
    duplicate = (recent ?? []).some((row: any) => row.message_id !== messageId && eventFingerprint({
      ...detection.extracted,
      zoom_link: row.zoom_link ?? null,
      zoom_id: row.zoom_id ?? null,
      topic: row.topic ?? null,
      title: row.title ?? null,
    }) === fingerprint);
  }

  await adminClient.from("telegram_event_messages").upsert(detection.extracted, { onConflict: "chat_id,message_id" });

  if (duplicate) {
    console.log("[EVENT_REPLY]", { chat_id: chatId, message_id: messageId, reply_mode: "skip", reason: "duplicate_30m" });
    return false;
  }
  if (!detection.autoReplyEligible) {
    console.log("[EVENT_REPLY]", { chat_id: chatId, message_id: messageId, reply_mode: "skip", reason: "not_auto_reply_eligible" });
    return false;
  }
  if (!trustedSender && !highConfidence) {
    console.log("[EVENT_REPLY]", { chat_id: chatId, message_id: messageId, reply_mode: "skip", reason: "untrusted_low_confidence" });
    return false;
  }

  let languageSettings: CommunitySettings | null = null;
  try {
    languageSettings = await getSettingsForGroup(adminClient, chatId);
  } catch (err) {
    console.warn("[GROUP_LANG] event assistant group settings lookup failed; using auto", {
      chatId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
  const replyLanguage = String(languageSettings?.reply_language ?? "auto").trim().toLowerCase();
  const reply = renderEventAssistantPrompt(
    settings.event_assistant_prompt,
    detection.extracted,
    replyLanguage === "en" ? "en" : "vi",
  );
  await sendMessage(chatId, reply, {
    reply_to_message_id: messageId,
    skipAutoDelete: true,
  });
  console.log("[EVENT_REPLY]", { chat_id: chatId, message_id: messageId, reply_mode: "auto_summary", reason: "event_detected" });
  const auditActor = auditActorFromMessage(message);
  await logAiAudit({
    adminClient,
    groupId: chatId,
    userId: auditActor.userId,
    username: auditActor.username,
    triggerSource: "event_assistant",
    prompt: detection.extracted.topic ?? detection.extracted.title ?? detection.extracted.raw_text,
    responded: true,
    responseMs: Date.now() - startedAt,
    extra: {
      mode: "event_assistant",
      event_type: detection.eventType,
      topic: detection.extracted.topic,
      event_message_id: messageId,
      has_zoom: detection.hasZoom,
      has_livestream: detection.hasLivestream,
    },
  });

  return true;
}

function convertEventTime(originalTime: string | null, sourceTimezone: string | null, targetTimezone: "vi" | "my"): string | null {
  if (!originalTime) return null;
  const tz = (sourceTimezone ?? "").toLowerCase();
  const offset = /wat|nigeria|utc\+?1\b/.test(tz) ? (targetTimezone === "vi" ? 6 : 7) : null;
  if (offset === null) return null;
  return originalTime.replace(/\b(\d{1,2})(?::?(\d{2}))?\s*(h|am|pm)?\b/gi, (raw, hourRaw, minuteRaw, suffix) => {
    let hour = Number(hourRaw);
    const minute = minuteRaw ? Number(minuteRaw) : 0;
    const lowerSuffix = String(suffix ?? "").toLowerCase();
    if (lowerSuffix === "pm" && hour < 12) hour += 12;
    if (lowerSuffix === "am" && hour === 12) hour = 0;
    if (!Number.isFinite(hour) || hour > 24 || minute > 59) return raw;
    const converted = (hour + offset) % 24;
    return `${String(converted).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  });
}

/** Sender-authored text only; Telegram entity offsets are UTF-16, like JS slices. */
export function eventFollowupSenderText(message: TelegramMessage): string {
  let text = message.text ?? message.caption ?? "";
  const entities = message.text != null ? message.entities : message.caption_entities;
  for (const entity of [...(entities ?? [])].sort((a, b) => b.offset - a.offset)) {
    if (["blockquote", "expandable_blockquote", "code", "pre", "url"].includes(entity.type)) {
      text = text.slice(0, entity.offset) + " ".repeat(entity.length) + text.slice(entity.offset + entity.length);
    }
  }
  return text;
}

export function detectEventFollowupIntent(prompt: string): "zoom" | "password" | "time_vi" | "time_my" | "livestream" | "topic" | "host" | null {
  const authored = prompt
    .replace(/```[\s\S]*?```|<blockquote\b[^>]*>[\s\S]*?<\/blockquote>|<code\b[^>]*>[\s\S]*?<\/code>|`[^`\n]*`/gi, " ")
    .replace(/^[ \t]*(?:>|[—–])[^\n]*/gm, " ")
    .replace(/“[^”]*”|‘[^’]*’|"[^"\n]*"|'[^'\n]*'/g, " ")
    .replace(/https?:\/\/\S+|@[a-z0-9_]+/gi, " ");
  const norm = authored.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
  // A question elsewhere in an article does not turn a Zoom mention into a request.
  for (const clause of norm.match(/[^.!?;\n]+[!?]?/g) ?? []) {
    const request = /\b(?:dau|la\s*gi|gi\s*vay|co\s+.+\s+khong|cho\s+xin|xin\s+(?:link|id|mat\s*khau|thong\s*tin)|gui\s*(?:lai|link)|can\s+link|may\s*gio|gio\s*nao|bao\s*gio|bao\s*nhieu|what|where|when|which|who|how|is\s+there|do\s+we\s+have|(?:can|could)\s+(?:you|anyone)|please\s+(?:send|share|give|provide)|convert\s*time|doi\s*(?:sang|qua)\s*gio|chuyen\s*(?:sang|qua)\s*gio|ai\s+(?:la\s+)?(?:nguoi\s+)?(?:huong\s*dan|dan))\b/.test(clause)
      || /^\s*(?:send|share|give|provide)\b/.test(clause)
      || /^\s*(?:(?:zoom\s*)?(?:link|id|password|pw|pass|mat\s*khau)|link\s*zoom|topic|chu\s*de|host|guide)(?:\s+(?:hom\s*nay|today|for\s*today))?\s*\?\s*$/.test(clause);
    if (!request || /\b(?:what\s+do\s+you\s+think|how\s+do\s+you\s+feel|your\s+(?:thoughts|opinion)|nghi\s*gi|cam\s*nhan)\b/.test(clause)) continue;
    if (/\b(?:pw|pass|password|mat\s*khau)\b/.test(clause)) return "password";
    if (/\b(?:may\s*gio|gio\s*nao|bao\s*gio|time|when|thoi\s*gian)\b/.test(clause)) {
      return /\b(?:viet\s*nam|vietnam|vn|gio\s*vn)\b/.test(clause) ? "time_vi" : "time_my";
    }
    if (/\b(?:youtube|facebook|livestream|live)\b/.test(clause)) return "livestream";
    if (/\b(?:chu\s*de|topic)\b/.test(clause)) return "topic";
    if (/\b(?:host|hosting|guide|nguoi\s*huong\s*dan|ai\s*(?:huong\s*dan|dan))\b/.test(clause)) return "host";
    const asksZoomAccess = /\b(?:link|id|details|access|room|vao|phong|gui)\b/.test(clause)
      || /\b(?:can|could)\s+(?:you|anyone)\b.*\b(?:send|share|give|provide)\b|\bplease\s+(?:send|share|give|provide)\b|^\s*(?:send|share|give|provide)\b/.test(clause)
      || /\bhow\b.*\bjoin\b|\bzoom\s*(?:o\s*)?dau\b|\bwhere\s+is\s+(?:the\s+)?zoom\s*\?\s*$/.test(clause);
    if (asksZoomAccess && /\bzoom\b/.test(clause)) return "zoom";
  }
  return null;
}

function usableFollowupEvent(event: TelegramEventRecord, intent?: NonNullable<ReturnType<typeof detectEventFollowupIntent>>): boolean {
  if (event.status !== "active") return false;
  const detected = detectTelegramEvent({
    chat: { id: event.chat_id, type: "supergroup" }, message_id: event.message_id, text: event.raw_text,
  });
  if (!event.zoom_link && !event.zoom_id && !detected?.isEvent) return false;
  if (intent === "zoom" || intent === "password") return Boolean(event.zoom_link || event.zoom_id || /\bzoom\b/i.test(event.raw_text));
  if (intent === "livestream") return Boolean(event.livestream_links?.length);
  return true;
}

// Implicit references expire after a day; explicit replies can identify older events.
const EVENT_FOLLOWUP_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export async function findEventForFollowup(
  adminClient: ReturnType<typeof getClients>["adminClient"],
  chatId: number,
  replyMessageId?: number | null,
  intent?: NonNullable<ReturnType<typeof detectEventFollowupIntent>>,
): Promise<TelegramEventRecord | null> {
  const audit = (reason: string, eventMessageId?: number) => console.log("[EVENT_FOLLOWUP_SELECT]", {
    chat_id: chatId, reply_message_id: replyMessageId ?? null, event_message_id: eventMessageId ?? null, reason,
  });
  if (replyMessageId) {
    const { data, error } = await adminClient.from("telegram_event_messages").select("*")
      .eq("chat_id", chatId).eq("message_id", replyMessageId).maybeSingle();
    const eligible = !error && data && usableFollowupEvent(data as TelegramEventRecord, intent);
    audit(error ? "lookup_failed" : eligible ? "direct_reply" : "reply_not_eligible_event", eligible ? data.message_id : undefined);
    // Never attach a reply to an unrelated latest announcement.
    return eligible ? data as TelegramEventRecord : null;
  }
  const cutoff = Date.now() - EVENT_FOLLOWUP_MAX_AGE_MS;
  const { data, error } = await adminClient.from("telegram_event_messages").select("*")
    .eq("chat_id", chatId).eq("status", "active").gte("created_at", new Date(cutoff).toISOString())
    .order("created_at", { ascending: false }).limit(20);
  if (error) { audit("lookup_failed"); return null; }
  const rows = (data ?? []) as TelegramEventRecord[];
  const eligible = rows.filter((event) => Date.parse(event.created_at ?? "") >= cutoff && usableFollowupEvent(event, intent));
  // With several candidates, the sender must identify one (e.g. by replying).
  if (rows.length >= 20 || eligible.length !== 1) {
    audit(rows.length >= 20 ? "candidate_limit" : eligible.length > 1 ? "ambiguous_events" : "no_recent_eligible_event");
    return null;
  }
  audit("single_recent_event", eligible[0].message_id);
  return eligible[0];
}

export function buildEventFollowupAnswer(
  intent: NonNullable<ReturnType<typeof detectEventFollowupIntent>>,
  event: TelegramEventRecord,
  lang: AngelLanguageBucket = "vi",
): string {
  const english = lang === "en";
  if (intent === "password") {
    return event.zoom_password
      ? english ? `The Zoom PW is <code>${escapeHtml(event.zoom_password)}</code>.` : `PW Zoom là <code>${escapeHtml(event.zoom_password)}</code> bé nhé.`
      : english ? "Angel does not see a Zoom PW in this announcement yet." : "Angel chưa thấy PW Zoom trong thông báo này bé nhé.";
  }
  if (intent === "zoom") {
    const parts = [english ? "Angel is sending the Zoom details again:" : "Angel gửi lại thông tin Zoom cho bé:"];
    if (event.zoom_link) parts.push(escapeHtml(event.zoom_link));
    if (event.zoom_id) parts.push(`ID: <code>${escapeHtml(event.zoom_id)}</code>`);
    if (event.zoom_password) parts.push(`PW: <code>${escapeHtml(event.zoom_password)}</code>`);
    return parts.length > 1 ? parts.join("\n") : english
      ? "Angel does not see a Zoom link or ID in this announcement yet."
      : "Angel chưa thấy link hoặc ID Zoom trong thông báo này bé nhé.";
  }
  if (intent === "livestream") {
    return event.livestream_links?.length
      ? `${english ? "Livestream links in the announcement:" : "Livestream trong thông báo:"}\n${event.livestream_links.slice(0, 4).map((link) => escapeHtml(link)).join("\n")}`
      : english ? "Angel does not see a livestream link in this announcement yet." : "Angel chưa thấy link livestream trong thông báo này bé nhé.";
  }
  if (intent === "topic") {
    return event.topic || event.title
      ? english ? `The topic is: ${escapeHtml(event.topic ?? event.title ?? "")}` : `Chủ đề là: ${escapeHtml(event.topic ?? event.title ?? "")}`
      : english ? "Angel does not see a clear topic in this announcement yet." : "Angel chưa thấy chủ đề rõ trong thông báo này bé nhé.";
  }
  if (intent === "host") {
    return event.host_name
      ? english ? `The guide/host is ${escapeHtml(event.host_name)}.` : `Người hướng dẫn là ${escapeHtml(event.host_name)} bé nhé.`
      : english ? "Angel does not see a clear guide/host name in this announcement yet." : "Angel chưa thấy tên người hướng dẫn rõ trong thông báo này bé nhé.";
  }
  const target = intent === "time_vi" ? "vi" : "my";
  const converted = convertEventTime(event.event_time, event.timezone, target);
  if (!converted) return english ? "Angel cannot confidently convert the time yet." : "Angel chưa xác định chắc chắn được giờ để chuyển đổi.";
  return english
    ? `In ${target === "vi" ? "Vietnam" : "Malaysia"} time, it is approximately: <b>${escapeHtml(converted)}</b>.`
    : `Theo múi giờ ${target === "vi" ? "Việt Nam" : "Malaysia"}, thời gian khoảng: <b>${escapeHtml(converted)}</b>.`;
}

function buildEventFollowupAiPrompt(params: {
  template: string;
  question: string;
  intent: NonNullable<ReturnType<typeof detectEventFollowupIntent>>;
  event: TelegramEventRecord;
  deterministicAnswer: string;
}): string {
  const eventJson = JSON.stringify({
    event_type: params.event.event_type,
    title: params.event.title,
    topic: params.event.topic,
    host_name: params.event.host_name,
    event_date: params.event.event_date,
    event_time: params.event.event_time,
    timezone: params.event.timezone,
    zoom_link: params.event.zoom_link,
    zoom_id: params.event.zoom_id,
    zoom_password: params.event.zoom_password,
    livestream_links: params.event.livestream_links,
  });
  const replacements: Record<string, string> = {
    "{{question}}": params.question,
    "{{intent}}": params.intent,
    "{{event_json}}": eventJson,
    "{{deterministic_answer}}": params.deterministicAnswer,
  };
  let rendered = params.template;
  for (const [key, value] of Object.entries(replacements)) {
    rendered = rendered.replaceAll(key, value);
  }
  return rendered;
}

export async function handleGroupAiMention(message: TelegramMessage, settings: CommunitySettings): Promise<void> {
  const chatId = message.chat?.id;
  const user = message.from;
  const senderChat = message.sender_chat;
  if (!chatId) return;

  // Resolve actor: real user OR trusted sender_chat. NEVER match by display name.
  const { adminClient } = getClients();
  let actorId: number;
  let actorLabel: string;
  let actorKind: "user" | "sender_chat";
  let memberStatus: string | null = null;
  let isGroupSenderChat = false;

  if (senderChat?.id) {
    isGroupSenderChat = senderChat.id === chatId;
    const trusted = isGroupSenderChat || await isTrustedSenderChat(adminClient, chatId, senderChat.id);
    if (!trusted) {
      console.log(
        `[SENDER CHAT] skip ai chat_id=${chatId} sender_chat_id=${senderChat.id} trusted=false`,
      );
      console.log("[OWNER_REPLY_GUARD]", {
        chatId,
        actorId: senderChat.id,
        actorKind: "sender_chat",
        ownerGuard: "untrusted_sender_chat",
        reason: "sender_chat_not_trusted",
      });
      return;
    }
    actorId = senderChat.id;
    actorLabel = senderChat.title ?? "Channel";
    actorKind = "sender_chat";
  } else if (user?.is_bot) {
    return;
  } else if (user?.id) {
    actorId = user.id;
    actorLabel = fullName(user);
    actorKind = "user";
    const member = await getChatMember(chatId, user.id);
    memberStatus = String(member.data?.result?.status ?? "");
  } else {
    return;
  }

  const text = directTelegramText(message);
  if (!text) return;

  const bot = await getBotInfo();
  const botUsername = bot?.username ?? Deno.env.get("COMMUNITY_GUARD_BOT_USERNAME") ?? "";
  const mentionRegex = botUsername ? new RegExp(`@${escapeRegexSource(botUsername)}\\b`, "i") : null;
  const isMention = mentionRegex ? mentionRegex.test(text) : false;
  const isReplyToBot = Boolean(bot?.id && message.reply_to_message?.from?.id === bot.id);
  const isAskCmd = /^\/ask(@|\s)/i.test(text);
  const isHelpIntent = !text.startsWith("/") && detectHelpIntent(text);
  const isPositiveIntent = !text.startsWith("/") && detectPositiveEngagement(text);
  const isOwner = memberStatus === "creator";
  const isAnonymousOwner = actorKind === "sender_chat" && isGroupSenderChat;
  const isAdmin = isOwner || memberStatus === "administrator";
  const isTrustedSenderActor = actorKind === "sender_chat";
  const ownerOn = settings.always_reply_owner !== false;
  const adminsOn = settings.always_reply_admins !== false;
  const mentionOn = settings.always_reply_on_mention !== false;
  const replyOn = settings.always_reply_on_reply_to_bot !== false;
  const helpOn = settings.help_intent_ai_enabled !== false;
  const positiveOn = settings.positive_engagement_enabled === true;
  const ownerTrigger = (isOwner || isAnonymousOwner) && ownerOn;
  const adminTrigger = !isOwner && !isAnonymousOwner && (isAdmin || isTrustedSenderActor) && adminsOn;
  const mentionTrigger = isMention && mentionOn && settings.ai_enabled;
  const replyToBotTrigger = isReplyToBot && replyOn && (settings.ai_enabled || isAdmin || isTrustedSenderActor);
  const askTrigger = isAskCmd && (settings.ai_enabled || isAdmin || isTrustedSenderActor);
  const helpTrigger = isHelpIntent && helpOn && settings.ai_enabled;
  const positiveTrigger = isPositiveIntent && positiveOn && settings.ai_enabled;
  let triggerSource: AiTriggerSource | null = null;
  if (ownerTrigger) triggerSource = "owner_message";
  else if (adminTrigger) triggerSource = "admin_message";
  else if (mentionTrigger) triggerSource = "mention";
  else if (replyToBotTrigger) triggerSource = "reply_to_bot";
  else if (askTrigger) triggerSource = "ask_command";
  else if (helpTrigger) triggerSource = "help_intent";
  else if (positiveTrigger) triggerSource = "positive_community";

  console.log("[community] ai_eval", {
    chatId,
    actorId,
    actorKind,
    memberStatus,
    isGroupSenderChat,
    isAnonymousOwner,
    isTrustedSenderActor,
    isMention,
    isReplyToBot,
    isAskCmd,
    isHelpIntent,
    isPositiveIntent,
    ownerTrigger,
    adminTrigger,
    positiveTrigger,
    textPreview: text.slice(0, 80),
  });

  if (!triggerSource) {
    console.log("[OWNER_REPLY_GUARD]", {
      chatId,
      actorId,
      actorKind,
      ownerGuard:
        isOwner ? "owner_user" :
        isAnonymousOwner ? "group_sender_chat" :
        isTrustedSenderActor ? "trusted_sender_chat" :
        "none",
      reason: "no_trigger",
      ownerOn,
      adminsOn,
    });
    return;
  }
  if (triggerSource === "owner_message" || triggerSource === "admin_message") {
    console.log("[OWNER_REPLY_GUARD]", {
      chatId,
      actorId,
      actorKind,
      triggerSource,
      ownerGuard:
        isOwner ? "owner_user" :
        isAnonymousOwner ? "group_sender_chat" :
        isTrustedSenderActor ? "trusted_sender_chat" :
        "admin_user",
      ownerOn,
      adminsOn,
    });
  }

  if (!isAskCmd && /^\/[a-z0-9_]+(@[a-z0-9_]+)?/i.test(text)) return;

  if (triggerSource === "positive_community") {
    const positiveAllowance = await positiveEngagementAllowed(adminClient, settings, chatId);
    if (!positiveAllowance.allowed) {
      console.log("[community] positive engagement skipped", { chatId, reason: positiveAllowance.reason });
      return;
    }
  }

  const aiQuestion = buildGroupAiQuestion({ message, botUsername, botId: bot?.id, isReplyToBot, triggerSource, settings });
  const prompt = aiQuestion.prompt;
  // Read only this chat's language preference. The global oldest settings row
  // may belong to a different group and must never drive this policy.
  let groupSettings: CommunitySettings | null = null;
  let groupSettingsLookupFailed = false;
  try {
    groupSettings = await getSettingsForGroup(adminClient, chatId);
  } catch (err) {
    groupSettingsLookupFailed = true;
    console.warn("[GROUP_LANG] group settings lookup failed; using auto", {
      chatId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
  const replyLanguage = groupSettings?.reply_language ?? "auto";
  const groupLanguage = resolveGroupReplyLanguage(prompt, replyLanguage);
  const userLangBucket = groupLanguage.bucket;
  if (!prompt) {
    const emptyPromptReply = groupLanguage.botVoiceBucket === "en"
      ? `💛 Please type your question after mentioning Angel. For example: <code>@${botUsername || "bot"} What is FUN.RICH?</code>`
      : "💛 Bé yêu, gõ câu hỏi sau khi tag Angel nhé. Ví dụ: <code>@" + (botUsername || "bot") + " FUN.RICH là gì?</code>";
    await sendMessage(chatId, emptyPromptReply, {
      reply_to_message_id: message.message_id,
    });
    return;
  }
  console.log("[GROUP_LANG]", {
    chatId,
    settingsId: (settings as any)?.id ?? null,
    settingsGroupId: (settings as any)?.group_id ?? null,
    groupSettingsId: (groupSettings as any)?.id ?? null,
    groupSettingsLookupFailed,
    replyLanguage: replyLanguage ?? null,
    bucket: userLangBucket,
    hasPolicyNote: Boolean(groupLanguage.policyNote),
  });
  const addressRuleOverride = addressRuleForActor({ actorKind, isGroupSenderChat, isOwner, settings, text: prompt, chatId, username: user?.username ?? null });
  const lock = await acquireAiMessageLock({
    adminClient,
    groupId: chatId,
    messageId: message.message_id ?? null,
    userId: actorId,
    triggerSource,
    prompt,
    extra: { actorKind, isGroupSenderChat },
  });
  if (!lock.acquired) {
    console.log("[community] ai duplicate skipped", {
      chatId,
      messageId: message.message_id ?? null,
      triggerSource,
      reason: lock.reason,
    });
    return;
  }

  const activeMiniAppBuilderMode = await hasActiveMiniAppBuilderMode({
    adminClient,
    groupId: chatId,
    userId: actorId,
  });
  const decision = classifyAiDecision({
    triggerSource,
    prompt,
    isOwner: isOwner || isAnonymousOwner,
    isAdmin,
    isTrustedSenderActor,
    activeMiniAppBuilderMode,
  });
  if (decision.category === "mini_app_builder") {
    await touchMiniAppBuilderMode({
      adminClient,
      groupId: chatId,
      userId: actorId,
      timeoutMinutes: settings.mini_app_builder_timeout_minutes ?? 30,
    });
  }
  const hasReplyContext = Boolean(aiQuestion.replyContextPreview);
  const promptHash = await sha256Hex(normalizeAiCachePrompt(hasReplyContext ? aiQuestion.question : prompt));
  const messageType = classifyMessageType(message);

  const skipRepeatedPromptGuard = decision.category === "owner" || decision.category === "admin" || decision.category === "coordinator";
  if (!skipRepeatedPromptGuard && await repeatedAiSpamDetected({ adminClient, groupId: chatId, userId: actorId, promptHash })) {
    const spamDecision: AiDecisionContext = {
      category: "spam",
      priority: DEFAULT_AI_LIMITS.spam.priority,
      rateLimitCategory: "spam",
      cacheable: false,
      knowledgeUsed: false,
      reason: "repeated_identical_ai_prompt",
    };
    await logAiRuntime({
      adminClient,
      groupId: chatId,
      userId: actorId,
      messageId: message.message_id ?? null,
      messageType,
      decision: spamDecision,
      allowed: false,
      promptHash,
      promptPreview: prompt,
      error: "repeated_identical_ai_prompt",
      extra: { actorKind, isGroupSenderChat, triggerSource },
    });
    await markAiMessageLock({
      adminClient,
      groupId: chatId,
      messageId: message.message_id ?? null,
      triggerSource,
      status: "skipped",
      extra: { actorKind, isGroupSenderChat, reason: "repeated_identical_ai_prompt" },
    });
    return;
  }

  const funCoreContextHash = await sha256Hex(
    (settings.fun_core_context_prompt?.trim() || FUN_PROFILE_PLATFORM_FACTS).trim(),
  );
  const cacheKey = decision.cacheable && !hasReplyContext
    ? await sha256Hex([
      "telegram-ai-v2",
      userLangBucket,
      chatId,
      decision.category,
      getAngelProvider(),
      settings.bot_username ?? botUsername,
      settings.ai_knowledge_version ?? 1,
      funCoreContextHash,
      normalizeAiCachePrompt(prompt),
    ].join("|"))
    : null;
  if (cacheKey) {
    const cached = await getAiCachedResponse({ adminClient, groupId: chatId, cacheKey });
    console.log("[GROUP_LANG] cache", { chatId, bucket: userLangBucket, cacheHit: Boolean(cached) });
    if (cached) {
      await sendMessage(chatId, cached, { reply_to_message_id: message.message_id, skipAutoDelete: true });
      await markAiMessageLock({
        adminClient,
        groupId: chatId,
        messageId: message.message_id ?? null,
        triggerSource,
        status: "responded",
        extra: { actorKind, isGroupSenderChat, mode: "cache_hit", intent: decision.category },
      });
      await logAiRuntime({
        adminClient,
        groupId: chatId,
        userId: actorId,
        messageId: message.message_id ?? null,
        messageType,
        decision,
        provider: "cache",
        cacheHit: true,
        allowed: true,
        latencyMs: 0,
        inputTokens: 0,
        outputTokens: 0,
        promptHash,
        promptPreview: prompt,
        extra: { actorKind, isGroupSenderChat, triggerSource },
      });
      await logAiAudit({
        adminClient,
        groupId: chatId,
        userId: actorId,
        username: user?.username ?? senderChat?.username ?? null,
        triggerSource,
        prompt,
        responded: true,
        responseMs: 0,
        extra: { actorKind, isGroupSenderChat, mode: "cache_hit", intent: decision.category },
      });
      return;
    }
  }

  const decisionLimit = await checkAiDecisionLimit({
    adminClient,
    settings,
    groupId: chatId,
    userId: actorId,
    decision,
  });
  if (!decisionLimit.allowed) {
    const rateLimitReply = groupLanguage.botVoiceBucket === "en"
      ? "Angel is receiving many questions right now. Please try again in a few minutes 💛"
      : "Bé nhắn hơi nhanh, Angel cần nghỉ một chút để giữ năng lượng cho cả nhóm. Bé thử lại sau nhé.";
    await sendMessage(chatId, rateLimitReply, {
      reply_to_message_id: message.message_id,
    });
    await logAiRuntime({
      adminClient,
      groupId: chatId,
      userId: actorId,
      messageId: message.message_id ?? null,
      messageType,
      decision,
      allowed: false,
      promptHash,
      promptPreview: prompt,
      error: decisionLimit.reason ?? "rate_limited",
      extra: { actorKind, isGroupSenderChat, triggerSource, rule: decisionLimit.rule },
    });
    await markAiMessageLock({
      adminClient,
      groupId: chatId,
      messageId: message.message_id ?? null,
      triggerSource,
      status: "skipped",
      extra: { actorKind, isGroupSenderChat, reason: decisionLimit.reason ?? "rate_limited", intent: decision.category },
    });
    return;
  }

  const followupEnabled = settings.event_followup_enabled !== false;
  const eventIntent = !followupEnabled || triggerSource === "positive_community" ? null : detectEventFollowupIntent(eventFollowupSenderText(message));
  if (followupEnabled && triggerSource !== "positive_community") console.log("[EVENT_FOLLOWUP_INTENT]", {
    chat_id: chatId, message_id: message.message_id ?? null, intent: eventIntent, has_reply: Boolean(message.reply_to_message),
  });
  if (eventIntent) {
    const event = await findEventForFollowup(adminClient, chatId, message.reply_to_message?.message_id ?? null, eventIntent);
    if (event) {
      const deterministicAnswer = buildEventFollowupAnswer(eventIntent, event, userLangBucket);
      let followupAnswer = deterministicAnswer;
      const followupTemplate = settings.event_followup_prompt?.trim();
      if (followupTemplate) {
        try {
          followupAnswer = await withTyping(chatId, () => askAngel({
            question: buildEventFollowupAiPrompt({
              template: followupTemplate || DEFAULT_EVENT_FOLLOWUP_PROMPT,
              question: prompt,
              intent: eventIntent,
              event,
              deterministicAnswer,
            }),
            originalUserMessage: prompt,
            telegramGroupContext: aiQuestion.groupContext,
            systemPrompt: settings.ai_system_prompt,
            userLabel: actorLabel,
            personaMode: (settings as any).persona_mode,
            personaCustomPrompt: (settings as any).persona_custom_prompt,
            addressRuleOverride,
            funCoreContextPrompt: settings.fun_core_context_prompt,
            aiStylePrompt: (settings as any).ai_style_prompt,
            aiPersonaPrompt: (settings as any).ai_persona_prompt,
            adminClient,
            conversationContext: {
              chatId,
              chatType: message.chat?.type ?? null,
              groupId: chatId,
              userId: message.from?.id ?? null,
              username: message.from?.username ?? null,
              fullName: actorLabel,
              messageId: message.message_id ?? null,
              triggerSource: "event_followup",
            },
            forcedLangBucket: userLangBucket,
            languagePolicyNote: groupLanguage.policyNote,
            fallbackLangBucket: groupLanguage.botVoiceBucket ?? userLangBucket,
            mirrorAngelWeb: (settings as any).ai_mirror_angel_web !== false,
          }), groupLanguage.botVoiceBucket === "en" ? "💛 Angel is preparing an answer…" : undefined);
        } catch (err) {
          console.warn("[EVENT_REPLY] custom prompt failed, fallback deterministic", err);
          followupAnswer = deterministicAnswer;
        }
      }
      await sendMessage(chatId, followupAnswer, {
        reply_to_message_id: message.message_id,
        skipAutoDelete: true,
      });
      await markAiMessageLock({
        adminClient,
        groupId: chatId,
        messageId: message.message_id ?? null,
        triggerSource,
        status: "responded",
        extra: { actorKind, isGroupSenderChat, mode: "event_followup", eventIntent, eventMessageId: event.message_id },
      });
      await logAiRuntime({
        adminClient,
        groupId: chatId,
        userId: actorId,
        messageId: message.message_id ?? null,
        messageType,
        decision,
        provider: followupTemplate ? getAngelProvider() : "deterministic",
        cacheHit: false,
        allowed: true,
        latencyMs: 0,
        inputTokens: followupTemplate ? estimateTokens(prompt) : 0,
        outputTokens: estimateTokens(followupAnswer),
        promptHash,
        promptPreview: prompt,
        extra: { actorKind, isGroupSenderChat, triggerSource, mode: "event_followup", eventIntent, eventMessageId: event.message_id },
      });
      console.log("[EVENT_REPLY]", { chat_id: chatId, message_id: message.message_id, reply_mode: "followup_answer", reason: eventIntent });
      await logAiAudit({
        adminClient,
        groupId: chatId,
        userId: actorId,
        username: user?.username ?? senderChat?.username ?? null,
        triggerSource,
        prompt,
        responded: true,
        responseMs: 0,
        extra: { actorKind, isGroupSenderChat, mode: "event_followup", eventIntent, eventMessageId: event.message_id },
      });
      return;
    }
    console.log("[EVENT_REPLY]", { chat_id: chatId, message_id: message.message_id, reply_mode: "skip", reason: "followup_no_event" });
  }

  const mode = triggerSource === "positive_community"
    ? "positive_community_ai"
    : triggerSource === "help_intent" ? "help_intent_ai" : "ai";
  console.log("[community] ai_answer_fire", { chatId, actorId, actorKind, isGroupSenderChat, mode, triggerSource, intent: decision.category, priority: decision.priority });

  // ===== UNIFIED /angel-router FLOW (GROUP) =====
  // Không phân loại ý định ở FUNPROFILE nữa — router bên Angel gốc tự chọn chat /
  // image_generate / image_analyze. Nếu message có ảnh → forward attachment.
  const startedAt = Date.now();
  const _groupImmediateContext = telegramReplyAssistantContext(message, bot?.id ?? null);
  const _groupAttachments: Array<{ kind: "image"; url?: string; base64?: string; mime_type?: string }> = [];
  if (hasAnalyzableImage(message)) {
    const pick = pickLargestPhotoFileId(message);
    const fileId = pick?.fileId ?? null;
    if (fileId) {
      const media = await tryFetchTelegramMedia(fileId, "group-attachment", {
        allowedMimePrefixes: ["image/"],
        maxBytes: 15 * 1024 * 1024,
      });
      if (media) {
        _groupAttachments.push({ kind: "image", base64: media.base64, mime_type: media.mime });
      }
    }
  }
  const _groupImageOut: import("../_shared/telegram-community.ts").AskAngelImageOut = {};
  const _groupStreamExtra: Record<string, unknown> = {};
  if (message.message_id != null) _groupStreamExtra.reply_to_message_id = String(message.message_id);
  // Auto-illustrate group posts: MẶC ĐỊNH TẮT. Khi tắt → không xin ảnh từ
  // router, không stream preview, và nếu router lỡ trả ảnh vẫn drop → chỉ
  // gửi text bình luận. Bật lại bằng flag admin `image.auto_illustrate_group_posts`.
  const _groupAutoIllustrate = await getFlag("image.auto_illustrate_group_posts", false);
  const _groupImageStreamer = _groupAutoIllustrate
    ? createTelegramImageStreamer(chatId, {
        placeholderCaption: groupLanguage.botVoiceBucket === "en"
          ? "💛 Angel is creating an illustration. Please wait…"
          : "💛 Angel đang vẽ, cả nhà chờ xíu nhé…",
        extra: _groupStreamExtra,
      })
    : null;
  const _groupStreamEnabled = _groupAutoIllustrate
    ? await getFlag("image.stream_telegram_preview", true)
    : false;
  try {
    const reply = await withTyping(chatId, () => askAngel({
      question: aiQuestion.question,
      telegramGroupContext: aiQuestion.groupContext,
      originalUserMessage: prompt,
      systemPrompt: settings.ai_system_prompt,
      userLabel: actorLabel,
      personaMode: (settings as any).persona_mode,
      personaCustomPrompt: (settings as any).persona_custom_prompt,
      addressRuleOverride,
      funCoreContextPrompt: settings.fun_core_context_prompt,
      aiStylePrompt: (settings as any).ai_style_prompt,
      aiPersonaPrompt: (settings as any).ai_persona_prompt,
      adminClient,
      conversationContext: {
        chatId,
        chatType: message.chat?.type ?? null,
        groupId: chatId,
        userId: message.from?.id ?? null,
        username: message.from?.username ?? null,
        fullName: actorLabel,
        messageId: message.message_id ?? null,
          replyMessageId: message.reply_to_message?.message_id ?? null,
        triggerSource: `group_ai:${triggerSource}`,
      },
        immediateAssistantContext: _groupImmediateContext,
      forcedLangBucket: userLangBucket,
      languagePolicyNote: groupLanguage.policyNote,
      fallbackLangBucket: groupLanguage.botVoiceBucket ?? userLangBucket,
      mirrorAngelWeb: (settings as any).ai_mirror_angel_web !== false,
      attachments: _groupAttachments.length > 0 ? _groupAttachments : undefined,
      outImage: _groupAutoIllustrate ? _groupImageOut : undefined,
      onPartialImage: _groupStreamEnabled && _groupImageStreamer ? _groupImageStreamer.onPartial : undefined,
    }), groupLanguage.botVoiceBucket === "en" ? "💛 Angel is preparing an answer…" : undefined);
    // Router có ảnh → chỉ gửi khi auto-illustrate BẬT. Ngược lại drop ảnh, chỉ text.
    if (_groupAutoIllustrate && _groupImageStreamer && (_groupImageOut.image_url || _groupImageOut.image_base64)) {
      const caption = reply || (groupLanguage.botVoiceBucket === "en"
        ? "Angel created this illustration for everyone ✨💛"
        : "Angel vẽ tặng cả nhà ✨💛");
      await _groupImageStreamer.finalize({
        b64: _groupImageOut.image_base64 ?? undefined,
        url: _groupImageOut.image_url ?? undefined,
        mime: _groupImageOut.mime_type || "image/png",
        caption,
        extra: _groupStreamExtra,
      });
    } else {
      if (!_groupAutoIllustrate && (_groupImageOut.image_url || _groupImageOut.image_base64)) {
        console.log("[auto-illustrate] skipped (group post) — flag OFF, image dropped, sending text only");
      }
      await sendMessage(chatId, reply, { reply_to_message_id: message.message_id, skipAutoDelete: true });
    }
    if (cacheKey) {
      await saveAiCachedResponse({
        adminClient,
        groupId: chatId,
        cacheKey,
        decision,
        promptHash,
        promptPreview: prompt,
        responseText: reply,
        settings,
      });
    }
    await markAiMessageLock({
      adminClient,
      groupId: chatId,
      messageId: message.message_id ?? null,
      triggerSource,
      status: "responded",
      extra: { actorKind, isGroupSenderChat, mode, replyContextPreview: aiQuestion.replyContextPreview },
    });
    await logAiRuntime({
      adminClient,
      groupId: chatId,
      userId: actorId,
      messageId: message.message_id ?? null,
      messageType,
      decision,
      provider: getAngelProvider(),
      cacheHit: false,
      allowed: true,
      latencyMs: Date.now() - startedAt,
      inputTokens: estimateTokens(aiQuestion.question),
      outputTokens: estimateTokens(reply),
      promptHash,
      promptPreview: prompt,
      extra: { actorKind, isGroupSenderChat, triggerSource, mode, replyContextPreview: aiQuestion.replyContextPreview },
    });
    await logAiAudit({
      adminClient,
      groupId: chatId,
      userId: actorId,
      username: user?.username ?? senderChat?.username ?? null,
      triggerSource,
      prompt,
      responded: true,
      responseMs: Date.now() - startedAt,
      extra: { actorKind, isGroupSenderChat, mode, replyContextPreview: aiQuestion.replyContextPreview },
    });
  } catch (err) {
    console.warn("[community] ai reply failed", err);
    await logAiRuntime({
      adminClient,
      groupId: chatId,
      userId: actorId,
      messageId: message.message_id ?? null,
      messageType,
      decision,
      provider: getAngelProvider(),
      cacheHit: false,
      allowed: false,
      latencyMs: Date.now() - startedAt,
      inputTokens: estimateTokens(aiQuestion.question),
      outputTokens: 0,
      promptHash,
      promptPreview: prompt,
      error: err instanceof Error ? err.message : String(err),
      extra: { actorKind, isGroupSenderChat, triggerSource, mode, replyContextPreview: aiQuestion.replyContextPreview },
    });
    await markAiMessageLock({
      adminClient,
      groupId: chatId,
      messageId: message.message_id ?? null,
      triggerSource,
      status: "failed",
      extra: { actorKind, isGroupSenderChat, mode, replyContextPreview: aiQuestion.replyContextPreview, error: err instanceof Error ? err.message : String(err) },
    });
    await logAiAudit({
      adminClient,
      groupId: chatId,
      userId: actorId,
      username: user?.username ?? senderChat?.username ?? null,
      triggerSource,
      prompt,
      responded: false,
      responseMs: Date.now() - startedAt,
      extra: { actorKind, isGroupSenderChat, mode, replyContextPreview: aiQuestion.replyContextPreview, error: err instanceof Error ? err.message : String(err) },
    });
    return;
  }

  try {
    await adminClient.rpc("telegram_group_health_reply", {
      p_group_id: chatId,
      p_mode: mode,
    });
  } catch (err) {
    console.warn("[community] telegram_group_health_reply failed", err);
  }
}

// EdgeRuntime is a Deno Deploy / Supabase Edge Runtime global; declare lightly to avoid TS errors.
// deno-lint-ignore no-explicit-any
declare const EdgeRuntime: { waitUntil?: (p: Promise<unknown>) => void } | undefined;

function scheduleVerificationExpiryCheck(challengeId: string, delayMs: number) {
  const work = new Promise<void>((resolve) => {
    setTimeout(async () => {
      try {
        const { adminClient } = getClients();
        const { data, error } = await adminClient
          .from("telegram_community_verification_challenges")
          .select("*")
          .eq("id", challengeId)
          .eq("status", "pending")
          .maybeSingle();
        if (error) {
          console.error("[verification] scheduled expiry challenge lookup failed", {
            challenge_id: challengeId,
            error_code: error.code ?? "unknown",
          });
          return;
        }
        const challenge = data as VerificationChallenge | null;
        if (!challenge) return;
        if (new Date(challenge.expires_at).getTime() > Date.now()) return;
        const settingsLookup = await loadGroupSettings(adminClient, challenge.group_id);
        if (!settingsLookup.ok) {
          await logModeration(adminClient, {
            groupId: challenge.group_id,
            userId: challenge.telegram_user_id,
            username: challenge.username,
            action: "verification_settings_lookup_failed",
            reason: `scheduled_expiry_settings_lookup:${settingsLookup.errorCode}`,
            messageId: challenge.captcha_message_id,
          }).catch(() => undefined);
          return;
        }
        await punishUnverifiedMember(adminClient, challenge, settingsLookup.settings, "verification_expired");
      } catch (error) {
        console.error("[telegram-community-webhook] expiry check failed", error);
      } finally {
        resolve();
      }
    }, delayMs);
  });

  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
    EdgeRuntime.waitUntil(work);
  }
}

async function closePendingChallengesOnLeave(
  adminClient: ReturnType<typeof getClients>["adminClient"],
  chatId: number,
  member: { id?: number; username?: string },
): Promise<void> {
  if (!member.id) return;
  const lookup = await adminClient
    .from("telegram_community_verification_challenges")
    .select("id, captcha_message_id")
    .eq("group_id", chatId)
    .eq("telegram_user_id", member.id)
    .eq("status", "pending");
  let error = lookup.error;
  const closed: Array<{ captcha_message_id: number | null }> = [];
  for (const row of (lookup.data ?? []) as Array<{ id: string; captcha_message_id: number | null }>) {
    if (error) break;
    const update = await adminClient
      .from("telegram_community_verification_challenges")
      .update({ status: "failed", updated_at: new Date().toISOString() }, { count: "exact" })
      .eq("id", row.id)
      .eq("status", "pending");
    if (update.error) error = update.error;
    else if (update.count === 1) closed.push(row);
  }
  if (error) {
    console.error("[verification] close pending challenge on leave failed", {
      chat_id: chatId,
      user_id: member.id,
      error_code: error.code ?? "unknown",
    });
    await logModeration(adminClient, {
      groupId: chatId,
      userId: member.id,
      username: member.username ?? null,
      action: "verification_close_on_leave_failed",
      reason: `member_left:${error.code ?? "unknown"}`,
    }).catch(() => undefined);
    return;
  }
  for (const row of closed) {
    if (row.captcha_message_id) {
      await deleteMessage(chatId, row.captcha_message_id).catch(() => undefined);
    }
    await logModeration(adminClient, {
      groupId: chatId,
      userId: member.id,
      username: member.username ?? null,
      action: "verification_cancelled_member_left",
      reason: "member_left",
      messageId: row.captcha_message_id,
    }).catch(() => undefined);
  }
}

async function handleChatMemberUpdate(update: TelegramUpdate, req: Request): Promise<void> {
  const evt = update.chat_member;
  const { adminClient } = getClients(req);
  console.log("[webhook] chat_member event:", JSON.stringify({
    chat_id: evt?.chat?.id,
    chat_type: evt?.chat?.type,
    old: evt?.old_chat_member?.status,
    new: evt?.new_chat_member?.status,
    old_is_member: evt?.old_chat_member?.is_member,
    is_member: evt?.new_chat_member?.is_member,
    user: evt?.new_chat_member?.user?.id,
    is_bot: evt?.new_chat_member?.user?.is_bot,
  }));
  if (!evt?.chat?.id) return;
  if (!isGroup(evt.chat.type)) { console.log("[webhook] skip: not group"); return; }
  const chatId = evt.chat.id;

  // A restricted user who leaves stays "restricted" with is_member=false;
  // normalise so leave/rejoin is detected for every managed group.
  const oldStatus = effectiveMemberStatus(evt.old_chat_member?.status, evt.old_chat_member?.is_member);
  const newStatus = effectiveMemberStatus(evt.new_chat_member?.status, evt.new_chat_member?.is_member);
  const member = evt.new_chat_member?.user;
  if (!member?.id || member.is_bot) { console.log("[webhook] skip: no member or is_bot"); return; }

  const isNewJoin = shouldProcessChatMemberJoin({
    oldStatus,
    newStatus,
    isMember: evt.new_chat_member?.is_member,
    isBot: member.is_bot,
  });

  // Persist before join side effects; the production unique key makes this idempotent.
  let memberEventResult;
  try {
    memberEventResult = await logMemberEvent(adminClient, {
      chatId: chatId,
      user: member,
      oldStatus,
      newStatus,
      fromActor: evt.from,
      inviteLink: evt.invite_link,
      occurredAt: evt.date ? new Date(evt.date * 1000) : undefined,
      metadata: {
        is_member: evt.new_chat_member?.is_member ?? true,
        via_chat_folder_invite_link: (evt as unknown as { via_chat_folder_invite_link?: boolean }).via_chat_folder_invite_link ?? false,
        via_join_request: (evt as unknown as { via_join_request?: boolean }).via_join_request ?? false,
        member: {
          id: member.id,
          is_bot: member.is_bot ?? false,
          first_name: member.first_name ?? "",
          last_name: member.last_name ?? "",
          username: member.username ?? null,
        },
      },
    });
  } catch (e) {
    console.error("[webhook] member event persistence threw", {
      chat_id: chatId,
      user_id: member.id,
      error_name: e instanceof Error ? e.name : "unknown",
    });
    if (isNewJoin) {
      await logModeration(adminClient, {
        groupId: chatId,
        userId: member.id,
        username: member.username ?? null,
        action: "member_event_persist_failed",
        reason: "chat_member:exception",
      }).catch(() => undefined);
    }
    throw new Error("member_event_persist_failed");
  }

  if (memberEventResult.kind === "error") {
    console.error("[webhook] member event persistence failed", {
      chat_id: chatId,
      user_id: member.id,
      error_code: memberEventResult.errorCode,
    });
    if (isNewJoin) {
      await logModeration(adminClient, {
        groupId: chatId,
        userId: member.id,
        username: member.username ?? null,
        action: "member_event_persist_failed",
        reason: `chat_member:${memberEventResult.errorCode}`,
      }).catch(() => undefined);
    }
    throw new Error("member_event_persist_failed");
  }

  if (isMemberLeaveTransition(oldStatus, newStatus)) {
    await closePendingChallengesOnLeave(adminClient, chatId, member);
  }

  if (!isNewJoin) {
    console.log("[webhook] skip welcome: not a newly joined member", {
      oldStatus,
      newStatus,
      is_member: evt.new_chat_member?.is_member,
    });
    return;
  }

  if ((memberEventResult.kind !== "inserted" && memberEventResult.kind !== "duplicate") || !memberEventResult.eventId) {
    console.error("[webhook] join event has no durable recovery row", { chat_id: chatId, user_id: member.id });
    throw new Error("join_event_recovery_row_missing");
  }
  const decision = joinEventDispatchDecision({
    status: memberEventResult.processingStatus ?? null,
    inserted: memberEventResult.kind === "inserted",
  });
  if (decision !== "claim") {
    console.log("[webhook] join event is not claimable", {
      chat_id: chatId,
      user_id: member.id,
      status: memberEventResult.processingStatus ?? null,
      reason: decision,
    });
    return;
  }

  const claim = await (adminClient as any).rpc("tg_claim_join_event", {
    p_id: memberEventResult.eventId,
    p_lease_seconds: 90,
  });
  if (claim.error) {
    throw new Error(`join_event_claim_failed:${claim.error.code ?? "unknown"}`);
  }
  if (typeof claim.data !== "string") {
    console.log("[webhook] join event claim not acquired", {
      chat_id: chatId,
      user_id: member.id,
      error_code: claim.error?.code ?? null,
    });
    return;
  }
  const leaseToken = claim.data;
  const deliveryTracker: { state: "not_sent" | "sending" | "sent" | "uncertain" } = { state: "not_sent" };
  const delivery: JoinDeliveryHooks = {
    begin: async () => {
      let begun = await adminClient.rpc("tg_begin_join_delivery", {
        p_id: memberEventResult.eventId,
        p_token: leaseToken,
      });
      if (!begun.error && begun.data === true) {
        deliveryTracker.state = "sending";
        return true;
      }
      const renewed = await adminClient.rpc("tg_renew_join_lease", {
        p_id: memberEventResult.eventId,
        p_token: leaseToken,
        p_seconds: 60,
      });
      if (renewed.error || renewed.data !== true) return false;
      begun = await adminClient.rpc("tg_begin_join_delivery", {
        p_id: memberEventResult.eventId,
        p_token: leaseToken,
      });
      const ok = !begun.error && begun.data === true;
      if (ok) deliveryTracker.state = "sending";
      return ok;
    },
    report: (result) => {
      deliveryTracker.state = result.ok
        ? "sent"
        : telegramDeliveryFailure(result.status) === "transport_ambiguous"
        ? "uncertain"
        : "not_sent";
    },
  };
  const finish = async (status: "done" | "failed" | "needs_review", outcome: string, error?: string) => {
    const result = await adminClient.rpc("tg_finish_join_event", {
      p_id: memberEventResult.eventId,
      p_token: leaseToken,
      p_status: status,
      p_outcome: outcome,
      p_delivery: deliveryTracker.state === "sending" ? "uncertain" : deliveryTracker.state,
      p_error: error?.slice(0, 240) ?? null,
    });
    if (result.error || result.data !== true) {
      console.warn("[webhook] join event finish rejected", {
        chat_id: chatId,
        user_id: member.id,
        error_code: result.error?.code ?? "lease_lost",
      });
    }
  };

  let outcome = "join_flow_failed";
  let failure: string | undefined;
  try {
    const settingsLookup = await loadGroupSettings(adminClient, chatId);
    if (!settingsLookup.ok) {
      await logModeration(adminClient, {
        groupId: chatId,
        userId: member.id,
        username: member.username ?? null,
        action: "settings_lookup_failed",
        reason: `chat_member:${settingsLookup.errorCode}`,
      });
      outcome = "settings_lookup_failed";
    } else if (!settingsLookup.settings) {
      await logModeration(adminClient, {
        groupId: chatId,
        userId: member.id,
        username: member.username ?? null,
        action: "welcome_skipped_no_settings",
        reason: "chat_member",
      });
      outcome = "settings_missing";
    } else {
      const settings = settingsLookup.settings;
      console.log("[webhook] settings lookup", { chat_id: chatId, found: true, welcome_enabled: settings.welcome_enabled });

      const gateOutcome = await runJoinGate(adminClient, {
        groupId: chatId,
        member,
        settings: settings as CommunitySettings & Record<string, unknown>,
        reason: "chat_member",
      });
      const gateDisposition = joinGateFailureDisposition(gateOutcome, settings.verification_enabled);
      if (gateDisposition === "stop_removed") {
        outcome = "join_guard_removed";
      } else if (gateDisposition === "stop_unremoved") {
        await logModeration(adminClient, {
          groupId: chatId,
          userId: member.id,
          username: member.username ?? null,
          action: "join_guard_failed_verification_disabled",
          reason: "member_not_removed_and_verification_disabled",
        });
        outcome = "join_guard_failed_verification_disabled";
      } else if (resolveJoinFlow({
        verificationEnabled: settings.verification_enabled,
        welcomeEnabled: settings.welcome_enabled,
      }) === "skip") {
        await logModeration(adminClient, {
          groupId: chatId,
          userId: member.id,
          username: member.username ?? null,
          action: "welcome_skipped_disabled",
          reason: "welcome_and_verification_disabled",
        });
        outcome = "welcome_and_verification_disabled";
      } else {
        outcome = await startVerificationForMember(adminClient, {
          groupId: chatId,
          member,
          settings,
          reason: "chat_member",
          delivery,
        });
      }
    }
  } catch (error) {
    failure = error instanceof Error ? error.message : "join flow threw";
    outcome = "join_flow_exception";
    console.error("[webhook] join flow failed", {
      chat_id: chatId,
      user_id: member.id,
      error_name: error instanceof Error ? error.name : "unknown",
    });
  }
  const status = joinEventCompletionStatus(outcome, deliveryTracker.state);
  if (status === "needs_review") {
    await logModeration(adminClient, {
      groupId: chatId,
      userId: member.id,
      username: member.username ?? null,
      action: "join_delivery_uncertain",
      reason: outcome,
    }).catch(() => undefined);
  }
  await finish(status, outcome, failure);
  console.log("[webhook] join flow completed", {
    chat_id: chatId,
    user_id: member.id,
    update_id: update.update_id ?? null,
    outcome,
  });
}

async function handleUnauthorizedGroup(
  adminClient: ReturnType<typeof getClients>["adminClient"],
  update: TelegramUpdate,
): Promise<void> {
  await handleBotInvite(update, {
    lookup: async () => "unmanaged", // Caller has successfully read settings; RPC rechecks settings before the atomic invitation claim.
    claim: async (event) => {
      const result = await adminClient.rpc("tg_claim_unauthorized_bot_invite", {
        p_group_id: event.chatId, p_bot_id: event.botId,
        p_update_id: event.updateId, p_event_date: event.eventDate,
      });
      return !result.error && typeof result.data === "string" ? result.data : null;
    },
    send: async (event) => callCommunityTelegram("sendMessage", {
      chat_id: event.chatId,
      text: [
        "⚠️ <b>Angel AI chưa được phép hoạt động trong nhóm này.</b>",
        `Group ID: <code>${event.chatId}</code>`,
        `Tên nhóm: <b>${escapeHtml(event.groupName?.trim() || "(chưa xác định)")}</b>`,
        "Vui lòng thêm Group ID vào Managed Groups rồi mời lại bot.",
      ].join("\n"),
      parse_mode: "HTML", disable_web_page_preview: true,
    }),
    leave: async (event) => {
      const result = await leaveChat(event.chatId);
      return { ok: result.ok && result.data?.result === true };
    },
    audit: async (action, reason, event) => {
      const metadata = { action, reason, chat_id: event.chatId, update_id: event.updateId, event_date: event.eventDate };
      console.log("[TELEGRAM_UNAUTHORIZED_INVITE]", metadata);
      await logModeration(adminClient, {
        groupId: event.chatId, action,
        reason: `my_chat_member;update:${event.updateId};date:${event.eventDate};${reason}`,
      });
    },
  });
}

async function handleMyChatMemberUpdate(update: TelegramUpdate, req: Request): Promise<void> {
  const evt = update.my_chat_member;
  if (!evt?.chat?.id || !isGroup(evt.chat.type)) return;

  const { adminClient } = getClients(req);
  const oldStatus = evt.old_chat_member?.status;
  const newStatus = evt.new_chat_member?.status;
  const bot = evt.new_chat_member?.user;
  console.log("[webhook] my_chat_member event:", JSON.stringify({
    chat_id: evt.chat.id,
    chat_type: evt.chat.type,
    old: oldStatus,
    new: newStatus,
    bot_id: bot?.id,
    is_bot: bot?.is_bot,
  }));

  const joinedStatuses = new Set(["member", "administrator", "restricted"]);
  if (!joinedStatuses.has(newStatus ?? "")) return;

  const settingsLookup = await loadGroupSettings(adminClient, evt.chat.id);
  if (!settingsLookup.ok) {
    console.error("[webhook] my_chat_member skipped: settings lookup failed", { chat_id: evt.chat.id, error_code: settingsLookup.errorCode });
    throw new Error("my_chat_member_settings_unverified");
  }
  const settings = settingsLookup.settings;
  if (!settings) {
    await handleUnauthorizedGroup(adminClient, update);
    return;
  }

  await logModeration(adminClient, {
    groupId: evt.chat.id,
    userId: bot?.id ?? null,
    username: bot?.username ?? null,
    action: "authorized_group_joined",
    reason: "my_chat_member",
  }).catch((error) => console.warn("[webhook] authorized group join log failed", error));
}

async function processUpdate(update: TelegramUpdate, req: Request): Promise<void> {
  const receivedMessage = update.message ?? update.edited_message;
  if (receivedMessage && isGroup(receivedMessage.chat?.type)) {
    console.log("[TELEGRAM_MODERATION]", {
      event: "telegram_update_received",
      update_id: update.update_id ?? null,
      update_types: Object.keys(update).filter((key) => key !== "update_id"),
      chat_id: receivedMessage.chat?.id ?? null,
      message_id: receivedMessage.message_id ?? null,
    });
    emitModerationPipelineEvent("telegram_message_received", receivedMessage);
  }
  try {
    if (update.my_chat_member) {
      await handleMyChatMemberUpdate(update, req);
      return;
    }
    const _adminForRules = getClients(req).adminClient;
    await loadAngelRuleOverrides(_adminForRules);
    await processExpiredVerifications(_adminForRules);


    if (update.callback_query) {
      await handleCallback(update);
      return;
    }

    if (update.chat_member) {
      await handleChatMemberUpdate(update, req);
      return;
    }

    // Channel posts: đưa vào Angel knowledge nếu channel nằm trong watched list.
    const channelPost = update.channel_post ?? update.edited_channel_post;
    if (channelPost?.chat?.id && channelPost.chat.type === "channel") {
      try {
        const { ingestChannelPost } = await import("../_shared/angel-channel-ingest.ts");
        const { adminClient } = getClients(req);
        await ingestChannelPost(adminClient, channelPost as any, {
          edited: !!update.edited_channel_post,
        });
        // Google Docs link + file attachments trong channel post → ingest
        const cp: any = channelPost;
        const cpCtx = {
          chatId: cp.chat.id,
          messageId: cp.message_id,
          chatTitle: cp.chat.title,
          chatUsername: cp.chat.username,
          postedAt: cp.date ? new Date(cp.date * 1000).toISOString() : null,
        };
        try {
          const { ingestGoogleDocsFromMessage } = await import("../_shared/angel-gdocs-ingest.ts");
          const text = cp.text || cp.caption || "";
          await ingestGoogleDocsFromMessage(adminClient, text, cpCtx);
        } catch (err) {
          console.error("[webhook] gdocs channel ingest failed", err);
        }
        try {
          const { ingestGoogleSheetsFromMessage } = await import("../_shared/angel-gsheets-ingest.ts");
          const text = cp.text || cp.caption || "";
          await ingestGoogleSheetsFromMessage(adminClient, text, cpCtx);
        } catch (err) {
          console.error("[webhook] gsheets channel ingest failed", err);
        }
        try {
          const { ingestTelegramFilesFromMessage } = await import("../_shared/angel-files-ingest.ts");
          await ingestTelegramFilesFromMessage(adminClient, cp, cpCtx);
        } catch (err) {
          console.error("[webhook] file channel ingest failed", err);
        }
        try {
          const { ingestYouTubeFromMessage } = await import("../_shared/angel-youtube-ingest.ts");
          const ytText = (cp.text || "") + "\n" + (cp.caption || "");
          await ingestYouTubeFromMessage(adminClient, ytText, cpCtx);
        } catch (err) {
          console.error("[webhook] youtube channel ingest failed", err);
        }
      } catch (err) {
        console.error("[webhook] channel_post ingest failed", err);
      }
      return;
    }

    const message = update.message ?? update.edited_message;
    if (!message?.chat?.id) return;

    const chatType = message.chat.type;
    if (chatType === "private") {
      await handlePrivateMessage(message);
      return;
    }

    if (!isGroup(chatType)) return;

    const { adminClient } = getClients(req);
    const settingsLookup = await loadGroupSettings(adminClient, message.chat.id);
    if (!settingsLookup.ok) {
      // Do not treat a managed group as unauthorized because of a transient DB error.
      console.error("[webhook] group message skipped: settings lookup failed", { chat_id: message.chat.id, error_code: settingsLookup.errorCode });
      return;
    }
    const settings = settingsLookup.settings;
    emitModerationPipelineEvent("group_moderation_config", message, {
      configuration_found: Boolean(settings),
      anti_spam_enabled: settings?.anti_spam_enabled ?? null,
      scam_protection_enabled: settings?.scam_protection_enabled ?? null,
      scam_strict_mode: settings?.scam_strict_mode ?? null,
    });
    if (!settings) {
      // A service message may accompany my_chat_member, but cannot own invite effects.
      // Also do not treat the invitation of an unrelated bot as our own invitation.
      if (message.new_chat_members?.some((member) => member.is_bot)) {
        await logModeration(adminClient, {
          groupId: message.chat.id, action: "unauthorized_group_secondary_update",
          reason: "new_chat_members;effects_owned_by_my_chat_member",
          messageId: message.message_id ?? null,
        });
        return;
      }

      if (message.new_chat_members?.length) {
        for (const member of message.new_chat_members) {
          if (member.is_bot) continue;
          await logModeration(adminClient, {
            groupId: message.chat.id,
            userId: member.id ?? null,
            username: member.username ?? null,
            action: "welcome_skipped_no_settings",
            reason: "new_chat_members",
            messageId: message.message_id ?? null,
          });
        }
        // Váº«n xoÃ¡ tin "joined the group" Ä‘á»ƒ group khÃ´ng bá»‹ rá»‘i dÃ¹ chÆ°a cÃ³ settings.
        if (message.message_id) {
          await deleteMessage(message.chat.id, message.message_id).catch(() => undefined);
        }
      }
      // Group nÃ y chÆ°a Ä‘Æ°á»£c Cha thÃªm trong admin panel â†’ bá» qua hoÃ n toÃ n.
      await logModeration(adminClient, {
        groupId: message.chat.id, action: "unauthorized_group_message_ignored",
        reason: "message_no_settings;effects_owned_by_my_chat_member",
        messageId: message.message_id ?? null,
      });
      return;
    }

    // [SENDER CHAT] â€” log every message sent "as Channel" (sender_chat) so we can
    // see whether it is trusted. Never match on title/display name.
    emitModerationPipelineEvent("moderation_started", message, {
      phase: "scam_protection",
      anti_spam_enabled: settings.anti_spam_enabled,
      scam_protection_enabled: settings.scam_protection_enabled !== false,
      scam_strict_mode: settings.scam_strict_mode === true,
    });
    const scamHandled = await handleTelegramScamDetection({
      adminClient,
      message,
      settings,
      msgType: classifyMessageType(message),
    });
    emitModerationPipelineEvent("moderation_result", message, {
      phase: "scam_protection",
      action: scamHandled ? "scam_actioned_stop" : "no_scam_continue",
      anti_spam_enabled: settings.anti_spam_enabled,
      scam_protection_enabled: settings.scam_protection_enabled !== false,
      scam_strict_mode: settings.scam_strict_mode === true,
    });
    if (scamHandled) return;

    if (message.sender_chat?.id && message.chat?.id) {
      const trusted = await isTrustedSenderChat(
        adminClient,
        message.chat.id,
        message.sender_chat.id,
      );
      console.log(
        `[SENDER CHAT] chat_id=${message.chat.id} sender_chat_id=${message.sender_chat.id} sender_chat_title="${(message.sender_chat.title ?? "").replace(/"/g, "'")}" trusted=${trusted}`,
      );
    }

    // [DISCUSSION COMMENT] — bài mới của channel được auto-forward vào group
    // thảo luận, hoặc thành viên hỏi ngay dưới bài đó → Angel bình luận thông minh.
    try {
      const { handleDiscussionComment, isChannelPostForward, isMemberCommentOnPost } =
        await import("../_shared/angel-discussion-comment.ts");
      if (isChannelPostForward(message as any) || isMemberCommentOnPost(message as any)) {
        const commented = await handleDiscussionComment(adminClient, message as any, {
          askAngel: askAngel as any,
          sendMessage: sendMessage as any,
          settings: settings as unknown as Record<string, unknown>,
        });
        if (commented) return;
        if (isChannelPostForward(message as any)) return;
      }
    } catch (err) {
      console.error("[webhook] discussion comment failed", err);
    }


    if (message.new_chat_members?.length) {
      // Telegram thường gửi cả `chat_member` và `message.new_chat_members` cho
      // cùng lượt vào nhóm. `chat_member` là luồng gửi welcome/captcha chính;
      // message chỉ ghi nhận để tránh gửi trùng, nhất là khi captcha đang tắt.
      for (const member of message.new_chat_members) {
        if (member.is_bot) continue;
        await logModeration(adminClient, {
          groupId: message.chat.id,
          userId: member.id ?? null,
          username: member.username ?? null,
          action: "welcome_skipped_dedup",
          reason: "new_chat_members",
          messageId: message.message_id ?? null,
        });
      }
      if (message.message_id) {
        await deleteMessage(message.chat.id, message.message_id).catch(() => undefined);
      }
      return;
    }

    const text = extractText(message);

    // Angel knowledge ingest: CHỈ áp dụng cho channel post (đã có filter
    // angel_watched_channels ở khối channel_post phía trên). Group message
    // KHÔNG ingest — theo quyết định chỉ theo dõi channel trong Angel Channel tab.


    if (/^\/id(@|\s|$)/i.test(text)) {
      await sendMessage(message.chat.id, `Group ID: <code>${message.chat.id}</code>`);
      return;
    }

    // /aitest <prompt> â€” Ã©p Angel AI tráº£ lá»i ngay (bypass Privacy Mode vÃ¬ lÃ  slash command).
    // DÃ¹ng Ä‘á»ƒ cháº©n Ä‘oÃ¡n: náº¿u /aitest tráº£ lá»i Ä‘Æ°á»£c nhÆ°ng tin nháº¯n thÆ°á»ng + @mention khÃ´ng
    // â†’ váº¥n Ä‘á» lÃ  Privacy Mode hoáº·c cáº¥u hÃ¬nh quyá»n bot trong group.
    const aitestMatch = text.match(/^\/aitest(?:@\S+)?\s*([\s\S]*)$/i);
    if (aitestMatch) {
      const prompt = (aitestMatch[1] || "").trim() ||
        "Xin chào, tôi là người mới, hãy giới thiệu FUN.RICH cho tôi.";
      const fromId = message.from?.id ?? 0;
      console.log(
        `[telegram-community-webhook] aitest_fire chatId=${message.chat.id} userId=${fromId} prompt="${prompt.slice(0, 80)}"`,
      );
      // Per-group reply language (same rule as the group AI flow): prefer the
      // group's own settings row, fall back to the global one.
      let aitestGroupSettings: CommunitySettings | null = null;
      try {
        const { adminClient: aitestAdminClient } = getClients(req);
        aitestGroupSettings = await getSettingsForGroup(aitestAdminClient, message.chat.id);
      } catch (err) {
        console.warn("[GROUP_LANG] aitest group settings lookup failed; falling back to global", {
          chatId: message.chat.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
      const aitestLanguage = resolveGroupReplyLanguage(
        prompt,
        aitestGroupSettings?.reply_language ?? "auto",
      );
      try {
        const reply = await askAngel({
          question: prompt,
          originalUserMessage: prompt,
          systemPrompt: settings.ai_system_prompt,
          userLabel: fullName(message.from ?? {}),
          personaMode: (settings as any).persona_mode,
          personaCustomPrompt: (settings as any).persona_custom_prompt,
          funCoreContextPrompt: settings.fun_core_context_prompt,
          aiStylePrompt: (settings as any).ai_style_prompt,
          aiPersonaPrompt: (settings as any).ai_persona_prompt,
          adminClient,
          conversationContext: {
            chatId: message.chat.id,
            chatType: message.chat?.type ?? null,
            groupId: message.chat.id,
            userId: fromId,
            username: message.from?.username ?? null,
            fullName: fullName(message.from ?? {}),
            messageId: message.message_id ?? null,
            triggerSource: "aitest",
          },
          forcedLangBucket: aitestLanguage.bucket,
          languagePolicyNote: aitestLanguage.policyNote,
          fallbackLangBucket: aitestLanguage.botVoiceBucket ?? aitestLanguage.bucket,
          mirrorAngelWeb: (settings as any).ai_mirror_angel_web !== false,
        });
        await sendMessage(message.chat.id, reply, { reply_to_message_id: message.message_id, skipAutoDelete: true });
      } catch (err) {
        console.error("[telegram-community-webhook] aitest_error", err);
        await sendMessage(
          message.chat.id,
          `❌ <b>/aitest lỗi</b>\n<code>${escapeHtml(
            (err instanceof Error ? err.message : String(err)).slice(0, 300),
          )}</code>`,
          { reply_to_message_id: message.message_id },
        );
      }
      return;
    }

    // /angel-debug <query> â€” cháº©n Ä‘oÃ¡n RAG: gá»i cáº£ Lovable Gateway vÃ  FUN Core
    // vá»›i cÃ¹ng 1 cÃ¢u há»i vÃ  in side-by-side Ä‘á»ƒ Cha xem provider nÃ o tráº£ Ä‘Ãºng knowledge.
    const debugMatch = text.match(/^\/angel[-_]?debug(?:@\S+)?\s*([\s\S]*)$/i);
    if (debugMatch) {
      const query = (debugMatch[1] || "").trim() || "cho con bài thiền 9 tầng tự do";
      const envProvider = getAngelProvider();
      console.log(
        `[telegram-community-webhook] angel_debug_fire chatId=${message.chat.id} envProvider=${envProvider} q="${query.slice(0, 100)}"`,
      );

      async function probe(prov: "lovable" | "funcore"): Promise<string> {
        const t0 = Date.now();
        try {
          const r = await callAngelCore({
            forceProvider: prov,
            model: prov === "lovable" ? "google/gemini-2.5-flash" : undefined,
            max_tokens: 1500,
            messages: [{ role: "user", content: query }],
          });
          const dur = Date.now() - t0;
          const rawKeys = r.raw && typeof r.raw === "object"
            ? Object.keys(r.raw as Record<string, unknown>).join(",")
            : "";
          const preview = r.text.slice(0, 250).replace(/\n/g, " ");
          return `<b>${prov}</b> ✅ ${dur}ms · len=${r.text.length} · keys=[${escapeHtml(rawKeys)}]\n<code>${escapeHtml(preview)}${r.text.length > 250 ? "…" : ""}</code>`;
        } catch (err) {
          const dur = Date.now() - t0;
          const status = err instanceof AngelCoreError ? err.status : 0;
          const msg = err instanceof Error ? err.message : String(err);
          return `<b>${prov}</b> ❌ ${dur}ms · status=${status}\n<code>${escapeHtml(msg.slice(0, 250))}</code>`;
        }
      }

      const [lovableRes, funcoreRes] = await withTyping(message.chat.id, () => Promise.all([probe("lovable"), probe("funcore")]));
      const out = `🔍 <b>/angel-debug</b> (envProvider=<code>${envProvider}</code>)\n<b>Q:</b> <code>${escapeHtml(query.slice(0, 200))}</code>\n\n${lovableRes}\n\n${funcoreRes}`;
      await sendMessage(message.chat.id, out, { reply_to_message_id: message.message_id, skipAutoDelete: true });
      return;
    }



    if (await handleWelcomeCommand(message, settings)) {
      return;
    }

    // HÆ°á»›ng C: slash-command trong group Ä‘Æ°á»£c xá»­ lÃ½ trÆ°á»›c moderation
    // Ä‘á»ƒ khÃ´ng bá»‹ anti-spam Ä‘áº¿m vÃ  Ä‘á»ƒ Angel khÃ´ng tráº£ lá»i nháº§m.
    if (await handleGroupCommand(message, settings)) {
      return;
    }

    const wasActioned = await evaluateModeration(message, settings);
    if (wasActioned) return;
    // Lịch thiền phải chạy TRƯỚC Event Assistant: nhóm tắt event_assistant vẫn
    // cần bot tóm tắt chủ đề bài thiền.
    const meditationSummary = await handleMeditationSummaryInvite(message, settings);
    if (meditationSummary.handled) return;
    if (await handleEventAssistant(message, settings)) return;
    if (await handleQuickReply(message)) return;
    await handleGroupAiMention(message, settings);

  } catch (error) {
    console.error("[telegram-community-webhook] handler error", error);
    try {
      const message = update.message ?? update.edited_message;
      const chatId = message?.chat?.id;
      const userId = message?.from?.id;
      const errorMessage = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      if (message?.chat?.type === "private" && chatId) {
        await sendMessage(
          chatId,
          "Angel vừa gặp lỗi xử lý tin nhắn riêng một chút. Bé gửi lại giúp Angel câu hỏi này sau vài giây nhé. 💛",
          { skipAutoDelete: true },
        ).catch((sendErr) => console.error("[telegram-community-webhook] private fallback failed", sendErr));
      }
      if (chatId) {
        const { adminClient } = getClients(req);
        await logModeration(adminClient, {
          groupId: chatId,
          userId,
          username: message?.from?.username ?? null,
          action: "error",
          reason: `handler_error:${errorMessage.slice(0, 90)}`,
          messageText: `${extractText(message ?? {})}\nERROR: ${errorMessage}`.slice(0, 500),
          messageId: message?.message_id ?? null,
        });
      }
  } catch {
    // Keep stable even if logging fails.
  }
  if (update.chat_member || update.my_chat_member) throw new Error("membership_update_processing_failed");
}
}

Deno.serve(withUsage('telegram-community-webhook', 'Angel AI · Telegram', async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: communityCorsHeaders });
  if (req.method !== "POST") return json({ ok: true, ignored: "method" });

  if (!verifyCommunityWebhookSecret(req)) {
    return json({ error: "Unauthorized" }, 401);
  }

  let update: TelegramUpdate;
  try {
    update = (await req.json()) as TelegramUpdate;
  } catch (error) {
    console.warn("[telegram-community-webhook] invalid JSON", error);
    return json({ ok: true, ignored: "invalid_json" });
  }

  // Tráº£ 200 NGAY cho Telegram Ä‘á»ƒ khÃ´ng bao giá» bá»‹ 502 dÃ¹ AI call cháº­m.
  // Xá»­ lÃ½ náº·ng (moderation, AI) cháº¡y ná»n qua EdgeRuntime.waitUntil.
  const message = update.message ?? update.edited_message;
  const text = message ? extractText(message) : "";
  const shouldRunInline = Boolean(
    update.chat_member || update.my_chat_member ||
      message?.new_chat_members?.length ||
      (message?.chat?.type && isGroup(message.chat.type) && /^\/(?:welcome|id|aitest|angel[-_]?debug|register_sender_chat)(@|\s|$)/i.test(text)),
  );


  if (shouldRunInline) {
    try {
      await processUpdate(update, req);
    } catch (error) {
      if (update.chat_member || update.my_chat_member) {
        console.error("[telegram-community-webhook] membership update not durably accepted", {
          update_id: update.update_id ?? null,
          error_name: error instanceof Error ? error.name : "unknown",
        });
        return json({ error: "Temporary processing failure" }, 503);
      }
      throw error;
    }
    return json({ ok: true });
  }

  const work = processUpdate(update, req);
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
    EdgeRuntime.waitUntil(work);
  } else {
    // Fallback: váº«n fire-and-forget nhÆ°ng nuá»‘t lá»—i Ä‘á»ƒ khá»i crash response.
    work.catch((e) => console.error("[telegram-community-webhook] bg error", e));
  }
  return json({ ok: true });
}));
