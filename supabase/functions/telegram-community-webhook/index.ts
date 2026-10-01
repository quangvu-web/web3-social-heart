import {
  activeDomains,
  activeKeywords,
  answerCallbackQuery,
  applyViolation,
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
import { loadAngelRuleOverrides } from "../_shared/angel-facts.ts";
import {
  scanJoinName,
  scanAvatarImage,
  avatarVerdictBlocks,
  joinGuardNameOptions,
} from "../_shared/telegram-join-guard.ts";
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
      console.warn("[quick-reply] load failed", error);
      return quickReplyCache?.rules ?? [];
    }
    const rules = (data ?? [])
      .map((row) => compileQuickReplyRule(row as never))
      .filter((r): r is QuickReplyRule => !!r);
    quickReplyCache = { at: now, rules };
    return rules;
  } catch (err) {
    console.warn("[quick-reply] load exception", err);
    return quickReplyCache?.rules ?? [];
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
  status: "pending" | "verified" | "failed" | "expired";
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

async function restrictPendingMember(chatId: number, userId: number, settings: CommunitySettings) {
  const timeoutSeconds = Number(settings.verification_timeout_seconds) || 180;
  const untilUnix = Math.floor(Date.now() / 1000) + Math.max(timeoutSeconds, 180) + 600;
  return restrictChatMember(chatId, userId, untilUnix);
}

async function punishUnverifiedMember(
  adminClient: ReturnType<typeof getClients>["adminClient"],
  challenge: VerificationChallenge,
  settings: CommunitySettings | null,
  actionReason: "verification_failed" | "verification_expired",
) {
  const action = settings?.verification_failure_action ?? "kick";
  if (action === "mute") {
    const untilUnix = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
    await restrictChatMember(challenge.group_id, challenge.telegram_user_id, untilUnix);
  } else {
    await kickChatMember(challenge.group_id, challenge.telegram_user_id);
  }

  await adminClient
    .from("telegram_community_verification_challenges")
    .update({ status: actionReason === "verification_expired" ? "expired" : "failed" })
    .eq("id", challenge.id);

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

  await logModeration(adminClient, {
    groupId: challenge.group_id,
    userId: challenge.telegram_user_id,
    username: challenge.username,
    action,
    reason: actionReason,
    messageId: challenge.captcha_message_id,
  });
}

async function processExpiredVerifications(adminClient: ReturnType<typeof getClients>["adminClient"]) {
  const { data: expired } = await adminClient
    .from("telegram_community_verification_challenges")
    .select("*")
    .eq("status", "pending")
    .lte("expires_at", new Date().toISOString())
    .limit(20);

  for (const challenge of (expired ?? []) as VerificationChallenge[]) {
    const settings = await getSettingsForGroup(adminClient, challenge.group_id);
    await punishUnverifiedMember(adminClient, challenge, settings, "verification_expired");
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
) {
  await unrestrictChatMember(params.groupId, params.userId);
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

  await sendWelcomeToMember(adminClient, {
    groupId: params.groupId,
    member: {
      id: params.userId,
      first_name,
      last_name,
      username: params.username ?? undefined,
    } as NonNullable<TelegramMessage["from"]>,
    settings: effectiveSettings,
    reason: "captcha_correct",
    messageId: params.captchaMessageId ?? null,
  });

  await logModeration(adminClient, {
    groupId: params.groupId,
    userId: params.userId,
    username: params.username ?? null,
    action: "verification_verified",
    reason: "captcha_correct",
    messageId: params.captchaMessageId ?? null,
  });
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
): Promise<boolean> {
  const { groupId, member, settings } = params;
  if (!member?.id || member.is_bot) return false;

  const label = fullName(member) + (member.username ? ` (@${member.username})` : "");
  const nameEnabled = (settings as any).join_guard_name_enabled !== false;
  const avatarEnabled = (settings as any).join_guard_avatar_enabled !== false;
  const action = ((settings as any).join_guard_action ?? "ban") === "kick" ? "kick" : "ban";

  const remove = async (logAction: string, reasonText: string) => {
    try {
      if (action === "kick") await kickChatMember(groupId, member.id!);
      else await banChatMember(groupId, member.id!);
    } catch (e) {
      console.error("[join-guard] remove failed", e);
      await logModeration(adminClient, {
        groupId,
        userId: member.id ?? null,
        username: member.username ?? null,
        action: "join_guard_remove_failed",
        reason: reasonText,
      }).catch(() => undefined);
      return false;
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
      await sendMessage(
        alertChat,
        [
          `🚫 <b>Đã chặn thành viên khi vào nhóm</b>`,
          `Nhóm: <code>${groupId}</code>`,
          `Thành viên: <b>${escapeHtml(label)}</b> — <code>${member.id}</code>`,
          `Lý do: ${escapeHtml(reasonText)}`,
          `Hành động: ${action === "kick" ? "Mời ra khỏi nhóm" : "Chặn vĩnh viễn"}`,
        ].join("\n"),
      ).catch(() => undefined);
    }
    return true;
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

  return false;
}

async function startVerificationForMember(
  adminClient: ReturnType<typeof getClients>["adminClient"],
  params: {
    groupId: number;
    member: NonNullable<TelegramMessage["from"]>;
    settings: CommunitySettings;
    reason: string;
  },
) {
  if (!params.member.id || params.member.is_bot) return;
  await upsertUserState({ adminClient, groupId: params.groupId, user: params.member });

  if (!params.settings.verification_enabled) {
    await sendWelcomeToMember(adminClient, {
      groupId: params.groupId,
      member: params.member,
      settings: params.settings,
      reason: `${params.reason}_verification_disabled`,
    });
    return;
  }

  const existing = await adminClient
    .from("telegram_community_verification_challenges")
    .select("*")
    .eq("group_id", params.groupId)
    .eq("telegram_user_id", params.member.id)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (existing.data) return;

  await restrictPendingMember(params.groupId, params.member.id, params.settings);
  const captcha = buildMathCaptcha();
  const memberName = fullName(params.member);
  const timeoutSeconds = Number(params.settings.verification_timeout_seconds) || 180;
  const maxAttempts = Number(params.settings.verification_max_attempts) || 3;
  const expiresAt = new Date(Date.now() + Math.max(timeoutSeconds, 60) * 1000);
  const { data: challenge, error } = await adminClient
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
    .select("*")
    .single();

  if (error || !challenge) {
    await logModeration(adminClient, {
      groupId: params.groupId,
      userId: params.member.id,
      username: params.member.username ?? null,
      action: "verification_create_failed",
      reason: error?.message ?? "unknown",
    });
    return;
  }

  const text = formatTemplate(params.settings.verification_prompt_message || "Welcome {full_name}! Please verify: {question}", {
    full_name: memberName,
    name: memberName,
    question: captcha.question,
    expires_minutes: Math.ceil(timeoutSeconds / 60),
  });
  const sent = await sendMessage(params.groupId, text, { reply_markup: captchaMarkup(challenge.id, captcha.options) });
  if (sent.ok && sent.data?.result?.message_id) {
    await adminClient
      .from("telegram_community_verification_challenges")
      .update({ captcha_message_id: sent.data.result.message_id })
      .eq("id", challenge.id);
  }
  await logModeration(adminClient, {
    groupId: params.groupId,
    userId: params.member.id,
    username: params.member.username ?? null,
    action: sent.ok ? "verification_started" : "verification_send_failed",
    reason: params.reason,
    messageText: sent.ok ? null : JSON.stringify(sent.data ?? sent).slice(0, 500),
    messageId: sent.data?.result?.message_id ?? null,
  });

  if (sent.ok) {
    scheduleVerificationExpiryCheck(challenge.id, Math.max(timeoutSeconds, 60) * 1000 + 1000);
  }
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


async function withTyping<T>(chatId: number | string, task: () => Promise<T>): Promise<T> {
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
      const res = await sendMessage(chatId, "💛 Angel đang nghĩ…", { skipAutoDelete: true });
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


async function handlePrivateMessage(message: TelegramMessage) {
  const chatId = message.chat?.id;
  if (!chatId) return;
  let text = extractText(message);
  const { adminClient } = getClients();

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
  const tgUserId = message.from?.id;
  const incomingMsgId = message.message_id ?? null;
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
      console.warn("[dm] ai_rate_failed_open", { chatId, userId: message.from?.id, error: err instanceof Error ? err.message : String(err) });
      return { allowed: true, count: 0 };
    });
    console.log("[dm] ai_rate", { chatId, userId: message.from.id, allowed: rate.allowed, count: rate.count });
    if (!rate.allowed) {
      await replyDm("🙏 You're sending a bit too fast. Angel needs a short break — please try again in about a minute 💛");
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
          b64: _dmImageOut.image_base64,
          url: _dmImageOut.image_url,
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
  const { data: challengeRow } = await adminClient
    .from("telegram_community_verification_challenges")
    .select("*")
    .eq("id", challengeId)
    .maybeSingle();
  const challenge = challengeRow as VerificationChallenge | null;

  if (!challenge || challenge.status !== "pending") {
    await answerCallbackQuery(callback.id, "This verification is no longer active.");
    return true;
  }
  if (!userId || userId !== challenge.telegram_user_id) {
    await answerCallbackQuery(callback.id, "This captcha is for another member.");
    return true;
  }

  const settings = await getSettingsForGroup(adminClient, challenge.group_id);
  if (new Date(challenge.expires_at).getTime() <= Date.now()) {
    await punishUnverifiedMember(adminClient, challenge, settings, "verification_expired");
    await answerCallbackQuery(callback.id, "Verification expired.");
    return true;
  }

  if (answer === challenge.correct_answer) {
    await adminClient
      .from("telegram_community_verification_challenges")
      .update({ status: "verified", verified_at: new Date().toISOString() })
      .eq("id", challenge.id);
    if (settings) {
      await sendFinalWelcome(adminClient, {
        groupId: challenge.group_id,
        userId: challenge.telegram_user_id,
        username: challenge.username,
        fullName: challenge.full_name ?? "Member",
        settings,
        captchaMessageId: challenge.captcha_message_id,
      });
    }
    await answerCallbackQuery(callback.id, "Verified. Welcome to FUN.RICH!");
    return true;
  }

  const attempts = (challenge.attempts ?? 0) + 1;
  await adminClient
    .from("telegram_community_verification_challenges")
    .update({ attempts })
    .eq("id", challenge.id);

  const maxAttempts = challenge.max_attempts ?? settings?.verification_max_attempts ?? 3;
  if (attempts >= maxAttempts) {
    await punishUnverifiedMember(adminClient, challenge, settings, "verification_failed");
    await answerCallbackQuery(callback.id, "Too many wrong answers.");
    return true;
  }

  await answerCallbackQuery(callback.id, `Wrong answer. Attempts ${attempts}/${maxAttempts}.`);
  return true;
}

async function ensureWebhookReceivesPrivateMessages(): Promise<void> {
  try {
    const info = await callCommunityTelegram("getWebhookInfo");
    const allowedUpdates = Array.isArray(info?.data?.result?.allowed_updates)
      ? info.data.result.allowed_updates as string[]
      : null;
    if (!allowedUpdates || (allowedUpdates.includes("message") && allowedUpdates.includes("channel_post"))) return;

    const secret = Deno.env.get("COMMUNITY_GUARD_WEBHOOK_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!secret || !supabaseUrl) {
      console.warn("[webhook] cannot repair allowed_updates: missing secret or SUPABASE_URL");
      return;
    }

    const webhookUrl = `${supabaseUrl}/functions/v1/telegram-community-webhook?secret=${encodeURIComponent(secret)}`;
    const result = await callCommunityTelegram("setWebhook", {
      url: webhookUrl,
      allowed_updates: ["message", "edited_message", "channel_post", "edited_channel_post", "callback_query", "chat_member", "my_chat_member"],
      secret_token: secret,
      drop_pending_updates: false,
    });
    console.warn("[webhook] repaired allowed_updates for private messages", {
      previous: allowedUpdates,
      ok: result.ok,
      status: result.status,
    });
  } catch (err) {
    console.warn("[webhook] allowed_updates repair failed", err);
  }
}

async function handleCallback(update: TelegramUpdate) {
  if (await handleVerificationCallback(update)) return;
  const callback = update.callback_query;
  if (!callback?.id) return;
  await answerCallbackQuery(callback.id);

  const chatId = callback.message?.chat?.id ?? callback.from?.id;
  if (!chatId) return;

  if (callback.data === "ask_angel_hint") {
    await ensureWebhookReceivesPrivateMessages();
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
    messageId?: number | null;
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
      console.warn("[telegram-community] getCommunityUserAvatarUrl failed", err);
      return null;
    });
  }

  let result;
  let mode: "photo" | "text" = "text";
  if (avatarUrl) {
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
  await logModeration(adminClient, {
    groupId: params.groupId,
    userId: params.member.id ?? null,
    username: params.member.username ?? null,
    action: ok ? "welcome_sent" : "welcome_send_failed",
    reason: `${params.reason}:${mode}${avatarUrl ? "" : ":no_avatar"}`,
    messageText: ok ? null : JSON.stringify((result as { data?: unknown })?.data ?? result).slice(0, 500),
    messageId: params.messageId ?? null,
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
    messageId: message.message_id ?? null,
  });
  return true;
}

async function sendScamWarningIfAllowed(chatId: number, settings: CommunitySettings): Promise<void> {
  if (settings.scam_warning_enabled === false) return;
  const now = Date.now();
  const lastSentAt = scamWarningLastSentAt.get(chatId) ?? 0;
  if (now - lastSentAt < SCAM_WARNING_COOLDOWN_MS) return;
  scamWarningLastSentAt.set(chatId, now);
  await sendMessage(
    chatId,
    "⚠️ Cảnh báo: Tin nhắn có dấu hiệu scam/phishing đã bị xoá. Vui lòng không bấm link đáng ngờ, không nhập OTP, mật khẩu, seed phrase hoặc private key.",
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
  const deleteOutcome = await enforceScamDeletion({
    context: moderationContext,
    assessment: finalAssessment,
    deleteMessage: async () => {
      const result = await deleteMessage(chatId, messageId);
      const data = result.data as { error_code?: number; description?: string; ok?: boolean } | undefined;
      return {
        ok: result.ok === true,
        errorCode: data?.error_code,
        errorDescription: data?.description ?? (result.ok ? undefined : JSON.stringify(data ?? result).slice(0, 240)),
      };
    },
    checkDeletePermission: async () => {
      const bot = await getBotInfo();
      if (!bot) return { canDeleteMessages: null, status: "unknown", errorDescription: "getMe failed" };
      const result = await getChatMember(chatId, bot.id);
      if (!result.ok) {
        const data = result.data as { description?: string } | undefined;
        return { canDeleteMessages: null, status: "unknown", errorDescription: data?.description ?? "getChatMember failed" };
      }
      const member = result.data?.result as { status?: string; can_delete_messages?: boolean } | undefined;
      const status = member?.status ?? "unknown";
      const canDeleteMessages = status === "creator" || (status === "administrator" && member?.can_delete_messages === true);
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
    reason: detection.reason === "referral_cashback_promo"
      ? "REFERRAL_CASHBACK_PROMO"
      : `SCAM_RISK:${matchedRules.slice(0, 8).join(",")}`,
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

  if (detection.reason !== "referral_cashback_promo") {
    await sendScamWarningIfAllowed(chatId, params.settings);
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
    let deleted = false;
    let banned = false;
    let deleteError: string | null = null;
    let banError: string | null = null;

    try {
      const result = await deleteMessage(chatId, messageId);
      deleted = result.ok === true;
      if (!deleted) deleteError = JSON.stringify(result.data ?? result).slice(0, 240);
    } catch (err) {
      deleteError = err instanceof Error ? err.message : String(err);
    }

    // A direct foreign bot can continuously flood the group, so remove it at
    // once. For inline-bot messages, punish the sending user through the normal
    // warning ladder below rather than banning a possibly legitimate user here.
    if (automatedCjkScam.senderKind === "bot" && user?.id) {
      try {
        const result = await banChatMember(chatId, user.id);
        banned = result.ok === true;
        if (!banned) banError = JSON.stringify(result.data ?? result).slice(0, 240);
      } catch (err) {
        banError = err instanceof Error ? err.message : String(err);
      }
      await logModeration(adminClient, {
        groupId: chatId,
        userId: actorId,
        username: actorUsername,
        action: banned ? "automated_bot_banned" : (deleted ? "automated_scam_deleted_ban_failed" : "automated_scam_action_failed"),
        reason: "automated_cjk_scam",
        messageText: JSON.stringify({
          sender_kind: automatedCjkScam.senderKind,
          has_inline_keyboard: automatedCjkScam.hasInlineKeyboard,
          has_external_button: automatedCjkScam.hasExternalButton,
          delete_error: deleteError,
          ban_error: banError,
          preview: automatedCjkScam.payload.slice(0, 260),
        }),
        messageId,
      });
      console.log("[AUTOMATED_CJK_SCAM]", { chat_id: chatId, message_id: messageId, actor_id: actorId, deleted, banned, delete_error: deleteError, ban_error: banError });
      return true;
    }

    // Inline bot: deletion already happened; apply the existing warning/mute/ban
    // policy to the human sender without performing another delete call.
    if (user?.id) {
      const state = await upsertUserState({ adminClient, groupId: chatId, user });
      const warningCount = (state?.warning_count ?? 0) + 1;
      await adminClient
        .from("telegram_community_user_state")
        .update({ warning_count: warningCount })
        .eq("group_id", chatId)
        .eq("telegram_user_id", user.id);
      if (warningCount >= settings.warning_before_ban) {
        await banChatMember(chatId, user.id);
        banned = true;
      } else if (warningCount >= settings.warning_before_mute) {
        const untilUnix = Math.floor(Date.now() / 1000) + settings.mute_duration_minutes * 60;
        await restrictChatMember(chatId, user.id, untilUnix);
      }
      await logModeration(adminClient, {
        groupId: chatId,
        userId: user.id,
        username: user.username ?? null,
        action: banned ? "banned" : "deleted_warned",
        reason: "automated_cjk_scam:inline_bot",
        messageText: automatedCjkScam.payload,
        messageId,
      });
    }
    console.log("[AUTOMATED_CJK_SCAM]", { chat_id: chatId, message_id: messageId, actor_id: actorId, sender_kind: automatedCjkScam.senderKind, deleted, delete_error: deleteError });
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
      const ocrText = await runOcrOnPhoto(photo.fileId, photo.uniq);
      if (ocrText) {
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
    `[MODERATION] chat_id=${chatId} user_id=${violatingUserId} message_id=${messageId} message_type=${msgType} reason=${reason} count_warning=${countWarning} escalated_ban=${escalatedBan} detected_text=${JSON.stringify((detectedText || "").slice(0, 200))}`,
  );

  if (escalatedBan) {
    try { await deleteMessage(chatId, messageId); } catch (e) { console.warn("[MODERATION] deleteMessage failed", e); }
    try { await banChatMember(chatId, violatingUserId); } catch (e) { console.warn("[MODERATION] banChatMember failed", e); }
    try {
      await adminClient
        .from("telegram_community_user_state")
        .update({ banned_at: new Date().toISOString() })
        .eq("group_id", chatId)
        .eq("telegram_user_id", violatingUserId);
    } catch (e) { console.warn("[MODERATION] user_state update failed", e); }
    const label = user?.username ? `@${user.username}` : (user?.first_name ?? String(violatingUserId));
    try {
      await sendMessage(
        chatId,
        `🚫 <b>${label}</b> was permanently banned — coordinated spam pattern (mention-bait + scam follow-up).`,
      );
    } catch (e) { console.warn("[MODERATION] notify failed", e); }
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
      settings?.rules_message ?? "📜 Community rules are not configured yet. We'll update them soon.",
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
        "💌 <b>Gửi góp ý cho Angel</b>\n\nGõ: <code>/feedback &lt;nội dung góp ý&gt;</code>\nVí dụ: <code>/feedback Angel ơi, bé mong có thêm chức năng thiền buổi sáng</code>",
        replyTo,
      );
      return true;
    }
    if (body.length > 4000) {
      await sendMessage(chatId, "🙏 Nội dung góp ý hơi dài, bé rút gọn dưới 4000 ký tự giúp Angel nhé 💛", replyTo);
      return true;
    }
    try {
      const { adminClient } = getClients();
      const fromId = message.from?.id ?? null;
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      if (fromId) {
        const { count } = await adminClient
          .from("telegram_feedback")
          .select("id", { count: "exact", head: true })
          .eq("telegram_user_id", fromId)
          .gte("created_at", oneHourAgo);
        if ((count ?? 0) >= 3) {
          await sendMessage(chatId, "🙏 Angel đã nhận rất nhiều góp ý từ bé rồi, xin bé đợi ~1 giờ để Angel đọc và phản hồi nhé 💛", replyTo);
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
      await sendMessage(chatId, "🙏 Angel đã ghi nhận góp ý của bé. Cảm ơn ánh sáng minh triết bé chia sẻ 💛✨", replyTo);
    } catch (err) {
      console.warn("[group] feedback_insert_failed", { chatId, error: err instanceof Error ? err.message : String(err) });
      await sendMessage(chatId, "🙏 Angel gặp trục trặc khi lưu góp ý. Bé thử lại sau ít phút giúp Angel nhé 💛", replyTo);
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
        "🛡️ <b>Không xác minh được quyền admin.</b>\n\n" +
          "Có 3 cách đăng ký một channel/sender_chat làm <b>trusted</b>:\n\n" +
          "<b>1.</b> Dùng tài khoản admin cá nhân (không ẩn danh), <b>reply</b> vào 1 tin của channel rồi gõ <code>/register_sender_chat</code>.\n\n" +
          "<b>2.</b> Dùng tài khoản admin cá nhân, gõ <code>/register_sender_chat &lt;sender_chat_id&gt; [title]</code> (id phải bắt đầu bằng <code>-100</code>).\n\n" +
          "<b>3.</b> Bật <i>Anonymous Admin</i> của chính group này rồi gõ <code>/register_sender_chat</code>.",
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
        `❌ Lưu trusted_sender_chats thất bại: <code>${escapeHtml(res.error ?? "unknown")}</code>`,
        replyTo,
      );
      return true;
    }

    await sendMessage(
      chatId,
      `✅ Đã đăng ký sender_chat <b>${escapeHtml(targetTitle ?? "(no title)")}</b> (id=<code>${targetSenderChatId}</code>) làm <b>trusted</b> trong group này. Angel sẽ trả lời các tin nhắn từ kênh này. <i>mode=${mode}</i>`,
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

function buildGroupAiQuestion(params: {
  message: TelegramMessage;
  botUsername: string;
  isReplyToBot: boolean;
  triggerSource: AiTriggerSource;
  settings?: CommunitySettings;
}): { prompt: string; question: string; replyContextPreview?: string } {
  const prompt = cleanGroupAiPrompt(directTelegramText(params.message), params.botUsername);
  const replyContext = directTelegramText(params.message.reply_to_message).slice(0, 1500);

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
      replyContextPreview: replyContext ? replyContext.slice(0, 200) : undefined,
    };
  }

  if (replyContext) {
    const contextLabel = params.isReplyToBot
      ? "Previous Angel message (background only)"
      : "Quoted Telegram message (background only)";
    const promptIsContextDependent = isContextReferenceQuestion(prompt) || prompt.length < 15;
    const contextInstruction = promptIsContextDependent
      ? (params.isReplyToBot
          ? `The user's new message is short or refers back ("cái này", "đó là gì"…). Use the previous Angel message to understand what "this/that" means, then answer.`
          : `The user's new message is short or refers back. Use the quoted message to understand what "this/that" means, then answer.`)
      : `PRIORITY: answer the "Original user question" as a NEW standalone question. The ${params.isReplyToBot ? "previous Angel message" : "quoted message"} is only background — do NOT continue its topic, do NOT re-summarize it, and do NOT answer as if the user asked about it. If the new question is unrelated to the background, ignore the background entirely.`;
    return {
      prompt,
      question:
        `Context: the user is replying to a message in a Telegram group and mentioning Angel.\n` +
        `${contextLabel}: """${replyContext}"""\n` +
        `Original user question (ANSWER THIS): """${prompt}"""\n` +
        `${contextInstruction} Do not infer facts from the group name, sender_chat, or channel name.`,
      replyContextPreview: replyContext.slice(0, 200),
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

function detectTelegramEvent(message: TelegramMessage): TelegramEventDetection | null {
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

  const isEvent = hasJoinSignal && (hasEventLink || hasKeyword || Boolean(topic) || Boolean(eventTime) || hasZoomCredential);
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
      language: invite.language,
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
        userId: auditActor.userId ?? null,
        username: auditActor.username ?? null,
        fullName: null,
        messageId,
        triggerSource: "meditation_reply",
      },
      forcedLangBucket: invite.language,
      mirrorAngelWeb: (settings as any).ai_mirror_angel_web !== false,
    }));
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

async function handleEventAssistant(message: TelegramMessage, settings: CommunitySettings): Promise<boolean> {
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
  if (!detection?.isEvent) return false;

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

  const reply = buildEventSummary(detection.extracted, settings.event_assistant_prompt);
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

function detectEventFollowupIntent(prompt: string): "zoom" | "password" | "time_vi" | "time_my" | "livestream" | "topic" | "host" | null {
  const norm = prompt.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const hasQuestionSignal = /\?|(\b(?:dau|o\s*dau|la\s*gi|gi\s*vay|co\s*khong|co\s+.*\s+khong|cho\s*(?:xin|angel|be)|gui\s*lai|xin\s+link|can\s+link|may\s*gio|bao\s*nhieu|what|where|when|which|is\s+there|do\s+we\s+have|please)\b)/.test(norm);
  const hasTimeQuestionSignal = hasQuestionSignal || /\b(?:may\s*gio|gio\s*nao|doi\s*(?:sang|qua)\s*gio|chuyen\s*(?:sang|qua)\s*gio|time\s*(?:in|for)|convert\s*time|what\s*time|when)\b/.test(norm);
  if (/\b(pw|pass|password|mat\s*khau)\b/.test(norm)) return "password";
  if (/\b(link\s*)?zoom\b|vao\s*zoom|phong\s*zoom/.test(norm)) return "zoom";
  if (hasTimeQuestionSignal && /\b(?:viet\s*nam|vietnam|vn|gio\s*vn)\b/.test(norm)) return "time_vi";
  if (hasTimeQuestionSignal && /\b(?:malaysia|myt|gio\s*ma)\b/.test(norm)) return "time_my";
  if (hasQuestionSignal && /youtube|facebook|livestream|live\b/.test(norm)) return "livestream";
  if (/chu\s*de|topic|hom\s*nay/.test(norm)) return "topic";
  if (/ai\s*(huong\s*dan|dan)|host|guide|nguoi\s*huong\s*dan/.test(norm)) return "host";
  return null;
}

async function findEventForFollowup(
  adminClient: ReturnType<typeof getClients>["adminClient"],
  chatId: number,
  replyMessageId?: number | null,
): Promise<TelegramEventRecord | null> {
  if (replyMessageId) {
    const { data } = await adminClient
      .from("telegram_event_messages")
      .select("*")
      .eq("chat_id", chatId)
      .eq("message_id", replyMessageId)
      .maybeSingle();
    if (data) return data as TelegramEventRecord;
  }
  const { data } = await adminClient
    .from("telegram_event_messages")
    .select("*")
    .eq("chat_id", chatId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as TelegramEventRecord | null) ?? null;
}

function buildEventFollowupAnswer(
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

async function handleGroupAiMention(message: TelegramMessage, settings: CommunitySettings): Promise<void> {
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

  const aiQuestion = buildGroupAiQuestion({ message, botUsername, isReplyToBot, triggerSource, settings });
  const prompt = aiQuestion.prompt;
  if (!prompt) {
    await sendMessage(chatId, "💛 Bé yêu, gõ câu hỏi sau khi tag Angel nhé. Ví dụ: <code>@" + (botUsername || "bot") + " FUN.RICH là gì?</code>", {
      reply_to_message_id: message.message_id,
    });
    return;
  }
  const userLangBucket = resolveAngelLanguageBucket(prompt);
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
    await sendMessage(chatId, "Bé nhắn hơi nhanh, Angel cần nghỉ một chút để giữ năng lượng cho cả nhóm. Bé thử lại sau nhé.", {
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
  const eventIntent = !followupEnabled || triggerSource === "positive_community" ? null : detectEventFollowupIntent(prompt);
  if (eventIntent) {
    const event = await findEventForFollowup(adminClient, chatId, message.reply_to_message?.message_id ?? null);
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
            mirrorAngelWeb: (settings as any).ai_mirror_angel_web !== false,
          }));
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
        placeholderCaption: "💛 Angel đang vẽ, cả nhà chờ xíu nhé…",
        extra: _groupStreamExtra,
      })
    : null;
  const _groupStreamEnabled = _groupAutoIllustrate
    ? await getFlag("image.stream_telegram_preview", true)
    : false;
  try {
    const reply = await withTyping(chatId, () => askAngel({
      question: aiQuestion.question,
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
      mirrorAngelWeb: (settings as any).ai_mirror_angel_web !== false,
      attachments: _groupAttachments.length > 0 ? _groupAttachments : undefined,
      outImage: _groupAutoIllustrate ? _groupImageOut : undefined,
      onPartialImage: _groupStreamEnabled && _groupImageStreamer ? _groupImageStreamer.onPartial : undefined,
    }));
    // Router có ảnh → chỉ gửi khi auto-illustrate BẬT. Ngược lại drop ảnh, chỉ text.
    if (_groupAutoIllustrate && _groupImageStreamer && (_groupImageOut.image_url || _groupImageOut.image_base64)) {
      const caption = reply || "Angel vẽ tặng cả nhà ✨💛";
      await _groupImageStreamer.finalize({
        b64: _groupImageOut.image_base64,
        url: _groupImageOut.image_url,
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
        const { data } = await adminClient
          .from("telegram_community_verification_challenges")
          .select("*")
          .eq("id", challengeId)
          .eq("status", "pending")
          .maybeSingle();
        const challenge = data as VerificationChallenge | null;
        if (!challenge) return;
        if (new Date(challenge.expires_at).getTime() > Date.now()) return;
        const settings = await getSettingsForGroup(adminClient, challenge.group_id);
        await punishUnverifiedMember(adminClient, challenge, settings, "verification_expired");
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

async function handleChatMemberUpdate(update: TelegramUpdate, req: Request): Promise<void> {
  const evt = update.chat_member;
  const { adminClient } = getClients(req);
  console.log("[webhook] chat_member event:", JSON.stringify({
    chat_id: evt?.chat?.id,
    chat_type: evt?.chat?.type,
    old: evt?.old_chat_member?.status,
    new: evt?.new_chat_member?.status,
    user: evt?.new_chat_member?.user?.id,
    is_bot: evt?.new_chat_member?.user?.is_bot,
  }));
  if (!evt?.chat?.id) return;
  if (!isGroup(evt.chat.type)) { console.log("[webhook] skip: not group"); return; }

  const oldStatus = evt.old_chat_member?.status;
  const newStatus = evt.new_chat_member?.status;
  const member = evt.new_chat_member?.user;
  if (!member?.id || member.is_bot) { console.log("[webhook] skip: no member or is_bot"); return; }

  // Always log every membership transition (join/left/kicked/banned/unbanned/rejoined).
  // This is the data source for Member Tracking & Retention Analytics.
  try {
    await logMemberEvent(adminClient, {
      chatId: evt.chat.id,
      user: member,
      oldStatus,
      newStatus,
      fromActor: evt.from,
      inviteLink: evt.invite_link,
      occurredAt: evt.date ? new Date(evt.date * 1000) : undefined,
      metadata: {
        via_chat_folder_invite_link: (evt as unknown as { via_chat_folder_invite_link?: boolean }).via_chat_folder_invite_link ?? false,
        via_join_request: (evt as unknown as { via_join_request?: boolean }).via_join_request ?? false,
      },
    });
  } catch (e) {
    console.error("[webhook] logMemberEvent failed", e);
  }

  const leftStatuses = new Set(["left", "kicked"]);
  const joinedStatuses = new Set(["member", "restricted"]);
  if (!joinedStatuses.has(newStatus ?? "")) { console.log("[webhook] skip welcome: not joined transition", { oldStatus, newStatus }); return; }
  if (oldStatus && !leftStatuses.has(oldStatus)) {
    console.log("[webhook] skip welcome: already present before transition", { oldStatus, newStatus });
    return;
  }

  // Allow any â†’ member/restricted (covers invite link join where old may be "left" or undefined)

  const settings = await getSettingsForGroup(adminClient, evt.chat.id);
  console.log("[webhook] settings lookup", { chat_id: evt.chat.id, found: !!settings, welcome_enabled: settings?.welcome_enabled });
  if (!settings) {
    await logModeration(adminClient, {
      groupId: evt.chat.id,
      userId: member.id,
      username: member.username ?? null,
      action: "welcome_skipped_no_settings",
      reason: "chat_member",
    });
    return;
  }
  const joinBlocked = await runJoinGate(adminClient, {
    groupId: evt.chat.id,
    member,
    settings: settings as CommunitySettings & Record<string, unknown>,
    reason: "chat_member",
  });
  if (joinBlocked) return;

  if (!settings.welcome_enabled) {
    await logModeration(adminClient, {
      groupId: evt.chat.id,
      userId: member.id,
      username: member.username ?? null,
      action: "welcome_skipped_disabled",
      reason: "chat_member",
    });
    return;
  }

  await startVerificationForMember(adminClient, {
    groupId: evt.chat.id,
    member,
    settings,
    reason: "chat_member",
  });
  console.log("[webhook] verification started", { chat_id: evt.chat.id, user_id: member.id });
}

async function handleUnauthorizedGroup(
  adminClient: ReturnType<typeof getClients>["adminClient"],
  chatId: number,
  reason: string,
  opts: { sendNotice?: boolean; messageId?: number | null; groupName?: string | null } = {},
): Promise<void> {
  console.warn("[webhook] unauthorized group access", { chat_id: chatId, reason });
  await logModeration(adminClient, {
    groupId: chatId,
    action: "unauthorized_group_left",
    reason,
    messageId: opts.messageId ?? null,
  }).catch((error) => console.warn("[webhook] unauthorized group log failed", error));

  if (opts.sendNotice) {
    const groupName = (opts.groupName ?? "").trim() || "(unknown)";
    const escapeHtml = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    await callCommunityTelegram("sendMessage", {
      chat_id: chatId,
      text: [
        "⚠️ <b>Angel AI is not authorized to operate in this group.</b>",
        `Group ID: <code>${chatId}</code>`,
        `Group Name: <b>${escapeHtml(groupName)}</b>`,
        "Please add this Group ID to the Managed Groups list, then re-invite the bot.",
      ].join("\n"),
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }).catch((error) => console.warn("[webhook] unauthorized group notice failed", error));
  }


  await leaveChat(chatId).catch((error) => console.warn("[webhook] unauthorized group leave failed", error));
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

  const settings = await getSettingsForGroup(adminClient, evt.chat.id);
  if (!settings) {
    await handleUnauthorizedGroup(adminClient, evt.chat.id, "my_chat_member_no_settings", { sendNotice: true, groupName: evt.chat.title ?? null });
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
    const _adminForRules = getClients(req).adminClient;
    await loadAngelRuleOverrides(_adminForRules);
    await processExpiredVerifications(_adminForRules);


    if (update.callback_query) {
      await handleCallback(update);
      return;
    }

    if (update.my_chat_member) {
      await handleMyChatMemberUpdate(update, req);
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
    const settings = await getSettingsForGroup(adminClient, message.chat.id);
    emitModerationPipelineEvent("group_moderation_config", message, {
      configuration_found: Boolean(settings),
      anti_spam_enabled: settings?.anti_spam_enabled ?? null,
      scam_protection_enabled: settings?.scam_protection_enabled ?? null,
      scam_strict_mode: settings?.scam_strict_mode ?? null,
    });
    if (!settings) {
      const botJoinedThisMessage = message.new_chat_members?.some((member) => member.is_bot) ?? false;
      if (botJoinedThisMessage) {
        await handleUnauthorizedGroup(adminClient, message.chat.id, "new_chat_members_bot_no_settings", {
          sendNotice: true,
          messageId: message.message_id ?? null,
          groupName: message.chat.title ?? null,
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
      await handleUnauthorizedGroup(adminClient, message.chat.id, "message_no_settings", {
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
          forcedLangBucket: resolveAngelLanguageBucket(prompt),
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
    update.chat_member ||
      message?.new_chat_members?.length ||
      (message?.chat?.type && isGroup(message.chat.type) && /^\/(?:welcome|id|aitest|angel[-_]?debug|register_sender_chat)(@|\s|$)/i.test(text)),
  );


  if (shouldRunInline) {
    await processUpdate(update, req);
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
