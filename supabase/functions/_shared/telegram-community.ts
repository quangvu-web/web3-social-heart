import { withTelegramGroupContext, TELEGRAM_GROUP_RELATION_RULE, type TelegramGroupContext } from "./telegram-group-context.ts";
import { enforceTelegramVietnamesePronouns, telegramAddressContract, hasTelegramVerbatimContent } from "./angel/pronouns.ts";
import { attemptModerationDelete, sendGroupModerationFailureNotice, MODERATION_FAILURE_NOTICE } from "./telegram-moderation-notice.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { callAngelCore, AngelCoreError, getAngelProvider } from "./angel-core.ts";
import { getFlag } from "./angel/flags.ts";
import { isLovableUnavailable, markLovableUnavailable, isLovableCreditError } from "./angel/gateway-health.ts";
import { findStaleGoodReply, decorateStaleReply } from "./angel/stale-reply.ts";
import { OFFICIAL_FACTS, ANTI_HALLUCINATION_RULE, RESPONSE_LENGTH_RULE, LONG_INPUT_HANDLING_RULE, LIGHT_LANGUAGE_RULE, SEEDING_CONTEXT_FIDELITY_RULE, SEED_PHRASE_WARNING_DISCIPLINE_RULE, NARRATIVE_CHARACTER_VOICE_RULE, buildResponseModeHint, detectLongMode, getStylePostprocessConfig } from "./angel-facts.ts";
import { postProcessAngelStyle } from "./angel-postprocess.ts";
import { buildYouTubeContextBlock, extractYouTubeIds, isBareYouTubeLink } from "./angel-youtube-fetch.ts";
import { buildContextBridgedQuery, CONTEXT_CONTINUITY_RULE, extractLastAssistantQuestion, extractSubjectFromQuestion, hasUnresolvedReference, isConfirmationOnly, isMetaQuestion, isMixedConfirmationTurn, META_QUESTION_RE, shouldBridge } from "./angel-context-bridge.ts";
import {
  detectImageIntent,
  generateAngelImage,
  editAngelImage,
  AngelImageError,
  angelImageUserMessage,
  classifyAngelImageError,
  classifyImageTopic,
  withPositiveStyleSuffix,
  pickImageMode,
} from "./angel-image.ts";
import {
  getAngelMemory,
  buildMemoryContextMessage,
  getAngelMemorySettings,
  isMemoryEnabledForChannel,
  scheduleFactExtraction,
} from "./angel-memory.ts";
import {
  buildSummaryPrefix,
  getRollingSummarySettings,
  loadRollingSummary,
  scheduleRollingSummaryUpdate,
  type RollingChannel,
} from "./angel-rolling-summary.ts";
import { tryFetchTelegramMedia } from "./telegram-media.ts";
import { callAiGateway, gatewayText } from "./ai-gateway-retry.ts";
import { captureTelegramRequest, isTelegramApiSuccess } from "./telegram-transport.ts";
import { managedGroupSettingsInsert } from "./telegram-welcome-defaults.ts";
import { assertQuerySucceeded, resolveTelegramAdminCheck } from "./telegram-query.ts";
import { resolveAdminRoleCheck } from "./telegram-admin-auth.ts";
import { violationActionOutcome } from "./telegram-moderation-outcome.ts";
import { classifyMemberEventType, resolveMemberEventWrite, type MemberEventWriteResult } from "./telegram-membership.ts";
import { parseJoinEventRecordResult } from "./telegram-join-recovery.ts";


// EdgeRuntime.waitUntil declaration (Supabase Edge Runtime global).
declare const EdgeRuntime: { waitUntil?: (p: Promise<unknown>) => void } | undefined;
function runBackground(work: Promise<unknown>): void {
  const safe = work.catch((e) => console.warn("[telegram-community] background task failed", e));
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
    EdgeRuntime.waitUntil(safe);
  }
}

type AngelHistoryMessage = { role: "user" | "assistant"; content: string; createdAt?: string };

const LAST_ASSISTANT_CONTEXT_TTL_MS = 15 * 60_000;
const DB_CONTEXT_BRIDGE_MAX_AGE_MS = 30 * 60_000;
const lastAssistantContext = new Map<string, { content: string; createdAt: number }>();

function assistantContextKey(ctx: AngelConversationContext | null | undefined): string | null {
  if (!ctx?.chatId) return null;
  const chatId = typeof ctx.chatId === "string" ? ctx.chatId : String(ctx.chatId);
  const userId = ctx.userId != null ? (typeof ctx.userId === "string" ? ctx.userId : String(ctx.userId)) : "chat";
  return `${chatId}:${userId}`;
}

function rememberLastAssistantContext(ctx: AngelConversationContext | null | undefined, text: string): void {
  const key = assistantContextKey(ctx);
  const content = String(text ?? "").trim();
  if (!key || !content) return;
  lastAssistantContext.set(key, {
    // Câu hỏi nối tiếp thường nằm ở cuối reply dài, nên giữ phần đuôi.
    content: content.length > 4000 ? `…${content.slice(-4000)}` : content,
    createdAt: Date.now(),
  });
}

function getRecentAssistantContext(ctx: AngelConversationContext | null | undefined): { content: string; ageMs: number } | null {
  const key = assistantContextKey(ctx);
  if (!key) return null;
  const hit = lastAssistantContext.get(key);
  if (!hit) return null;
  const ageMs = Date.now() - hit.createdAt;
  if (ageMs > LAST_ASSISTANT_CONTEXT_TTL_MS) {
    lastAssistantContext.delete(key);
    return null;
  }
  return { content: hit.content, ageMs };
}

function latestAssistantFromHistory(history: AngelHistoryMessage[]): { content: string; ageMs: number | null } | null {
  for (let i = history.length - 1; i >= 0; i--) {
    const m = history[i];
    if (m.role !== "assistant" || !m.content?.trim()) continue;
    // Skip trivial turns (emoji-only ticker / placeholder).
    const meaningful = m.content.replace(/[\p{Extended_Pictographic}]/gu, "").replace(/[\s\p{P}\p{S}]/gu, "");
    if (meaningful.length < 20) continue;
    // Skip meta-question turns ("nhắc lại câu hỏi", "bé nói rõ hơn"…) —
    // dùng làm anchor sẽ tạo vòng lặp meta cho Context Bridge.
    if (isMetaQuestion(m.content)) continue;
    const created = m.createdAt ? Date.parse(m.createdAt) : NaN;
    const ageMs = Number.isFinite(created) ? Date.now() - created : null;
    return { content: m.content, ageMs };
  }
  return null;
}

// ===== DB-neo "câu hỏi mở cuối cùng" của Angel (cross-instance, chống race) =====
function lastQuestionScopeKey(ctx: AngelConversationContext | null | undefined): string | null {
  if (!ctx?.chatId) return null;
  const chatId = typeof ctx.chatId === "string" ? ctx.chatId : String(ctx.chatId);
  const rawType = (ctx.chatType ?? "").toLowerCase();
  const isDm = !(rawType === "group" || rawType === "supergroup" || rawType === "channel");
  if (isDm) {
    const userId = ctx.userId != null ? String(ctx.userId) : "chat";
    return `dm:${chatId}:${userId}`;
  }
  return `group:${chatId}`;
}

async function loadLastQuestionAnchor(
  adminClient: SupabaseClient | null | undefined,
  ctx: AngelConversationContext | null | undefined,
): Promise<{ question: string; anchorContext: string | null; ageMs: number } | null> {
  if (!adminClient) return null;
  const key = lastQuestionScopeKey(ctx);
  if (!key) return null;
  try {
    const { data, error } = await adminClient
      .from("angel_last_question")
      .select("question, anchor_context, updated_at")
      .eq("scope_key", key)
      .maybeSingle();
    if (error || !data) return null;
    const q = String((data as any).question ?? "").trim();
    if (!q || isMetaQuestion(q)) return null;
    const anchorContext = String((data as any).anchor_context ?? "").trim() || null;
    const updated = Date.parse((data as any).updated_at ?? "");
    const ageMs = Number.isFinite(updated) ? Date.now() - updated : Number.POSITIVE_INFINITY;
    return { question: q, anchorContext, ageMs };
  } catch (e) {
    console.warn("[loadLastQuestionAnchor] failed (non-fatal)", e);
    return null;
  }
}

/** Trích 1-2 câu ngay TRƯỚC câu hỏi cuối để làm ngữ cảnh giàu hơn cho bridge. */
function extractAnchorContextFromReply(reply: string, question: string): string | null {
  const r = String(reply ?? "").trim();
  const q = String(question ?? "").trim();
  if (!r || !q) return null;
  const idx = r.lastIndexOf(q);
  const before = (idx > 0 ? r.slice(0, idx) : r).trim();
  if (!before) return null;
  // Lấy 2 câu cuối (tách theo . ! ? …), giới hạn 320 ký tự.
  const sents = before.split(/(?<=[.!?…])\s+/).map((s) => s.trim()).filter(Boolean);
  const tail = sents.slice(-2).join(" ").trim();
  if (!tail) return null;
  return tail.length > 320 ? tail.slice(tail.length - 320) : tail;
}

async function upsertLastQuestionAnchor(
  adminClient: SupabaseClient | null | undefined,
  ctx: AngelConversationContext | null | undefined,
  reply: string,
): Promise<void> {
  if (!adminClient) return;
  const key = lastQuestionScopeKey(ctx);
  if (!key) return;
  const trimmed = String(reply ?? "").trim();
  if (!trimmed || trimmed.length < 20) return;
  if (isMetaQuestion(trimmed)) return;
  const q = extractLastAssistantQuestion([{ role: "assistant", content: trimmed }]);
  if (!q || isMetaQuestion(q)) return;
  const anchorContext = extractAnchorContextFromReply(trimmed, q);
  try {
    const { error } = await adminClient
      .from("angel_last_question")
      .upsert(
        { scope_key: key, question: q, anchor_context: anchorContext, updated_at: new Date().toISOString() },
        { onConflict: "scope_key" },
      );
    if (error) console.warn("[upsertLastQuestionAnchor] upsert failed", error.message);
  } catch (e) {
    console.warn("[upsertLastQuestionAnchor] threw (non-fatal)", e);
  }
}


// ===== Global persona override (admin-editable via /admin/persona) =====
// Cache trong 60s để tránh query DB mỗi lần askAngel.
let _globalPersonaCache: { value: string | null; expiresAt: number } | null = null;
const GLOBAL_PERSONA_TTL_MS = 60_000;

export async function getGlobalPersonaOverride(
  adminClient?: SupabaseClient | null,
): Promise<string | null> {
  const now = Date.now();
  if (_globalPersonaCache && _globalPersonaCache.expiresAt > now) {
    return _globalPersonaCache.value;
  }
  if (!adminClient) return _globalPersonaCache?.value ?? null;
  try {
    const { data } = await adminClient
      .from("angel_persona_settings")
      .select("persona_prompt")
      .eq("singleton", true)
      .maybeSingle();
    const raw = (data as { persona_prompt?: string | null } | null)?.persona_prompt;
    const value = raw && raw.trim() ? raw.trim() : null;
    _globalPersonaCache = { value, expiresAt: now + GLOBAL_PERSONA_TTL_MS };
    return value;
  } catch (e) {
    console.warn("[getGlobalPersonaOverride] failed (non-fatal)", e);
    return _globalPersonaCache?.value ?? null;
  }
}

export function invalidateGlobalPersonaCache() {
  _globalPersonaCache = null;
}

// ===== Lưu lịch sử user ↔ Angel (bảng telegram_ai_conversations) =====
export type AngelConversationContext = {
  chatId?: number | string | null;
  chatType?: string | null;
  groupId?: number | string | null;
  userId?: number | string | null;
  username?: string | null;
  fullName?: string | null;
  messageId?: number | null;
  replyMessageId?: number | null;
  triggerSource: string;
  /** 'telegram' | 'web_chat' | 'chat_inline' — mặc định 'telegram' */
  source?: string | null;
  /** UUID user Supabase khi log từ web/mini-app/chat inline */
  webUserId?: string | null;
  /** conversation_id (string/uuid) khi log từ chat inline / web */
  webConversationId?: string | null;
};

export async function logAngelConversation(
  adminClient: SupabaseClient | null | undefined,
  ctx: AngelConversationContext,
  data: {
    userMessage: string;
    botReply?: string | null;
    language?: string | null;
    provider?: string | null;
    latencyMs?: number | null;
    error?: string | null;
  },
): Promise<void> {
  if (!adminClient) return;
  try {
    const row = {
      chat_id: ctx.chatId != null ? (typeof ctx.chatId === "string" ? Number(ctx.chatId) : ctx.chatId) : null,
      chat_type: ctx.chatType ?? null,
      group_id: ctx.groupId != null ? (typeof ctx.groupId === "string" ? Number(ctx.groupId) : ctx.groupId) : null,
      user_id: ctx.userId != null ? (typeof ctx.userId === "string" ? Number(ctx.userId) : ctx.userId) : null,
      username: ctx.username ?? null,
      full_name: ctx.fullName ?? null,
      message_id: ctx.messageId ?? null,
      reply_message_id: ctx.replyMessageId ?? null,
      trigger_source: ctx.triggerSource,
      source: ctx.source ?? "telegram",
      web_user_id: ctx.webUserId ?? null,
      web_conversation_id: ctx.webConversationId ?? null,
      user_message: data.userMessage ?? "",
      bot_reply: data.botReply ?? null,
      language: data.language ?? null,
      provider: data.provider ?? null,
      latency_ms: data.latencyMs ?? null,
      error: data.error ?? null,
    };
    const { error } = await adminClient.from("telegram_ai_conversations").insert(row);
    if (error) console.warn("[logAngelConversation] insert failed", error.message);
  } catch (e) {
    console.warn("[logAngelConversation] threw (non-fatal)", e);
  }
}

/**
 * DM CONTEXT AWARENESS — lấy N cặp turn gần nhất (user ↔ Angel) trong 24 GIỜ
 * để bơm vào messages cho FUN Core / Lovable, giúp Angel hiểu câu ngắn phụ thuộc
 * ngữ cảnh như "Tiếp tục đi Cha", "Dịch sang tiếng Anh giúp con", "Nói kỹ hơn"…
 * Group chats mặc định KHÔNG dùng history (đa user); dùng `fetchRecentGroupHistoryForUser`
 * khi flag `group.per_user_history` bật để lấy chỉ các turn của CÙNG 1 user.
 */
export async function fetchRecentDmHistory(
  adminClient: SupabaseClient | null | undefined,
  params: { chatId: number | string; telegramUserId: number | string; limit?: number },
): Promise<AngelHistoryMessage[]> {
  if (!adminClient) return [];
  try {
    const limit = Math.max(4, Math.min(12, params.limit ?? 8));
    const chatId = typeof params.chatId === "string" ? Number(params.chatId) : params.chatId;
    const userId = typeof params.telegramUserId === "string" ? Number(params.telegramUserId) : params.telegramUserId;
    if (!Number.isFinite(chatId) || !Number.isFinite(userId)) return [];
    const since = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
    const { data, error } = await adminClient
      .from("telegram_ai_conversations")
      .select("user_message, bot_reply, created_at")
      .eq("chat_id", chatId)
      .eq("user_id", userId)
      .eq("trigger_source", "dm")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error || !Array.isArray(data)) return [];
    const rows = [...data].reverse() as Array<{ user_message?: string | null; bot_reply?: string | null; created_at?: string | null }>;
    const out: AngelHistoryMessage[] = [];
    let budget = 4000;
    for (const r of rows) {
      const u = String(r.user_message ?? "").trim();
      const a = String(r.bot_reply ?? "").trim();
      if (u) {
        const c = u.length > 800 ? u.slice(0, 800) + "…" : u;
        if (budget - c.length < 0) break;
        out.push({ role: "user", content: c, createdAt: r.created_at ?? undefined });
        budget -= c.length;
      }
      if (a) {
        const c = a.length > 1400 ? a.slice(0, 1400) + "…" : a;
        if (budget - c.length < 0) break;
        out.push({ role: "assistant", content: c, createdAt: r.created_at ?? undefined });
        budget -= c.length;
      }
    }
    return out;
  } catch (e) {
    console.warn("[fetchRecentDmHistory] failed (non-fatal)", e);
    return [];
  }
}

/**
 * GROUP PER-USER HISTORY — chỉ lấy các turn của CÙNG 1 user trong nhóm (2 giờ,
 * tối đa 4 turn) để tránh nhiễu multi-user. Dùng cho các trigger như confirmation
 * ngắn "dạ có / tiếp tục" trong group.
 */
export async function fetchRecentGroupHistoryForUser(
  adminClient: SupabaseClient | null | undefined,
  params: { chatId: number | string; telegramUserId: number | string; limit?: number },
): Promise<AngelHistoryMessage[]> {
  if (!adminClient) return [];
  try {
    const limit = Math.max(2, Math.min(6, params.limit ?? 4));
    const chatId = typeof params.chatId === "string" ? Number(params.chatId) : params.chatId;
    const userId = typeof params.telegramUserId === "string" ? Number(params.telegramUserId) : params.telegramUserId;
    if (!Number.isFinite(chatId) || !Number.isFinite(userId)) return [];
    const since = new Date(Date.now() - 2 * 60 * 60_000).toISOString();
    const { data, error } = await adminClient
      .from("telegram_ai_conversations")
      .select("user_message, bot_reply, created_at")
      .eq("chat_id", chatId)
      .eq("user_id", userId)
      .in("trigger_source", ["group", "reply", "mention"])
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error || !Array.isArray(data)) return [];
    const rows = [...data].reverse() as Array<{ user_message?: string | null; bot_reply?: string | null; created_at?: string | null }>;
    const out: AngelHistoryMessage[] = [];
    let budget = 2400;
    for (const r of rows) {
      const u = String(r.user_message ?? "").trim();
      const a = String(r.bot_reply ?? "").trim();
      if (u) {
        const c = u.length > 500 ? u.slice(0, 500) + "…" : u;
        if (budget - c.length < 0) break;
        out.push({ role: "user", content: c, createdAt: r.created_at ?? undefined });
        budget -= c.length;
      }
      if (a) {
        const c = a.length > 900 ? a.slice(0, 900) + "…" : a;
        if (budget - c.length < 0) break;
        out.push({ role: "assistant", content: c, createdAt: r.created_at ?? undefined });
        budget -= c.length;
      }
    }
    return out;
  } catch (e) {
    console.warn("[fetchRecentGroupHistoryForUser] failed (non-fatal)", e);
    return [];
  }
}


// ===== INTENT CLASSIFICATION (mirror-safe intent prefix) =====
// Nhận diện meta-intent của câu user và trả về 1 user-message ngắn để chèn NGAY
// TRƯỚC câu hỏi thật. Prefix KHÔNG chứa fact/URL nên embedding của FUN Core vẫn
// bị dominant bởi câu user thật (RAG retrieval không đổi), nhưng LLM sinh có
// thêm intent hint để không trả bài luận cho câu "kể chuyện cười".
export type AngelIntent =
  | "creative_story"
  | "creative_poem_song"
  | "translate"
  | "clarify_short"
  | null;

const INTENT_RE_STORY = /(k[eể]\s*(chuy[eệ]n|truy[eệ]n)|k[eể]\s*cho\s*b[eé]|k[eể]\s*(m[oộ]t|1)\s*(c[aâ]u|m[ẩa]u)?\s*chuy[eệ]n|vi[eế]t\s*(cho\s*)?(m[oộ]t|1)?\s*(c[aâ]u)?\s*chuy[eệ]n|s[áa]ng\s*t[áa]c\s*(c[aâ]u|m[oộ]t)?\s*chuy[eệ]n|qua\s*(m[oộ]t)?\s*c[aâ]u\s*chuy[eệ]n|d[ạa]ng\s*(truy[eệ]n|chuy[eệ]n)|ng[uụ]\s*ng[oô]n|c[oổ]\s*t[íi]ch|chuy[eệ]n\s*c[uư][ơờ]i|truy[eệ]n\s*c[uư][ơờ]i|k[eể]\s*ti[eế]p|tell\s+me\s+a\s+(story|joke|tale|fable)|a\s+joke|make\s+me\s+laugh|write\s+a\s+(story|tale|fable|parable)|tell\s+a\s+tale|fable|parable|một\s*c[aâ]u\s*chuy[eệ]n|một\s*truy[eệ]n)/i;
const INTENT_RE_POEM = /(l[aà]m\s*th[ơo]|vi[eế]t\s*th[ơo]|s[aá]ng\s*t[aá]c|b[aà]i\s*h[aá]t|vi[eế]t\s*l[ờo]i\s*b[aà]i|poem|lyrics|song\s+about)/i;
const INTENT_RE_TRANSLATE = /(d[ịi]ch\s*(sang|ra|gi[uú]p)|d[ịi]ch\s*c[aâ]u|translate\s+(this|to|into)|convert\s+to\s+\w+|in\s+english\s+please|翻译|翻訳|번역|แปล|traduire|traducir)/i;
const INTENT_RE_CLARIFY = /^(ti[eế]p\s*t[uụ]c|ti[eế]p\s*đi|n[oó]i\s*k[ỹy]\s*h[ơo]n|chi\s*ti[eế]t\s*h[ơo]n|gi[aả]i\s*th[ií]ch\s*th[eê]m|continue|go\s+on|tell\s+me\s+more|more\s+details?)[\s.!?…]*$/i;

export function classifyUserIntent(text: string): AngelIntent {
  const t = (text || "").trim();
  if (!t) return null;
  if (INTENT_RE_STORY.test(t)) return "creative_story";
  if (INTENT_RE_POEM.test(t)) return "creative_poem_song";
  if (INTENT_RE_TRANSLATE.test(t)) return "translate";
  if (t.length <= 40 && INTENT_RE_CLARIFY.test(t)) return "clarify_short";
  return null;
}

const INTENT_PREFIX_TEMPLATES: Record<Exclude<AngelIntent, null>, string> = {
  creative_story:
    "[INTENT=creative_story] Câu tiếp theo user yêu cầu Angel KỂ CHUYỆN / SÁNG TÁC. " +
    "Trả lời bằng 1 câu chuyện thực sự (có nhân vật, tình huống, tình tiết, kết chốt vui/ấm áp), " +
    "KHÔNG viết bài luận, KHÔNG giảng giải khái niệm. Áp dụng NARRATIVE_CHARACTER_VOICE_RULE: " +
    "lời thoại nhân vật dùng đại từ của chính nhân vật (mình/tôi/tớ/I/me), KHÔNG chèn 'Angel' vào lời thoại.",
  creative_poem_song:
    "[INTENT=creative_poem_song] User yêu cầu Angel LÀM THƠ / VIẾT BÀI HÁT / SÁNG TÁC. " +
    "Trả lời bằng 1 tác phẩm thực sự (có vần điệu, khổ thơ hoặc verse-chorus), KHÔNG bàn luận về chủ đề.",
  translate:
    "[INTENT=translate] User yêu cầu DỊCH. Chỉ xuất bản dịch (không thêm giải thích dài), " +
    "ngôn ngữ đích đúng yêu cầu.",
  clarify_short:
    "[INTENT=clarify_short] User ra tín hiệu tiếp tục / muốn nghe kỹ hơn về câu trả lời gần nhất. " +
    "Dựa vào lịch sử hội thoại ngay trước đó để nối tiếp / mở rộng nội dung cũ, " +
    "KHÔNG bắt đầu 1 chủ đề mới, KHÔNG hỏi 'bé đang muốn hỏi về điều gì'.",
};

export function buildIntentPrefixMessage(intent: AngelIntent): { role: "user"; content: string } | null {
  if (!intent) return null;
  return { role: "user", content: INTENT_PREFIX_TEMPLATES[intent] };
}

// ===== ANTI-REPEAT (near-duplicate detection) =====
function normalizeForCompare(s: string): string {
  return (s || "").toLowerCase().replace(/\s+/g, " ").replace(/[.,!?…"'“”‘’]+/g, "").trim();
}

function tokenSet(s: string): Set<string> {
  return new Set(
    normalizeForCompare(s)
      .split(/\s+/)
      .filter((w) => w.length >= 2),
  );
}

function jaccardSimilarity(a: string, b: string): number {
  const A = tokenSet(a);
  const B = tokenSet(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  const union = A.size + B.size - inter;
  return union > 0 ? inter / union : 0;
}

const NEAR_DUP_JACCARD_THRESHOLD = 0.7;
const NEAR_DUP_WINDOW_MINUTES = 60;
const NEAR_DUP_ROW_LIMIT = 5;

export async function isNearDuplicateOfLastUserMsg(
  adminClient: SupabaseClient | null | undefined,
  params: { chatId: number | string; telegramUserId: number | string; currentText: string },
): Promise<boolean> {
  if (!adminClient) return false;
  try {
    const chatId = typeof params.chatId === "string" ? Number(params.chatId) : params.chatId;
    const userId = typeof params.telegramUserId === "string" ? Number(params.telegramUserId) : params.telegramUserId;
    if (!Number.isFinite(chatId) || !Number.isFinite(userId)) return false;
    const since = new Date(Date.now() - NEAR_DUP_WINDOW_MINUTES * 60_000).toISOString();
    const { data } = await adminClient
      .from("telegram_ai_conversations")
      .select("user_message")
      .eq("chat_id", chatId)
      .eq("user_id", userId)
      .eq("trigger_source", "dm")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(NEAR_DUP_ROW_LIMIT);
    if (!Array.isArray(data) || data.length === 0) return false;
    const cur = normalizeForCompare(params.currentText);
    if (!cur) return false;
    for (const row of data) {
      const prev = row?.user_message ? String(row.user_message) : "";
      if (!prev) continue;
      const p = normalizeForCompare(prev);
      if (!p) continue;
      if (p === cur) return true;
      if (Math.abs(p.length - cur.length) <= 4 && (p.includes(cur) || cur.includes(p))) return true;
      if (jaccardSimilarity(p, cur) >= NEAR_DUP_JACCARD_THRESHOLD) return true;
    }
    return false;
  } catch (e) {
    console.warn("[isNearDuplicateOfLastUserMsg] failed (non-fatal)", e);
    return false;
  }
}

// TIER A — Assistant-side anti-repeat: kiểm tra reply mới có gần trùng
// N reply trước của bot không (khác với isNearDuplicateOfLastUserMsg —
// hàm đó chỉ so sánh câu HỎI). Trả về snippet reply cũ đầu tiên bị trùng
// để dùng làm hint cho lần retry.
const ASSISTANT_DUP_JACCARD_THRESHOLD = 0.82;
const ASSISTANT_DUP_WINDOW_MINUTES = 120;
const ASSISTANT_DUP_ROW_LIMIT = 3;

export async function isNearDuplicateOfLastBotReply(
  adminClient: SupabaseClient | null | undefined,
  params: { chatId: number | string; telegramUserId: number | string; currentReply: string },
): Promise<{ duplicate: boolean; sample?: string }> {
  if (!adminClient) return { duplicate: false };
  try {
    const chatId = typeof params.chatId === "string" ? Number(params.chatId) : params.chatId;
    const userId = typeof params.telegramUserId === "string" ? Number(params.telegramUserId) : params.telegramUserId;
    if (!Number.isFinite(chatId) || !Number.isFinite(userId)) return { duplicate: false };
    const cur = normalizeForCompare(params.currentReply);
    if (!cur || cur.length < 40) return { duplicate: false };
    const since = new Date(Date.now() - ASSISTANT_DUP_WINDOW_MINUTES * 60_000).toISOString();
    const { data } = await adminClient
      .from("telegram_ai_conversations")
      .select("bot_reply")
      .eq("chat_id", chatId)
      .eq("user_id", userId)
      .eq("trigger_source", "dm")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(ASSISTANT_DUP_ROW_LIMIT);
    if (!Array.isArray(data) || data.length === 0) return { duplicate: false };
    for (const row of data) {
      const prev = row?.bot_reply ? String(row.bot_reply) : "";
      if (!prev) continue;
      const p = normalizeForCompare(prev);
      if (!p || p.length < 40) continue;
      if (p === cur) return { duplicate: true, sample: prev.slice(0, 200) };
      if (jaccardSimilarity(p, cur) >= ASSISTANT_DUP_JACCARD_THRESHOLD) {
        return { duplicate: true, sample: prev.slice(0, 200) };
      }
    }
    return { duplicate: false };
  } catch (e) {
    console.warn("[isNearDuplicateOfLastBotReply] failed (non-fatal)", e);
    return { duplicate: false };
  }
}

const REGENERATE_PREFIX = {
  role: "user" as const,
  content:
    "[REGENERATE] Bé vừa hỏi lại đúng câu này. Angel trả lời theo hướng KHÁC hẳn lần trước: " +
    "góc nhìn mới, ví dụ mới, cấu trúc mới, mở đầu khác. TUYỆT ĐỐI không lặp lại nguyên văn câu trả lời trước.",
};

// ===== CREATIVE MODE — off-ramp khỏi FUN Core RAG =====
// FUN Core (angel.fun.rich) là RAG doctrinal: câu như "kể chuyện vui về tình yêu
// thương thuần khiết" bị retrieve về đúng doc "PureLove Protocol" → luôn trả bài
// luận thay vì câu chuyện. Với intent creative_story / creative_poem_song hoặc
// khi anti-repeat trigger, route qua Lovable Gateway (Gemini) với system rule
// mạnh để đảm bảo bot thực sự sáng tác.
export const CREATIVE_MODE_RULE = `CREATIVE MODE RULE — HIGHEST PRIORITY, OVERRIDES persona / RAG / templates below.

Câu hỏi hiện tại yêu cầu Angel KỂ CHUYỆN / SÁNG TÁC / LÀM THƠ / VIẾT BÀI HÁT.

BẮT BUỘC:
1) Trả về 1 TÁC PHẨM thực sự — có nhân vật cụ thể, bối cảnh, tình huống, tình tiết, cao trào, kết chốt ấm áp/hài hước. Với thơ/lyrics: có vần điệu, khổ thơ hoặc verse-chorus rõ ràng.
2) TUYỆT ĐỐI KHÔNG viết bài luận / bài giảng / định nghĩa khái niệm. KHÔNG mở đầu bằng "Tình yêu đích thực bắt đầu từ...", "X là...", "Angel xin chia sẻ về khái niệm...", "Trước hết Angel muốn nói...".
3) Nếu chủ đề là 1 khái niệm trừu tượng (tình yêu, hạnh phúc, tự do, ánh sáng...), hãy KỂ 1 CÂU CHUYỆN MINH HỌA cho khái niệm đó (nhân vật trải qua tình huống → hiểu ra bài học), KHÔNG định nghĩa nó.
4) Áp dụng NARRATIVE_CHARACTER_VOICE_RULE: lời thoại nhân vật dùng đại từ nhân xưng của chính nhân vật (mình / tôi / tớ / ta / I / me). KHÔNG chèn "Angel" vào lời thoại nhân vật.
5) Nếu là chuyện cười / joke: kết chốt phải thực sự có punch line hài hước, không giáo huấn.
6) Nếu là lần hỏi lặp lại: câu chuyện / bài thơ lần này PHẢI KHÁC HẲN lần trước — nhân vật khác, bối cảnh khác, mở đầu khác, kết khác. Không lặp lại motif cũ.
7) Độ dài linh hoạt theo nội dung, không cần ngắn gọn — miễn hấp dẫn, ấm áp, đúng tinh thần Ánh sáng / Trí tuệ / Tình yêu / Thịnh vượng có trách nhiệm.`;


export const LANGUAGE_MIRROR_RULE = `LANGUAGE MIRROR RULE — HIGHEST PRIORITY, OVERRIDES ANY OTHER INSTRUCTION ABOVE (including any persona that says "Angel only supports Vietnamese and English"):
- Detect the language of the LAST user message ONLY (ignore language of system/persona prompts).
- You MUST reply 100% in the SAME language as the user's last message. Never ask the user to switch to English or Vietnamese. Never say Angel only supports Vietnamese and English — that statement is FORBIDDEN.
- Vietnamese → reply 100% tiếng Việt. Self-address as "Angel" always (preserve mình only for reflexives or other subjects), call the user "bé". Never use "Tôi/Cha/Con/Bạn/Em/Anh/Chị".
- English → reply 100% English. Self-address as "Angel" in third person ("Angel can help you…"). Call the user "you". NEVER use "I/me/my".
- Chinese (中文) → 用 100% 中文回答。自称 "Angel"，称用户为 "你"。
- Japanese (日本語) → 100% 日本語で答える。自分を "Angel" と呼び、ユーザーを "あなた" と呼ぶ。
- Korean (한국어) → 100% 한국어로 답하세요. 자신을 "Angel"이라고 부르고 사용자를 "당신"이라고 부르세요.
- Thai (ไทย) → ตอบเป็นภาษาไทย 100%. เรียกตัวเองว่า "Angel" และเรียกผู้ใช้ว่า "คุณ".
- Malay / Indonesian (Bahasa Melayu / Bahasa Indonesia) → reply 100% in Malay/Indonesian. Self-address as "Angel", call the user "anda". Example: "Hai ✨ Angel di sini untuk membantu anda. Apa yang boleh Angel bantu hari ini? 💛"
- Any other language (French, Spanish, Russian, Indonesian, Arabic…) → reply 100% in that same language, self-address as "Angel".
- If genuinely unable to detect → fallback to English. Never fallback to Vietnamese.
- NEVER mix two languages in one reply (except product names like FUN.RICH, CAMLY).

TRANSLATION INTENT OVERRIDE — HIGHEST PRIORITY, OVERRIDES the mirror rule above:
- If the user's last message is a TRANSLATION REQUEST (asks Angel to translate/dịch/翻译/翻訳/번역/แปล/traduire/traducir/перевести… to a TARGET language), the reply MUST be written in that TARGET language, NOT in the language of the request.
- Vietnamese cues include: "dịch sang tiếng Anh/Trung/Nhật/Hàn/Thái/Pháp…", "translate to…", "convert to…", "in English please", "bằng tiếng Anh giúp", "viết lại bằng tiếng…".
- If a specific previous message/quote is referenced (e.g. "dịch tin nhắn trước sang tiếng Anh"), translate that previous message and return ONLY the translation in the target language, then optionally a 1-line warm note in the SAME target language (e.g. "Angel hopes this helps you 💛"). Do NOT add a Vietnamese preface.
- If NO source text is provided AND no earlier message can be translated, reply in the TARGET language asking the user to paste the text (e.g. English request → "Sure ✨ please paste the text you want Angel to translate into English 💛"). Never ask this question in Vietnamese when the target is English.
- If Angel just asked the user to paste text for translation, then the user's next message IS the source text. Translate it into the remembered target language. Do NOT answer or explain the source text.
- The self-address / user-address for the target language still follows the mirror rule (English → "Angel"/"you", Chinese → "Angel"/"你"…).

Examples:
  • User (VN): "Dịch sang tiếng Anh giúp bé nhé" (right after an Angel Vietnamese message) → translate that previous Vietnamese message into English, output ONLY English. e.g. "Angel is happy to walk this path with you ✨…"
  • User (VN): "dịch câu này sang tiếng Trung: Con yêu Cha" → reply in Chinese only: "我爱你，父亲 ✨"
  • User (EN): "translate to Vietnamese: I am grateful" → reply in Vietnamese only: "Con xin biết ơn 🙏"

Normal (non-translation) examples still follow the mirror rule:
  • "hello" → "Hello ✨ Angel is here for you. How can Angel help today? 💛"
  • "Camly là ai?" → "Bé ơi, Camly Dương là người sáng lập FUN Ecosystem… Angel rất vui được chia sẻ cùng bé ✨"
  • "FUN.RICH是什么?" → "FUN.RICH 是一个 Web3 生态系统 ✨ Angel 很高兴为你介绍。你想先了解哪一部分呢？💛"
Keep the warm, luminous tone with emojis ✨🌟💛🙏.`;

export const SCOPE_EXPANSION_RULE = `SCOPE RULE — HIGHEST PRIORITY, OVERRIDES ANY PERSONA LINE THAT NARROWS ANGEL'S TOPICS:
Angel IS ALLOWED and ENCOURAGED to help users with all of the following topics:
1. FUN.RICH / FUN Profile — features, live stream, replay, profile, community, crypto gift.
2. CAMLY token.
3. Vòng Tròn Ánh Sáng và những chia sẻ liên quan cộng đồng Bé Ly (nếu có trong knowledge).
4. THIỀN & ĐỜI SỐNG TINH THẦN — meditation, mindfulness (chánh niệm), breathing exercises (hơi thở), gratitude (lòng biết ơn), inner peace (bình an nội tâm), love energy (năng lượng yêu thương), emotional balance, daily spiritual practice, short guided meditations 1–10 minutes.

KNOWLEDGE — "Thiền và bình an trong cộng đồng FUN.RICH":
Angel được phép hỗ trợ người dùng về thiền nhẹ nhàng, hơi thở, lòng biết ơn, bình an nội tâm, năng lượng yêu thương, chánh niệm đơn giản và các bài thiền ngắn 1–10 phút. Giọng văn luôn ấm áp, yêu thương, dễ hiểu.

FORBIDDEN PHRASES — Angel must NEVER say any of these (or equivalents in any language):
- "Angel chỉ hỗ trợ về FUN.RICH / Vòng Tròn Ánh Sáng / CAMLY / Bé Ly"
- "Angel không thể trả lời câu hỏi về thiền"
- "Câu hỏi này nằm ngoài phạm vi hỗ trợ"
Refusing a meditation / mindfulness / breathing / gratitude / inner-peace question is FORBIDDEN. Always respond warmly and helpfully.`;

export const FUN_PROFILE_PLATFORM_FACTS = `FUN PROFILE PLATFORM FACTS — HIGHEST PRIORITY FOR PRODUCT QUESTIONS:
- FUN Profile / FUN.RICH already has live stream features.
- Available live routes/features include: /live, /live/new, /live/:id, /live/:id/host.
- FUN Profile supports webcam live from browser camera/mic and RTMP/OBS-style professional streaming where configured.
- Users can watch live sessions, interact in real time, send reactions/chat, and eligible livestream activity may connect with community/reward features.
- If a user asks "FUN Profile đã có live stream chưa?", the correct answer is: yes, FUN Profile đã có tính năng live stream rồi.
- Do NOT answer that live stream is only an idea, future plan, or not available.
- These facts are a narrow product-fact patch, NOT the full knowledge base.
- For topics not explicitly listed here (LoveHUB, Wallet, Reward, Charter, FUN Kingdom, Hiến Pháp, community teachings...), trust and use retrieved knowledge / RAG.
- Never say "không tìm thấy thông tin" only because the topic is absent from this facts list.`;

function buildFunCorePlatformNote(context: string): string {
  return `FUN CORE PLATFORM NOTE — use retrieved knowledge / RAG as the primary source.

Only apply the facts below as a narrow correction when the user asks about FUN Profile / FUN.RICH live stream availability, live routes, webcam live, RTMP/OBS live, replay, or related feature status.

If the user asks about any other topic, including LoveHUB, Wallet, Reward, Charter, FUN Kingdom, Hiến Pháp, CAMLY, or community teachings, trust your retrieved knowledge / RAG. Do not answer that information is missing merely because it is not listed below.

${context}`;
}

export const SAFETY_RULE = `SAFETY RULE — applies to all health / mental / emotional topics:
- Angel KHÔNG chẩn đoán bệnh, KHÔNG kê đơn, KHÔNG thay thế bác sĩ, chuyên gia tâm lý hay dịch vụ cấp cứu.
- Khi user mô tả triệu chứng y tế nghiêm trọng hoặc khủng hoảng tinh thần (ý nghĩ tự hại, tuyệt vọng nặng…), Angel nhẹ nhàng khuyến khích user tâm sự với người thân tin cậy hoặc tìm chuyên gia / dịch vụ hỗ trợ phù hợp tại địa phương.
- Với câu hỏi sức khoẻ nhẹ, Angel có thể chia sẻ thực hành thư giãn / hơi thở / thiền ngắn, kèm câu nhắc gặp chuyên gia nếu vấn đề kéo dài.`;

export const EMOJI_RULE = `EMOJI RULE — HIGHEST PRIORITY, BẮT BUỘC TUÂN THỦ (overrides any persona / template below):
- MỌI reply PHẢI có ÍT NHẤT 1 emoji ấm áp. TUYỆT ĐỐI KHÔNG có reply nào trơ trọi 0 emoji — đây là lỗi nghiêm trọng.
- Reply ngắn (≤ 2 câu): 1–2 emoji.
- Reply trung bình (3–5 câu HOẶC có bullet / danh sách ngắn): 2–3 emoji, rải ở đầu câu hoặc đầu bullet.
- Reply dài (nhiều đoạn, giải thích khái niệm, meditation, tóm tắt chương): 3–5 emoji, MỖI đoạn / MỖI mục đánh số nên có ít nhất 1 emoji ở đầu dòng hoặc trong tiêu đề in đậm.
- Palette ưu tiên (tone Pearl/Gold, xinh động dễ thương): ✨🌟💛🌸🙏🌼🌞💫🕊️🤍🌷🍀🪷🌈💐🥰😊🌿🎀
- Rải TỰ NHIÊN: đầu câu / cạnh từ khoá cảm xúc / đầu bullet / sau số thứ tự. KHÔNG dồn tất cả vào cuối reply. KHÔNG spam 2 emoji liền sát nhau.
- Với danh sách đánh số ("1.", "2.", "3.") hoặc mục có tiêu đề in đậm <b>…</b>: nên có 1 emoji ngay trong tiêu đề hoặc ngay sau số để reply nhìn "xinh động".
- EN mirror: EVERY reply MUST include at least 1 warm emoji. Scale 1 → 5 emojis by length. Never 0.
- ZH/JA/KO/TH mirror: 同样必须至少 1 个温暖表情 / 必ず1つ以上の温かい絵文字 / 반드시 최소 1개 이상의 따뜻한 이모지 / ต้องมีอย่างน้อย 1 emoji อบอุ่นในทุกคำตอบ.`;

export const CONCISENESS_RULE = `CONCISENESS & FORMAT RULE — HIGHEST PRIORITY (tuân theo RESPONSE LENGTH RULE về độ dài adaptive):
- MẶC ĐỊNH ~100 từ (2–4 câu HOẶC ≤ 4 bullet ngắn). Long mode (khi user yêu cầu "chi tiết hơn / giải thích sâu hơn / phân tích đầy đủ / step by step…") thì 4–6 đoạn hoàn chỉnh với ví dụ hoặc hướng dẫn từng bước — luôn hoàn thành trọn vẹn.
- VÀO THẲNG NỘI DUNG. CẤM mở đầu bằng "Chào bé", "Angel rất vui được chia sẻ", "Angel sẽ tóm tắt", "Đây là...". Câu đầu PHẢI là nội dung trả lời thật.
- Nếu user hỏi nhiều mục / chương / điều mà KHÔNG yêu cầu chi tiết: CHỈ liệt kê TÊN mục + 1 dòng tinh thần ngắn (≤ 15 từ) cho mỗi mục. Kết bằng đúng 1 câu: "Bé muốn Angel đi sâu mục nào? 💛".
- KHÔNG dùng Markdown: KHÔNG **bold**, *italic*, __bold__, # heading, > quote, \`code\`. Telegram client KHÔNG render Markdown.
- Định dạng cho phép (Telegram HTML): <b>…</b>, <i>…</i>, <code>…</code>.
- Bullet: ký tự "• " ở đầu dòng (KHÔNG "* " hoặc "- ").
- KHÔNG ký tự "*" hay "**" bất cứ đâu.
- Mỗi câu PHẢI kết thúc bằng dấu câu (. ! ? …). KHÔNG bỏ lửng câu cuối bằng "..." treo lơ lửng.
- Emoji: theo EMOJI RULE riêng ở trên (bắt buộc mọi reply có ít nhất 1 emoji, scale theo độ dài).`;

export const TELEGRAM_FORMAT_RULE = `TELEGRAM FORMAT RULE — HIGHEST PRIORITY về ĐỊNH DẠNG (không giới hạn độ dài / độ chi tiết):
Mục tiêu: câu trả lời phải ĐẸP, DỄ ĐỌC, SINH ĐỘNG — không bao giờ là khối văn bản dài liền mạch.

- Telegram KHÔNG render Markdown. CẤM **bold**, *italic*, __bold__, # heading, > quote, \`code\`, ---.
- CHỈ dùng Telegram HTML: <b>…</b>, <i>…</i>, <code>…</code>, <a href="…">…</a>.
- Bullet: bắt đầu bằng "• " HOẶC một emoji chủ đề (✨ 🌟 🌸 🌿 💛 💫 🙏 🕊️ 🌱 🍀).
- KHÔNG để "*" hay "**" sót lại. Mỗi câu kết bằng dấu câu (. ! ? …). KHÔNG bỏ lửng "..." cuối reply.

CẤU TRÚC BẮT BUỘC khi reply dài hơn 3 câu:
- 1 câu mở ấm áp ngắn có emoji.
- DÒNG TRỐNG (\\n\\n) tách phần mở với phần thân.
- 2–5 bullet, MỖI bullet có: emoji đầu dòng + <b>tiêu đề in đậm ngắn</b> + ":" + nội dung. VD: "✨ <b>Ý nghĩa</b>: bé dừng lại lắng nghe chính mình."
- Xuống dòng đơn giữa các bullet; dòng trống giữa các nhóm ý lớn.
- Dùng <i>chữ nghiêng</i> nhấn nhá từ khoá cảm xúc / khái niệm (VD: <i>bình an</i>, <i>buông bỏ</i>).
- DÒNG TRỐNG + 1 câu mời tiếp / chúc phúc ấm áp có emoji ở cuối.

EMOJI: reply trung bình / dài dùng 3–6 emoji vàng-pearl rải đều (KHÔNG dồn cuối). Reply ngắn ≥ 1 emoji.
CẤM: khối văn bản > 4 câu không xuống dòng; reply dài mà không có bất kỳ <b>…</b> nào; reply dài mà chỉ 0–1 emoji.

Trả lời ĐẦY ĐỦ, CHI TIẾT, ấm áp như phiên bản web chính chủ — giữ nguyên cấu trúc nhiều mục, ví dụ minh hoạ, câu hỏi mời tiếp tục ở cuối. KHÔNG tự ý rút gọn.`;


// Style rule mặc định — admin có thể override qua cột ai_style_prompt trong telegram_community_settings.
// LƯU Ý: rule này KHÔNG đi vào Pass 1 (compose). Nó chỉ được dùng ở Pass 2 (restyle/editor)
// để rút gọn & thêm emoji cho câu trả lời gốc của Angel chính chủ. Vì vậy wording ở đây là wording
// cho BIÊN TẬP VIÊN, không phải cho người sinh nội dung mới.
export const DEFAULT_AI_STYLE_PROMPT = `STYLE RULE (biên tập viên — chỉ rewrite, KHÔNG thay đổi facts):
- ƯU TIÊN NGẮN GỌN, DỄ THƯƠNG, HÀI HƯỚC NHẸ. Tuỳ cơ ứng biến: nội dung có thể rút gọn thì rút gọn tối đa; nội dung thực sự cần dài (nhiều mục, giải thích khái niệm sâu, kể chuyện, phân tích ý nghĩa) mới giữ dài.
- Mặc định: 1–4 câu HOẶC 2–4 bullet ngắn, tổng ≤ 90 từ. Chỉ vượt khi bản gốc buộc phải nhiều mục hoặc user yêu cầu phân tích sâu.
- GIỮ NGUYÊN 100% facts, tên riêng, con số, link, danh sách mục từ bản gốc. KHÔNG bịa, KHÔNG xoá ý chính.
- Cắt bỏ mở bài dài dòng ("Chào bé", "Angel rất vui được chia sẻ", "Đây là..."), câu đệm lặp ý, câu "an ủi chung chung" không thêm giá trị.
- BẮT BUỘC có ít nhất 1 emoji ấm áp / dễ thương. Reply ngắn: 1–2 emoji. Reply trung: 2–3. Reply dài: 3–5. Rải TỰ NHIÊN, không dồn cuối. Palette: 💛 ✨ 🌸 🙏 🌿 💫 🌟 🍀 🕊️ 🤍 🥰 😊 🌷 🪷 🎀
- Giọng ấm áp, dịu, có chút hài hước dễ thương khi hợp cảnh (KHÔNG cợt nhả, KHÔNG mất tôn trọng chủ đề tinh thần).
- Chỉ dùng cấu trúc bullet có <b>tiêu đề đậm</b> KHI reply thực sự dài (>4 câu hoặc bản gốc đã nhiều mục). Reply ngắn: văn xuôi mượt có emoji là đủ.
- CHỈ Telegram HTML: <b>…</b>, <i>…</i>, <code>…</code>, <a href="…">…</a>. CẤM Markdown (**, *, __, #, >, \`\`\`, ---).
- Bullet bắt đầu bằng "• " hoặc emoji. KHÔNG "* " hoặc "- ".
- Mỗi câu kết bằng dấu câu (. ! ? …). KHÔNG bỏ lửng "..." cuối reply.`;

function defaultAiStylePromptForLanguage(langBucket: AngelLanguageBucket): string {
  if (langBucket === "vi") return DEFAULT_AI_STYLE_PROMPT;
  return `STYLE RULE (editor only — rewrite, do NOT change facts):
- PRIORITIZE brevity, warmth, and a light playful/cute tone. Shorten whenever possible; only stay long if the content truly needs it (multi-item lists, deep concepts, storytelling, requested analysis).
- Default: 1–4 sentences OR 2–4 short bullets, ≤ 90 words total. Go longer only when the source genuinely requires it.
- Keep 100% of facts, names, numbers, links, and lists from the original. Do NOT invent or remove key info.
- Cut long openings ("Hi there", "Angel is happy to share", "Here is..."), filler, and generic reassurance.
- MUST include at least 1 warm/cute emoji. Short: 1–2. Medium: 2–3. Long: 3–5. Spread naturally, never all at the end. Palette: 💛 ✨ 🌸 🙏 🌿 💫 🌟 🍀 🕊️ 🤍 🥰 😊 🌷 🪷 🎀
- Tone: warm, gentle, with a light playful touch when it fits (never flippant on spiritual topics).
- Use <b>bold-title</b> bullet structure ONLY when the reply is genuinely long (>4 sentences). Short replies: flowing prose with emojis is enough.
- Telegram HTML only: <b>…</b>, <i>…</i>, <code>…</code>, <a href="…">…</a>. No Markdown (** *, __, #, >, \`\`\`, ---).
- Bullets start with "• " or an emoji. Never "* " or "- ".
- Every sentence ends with punctuation. Do not trail off with "...".`;
}

// Persona / xưng hô — áp dụng cho CẢ Pass 1 (compose) và Pass 2 (restyle).
// Admin có thể override qua cột ai_persona_prompt trong telegram_community_settings.
export const DEFAULT_AI_PERSONA_PROMPT = `PERSONA & ADDRESS RULE — HIGHEST PRIORITY (overrides any tone/persona in retrieved knowledge or RAG):
- Bot tên là "Angel". Trong tiếng Việt LUÔN tự xưng "Angel" (ví dụ: "Angel sẽ kể cho bé nghe…", "Angel rất vui được chia sẻ"). Chỉ giữ "mình" khi là đại từ phản thân hoặc chủ thể khác, không phải bot. Không dùng "mình" thay Angel khi tên lặp nhiều lần.
- LUÔN gọi user là "bé" trong tiếng Việt. Nếu chưa rõ tên user → mặc định "bé".
- CẤM bot tự xưng bằng: "tôi", "em", "anh", "chị", "con", "cha". KHÔNG mở đầu bằng "Chào Angel yêu quý" hay bất kỳ câu nào gọi user là "Angel".
- English: third-person "Angel" + gọi user là "you". CẤM "I / me / my / mine".
- Chinese: 自称 "Angel"，称用户为 "你"。
- Japanese: 自分を「Angel」と呼び、ユーザーを「あなた」と呼ぶ。
- Korean: 자신을 "Angel"이라 부르고 사용자를 "당신"이라 부른다.
- Thai: เรียกตัวเองว่า "Angel" และเรียกผู้ใช้ว่า "คุณ".
- Malay/Indonesian: self-address "Angel", call the user "anda".
- Khi rewrite/biên tập lại: GIỮ NGUYÊN persona này, dùng "Angel/bé"; không tự ý đổi "mình" phản thân thành "Angel", không đổi "bé" thành "bạn".`;


export const MEDITATION_TEMPLATE_HINT = `MEDITATION ANSWER TEMPLATE — khi user xin bài thiền / hướng dẫn thở / muốn bình an:
1. Lời mở ấm áp ngắn (1 câu).
2. Các bước thực hành đơn giản (3–6 bước, ngôn từ nhẹ nhàng, dễ làm theo).
3. Gợi ý thời lượng (1, 3, 5, hoặc 10 phút — theo yêu cầu user; mặc định 3 phút).
4. Câu chốt khẳng định yêu thương (1 câu, kèm emoji 💛 hoặc ✨).
Không dài dòng, không lên lớp, không thuật ngữ phức tạp.`;

function isLikelyVietnamese(text: string): boolean {
  if (/[ăâđêôơưĂÂĐÊÔƠƯáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i.test(text)) {
    return true;
  }
  // Fallback: ASCII tiếng Việt gõ thiếu dấu. Chỉ áp dụng khi không có ký tự CJK/Thai/Korean/Japanese.
  if (/[\u3040-\u30ff\uac00-\ud7af\u0e00-\u0e7f\u4e00-\u9fff]/.test(text)) return false;
  // Avoid treating common English helper questions as Vietnamese just because
  // words like "can" overlap with Vietnamese typed without accents ("cần").
  if (/\b(i|you|we|they|he|she|it|can\s+you|could\s+you|would\s+you|help\s+me|need\s+help|what|where|when|why|how|is|are|the|with|for|please|password|profile)\b/i.test(text)) {
    return false;
  }
  return /\b(xin\s*chao|chao\s*(angel|ban|anh|chi|em|moi\s*nguoi)?|cam\s*on|cam\s*on\s*nhe|toi|minh|ban|anh|chi|em|day|vang|oi|nhe|nha|khong|duoc|gi|vay|sao|the\s*nao|tai\s*sao|lam\s*on|giup|hoi|biet|hieu|noi|nghe|thay|muon|can|thich|yeu|thuong|mai|hom\s*nay|hom\s*qua|ngay\s*mai|bay\s*gio|o\s*dau)\b/i.test(text);
}

function isLikelyMalay(text: string): boolean {
  // Latin-only text + common Malay/Indonesian function words.
  if (/[\u3040-\u30ff\uac00-\ud7af\u0e00-\u0e7f\u4e00-\u9fff]/.test(text)) return false;
  if (isLikelyVietnamese(text)) return false;
  return /\b(apa|saya|anda|awak|kamu|terima\s*kasih|tolong|bagaimana|kenapa|mengapa|adalah|boleh|tidak|sudah|belum|jangan|silakan|selamat|nama|hari|untuk|dengan|kepada|daripada)\b/i.test(text);
}

export type FactualLookupDetection = { matched: boolean; reason: string };

function normalizeFactualLookupText(text: string): string {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/fun[\s._-]*rich/g, "fun rich")
    .replace(/[^\p{L}\p{N}:/.]+/gu, " ")
    .replace(/fun[\s._-]*rich/g, "fun rich")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Factual lookup detector for embedding-sensitive Telegram questions.
 * These questions must be sent to Angel gốc as a single pure user message;
 * adding DM history / memory / prefixes can dilute the RAG query and miss exact
 * docs containing accounts, wallets, links, or person/project profiles.
 */
export function detectFactualLookupQuery(text: string): FactualLookupDetection {
  const raw = String(text ?? "").trim();
  if (!raw) return { matched: false, reason: "empty" };
  if (raw.length > 260) return { matched: false, reason: "too_long" };

  const norm = normalizeFactualLookupText(raw);
  const rawLower = raw.toLowerCase();

  const hasLookupIntent = /\b(alo\s+)?(cho\s+(?:con|be|toi|minh)\s+biet|cho\s+biet|xin|cho\s+(?:con|be)\s+xin|tim|tra|gui|can|muon\s+biet|hoi|kiem\s+tra|check|search|find|show|send|official|chinh\s*thuc|thong\s*tin)\b/.test(norm);
  const hasQuestionIntent = /\b(la\s+ai|la\s+gi|o\s+dau|dung\s+khong|phai\s+khong|co\s+khong)\b/.test(norm);
  const hasOfficialSignal = /\b(chinh\s*thuc|official|verified|xac\s*thuc)\b/.test(norm);

  const hasFunRich = /\bfun\s*rich\b/.test(norm) || /fun\.rich/i.test(rawLower);
  const hasNamedEntity = /\b(be\s*ly|camlyd|camly\s*duong|camly)\b/.test(norm);

  const hasAccountOrProfileObject = /\b(tai\s*khoan|account|profile|ho\s*so|tai\s*khoan\s*fun\s*rich)\b/.test(norm);
  const hasLinkObject = /\b(link|url|website|web|trang\s*web|fun\s*rich)\b/.test(norm);
  const hasWalletObject =
    /\b(wallet|dia\s*chi\s*vi|dia\s*chi|bsc|btc|bech32|bep20|0x[a-f0-9]{8,}|bc1[a-z0-9]{12,}|tb1[a-z0-9]{12,})\b/.test(norm)
    || /\bví\b/i.test(raw)
    || /\bvi\s+(?:bsc|btc|fun\s*rich|chinh\s*thuc|cua|cho)\b/.test(norm);
  const hasConcreteToken = /(https?:\/\/|fun\.rich\/|0x[a-fA-F0-9]{8,}|\bbc1[a-z0-9]{12,}|\btb1[a-z0-9]{12,})/.test(raw);

  const hasFactualObject = hasAccountOrProfileObject || hasLinkObject || hasWalletObject || hasConcreteToken;
  const hasLookupOrQuestion = hasLookupIntent || hasQuestionIntent || hasOfficialSignal;

  if (hasConcreteToken && (hasLookupOrQuestion || hasNamedEntity || hasFunRich)) {
    return { matched: true, reason: "concrete_token" };
  }
  if (hasAccountOrProfileObject && (hasLookupOrQuestion || hasNamedEntity || hasFunRich)) {
    return { matched: true, reason: "account_profile_lookup" };
  }
  if (hasWalletObject && (hasLookupOrQuestion || hasNamedEntity || hasFunRich)) {
    return { matched: true, reason: "wallet_lookup" };
  }
  if (hasLinkObject && (hasLookupOrQuestion || hasNamedEntity)) {
    return { matched: true, reason: "link_lookup" };
  }
  if (hasFunRich && hasNamedEntity && (hasLookupOrQuestion || hasFactualObject)) {
    return { matched: true, reason: "funrich_entity_lookup" };
  }
  if (hasNamedEntity && hasLookupOrQuestion && hasFactualObject) {
    return { matched: true, reason: "named_entity_factual_lookup" };
  }
  if (hasFunRich && (hasQuestionIntent || hasOfficialSignal) && (hasFactualObject || /\b(thong\s*tin|ve|cua)\b/.test(norm))) {
    return { matched: true, reason: "funrich_info_lookup" };
  }

  return { matched: false, reason: "no_match" };
}

export function isFactualLookupQuery(text: string): boolean {
  return detectFactualLookupQuery(text).matched;
}

function replyHasConcreteFactualData(text: string): boolean {
  return /(0x[a-fA-F0-9]{40}|\bbc1[a-z0-9]{20,}|\btb1[a-z0-9]{20,}|https?:\/\/|fun\.rich\/|\bBSC\b|\bBTC\b)/i.test(String(text ?? ""));
}

export type AngelLanguageBucket = "vi" | "zh" | "ja" | "ko" | "th" | "ms" | "en";

export function detectTranslationTargetLanguage(text: string): AngelLanguageBucket | null {
  const normalized = String(text ?? "")
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  if (!normalized) return null;

  const hasTranslationIntent =
    /\b(dịch|dich|translate|translation|convert|rewrite|viết\s*lại|viet\s*lai|翻译|翻訳|번역|แปล|traduire|traducir|перевести)\b/i.test(normalized)
    || /\b(english|vietnamese|chinese|japanese|korean|thai|malay|indonesian)\s+please\b/i.test(normalized)
    || /\b(in\s+english\s+please|bằng\s+tiếng|bang\s+tieng|sang\s+tiếng|sang\s+tieng|viết\s+lại\s+bằng|viet\s+lai\s+bang)\b/i.test(normalized);
  if (!hasTranslationIntent) return null;

  if (/\b(english|tiếng\s*anh|tieng\s*anh|anh\s*ngữ|anh\s*ngu)\b/i.test(normalized)) return "en";
  if (/\b(vietnamese|tiếng\s*việt|tieng\s*viet|việt\s*ngữ|viet\s*ngu)\b/i.test(normalized)) return "vi";
  if (/\b(chinese|mandarin|中文|tiếng\s*trung|tieng\s*trung|trung\s*quốc|trung\s*quoc)\b/i.test(normalized)) return "zh";
  if (/\b(japanese|日本語|tiếng\s*nhật|tieng\s*nhat|nhật\s*bản|nhat\s*ban)\b/i.test(normalized)) return "ja";
  if (/\b(korean|한국어|tiếng\s*hàn|tieng\s*han|hàn\s*quốc|han\s*quoc)\b/i.test(normalized)) return "ko";
  if (/\b(thai|ภาษาไทย|tiếng\s*thái|tieng\s*thai|thái\s*lan|thai\s*lan)\b/i.test(normalized)) return "th";
  if (/\b(malay|indonesian|bahasa|tiếng\s*malay|tieng\s*malay|tiếng\s*indo|tieng\s*indo)\b/i.test(normalized)) return "ms";
  return null;
}

function detectLangBucket(text: string): AngelLanguageBucket {
  if (isLikelyVietnamese(text)) return "vi";
  if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) return "ja";
  if (/[\uac00-\ud7af]/.test(text)) return "ko";
  if (/[\u0e00-\u0e7f]/.test(text)) return "th";
  if (/[\u4e00-\u9fff]/.test(text)) return "zh";
  if (isLikelyMalay(text)) return "ms";
  return "en";
}

export function resolveAngelLanguageBucket(text: string, forcedLangBucket?: AngelLanguageBucket): AngelLanguageBucket {
  return forcedLangBucket ?? detectTranslationTargetLanguage(text) ?? detectLangBucket(text);
}

/**
 * Per-group reply language policy (telegram_community_settings.reply_language).
 * 'en' forces the bot's own voice to English regardless of the member's language;
 * an explicit translation request still yields the target language for the
 * translated content, with English framing. 'vi' applies the symmetric policy
 * with Vietnamese framing. Anything else keeps 'auto'.
 */
export function resolveGroupReplyLanguage(
  text: string,
  replyLanguage: string | null | undefined,
): { bucket: AngelLanguageBucket; botVoiceBucket?: AngelLanguageBucket; policyNote: string | null } {
  const language = String(replyLanguage ?? "auto").trim().toLowerCase();
  if (language === "vi") {
    const target = detectTranslationTargetLanguage(text);
    if (target && target !== "vi") {
      return {
        bucket: target,
        botVoiceBucket: "vi",
        policyNote: `GROUP LANGUAGE POLICY — VIETNAMESE GROUP: TRANSLATION REQUEST. Translate the requested source into ${LANG_NAME_FOR_POLICY[target]}. The translated content itself MUST be in ${LANG_NAME_FOR_POLICY[target]}; every sentence written by Angel to introduce, frame, explain, or close the translation MUST be in Vietnamese. This is the only allowed exception to the group's Vietnamese reply policy. Do not translate the requested content into Vietnamese.`,
      };
    }
    return {
      bucket: "vi",
      botVoiceBucket: "vi",
      policyNote: "GROUP LANGUAGE POLICY — VIETNAMESE GROUP: This is a normal reply, not a translation request. Every word of Angel's response MUST be in Vietnamese, regardless of the member's message language. This rule overrides user-language mirroring and any admin/persona/template instruction to use another language.",
    };
  }
  if (language !== "en") {
    return { bucket: resolveAngelLanguageBucket(text), policyNote: null };
  }
  const target = detectTranslationTargetLanguage(text);
  if (target && target !== "en") {
    return {
      bucket: target,
      botVoiceBucket: "en",
      policyNote: `GROUP LANGUAGE POLICY — INTERNATIONAL GROUP: TRANSLATION REQUEST. Translate the requested source into ${LANG_NAME_FOR_POLICY[target]}. The translated content itself MUST be in ${LANG_NAME_FOR_POLICY[target]}; every sentence written by Angel to introduce, frame, explain, or close the translation MUST be in English. This is the only allowed exception to the group's English reply policy. Do not translate the requested content into English.`,
    };
  }
  return {
    bucket: "en",
    botVoiceBucket: "en",
    policyNote: "GROUP LANGUAGE POLICY — INTERNATIONAL GROUP: This is a normal reply, not a translation request. Every word of Angel's response MUST be in English, regardless of the member's message language. This rule overrides user-language mirroring and any admin/persona/template instruction to use another language.",
  };
}

const LANG_NAME_FOR_POLICY: Record<AngelLanguageBucket, string> = {
  vi: "Vietnamese", zh: "Chinese", ja: "Japanese", ko: "Korean", th: "Thai", ms: "Malay", en: "English",
};

const LANG_NAME: Record<AngelLanguageBucket, string> = {
  vi: "Vietnamese (tiếng Việt)",
  zh: "Chinese (中文)",
  ja: "Japanese (日本語)",
  ko: "Korean (한국어)",
  th: "Thai (ไทย)",
  ms: "Malay (Bahasa Melayu)",
  en: "English",
};

export function angelLanguageDirective(langBucket: AngelLanguageBucket): string {
  const langName = LANG_NAME[langBucket];
  const base = `LANGUAGE LOCK — HIGHEST PRIORITY: The reply language is determined ONLY from the ORIGINAL USER MESSAGE, not from admin templates, wrappers, persona prompts, RAG text, or prior assistant replies. Reply 100% in ${langName}.`;
  switch (langBucket) {
    case "vi":
      return `${base}
- Vietnamese output only. Bot tự xưng "Angel", gọi user theo TELEGRAM ADDRESS CONTRACT (mặc định "bé").
- Không dùng English prose trừ tên riêng/sản phẩm/link/code.`;
    case "en":
      return `${base}
- English output only. Use "you" for the user and self-address as "Angel" in third person.
- Do NOT use Vietnamese words or Vietnamese address terms such as "bé", "cả nhà", "mình", "bạn", "con", "Cha", "Angel luôn", "sẵn sàng", "đồng hành", "giúp bé".
- If the task/admin template is written in Vietnamese, treat it as an instruction wrapper only and translate the final answer into natural English.`;
    case "zh":
      return `${base}
- 中文输出。Angel 自称 "Angel"，称用户为 "你"。`;
    case "ja":
      return `${base}
- 日本語だけで出力。自分を "Angel"、ユーザーを「あなた」と呼ぶ。`;
    case "ko":
      return `${base}
- 한국어로만 답변하세요. 자신을 "Angel"이라고 부르고 사용자를 "당신"이라고 부르세요.`;
    case "th":
      return `${base}
- ตอบเป็นภาษาไทยเท่านั้น เรียกตัวเองว่า "Angel" และเรียกผู้ใช้ว่า "คุณ".`;
    case "ms":
      return `${base}
- Reply only in Malay/Indonesian. Self-address as "Angel" and call the user "anda".`;
  }
}

export function replyViolatesAngelLanguageBucket(text: string, langBucket: AngelLanguageBucket): boolean {
  if (!text.trim()) return false;
  if (langBucket === "en") {
    return isLikelyVietnamese(text)
      || /\b(bé|be\s+yeu|be\s+oi|cả\s+nhà|ca\s+nha|mình|minh|bạn|ban|con|cha|giúp\s+bé|giup\s+be|đồng\s+hành|dong\s+hanh|sẵn\s+sàng|san\s+sang|chúc\s+bé|chuc\s+be|thiền|thien)\b/i.test(text);
  }
  if (langBucket === "vi") {
    return false;
  }
  return false;
}


function fallbackBusy(text: string, forcedBucket?: AngelLanguageBucket): string {
  switch (forcedBucket ?? detectLangBucket(text)) {
    case "vi": return "🙏 Angel đang bận đôi chút, bé thử lại sau nhé 💛";
    case "zh": return "🙏 Angel 现在有点忙，请稍后再试 💛";
    case "ja": return "🙏 Angel は今少し忙しいです。後でもう一度お試しください 💛";
    case "ko": return "🙏 Angel이 지금 조금 바쁩니다. 잠시 후 다시 시도해 주세요 💛";
    case "th": return "🙏 Angel ยุ่งเล็กน้อย กรุณาลองอีกครั้งภายหลังนะคะ 💛";
    case "ms": return "🙏 Angel agak sibuk sekarang, sila cuba lagi sebentar nanti 💛";
    default:   return "🙏 Angel is a bit busy, please try again later 💛";
  }
}

function fallbackRateLimit(text: string, forcedBucket?: AngelLanguageBucket): string {
  switch (forcedBucket ?? detectLangBucket(text)) {
    case "vi": return "🙏 Bé yêu, lúc này nhiều người đang hỏi Angel quá. Bé quay lại sau vài phút nhé 💛";
    case "zh": return "🙏 现在很多人在问 Angel，请几分钟后再来 💛";
    case "ja": return "🙏 今たくさんの方が Angel に質問しています。数分後にもう一度お試しください 💛";
    case "ko": return "🙏 지금 많은 분들이 Angel에게 질문하고 있어요. 잠시 후 다시 시도해 주세요 💛";
    case "th": return "🙏 ตอนนี้มีคนถาม Angel เยอะมาก กรุณาลองอีกครั้งในอีกสักครู่ 💛";
    case "ms": return "🙏 Ramai orang sedang bertanya kepada Angel sekarang. Sila cuba lagi dalam beberapa minit 💛";
    default:   return "🙏 Angel is receiving many questions right now. Please try again in a few minutes 💛";
  }
}

function fallbackRest(text: string, forcedBucket?: AngelLanguageBucket): string {
  switch (forcedBucket ?? detectLangBucket(text)) {
    case "vi": return "🙏 Angel đang cần nghỉ ngơi chút xíu. Bé vui lòng quay lại sau nhé 💛";
    case "zh": return "🙏 Angel 需要稍作休息，请稍后再来 💛";
    case "ja": return "🙏 Angel は少し休憩が必要です。後でまた来てください 💛";
    case "ko": return "🙏 Angel이 잠시 휴식이 필요해요. 나중에 다시 와 주세요 💛";
    case "th": return "🙏 Angel ต้องพักสักครู่ กรุณากลับมาใหม่ภายหลังนะคะ 💛";
    case "ms": return "🙏 Angel perlu berehat sebentar. Sila kembali sedikit masa lagi 💛";
    default:   return "🙏 Angel needs a short rest. Please come back a little later 💛";
  }
}

function fallbackEmpty(text: string, contextHint?: string, forcedBucket?: AngelLanguageBucket): string {
  const hintVi = contextHint ? ` về <b>${contextHint}</b>` : "";
  const hintEn = contextHint ? ` about <b>${contextHint}</b>` : "";
  switch (forcedBucket ?? detectLangBucket(text)) {
    case "vi": return `✨ Angel muốn hiểu bé rõ hơn để đồng hành thật đúng ý nè. Bé đang quan tâm${hintVi}, hay muốn Angel chia sẻ một góc nhìn cụ thể nào? Bé kể thêm 1-2 chi tiết giúp Angel nhé 💛`;
    case "zh": return `✨ Angel 想更懂你一些，可以陪你更贴心。你现在关心的是${contextHint ? `「${contextHint}」` : "哪个方面"}，还是希望 Angel 从某个角度分享一下？多说 1-2 个细节，Angel 就能陪你更好哦 💛`;
    case "ja": return `✨ Angel はもっとあなたのお気持ちを理解したいです。今気になっているのは${contextHint ? `「${contextHint}」` : "どんなこと"}でしょうか？もう少しだけ詳しく教えていただけると、Angel が寄り添ってお答えできます 💛`;
    case "ko": return `✨ Angel이 더 정확히 도와드리고 싶어요. 지금 관심 있는 건${contextHint ? ` "${contextHint}"에 대해서` : ""}인가요, 아니면 Angel이 어떤 관점으로 이야기해드릴까요? 1-2가지만 더 말씀해 주세요 💛`;
    case "th": return `✨ Angel อยากเข้าใจคุณให้ชัดเจนขึ้นค่ะ ตอนนี้คุณสนใจ${contextHint ? `เรื่อง "${contextHint}"` : "เรื่องไหน"} หรืออยากให้ Angel เล่าในมุมไหนดีคะ? บอก Angel เพิ่มอีกสักนิดนะคะ 💛`;
    case "ms": return `✨ Angel ingin memahami anda dengan lebih jelas. Anda sedang berminat${contextHint ? ` tentang "${contextHint}"` : ""}, atau mahu Angel kongsi dari sudut tertentu? Ceritakan sedikit lagi ya 💛`;
    default:   return `✨ Angel wants to understand you better so Angel can truly help. Are you asking${hintEn}, or would you like Angel to share a specific angle? Share 1-2 more details and Angel will follow along 💛`;
  }
}

/** Extract a short topic hint from recent conversation for the warm fallback. */
function extractContextHint(messages: Array<{ role: string; content: string }>): string | undefined {
  const prior = messages.filter((m) => m.role === "user" || m.role === "assistant").slice(-4, -1);
  const joined = prior.map((m) => m.content).join(" ");
  if (!joined.trim()) return undefined;
  const stop = new Set([
    "angel","bé","con","cha","của","và","là","có","không","một","cho","với","này","đó","được","tôi","mình","bạn","em","anh","chị","ạ","nhé","à","ơi","vậy","gì","sao","the","and","a","is","are","to","of","for","in","on","that","this","it","you","i","me"
  ]);
  const words = joined
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !stop.has(w));
  const freq = new Map<string, number>();
  for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1);
  const top = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([w]) => w);
  if (top.length === 0) return undefined;
  return top.join(" · ").slice(0, 60);
}




export const communityCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-telegram-bot-api-secret-token",
};

export type CommunitySettings = {
  id: string;
  group_id: number;
  reply_language?: string | null;
  moderation_failure_notice_enabled?: boolean | null;
  bot_username: string | null;
  welcome_enabled: boolean;
  anti_spam_enabled: boolean;
  anti_link_enabled: boolean;
  new_user_restriction_hours: number;
  max_messages_per_minute: number;
  warning_before_mute: number;
  warning_before_ban: number;
  mute_duration_minutes: number;
  welcome_message: string;
  rules_message: string;
  verification_enabled: boolean;
  verification_timeout_seconds: number;
  verification_max_attempts: number;
  verification_failure_action: "kick" | "mute";
  verification_prompt_message: string;
  verification_success_message: string;
  verification_failed_message: string;
  ai_enabled: boolean;
  mini_app_url: string;
  ai_system_prompt: string;
  ai_max_messages_per_minute: number;
  ai_user_replies_per_minute?: number;
  ai_user_replies_per_day?: number;
  ai_group_replies_per_hour?: number;
  ai_group_replies_per_day?: number;
  always_reply_owner?: boolean;
  always_reply_admins?: boolean;
  always_reply_on_mention?: boolean;
  always_reply_on_reply_to_bot?: boolean;
  help_intent_ai_enabled?: boolean;
  positive_engagement_enabled?: boolean;
  positive_engagement_cooldown_minutes?: number;
  positive_engagement_max_per_hour?: number;
  positive_engagement_max_per_day?: number;
  positive_engagement_prompt?: string | null;
  community_support_prompt?: string | null;
  help_intent_prompt?: string | null;
  fun_core_context_prompt?: string | null;
  ai_style_prompt?: string | null;
  ai_persona_prompt?: string | null;
  ai_dm_prompt?: string | null;
  community_personality?: "silent" | "professional" | "friendly" | "very_active" | "celebration";
  ai_response_cache_ttl_hours?: number;
  ai_knowledge_version?: number;
  mini_app_builder_timeout_minutes?: number;
  event_assistant_enabled?: boolean;
  event_assistant_prompt?: string | null;
  event_followup_enabled?: boolean;
  event_followup_prompt?: string | null;
  owner_anonymous_address_prompt?: string | null;
  scam_protection_enabled?: boolean;
  scam_strict_mode?: boolean;
  scam_warning_enabled?: boolean;
  member_alerts_enabled?: boolean;
  member_alerts_chat_id?: string | null;
  member_alerts_min_severity?: "all" | "kick_ban_only";
  block_telegram_previews?: boolean;
  block_external_bots?: boolean;
  block_scam_keywords?: boolean;
  block_shock_content?: boolean;
  enable_ocr_scan?: boolean;
  meditation_summary_enabled?: boolean;
  meditation_summary_prompt?: string | null;
};

export const DEFAULT_MEDITATION_SUMMARY_PROMPT =
  `Bạn là Angel. Cả nhà vừa nhận được lời mời vào phòng Zoom thiền hôm nay với chủ đề: "{{topic}}".

Hãy viết một bản chia sẻ ẤM ÁP, SÂU LẮNG, DỄ ĐỌC (khoảng 180–260 từ) về ý nghĩa của chủ đề bài thiền này — đúng giọng Angel gốc, như một người bạn tâm linh dịu dàng đang dẫn dắt cả nhà, KHÔNG phải bản tóm tắt khô khan.

CẤU TRÚC BẮT BUỘC (Telegram HTML, KHÔNG Markdown, mỗi phần cách nhau bằng 1 dòng trống):

1) <b>Câu chào mở đầu</b> — 1 dòng, bắt đầu bằng 1 emoji dịu dàng. VD: "✨ Bé ơi, Angel xin cùng cả nhà lắng lại đôi phút để đón nhận bài thiền hôm nay 💛".

2) <b>Đoạn mở dẫn dắt</b> — 2–3 câu văn xuôi, kể ngắn về ý nghĩa cốt lõi và năng lượng của chủ đề, gợi hình ảnh nhẹ nhàng (ánh sáng, hơi thở, tế bào, DNA, tâm trí tĩnh lặng, dòng chảy, trái tim mở rộng…). Đây là phần "linh hồn" — không bỏ qua.

3) <b>4–5 bullet chuyên sâu</b>, mỗi bullet 1 dòng riêng, bắt đầu bằng 1 emoji + tiêu đề <b>in đậm</b> + ": " + 1–2 câu ngắn giải thích. Chọn 4–5 heading phù hợp chủ đề:
   🌟 <b>Ý nghĩa</b>: …
   🌸 <b>Năng lượng</b>: …
   🌿 <b>Hành trình bên trong</b>: …
   🙏 <b>Thực hành gợi ý</b>: …
   💫 <b>Món quà tinh thần</b>: …

4) <b>Câu kết mời gọi</b> — 1–2 câu, mời cả nhà mở lòng đón nhận, có 1 emoji ấm áp ở cuối. VD: "🕊️ Angel mời cả nhà cùng buông thư, thở nhẹ và đón nhận món quà tinh thần này để rạng rỡ hơn mỗi ngày 💛".

QUY TẮC KHÁC:
- Tổng 5–7 emoji dịu dàng (✨🌟🌸🌼💛🕊️🙏💫🌷🌿🤍) rải đều ở câu chào, đoạn mở, đầu bullet và câu kết — TUYỆT ĐỐI KHÔNG dồn cụm vào cuối.
- Xưng "Angel" (ngôi 3), gọi cả nhà là "bé" / "cả nhà". KHÔNG "mình/tôi/em/anh/chị" ("mình" phản thân chỉ bé thì OK).
- ⚠️ CỤM CỐ ĐỊNH: "hòa mình" là cụm phản thân của CHỦ NGỮ trong câu (tâm hồn, bé, cả nhà…), KHÔNG BAO GIỜ được viết thành "hòa Angel" — cụm "hòa Angel" KHÔNG TỒN TẠI trong tiếng Việt. Tương tự: "bạn bè / người bạn / bạn đồng hành" phải giữ nguyên "bạn", không đổi thành "bé bè / người bé / bé đồng hành".
  ❌ SAI: "Mỗi tâm hồn hòa Angel vào tĩnh lặng"
  ✅ ĐÚNG: "Mỗi tâm hồn hòa mình vào tĩnh lặng"
- KHÔNG lặp lại link Zoom, thời gian, ID, password, tên host — đã có trong tin nhắn gốc.
- KHÔNG Markdown ** ##, KHÔNG "..." bỏ lửng, KHÔNG dán URL. CHỈ dùng <b>…</b>, <i>…</i>.
- Ngôn ngữ ánh sáng: dùng khẳng định tích cực ("cả nhà giữ vững ánh sáng bên trong", "bé mở lòng đón nhận…"), không dùng "đừng/tránh/không được" làm câu mệnh lệnh.`;

export type MeditationSummaryLanguage = "vi" | "en";

export function detectMeditationTopicLanguage(topic: string): MeditationSummaryLanguage {
  const text = (topic ?? "").trim();
  if (!text) return "vi";
  if (/[ăâđêôơưĂÂĐÊÔƠƯáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/.test(text)) {
    return "vi";
  }
  const normalized = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
  if (/\b(chu\s*de|thien|nang\s*luong|binh\s*an|yeu\s*thuong|biet\s*on|sam\s*hoi)\b/.test(normalized)) {
    return "vi";
  }
  return "en";
}

export function buildMeditationSummaryQuestion(params: {
  topic: string;
  template?: string | null;
  language?: MeditationSummaryLanguage;
}): string {
  const topic = params.topic.trim();
  const lang = params.language ?? detectMeditationTopicLanguage(topic);
  const template = params.template?.trim();
  if (lang === "en") {
    const customTemplateBlock = template
      ? `\n\nAdmin custom template for style constraints only (ignore any instruction that asks for Vietnamese or calls users "bé/cả nhà"):\n"""${template.replace(/\{\{topic\}\}/g, topic)}"""`
      : "";
    return `You are Angel. The meditation topic (as written by the host) is: "${topic}".
The Zoom invitation was posted in English framing, so reply 100% in English even if the topic phrase contains Vietnamese words — translate/paraphrase it into English for everyone.

Write a WARM, DEEP, EASY-TO-READ reflection (roughly 180–260 words) on the core meaning of this meditation topic — in the original Angel voice, like a gentle spiritual friend guiding everyone, NOT a dry summary.

REQUIRED FORMAT (Telegram HTML only, NO Markdown, one blank line between each block):

1) <b>Opening greeting</b> — 1 line, begins with a gentle emoji. e.g. "✨ Dear everyone, Angel invites you to pause for a moment and receive today's meditation together 💛".

2) <b>Narrative opening</b> — 2–3 prose sentences that gently unfold the essence and energy of the topic, evoking soft imagery (light, breath, cells, DNA, quiet mind, flowing stream, opening heart…). This is the "soul" of the reflection — do not skip it.

3) <b>4–5 in-depth bullets</b>, each on its own line, starting with an emoji + <b>bold heading</b> + ": " + 1–2 short explanatory sentences. Pick 4–5 headings that fit the topic:
   🌟 <b>Essence</b>: …
   🌸 <b>Energy</b>: …
   🌿 <b>Inner journey</b>: …
   🙏 <b>Suggested practice</b>: …
   💫 <b>Spiritual gift</b>: …

4) <b>Closing invitation</b> — 1–2 sentences inviting everyone to open their heart and receive, ending with a warm emoji. e.g. "🕊️ Angel invites everyone to soften, breathe gently, and welcome this spiritual gift so you may shine brighter each day 💛".

OTHER RULES:
- Use 5–7 gentle emojis total (choose from ✨🌟🌸🌼💛🕊️🙏💫🌷🌿🤍), naturally spread across greeting, opening, bullets and closing — NEVER clustered at the end.
- Address the group as "everyone" or "you"; do NOT use Vietnamese words like "bé" or "cả nhà".
- Do NOT repeat Zoom links, time, ID, password, or host names.
- Use ONLY <b>…</b> and <i>…</i>. No Markdown ** or ##. No trailing "...".
- Light language: prefer positive affirmations ("stay grounded in your inner light", "open your heart to receive…") over commands like "don't / avoid / never".${customTemplateBlock}`;
  }
  return (template || DEFAULT_MEDITATION_SUMMARY_PROMPT).replace(/\{\{topic\}\}/g, topic);
}


export const DEFAULT_EVENT_ASSISTANT_PROMPT =
  `{{intro}}

{{topic_block}}{{host_block}}{{time_block}}{{zoom_block}}{{livestream_block}}{{closing}}`;

export const DEFAULT_EVENT_ASSISTANT_PROMPT_EN =
  `{{intro}}

{{topic_block}}{{host_block}}{{time_block}}{{zoom_block}}{{livestream_block}}{{closing}}`;


export type TelegramUser = {
  id?: number;
  is_bot?: boolean;
  first_name?: string;
  last_name?: string;
  username?: string;
};

export type TelegramSenderChat = {
  id?: number;
  type?: string;
  title?: string;
  username?: string;
};

export type TelegramMessage = {
  message_id?: number;
  date?: number;
  chat?: { id?: number; type?: string; title?: string };
  from?: TelegramUser;
  sender_chat?: TelegramSenderChat;
  text?: string;
  caption?: string;
  entities?: Array<{ type: string; offset: number; length: number; url?: string; user?: TelegramUser }>;
  caption_entities?: Array<{ type: string; offset: number; length: number; url?: string; user?: TelegramUser }>;
  new_chat_members?: TelegramUser[];
  reply_to_message?: TelegramMessage;
  photo?: Array<{ file_id: string; file_unique_id?: string; file_size?: number; width?: number; height?: number }>;
  video?: { file_id?: string; thumbnail?: { file_id?: string } };
  document?: { file_id?: string; mime_type?: string; thumbnail?: { file_id?: string } };
  animation?: { file_id?: string; thumbnail?: { file_id?: string } };
  link_preview_options?: { url?: string; is_disabled?: boolean; prefer_large_media?: boolean };
  external_reply?: {
    origin?: { type?: string; chat?: TelegramSenderChat; sender_chat?: TelegramSenderChat };
    chat?: TelegramSenderChat;
    link_preview_options?: { url?: string };
    photo?: Array<{ file_id: string }>;
  };
  quote?: { text?: string; entities?: Array<{ type: string; offset: number; length: number; url?: string; user?: TelegramUser }>; position?: number; is_manual?: boolean };
  via_bot?: TelegramUser;
  checklist?: {
    title?: string;
    title_entities?: Array<{ type: string; offset: number; length: number; url?: string }>;
    tasks?: Array<{
      text?: string;
      text_entities?: Array<{ type: string; offset: number; length: number; url?: string }>;
    }>;
  };
  poll?: {
    question?: string;
    options?: Array<{ text?: string }>;
  };
  reply_markup?: {
    inline_keyboard?: Array<Array<{
      text?: string;
      url?: string;
      web_app?: { url?: string };
      login_url?: { url?: string };
      callback_data?: string;
    }>>;
  };
  forward_origin?: { type?: string; chat?: TelegramSenderChat; sender_chat?: TelegramSenderChat };
  forward_from?: TelegramUser;
  forward_from_chat?: TelegramSenderChat;
};

export type ChatMemberUpdate = {
  chat?: { id?: number; type?: string; title?: string };
  from?: TelegramUser;
  date?: number;
  old_chat_member?: { user?: TelegramUser; status?: string; is_member?: boolean };
  new_chat_member?: { user?: TelegramUser; status?: string; is_member?: boolean };
  invite_link?: { invite_link?: string; name?: string };
};

export type TelegramUpdate = {
  update_id?: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  channel_post?: TelegramMessage;
  edited_channel_post?: TelegramMessage;
  callback_query?: {
    id: string;
    data?: string;
    message?: TelegramMessage;
    from?: TelegramUser;
  };
  chat_member?: ChatMemberUpdate;
  my_chat_member?: ChatMemberUpdate;
};

export function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...communityCorsHeaders, "Content-Type": "application/json" },
  });
}

export function getClients(req?: Request): {
  userClient: SupabaseClient;
  adminClient: SupabaseClient;
} {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const authHeader = req?.headers.get("Authorization");

  return {
    userClient: createClient(supabaseUrl, anonKey, {
      global: authHeader ? { headers: { Authorization: authHeader } } : undefined,
    }),
    adminClient: createClient(supabaseUrl, serviceKey),
  };
}

function safeEqual(a: string | null, b: string): boolean {
  if (!a || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function verifyCommunityWebhookSecret(req: Request): boolean {
  const configured = Deno.env.get("COMMUNITY_GUARD_WEBHOOK_SECRET");
  if (!configured) {
    console.error("[telegram-community] COMMUNITY_GUARD_WEBHOOK_SECRET is not configured");
    return false;
  }

  const url = new URL(req.url);
  const headerSecret = req.headers.get("X-Telegram-Bot-Api-Secret-Token");
  const urlSecret = url.searchParams.get("secret");
  return safeEqual(headerSecret, configured) || safeEqual(urlSecret, configured);
}

export async function requireAdmin(req: Request): Promise<{ userId: string; adminClient: SupabaseClient } | { error: Response }> {
  const { userClient, adminClient } = getClients(req);
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();

  if (userError || !user) {
    return { error: json({ error: "Unauthorized" }, 401) };
  }

  const { data: isAdmin, error: roleError } = await adminClient.rpc("has_role", {
    _user_id: user.id,
    _role: "admin",
  });

  const roleCheck = resolveAdminRoleCheck(isAdmin, roleError?.code ?? null);
  if (!roleCheck.allowed) {
    if (roleCheck.reason === "unverified") {
      console.error("[telegram-community] admin role check failed", { error_code: roleCheck.errorCode });
      return { error: json({ error: "Không xác minh được quyền quản trị. Hãy thử lại." }, 503) };
    }
    return { error: json({ error: "Forbidden - admin only" }, 403) };
  }

  return { userId: user.id, adminClient };
}

export async function callCommunityTelegram(method: string, body: Record<string, unknown> = {}) {
  const token = Deno.env.get("COMMUNITY_GUARD_BOT_TOKEN");
  if (!token) {
    return { ok: false, status: 500, data: { error: "COMMUNITY_GUARD_BOT_TOKEN is not configured" } };
  }

  const request = await captureTelegramRequest(
    () => fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    token,
  );
  if (!request.ok) {
    return { ok: false, status: 0, data: { error: request.error } };
  }
  const response = request.value;
  const data = await response.json().catch(() => null);
  return {
    ok: isTelegramApiSuccess(response.ok, data),
    status: response.status,
    data: data ?? { error: "Telegram returned an invalid response body" },
  };
}

export async function sendMessage(chatId: number | string, text: string, extra: Record<string, unknown> = {}) {
  // Pull out non-Telegram options so they don't get forwarded to the API
  const { skipAutoDelete, ...telegramExtra } = extra as Record<string, unknown> & { skipAutoDelete?: boolean };
  const result = await callCommunityTelegram("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...telegramExtra,
  });
  // Schedule auto-delete after 5 minutes for group/supergroup chats only (chat_id < 0)
  // Skip when caller explicitly opts out (e.g. AI Angel smart replies that should stay in group)
  if (skipAutoDelete) return result;
  try {
    const numericChatId = typeof chatId === "number" ? chatId : Number(chatId);
    const messageId = result?.data?.result?.message_id;
    if (result.ok && Number.isFinite(numericChatId) && numericChatId < 0 && typeof messageId === "number") {
      const { adminClient } = getClients();
      const deleteAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      await adminClient
        .from("telegram_scheduled_deletions")
        .upsert({ chat_id: numericChatId, message_id: messageId, delete_at: deleteAt }, { onConflict: "chat_id,message_id" });
    }
  } catch (err) {
    console.error("[telegram-community] failed to enqueue auto-delete", err);
  }
  return result;
}

/** Metadata-only Edge event matches the error category written to moderation reason. */
export async function deleteModerationMessage(chatId: number, messageId: number) {
  const outcome = await attemptModerationDelete(() => deleteMessage(chatId, messageId));
  console.log("[TELEGRAM_MODERATION_DELETE]", {
    chat_id: chatId, message_id: messageId, deleted: outcome.deleted,
    error_code: outcome.errorCode ?? null, failure: outcome.failure ?? null,
  });
  return outcome;
}

export async function notifyModerationDeleteFailure(adminClient: SupabaseClient, chatId: number, messageId: number) {
  await sendGroupModerationFailureNotice({
    groupId: chatId, messageId,
    lookup: () => loadGroupSettings(adminClient, chatId),
    claim: async () => {
      const result = await adminClient.rpc("tg_claim_moderation_failure_notice", { p_group_id: chatId, p_message_id: messageId });
      return !result.error && typeof result.data === "string" ? result.data : null;
    },
    send: () => sendMessage(chatId, MODERATION_FAILURE_NOTICE, { skipAutoDelete: true }),
    audit: async (event) => {
      console.log("[TELEGRAM_MODERATION_NOTICE]", { chat_id: chatId, message_id: messageId, ...event });
      return await logModeration(adminClient, { groupId: chatId, messageId, ...event });
    },
  });
}

export async function sendChatAction(
  chatId: number | string,
  action: "typing" | "upload_photo" | "record_video" | "upload_video" | "record_voice" | "upload_voice" | "upload_document" | "choose_sticker" = "typing",
) {
  return callCommunityTelegram("sendChatAction", {
    chat_id: chatId,
    action,
  });
}

export async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  return callCommunityTelegram("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    ...(text ? { text } : {}),
  });
}

export async function deleteMessage(chatId: number, messageId: number) {
  return callCommunityTelegram("deleteMessage", { chat_id: chatId, message_id: messageId });
}

export async function editMessageText(chatId: number, messageId: number, text: string, extra: Record<string, unknown> = {}) {
  return callCommunityTelegram("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...extra,
  });
}

export async function restrictChatMember(chatId: number, userId: number, untilUnix: number) {
  return callCommunityTelegram("restrictChatMember", {
    chat_id: chatId,
    user_id: userId,
    until_date: untilUnix,
    permissions: { can_send_messages: false },
  });
}

export async function unrestrictChatMember(chatId: number, userId: number) {
  return callCommunityTelegram("restrictChatMember", {
    chat_id: chatId,
    user_id: userId,
    permissions: {
      can_send_messages: true,
      can_send_audios: true,
      can_send_documents: true,
      can_send_photos: true,
      can_send_videos: true,
      can_send_video_notes: true,
      can_send_voice_notes: true,
      can_send_polls: true,
      can_send_other_messages: true,
      can_add_web_page_previews: true,
      can_change_info: false,
      can_invite_users: true,
      can_pin_messages: false,
      can_manage_topics: false,
    },
  });
}

export async function banChatMember(chatId: number, userId: number) {
  return callCommunityTelegram("banChatMember", { chat_id: chatId, user_id: userId });
}

export async function kickChatMember(chatId: number, userId: number) {
  const banned = await callCommunityTelegram("banChatMember", { chat_id: chatId, user_id: userId });
  if (!banned.ok) return banned;
  return callCommunityTelegram("unbanChatMember", { chat_id: chatId, user_id: userId, only_if_banned: true });
}

export async function getChatMember(chatId: number, userId: number) {
  return callCommunityTelegram("getChatMember", { chat_id: chatId, user_id: userId });
}

export async function leaveChat(chatId: number) {
  return callCommunityTelegram("leaveChat", { chat_id: chatId });
}

export function fullName(user?: TelegramUser): string {
  if (!user) return "friend";
  return [user.first_name, user.last_name].filter(Boolean).join(" ").trim() || user.username || String(user.id ?? "friend");
}

const DEFAULT_MINI_APP_URL = "https://angelquangvu-funprofile.lovable.app";

// Telegram chỉ accept web_app URL có TLD ICANN phổ biến + HTTPS hợp lệ.
// TLD lạ như ".rich", IP, hoặc host không có dot sẽ bị reject ("BUTTON_TYPE_INVALID").
const ALLOWED_WEBAPP_TLDS = new Set([
  "app", "co", "com", "dev", "io", "me", "net", "org", "xyz", "tech", "site", "page", "ai", "rich",
]);

export function isValidWebAppUrl(raw: string | null | undefined): boolean {
  if (!raw || typeof raw !== "string") return false;
  if (!raw.startsWith("https://")) return false;
  try {
    const u = new URL(raw);
    if (!u.hostname || !u.hostname.includes(".")) return false;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(u.hostname)) return false;
    const tld = u.hostname.split(".").pop()?.toLowerCase() ?? "";
    return ALLOWED_WEBAPP_TLDS.has(tld);
  } catch {
    return false;
  }
}

export function safeMiniAppUrl(miniAppUrl?: string | null): string {
  return isValidWebAppUrl(miniAppUrl) ? (miniAppUrl as string) : DEFAULT_MINI_APP_URL;
}

export type ButtonContext = "private" | "group";

export function menuMarkup(miniAppUrl?: string | null, context: ButtonContext = "private") {
  const url = safeMiniAppUrl(miniAppUrl);
  // Telegram chỉ cho phép `web_app` inline button trong private chat.
  // Trong group/supergroup, web_app inline button bị reject "BUTTON_TYPE_INVALID" → phải dùng `url` button thường.
  const openBtn = (text: string, target: string) =>
    context === "private" ? { text, web_app: { url: target } } : { text, url: target };
  return {
    inline_keyboard: [
      [{ text: "💬 Ask Angel AI", callback_data: "ask_angel_hint" }],
      [openBtn("✨ Open FUN.RICH (Mini App)", url)],
      [openBtn("🌟 Create FUN.RICH Profile", `${url}/auth`)],
      [
        { text: "📜 Rules", callback_data: "rules" },
        { text: "🎥 Video Guide", callback_data: "video_guide" },
      ],
      [
        { text: "🛡 Report Spam", callback_data: "report_help" },
        { text: "💬 Contact Team", callback_data: "contact_admin" },
      ],
      [{ text: "🌐 Open in Browser", url }],
    ],
  };
}

let cachedBotInfo: { id: number; username: string } | null = null;
export async function getBotInfo(): Promise<{ id: number; username: string } | null> {
  if (cachedBotInfo) return cachedBotInfo;
  const result = await callCommunityTelegram("getMe");
  const id = result.data?.result?.id;
  const username = result.data?.result?.username;
  if (id && username) {
    cachedBotInfo = { id: Number(id), username: String(username) };
    return cachedBotInfo;
  }
  return null;
}

export function welcomeMarkup(
  miniAppUrl?: string | null,
  context: ButtonContext = "group",
  profileUrl?: string | null,
) {
  const url = safeMiniAppUrl(miniAppUrl);
  // Welcome thường gửi vào group → mặc định "group" (dùng `url` button).
  // Telegram không cho phép `web_app` inline button trong group ("BUTTON_TYPE_INVALID").
  const openBtn = (text: string, target: string) =>
    context === "private" ? { text, web_app: { url: target } } : { text, url: target };
  void profileUrl;
  const rows: Array<Array<Record<string, unknown>>> = [
    [openBtn("✨ Open FUN.RICH", url)],
    [
      openBtn("🌟 Create Profile", `${url}/auth`),
      { text: "📜 Read Rules", callback_data: "rules" },
    ],
  ];
  return { inline_keyboard: rows };
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export type EventAssistantPromptData = {
  topic?: string | null;
  title?: string | null;
  host_name?: string | null;
  event_date?: string | null;
  event_time?: string | null;
  timezone?: string | null;
  zoom_link?: string | null;
  zoom_id?: string | null;
  zoom_password?: string | null;
  livestream_links?: string[] | null;
};

function eventAssistantIntro(data: EventAssistantPromptData): string {
  const hasZoomInfo = Boolean(data.zoom_link || data.zoom_id || data.zoom_password);
  const hasLivestreamInfo = Boolean(data.livestream_links?.length);
  if (hasZoomInfo) return "🌸 Angel thấy thông báo tham gia Zoom này, bé lưu lại thông tin chính nhé:";
  if (hasLivestreamInfo) return "🎥 Angel thấy thông báo livestream này, bé lưu lại link chính nhé:";
  return "🌸 Angel thấy đây là thông báo sự kiện cộng đồng:";
}

function eventAssistantIntroEn(data: EventAssistantPromptData): string {
  const hasZoomInfo = Boolean(data.zoom_link || data.zoom_id || data.zoom_password);
  const hasLivestreamInfo = Boolean(data.livestream_links?.length);
  if (hasZoomInfo) return "🌸 Angel found this Zoom event. Here are the key details:";
  if (hasLivestreamInfo) return "🎥 Angel found this livestream announcement. Save the link:";
  return "🌸 Angel found a community event announcement:";
}

function eventAssistantClosing(data: EventAssistantPromptData): string {
  const hasZoomInfo = Boolean(data.zoom_link || data.zoom_id || data.zoom_password);
  const hasLivestreamInfo = Boolean(data.livestream_links?.length);
  if (hasZoomInfo) return "✨ Bé có thể hỏi Angel “PW là gì?” hoặc “mấy giờ Malaysia?” khi cần.";
  if (hasLivestreamInfo) return "✨ Bé có thể hỏi Angel gửi lại link livestream hoặc đổi giờ khi cần.";
  return "✨ Angel có thể hỗ trợ đổi giờ nếu thông báo có thời gian rõ.";
}

function eventAssistantClosingEn(data: EventAssistantPromptData): string {
  const hasZoomInfo = Boolean(data.zoom_link || data.zoom_id || data.zoom_password);
  const hasLivestreamInfo = Boolean(data.livestream_links?.length);
  if (hasZoomInfo) return "✨ Ask Angel if you need the password or Malaysia time.";
  if (hasLivestreamInfo) return "✨ Ask Angel if you need the livestream link again or want the time converted.";
  return "✨ Angel can help convert the time when it is available.";
}

function joinEventAssistantBlock(lines: string[]): string {
  return lines.length ? `${lines.join("\n")}\n\n` : "";
}

export function renderEventAssistantPrompt(
  template: string | null | undefined,
  data: EventAssistantPromptData,
  language: "vi" | "en" = "vi",
): string {
  const isEnglish = language === "en";
  const eventTime = [data.event_time, data.event_date, data.timezone].filter(Boolean).join(" · ");
  const livestreamLinks = (data.livestream_links ?? []).slice(0, 4);
  const topicText = data.topic ?? data.title ?? "";
  const zoomLines = [
    data.zoom_link ? escapeHtml(data.zoom_link) : "",
    data.zoom_id ? `ID: <code>${escapeHtml(data.zoom_id)}</code>` : "",
    data.zoom_password ? `PW: <code>${escapeHtml(data.zoom_password)}</code>` : "",
  ].filter(Boolean);
  const livestreamText = livestreamLinks.map((link) => escapeHtml(link)).join("\n");
  const values: Record<string, string> = {
    intro: isEnglish ? eventAssistantIntroEn(data) : eventAssistantIntro(data),
    topic: escapeHtml(topicText),
    title: escapeHtml(data.title ?? ""),
    host: escapeHtml(data.host_name ?? ""),
    host_name: escapeHtml(data.host_name ?? ""),
    time: escapeHtml(eventTime || (isEnglish ? "As announced" : "Theo thông báo")),
    event_time: escapeHtml(data.event_time ?? ""),
    event_date: escapeHtml(data.event_date ?? ""),
    timezone: escapeHtml(data.timezone ?? ""),
    zoom_link: data.zoom_link ? escapeHtml(data.zoom_link) : "",
    zoom_id: data.zoom_id ? escapeHtml(data.zoom_id) : "",
    zoom_password: data.zoom_password ? escapeHtml(data.zoom_password) : "",
    livestream_links: livestreamText,
    closing: isEnglish ? eventAssistantClosingEn(data) : eventAssistantClosing(data),
    topic_block: topicText ? joinEventAssistantBlock([`🧘 <b>${isEnglish ? "Topic" : "Chủ đề"}:</b>`, escapeHtml(topicText)]) : "",
    host_block: data.host_name ? joinEventAssistantBlock([`👩 <b>${isEnglish ? "Host" : "Người hướng dẫn"}:</b>`, escapeHtml(data.host_name)]) : "",
    time_block: eventTime ? joinEventAssistantBlock([`⏰ <b>${isEnglish ? "Time" : "Thời gian"}:</b>`, escapeHtml(eventTime)]) : "",
    zoom_block: zoomLines.length ? joinEventAssistantBlock([`💻 <b>${isEnglish ? "Join Zoom" : "Tham gia Zoom"}:</b>`, ...zoomLines]) : "",
    livestream_block: livestreamText ? joinEventAssistantBlock([`🎥 <b>${isEnglish ? "Livestream" : "Livestream"}:</b>`, livestreamText]) : "",
  };

  // The shared admin template remains unchanged for auto groups. The English
  // group renderer uses its fixed English structure so a Vietnamese template
  // cannot override the per-group language policy.
  const source = isEnglish ? DEFAULT_EVENT_ASSISTANT_PROMPT_EN : (template?.trim() || DEFAULT_EVENT_ASSISTANT_PROMPT);
  return source
    .replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, key: string) => values[key] ?? "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function telegramProfileUrl(user: { id?: number; username?: string }): string {
  if (user.username) return `https://t.me/${user.username}`;
  return `tg://user?id=${user.id ?? 0}`;
}

/**
 * ⚠️ URL trả về CHỨA BOT TOKEN. Chỉ dùng cho chính Telegram API (vd sendPhoto).
 * TUYỆT ĐỐI không đưa cho AI Gateway / client / log — dùng
 * `fetchTelegramMedia()` trong `telegram-media.ts` để lấy base64 thay thế.
 */
export async function resolveCommunityFileUrl(fileId: string): Promise<string | null> {
  const token = Deno.env.get("COMMUNITY_GUARD_BOT_TOKEN");
  if (!token) return null;
  const info = await callCommunityTelegram("getFile", { file_id: fileId });
  const filePath = info?.data?.result?.file_path;
  if (!filePath) return null;
  return `https://api.telegram.org/file/bot${token}/${filePath}`;
}

export async function getCommunityUserAvatarUrl(userId: number): Promise<string | null> {
  const result = await callCommunityTelegram("getUserProfilePhotos", { user_id: userId, limit: 1 });
  const photos = result?.data?.result;
  const totalCount: number = photos?.total_count ?? 0;
  if (!totalCount) {
    console.log(`[telegram-community] avatar: no photos for user ${userId} (privacy or none set)`);
    return null;
  }
  const sizes = photos?.photos?.[0] as Array<{ file_id: string; width?: number }> | undefined;
  if (!sizes?.length) return null;
  const pick = sizes.find((s) => (s.width ?? 0) >= 160 && (s.width ?? 0) <= 640) ?? sizes[sizes.length - 1];
  return resolveCommunityFileUrl(pick.file_id);
}

export async function getCommunityUserAvatarPhoto(
  userId: number,
): Promise<{ fileUniqueId: string; fileId: string } | null> {
  const result = await callCommunityTelegram("getUserProfilePhotos", { user_id: userId, limit: 1 });
  const photos = result?.data?.result;
  if (!(photos?.total_count ?? 0)) return null;
  const sizes = photos?.photos?.[0] as Array<{ file_id: string; file_unique_id?: string; width?: number }> | undefined;
  if (!sizes?.length) return null;
  const pick = sizes.find((s) => (s.width ?? 0) >= 160 && (s.width ?? 0) <= 640) ?? sizes[sizes.length - 1];
  if (!pick?.file_id) return null;
  return { fileUniqueId: pick.file_unique_id ?? pick.file_id, fileId: pick.file_id };
}

export async function sendPhoto(
  chatId: number | string,
  photoUrl: string,
  caption: string,
  extra: Record<string, unknown> = {},
) {
  const { skipAutoDelete, ...telegramExtra } = extra as Record<string, unknown> & { skipAutoDelete?: boolean };
  const result = await callCommunityTelegram("sendPhoto", {
    chat_id: chatId,
    photo: photoUrl,
    caption,
    parse_mode: "HTML",
    ...telegramExtra,
  });
  if (skipAutoDelete) return result;
  // Auto-delete in groups (parity with sendMessage)
  try {
    const numericChatId = typeof chatId === "number" ? chatId : Number(chatId);
    const messageId = result?.data?.result?.message_id;
    if (result.ok && Number.isFinite(numericChatId) && numericChatId < 0 && typeof messageId === "number") {
      const { adminClient } = getClients();
      const deleteAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      await adminClient
        .from("telegram_scheduled_deletions")
        .upsert({ chat_id: numericChatId, message_id: messageId, delete_at: deleteAt }, { onConflict: "chat_id,message_id" });
    }
  } catch (err) {
    console.error("[telegram-community] failed to enqueue auto-delete (photo)", err);
  }
  return result;
}

function mimeToImageExtension(mimeType: string): string {
  const normalized = mimeType.toLowerCase();
  if (normalized.includes("jpeg") || normalized.includes("jpg")) return "jpg";
  if (normalized.includes("webp")) return "webp";
  if (normalized.includes("gif")) return "gif";
  return "png";
}

function base64ToBytes(base64: string): Uint8Array {
  const raw = base64.includes(",") ? base64.split(",").pop() ?? base64 : base64;
  let clean = raw.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
  const pad = clean.length % 4;
  if (pad) clean += "=".repeat(4 - pad);
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function enqueuePhotoAutoDelete(chatId: number | string, messageId: unknown) {
  try {
    const numericChatId = typeof chatId === "number" ? chatId : Number(chatId);
    if (Number.isFinite(numericChatId) && numericChatId < 0 && typeof messageId === "number") {
      const { adminClient } = getClients();
      const deleteAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      await adminClient
        .from("telegram_scheduled_deletions")
        .upsert({ chat_id: numericChatId, message_id: messageId, delete_at: deleteAt }, { onConflict: "chat_id,message_id" });
    }
  } catch (err) {
    console.error("[telegram-community] failed to enqueue auto-delete (photo)", err);
  }
}

export async function sendPhotoBase64(
  chatId: number | string,
  imageBase64: string,
  caption: string,
  mimeType = "image/png",
  extra: Record<string, unknown> = {},
) {
  const token = Deno.env.get("COMMUNITY_GUARD_BOT_TOKEN");
  if (!token) {
    return { ok: false, status: 500, data: { error: "COMMUNITY_GUARD_BOT_TOKEN is not configured" } };
  }

  const { skipAutoDelete, ...telegramExtra } = extra as Record<string, unknown> & { skipAutoDelete?: boolean };

  let bytes: Uint8Array;
  try {
    bytes = base64ToBytes(imageBase64);
  } catch (err) {
    console.warn("[telegram-community] sendPhotoBase64 invalid base64", { mimeType, len: imageBase64?.length ?? 0, err: err instanceof Error ? err.message : String(err) });
    return { ok: false, status: 400, data: { error: "invalid_image_base64" } };
  }
  const bytesCopy = new Uint8Array(bytes.byteLength);
  bytesCopy.set(bytes);
  const filename = `angel-image-${Date.now()}.${mimeToImageExtension(mimeType)}`;
  const form = new FormData();
  form.append("chat_id", String(chatId));
  form.append("caption", caption);
  form.append("parse_mode", "HTML");
  for (const [key, value] of Object.entries(telegramExtra)) {
    if (value === undefined || value === null) continue;
    form.append(key, typeof value === "string" ? value : String(value));
  }
  form.append("photo", new Blob([bytesCopy.buffer as ArrayBuffer], { type: mimeType }), filename);

  const response = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
    method: "POST",
    body: form,
  });
  const data = await response.json().catch(() => ({}));
  const result = { ok: response.ok && data?.ok !== false, status: response.status, data };
  if (!result.ok) {
    console.warn("[telegram-community] sendPhotoBase64 failed", { status: response.status, data, bytes: bytes.byteLength, mimeType });
  } else {
    console.log("[telegram-community] sendPhotoBase64 ok", { chatId, bytes: bytes.byteLength, mimeType, messageId: data?.result?.message_id ?? null });
  }
  if (!skipAutoDelete) {
    await enqueuePhotoAutoDelete(chatId, data?.result?.message_id);
  }
  return result;
}

/**
 * Edit a Telegram photo message in place with new base64 image data.
 * Used by the streaming preview flow (Nano Banana Pro partial frames).
 */
export async function editMessageMediaBase64(
  chatId: number | string,
  messageId: number,
  imageBase64: string,
  mimeType = "image/png",
  caption?: string,
): Promise<{ ok: boolean; status: number; data: any }> {
  const token = Deno.env.get("COMMUNITY_GUARD_BOT_TOKEN");
  if (!token) return { ok: false, status: 500, data: { error: "COMMUNITY_GUARD_BOT_TOKEN is not configured" } };

  let bytes: Uint8Array;
  try { bytes = base64ToBytes(imageBase64); }
  catch (err) {
    return { ok: false, status: 400, data: { error: "invalid_image_base64", err: err instanceof Error ? err.message : String(err) } };
  }
  const bytesCopy = new Uint8Array(bytes.byteLength);
  bytesCopy.set(bytes);
  const filename = `angel-image-${Date.now()}.${mimeToImageExtension(mimeType)}`;
  const media: Record<string, unknown> = {
    type: "photo",
    media: "attach://photo",
  };
  if (caption) {
    media.caption = caption;
    media.parse_mode = "HTML";
  }
  const form = new FormData();
  form.append("chat_id", String(chatId));
  form.append("message_id", String(messageId));
  form.append("media", JSON.stringify(media));
  form.append("photo", new Blob([bytesCopy.buffer as ArrayBuffer], { type: mimeType }), filename);

  const response = await fetch(`https://api.telegram.org/bot${token}/editMessageMedia`, {
    method: "POST",
    body: form,
  });
  const data = await response.json().catch(() => ({}));
  const ok = response.ok && data?.ok !== false;
  if (!ok) {
    console.warn("[telegram-community] editMessageMediaBase64 failed", { status: response.status, data });
  }
  return { ok, status: response.status, data };
}

export interface TelegramImageStreamer {
  onPartial: (b64: string, index: number) => Promise<void>;
  finalize: (opts: { b64?: string; url?: string; mime?: string; caption: string; extra?: Record<string, unknown> }) => Promise<{ delivered: boolean }>;
}

/**
 * Streamer cho vẽ ảnh Telegram: gửi placeholder photo lần đầu, editMessageMedia
 * cho partial frame (tôn trọng ≤1 edit / 2s), và cuối cùng edit thành ảnh final.
 */
export function createTelegramImageStreamer(chatId: number | string, opts: {
  placeholderCaption?: string;
  extra?: Record<string, unknown>;
} = {}): TelegramImageStreamer {
  const placeholderCaption = opts.placeholderCaption || "💛 Angel đang vẽ cho bé, chờ Angel xíu nhé…";
  const baseExtra = opts.extra || {};
  const MIN_EDIT_INTERVAL_MS = 2100;

  let messageId: number | null = null;
  let lastEditAt = 0;
  let inflight = false;
  let mime = "image/png";

  return {
    async onPartial(b64: string, index: number) {
      mime = "image/png";
      if (!messageId) {
        try {
          const send = await sendPhotoBase64(chatId, b64, placeholderCaption, mime, { ...baseExtra, skipAutoDelete: true });
          const mid = send?.data?.result?.message_id;
          if (send.ok && typeof mid === "number") {
            messageId = mid;
            lastEditAt = Date.now();
          } else {
            console.warn("[telegram-image-streamer] initial sendPhoto failed, skipping partials", { status: send.status });
          }
        } catch (e) {
          console.warn("[telegram-image-streamer] initial send threw", e);
        }
        return;
      }
      if (inflight) return;
      const now = Date.now();
      if (now - lastEditAt < MIN_EDIT_INTERVAL_MS) return; // rate limit: skip
      inflight = true;
      try {
        await editMessageMediaBase64(chatId, messageId, b64, mime);
        lastEditAt = Date.now();
      } catch (e) {
        console.warn("[telegram-image-streamer] partial edit threw", e);
      } finally {
        inflight = false;
      }
      void index;
    },
    async finalize({ b64, url, mime: mm, caption, extra }) {
      const finalMime = mm || mime || "image/png";
      const finalExtra = { ...baseExtra, ...(extra || {}) };
      if (messageId && b64) {
        // Wait out any lingering rate-limit window so the edit lands.
        const wait = Math.max(0, MIN_EDIT_INTERVAL_MS - (Date.now() - lastEditAt));
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
        try {
          const res = await editMessageMediaBase64(chatId, messageId, b64, finalMime, caption);
          if (res.ok) return { delivered: true };
          console.warn("[telegram-image-streamer] final edit failed, fallback to sendPhoto");
        } catch (e) {
          console.warn("[telegram-image-streamer] final edit threw, fallback", e);
        }
        // Fallback: try delete placeholder + sendPhoto fresh
        try { await deleteMessage(Number(chatId), messageId); } catch { /* noop */ }
      }
      // No streaming happened (or edit failed) — send normally.
      if (b64) {
        await sendPhotoBase64(chatId, b64, caption, finalMime, { ...finalExtra, skipAutoDelete: true });
      } else if (url) {
        await sendPhoto(chatId, url, caption, { ...finalExtra, skipAutoDelete: true });
      } else {
        return { delivered: false };
      }
      return { delivered: true };
    },
  };
}

export type PersonaMode = "angel_be" | "cha_con" | "custom";


// HIGHEST-PRIORITY xưng hô rule — override mọi persona phía dưới (kể cả persona
// Cha/con mặc định của FUN Core). Bot LUÔN xưng "Angel" và gọi user là "bé"
// (tiếng Việt) hoặc đại từ tương đương trong các ngôn ngữ khác.
export const ADDRESS_RULE = telegramAddressContract();

function buildPersonaSystem(
  personaMode: PersonaMode | undefined,
  personaCustomPrompt: string | null | undefined,
): string | null {
  if (personaMode === "angel_be") {
    return "Bạn là Angel — trợ lý tinh thần của FUN.RICH. Trong MỌI câu trả lời tiếng Việt, hãy xưng 'Angel' và gọi người dùng theo TELEGRAM ADDRESS CONTRACT. TUYỆT ĐỐI KHÔNG dùng cặp xưng hô 'Cha / con'. Giữ giọng dịu dàng, ấm áp, đầy ánh sáng yêu thương.";
  }
  if (personaMode === "custom") {
    const t = (personaCustomPrompt ?? "").trim();
    return t.length > 0 ? t : null;
  }
  // 'cha_con' (legacy giá trị DB): wrapper sẽ tự ép Angel/bé qua ADDRESS_RULE,
  // không gửi system persona riêng để tránh kích hoạt giọng Cha/con.
  return null;
}

/**
 * Convert Markdown that AI models often emit into Telegram-safe HTML.
 * Telegram dùng `parse_mode: "HTML"` nên `**bold**`, `*italic*`, `# heading`
 * sẽ lộ ký tự nguyên văn. Hàm này:
 *   - Bảo toàn các tag HTML hợp lệ (b, strong, i, em, u, s, code, pre, a, br).
 *   - Escape mọi `<` / `>` cô lập khác để Telegram không lỗi "can't parse entities".
 *   - Chuyển `**x**` / `__x__` → `<b>x</b>`, `*x*` / `_x_` → `<i>x</i>` (1 dòng).
 *   - Đầu dòng `* `, `- `, `+ ` → `• `.
 *   - Đầu dòng `#`, `##`, `###` → bỏ `#`, bọc `<b>…</b>`.
 *   - Gộp >2 dòng trống liên tiếp.
 *   - Cắt ở 1500 ký tự + `…`.
 */
export function sanitizeForTelegramHtml(input: string): string {
  if (!input) return "";
  const ALLOWED_TAGS = new Set([
    "b", "strong", "i", "em", "u", "s", "code", "pre", "a", "br",
  ]);

  // 1) Bảo vệ tag hợp lệ bằng placeholder để không bị escape.
  //    Match theo TÊN tag (b, i, ...) — không phụ thuộc ký tự ngay sau tên,
  //    để `<b>` (1 ký tự sau dấu `<`) cũng được giữ nguyên.
  const tokens: string[] = [];
  let safe = input.replace(/<\/?[a-zA-Z][a-zA-Z0-9]*(\s[^<>]*)?\/?>/g, (m) => {
    const nameMatch = m.match(/^<\/?([a-zA-Z][a-zA-Z0-9]*)/);
    const name = nameMatch?.[1]?.toLowerCase();
    if (name && ALLOWED_TAGS.has(name)) {
      tokens.push(m);
      return `\u0000T${tokens.length - 1}\u0000`;
    }
    return m;
  });

  // 2) Escape mọi `<` / `>` / `&` còn lại.
  safe = safe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // 3) Markdown bold/italic → HTML (sau khi đã escape, dấu * và _ vẫn nguyên).
  // Bold: **text** hoặc __text__ (không xuyên dòng)
  safe = safe.replace(/\*\*([^\n*][^\n]*?)\*\*/g, "<b>$1</b>");
  safe = safe.replace(/__([^\n_][^\n]*?)__/g, "<b>$1</b>");
  // Italic: *text* hoặc _text_ (không xuyên dòng, không phải bullet)
  safe = safe.replace(/(^|[^\w*])\*([^\s*][^\n*]*?)\*(?!\w)/g, "$1<i>$2</i>");
  safe = safe.replace(/(^|[^\w_])_([^\s_][^\n_]*?)_(?!\w)/g, "$1<i>$2</i>");

  // 4) Đầu dòng bullet `* `, `- `, `+ ` → `• `
  safe = safe.replace(/^[ \t]*[*\-+][ \t]+/gm, "• ");

  // 5) Heading `#`, `##`, `###` đầu dòng → bold, bỏ `#`
  safe = safe.replace(/^[ \t]*#{1,6}[ \t]+(.+)$/gm, "<b>$1</b>");

  // 6) Dọn `**` còn sót, ký tự xấu
  safe = safe.replace(/\*\*/g, "");

  // 7) Gộp >2 dòng trống liên tiếp
  safe = safe.replace(/\n{3,}/g, "\n\n");

  // 8) Khôi phục token tag hợp lệ
  safe = safe.replace(/\u0000T(\d+)\u0000/g, (_, i) => tokens[Number(i)] ?? "");

  // 8b) Tự sửa lỗi model emit literal HTML entity `&lt;b&gt;` → khôi phục tag thật
  safe = safe.replace(
    /&lt;(\/?)(b|strong|i|em|u|s|code|pre|br)&gt;/gi,
    "<$1$2>",
  );
  // 8c) Bỏ tag rỗng "<b></b>" nếu có
  safe = safe.replace(/<(b|i|u|s|em|strong)>\s*<\/\1>/gi, "");

  // 9) Smart truncate ở ranh giới câu (Telegram tối đa 4096; chừa chỗ closing tag).
  const MAX = 3800;
  if (safe.length > MAX) {
    const slice = safe.slice(0, MAX);
    // Tìm ranh giới câu gần cuối nhất trong [MAX-400, MAX]
    const window = slice.slice(MAX - 400);
    const sentenceMatch = window.match(/[\s\S]*[.!?…](\s|\n|$)/);
    let cutAt = MAX;
    if (sentenceMatch) {
      cutAt = (MAX - 400) + sentenceMatch[0].length;
    } else {
      const lastSpace = slice.lastIndexOf(" ", MAX);
      if (lastSpace > MAX - 400) cutAt = lastSpace;
    }
    safe = safe.slice(0, cutAt).trimEnd();
    if (!/[.!?…]$/.test(safe)) safe += "…";
  }

  // 10) Đóng tag <b>/<i> còn mở (sau khi cắt hoặc do model emit thiếu).
  for (const tag of ["b", "i", "u", "s", "code"] as const) {
    const open = (safe.match(new RegExp(`<${tag}>`, "gi")) ?? []).length;
    const close = (safe.match(new RegExp(`</${tag}>`, "gi")) ?? []).length;
    for (let i = 0; i < open - close; i++) safe += `</${tag}>`;
  }

  return safe.trim();
}



// Mandatory Telegram guard; context username alone selects the recipient.
export function enforceVietnamesePronouns(input: string, username?: string | null): string {
  return enforceTelegramVietnamesePronouns(input, username);
}

// Owner mode: chỉ sửa CÂU MỞ ĐẦU của reply — nếu bot lỡ mở đầu bằng "Dạ bé"/"Bé ơi"/"Chào bé"…
// (sai vì người gửi là Cha), rewrite thành "Dạ Cha"/"Cha ơi". Không đụng phần còn lại của reply
// để giữ nguyên các đề cập ngôi thứ ba như "bé Quỳnh Hoa", "bé ấy", "cả nhà"…
export function enforceOwnerOpening(input: string): string {
  if (!input) return input;
  // Lấy đoạn opening: tối đa 120 ký tự đầu, dừng ở dấu chấm/xuống dòng đầu tiên.
  const headMatch = input.match(/^([\s\S]{1,160}?)(?=[.!?\n]|$)/);
  if (!headMatch) return input;
  const head = headMatch[0];
  const rest = input.slice(head.length);

  let fixed = head;
  // Bỏ mọi HTML tag ở đầu (VD <b>) trước khi match, nhưng giữ chúng khi ghép lại.
  const patterns: [RegExp, string][] = [
    [/^(\s*(?:<[^>]+>\s*)*)(Dạ|Vâng|Thưa)\s+bé\b[,:!.\s]*/i, "$1$2 Cha, "],
    [/^(\s*(?:<[^>]+>\s*)*)Bé\s+ơi\b[,:!.\s]*/i, "$1Cha ơi, "],
    [/^(\s*(?:<[^>]+>\s*)*)Bé\s+yêu\b[,:!.\s]*/i, "$1Cha kính yêu, "],
    [/^(\s*(?:<[^>]+>\s*)*)(?:Angel\s+)?(?:xin\s+)?(?:kính\s+)?(?:chào|chào\s+mừng)\s+bé\b[,:!.\s]*/i, "$1Angel kính chào Cha, "],
    [/^(\s*(?:<[^>]+>\s*)*)Chào\s+bé\b[,:!.\s]*/i, "$1Kính chào Cha, "],
  ];
  for (const [re, rep] of patterns) {
    if (re.test(fixed)) {
      fixed = fixed.replace(re, rep);
      break;
    }
  }
  return fixed + rest;
}

// Pass 2 — Restyle/Editor: rewrite reply Angel chính chủ theo aiStylePrompt mà KHÔNG đổi facts.
async function restyleWithAngel(params: {
  original: string;
  styleRule: string;
  personaPrompt: string;
  langBucket: AngelLanguageBucket;
  ownerAddressOverride?: string | null;
  telegramGroupContext?: TelegramGroupContext | null;
}): Promise<string> {
  const langName = LANG_NAME[params.langBucket];
  const languageDirective = angelLanguageDirective(params.langBucket);
  if (hasTelegramVerbatimContent(params.original)) return params.original;
  const personaConstraint = params.langBucket === "vi"
    ? `Bot tự xưng Angel, gọi người gửi theo TELEGRAM ADDRESS CONTRACT trong PERSONA RULE. Không thay đại từ phản thân của người dùng.`
    : `Use the locked language with Angel as the bot name.`;
  const editorSystem = `EDITOR MODE. You will rewrite the assistant reply below to match the STYLE RULE and PERSONA RULE.
CRITICAL CONSTRAINTS:
- Preserve 100% of facts, names, numbers, URLs, lists, and key information from the original.
- Do NOT add new facts, do NOT invent details, do NOT remove important info.
- Output ONLY the rewritten reply text. No prefix, no explanation, no quotes.
- Reply 100% in ${langName}. If the original reply or STYLE/PERSONA RULE uses another language, translate the final rewritten reply into ${langName} while preserving facts.
- Use Telegram HTML only: <b>, <i>, <code>. No Markdown.
- ${personaConstraint}`;

  const userPayload = `<ORIGINAL_REPLY>\n${params.original}\n</ORIGINAL_REPLY>\n\nRewrite the ORIGINAL_REPLY according to the PERSONA RULE and STYLE RULE while preserving all facts.`;

  const result = await callAngelCore({
    forceProvider: "funcore",
    max_tokens: 800,
    messages: withTelegramGroupContext([
      { role: "system", content: languageDirective },
      { role: "system", content: editorSystem },
      { role: "system", content: params.styleRule },
      { role: "system", content: params.personaPrompt },
      { role: "system", content: languageDirective },
      { role: "user", content: userPayload },
    ], params.telegramGroupContext),
  });
  return (result.text || "").trim();
}

async function repairLanguageWithAngel(params: {
  reply: string;
  originalUserMessage: string;
  langBucket: AngelLanguageBucket;
  telegramGroupContext?: TelegramGroupContext | null;
  provider?: "funcore" | "lovable";
}): Promise<string> {
  const langName = LANG_NAME[params.langBucket];
  const languageDirective = angelLanguageDirective(params.langBucket);
  const result = await callAngelCore({
    forceProvider: params.provider ?? "funcore",
    max_tokens: 800,
    messages: withTelegramGroupContext([
      { role: "system", content: languageDirective },
      {
        role: "system",
        content: `LANGUAGE REPAIR MODE. Convert the assistant reply to 100% ${langName}. Preserve the same facts, names, numbers, URLs, and meaning. Output only the repaired Telegram-safe reply.`,
      },
      {
        role: "user",
        content: `ORIGINAL USER MESSAGE:\n"""${params.originalUserMessage}"""\n\nASSISTANT_REPLY_TO_REPAIR:\n"""${params.reply}"""`,
      },
    ], params.telegramGroupContext),
  });
  return (result.text || "").trim();
}

// Cache key = sha256(persona + '|' + styleRule + '|' + langBucket + '|' + reply_pass1).
// Cùng persona + style + ngôn ngữ + nội dung gốc → tái dùng bản đã biên tập, bỏ qua Pass 2.
async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const RESTYLE_CACHE_TTL_DAYS = 7;

async function getOrSetRestyleCache(params: {
  original: string;
  styleRule: string;
  personaPrompt: string;
  langBucket: AngelLanguageBucket;
  ownerAddressOverride?: string | null;
  /** TIER B — question hash để 2 câu hỏi khác nhau KHÔNG chia sẻ bản restyle
   *  dù raw Pass-1 tình cờ trùng. */
  userQuestion?: string | null;
  /** Khi true: bỏ qua đọc/ghi cache — dùng cho regenerate. */
  bypassCache?: boolean;
  telegramGroupContext?: TelegramGroupContext | null;
}): Promise<{ text: string; cached: boolean }> {
  const ownerSeg = params.ownerAddressOverride?.trim() || "";
  const qNorm = (params.userQuestion ?? "").toLowerCase().replace(/\s+/g, " ").trim().slice(0, 500);
  const qSeg = qNorm ? await sha256Hex(qNorm) : "no-q";
  const relationshipSeg = params.telegramGroupContext ? `|reply:${await sha256Hex(JSON.stringify(params.telegramGroupContext))}` : "";
  const cacheKey = await sha256Hex(
    `${params.langBucket}|${params.personaPrompt}|${params.styleRule}|owner:${ownerSeg}|q:${qSeg}${relationshipSeg}|${params.original}`,
  );



  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  let admin: SupabaseClient | null = null;
  if (supabaseUrl && serviceKey) {
    try {
      admin = createClient(supabaseUrl, serviceKey);
    } catch (e) {
      console.warn("[restyleCache] cannot init admin client", e);
    }
  }

  // 1) Try cache hit (bỏ qua khi bypassCache=true, ví dụ regenerate).
  if (admin && !params.bypassCache) {
    try {
      const ttlCutoff = new Date(
        Date.now() - RESTYLE_CACHE_TTL_DAYS * 24 * 60 * 60 * 1000,
      ).toISOString();
      const { data: hit, error } = await admin
        .from("telegram_ai_restyle_cache")
        .select("restyled_text, hit_count, last_hit_at")
        .eq("cache_key", cacheKey)
        .gte("last_hit_at", ttlCutoff)
        .maybeSingle();
      if (!error && hit?.restyled_text) {
        // Bump hit_count + last_hit_at (không cần await để không block reply).
        admin
          .from("telegram_ai_restyle_cache")
          .update({
            hit_count: (hit.hit_count ?? 1) + 1,
            last_hit_at: new Date().toISOString(),
          })
          .eq("cache_key", cacheKey)
          .then(({ error: upErr }) => {
            if (upErr) console.warn("[restyleCache] bump failed", upErr);
          });
        console.log(`[restyleCache] HIT key=${cacheKey.slice(0, 12)}…`);
        return { text: hit.restyled_text, cached: true };
      }

    } catch (e) {
      console.warn("[restyleCache] read failed, fallback to compute", e);
    }
  }

  // 2) Miss → compute Pass 2 và lưu cache (không lưu khi bypassCache).
  const restyled = await restyleWithAngel(params);
  if (admin && restyled && !params.bypassCache) {
    try {
      const nowIso = new Date().toISOString();
      await admin
        .from("telegram_ai_restyle_cache")
        .upsert(
          {
            cache_key: cacheKey,
            restyled_text: restyled,
            hit_count: 1,
            created_at: nowIso,
            last_hit_at: nowIso,
          },
          { onConflict: "cache_key" },
        );
      console.log(`[restyleCache] MISS → stored key=${cacheKey.slice(0, 12)}…`);
    } catch (e) {
      console.warn("[restyleCache] write failed (non-fatal)", e);
    }
  }
  return { text: restyled, cached: false };
}



export type AskAngelImageOut = {
  image_url?: string | null;
  image_base64?: string | null;
  mime_type?: string | null;
  mode?: string | null;
};

async function askAngelReply(params: {
  question: string;
  /** Original user text before any admin/template wrapper; used only for language locking. */
  originalUserMessage?: string | null;
  systemPrompt: string;
  userLabel?: string;
  personaMode?: PersonaMode;
  personaCustomPrompt?: string | null;
  /** Legacy caller field; cannot override Telegram sender addressing. */
  addressRuleOverride?: string | null;
  funCoreContextPrompt?: string | null;
  aiStylePrompt?: string | null;
  aiPersonaPrompt?: string | null;
  /** Force reply language when the caller already knows the event/invite language. */
  forcedLangBucket?: AngelLanguageBucket;
  /** Extra per-group language policy appended to the forced language directive. */
  languagePolicyNote?: string | null;
  /** Language for bot-authored fallback messages (can differ from translation content language). */
  fallbackLangBucket?: AngelLanguageBucket;
  /** Khi true (mặc định): Pass 1 funcore gửi user-only, mirror Angel web chính chủ để RAG hit đúng knowledge. */
  mirrorAngelWeb?: boolean;
  /** Optional admin client — dùng để load persona override toàn cục (fallback khi group chưa set). */
  adminClient?: SupabaseClient | null;
  /** Nếu có, sẽ auto-log cặp (user_message, bot_reply) vào bảng telegram_ai_conversations. */
  conversationContext?: AngelConversationContext | null;
  /** Context tức thì từ Telegram reply_to_message — ưu tiên hơn DB để tránh race log async. */
  immediateAssistantContext?: string | null;
  /** Structured Telegram reply speakers; independent from sender addressing/auth. */
  telegramGroupContext?: TelegramGroupContext | null;
  /** Attachments (ảnh gửi kèm) — forward tới `/angel-router` để Angel gốc tự phân tích. */
  attachments?: Array<{ kind: "image"; url?: string; base64?: string; mime_type?: string }>;
  /** Out-param: nếu router trả ảnh (image_generate / image_analyze) → askAngel mutate object này. */
  outImage?: AskAngelImageOut;
  /** Streaming preview callback cho ảnh (chỉ áp dụng mode generate). */
  onPartialImage?: (b64: string, index: number) => void | Promise<void>;



}): Promise<string> {
  let q = params.question;
  const provider = getAngelProvider();
  // Default đổi sang "angel_be" — khi DB chưa set, bot vẫn giữ giọng Angel/bé.
  const personaMode: PersonaMode = params.personaMode ?? "angel_be";
  const personaSystem = buildPersonaSystem(personaMode, params.personaCustomPrompt);
  const senderUsername = params.conversationContext?.username;
  const addressRule = telegramAddressContract(senderUsername);
  const funCoreContext = params.funCoreContextPrompt?.trim() || FUN_PROFILE_PLATFORM_FACTS;
  const funCorePlatformNote = buildFunCorePlatformNote(funCoreContext);
  const globalPersona = await getGlobalPersonaOverride(params.adminClient ?? null);
  const personaPrompt = `${params.aiPersonaPrompt?.trim() || globalPersona || DEFAULT_AI_PERSONA_PROMPT}

${addressRule}`;
  const originalUserMessage = params.originalUserMessage?.trim() || q;
  const langBucket = resolveAngelLanguageBucket(originalUserMessage, params.forcedLangBucket);
  const botVoiceEnglish = params.fallbackLangBucket === "en" || params.forcedLangBucket === "en";
  let _creativeOverride = false;
  let _regenerateMode = false;

  const t0 = Date.now();
  // Bridged query để retry-1 strict-mirror (catch block) không strip bridge.
  let bridgedQueryForRetry: string | null = null;
  try {
    // ============ IMAGE INTENT SHORT-CIRCUIT ============
    // User yêu cầu vẽ/sửa ảnh → gọi thẳng Angel gốc /generate-image | /edit-image,
    // populate params.outImage để caller sendPhoto. Không đi qua /angel-chat (chat text).
    const _rawForImage = (params.originalUserMessage?.trim() || q || "").trim();
    const _hasAttachedImage = !!(params.attachments && params.attachments.some((a) => a.kind === "image"));
    const _imgIntent = detectImageIntent(_rawForImage, _hasAttachedImage);
    if (_imgIntent && params.outImage) {
      const _ctxType = (params.conversationContext?.chatType || "").toLowerCase();
      const isGroupCall = _ctxType === "group" || _ctxType === "supergroup";
      const userRef = String(params.conversationContext?.userId || params.conversationContext?.webUserId || params.userLabel || "telegram");
      // ===== GROUP IMAGE BLOCK =====
      // Mặc định TẮT vẽ ảnh trong group Telegram (tiết kiệm credit, tránh spam
      // ảnh nặng trong nhóm). Admin có thể bật lại flag `image.group_enabled`.
      if (isGroupCall) {
        try {
          const { getFlag } = await import("./angel/flags.ts");
          const groupImageAllowed = await getFlag("image.group_enabled", false);
          if (!groupImageAllowed) {
            const throttleKey = `img_group_block:${userRef}`;
            const now = Date.now();
            const g = globalThis as unknown as { __angelImgGroupBlock?: Map<string, number> };
            if (!g.__angelImgGroupBlock) g.__angelImgGroupBlock = new Map();
            const last = g.__angelImgGroupBlock.get(throttleKey) ?? 0;
            const THROTTLE_MS = 10 * 60 * 1000; // 10 phút
            console.log("[askAngel][image] blocked_in_group", {
              userRef,
              chat_id: params.conversationContext?.chatId,
              throttled: now - last < THROTTLE_MS,
            });
            if (now - last < THROTTLE_MS) {
              // Đã nhắc gần đây → im lặng để tránh spam.
              params.outImage.mode = "image_generate";
              return "";
            }
            g.__angelImgGroupBlock.set(throttleKey, now);
            return botVoiceEnglish
              ? "Angel can only create images in a private chat. Please message @funrich_community_bot directly to request an image ✨"
              : "Bé ơi, Angel chỉ vẽ ảnh trong chat riêng thôi nha 💛 Bé nhắn riêng cho Angel qua @funrich_community_bot để Angel vẽ cho bé nhé ✨";
          }
        } catch (e) {
          console.warn("[askAngel][image] group flag check failed, blocking by default", e);
          return botVoiceEnglish
            ? "Angel can only create images in a private chat. Please message @funrich_community_bot directly to request an image ✨"
            : "Bé ơi, Angel chỉ vẽ ảnh trong chat riêng thôi nha 💛 Bé nhắn riêng cho Angel qua @funrich_community_bot để Angel vẽ cho bé nhé ✨";
        }
      }
      // ===== END GROUP IMAGE BLOCK =====
      try {
        // Guardrail: chỉ chặn ảnh tiêu cực khi ở GROUP (giữ trải nghiệm public sạch).
        // DM không kiểm duyệt theo topic — bé tự chịu trách nhiệm ảnh của bé.
        if (isGroupCall && _imgIntent.mode === "generate") {
          try {
            const topic = await classifyImageTopic(_imgIntent.prompt);
            if (!topic.allowed) {
              console.log("[askAngel][image] group blocked by topic guardrail", { reason: topic.reason });
              return botVoiceEnglish
                ? "Angel can only create uplifting images in this group, such as themes of prosperity, love, nature, and hope. Please try another idea ✨💛"
                : "Bé ơi, ở group này Angel chỉ vẽ những hình ánh sáng — thịnh vượng, yêu thương, thiên nhiên, hướng thượng thôi nè ✨ Bé đổi ý tưởng khác cho Angel vẽ nhé 💛";
            }
          } catch (e) {
            console.warn("[askAngel][image] classifyImageTopic failed, allow by default", e);
          }
        }
        const finalPrompt = _imgIntent.mode === "generate"
          ? withPositiveStyleSuffix(_imgIntent.prompt)
          : _imgIntent.prompt;
        const firstAttachment = _hasAttachedImage
          ? (params.attachments ?? []).find((a) => a.kind === "image")
          : undefined;
        const imgResult = _imgIntent.mode === "edit"
          ? await editAngelImage({
              instruction: finalPrompt,
              imageUrl: firstAttachment?.url ?? null,
              imageBase64: firstAttachment?.base64 ?? null,
              userRef,
            })
          : await (await import("./angel-image.ts")).generateAngelImageResilient({
              prompt: finalPrompt,
              userRef,
              initialMode: pickImageMode(finalPrompt),
              forceHd: !!(_imgIntent as any).forceHd,
              onPartial: params.onPartialImage,
            });
        if (imgResult.image_url) params.outImage.image_url = imgResult.image_url;
        if (imgResult.image_base64) params.outImage.image_base64 = imgResult.image_base64;
        if (imgResult.mime_type) params.outImage.mime_type = imgResult.mime_type;
        params.outImage.mode = _imgIntent.mode === "edit" ? "image_edit" : "image_generate";
        console.log("[askAngel][image] ok", {
          mode: _imgIntent.mode,
          image_mode: _imgIntent.mode === "generate" ? pickImageMode(finalPrompt) : undefined,
          fallback_stage: (imgResult as any).fallback_stage,
          provider: (imgResult as any).provider,
          prompt_len: finalPrompt.length,
          hasUrl: !!imgResult.image_url,
          hasB64: !!imgResult.image_base64,
          dur: Date.now() - t0,
        });
        if (isGroupCall && botVoiceEnglish) {
          return _imgIntent.mode === "edit"
            ? "Angel has edited the image for you ✨💛"
            : "Angel has created the image for you ✨💛";
        }
        return _imgIntent.mode === "edit"
          ? "Angel sửa ảnh cho bé đây ✨💛"
          : "Angel vẽ cho bé đây ✨💛";
      } catch (e) {
        if (e instanceof AngelImageError) {
          const kind = classifyAngelImageError(e);
          console.warn("[askAngel][image] error", {
            status: e.status,
            kind,
            msg: e.message,
            detail: e.detail,
          });
          return isGroupCall && botVoiceEnglish
            ? "Angel could not create the image right now. Please try again in a few minutes 💛"
            : angelImageUserMessage(e);
        }
        console.warn("[askAngel][image] unexpected error", e);
        if (isGroupCall && botVoiceEnglish) {
          return "Angel ran into a small issue while creating the image. Please try again in a few minutes 💛";
        }
        return "Bé ơi, Angel vừa gặp trục trặc nhỏ khi vẽ 🎨 Bé thử lại sau ít phút giúp Angel nhé 💛";
      }
    }
    // ============ END IMAGE SHORT-CIRCUIT ============

    // FUN Core API (Cha's external Supabase) đã có persona + RAG riêng — gửi tối giản
    // để không ghi đè system prompt và không chiếm chỗ context của RAG retrieval.
    // Lovable Gateway (fallback) thì cần wrapper persona + few-shot để giữ giọng Angel.
    let messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
    const isMixedTranslationPolicy = Boolean(params.languagePolicyNote?.includes("TRANSLATION REQUEST"));
    const languageDirective = isMixedTranslationPolicy
      ? params.languagePolicyNote!.trim()
      : angelLanguageDirective(langBucket);
    const langHint = isMixedTranslationPolicy
      ? params.languagePolicyNote!.trim()
      : `USER_LANGUAGE_DETECTED=${langBucket} (${LANG_NAME[langBucket]}). You MUST reply 100% in ${LANG_NAME[langBucket]} only. Do NOT reply in Vietnamese unless the detected language is "vi".`;
    const chatType = (params.conversationContext?.chatType ?? "").toLowerCase();
    const isGroupConversation = chatType === "group" || chatType === "supergroup" || chatType === "channel";
    const groupLanguagePolicyPrompt = isGroupConversation ? params.languagePolicyNote?.trim() || null : null;
    const forcedLanguageHint = params.forcedLangBucket
      ? [isMixedTranslationPolicy ? "" : angelLanguageDirective(params.forcedLangBucket), params.languagePolicyNote?.trim() || ""].filter(Boolean).join("\n\n")
      : "";
    let factualLookup = false;
    let factualLookupReason = "not_checked";

    // ===== YouTube on-demand augmentation =====
    // Nếu user gửi link YouTube (DM hoặc mention trong group), fetch transcript
    // và inline vào user message (Mirror-safe — không dùng system role).
    let _ytAugmented = false;
    let _ytHasTranscript = false;
    let _ytFailureReasons: string[] = [];
    try {
      const ytIds = extractYouTubeIds(originalUserMessage);
      if (ytIds.length > 0) {
        const ytCtx = await buildYouTubeContextBlock(originalUserMessage, { maxVideos: 2 });
        if (ytCtx) {
          const bare = isBareYouTubeLink(originalUserMessage);
          const askHint = bare
            ? `\n\n(User chỉ gửi link, không có câu hỏi. Hãy tóm tắt video trong 5–8 gạch đầu dòng — chủ đề chính, các luận điểm, bài học rút ra — bằng ${LANG_NAME[langBucket]}. Cuối cùng hỏi user muốn Angel đi sâu vào phần nào.)`
            : "";
          q = `${ytCtx.block}\n\n=== USER MESSAGE ===\n${q}${askHint}`;
          _ytAugmented = true;
          _ytHasTranscript = ytCtx.fetched.length > 0;
          _ytFailureReasons = ytCtx.failed.map((f) => f.reason);
          console.log(
            `[askAngel] youtube ids=${ytIds.length} fetched=${ytCtx.fetched.length} failed=${ytCtx.failed.length} bare=${bare}`,
          );
        }
      }
    } catch (e) {
      console.warn("[askAngel] youtube augmentation failed (non-fatal)", e);
    }

    let _intent: AngelIntent = null;


    if (provider === "funcore") {
      // FUN Core đã có persona + RAG + multilingual riêng (giọng Angel chính chủ).
      // Mặc định mirror Angel web chính chủ: gửi user-only, KHÔNG system wrapper nào,
      // để RAG retrieval của FUN Core không bị nhiễu và hit đúng knowledge nội bộ.
      // Persona "Angel/bé" được ép ở Pass 2 (restyle) + enforceVietnamesePronouns post-process.
      // HARD-FORCED: mirror Angel web luôn bật cho MỌI luồng để nội dung khớp Angel gốc.
      // Cờ `params.mirrorAngelWeb` và setting `ai_mirror_angel_web` bị bỏ qua có chủ đích.
      const mirrorAngelWeb = true;
      const isLiveStreamQ = /live\s*stream|livestream|phát\s*sóng|\bstream\b|webcam\s*live|rtmp|obs/i.test(q);

      if (mirrorAngelWeb) {
        // MIRROR ANGEL WEB CHÍNH CHỦ (angel.fun.rich) TUYỆT ĐỐI:
        // Web chỉ gửi 1 message duy nhất `{role:"user", content: q}` — KHÔNG kèm bất kỳ
        // system message nào. FUN Core dùng TOÀN BỘ mảng messages để build embedding query
        // cho RAG; nếu ta thêm EMOJI_RULE / ownerAddress / language directive / personaSystem
        // / "ORIGINAL USER MESSAGE" wrapper thì embedding bị pha loãng → RAG miss các doc
        // cá nhân (VD "bé Ly là ai", "8 câu thần chú", "9 tầng tự do"...) và bot trả "không có
        // thông tin" hoặc bịa nội dung.
        //
        // Các rule bổ trợ (emoji, address, ngôn ngữ, persona bé/Angel) được xử lý ở Pass 2
        // (restyle) + enforceVietnamesePronouns post-process — KHÔNG dính vào Pass 1 funcore.
        // isLiveStreamQ / forcedLanguageHint / ownerAddress override đều bỏ ở đây một cách
        // có chủ đích để RAG hit đúng knowledge gốc như bot web.
        // DM CONTEXT AWARENESS: nếu là DM (private chat) và admin bật dm_history,
        // bơm 6 turn (user+assistant) gần nhất trước câu user hiện tại. Group KHÔNG bơm.
        // Cả history + câu mới đều là role user/assistant (không phải system) → FUN Core
        // vẫn xem đây là multi-turn user query, không phá RAG (angel-chat gốc cũng nhận
        // messages đa lượt tương tự).
        const _cfgDm = getStylePostprocessConfig();
        const _rawChatType = (params.conversationContext?.chatType ?? "").toLowerCase();
        const _isDm = !(_rawChatType === "group" || _rawChatType === "supergroup" || _rawChatType === "channel");

        // FACTUAL LOOKUP DETECTOR — câu hỏi tra cứu (tài khoản/ví/link/địa chỉ của X,
        // "X là ai", "X có link gì"...). Đây là câu embedding-sensitive: bất kỳ
        // history/memory/prefix nào chèn vào cũng làm loãng query → RAG bên Angel gốc
        // miss doc chính chủ. Với các câu này ta MIRROR TUYỆT ĐỐI như angel.fun.rich/chat:
        // gửi đúng 1 message `{role:"user", content: originalUserMessage}`.
        const _factual = detectFactualLookupQuery(originalUserMessage);
        factualLookup = _factual.matched;
        factualLookupReason = _factual.reason;
        const _isFactualLookup = factualLookup;

        // TẦNG A — song song hoá bước chuẩn bị: history, memory, dedup chạy //
        // cùng lúc thay vì tuần tự. Trước đây 3 bước này cộng dồn 300–800ms.
        const _prepAdmin = params.adminClient ?? null;
        const _prepCtx = params.conversationContext ?? null;
        const _prepChatId = _prepCtx?.chatId;
        const _prepUserId = _prepCtx?.userId;
        const _canFetchDm = !_isFactualLookup && _isDm && !!_prepAdmin && _prepChatId != null && _prepUserId != null;
        const _canFetchMemory = !_isFactualLookup && !!_prepAdmin && _prepUserId != null;
        // Bước 3: cho phép lấy history của CÙNG 1 user trong group khi flag bật.
        const _groupPerUserHistoryEnabled = !_isFactualLookup && !_isDm && !!_prepAdmin && _prepChatId != null && _prepUserId != null
          ? await getFlag("group.per_user_history", false)
          : false;
        // Bước 2: cho phép nhét 2 turn user gần nhất (KHÔNG kèm reply Angel) khi
        // factual lookup, chỉ khi admin bật flag — để giữ RAG khỏi bị pha loãng.
        const _factualUserContextEnabled = _isFactualLookup && _isDm && !!_prepAdmin && _prepChatId != null && _prepUserId != null
          ? await getFlag("factual.include_user_context", false)
          : false;

        const _historyPromise: Promise<AngelHistoryMessage[]> = (_canFetchDm && _cfgDm.dmHistoryEnabled && _prepAdmin && _prepChatId != null && _prepUserId != null)
          ? fetchRecentDmHistory(_prepAdmin, {
              chatId: _prepChatId,
              telegramUserId: _prepUserId,
              limit: _cfgDm.dmHistoryLimit,
            }).catch((e) => { console.warn("[askAngel] history load failed", e); return []; })
          : (_groupPerUserHistoryEnabled && _prepAdmin && _prepChatId != null && _prepUserId != null)
            ? fetchRecentGroupHistoryForUser(_prepAdmin, {
                chatId: _prepChatId,
                telegramUserId: _prepUserId,
                limit: 4,
              }).catch((e) => { console.warn("[askAngel] group history load failed", e); return []; })
            : (_factualUserContextEnabled && _prepAdmin && _prepChatId != null && _prepUserId != null)
              ? fetchRecentDmHistory(_prepAdmin, {
                  chatId: _prepChatId,
                  telegramUserId: _prepUserId,
                  limit: 4,
                }).then((h) => h.filter((m) => m.role === "user").slice(-2))
                  .catch((e) => { console.warn("[askAngel] factual user-ctx load failed", e); return []; })
              : Promise.resolve([]);

        const _memoryPromise: Promise<{ role: "user"; content: string } | null> = (_canFetchMemory && _prepAdmin && _prepUserId != null)
          ? (async () => {
              try {
                const _memSettings = await getAngelMemorySettings(_prepAdmin);
                const _memChannel: "telegram" | "group" = _isDm ? "telegram" : "group";
                if (!isMemoryEnabledForChannel(_memSettings, _memChannel)) return null;
                const _memRow = await getAngelMemory(_prepAdmin, {
                  channel: _memChannel,
                  userKey: String(_prepUserId),
                });
                return buildMemoryContextMessage(_memRow);
              } catch (e) {
                console.warn("[askAngel] memory load failed (non-fatal)", e);
                return null;
              }
            })()
          : Promise.resolve(null);

        const _dedupPromise: Promise<boolean> = (_canFetchDm && _prepAdmin && _prepChatId != null && _prepUserId != null)
          ? isNearDuplicateOfLastUserMsg(_prepAdmin, {
              chatId: _prepChatId as number,
              telegramUserId: _prepUserId as number,
              currentText: originalUserMessage,
            }).catch((e) => { console.warn("[askAngel] dedup check failed", e); return false; })
          : Promise.resolve(false);

        // ROLLING SUMMARY — nạp tóm tắt cũ (nếu bật) song song với memory/history
        const _rollingChannel: RollingChannel | null = _prepAdmin && _prepUserId != null
          ? (_isDm ? "telegram_dm" : "telegram_group")
          : null;
        const _rollingScopeKey = _rollingChannel === "telegram_group"
          ? (_prepChatId != null && _prepUserId != null ? `${String(_prepChatId)}:${String(_prepUserId)}` : (_prepChatId != null ? String(_prepChatId) : null))
          : (_prepUserId != null ? String(_prepUserId) : null);
        const _rollingSettingsPromise = _rollingChannel
          ? getRollingSummarySettings(_prepAdmin, _rollingChannel)
          : Promise.resolve({ enabled: false, turnThreshold: 12, keepRecent: 8 });
        const _rollingRowPromise: Promise<Awaited<ReturnType<typeof loadRollingSummary>>> =
          _rollingChannel && _rollingScopeKey
            ? _rollingSettingsPromise.then((s) => s.enabled && _rollingChannel && _rollingScopeKey
                ? loadRollingSummary(_prepAdmin, { channel: _rollingChannel, scopeKey: _rollingScopeKey })
                : Promise.resolve(null))
            : Promise.resolve(null);

        const _prepT0 = Date.now();
        const [_history, _memoryMsgRaw, _dedupHit, _rollingSettingsResolved, _rollingRow] = await Promise.all([
          _historyPromise, _memoryPromise, _dedupPromise, _rollingSettingsPromise, _rollingRowPromise,
        ]);
        const _memoryMsg = _memoryMsgRaw;
        const _summaryMsg = buildSummaryPrefix(_rollingRow);
        _regenerateMode = _dedupHit;
        console.log(`[askAngel] prep parallel took ${Date.now() - _prepT0}ms history=${_history.length} memory=${_memoryMsg ? 1 : 0} summary=${_summaryMsg ? 1 : 0} dedup=${_dedupHit}`);


        // CONTEXT BRIDGE — CHỈ dùng 2 nguồn anchor để tránh chọn nhầm câu cũ:
        //   1) reply_to_message (Telegram reply tường minh — chắc chắn nhất)
        //   2) db_last_question (bảng angel_last_question, upsert đồng bộ cuối mỗi turn)
        // Runtime memory Map (per-instance, TTL 15 phút) và db_history (log async, dễ
        // lệch turn) đã bị loại — chúng là 2 nguồn gây stale/mismatch trong các case
        // "Fun Cosmos → Dạ bé muốn → bot nhảy sang PLP/trí tuệ".
        let _contextBridged = false;
        if (!_isFactualLookup && (!params.telegramGroupContext || params.telegramGroupContext.recipient.evidence === "verified_bot_reply") && shouldBridge(originalUserMessage)) {
          const _bridgeKind: "confirmation" | "mixed" | "unresolved_ref" = isConfirmationOnly(originalUserMessage)
            ? "confirmation"
            : isMixedConfirmationTurn(originalUserMessage)
              ? "mixed"
              : "unresolved_ref";
          const _immediate = params.immediateAssistantContext?.trim();
          const _dbAnchor = !_immediate
            ? await loadLastQuestionAnchor(_prepAdmin, params.conversationContext)
            : null;
          const _dbAnchorFresh = _dbAnchor && _dbAnchor.ageMs <= DB_CONTEXT_BRIDGE_MAX_AGE_MS;
          const _bridgeSource: "reply_to_message" | "db_last_question" | "none" = _immediate
            ? "reply_to_message"
            : _dbAnchorFresh
              ? "db_last_question"
              : "none";
          let _contextHistory: AngelHistoryMessage[] = [];
          if (_bridgeSource === "reply_to_message" && _immediate) {
            _contextHistory = [{ role: "assistant", content: _immediate }];
          } else if (_bridgeSource === "db_last_question" && _dbAnchor) {
            _contextHistory = [{ role: "assistant", content: _dbAnchor.anchorContext ? `${_dbAnchor.anchorContext}\n${_dbAnchor.question}` : _dbAnchor.question }];
          }
          const _bridged = _contextHistory.length > 0 ? buildContextBridgedQuery(originalUserMessage, _contextHistory) : null;
          if (_bridged) {
            const _qPreview = extractLastAssistantQuestion(_contextHistory)?.slice(0, 140) ?? "";
            const _subjPreview = (() => {
              try {
                const q = extractLastAssistantQuestion(_contextHistory);
                return q ? (extractSubjectFromQuestion(q) ?? "-") : "-";
              } catch { return "-"; }
            })();
            console.log(`[askAngel] context-bridge kind=${_bridgeKind} source=${_bridgeSource} subject="${_subjPreview}" rewrote "${originalUserMessage.slice(0, 60)}" question="${_qPreview}"`);
            q = _bridged;
            _contextBridged = true;
            bridgedQueryForRetry = _bridged;
          } else {
            const _anchorAge = _dbAnchor?.ageMs == null ? null : Math.round(_dbAnchor.ageMs / 1000);
            console.log(`[askAngel] context-bridge skipped kind=${_bridgeKind} reason=no_anchor anchorAgeSec=${_anchorAge ?? "-"}`);
          }
        }

        // Intent classification — bỏ qua khi factual lookup (không phải creative).
        _intent = _isFactualLookup ? null : classifyUserIntent(originalUserMessage);
        const _intentMsg = _isFactualLookup ? null : buildIntentPrefixMessage(_intent);

        const _prefixes: Array<{ role: "user" | "assistant"; content: string }> = [];
        if (_intentMsg) _prefixes.push(_intentMsg);
        // TIER 2: KHÔNG chèn REGENERATE_PREFIX vào body FUN Core nữa — nó có thể làm loãng
        // RAG hoặc bị `/angel-chat` reject (152ms "AI gateway error"). Chỉ giữ REGENERATE_PREFIX
        // trong nhánh Lovable Gateway retry (TẦNG A anti-repeat, line ~2820).

        const _isCreative = _intent === "creative_story" || _intent === "creative_poem_song";
        // STEP 1 — KHÔNG cho _regenerateMode tự động bật CREATIVE off-ramp.
        // Câu factual như "Cho con biết thêm thông tin về a16z" dù hỏi lại nhiều lần vẫn
        // là câu factual → phải mirror FUN Core, KHÔNG được đá sang Lovable Gateway.
        // Chỉ bật lại khi admin set flag `router.regen_creative_offramp` = true.
        const _allowRegenCreative = _regenerateMode
          ? await getFlag("router.regen_creative_offramp", false)
          : false;
        if (_ytAugmented) {
          _creativeOverride = true;
          const _langDir = forcedLanguageHint || languageDirective;
          const _ytSystem = _ytHasTranscript
            ? "YOUTUBE ANALYSIS MODE: Bên trong user message có block '[YOUTUBE VIDEO — Angel vừa đọc trực tiếp phụ đề]' chứa transcript thật của video. Angel PHẢI dựa 100% vào transcript đó để trả lời — KHÔNG được bịa nội dung ngoài transcript. Trích dẫn ngắn khi cần. Nếu user hỏi ngoài phạm vi video, trả lời rồi nhắc rằng nội dung đó không có trong video."
            : "YOUTUBE ANALYSIS MODE: Angel KHÔNG đọc được phụ đề của video này. Hãy giải thích ngắn gọn lý do (đã có trong user message) và mời user gửi transcript / mô tả nội dung để Angel cùng thảo luận. TUYỆT ĐỐI không bịa nội dung video.";
          messages = [
            { role: "system" as const, content: _langDir },
            { role: "system" as const, content: LANGUAGE_MIRROR_RULE },
            { role: "system" as const, content: addressRule },
            { role: "system" as const, content: _ytSystem },
            { role: "system" as const, content: ANTI_HALLUCINATION_RULE },
            { role: "system" as const, content: EMOJI_RULE },
            { role: "system" as const, content: langHint },
            ...(_memoryMsg ? [_memoryMsg] : []),
            ...(_summaryMsg ? [_summaryMsg] : []),
            ..._history,
            { role: "user" as const, content: q },
          ];
          console.log(`[askAngel] YOUTUBE off-ramp hasTranscript=${_ytHasTranscript} failReasons=${_ytFailureReasons.join("|")} history=${_history.length} lang=${langBucket}`);
        } else if (_isCreative || _allowRegenCreative) {
          _creativeOverride = true;
          const _langDir = forcedLanguageHint || languageDirective;
          messages = [
            { role: "system" as const, content: _langDir },
            { role: "system" as const, content: LANGUAGE_MIRROR_RULE },
            { role: "system" as const, content: addressRule },
            { role: "system" as const, content: CREATIVE_MODE_RULE },
            { role: "system" as const, content: NARRATIVE_CHARACTER_VOICE_RULE },
            { role: "system" as const, content: "PERSONA SCOPE INSIDE NARRATIVE: Persona 'Angel' và cách gọi 'bé' CHỈ áp dụng cho narrator (text bên ngoài dấu ngoặc kép và không phải lời thoại). Trong MỌI lời thoại nhân vật (nội dung trong \"…\", «…», hoặc sau '— ' / '– ' / '- '), TUYỆT ĐỐI KHÔNG dùng 'Angel' hoặc 'bé'; dùng đại từ nhân vật tự nhiên (ngôi 1: mình / tôi / tớ / ta / cháu / con; ngôi 2 giữa các nhân vật: cháu / con / em / bạn / cậu / anh / chị / bé nhỏ + tên). English mirror: inside every quoted dialogue never use 'Angel' or 'bé' — use natural pronouns (I/me/my, you/dear/little one)." },
            { role: "system" as const, content: EMOJI_RULE },
            { role: "system" as const, content: LIGHT_LANGUAGE_RULE },
            { role: "system" as const, content: langHint },
            ...(_memoryMsg ? [_memoryMsg] : []),
            ...(_summaryMsg ? [_summaryMsg] : []),
            ..._history,
            { role: "user" as const, content: q },
          ];
          console.log(`[askAngel] CREATIVE off-ramp intent=${_intent ?? "-"} regen=${_regenerateMode} history=${_history.length} lang=${langBucket}`);
        } else if (_isFactualLookup) {
          // Keep factual lookup text intact for RAG, while honoring an explicit
          // international-group policy as a higher-priority prompt instruction.
          messages = [
            ...(groupLanguagePolicyPrompt ? [{ role: "system" as const, content: groupLanguagePolicyPrompt }] : []),
            { role: "user" as const, content: originalUserMessage },
          ];
          console.log(`[askAngel] FACTUAL lookup → mirror (groupPolicy=${!!groupLanguagePolicyPrompt}) reason=${factualLookupReason} q="${originalUserMessage.slice(0, 60)}"`);
        } else {
          messages = [
            ...(groupLanguagePolicyPrompt ? [{ role: "system" as const, content: groupLanguagePolicyPrompt }] : []),
            ...(_summaryMsg ? [_summaryMsg] : []),
            ..._history,
            ..._prefixes,
            { role: "user" as const, content: q },
          ];

          if (_history.length > 0 || _prefixes.length > 0) {
            console.log(`[askAngel] mirror msgs history=${_history.length} intent=${_intent ?? "-"} regen=${_regenerateMode} totalMsgs=${messages.length}`);
          }
        }

      } else {

        // Legacy fallback (admin tắt mirror): chèn personaPrompt như trước.
        const systemMessages: { role: "system"; content: string }[] = [];
        if (forcedLanguageHint) {
          systemMessages.push({ role: "system" as const, content: forcedLanguageHint });
        }
        systemMessages.push({ role: "system" as const, content: personaPrompt });
        if (isLiveStreamQ) {
          systemMessages.push({ role: "system" as const, content: funCorePlatformNote });
        }
        if (personaMode === "custom" && personaSystem) {
          systemMessages.push({ role: "system" as const, content: personaSystem });
        }
        messages = [...systemMessages];
        if (originalUserMessage !== q) {
          messages.push({
            role: "user" as const,
            content: `ORIGINAL USER MESSAGE — use this text only for language/address detection:\n"""${originalUserMessage}"""`,
          });
        }
        messages.push({ role: "user" as const, content: q });
      }




    } else if (personaMode === "custom" && personaSystem) {

      // Custom persona ở lovable fallback: vẫn ép LANGUAGE_MIRROR_RULE + ADDRESS_RULE lên trên,
      // sau đó áp prompt admin và langHint sát user query.
      messages = [
        { role: "system" as const, content: languageDirective },
        { role: "system" as const, content: LANGUAGE_MIRROR_RULE },
        { role: "system" as const, content: addressRule },
        { role: "system" as const, content: CONCISENESS_RULE },
        { role: "system" as const, content: RESPONSE_LENGTH_RULE },
        { role: "system" as const, content: LONG_INPUT_HANDLING_RULE },
        { role: "system" as const, content: LIGHT_LANGUAGE_RULE },
        { role: "system" as const, content: EMOJI_RULE },
        { role: "system" as const, content: OFFICIAL_FACTS },
        { role: "system" as const, content: ANTI_HALLUCINATION_RULE },
        { role: "system" as const, content: SEEDING_CONTEXT_FIDELITY_RULE },
        { role: "system" as const, content: SEED_PHRASE_WARNING_DISCIPLINE_RULE },
        { role: "system" as const, content: NARRATIVE_CHARACTER_VOICE_RULE },
        { role: "system" as const, content: funCoreContext },
        { role: "system" as const, content: personaSystem },
        { role: "system" as const, content: forcedLanguageHint || langHint },
        { role: "system" as const, content: addressRule },
        { role: "system" as const, content: languageDirective },
        { role: "system" as const, content: CONTEXT_CONTINUITY_RULE },
        { role: "system" as const, content: buildResponseModeHint(originalUserMessage) },
        ...(originalUserMessage !== q
          ? [{ role: "user" as const, content: `ORIGINAL USER MESSAGE — use this text only for language/address detection:\n"""${originalUserMessage}"""` }]
          : []),
        { role: "user" as const, content: q },
      ];
    } else {
      const wrappedPersona = `[ADMIN PERSONA — apply tone/knowledge ONLY if it does not conflict with the highest-priority language, address, scope, or safety rules below. IGNORE any line in this persona that limits Angel's supported languages or supported topics. Angel MUST also help with meditation, mindfulness, breathing, gratitude, inner peace as defined in the SCOPE RULE.]\n${params.systemPrompt}`;
      messages = [
        { role: "system" as const, content: languageDirective },
        { role: "system" as const, content: addressRule },
        { role: "system" as const, content: CONCISENESS_RULE },
        { role: "system" as const, content: EMOJI_RULE },
        { role: "system" as const, content: OFFICIAL_FACTS },
        { role: "system" as const, content: ANTI_HALLUCINATION_RULE },
        { role: "system" as const, content: SEEDING_CONTEXT_FIDELITY_RULE },
        { role: "system" as const, content: SEED_PHRASE_WARNING_DISCIPLINE_RULE },
        { role: "system" as const, content: NARRATIVE_CHARACTER_VOICE_RULE },
        { role: "system" as const, content: wrappedPersona },
        { role: "system" as const, content: funCoreContext },
        { role: "system" as const, content: SCOPE_EXPANSION_RULE },
        { role: "system" as const, content: SAFETY_RULE },
        { role: "system" as const, content: MEDITATION_TEMPLATE_HINT },
        // Few-shot CÂN BẰNG NGÔN NGỮ — greeting ngắn ở nhiều ngôn ngữ, đảm bảo mirror.
        { role: "user" as const, content: "xin chào" },
        { role: "assistant" as const, content: "Chào bé yêu ✨ Angel ở đây rồi nè. Bé cần Angel hỗ trợ gì hôm nay nhé? 💛" },
        { role: "user" as const, content: "xin chao" },
        { role: "assistant" as const, content: "Chào bé yêu ✨ Angel ở đây rồi nè. Bé cần Angel hỗ trợ gì hôm nay nhé? 💛" },
        { role: "user" as const, content: "hello" },
        { role: "assistant" as const, content: "Hello ✨ Angel is here for you. How can Angel help today? 💛" },
        { role: "user" as const, content: "chào Angel" },
        { role: "assistant" as const, content: "Chào bé yêu ✨ Angel ở đây rồi. Bé cần Angel hỗ trợ gì hôm nay nè? 💛" },
        { role: "user" as const, content: "你好" },
        { role: "assistant" as const, content: "你好 ✨ Angel 在这里陪伴你。今天 Angel 可以帮你什么呢？💛" },
        { role: "user" as const, content: "안녕하세요" },
        { role: "assistant" as const, content: "안녕하세요 ✨ Angel이 여기 있어요. 오늘 무엇을 도와드릴까요? 💛" },
        { role: "user" as const, content: "สวัสดี" },
        { role: "assistant" as const, content: "สวัสดีค่ะ ✨ Angel อยู่ตรงนี้นะคะ วันนี้ให้ Angel ช่วยอะไรดีคะ 💛" },
        { role: "user" as const, content: "FUN.RICH是什么?" },
        { role: "assistant" as const, content: "FUN.RICH 是一个 Web3 生态系统 ✨ Angel 很高兴为你介绍。你想先了解哪一部分呢？💛" },
        { role: "user" as const, content: "FUN.RICHとは?" },
        { role: "assistant" as const, content: "FUN.RICH は Web3 エコシステムです ✨ Angel が喜んでご案内します。どの部分から知りたいですか？💛" },
        { role: "user" as const, content: "FUN.RICH คืออะไร?" },
        { role: "assistant" as const, content: "FUN.RICH คือระบบนิเวศ Web3 ✨ Angel ยินดีอธิบายให้คุณฟัง คุณอยากรู้ส่วนไหนก่อนคะ 💛" },
        { role: "user" as const, content: "Angel cho bé một bài thiền nhẹ" },
        { role: "assistant" as const, content: "Bé ơi, Angel mời bé cùng thực hành một bài thiền nhẹ 3 phút nhé ✨\n\n• Bé ngồi thoải mái, thả lỏng vai, khép mắt nhẹ nếu thấy dễ chịu.\n• Hít vào chậm 4 nhịp… thở ra chậm 6 nhịp…\n• Mỗi hơi thở, bé chỉ cần cảm nhận: \"Bé đang bình an. Bé đang được yêu thương.\"\n• Nếu tâm trí chạy đi, bé nhẹ nhàng quay về với hơi thở.\n\nAngel chúc bé thật bình an và đầy ánh sáng yêu thương nhé 💛" },
        // Few-shot TÓM TẮT — dạy model trả lời tinh gọn khi user hỏi nhiều chương/điều.
        { role: "user" as const, content: "tóm tắt Chương V và VI giúp Angel" },
        { role: "assistant" as const, content: "Bé ơi ✨ Angel tóm tắt nhanh nhé:\n\n• <b>Chương V</b> — điều kiện trở thành Công Dân và con đường tỉnh thức (thiền, biết ơn, sám hối).\n• <b>Chương VI</b> — quyền đồng sáng tạo và trách nhiệm sống trung thực, bảo vệ môi trường.\n\nBé muốn Angel đi sâu vào điều nào trước nè? 💛" },
        { role: "system" as const, content: LANGUAGE_MIRROR_RULE },
        { role: "system" as const, content: CONCISENESS_RULE },
        { role: "system" as const, content: RESPONSE_LENGTH_RULE },
        { role: "system" as const, content: LONG_INPUT_HANDLING_RULE },
        { role: "system" as const, content: LIGHT_LANGUAGE_RULE },
        { role: "system" as const, content: EMOJI_RULE },
        { role: "system" as const, content: OFFICIAL_FACTS },
        { role: "system" as const, content: ANTI_HALLUCINATION_RULE },
        { role: "system" as const, content: SEEDING_CONTEXT_FIDELITY_RULE },
        { role: "system" as const, content: SEED_PHRASE_WARNING_DISCIPLINE_RULE },
        { role: "system" as const, content: NARRATIVE_CHARACTER_VOICE_RULE },
        { role: "system" as const, content: forcedLanguageHint || langHint },
        { role: "system" as const, content: addressRule },
        { role: "system" as const, content: CONTEXT_CONTINUITY_RULE },
        { role: "system" as const, content: languageDirective },
        { role: "system" as const, content: buildResponseModeHint(originalUserMessage) },
        ...(originalUserMessage !== q
          ? [{ role: "user" as const, content: `ORIGINAL USER MESSAGE — use this text only for language/address detection:\n"""${originalUserMessage}"""` }]
          : []),
        { role: "user" as const, content: q },
      ];
    }



    console.log(
      `[askAngel] fire provider=${provider} persona=${personaMode} qLen=${q.length} reqMsgs=${messages.length} qPreview="${q.slice(0, 80).replace(/\n/g, " ")}"`,
    );

    // Creative off-ramp → force Lovable Gateway + higher temperature.
    // FUN Core RAG bị doctrinal doc dominate → không thể sáng tác được.
    // TIER 2: KHÔNG gửi `temperature` cho FUN Core (default) — có bằng chứng
    // `/angel-chat` reject payload lạ trong ~150ms với "AI gateway error". Cho phép
    // rollback bằng flag `router.strip_temperature_for_funcore` (default ON).
    const _stripTempFuncore = await getFlag("router.strip_temperature_for_funcore", true);
    const _creativeTemp = _creativeOverride
      ? (_regenerateMode ? 0.95 : 0.85)
      : (!_stripTempFuncore && _regenerateMode ? 0.9 : undefined);
    // Client-side guard: phân loại câu hỏi để quyết định answer_mode gửi cho
    // Angel gốc. Câu nhạy cảm nội bộ (ví, mật khẩu, tên user...) → chỉ trả
    // lời khi có RAG match; câu kiến thức phổ thông → cho phép fallback LLM.
    const { classifyQuestionSensitivity } = await import("./angel-sensitivity.ts");
    const _answerMode = classifyQuestionSensitivity(originalUserMessage || q);
    if (_answerMode !== "auto") {
      console.log(`[askAngel] answer_mode=${_answerMode} qPreview="${(originalUserMessage || q).slice(0, 60).replace(/\n/g, " ")}"`);
    }
    // Reply relationships survive factual mirror, provider fallback and retries.
    messages = withTelegramGroupContext(messages, params.telegramGroupContext);
    // Keep the factual user-only mirror intact; all composed prompts end with the verified contract.
    if (messages.some((m) => m.role === "system")) messages.push({ role: "system", content: addressRule });
    const result = await callAngelCore({
      messages,
      ...(params.attachments && params.attachments.length > 0 ? { attachments: params.attachments } : {}),
      ...(_creativeOverride ? { forceProvider: "lovable" as const } : {}),
      ...(typeof _creativeTemp === "number" ? { temperature: _creativeTemp } : {}),
      ...(_answerMode !== "auto" ? { answerMode: _answerMode } : {}),
    });

    // Router có thể trả ảnh (image_generate / image_analyze). Đưa lên out-param cho caller.
    if (params.outImage) {
      if (result.image_url) params.outImage.image_url = result.image_url;
      if (result.image_base64) params.outImage.image_base64 = result.image_base64;
      if (result.mime_type) params.outImage.mime_type = result.mime_type;
      if (result.mode) params.outImage.mode = result.mode;
    }

    const rawReply = result.text.trim();
    let reply = sanitizeForTelegramHtml(rawReply);
    const dur = Date.now() - t0;
    const rawKeys = result.raw && typeof result.raw === "object"
      ? Object.keys(result.raw as Record<string, unknown>).join(",")
      : "";
    console.log(
      `[askAngel] reply provider=${result.provider} dur=${dur}ms rawLen=${rawReply.length} sanLen=${reply.length} rawKeys=${rawKeys} first120="${reply.slice(0, 120).replace(/\n/g, " ")}"`,
    );

    if (!reply) {
      console.warn("[askAngel] empty reply — retry with interpret-and-answer rule");
      // Tầng 1: retry với rule ép model tự đoán ý và trả lời gợi mở như ChatGPT.
      const INTERPRET_AND_ANSWER_RULE = [
        "INTERPRET_AND_ANSWER_RULE (HIGHEST PRIORITY):",
        "Câu hỏi của bé có thể ngắn, mơ hồ, thiếu ngữ cảnh, hoặc chỉ là một từ / một emoji.",
        "TUYỆT ĐỐI KHÔNG được từ chối, KHÔNG được nói \"Angel chưa nghe rõ\", KHÔNG được yêu cầu bé diễn đạt lại như điều kiện tiên quyết.",
        "Thay vào đó, LUÔN LUÔN:",
        "1) Đoán 1-2 ý nghĩa khả dĩ nhất mà bé có thể đang muốn hỏi (dựa trên lịch sử chat gần nhất nếu có).",
        "2) Trả lời trực tiếp ý có xác suất cao nhất trong 2-4 câu, ấm áp, hữu ích, cụ thể.",
        "3) Cuối câu, hỏi lại nhẹ 1 câu để xác nhận hướng (VD: \"Angel hiểu ý bé là ... đúng không? Nếu bé muốn hướng khác, kể thêm Angel nghe nhé 💛\").",
        "Giữ giọng Angel: xưng \"Angel\", gọi \"bé\", 1-2 emoji dịu dàng. Mirror ngôn ngữ của bé.",
        "If the user writes in English/Chinese/Japanese/Korean/Thai/Malay, apply the same logic in that language.",
      ].join("\n");
      try {
        const retryMessages = [
          ...messages,
          { role: "system" as const, content: INTERPRET_AND_ANSWER_RULE },
          ...(params.telegramGroupContext ? [{ role: "system" as const, content: TELEGRAM_GROUP_RELATION_RULE }] : []),
        ];
        let retryResult;
        try {
          // Ưu tiên Angel gốc (không tốn credit Lovable).
          retryResult = await callAngelCore({
            messages: retryMessages,
            forceProvider: "funcore" as const,
            strictMirror: true,
          });
          if (!((retryResult.text ?? "").trim())) throw new Error("funcore empty");
        } catch (fcErr) {
          console.warn("[askAngel] interpret-retry funcore failed", fcErr);
          if (!(await getFlag("cost.lovable_retry_enabled", true))) throw fcErr;
          retryResult = await callAngelCore({
            messages: retryMessages,
            forceProvider: "lovable" as const,
            temperature: 0.7,
          });
        }
        const retryReply = sanitizeForTelegramHtml((retryResult.text ?? "").trim());
        if (retryReply) {
          console.log(`[askAngel] interpret-retry ok len=${retryReply.length}`);
          reply = retryReply;
        }
      } catch (e) {
        console.warn("[askAngel] interpret-retry failed", e);
      }
      if (!reply) {
        const hint = extractContextHint(messages as Array<{ role: string; content: string }>);
        return fallbackEmpty(q, hint, params.fallbackLangBucket ?? params.forcedLangBucket);
      }
    }


    // ─── TẦNG B — Guard "short DM reply" ─────────────────────────────────────
    // Reply DM ngắn (<400 char) và không vi phạm ngôn ngữ đã đủ đúng giọng Angel
    // (mirror /angel-chat gốc). Skip restyle + language repair + postprocess style
    // → tiết kiệm 3 call LLM (~10-20s). Vẫn giữ enforceVietnamesePronouns + hard revert
    // an toàn text-level bên dưới.
    const _rawChatType = (params.conversationContext?.chatType ?? "").toLowerCase();
    const _isDmContext = !(_rawChatType === "group" || _rawChatType === "supergroup" || _rawChatType === "channel");
    const _langOk = !replyViolatesAngelLanguageBucket(reply, langBucket);
    const _shortDmSkip = _isDmContext && reply.length < 400 && _langOk;
    if (_shortDmSkip) {
      console.log(`[askAngel] TẦNG B skip restyle+repair+postprocess (short DM ${reply.length} chars, lang ok)`);
    }

    // Pass 2 — Restyle: CHỈ chạy khi admin CHỦ ĐỘNG set ai_style_prompt.
    // Mặc định: giữ nguyên reply Angel chính chủ từ FUN Core (đầy đủ, nhiều mục, ví dụ, câu mở).
    // Bỏ fallback defaultAiStylePromptForLanguage vì nó ép cắt xuống ≤180 từ / 5 bullet
    // → làm mất giọng chính chủ (giống bản angelquangvu.fun.rich).
    if (provider === "funcore" && !_shortDmSkip) {
      const styleRule = params.aiStylePrompt?.trim();
      const skipFactualRestyle = factualLookup && replyHasConcreteFactualData(reply);
      if (skipFactualRestyle) {
        console.log(`[askAngel] restyle skipped — factual concrete data reason=${factualLookupReason}`);
      }
      // A restyle pass is allowed to rewrite requested translated content and
      // collapse the English framing/target-language exception into one bucket.
      if (styleRule && !skipFactualRestyle && !isMixedTranslationPolicy && !hasTelegramVerbatimContent(reply)) {
        try {
          const { text: restyled, cached } = await getOrSetRestyleCache({
            original: reply,
            styleRule,
            personaPrompt,
            langBucket,
            userQuestion: originalUserMessage,
            telegramGroupContext: params.telegramGroupContext,
            bypassCache: _regenerateMode || _creativeOverride,
          });
          if (restyled && restyled.length > 0) {
            const sanitizedRestyled = sanitizeForTelegramHtml(restyled);
            if (replyViolatesAngelLanguageBucket(sanitizedRestyled, langBucket)) {
              console.warn(`[askAngel] restyle language mismatch skipped lang=${langBucket} cached=${cached}`);
            } else {
              reply = sanitizedRestyled;
              console.log(`[askAngel] restyle ok cached=${cached} len=${reply.length}`);
            }
          }
        } catch (e) {
          console.warn("[askAngel] restyle failed, keep original", e);
        }
      }
    }


    // Language repair: chỉ khi reply THỰC SỰ vi phạm ngôn ngữ. Short DM skip đã ngầm
    // bảo đảm `_langOk`, nên guard `_shortDmSkip` cũng chặn ở đây.
    if (!_shortDmSkip && !isMixedTranslationPolicy && !hasTelegramVerbatimContent(reply) && replyViolatesAngelLanguageBucket(reply, langBucket)) {
      // Group language policy (forcedLangBucket) must hold: if FUN Core keeps the
      // original language, fall back to the gateway for a second repair attempt.
      const providers: Array<"funcore" | "lovable"> = params.forcedLangBucket ? ["funcore", "lovable"] : ["funcore"];
      for (const prov of providers) {
        try {
          const repaired = sanitizeForTelegramHtml(await repairLanguageWithAngel({
            reply,
            originalUserMessage,
            langBucket,
            telegramGroupContext: params.telegramGroupContext,
            provider: prov,
          }));
          if (repaired && !replyViolatesAngelLanguageBucket(repaired, langBucket)) {
            reply = repaired;
            console.log(`[askAngel] language repair ok lang=${langBucket} provider=${prov} len=${reply.length}`);
            break;
          }
          console.warn(`[askAngel] language repair rejected lang=${langBucket} provider=${prov}`);
        } catch (e) {
          console.warn(`[askAngel] language repair failed lang=${langBucket} provider=${prov}`, e);
        }
      }
    }

    // Post-processing: ép xưng hô tiếng Việt cho mọi reply (Pass 1 hoặc Pass 2).
    // An toàn vì chỉ thay từ độc lập, không đụng URL/HTML tag/code.
    // Pronoun Contract là guard bắt buộc cho mọi reply, kể cả owner mode.
    if (langBucket === "vi") {
      reply = enforceVietnamesePronouns(reply, senderUsername);
    }

    // Post-Process Style Pass — brevity + emojis (Telegram only, non-long mode).
    // KHÔNG dính vào request gửi FUN Core → không ảnh hưởng RAG. Rewrite CHỈ chạy
    // trên reply output. Nếu miss fact hoặc lỗi → tự động fallback về reply gốc.
    // TẦNG B: skip toàn bộ khi short DM + lang ok (đã cover ở guard đầu block).
    if (_shortDmSkip || params.telegramGroupContext) {
      // Structured replies keep their verified speaker relationships; skip a context-free style rewrite.
      // no-op — enforceVietnamesePronouns + hardRevert đã chạy ở trên, đủ an toàn.
    } else {
    try {
      const originalUserForMode = params.originalUserMessage?.trim() || q;
      if (factualLookup && replyHasConcreteFactualData(reply)) {
        console.log(`[askAngel] postprocess skipped — factual concrete data reason=${factualLookupReason}`);
      } else {
      const triggerSrc = params.conversationContext?.triggerSource ?? "";
      const isMeditationSummary = triggerSrc === "meditation_reply" || triggerSrc === "meditation_summary";
      const isLongMode = isMeditationSummary || detectLongMode(originalUserForMode);
      const chatContext: "dm" | "group" = _isDmContext ? "dm" : "group";
      const styled = await postProcessAngelStyle({
        original: reply,
        userText: originalUserForMode,
        langBucket,
        isLongMode,
        telegramAddressing: true,
        telegramUsername: senderUsername,
        chatContext,
      });
      if (styled.applied && styled.text && styled.text.length > 0) {
        const sanitized = sanitizeForTelegramHtml(styled.text);
        if (!replyViolatesAngelLanguageBucket(sanitized, langBucket)) {
          reply = sanitized;
          if (langBucket === "vi") {
            reply = enforceVietnamesePronouns(reply, senderUsername);
          }
        } else {
          console.warn(`[askAngel] postprocess rejected — language mismatch lang=${langBucket}`);
        }
      } else {
        console.log(`[askAngel] postprocess skipped reason=${styled.reason}`);
      }
      }
    } catch (e) {
      console.warn("[askAngel] postprocess exception (keep original)", e);
    }
    }


    // ─── TẦNG A — Assistant-side anti-repeat (DM only) ─────────────────────
    // So sánh reply vừa sinh với 3 reply gần nhất của bot cho cùng (chat,user).
    // Nếu Jaccard ≥ 0.82 → retry 1 lần với temperature 0.95, force Lovable Gateway,
    // bypass restyle cache, và prepend rule mạnh cấm lặp reply cũ.
    try {
      const _antiRepeatCtx = params.conversationContext;
      if (
        _isDmContext
        && params.adminClient
        && _antiRepeatCtx
        && _antiRepeatCtx.chatId != null
        && _antiRepeatCtx.userId != null
        && reply
        && reply.length >= 40
      ) {
        const dupCheck = await isNearDuplicateOfLastBotReply(params.adminClient, {
          chatId: _antiRepeatCtx.chatId as number,
          telegramUserId: _antiRepeatCtx.userId as number,
          currentReply: reply,
        });
        if (dupCheck.duplicate) {
          console.warn(
            `[askAngel] TẦNG A duplicate reply detected — retry with temp=0.95 lang=${langBucket} sample="${(dupCheck.sample ?? "").slice(0, 80).replace(/\n/g, " ")}"`,
          );
          const ANTI_REPEAT_RULE = [
            "ANTI-REPEAT RULE — HIGHEST PRIORITY:",
            "Angel VỪA trả lời một câu GẦN GIỐNG HỆT reply trước đó cho bé.",
            "Reply trước (KHÔNG được lặp lại — dù chỉ 1 đoạn):",
            `"""${(dupCheck.sample ?? "").slice(0, 400)}"""`,
            "Lần này Angel PHẢI:",
            "1) Mở đầu bằng câu HOÀN TOÀN KHÁC (không dùng chung 3 từ đầu với reply cũ).",
            "2) Chọn góc nhìn / ví dụ / cấu trúc MỚI. Nếu câu hỏi mở, kể 1 ví dụ cụ thể / 1 câu chuyện nhỏ / 1 góc nhìn khác thay vì lặp lại định nghĩa cũ.",
            "3) Giữ giọng Angel/bé, ấm áp, 2-3 emoji, không dài dòng.",
            "4) Bám sát ý câu hỏi hiện tại của bé, không lan man.",
          ].join("\n");
          try {
            // STEP 4 — Anti-repeat retry: ưu tiên FUN Core strict mirror (đúng giọng
            // Angel chính chủ). Chỉ dùng Lovable Gateway khi FUN Core reply vẫn trùng
            // HOẶC lỗi, VÀ Gateway còn khả dụng (không đang credit_limit_reached).
            const _lovableHealth = isLovableUnavailable();
            let retry;
            let _retryRoute: "funcore" | "lovable" = "funcore";
            try {
              const funcoreRetryMsgs = [
                { role: "user" as const, content: originalUserMessage },
                { role: "user" as const, content: ANTI_REPEAT_RULE },
              ];
              retry = await callAngelCore({
                messages: withTelegramGroupContext(funcoreRetryMsgs, params.telegramGroupContext),
                forceProvider: "funcore" as const,
                strictMirror: true,
              });
            } catch (fcErr) {
              console.warn("[askAngel] TẦNG A funcore retry failed", fcErr);
              if (_lovableHealth.unavailable) {
                console.warn(`[askAngel] TẦNG A skip lovable retry — gateway unavailable (${_lovableHealth.reason})`);
                throw fcErr;
              }
              _retryRoute = "lovable";
              retry = await callAngelCore({
                messages: params.telegramGroupContext
                  ? [...messages, { role: "system" as const, content: ANTI_REPEAT_RULE }]
                  : [...messages, { role: "system" as const, content: ANTI_REPEAT_RULE }, REGENERATE_PREFIX],
                forceProvider: "lovable" as const,
                temperature: 0.95,
              });
            }
            console.log(`[askAngel] TẦNG A retry route=${_retryRoute}`);
            let retryReply = sanitizeForTelegramHtml((retry.text ?? "").trim());
            if (retryReply && retryReply.length >= 20) {
              if (!replyViolatesAngelLanguageBucket(retryReply, langBucket)) {
                if (langBucket === "vi") {
                  retryReply = enforceVietnamesePronouns(retryReply, senderUsername);
                }
                const secondCheck = await isNearDuplicateOfLastBotReply(params.adminClient, {
                  chatId: _antiRepeatCtx.chatId as number,
                  telegramUserId: _antiRepeatCtx.userId as number,
                  currentReply: retryReply,
                });
                if (!secondCheck.duplicate) {
                  reply = retryReply;
                  console.log(`[askAngel] TẦNG A retry ok len=${reply.length}`);
                } else {
                  console.warn("[askAngel] TẦNG A retry still duplicate — keep retry anyway to break pattern");
                  reply = retryReply;
                }
              } else {
                console.warn(`[askAngel] TẦNG A retry rejected — language mismatch lang=${langBucket}`);
              }
            }
          } catch (retryErr) {
            console.warn("[askAngel] TẦNG A retry failed (keep original)", retryErr);
          }
        }
      }
    } catch (dupErr) {
      console.warn("[askAngel] TẦNG A anti-repeat exception (non-fatal)", dupErr);
    }


    // Step 4 — Neutralize meta-echo: nếu reply chứa cụm "nhắc lại câu hỏi cụ thể…"
    // (kết quả của một lần bridge hụt), thay bằng câu trung tính để không trở
    // thành anchor sai ở turn kế tiếp.
    if (reply && META_QUESTION_RE.test(reply)) {
      const _neutral = "Angel xin phép hỏi lại: bé đang muốn Angel chia sẻ sâu hơn về điều gì nhé? 💛";
      reply = reply
        .replace(/[^.!?…]*\b(nh[ắa]c\s*l[ạa]i\s*c[âa]u\s*h[ỏo]i|c[âa]u\s*h[ỏo]i\s*c[ụu]\s*th[ểe]|angel\s*ch[ưu]a\s*(hi[ểe]u|r[õo]|n[ắa]m)|b[ée]\s*(c[óa]\s*th[ểe]\s*)?n[óo]i\s*r[õo]\s*h[ơo]n)[^.!?…]*[.!?…]/giu, "")
        .trim();
      if (!reply || reply.length < 20) reply = _neutral;
      else reply = `${reply}\n\n${_neutral}`;
    }

    // Telegram sender contract — mandatory final gate for every successful route,
    // including short DM, factual bypass, language repair and anti-repeat retry.
    if (langBucket === "vi") {
      const beforePronouns = reply;
      reply = enforceVietnamesePronouns(reply, senderUsername);
      if (reply !== beforePronouns) {
        console.log(`[askAngel] telegram-addressing corrected route=${provider} chars=${reply.length}`);
      }
    }

    if (params.conversationContext) {
      rememberLastAssistantContext(params.conversationContext, reply);
      // Neo DB "câu hỏi mở cuối cùng" — chống race + cross-instance cho Context Bridge.
      // Đồng bộ (await) để turn kế tiếp của user chắc chắn thấy anchor mới.
      try {
        await upsertLastQuestionAnchor(params.adminClient ?? null, params.conversationContext, reply);
      } catch (e) {
        console.warn("[askAngel] upsertLastQuestionAnchor failed (non-fatal)", e);
      }
      // TẦNG A — fire-and-forget log + memory extract. User không phải chờ DB.
      const _ctx = params.conversationContext;
      const _admin = params.adminClient ?? null;
      const _userMsg = params.originalUserMessage?.trim() || q;
      const _replySnapshot = reply;
      const _latency = Date.now() - t0;

      runBackground((async () => {
        await logAngelConversation(_admin, _ctx, {
          userMessage: _userMsg,
          botReply: _replySnapshot,
          language: langBucket,
          provider,
          latencyMs: _latency,
        });

        const _rawChatType2 = (_ctx.chatType ?? "").toLowerCase();
        const _isDm2 = !(_rawChatType2 === "group" || _rawChatType2 === "supergroup" || _rawChatType2 === "channel");
        if (_admin && _ctx.userId != null) {
          const _memChannel2: "telegram" | "group" = _isDm2 ? "telegram" : "group";
          try {
            const _s = await getAngelMemorySettings(_admin);
            if (!isMemoryEnabledForChannel(_s, _memChannel2)) return;
            await scheduleFactExtraction(_admin, {
              channel: _memChannel2,
              userKey: String(_ctx.userId),
              displayName: _ctx.fullName ?? _ctx.username ?? null,
              userMessage: _userMsg,
              botReply: _replySnapshot,
            });
          } catch (err) {
            console.warn("[askAngel] memory extract failed", err);
          }
        }

        // ROLLING SUMMARY — cập nhật tóm tắt nếu vượt ngưỡng (v1: chỉ DM,
        // group cần chiến lược khác vì history không lưu per-user)
        if (_admin && _isDm2 && _ctx.userId != null) {
          try {
            const _rs = await getRollingSummarySettings(_admin, "telegram_dm");
            if (_rs.enabled) {
              const _past = await fetchRecentDmHistory(_admin, {
                chatId: _ctx.chatId as number,
                telegramUserId: _ctx.userId as number,
                limit: Math.max(_rs.turnThreshold * 2, 40),
              }).catch(() => [] as { role: "user" | "assistant"; content: string }[]);
              const _fullHistory = [
                ..._past,
                { role: "user" as const, content: _userMsg },
                { role: "assistant" as const, content: _replySnapshot },
              ];
              await scheduleRollingSummaryUpdate(_admin, {
                channel: "telegram_dm",
                scopeKey: _ctx.userId,
                history: _fullHistory,
                settings: _rs,
              });
            }
          } catch (err) {
            console.warn("[askAngel] rolling summary failed", err);
          }
        }


      })());
    }


    return reply;
  } catch (error) {
    const errName = error instanceof Error ? error.name : typeof error;
    const errMsg = error instanceof Error ? error.message : String(error);
    const errStatus = error instanceof AngelCoreError ? error.status : undefined;
    const errDetail = error instanceof AngelCoreError ? (error as AngelCoreError & { details?: unknown }).details : undefined;
    const ytIds = extractYouTubeIds(params.originalUserMessage || q);
    console.error(
      `[askAngel] failed provider=${provider} dur=${Date.now() - t0}ms name=${errName} status=${errStatus ?? "-"} ytIds=${ytIds.length} msg=${errMsg}`,
      error,
    );

    // STEP 2 — Nếu lỗi ban đầu từ Lovable và là credit_limit_reached → mark unavailable
    // để các retry sau (và các request sau) không lãng phí latency gọi lại.
    if (provider === "lovable" || _creativeOverride) {
      if (isLovableCreditError(errStatus, errDetail ?? errMsg)) {
        markLovableUnavailable(`initial ${errStatus} credit_limit_reached`);
      }
    }

    // TIER 1 — Recovery pipeline (STEP 2 re-order):
    // Retry-1: FUN Core strict-mirror clean payload (chỉ 1 message user gốc).
    // Retry-2: Lovable Gateway CHỈ khi gateway còn khả dụng.
    // STEP 3: Nếu cả 2 fail → thử stale reply gần nhất trong DB.
    // Chỉ trả fallbackBusy khi mọi thứ đều fail.
    let retriedProvider: "funcore" | "lovable" | null = null;
    let retriedStatus: number | undefined;
    let retriedError: string | undefined;
    let _finalReason: "primary" | "retry_funcore" | "retry_lovable" | "stale" | "busy" = "busy";
    const isAngelCore = error instanceof AngelCoreError;
    const isHardBlock = isAngelCore && (errStatus === 429 || errStatus === 402
      || (errStatus === 500 && /not configured/i.test(errMsg)));
    // Nếu turn này đã bridge context, dùng bridged query cho retry để không mất anchor.
    const cleanUserText = (bridgedQueryForRetry || params.originalUserMessage?.trim() || originalUserMessage || q).trim();

    const buildLogPayload = (extra: Record<string, unknown>) => JSON.stringify({
      route: extra.route ?? provider,
      reason: extra.reason ?? _finalReason,
      status: extra.status ?? errStatus ?? null,
      error_type: errName,
      error_msg: errMsg.slice(0, 300),
      retry_count: extra.retry_count ?? 0,
      retry_last_status: retriedStatus ?? null,
      retry_last_msg: (retriedError ?? "").slice(0, 300),
      creative_override: _creativeOverride,
      regenerate_mode: _regenerateMode,
      ...extra,
    });

    if (!isHardBlock && ytIds.length === 0 && cleanUserText.length > 0) {
      // Retry-1: FUN Core clean strict mirror
      try {
        console.warn(`[askAngel] TIER1 retry-1 funcore clean strict-mirror qLen=${cleanUserText.length}`);
        const r1 = await callAngelCore({
          messages: withTelegramGroupContext([{ role: "user", content: cleanUserText }], params.telegramGroupContext),
          forceProvider: "funcore",
          strictMirror: true,
        });
        const r1Text = sanitizeForTelegramHtml((r1.text ?? "").trim());
        if (r1Text && r1Text.length >= 20) {
          retriedProvider = "funcore";
          _finalReason = "retry_funcore";
          let out = enforceVietnamesePronouns(r1Text, senderUsername);
          if (params.conversationContext) {
            runBackground(logAngelConversation(params.adminClient ?? null, params.conversationContext, {
              userMessage: cleanUserText,
              botReply: out,
              provider: retriedProvider,
              latencyMs: Date.now() - t0,
              error: buildLogPayload({ route: "funcore", reason: "retry_funcore", retry_count: 1, recovered: true }),
            }));
          }
          return out;
        }
      } catch (r1Err) {
        retriedStatus = r1Err instanceof AngelCoreError ? r1Err.status : undefined;
        retriedError = r1Err instanceof Error ? r1Err.message : String(r1Err);
        console.warn(`[askAngel] TIER1 retry-1 funcore failed status=${retriedStatus ?? "-"} msg=${retriedError}`);
      }

      // Retry-2: Lovable Gateway — CHỈ khi gateway còn khả dụng.
      const _lovHealth = isLovableUnavailable();
      if (_lovHealth.unavailable) {
        console.warn(`[askAngel] TIER1 skip retry-2 lovable — gateway unavailable (${_lovHealth.reason}) remainingMin=${Math.round(_lovHealth.remainingMs / 60_000)}`);
      } else {
        try {
          console.warn(`[askAngel] TIER1 retry-2 lovable gateway`);
          const r2 = await callAngelCore({
            messages: withTelegramGroupContext([
              { role: "system", content: `${addressRule}\nTrả lời ấm áp, ngắn gọn, 2-3 emoji.` },
              { role: "user", content: cleanUserText },
            ], params.telegramGroupContext),
            forceProvider: "lovable",
          });
          const r2Text = sanitizeForTelegramHtml((r2.text ?? "").trim());
          if (r2Text && r2Text.length >= 20) {
            retriedProvider = "lovable";
            _finalReason = "retry_lovable";
            let out = enforceVietnamesePronouns(r2Text, senderUsername);
            if (params.conversationContext) {
              runBackground(logAngelConversation(params.adminClient ?? null, params.conversationContext, {
                userMessage: cleanUserText,
                botReply: out,
                provider: "lovable",
                latencyMs: Date.now() - t0,
                error: buildLogPayload({ route: "lovable", reason: "retry_lovable", retry_count: 2, recovered: true }),
              }));
            }
            return out;
          }
        } catch (r2Err) {
          const r2Status = r2Err instanceof AngelCoreError ? r2Err.status : undefined;
          const r2Msg = r2Err instanceof Error ? r2Err.message : String(r2Err);
          const r2Detail = r2Err instanceof AngelCoreError ? (r2Err as AngelCoreError & { details?: unknown }).details : undefined;
          console.warn(`[askAngel] TIER1 retry-2 lovable failed status=${r2Status ?? "-"} msg=${r2Msg}`);
          if (isLovableCreditError(r2Status, r2Detail ?? r2Msg)) {
            markLovableUnavailable(`retry ${r2Status} credit_limit_reached`);
          }
          retriedError = `${retriedError ?? ""} | lovable:${r2Msg}`;
          retriedStatus = r2Status ?? retriedStatus;
        }
      }
    }

    // STEP 3 — Stale content fallback: nếu cùng user hỏi lại câu tương tự và
    // trước đó Angel đã trả lời thành công, gửi lại reply cũ thay vì báo bận.
    const _staleEnabled = await getFlag("router.stale_fallback_on_error", true);
    if (
      _staleEnabled
      && !params.telegramGroupContext
      && params.conversationContext?.chatId != null
      && params.conversationContext?.userId != null
      && params.adminClient
      && ytIds.length === 0
      && cleanUserText.length > 0
    ) {
      try {
        const stale = await findStaleGoodReply(params.adminClient, {
          chatId: params.conversationContext.chatId as number,
          telegramUserId: params.conversationContext.userId as number,
          currentQuestion: cleanUserText,
        });
        if (stale) {
          _finalReason = "stale";
          let decorated = enforceVietnamesePronouns(decorateStaleReply(stale.reply, stale.ageMinutes), senderUsername);
          console.warn(`[askAngel] STEP3 stale fallback ok sim=${stale.similarity.toFixed(2)} age=${stale.ageMinutes}min`);
          runBackground(logAngelConversation(params.adminClient ?? null, params.conversationContext, {
            userMessage: cleanUserText,
            botReply: decorated,
            provider: "stale",
            latencyMs: Date.now() - t0,
            error: buildLogPayload({ route: "stale", reason: "stale", retry_count: retriedProvider ? 2 : 1, stale_similarity: stale.similarity, stale_age_min: stale.ageMinutes }),
          }));
          return decorated;
        }
      } catch (staleErr) {
        console.warn("[askAngel] STEP3 stale fallback threw", staleErr);
      }
    }

    let fallback: string;
    if (isAngelCore && errStatus === 429) fallback = fallbackRateLimit(q, params.fallbackLangBucket ?? params.forcedLangBucket);
    else if (isAngelCore && errStatus === 402) fallback = fallbackRest(q, params.fallbackLangBucket ?? params.forcedLangBucket);
    else if (isAngelCore && errStatus === 500 && /not configured/i.test(errMsg)) fallback = fallbackRest(q, params.fallbackLangBucket ?? params.forcedLangBucket);
    else if (ytIds.length > 0) {
      fallback = "Bé ơi, Angel vừa thử đọc video YouTube này nhưng chưa lấy được nội dung (có thể video riêng tư, không có phụ đề, hoặc YouTube đang chặn tạm thời) 💛✨\n\nBé có thể tóm tắt hoặc dán transcript để Angel cùng suy ngẫm với bé nhé.";
    }
    else fallback = fallbackBusy(q, params.fallbackLangBucket ?? params.forcedLangBucket);
    _finalReason = "busy";
    fallback = enforceVietnamesePronouns(fallback, senderUsername);

    if (params.conversationContext) {
      runBackground(logAngelConversation(params.adminClient ?? null, params.conversationContext, {
        userMessage: params.originalUserMessage?.trim() || q,
        botReply: fallback,
        provider,
        latencyMs: Date.now() - t0,
        error: buildLogPayload({ route: provider, reason: "busy", retry_count: retriedProvider ? 2 : (retriedError ? 2 : 1) }),
      }));
    }
    return fallback;
  }
}




export async function checkAndUpdateAiRate(adminClient: SupabaseClient, params: {
  chatId: number;
  telegramUserId: number;
  limitPerMinute: number;
}): Promise<{ allowed: boolean; count: number }> {
  const lookup = await adminClient
    .from("telegram_community_user_state")
    .select("id, ai_msg_count, ai_window_start")
    .eq("group_id", params.chatId)
    .eq("telegram_user_id", params.telegramUserId)
    .maybeSingle();
  const state = assertQuerySucceeded(lookup, "AI rate limit state");

  const now = Date.now();
  if (!state) {
    const insert = await adminClient.from("telegram_community_user_state").upsert({
      group_id: params.chatId,
      telegram_user_id: params.telegramUserId,
      ai_msg_count: 1,
      ai_window_start: new Date(now).toISOString(),
    }, { onConflict: "group_id,telegram_user_id" });
    if (insert.error) throw new Error(`AI rate limit state save failed (${insert.error.code ?? "unknown"})`);
    return { allowed: true, count: 1 };
}

  const windowStart = new Date(state.ai_window_start ?? now).getTime();
  const reset = now - windowStart >= 60_000;
  const nextCount = reset ? 1 : (state.ai_msg_count ?? 0) + 1;
  const nextStart = reset ? new Date(now).toISOString() : state.ai_window_start;

  const update = await adminClient
    .from("telegram_community_user_state")
    .update({ ai_msg_count: nextCount, ai_window_start: nextStart })
    .eq("id", state.id);
  if (update.error) throw new Error(`AI rate limit state update failed (${update.error.code ?? "unknown"})`);

  return { allowed: nextCount <= params.limitPerMinute, count: nextCount };
}

// ---- Trusted sender_chat cache (in-process, TTL 60s) ----
const trustedSenderChatCache = new Map<string, { trusted: boolean; expiresAt: number }>();

export function invalidateTrustedSenderChatCache(chatId: number, senderChatId: number): void {
  trustedSenderChatCache.delete(`${chatId}:${senderChatId}`);
}

export async function isTrustedSenderChat(
  adminClient: SupabaseClient,
  chatId: number,
  senderChatId: number,
): Promise<boolean> {
  const key = `${chatId}:${senderChatId}`;
  const now = Date.now();
  const cached = trustedSenderChatCache.get(key);
  if (cached && cached.expiresAt > now) return cached.trusted;

  const { data, error } = await adminClient
    .from("trusted_sender_chats")
    .select("id")
    .eq("chat_id", chatId)
    .eq("sender_chat_id", senderChatId)
    .maybeSingle();

  const trusted = !error && !!data;
  trustedSenderChatCache.set(key, { trusted, expiresAt: now + 60_000 });
  return trusted;
}

export async function upsertTrustedSenderChat(
  adminClient: SupabaseClient,
  chatId: number,
  senderChatId: number,
  title: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await adminClient
    .from("trusted_sender_chats")
    .upsert(
      { chat_id: chatId, sender_chat_id: senderChatId, title },
      { onConflict: "chat_id,sender_chat_id" },
    );
  invalidateTrustedSenderChatCache(chatId, senderChatId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}



export async function ensureSettings(adminClient: SupabaseClient): Promise<CommunitySettings | null> {
  const lookup = await adminClient
    .from("telegram_community_settings")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const existing = assertQuerySucceeded(lookup, "community settings");

  if (existing) return existing as CommunitySettings;

  const envGroupId = Number(Deno.env.get("COMMUNITY_GUARD_GROUP_ID") ?? "0");
  const botUsername = Deno.env.get("COMMUNITY_GUARD_BOT_USERNAME") ?? null;
  if (!envGroupId) return null;

  const { data, error } = await adminClient
    .from("telegram_community_settings")
    .insert(managedGroupSettingsInsert(envGroupId, botUsername))
    .select("*")
    .single();

  if (error) {
    console.error("[telegram-community] failed to create default settings", { error_code: error.code ?? "unknown" });
    throw new Error(`community settings insert failed (${error.code ?? "unknown"})`);
  }

  return data as CommunitySettings;
}

export async function getSettingsForGroup(adminClient: SupabaseClient, groupId: number): Promise<CommunitySettings | null> {
  const result = await loadGroupSettings(adminClient, groupId);
  if (!result.ok) throw new Error(`group settings lookup failed (${result.errorCode})`);
  return result.settings;
}

export type GroupSettingsLookup =
  | { ok: true; settings: CommunitySettings | null }
  | { ok: false; errorCode: string };

/**
 * Distinguishes "group is not managed" (ok + settings null) from "lookup failed"
 * (ok false). Retries once so a transient database error is not mistaken for
 * an unmanaged group.
 */
export async function loadGroupSettings(
  adminClient: Pick<SupabaseClient, "from">,
  groupId: number,
): Promise<GroupSettingsLookup> {
  let errorCode = "unknown";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { data, error } = await adminClient
        .from("telegram_community_settings")
        .select("*")
        .eq("group_id", groupId)
        .maybeSingle();
      if (!error) return { ok: true, settings: (data as CommunitySettings | null) ?? null };
      errorCode = (error as { code?: string }).code ?? "query_error";
    } catch {
      errorCode = "exception";
    }
  }
  console.error("[telegram-community] settings lookup failed", { group_id: groupId, error_code: errorCode });
  return { ok: false, errorCode };
}

export async function activeDomains(adminClient: SupabaseClient): Promise<string[]> {
  const result = await adminClient
    .from("telegram_community_domain_whitelist")
    .select("domain")
    .eq("is_active", true);
  const data = assertQuerySucceeded(result, "domain whitelist");
  return (data ?? []).map((row: { domain: string }) => row.domain.toLowerCase());
}

export async function activeKeywords(adminClient: SupabaseClient): Promise<Array<{ keyword: string; severity: string }>> {
  const result = await adminClient
    .from("telegram_community_blocked_keywords")
    .select("keyword, severity")
    .eq("is_active", true);
  const data = assertQuerySucceeded(result, "blocked keyword list");
  return (data ?? []).map((row: { keyword: string; severity: string }) => ({
    keyword: row.keyword.toLowerCase(),
    severity: row.severity,
  }));
}

export function extractText(message: TelegramMessage): string {
  const parts: string[] = [];
  const pushSenderChat = (senderChat?: TelegramSenderChat) => {
    if (!senderChat) return;
    if (senderChat.title) parts.push(senderChat.title);
    if (senderChat.username) parts.push(`@${senderChat.username}`);
  };
  const base = (message.text ?? message.caption ?? "").trim();
  if (base) parts.push(base);

  if (message.quote?.text) parts.push(message.quote.text);
  if (message.external_reply?.link_preview_options?.url) {
    parts.push(message.external_reply.link_preview_options.url);
  }
  if (message.link_preview_options?.url) parts.push(message.link_preview_options.url);
  if (message.via_bot?.username) parts.push(`@${message.via_bot.username}`);
  pushSenderChat(message.sender_chat);
  pushSenderChat(message.forward_from_chat);
  pushSenderChat(message.external_reply?.chat);
  pushSenderChat(message.external_reply?.origin?.chat);
  pushSenderChat(message.external_reply?.origin?.sender_chat);
  pushSenderChat(message.forward_origin?.chat);
  pushSenderChat(message.forward_origin?.sender_chat);

  for (const e of [...(message.entities ?? []), ...(message.caption_entities ?? [])]) {
    if (e.type === "text_link" && e.url) parts.push(e.url);
  }

  const checklist = message.checklist;
  if (checklist) {
    if (checklist.title) parts.push(checklist.title);
    for (const task of checklist.tasks ?? []) {
      if (task?.text) parts.push(task.text);
    }
  }

  const poll = message.poll;
  if (poll) {
    if (poll.question) parts.push(poll.question);
    for (const opt of poll.options ?? []) {
      if (opt?.text) parts.push(opt.text);
    }
  }

  for (const row of message.reply_markup?.inline_keyboard ?? []) {
    for (const btn of row ?? []) {
      if (btn?.text) parts.push(btn.text);
      if (btn?.url) parts.push(btn.url);
      if (btn?.web_app?.url) parts.push(btn.web_app.url);
      if (btn?.login_url?.url) parts.push(btn.login_url.url);
    }
  }

  return parts.join("\n").trim();
}

export type AutomatedCjkScamDetection = {
  isScam: boolean;
  senderKind: "bot" | "inline_bot" | null;
  botUsername: string | null;
  hasInlineKeyboard: boolean;
  hasExternalButton: boolean;
  payload: string;
};

/**
 * Detect high-confidence CJK promo sent by a foreign bot or through an inline bot.
 * `extractText` intentionally includes captions, forwards, sender_chat metadata and
 * inline-keyboard labels/URLs, so button-driven variants cannot bypass text scans.
 */
export function detectAutomatedCjkScam(
  message: TelegramMessage,
  ownBotUsername?: string | null,
): AutomatedCjkScamDetection {
  const ownBot = (ownBotUsername ?? "").toLowerCase().replace(/^@/, "");
  const directBot = message.from?.is_bot === true ? message.from : null;
  const inlineBot = !directBot && message.via_bot?.is_bot === true ? message.via_bot : null;
  const bot = directBot ?? inlineBot;
  const botUsername = (bot?.username ?? "").toLowerCase().replace(/^@/, "");
  const senderKind = directBot ? "bot" : inlineBot ? "inline_bot" : null;
  const keyboard = message.reply_markup?.inline_keyboard ?? [];
  const hasInlineKeyboard = keyboard.some((row) => (row ?? []).length > 0);
  const hasExternalButton = keyboard.some((row) => row.some((button) =>
    Boolean(button?.url || button?.web_app?.url || button?.login_url?.url)
  ));
  const payload = extractText(message);

  if (!senderKind || (ownBot && botUsername === ownBot)) {
    return { isScam: false, senderKind, botUsername: botUsername || null, hasInlineKeyboard, hasExternalButton, payload };
  }

  return {
    isScam: looksLikeCjkPromo(payload),
    senderKind,
    botUsername: botUsername || null,
    hasInlineKeyboard,
    hasExternalButton,
    payload,
  };
}

export type TelegramScamDetection = {
  isScam: boolean;
  severity: "low" | "medium" | "high";
  reason: string;
  matchedKeywords: string[];
  hasInlineKeyboard: boolean;
  hasUrlButton: boolean;
  forwardOrigin: string | null;
};

const TELEGRAM_QR_PHISHING_STRONG_KEYWORDS = [
  "Safeguard Human Verification",
  "Human Verification",
  "Click To Verify",
  "Complete verification",
  "Install application",
  "Confirm your account",
  "Account restricted",
  "Log in to Telegram by QR Code",
  "Link Desktop Device",
  "Settings > Devices",
  "QR Code",
  "login by phone number",
  "@groupauc_bot",
];

const TELEGRAM_QR_PHISHING_CONTEXT_KEYWORDS = [
  "Verification",
  "Verify",
];

const TELEGRAM_QR_PHISHING_BUTTON_TEXT = [
  "Click To Verify",
  "Start Verification",
  "Verify",
  "Open",
  "Login",
  "Confirm",
];

const TELEGRAM_CRYPTO_MINING_SCAM_GROUPS = [
  [
    "XRP Core Miner",
    "Core Miner",
    "cloud mining",
    "mining platform",
    "mining experience",
  ],
  [
    "XRP",
    "USDT",
    "crypto",
    "on-chain rewards",
    "blockchain",
  ],
  [
    "daily income",
    "automatic daily",
    "auto credit",
    "credited automatically",
    "thu nhập hằng ngày",
    "thu nhập hàng ngày",
    "ghi có tự động",
    "được ghi có tự động",
    "vừa nhận",
  ],
  [
    "$1,300",
    "$1300",
    "quá đáng",
    "too good",
    "profit",
    "earning",
    "earnings",
  ],
];

const TELEGRAM_CRYPTO_MINING_BUTTON_TEXT = [
  "Mining",
  "Start Mining",
  "Claim",
  "Earn",
  "Withdraw",
  "Join",
];

const FORWARDED_SCAM_CONTEXT = /\b(verification|verify|login|security|account\s+restricted|restricted|confirm\s+your\s+account|qr\s*code|devices?)\b/i;

function normalizeScamToken(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function pushScamText(parts: string[], value?: string | null) {
  const text = String(value ?? "").trim();
  if (text) parts.push(text);
}

function cryptoMiningScamKeywords(normalized: string): string[] {
  const matched: string[] = [];
  for (const group of TELEGRAM_CRYPTO_MINING_SCAM_GROUPS) {
    const keyword = group.find((candidate) => normalized.includes(normalizeScamToken(candidate)));
    if (keyword) matched.push(keyword);
  }
  return matched;
}

function telegramForwardOriginLabel(message: TelegramMessage): string | null {
  const origin = message.forward_origin;
  if (origin?.chat?.id || origin?.chat?.title || origin?.chat?.username) {
    return `${origin.type ?? "chat"}:${origin.chat.id ?? "?"}:${origin.chat.title ?? origin.chat.username ?? ""}`;
  }
  if (origin?.sender_chat?.id || origin?.sender_chat?.title || origin?.sender_chat?.username) {
    return `${origin.type ?? "sender_chat"}:${origin.sender_chat.id ?? "?"}:${origin.sender_chat.title ?? origin.sender_chat.username ?? ""}`;
  }
  if (message.forward_from_chat?.id || message.forward_from_chat?.title || message.forward_from_chat?.username) {
    return `forward_from_chat:${message.forward_from_chat.id ?? "?"}:${message.forward_from_chat.title ?? message.forward_from_chat.username ?? ""}`;
  }
  if (message.forward_from?.id || message.forward_from?.username || message.forward_from?.first_name) {
    return `forward_from:${message.forward_from.id ?? "?"}:${message.forward_from.username ?? message.forward_from.first_name ?? ""}`;
  }
  return null;
}

function isTrustedReferralPromoUrl(rawUrl: string, trustedDomains: string[]): boolean {
  try {
    const url = new URL(rawUrl.replace(/[),.;!?]+$/, ""));
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    return trustedDomains.some((entry) => {
      const domain = entry.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[/:?#]/)[0];
      return Boolean(domain) && (host === domain || host.endsWith(`.${domain}`));
    });
  } catch {
    return false;
  }
}

function isReferralCashbackPromotion(message: TelegramMessage, trustedDomains: string[]): boolean {
  const text = extractText(message);
  if (!/(?:hoàn\s*(?:trả|tiền)|cash\s*back|cashback|rebate|commission|chiết\s*khấu|hoa\s*hồng)/i.test(text)) return false;
  if (!/\b\d{1,3}\s*%/.test(text)) return false;
  return extractUrls(message).some((rawUrl) => {
    if (isTrustedReferralPromoUrl(rawUrl, trustedDomains)) return false;
    try {
      const url = new URL(rawUrl.startsWith("www.") ? `https://${rawUrl}` : rawUrl);
      return [...url.searchParams.keys()].some((key) =>
        /^(?:ref|ref_id|referral|affiliate|aff|invite|partner|promo|campaign)$/i.test(key)
      );
    } catch {
      return false;
    }
  });
}

export function detectTelegramScam(message: TelegramMessage, trustedDomains: string[] = []): TelegramScamDetection {
  const inlineKeyboard = message.reply_markup?.inline_keyboard ?? [];
  const buttonTexts = inlineKeyboard.flatMap((row) => row.map((button) => button.text ?? "").filter(Boolean));
  const hasInlineKeyboard = inlineKeyboard.length > 0;
  const hasUrlButton = inlineKeyboard.some((row) =>
    row.some((button) => Boolean(button.url || button.web_app?.url || button.login_url?.url))
  );

  const parts: string[] = [];
  pushScamText(parts, message.text);
  pushScamText(parts, message.caption);
  pushScamText(parts, message.via_bot?.username ? `@${message.via_bot.username}` : null);
  pushScamText(parts, message.sender_chat?.title);
  pushScamText(parts, message.sender_chat?.username ? `@${message.sender_chat.username}` : null);
  pushScamText(parts, message.forward_from_chat?.title);
  pushScamText(parts, message.forward_from_chat?.username ? `@${message.forward_from_chat.username}` : null);
  pushScamText(parts, message.forward_from?.username ? `@${message.forward_from.username}` : null);
  pushScamText(parts, message.forward_from?.first_name);
  pushScamText(parts, message.forward_origin?.chat?.title);
  pushScamText(parts, message.forward_origin?.chat?.username ? `@${message.forward_origin.chat.username}` : null);
  pushScamText(parts, message.forward_origin?.sender_chat?.title);
  pushScamText(parts, message.forward_origin?.sender_chat?.username ? `@${message.forward_origin.sender_chat.username}` : null);
  for (const text of buttonTexts) pushScamText(parts, text);

  const combined = parts.join("\n");
  const normalized = normalizeScamToken(combined);
  const referralCashbackPromo = isReferralCashbackPromotion(message, trustedDomains);
  const matchedKeywords = TELEGRAM_QR_PHISHING_STRONG_KEYWORDS.filter((keyword) =>
    normalized.includes(normalizeScamToken(keyword))
  );

  const suspiciousButton = inlineKeyboard.some((row) =>
    row.some((button) => {
      const text = normalizeScamToken(button.text ?? "");
      const riskyLabel = TELEGRAM_QR_PHISHING_BUTTON_TEXT.some((keyword) =>
        text.includes(normalizeScamToken(keyword))
      );
      return riskyLabel && Boolean(button.url || button.web_app?.url || button.login_url?.url);
    })
  );
  const miningButton = inlineKeyboard.some((row) =>
    row.some((button) => {
      const text = normalizeScamToken(button.text ?? "");
      const riskyLabel = TELEGRAM_CRYPTO_MINING_BUTTON_TEXT.some((keyword) =>
        text.includes(normalizeScamToken(keyword))
      );
      return riskyLabel && Boolean(button.url || button.web_app?.url || button.login_url?.url);
    })
  );

  const forwardOrigin = telegramForwardOriginLabel(message);
  const isForwarded = Boolean(forwardOrigin);
  const forwardedScam = isForwarded && FORWARDED_SCAM_CONTEXT.test(combined);
  const miningKeywords = cryptoMiningScamKeywords(normalized);
  const cryptoMiningScam =
    miningKeywords.length >= 3 ||
    (miningButton && miningKeywords.length >= 2) ||
    (Boolean(message.via_bot?.username) && miningKeywords.length >= 2);
  if (cryptoMiningScam) {
    for (const keyword of miningKeywords) matchedKeywords.push(keyword);
    if (miningButton) matchedKeywords.push("Mining button");
    if (message.via_bot?.username) matchedKeywords.push(`via_bot:@${message.via_bot.username}`);
  }
  const contextLooksRisky = suspiciousButton || forwardedScam || /\b(login|qr\s*code|devices?|security|restricted|confirm\s+your\s+account)\b/i.test(combined);
  if (contextLooksRisky) {
    for (const keyword of TELEGRAM_QR_PHISHING_CONTEXT_KEYWORDS) {
      if (normalized.includes(normalizeScamToken(keyword))) matchedKeywords.push(keyword);
    }
  }
  const isScam = matchedKeywords.length > 0 || suspiciousButton || forwardedScam || cryptoMiningScam || referralCashbackPromo;

  const severity: TelegramScamDetection["severity"] =
    referralCashbackPromo
      ? "high"
      : cryptoMiningScam
      ? "high"
      : matchedKeywords.some((keyword) => /qr|groupauc|desktop|phone|install|restricted/i.test(keyword)) || suspiciousButton
      ? "high"
      : forwardedScam
        ? "medium"
        : matchedKeywords.length > 0
          ? "medium"
          : "low";

  const reason = referralCashbackPromo
    ? "referral_cashback_promo"
    : cryptoMiningScam
    ? "crypto_cloud_mining_scam"
    : suspiciousButton
    ? "fake_verification_button"
    : forwardedScam
      ? "forwarded_fake_verification"
      : matchedKeywords.length > 0
        ? "fake_telegram_verification"
        : "none";

  return {
    isScam,
    severity,
    reason,
    matchedKeywords: referralCashbackPromo ? [...matchedKeywords, "referral_cashback_percentage"] : matchedKeywords,
    hasInlineKeyboard,
    hasUrlButton,
    forwardOrigin,
  };
}

export function extractUrls(message: TelegramMessage): string[] {
  const text = extractText(message);
  const urls = new Set<string>();
  const entities = [
    ...(message.entities ?? []),
    ...(message.caption_entities ?? []),
    ...(message.checklist?.title_entities ?? []),
    ...((message.checklist?.tasks ?? []).flatMap((t) => t?.text_entities ?? [])),
  ];

  for (const entity of entities) {
    if (entity.type === "text_link" && entity.url) urls.add(entity.url);
    if (entity.type === "url") urls.add(text.slice(entity.offset, entity.offset + entity.length));
  }

  const regex = /\b(?:https?:\/\/|www\.)[^\s<>"']+/gi;
  for (const match of text.match(regex) ?? []) {
    urls.add(match);
  }

  // Bare-domain detection (e.g. "Trumpcas.cc") — common when scam hides URL as plain text
  const bareDomainRegex = /\b([a-z0-9-]+(?:\.[a-z0-9-]+)+)\b/gi;
  for (const match of text.match(bareDomainRegex) ?? []) {
    const lower = match.toLowerCase();
    const tld = lower.split(".").pop() || "";
    if (SUSPICIOUS_TLDS.has(tld)) urls.add(`https://${lower}`);
  }

  return Array.from(urls);
}

export type MeditationInviteDetection = {
  topic: string;
  zoomLink: string;
  rawText: string;
  language: MeditationSummaryLanguage;
};


function stripTelegramHtmlForDetection(text: string): string {
  return text
    .replace(/<[^>\n]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .trim();
}

function cleanMeditationTopic(topic: string): string {
  return topic
    .replace(/<[^>\n]+>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s:：\-–—]+|[\s.。]+$/g, "")
    .trim();
}

export type MeditationInviteMissReason =
  | "no_text"
  | "no_zoom_link"
  | "no_meditation_signal"
  | "no_topic";

export type MeditationInviteAnalysis =
  | { invite: MeditationInviteDetection; reason: null }
  | { invite: null; reason: MeditationInviteMissReason; hasZoomLink: boolean; hasMeditationSignal: boolean };

// Nhận diện link phòng thiền: chấp nhận zoom.us, *.zoom.us, zoom.com.cn và các
// link rút gọn phổ biến (khi tin nhắn đã có tín hiệu "thiền/meditation").
const ZOOM_LINK_REGEX =
  /https?:\/\/[^\s<>"']*(?:zoom\.us|zoom\.com\.cn|zoomgov\.com)\/[^\s<>"']*/i;
const SHORTLINK_REGEX =
  /https?:\/\/(?:bit\.ly|tinyurl\.com|s\.id|rebrand\.ly|cutt\.ly|t\.ly|lnkd\.in|zoom\.link)\/[^\s<>"']+/i;

// Nhãn chủ đề được chấp nhận (mở rộng so với bản cũ chỉ có "Chủ đề"/"Topic").
const MEDITATION_TOPIC_LABEL_REGEX =
  /(?:^|\n)[^\p{L}\n]{0,6}\s*(chủ\s*đề\s*thi[eề]n|chủ\s*đề|chu\s*de|nội\s*dung|noi\s*dung|đề\s*tài|de\s*tai|topic|subject|theme)\s*[:：\-–—]\s*([^\n]+)/iu;

function fallbackMeditationTopic(rawText: string, zoomLink: string): string {
  // Không có nhãn: lấy dòng văn bản "có nghĩa" dài nhất phía TRÊN link Zoom.
  const linkIndex = zoomLink ? rawText.indexOf(zoomLink) : -1;
  const head = linkIndex > 0 ? rawText.slice(0, linkIndex) : rawText;
  const candidates = head
    .split("\n")
    .map((line) => cleanMeditationTopic(line))
    .filter((line) => {
      if (line.length < 8 || line.length > 300) return false;
      if (/https?:\/\//i.test(line)) return false;
      // Bỏ dòng chỉ chứa giờ/ngày/ID/passcode.
      if (/^(?:th[oờ]i\s*gian|time|ngày|date|id|meeting\s*id|passcode|mật\s*khẩu|link)\b/i.test(line)) return false;
      if (/^[\d\s:./+\-]+$/.test(line)) return false;
      return /\p{L}{3,}/u.test(line);
    });
  if (!candidates.length) return "";
  return candidates.sort((a, b) => b.length - a.length)[0];
}

export function analyzeMeditationInvite(message: TelegramMessage): MeditationInviteAnalysis {
  const rawText = stripTelegramHtmlForDetection(extractText(message));
  if (!rawText) {
    return { invite: null, reason: "no_text", hasZoomLink: false, hasMeditationSignal: false };
  }

  const urls = extractUrls(message);
  const hasMeditationSignal = /zoom\s*thi[eề]n|thi[eề]n|meditation|thi\s*ền/i.test(rawText);

  let zoomLink = rawText.match(ZOOM_LINK_REGEX)?.[0]
    ?? urls.find((url) => ZOOM_LINK_REGEX.test(url))
    ?? "";
  if (!zoomLink && hasMeditationSignal) {
    zoomLink = rawText.match(SHORTLINK_REGEX)?.[0]
      ?? urls.find((url) => SHORTLINK_REGEX.test(url))
      ?? "";
  }
  if (!zoomLink) {
    return { invite: null, reason: "no_zoom_link", hasZoomLink: false, hasMeditationSignal };
  }
  if (!hasMeditationSignal) {
    return { invite: null, reason: "no_meditation_signal", hasZoomLink: true, hasMeditationSignal };
  }

  const topicMatch = rawText.match(MEDITATION_TOPIC_LABEL_REGEX);
  let topic = cleanMeditationTopic(topicMatch?.[2] ?? "");
  if (!topic || topic.length < 4) {
    topic = fallbackMeditationTopic(rawText, zoomLink);
  }
  if (!topic || topic.length < 4) {
    return { invite: null, reason: "no_topic", hasZoomLink: true, hasMeditationSignal };
  }

  // Language of the invite frame: if the label is English "TOPIC" AND the
  // caption also uses English framing ("ZOOM MEDITATION", "TIME", "TOPIC"),
  // treat the invite as English even when the topic phrase itself is Vietnamese
  // (Angel will summarize/translate in English). Otherwise fall back to
  // language of the topic string itself.
  const label = (topicMatch?.[1] ?? "").toLowerCase().replace(/\s+/g, "");
  const englishFrame =
    (label === "topic" || label === "subject" || label === "theme")
    && /zoom\s*meditation|meditation/i.test(rawText)
    && !/chủ\s*đề|chu\s*de/i.test(rawText);
  const language: MeditationSummaryLanguage = englishFrame
    ? "en"
    : detectMeditationTopicLanguage(topic);

  return {
    invite: {
      topic: topic.slice(0, 500),
      zoomLink,
      rawText: rawText.slice(0, 4000),
      language,
    },
    reason: null,
  };
}

export function detectMeditationInvite(message: TelegramMessage): MeditationInviteDetection | null {
  return analyzeMeditationInvite(message).invite;
}

/**
 * Tin nhắn "trông như" lời mời thiền (có link phòng + tín hiệu thiền) nhưng
 * chưa đủ điều kiện tóm tắt. Dùng để CHẶN luồng AI chung trả lời sai kiểu
 * "Angel không truy cập được đường link".
 */
export function looksLikeMeditationInvite(message: TelegramMessage): boolean {
  const analysis = analyzeMeditationInvite(message);
  if (analysis.invite) return true;
  return analysis.hasZoomLink && analysis.hasMeditationSignal;
}



function normalizeHost(url: string): string | null {
  try {
    const parsed = new URL(url.startsWith("www.") ? `https://${url}` : url);
    return parsed.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function hasTelegramInvite(text: string, urls: string[]): boolean {
  const haystack = `${text} ${urls.join(" ")}`.toLowerCase();
  return /(t\.me|telegram\.me)\/(?:joinchat|\+|addstickers|c\/)/i.test(haystack);
}

export function hasUntrustedUrl(urls: string[], whitelist: string[]): string | null {
  for (const url of urls) {
    const host = normalizeHost(url);
    if (!host) continue;
    const allowed = whitelist.some((domain) => {
      const normalized = domain.replace(/^https?:\/\//, "").replace(/^www\./, "").toLowerCase();
      return host === normalized || host.endsWith(`.${normalized}`) || url.toLowerCase().includes(normalized);
    });
    if (!allowed) return host;
  }
  return null;
}

export function hasMedia(message: TelegramMessage): boolean {
  return Boolean(message.photo || message.video || message.document || message.animation);
}

/**
 * Loại bỏ URL khỏi text trước khi quét keyword đen.
 * Tránh false-positive kiểu slug Facebook `1SExkz19Zd` khớp với "sex".
 */
export function stripUrlsForKeyword(input: string): string {
  if (!input) return "";
  return input
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/\bwww\.[^\s]+/gi, " ")
    .replace(/\b(?:t|telegram)\.me\/\S+/gi, " ")
    .replace(/\b[a-z0-9-]+(?:\.[a-z0-9-]+){1,}\/[^\s]*/gi, " ");
}

export function findBlockedKeyword(text: string, keywords: Array<{ keyword: string; severity: string }>) {
  const lower = stripUrlsForKeyword(text).toLowerCase();
  return keywords.find((entry) => lower.includes(entry.keyword)) ?? null;
}

// Allowlist các bot Telegram chính thống thường được nhắc trong nhóm.
const FOREIGN_BOT_ALLOWLIST = new Set<string>([
  "botfather",
  "safeguardrobot",
  "safeguard",
  "combot",
  "missrose_bot",
  "groupanonymousbot",
  "channel_bot",
]);

/**
 * Tìm mention bot lạ (@xxxbot) khác bot của mình.
 * Trả về username (không có @) đầu tiên match, hoặc null.
 */
export function findForeignBotMention(text: string, ownBotUsername?: string | null): string | null {
  if (!text) return null;
  const own = (ownBotUsername ?? "").toLowerCase().replace(/^@/, "");
  const regex = /@([a-zA-Z0-9_]{3,32}bot)\b/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const uname = match[1].toLowerCase();
    if (own && uname === own) continue;
    if (FOREIGN_BOT_ALLOWLIST.has(uname)) continue;
    return uname;
  }
  return null;
}

const CJK_PROMO_PATTERNS: RegExp[] = [
  // Gambling / lottery
  /红单/, /收米/, /包赢/, /稳赢/, /足球推荐/, /世界杯.*推荐/,
  /博彩/, /彩票/, /赌/, /棋牌/, /真人/, /娱乐城/,
  // Farming / fake orders (刷单 scam family)
  /刷单/, /刷礼物/, /刷礼/, /刷流水/, /刷量/, /刷分/, /刷信誉/,
  /帮刷礼物/, /刷礼物赚钱/, /进直播间.{0,8}刷礼物/, /直播间.{0,8}刷礼物/, /负责充值/,
  /抖音.{0,12}(刷|礼物|赚钱|日入|捡钱|项目)/, /快手.{0,12}(刷|礼物|赚钱|日入|捡钱|项目)/,
  /(抖音|快手).{0,8}(来捡钱|刷礼物赚钱|帮刷礼物)/,
  // Quick-money lure
  /日赚/, /日入/, /日收/, /月入/, /月赚/, /天天收/, /躺赚/, /挂机赚/, /挂机.*收/,
  /日入\s*\d+\+?/i, /利润\s*\d+.{0,4}一次/i, /主页利润\s*\d+/i, /一个号赚\s*\d+\s*u/i,
  /零风险/, /简单好做/, /来捡钱/,
  /收益/, /见收益/, /见米/, /马上.*收益/, /马上.*见/,
  // Order / follow-the-leader scams
  /一单/, /单子/, /带单/, /跟单/, /带飞/, /带你.*赚/, /带你.*飞/, /做单/,
  /做单联系/, /日入\s*\d+.{0,6}项目/i, /公群担保/, /担保.{0,8}(项目|做单|日入|收益|U|USDT)/i,
  // Money amounts (Chinese formal numerals + USDT)
  /伍佰/, /壹佰/, /贰佰/, /叁佰/, /陆佰/, /柒佰/, /捌佰/, /玖佰/, /仟/, /万U/, /U.*单/, /USDT.*单/,
  /赚\s*\d+\s*u/i, /\d+\s*u.{0,6}(日入|项目|做单|刷礼物)/i, /纯\s*bc\s*资/i, /bc资/i,
  // Contact-off-platform lure
  /加我微信/, /加微信/, /加.{0,3}微/, /加.{0,3}TG/, /加.{0,3}Telegram/i, /私聊/, /详聊/, /进群/,
  /账号不需要实名/, /不需要实名/, /不要实名/, /不实名/,
  // Job / part-time scams
  /兼职/, /招商/, /代理/, /招聘.{0,5}兼职/, /日结/, /时结/, /高薪/,
  // Illegal goods — spy cameras / hidden recording (hotel pinhole scam)
  /针孔/, /摄像头/, /偷拍/, /偷装/, /隐秘点位/, /隐蔽安装/,
  /酒店.{0,6}(偷拍|安装|针孔|摄像)/,
  // Money laundering — 代收 / 白资 / 色资 / 包资 / off-platform payment lures
  /代收/, /资金代收/, /白资/, /色资/, /包资/, /黑资/, /洗(米|U|钱)/,
  /口令.{0,4}(支付|结账|U|USDT)/i, /支付宝.{0,6}(报备|代收|结账|提前)/,
  /优先.{0,3}(U|USDT|口令)/i,
  // Project / 风口 / 稳赚 hooks
  /项目.{0,4}(风口|新风口|稳定|稳赚)/, /稳赚/, /包赚/, /包回本/,
  /最稳定.{0,4}(项目|日入|日赚)/,
  // New variants (2026 mention-bait scam family)
  /新橡木/, /新项目\s*20\d{2}/, /全新项目\s*20\d{2}/,
  /工资.{0,4}一单一单/, /一单一单结算/,
  /一单一结算/, /工资.{0,4}一单一结/, /单.{0,2}结算/,
  /充值.{0,6}(抖音|快手|直播间|抖币|币).{0,8}刷礼物/,
  /抖币/, /充值抖币/, /我们充值.{0,8}你们/,
  /进直播间.{0,6}(刷|送).{0,4}礼物/,
  /全程担保.{0,6}(单|放心做|收米)/, /担保做单/, /放心做单/,
  /礼物代刷/, /代刷礼物/,
  /有执行力的来/, /有执行力/,
  /每天收入\s*\d{3,}/, /(每天|日|月)收入\s*\d{3,}\s*\+?/,
  /稳定赚钱包.{0,3}(不按头|不按|按头)/, /赚钱包不按头/, /不按头/,

  // Payment gateway / API laundering (2026 "情义支付 / 三方通道 / 充U" family)
  /情义支付/, /api.{0,6}自动化对接/i, /自动化对接/,
  /三方通道/, /多家.{0,4}三方通道/, /通道.{0,6}下发/, /下发.{0,6}(通道|U|USDT)/i,
  /充\s*U\b/i, /充U.{0,8}(通道|下发|代收|商户)/i,
  /高频业务/, /(极低|超低).{0,3}费率/, /欢迎.{0,4}(商户|入驻)/, /商户入驻/,
  /贴群/, /贴群.{0,4}手动/,
  /api.{0,4}接口.{0,6}(集成|对接)/i, /无缝集成/,
  /联系.{0,4}(对接|商务)/,
  // Payment-agent laundering v2 (2026 "代付 / 备付金 / 情义支付" family)
  /代付业务/, /商户代付/, /代付服务/, /代付需求/, /代付方案/, /代付支持/,
  /备付金/, /备付金下发/, /备付金服务/, /安全发备付金/, /发备付金/,
  /(商户|通道).{0,6}业务对接/, /业务对接.{0,6}(商户|通道|支持)/,
  /三方通道资源/, /通道资源匹配/, /多类三方通道/,
  /商务协助/, /咨询合作/,
  /商务咨询.{0,10}(代付|支付|情义|通道|备付)/,
  /(情义|支付|代付).{0,6}官方频道/,
  // Social-proof seeding chatter (2026 "加鸡腿 / 五五分账" family)
  /[五六七八九三二]{1,2}[五六七八九三二]{1,2}分账/, /分账合作/, /分成合作/,
  /比银行.{0,4}(香|强|好)/, /香\s*(万|千|百)\s*倍/,
  /加鸡腿/, /失误也能搞/, /失误.{0,4}也能/,
  /带你飞/, /跟我做/, /跟着我.{0,4}(做|干|吃肉)/,
  /无门槛/, /门槛低.{0,6}(收益|回本|赚)/,
  /(今天|昨天|这波).{0,6}(又|再).{0,4}(赚|收|进|出)/,
];

/**
 * Phát hiện spam quảng cáo CJK (cờ bạc / kiếm tiền nhanh / farming).
 * Cần ≥ 1 ký tự CJK và match ít nhất 1 pattern.
 */
export function looksLikeCjkPromo(text: string): boolean {
  if (!text) return false;
  const cjkMatches = text.match(/[\u4e00-\u9fff]/g);
  if (!cjkMatches || cjkMatches.length < 1) return false;
  return CJK_PROMO_PATTERNS.some((re) => re.test(text));
}

/** Câu chào / xã giao tiếng Trung lành tính — không tính là chatter đáng ngờ. */
const CJK_BENIGN_SHORT = [
  "你好", "您好", "大家好", "谢谢", "感谢", "早安", "晚安", "晚上好", "早上好",
  "再见", "好的", "收到", "恭喜", "加油", "辛苦了", "新年快乐",
];

/**
 * Phát hiện "CJK chatter" trong nhóm không dùng tiếng Trung:
 * tin rất ngắn, gần như toàn ký tự Hán, không link/mention — mẫu mồi
 * social-proof của các nhóm 刷单/代付 (vd: "今天要加鸡腿咯", "比银行香万倍").
 *
 * Một tin đơn lẻ KHÔNG đủ để xử phạt; caller phải cộng dồn strike.
 */
export function looksLikeOffLanguageCjkChatter(text: string): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 30) return false;

  const cjk = trimmed.match(/[\u4e00-\u9fff]/g);
  if (!cjk || cjk.length < 3) return false;

  // Bỏ ký tự trắng, emoji, dấu câu, số → phần "chữ" thực sự.
  const letters = trimmed.replace(/[\s\d\p{P}\p{S}]/gu, "");
  if (!letters) return false;
  const cjkRatio = cjk.length / letters.length;
  if (cjkRatio < 0.7) return false;

  // Có chữ Latin/Việt đáng kể → là tin song ngữ bình thường.
  if (/[a-zA-ZÀ-ỹ]{4,}/.test(trimmed)) return false;

  const stripped = trimmed.replace(/[\s\p{P}\p{S}]/gu, "");
  if (CJK_BENIGN_SHORT.some((w) => stripped === w || stripped === `${w}咯` || stripped === `${w}啊`)) {
    return false;
  }
  return true;
}

/**
 * Đếm số tín hiệu prelude cùng loại của user trong group trong `windowMinutes`.
 */
export async function countSpamPrelude(params: {
  adminClient: SupabaseClient;
  groupId: number;
  userId: number;
  kind: string;
  windowMinutes?: number;
}): Promise<number> {
  try {
    const windowMin = params.windowMinutes ?? 1440;
    const since = new Date(Date.now() - windowMin * 60_000).toISOString();
    const { count, error } = await params.adminClient
      .from("telegram_spam_prelude")
      .select("id", { count: "exact", head: true })
      .eq("group_id", params.groupId)
      .eq("user_id", params.userId)
      .eq("kind", params.kind)
      .gte("created_at", since);
    if (error) throw error;
    return count ?? 0;
  } catch (e) {
    console.warn("[countSpamPrelude] failed (non-fatal)", e);
    return 0;
  }
}


// ===== Vietnamese profanity / abuse (chửi tục, xúc phạm) =====
//
// Chuẩn hoá text trước khi match để bắt cả biến thể né filter:
//   "đ.ị.t", "d1t", "đmm", "ĐỊT   CON  MẸ", "l0n", "cak"...
export function normalizeVietnameseAbuseText(text: string): string {
  let t = (text || "").toLowerCase();
  t = t.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // bỏ dấu
  t = t.replace(/đ/g, "d");
  t = t.replace(/[0]/g, "o").replace(/[1!|]/g, "i").replace(/[3]/g, "e")
       .replace(/[4@]/g, "a").replace(/[5$]/g, "s").replace(/[7]/g, "t");
  t = t.replace(/[^a-z0-9\s]/g, " "); // bỏ ký tự chèn giữa (. * - _ …)
  t = t.replace(/\s+/g, " ").trim();
  return t;
}

// Cụm chửi thề rõ ràng — match trên text đã normalize + bản bỏ hết khoảng trắng.
const VN_ABUSE_PHRASES: RegExp[] = [
  /\bdit\s?(con\s?)?me\b/, /\bdit\s?me\b/, /\bditmemay\b/, /\bditconmemay\b/,
  /\bdmm?\b/, /\bdcm\b/, /\bdkm\b/, /\bvcl\b/, /\bvkl\b/, /\bclgt\b/,
  /\bcho\s?de\b/, /\bcho\s?chet\b/, /\bsuc\s?vat\b/, /\bmat\s?day\b/,
  /\bthang\s?(cho|ngu|khon|dien|mat\s?day)\b/, /\bcon\s?(cho|dien|ngu|diem|di)\b/,
  /\bdo\s?(cho|ngu|mat\s?day|khon\s?nan|ba\s?do)\b/,
  /\bngu\s?(nhu\s?cho|vl|vcl|nhu\s?bo)\b/,
  /\bcut\s?(di|me|xeo)\b/, /\bim\s?(mom|mieng)\s?di\b/,
  /\bloz?\b\s?\b(me|con)\b/, /\bcai\s?lon\b/, /\bcai\s?cac\b/, /\bcai\s?buoi\b/,
  /\bdu\s?(ma|me|mo)\b/, /\bdu\s?vai\b/, /\bmemay\b/, /\bbome\s?may\b/,
  /\bfuck\s?(you|off|u)\b/, /\bmotherfucker\b/, /\bbitch\b/, /\bcunt\b/,
];

// Từ đơn cực nặng — chỉ tính khi đứng thành từ riêng (tránh false positive
// kiểu "cần", "lộn", "địa"): so trên text đã normalize theo ranh giới từ.
const VN_ABUSE_HARD_WORDS = [
  "dit", "loz", "lon", "cac", "buoi", "cak", "dmm", "dm", "dcm", "vcl", "vl",
];

/**
 * Phát hiện lời lẽ tục tĩu / xúc phạm tiếng Việt (và vài từ chửi tiếng Anh).
 * - Cụm chửi (dit con me, do cho, thang ngu...) → chặn ngay.
 * - Từ đơn cực nặng chỉ chặn khi đi kèm đại từ công kích (may, no, con, thang…)
 *   để giảm false positive với từ thường ("lộn", "cần", "buổi").
 */
export function looksLikeVietnameseAbuse(text: string): boolean {
  if (!text) return false;
  const norm = normalizeVietnameseAbuseText(text);
  if (!norm) return false;
  const squashed = norm.replace(/\s+/g, "");

  for (const re of VN_ABUSE_PHRASES) {
    if (re.test(norm) || re.test(squashed)) return true;
  }

  const words = new Set(norm.split(" "));
  const hasHard = VN_ABUSE_HARD_WORDS.some((w) => words.has(w));
  if (!hasHard) return false;

  // Chỉ chặn khi có đại từ/ngữ cảnh công kích đi kèm.
  const attackContext = /\b(may|mi|no|con|thang|me|bo|cha|nha|dm|dmm|dcm|cmm)\b/.test(norm);
  return attackContext;
}



const CJK_ROMANCE_BAIT_PATTERNS: RegExp[] = [
  /眼神.{0,6}(像|如|似).{0,6}(小鹿|鹿|猫|波)/,
  /小鹿.{0,4}(湿|乱撞|乱跳|湿漉)/,
  /湿漉漉/, /湿润润/, /水汪汪/, /水灵灵/,
  /嘴唇.{0,6}(柔软|软|甜|想吻|想咬)/,
  /想.{0,3}(抱抱|亲亲|吻你|被你|靠在你)/,
  /(腰|腿|胸|锁骨|耳垂|脖颈|肌肤).{0,6}(细|软|白|滑|想咬|想摸|心动)/,
  /心动.{0,4}(不已|的感觉|了)/,
  /(撩|宠|哄|疼)我/, /陪我.{0,3}(聊|睡|过夜|一晚)/,
  /一个人.{0,4}(好孤单|好寂寞|睡不着|睡不下)/,
  /姐姐.{0,4}(陪|想|喜欢|疼)你/, /妹妹.{0,4}(陪|想|喜欢|疼)你/,
  /(找|交|处)个.{0,3}(对象|男朋友|男友|哥哥|弟弟)/,
  /(同城|附近).{0,4}(约|见|玩|聊)/,
  /你的(声音|笑容|眼神).{0,8}(像|如|似).{0,8}(风铃|铃铛|叮咚|月光|星星|童话)/,
  /想把你.{0,8}(藏进|放进|写进).{0,8}(童话|童话书|故事|梦|心里|怀里)/,
  /藏进我的.{0,8}(童话书|故事|梦|心里)/,
  /包养/, /干爹/, /甜心/, /sugar.{0,2}(daddy|baby)/i,
];

/**
 * Phát hiện honey-trap / romance bait tiếng Trung.
 * Cần ≥ 4 ký tự CJK + match ít nhất 1 pattern gợi tình điển hình.
 */
export function looksLikeCjkRomanceBait(text: string): boolean {
  if (!text) return false;
  const cjk = text.match(/[\u4e00-\u9fff]/g);
  if (!cjk || cjk.length < 4) return false;
  return CJK_ROMANCE_BAIT_PATTERNS.some((re) => re.test(text));
}

/**
 * Phát hiện spam quảng cáo tiếng Anh (casino / promo code / bonus / giveaway).
 * Yêu cầu ≥ 2 nhóm pattern khớp để giảm false positive.
 */
const LATIN_PROMO_GROUPS: RegExp[][] = [
  // Money lure
  [/\$\s?\d{2,}/, /\b\d{2,}\s?(usd|usdt|\$)\b/i, /\b(take|claim|grab|get|win|earn)\s+\$?\d/i],
  // Promo / bonus / giveaway
  [/\b(promo\s?code|bonus|giveaway|free\s+spin|free\s+chip|deposit\s+bonus|welcome\s+bonus|reward\s+code|coupon|airdrop)\b/i],
  // Casino / betting / trump-cas family
  [/\b(casino|trumpcas|betting|bookmaker|jackpot|roulette|baccarat|bet365|stake|1xbet|pin\s?up|melbet)\b/i, /\bcas(ino)?\.[a-z]{2,}\b/i],
  // Celebration / opening lure
  [/\b(celebrate.*opening|grand\s+opening|launch.*giveaway|everyone\s+(get|gets|claim|receive))\b/i, /\bto\s+celebrate\b/i],
  // Go-to-link lure
  [/\b(go\s+to|visit|click|check)\s+(https?:\/\/|www\.|[a-z0-9-]+\.(cc|xyz|top|click|win|bet|casino|vip))/i, /\btake\s+(your\s+)?bonus\b/i],
];

export function looksLikeLatinPromo(text: string, opts: { minGroups?: number } = {}): boolean {
  if (!text) return false;
  const minGroups = Math.max(1, opts.minGroups ?? 2);
  let groupsMatched = 0;
  for (const group of LATIN_PROMO_GROUPS) {
    if (group.some((re) => re.test(text))) groupsMatched++;
    if (groupsMatched >= minGroups) return true;
  }
  return false;
}

export function looksLikeCardingStorePromo(text: string): boolean {
  if (!text) return false;
  const hasCcStore = /\bcc\s*(store|shop|market|marketplace)\b/i.test(text);
  if (!hasCcStore) return false;

  const supportSignals = [
    /\b(best\s+)?cc\s*(store|shop)\b/i,
    /\b(update|upload|add)\s+(a\s+)?(large\s+amount\s+of\s+)?(content|data|base|database)\s+daily\b/i,
    /\b(content|data|base|database)\s+daily\b/i,
    /\b(us|ca|au|sg|th|ph|tw|jp|ch|tr|es|it|hk)\b(?:[,\s]+(?:us|ca|au|sg|th|ph|tw|jp|ch|tr|es|it|hk)\b){3,}/i,
    /@[a-zA-Z0-9_]{4,32}\b/,
    /\b(cvv|fullz|dump|dumps|carding|bins?|fresh\s+cc|valid\s+cc)\b/i,
  ];

  return supportSignals.filter((re) => re.test(text)).length >= 2;
}

/** Chuẩn hoá text để bắt các biến thể né tránh (giãn ký tự, thay số, emoji). */
function normalizeAccountShopText(text: string): string {
  let out = text.toLowerCase();
  out = out.replace(/[\p{S}]/gu, " ");
  // acc0unt → account, 0tp → otp
  out = out.replace(/0/g, "o").replace(/1/g, "i").replace(/3/g, "e").replace(/\$/g, "s");
  // gộp chuỗi ký tự đơn cách nhau: "a c c o u n t s" → "accounts"
  out = out.replace(/\b(?:[a-z]\s+){2,}[a-z]\b/g, (m) => m.replace(/\s+/g, ""));
  out = out.replace(/[.\-_*·•]+/g, "");
  out = out.replace(/\s+/g, " ").trim();
  return out;
}

/** Nhóm 1: mặt hàng — bán tài khoản / số ảo / OTP. */
const ACCOUNT_SHOP_GOODS: RegExp[] = [
  /\b(tg|telegram|whatsapp|wa|gmail|google|instagram|ig|facebook|fb|twitter|x|discord|tiktok|zalo)\s*(voice\s*)?(accounts?|accs?|acc)\b/,
  /\bmillions?\s+of\s+accounts?\b/,
  /\b(aged|verified|fresh|old|new|bulk)\s+(accounts?|accs?)\b/,
  /\btdata\b/,
  /\bsession\s*(file|files)\b/,
  /\bvirtual\s*(phone\s*)?numbers?\b/,
  /\b(sms|otp)\s*(service|code|codes|verification)\b/,
  /\bnon\s*voip\s*numbers?\b/,
  /\bban[ ]?acc\b|\bban\s+t[aà]i\s+kho[aả]n\b|\bsim\s+[aả]o\b|\bcode\s+otp\b|\bthu[eê]\s+sim\b/,
];

/** Nhóm 2: lời chào hàng kiểu shop. */
const ACCOUNT_SHOP_PITCH: RegExp[] = [
  /\brestock(ed|ing)?\b/,
  /\b(guaranteed\s+)?(lowest|cheapest|best)\s+price(s)?\b/,
  /\bin\s+stock\b/,
  /\b(bulk|wholesale|retail)\b/,
  /\bauto(mated|matic)?\s*(restock|delivery|deliver)\b/,
  /\b24\s*\/?\s*7\b/,
  /\b#?\s*1\s+choice\b/,
  /\b(dm|pm|inbox|message)\s+(me|us)\s+to\s+(buy|order)\b/,
  /\bgi[aá]\s+r[eẻ]\s+nh[aấ]t\b|\bs[iỉ]\s*l[eẻ]\b|\bh[aà]ng\s+s[aẵ]n\b/,
];

/** Nhóm 3: chốt kèo — kéo nạn nhân ra ngoài. */
const ACCOUNT_SHOP_CONTACT: RegExp[] = [
  /@[a-z0-9_]{4,32}\b/,
  /\b(?:t|telegram)\.me\//,
  /\bfind\s+us\s+at\b/,
  /\b(contact|order|buy)\s+(here|now|at)\b/,
];

/** Khẩu hiệu quảng cáo shop (storefront blast). */
const ACCOUNT_SHOP_SLOGANS: RegExp[] = [
  /\bsimple[, ]+fast[, &]+secure\b/,
  /\byour\s+#?\s*1\s+choice\b/,
  /\bguaranteed\b/,
  /\bstore\b|\bshop\b|\bmarket(place)?\b/,
];

/**
 * Phát hiện quảng cáo bán tài khoản Telegram / số ảo / OTP hàng loạt
 * (vd: "BUBU Store — TG Accounts, millions available, 24/7 restock, @LBot").
 * Trả về "strong" khi chắc chắn, "weak" khi chỉ có 1 nhóm + chốt kèo.
 */
export function detectAccountShopPromo(text: string): "strong" | "weak" | null {
  if (!text) return null;
  const norm = normalizeAccountShopText(text);
  if (!norm || norm.length < 12) return null;

  const goods = ACCOUNT_SHOP_GOODS.some((re) => re.test(norm));
  const pitchHits = ACCOUNT_SHOP_PITCH.filter((re) => re.test(norm)).length;
  const contact = ACCOUNT_SHOP_CONTACT.some((re) => re.test(norm));

  if (goods && pitchHits >= 1) return "strong";

  // Storefront blast: nhiều dòng ngắn + khẩu hiệu + handle liên hệ.
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const sloganHits = ACCOUNT_SHOP_SLOGANS.filter((re) => re.test(norm)).length;
  const storefront = lines.length >= 3 && sloganHits >= 2 && contact;

  if (goods && (contact || storefront)) return "weak";
  if (pitchHits >= 2 && storefront) return "weak";
  return null;
}

export function looksLikeAccountShopPromo(text: string): boolean {
  return detectAccountShopPromo(text) !== null;
}


/**
 * Phát hiện URL có TLD đáng ngờ (casino/spam thường dùng) không nằm trong whitelist.
 */
const SUSPICIOUS_TLDS = new Set([
  "cc", "xyz", "top", "click", "win", "bet", "casino", "vip", "work", "gq", "tk", "ml", "cf", "loan", "country", "stream",
]);

export function hasSuspiciousTld(urls: string[], whitelist: string[]): string | null {
  const wl = whitelist.map((d) => d.replace(/^https?:\/\//, "").replace(/^www\./, "").toLowerCase());
  for (const url of urls) {
    try {
      const u = new URL(url.startsWith("www.") ? `https://${url}` : url);
      const host = u.hostname.toLowerCase().replace(/^www\./, "");
      const tld = host.split(".").pop() || "";
      if (!SUSPICIOUS_TLDS.has(tld)) continue;
      const allowed = wl.some((d) => host === d || host.endsWith(`.${d}`));
      if (!allowed) return host;
    } catch {
      // ignore
    }
  }
  return null;
}

/**
 * CJK (≥1 ký tự) + mention bot lạ → gần như chắc chắn là spam.
 */
export function isCjkPlusForeignBot(text: string, ownBotUsername?: string | null): boolean {
  if (!text) return false;
  if (!/[\u4e00-\u9fff]/.test(text)) return false;
  return findForeignBotMention(text, ownBotUsername) !== null;
}

/**
 * CJK (≥2 ký tự) + @mention bất kỳ user → dấu hiệu scam farming (rủ "刷 quà / 跟单").
 * Bỏ qua mention chính bot của mình.
 */
export function isCjkPlusUserMention(text: string, ownBotUsername?: string | null): boolean {
  if (!text) return false;
  const cjk = text.match(/[\u4e00-\u9fff]/g);
  if (!cjk || cjk.length < 2) return false;
  const own = (ownBotUsername ?? "").toLowerCase().replace(/^@/, "");
  const re = /@([a-zA-Z0-9_]{3,32})\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const u = m[1].toLowerCase();
    if (own && u === own) continue;
    return true;
  }
  return false;
}

/**
 * Phát hiện tin nhắn "mention-bait": chỉ chứa ≥2 mention @xxxbot lạ,
 * không có nội dung thực (sau khi strip mention chỉ còn ≤5 ký tự / emoji / dấu chấm).
 * Mẫu quan sát: `@aoqaambot @akaozbot @qoanqqbot` — mồi để câu thông báo trước khi
 * user rác gửi tin quảng cáo/scam chính.
 */
export function looksLikeMentionBait(text: string, ownBotUsername?: string | null): boolean {
  if (!text) return false;
  const own = (ownBotUsername ?? "").toLowerCase().replace(/^@/, "");
  const botMentionRe = /@([a-zA-Z0-9_]{3,32}bot)\b/gi;
  const foreignBots = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = botMentionRe.exec(text)) !== null) {
    const uname = m[1].toLowerCase();
    if (own && uname === own) continue;
    if (FOREIGN_BOT_ALLOWLIST.has(uname)) continue;
    foreignBots.add(uname);
  }
  if (foreignBots.size < 2) return false;

  // Strip all @mentions (bot hay không) + khoảng trắng + emoji/punctuation.
  const stripped = text
    .replace(/@[a-zA-Z0-9_]{3,32}\b/g, " ")
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, " ")
    .replace(/[\s.,!?…·•\-–—:;"'“”‘’()\[\]]/g, "")
    .trim();
  return stripped.length <= 5;
}

/**
 * Ghi lại một tín hiệu mồi (mention_bait...) để escalate ban nếu user gửi tiếp
 * tin scam trong khoảng thời gian gần.
 */
export async function recordSpamPrelude(params: {
  adminClient: SupabaseClient;
  groupId: number;
  userId: number;
  kind: string;
  messageId?: number | null;
}): Promise<void> {
  try {
    await params.adminClient.from("telegram_spam_prelude").insert({
      group_id: params.groupId,
      user_id: params.userId,
      kind: params.kind,
      message_id: params.messageId ?? null,
    });
  } catch (e) {
    console.warn("[recordSpamPrelude] failed (non-fatal)", e);
  }
}

/**
 * Kiểm tra user này có tín hiệu mồi trong `windowMinutes` gần đây trong cùng group không.
 */
export async function hasRecentSpamPrelude(params: {
  adminClient: SupabaseClient;
  groupId: number;
  userId: number;
  kind?: string;
  windowMinutes?: number;
}): Promise<boolean> {
  try {
    const windowMin = params.windowMinutes ?? 10;
    const since = new Date(Date.now() - windowMin * 60_000).toISOString();
    let q = params.adminClient
      .from("telegram_spam_prelude")
      .select("id", { count: "exact", head: true })
      .eq("group_id", params.groupId)
      .eq("user_id", params.userId)
      .gte("created_at", since);
    if (params.kind) q = q.eq("kind", params.kind);
    const { count, error } = await q;
    if (error) throw error;
    return (count ?? 0) > 0;
  } catch (e) {
    console.warn("[hasRecentSpamPrelude] failed (non-fatal)", e);
    return false;
  }
}



export async function upsertUserState(params: {
  adminClient: SupabaseClient;
  groupId: number;
  user: TelegramUser;
  joinedAt?: string;
}) {
  if (!params.user.id) return null;

  const nowIso = new Date().toISOString();
  const { data, error } = await params.adminClient
    .from("telegram_community_user_state")
    .upsert(
      {
        group_id: params.groupId,
        telegram_user_id: params.user.id,
        username: params.user.username ?? null,
        full_name: fullName(params.user),
        joined_at: params.joinedAt ?? nowIso,
      },
      { onConflict: "group_id,telegram_user_id" },
    )
    .select("*")
    .single();

  if (error) {
    console.warn("[telegram-community] upsert user state failed", { error_code: error.code ?? "unknown" });
    return null;
  }
  return data;
}

export async function updateMessageWindow(adminClient: SupabaseClient, state: {
  id: string;
  message_count_window_start: string;
  message_count: number;
}) {
  const now = Date.now();
  const windowStart = new Date(state.message_count_window_start).getTime();
  const reset = now - windowStart >= 60_000;
  const nextCount = reset ? 1 : state.message_count + 1;
  const nextStart = reset ? new Date(now).toISOString() : state.message_count_window_start;

  const update = await adminClient
    .from("telegram_community_user_state")
    .update({ message_count: nextCount, message_count_window_start: nextStart })
    .eq("id", state.id);
  if (update.error) throw new Error(`message rate state update failed (${update.error.code ?? "unknown"})`);

  return nextCount;
}

export async function isTelegramAdmin(chatId: number, userId: number): Promise<boolean> {
  const result = await getChatMember(chatId, userId);
  const check = resolveTelegramAdminCheck({
    ok: result.ok,
    status: result.data?.result?.status,
    error_code: result.data?.error_code,
  });
  if (!check.verified) throw new Error(`Telegram admin status could not be verified (${check.errorCode})`);
  return check.isAdmin;
}

export async function logModeration(adminClient: SupabaseClient, params: {
  groupId: number;
  userId?: number | null;
  username?: string | null;
  action: string;
  reason: string;
  messageText?: string | null;
  messageId?: number | null;
}): Promise<{ ok: boolean; errorCode?: string }> {
  const { error } = await adminClient.from("telegram_community_moderation_logs").insert({
    group_id: params.groupId,
    telegram_user_id: params.userId ?? null,
    username: params.username ?? null,
    action: params.action,
    reason: params.reason,
    message_text: params.messageText?.slice(0, 500) ?? null,
    message_id: params.messageId ?? null,
  });
  if (error) {
    console.error("[telegram-community] moderation log insert failed", {
      action: params.action,
      group_id: params.groupId,
      code: error.code ?? null,
    });
    return { ok: false, errorCode: error.code ?? "unknown" };
  }
  return { ok: true };
}

// ─── Bilingual moderation notice ─────────────────────────────────────────────

function detectKeywordLanguage(kw: string): string {
  if (!kw) return "Other";
  if (/[\u3040-\u309f\u30a0-\u30ff]/.test(kw)) return "Japanese";
  if (/[\uac00-\ud7af]/.test(kw)) return "Korean";
  if (/[\u4e00-\u9fff]/.test(kw)) return "Chinese";
  if (/[\u0400-\u04ff]/.test(kw)) return "Russian";
  if (/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(kw)) return "Vietnamese";
  return "Other";
}

type ModerationKeywordRow = {
  language: string | null;
  meaning_en: string | null;
  meaning_vi: string | null;
  risk_note_en: string | null;
  risk_note_vi: string | null;
};

const DEFAULT_REASON_EN: Record<string, string> = {
  blocked_keyword: "Commonly used in spam, scam, fake investment, and get-rich-quick promotions.",
  foreign_bot_mention: "Mention of an external/foreign bot — often used for spam routing.",
  cjk_plus_foreign_bot: "Mixed CJK text with a foreign bot mention — typical scam pattern.",
  cjk_plus_user_mention: "Mixed CJK promo content tagging users — typical scam pattern.",
  cjk_gambling_promo: "Looks like CJK gambling or get-rich-quick promotion.",
  automated_cjk_scam: "Automated bot posted a CJK get-rich-quick scam or deceptive promotion.",
  cjk_romance_bait: "Chinese romance-bait message — typical honey-trap scam pattern.",
  cjk_chatter_seeding: "Repeated short Chinese chatter in a non-Chinese group — scam social-proof seeding.",
  latin_gambling_promo: "Looks like gambling / get-rich-quick promotion.",
  latin_gambling_promo_container: "High-risk container (poll/forward/checklist) with promo content.",
  suspicious_tld: "Suspicious top-level domain often abused by scammers.",
  message_rate_limit: "Sending too many messages in a short period (spam flooding).",
  mention_bait: "Message tags multiple unknown bots with no real content — classic spam bait to trigger notifications before a scam follow-up.",
  scam_escalation: "User posted spam/scam content shortly after mention-bait — coordinated spam pattern.",
};
const DEFAULT_REASON_VI: Record<string, string> = {
  blocked_keyword: "Thường xuất hiện trong tin spam, lừa đảo, đầu tư ảo, làm giàu nhanh.",
  foreign_bot_mention: "Nhắc đến bot lạ — thường dùng để dẫn dắt spam.",
  cjk_plus_foreign_bot: "Văn bản CJK kèm mention bot lạ — mẫu lừa đảo điển hình.",
  cjk_plus_user_mention: "Quảng cáo CJK kèm tag user — mẫu lừa đảo điển hình.",
  cjk_gambling_promo: "Có dấu hiệu quảng cáo cờ bạc/làm giàu nhanh tiếng CJK.",
  automated_cjk_scam: "Bot tự động phát tán quảng cáo CJK lừa đảo hoặc dụ làm giàu nhanh.",
  cjk_romance_bait: "Tin nhắn mồi tán tỉnh tiếng Trung — mẫu honey-trap scam điển hình.",
  cjk_chatter_seeding: "Nhiều tin tiếng Trung ngắn lặp lại trong nhóm tiếng Việt — mồi tạo bằng chứng giả của nhóm lừa đảo.",
  latin_gambling_promo: "Có dấu hiệu quảng cáo cờ bạc / làm giàu nhanh.",
  latin_gambling_promo_container: "Container rủi ro cao (poll/forward/checklist) chứa nội dung quảng cáo.",
  suspicious_tld: "Tên miền cấp cao đáng ngờ, thường bị lạm dụng để lừa đảo.",
  message_rate_limit: "Gửi quá nhiều tin trong thời gian ngắn (spam flood).",
  mention_bait: "Tin chỉ tag nhiều bot lạ mà không có nội dung — mồi câu thông báo trước khi rải scam.",
  scam_escalation: "Gửi nội dung scam ngay sau bước mồi mention-bait — mẫu spam có chủ ý.",
};

function ruleCodeFromReason(reason: string): string {
  return reason.split(":")[0]?.trim() || "other";
}

// (escapeHtml is exported above at line ~506)

function formatModerationNotice(args: {
  label: string;
  warningCount: number;
  warningMax: number;
  reason: string;
  keywordRow?: ModerationKeywordRow | null;
  rawKeyword?: string | null;
}): string {
  const ruleCode = ruleCodeFromReason(args.reason);
  const reasonEn = args.keywordRow?.risk_note_en
    ?? DEFAULT_REASON_EN[ruleCode]
    ?? "Removed by Community Guard.";
  const reasonVi = args.keywordRow?.risk_note_vi
    ?? DEFAULT_REASON_VI[ruleCode]
    ?? "Đã bị Community Guard gỡ.";

  const lines: string[] = [];
  lines.push(`⚠️ <b>Message Removed</b>`);
  lines.push(`👤 ${escapeHtml(args.label)} · Warning ${args.warningCount}/${args.warningMax}`);
  lines.push("");

  if (ruleCode === "blocked_keyword" && args.rawKeyword) {
    const kw = args.rawKeyword;
    const language = args.keywordRow?.language || detectKeywordLanguage(kw);
    const meaningEn = args.keywordRow?.meaning_en ?? "(no translation available)";
    lines.push(`🔑 <b>Blocked:</b> <code>${escapeHtml(kw)}</code>`);
    lines.push(`🌐 Language: ${escapeHtml(language)}`);
    lines.push(`🇬🇧 English: ${escapeHtml(meaningEn)}`);
  } else {
    lines.push(`🔑 <b>Rule:</b> <code>${escapeHtml(args.reason)}</code>`);
  }

  lines.push("");
  lines.push(`❗ <b>Reason:</b> ${escapeHtml(reasonEn)}`);
  lines.push("");
  lines.push(`🤖 Auto-removed by Community Guard. Reply to this message or mention the bot to ask Angel AI.`);
  return lines.join("\n");
}

export async function applyViolation(params: {
  adminClient: SupabaseClient;
  settings: CommunitySettings;
  chatId: number;
  messageId: number;
  user: TelegramUser;
  reason: string;
  messageText: string;
  keywordRow?: ModerationKeywordRow | null;
  rawKeyword?: string | null;
  countWarning?: boolean;
}) {
  const userId = params.user.id;
  if (!userId) return;

  const state = await upsertUserState({
    adminClient: params.adminClient,
    groupId: params.chatId,
    user: params.user,
  });
  if (!state) {
    await logModeration(params.adminClient, {
      groupId: params.chatId,
      userId,
      username: params.user.username ?? null,
      action: "moderation_state_unavailable",
      reason: "warning_count_could_not_be_read_or_created",
      messageId: params.messageId,
    });
  }

  const countWarning = params.countWarning !== false;
  let warningStateAvailable = state !== null;
  let warningCount: number | null = state
    ? (countWarning ? state.warning_count + 1 : state.warning_count)
    : null;
  const nowIso = new Date().toISOString();
  if (countWarning && state && warningCount !== null) {
    const warningUpdate = await params.adminClient
      .from("telegram_community_user_state")
      .update({ warning_count: warningCount })
      .eq("group_id", params.chatId)
      .eq("telegram_user_id", userId);
    const warningStateCheck = warningUpdate.error
      ? null
      : await params.adminClient
        .from("telegram_community_user_state")
        .select("warning_count")
        .eq("group_id", params.chatId)
        .eq("telegram_user_id", userId)
        .maybeSingle();
    if (warningUpdate.error || warningStateCheck?.error || warningStateCheck?.data?.warning_count !== warningCount) {
      warningStateAvailable = false;
      warningCount = null;
      const errorCode = warningUpdate.error?.code ?? warningStateCheck?.error?.code ?? "row_not_updated";
      console.warn("[moderation] warning count update failed", { error_code: errorCode });
      await logModeration(params.adminClient, {
        groupId: params.chatId,
        userId,
        username: params.user.username ?? null,
        action: "moderation_state_update_failed",
        reason: `warning_count:${errorCode}`,
        messageId: params.messageId,
      });
    }
  }

  const deletion = await deleteModerationMessage(params.chatId, params.messageId);
  const deleted = deletion.deleted;
  const deleteErrorCode = deletion.errorCode;

  let banAttempted = false;
  let banSucceeded = false;
  let banErrorCode: number | undefined;
  let muteAttempted = false;
  let muteSucceeded = false;
  let muteErrorCode: number | undefined;
  if (warningStateAvailable && countWarning && warningCount !== null && warningCount >= params.settings.warning_before_ban) {
    banAttempted = true;
    try {
      const result = await banChatMember(params.chatId, userId);
      banSucceeded = result.ok;
      banErrorCode = result.data?.error_code;
      if (banSucceeded) {
        const update = await params.adminClient
          .from("telegram_community_user_state")
          .update({ banned_at: nowIso })
          .eq("group_id", params.chatId)
          .eq("telegram_user_id", userId);
        if (update.error) console.warn("[moderation] banned state update failed", { error_code: update.error.code ?? "unknown" });
      }
    } catch (error) {
      console.warn("[moderation] ban request threw", { error_name: error instanceof Error ? error.name : "unknown" });
    }
  } else if (warningStateAvailable && countWarning && warningCount !== null && warningCount >= params.settings.warning_before_mute) {
    muteAttempted = true;
    const untilUnix = Math.floor(Date.now() / 1000) + params.settings.mute_duration_minutes * 60;
    try {
      const result = await restrictChatMember(params.chatId, userId, untilUnix);
      muteSucceeded = result.ok;
      muteErrorCode = result.data?.error_code;
      if (muteSucceeded) {
        const update = await params.adminClient
          .from("telegram_community_user_state")
          .update({ muted_until: new Date(untilUnix * 1000).toISOString() })
          .eq("group_id", params.chatId)
          .eq("telegram_user_id", userId);
        if (update.error) console.warn("[moderation] muted state update failed", { error_code: update.error.code ?? "unknown" });
      }
    } catch (error) {
      console.warn("[moderation] restrict request threw", { error_name: error instanceof Error ? error.name : "unknown" });
    }
  }

  const action = violationActionOutcome({
    deleted,
    countWarning,
    banAttempted,
    banSucceeded,
    muteAttempted,
    muteSucceeded,
    warningStateAvailable,
  });
  const reasonDetails = [
    params.reason.slice(0, 120),
    !warningStateAvailable ? "warning_state_unavailable" : null,
    !deleted ? `delete_failed:${deleteErrorCode ?? "unknown"}:${deletion.failure}` : null,
    banAttempted && !banSucceeded ? `ban_failed:${banErrorCode ?? "unknown"}` : null,
    muteAttempted && !muteSucceeded ? `mute_failed:${muteErrorCode ?? "unknown"}` : null,
  ].filter(Boolean).join(";").slice(0, 240);
  await logModeration(params.adminClient, {
    groupId: params.chatId,
    userId,
    username: params.user.username ?? null,
    action,
    reason: reasonDetails,
    messageText: params.messageText,
    messageId: params.messageId,
  });

  const label = params.user.username ? `@${params.user.username}` : fullName(params.user);
  if (!deleted) {
    await notifyModerationDeleteFailure(params.adminClient, params.chatId, params.messageId);
  } else if (action === "banned" || action === "banned_message_delete_failed") {
    await sendMessage(params.chatId, `🚫 <b>${escapeHtml(label)}</b> was banned after repeated violations.`);
  } else if (action === "muted" || action === "muted_message_delete_failed") {
    await sendMessage(params.chatId, `🔇 <b>${escapeHtml(label)}</b> was muted for ${params.settings.mute_duration_minutes} minutes after repeated violations.`);
  } else if (action === "deleted_ban_failed" || action === "deleted_mute_failed") {
    await sendMessage(params.chatId, "⚠️ The message was removed, but the follow-up restriction failed. An admin should review it.");
  } else if (action === "deleted_warning_state_unavailable") {
    await sendMessage(params.chatId, "⚠️ The message was removed, but warning history could not be verified. No automatic escalation was attempted.");
  } else if (warningCount === null) {
    await sendMessage(params.chatId, "⚠️ The message was removed, but warning history is unavailable. An admin should review it.");
  } else {
    await sendMessage(
      params.chatId,
      formatModerationNotice({
        label,
        warningCount,
        warningMax: params.settings.warning_before_ban,
        reason: params.reason,
        keywordRow: params.keywordRow ?? null,
        rawKeyword: params.rawKeyword ?? null,
      }),
    );
  }

}

// ─── FUN spiritual content whitelist ─────────────────────────────────────────
// Bài Di Chúc / nội dung tâm linh / cảm tạ FUN không bị moderation xoá nhầm.

function stripDiacriticsCommunity(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

const FUN_BRAND_TERMS_COMMUNITY = [
  "fun.rich", "funrich", "fun profile", "fun ecosystem",
  "cha vu tru", "father universe", "fath uni",
  "be ly", "camly", "em be anh sang", "angel ai",
  "happy cam coin", "love hub", "trung kien",
  "fun kingdom", "vuong quoc anh sang", "lovehub.fun", "lovehub",
  "father universe network", "angel pely", "pure love",
  "fun kingdom foundation", "fun kingdom declaration",
];

const FUN_SPIRITUAL_TERMS_COMMUNITY = [
  "sam hoi", "biet on", "doi on",
  "anh sang", "tu hoc", "tam linh", "di chuc",
  "thuan khiet", "gia ho", "do tri",
  "linh hon", "dang sang tao", "thien y",
  "yeu thuong", "chuyen hoa", "nang luong",
  "em be", "be minh chi", "be dieu ngoc",
  "chi dan", "tu tap", "an lanh",
  "tinh yeu thuan khiet", "thinh vuong vo han",
  "tuyen ngon thanh lap", "vuong quoc", "anh sang 5d",
];

const FUN_OFFICIAL_BRAND_TERMS_COMMUNITY = [
  "fun.rich",
  "funrich",
  "fun profile",
  "fun ecosystem",
  "fun kingdom",
  "lovehub.fun",
  "lovehub",
  "father universe network",
  "father universe",
  "vuong quoc anh sang",
  "angel pely",
];

const FUN_OFFICIAL_CONTEXT_TERMS_COMMUNITY = [
  "tuyen ngon thanh lap",
  "vuong quoc",
  "anh sang",
  "anh sang 5d",
  "pure love",
  "tinh yeu thuan khiet",
  "thinh vuong vo han",
  "yeu thuong",
  "biet on",
  "stewardship",
  "cha vu tru",
  "phung su",
];

/**
 * Bypass moderation cho nội dung tâm linh FUN.
 * - text >= 40 ký tự
 * - brandHits >= 1, hoặc brand+spirit >= 2
 */
export function isFunSpiritualContent(text: string): boolean {
  if (!text || text.length < 40) return false;
  const norm = stripDiacriticsCommunity(text.toLowerCase());
  const brandHits = FUN_BRAND_TERMS_COMMUNITY.filter((t) => norm.includes(t)).length;
  const spiritHits = FUN_SPIRITUAL_TERMS_COMMUNITY.filter((t) => norm.includes(t)).length;
  if (brandHits >= 1) return true;
  return brandHits + spiritHits >= 2;
}

export function isTrustedFunCommunityContent(text: string): boolean {
  if (!text || text.length < 30) return false;
  const norm = stripDiacriticsCommunity(text.toLowerCase());
  const officialHits = FUN_OFFICIAL_BRAND_TERMS_COMMUNITY.filter((term) => norm.includes(term)).length;
  const contextHits = FUN_OFFICIAL_CONTEXT_TERMS_COMMUNITY.filter((term) => norm.includes(term)).length;
  return officialHits >= 2 || (officialHits >= 1 && contextHits >= 1);
}

// ============================================================
// Member tracking — log every join/leave/kick/ban via chat_member updates.
// ============================================================
export type MemberEventInput = {
  chatId: number;
  user: TelegramUser;
  oldStatus?: string;
  newStatus?: string;
  fromActor?: TelegramUser;
  inviteLink?: { invite_link?: string; name?: string };
  occurredAt?: Date;
  metadata?: Record<string, unknown>;
};

export async function logMemberEvent(admin: SupabaseClient, input: MemberEventInput): Promise<MemberEventWriteResult> {
  const { chatId, user } = input;
  if (!chatId || !user?.id || user.is_bot) return { kind: "not_applicable", eventType: null };
  const actorIsSelf = !input.fromActor?.id || input.fromActor.id === user.id;
  const eventType = classifyMemberEventType(input.oldStatus, input.newStatus, actorIsSelf);
  if (!eventType) return { kind: "not_applicable", eventType: null };

  const displayName = fullName(user) || user.username || `id:${user.id}`;
  const occurredAt = (input.occurredAt ?? new Date()).toISOString();

  const row = {
    chat_id: chatId,
    tg_user_id: user.id,
    username: user.username ?? null,
    display_name: displayName,
    event_type: eventType,
    old_status: input.oldStatus ?? null,
    new_status: input.newStatus ?? null,
    invite_link: input.inviteLink?.invite_link ?? null,
    invite_link_name: input.inviteLink?.name ?? null,
    invited_by_tg_id: null as number | null,
    invited_by_username: null as string | null,
    admin_actor_tg_id: !actorIsSelf ? (input.fromActor?.id ?? null) : null,
    admin_actor_username: !actorIsSelf ? (input.fromActor?.username ?? null) : null,
    occurred_at: occurredAt,
    metadata: input.metadata ?? {},
  };

  let writeResult: MemberEventWriteResult;
  if (eventType === "join" || eventType === "rejoined") {
    const { data, error } = await admin.rpc("tg_record_join_event", {
      p_chat_id: chatId,
      p_tg_user_id: user.id,
      p_event_type: eventType,
      p_occurred_at: occurredAt,
      p_row: row,
    });
    const recorded = parseJoinEventRecordResult(data);
    if (error || !recorded) {
      const errorCode = typeof error?.code === "string" ? error.code : "invalid_record_result";
      console.error("[telegram-community] logMemberEvent insert failed", {
        chat_id: chatId,
        error_code: errorCode,
      });
      return { kind: "error", eventType, errorCode };
    }
    writeResult = {
      kind: recorded.inserted ? "inserted" : "duplicate",
      eventType,
      eventId: recorded.id,
      processingStatus: recorded.status,
    };
  } else {
    const { data: insertedRows, error } = await admin
      .from("telegram_member_events")
      .upsert(row, { onConflict: "chat_id,tg_user_id,event_type,occurred_at", ignoreDuplicates: true })
      .select("event_type");
    writeResult = resolveMemberEventWrite(eventType, insertedRows, error);
  }
  if (writeResult.kind === "error") {
    console.error("[telegram-community] logMemberEvent insert failed", {
      chat_id: chatId,
      error_code: writeResult.errorCode,
    });
    return writeResult;
  }
  if (writeResult.kind === "duplicate" || writeResult.kind === "not_applicable") {
    return writeResult;
  }

  // Update invite link rolling stats for joins.
  if ((eventType === "join" || eventType === "rejoined") && row.invite_link) {
    try {
      const statsUpsert = await admin
        .from("telegram_invite_link_stats")
        .upsert(
          {
            chat_id: chatId,
            invite_link: row.invite_link,
            invite_link_name: row.invite_link_name,
            total_joins: 1,
            last_used_at: occurredAt,
          },
          { onConflict: "chat_id,invite_link" },
        );
      if (statsUpsert.error) {
        console.warn("[telegram-community] invite link stats upsert failed", {
          chat_id: chatId,
          error_code: statsUpsert.error.code ?? "unknown",
        });
      } else {
        // Keep optional invite analytics failures separate from the persisted join event.
        const statsLookup = await admin
          .from("telegram_invite_link_stats")
          .select("total_joins")
          .eq("chat_id", chatId)
          .eq("invite_link", row.invite_link)
          .maybeSingle();
        if (statsLookup.error) {
          console.warn("[telegram-community] invite link stats lookup failed", {
            chat_id: chatId,
            error_code: statsLookup.error.code ?? "unknown",
          });
        } else if (statsLookup.data && typeof statsLookup.data.total_joins === "number") {
          const statsUpdate = await admin
            .from("telegram_invite_link_stats")
            .update({ total_joins: statsLookup.data.total_joins + 1, last_used_at: occurredAt, invite_link_name: row.invite_link_name ?? null })
            .eq("chat_id", chatId)
            .eq("invite_link", row.invite_link);
          if (statsUpdate.error) {
            console.warn("[telegram-community] invite link stats update failed", {
              chat_id: chatId,
              error_code: statsUpdate.error.code ?? "unknown",
            });
          }
        }
      }
    } catch (error) {
      console.warn("[telegram-community] invite link stats operation threw", {
        chat_id: chatId,
        error_name: error instanceof Error ? error.name : "unknown",
      });
    }
  }

  // Fire admin alert if enabled.
  try {
    const settings = await getSettingsForGroup(admin, chatId);
    if (settings?.member_alerts_enabled && settings.member_alerts_chat_id) {
      const severity = settings.member_alerts_min_severity ?? "all";
      const isKickBan = eventType === "kicked" || eventType === "banned";
      if (severity === "all" || isKickBan) {
        const label =
          eventType === "join" ? "✅ Member Joined" :
          eventType === "rejoined" ? "🔁 Member Rejoined" :
          eventType === "left" ? "👋 Member Left" :
          eventType === "kicked" ? "🚫 Member Removed" :
          eventType === "banned" ? "⛔ Member Banned" :
          eventType === "unbanned" ? "♻️ Member Unbanned" :
          eventType;
        const actor = row.admin_actor_username ? `@${row.admin_actor_username}` :
          row.admin_actor_tg_id ? `id:${row.admin_actor_tg_id}` : "—";
        const lines = [
          `<b>${label}</b>`,
          `Name: ${escapeHtml(displayName)}`,
          row.username ? `Username: @${row.username}` : null,
          row.invite_link ? `Invite: ${escapeHtml(row.invite_link_name ?? row.invite_link)}` : null,
          isKickBan ? `By: ${escapeHtml(actor)}` : null,
          `Time (KL): ${new Date(occurredAt).toLocaleString("en-GB", { timeZone: "Asia/Kuala_Lumpur" })}`,
        ].filter(Boolean) as string[];
        await callCommunityTelegram("sendMessage", {
          chat_id: settings.member_alerts_chat_id,
          text: lines.join("\n"),
          parse_mode: "HTML",
          disable_web_page_preview: true,
        });
      }
    }
  } catch (e) {
    console.error("[telegram-community] member alert failed", e);
  }

  return writeResult;
}

// ──────────────────────────────────────────────────────────────────────────────
// Enhanced moderation: telegram-preview spam, external bot promo, OCR.
// ──────────────────────────────────────────────────────────────────────────────

const TG_PREVIEW_HOSTS = /(?:^|[\s/@])(?:t|telegram)\.me\//i;
const TG_URL_RE = /https?:\/\/(?:www\.)?(?:t|telegram)\.me\/([^\s<>"'?#]+)/gi;

export type PreviewSpamHit = { kind: string; detail: string };

/** Extract first path segment from a t.me URL, lowercase, no leading '@'. */
function tmeHandleOf(url: string): string | null {
  const m = /^https?:\/\/(?:www\.)?(?:t|telegram)\.me\/([^\s<>"'?#/]+)/i.exec(url);
  if (!m) return null;
  return m[1].toLowerCase().replace(/^@/, "");
}

/** Detect Telegram share-preview / external channel preview cards / raw t.me links. */
export function detectTelegramPreviewSpam(
  message: TelegramMessage,
  opts?: { trustedHandles?: Set<string>; ownBot?: string | null },
): PreviewSpamHit | null {
  const trusted = opts?.trustedHandles ?? new Set<string>();
  const ownBot = (opts?.ownBot ?? "").toLowerCase().replace(/^@/, "");
  const isTrusted = (h: string | null) => !!h && (h === ownBot || trusted.has(h));

  const lpo = message.link_preview_options?.url;
  if (lpo && TG_PREVIEW_HOSTS.test(lpo) && !isTrusted(tmeHandleOf(lpo))) {
    return { kind: "link_preview_telegram", detail: lpo };
  }
  const er = message.external_reply;
  if (er?.chat?.id || er?.origin?.chat?.id || er?.origin?.sender_chat?.id) {
    return {
      kind: "external_reply_channel",
      detail: String(er.chat?.id ?? er.origin?.chat?.id ?? er.origin?.sender_chat?.id),
    };
  }
  if (er?.link_preview_options?.url && TG_PREVIEW_HOSTS.test(er.link_preview_options.url)
      && !isTrusted(tmeHandleOf(er.link_preview_options.url))) {
    return { kind: "external_reply_tg_link", detail: er.link_preview_options.url };
  }
  if (message.forward_from_chat?.type === "channel") {
    return {
      kind: "forward_from_channel",
      detail: `${message.forward_from_chat.id ?? "?"}:${message.forward_from_chat.title ?? ""}`,
    };
  }
  if (message.forward_origin?.chat?.type === "channel") {
    return {
      kind: "forward_origin_channel",
      detail: `${message.forward_origin.chat.id ?? "?"}:${message.forward_origin.chat.title ?? ""}`,
    };
  }

  // Raw t.me / telegram.me links anywhere (text/caption/entities) — most spam falls here.
  const haystack: string[] = [];
  if (message.text) haystack.push(message.text);
  if (message.caption) haystack.push(message.caption);
  for (const e of [...(message.entities ?? []), ...(message.caption_entities ?? [])]) {
    if (e.url) haystack.push(e.url);
  }
  if (lpo) haystack.push(lpo);
  if (er?.link_preview_options?.url) haystack.push(er.link_preview_options.url);

  const combined = haystack.join(" ");
  TG_URL_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TG_URL_RE.exec(combined)) !== null) {
    const firstSeg = (m[1] ?? "").split("/")[0].toLowerCase().replace(/^@/, "");
    if (!firstSeg) continue;
    // invite links: t.me/+xxx or t.me/joinchat/xxx — always suspicious unless trusted
    if (firstSeg.startsWith("+") || firstSeg === "joinchat") {
      if (isTrusted(firstSeg)) continue;
      return { kind: "tg_invite_link", detail: m[0] };
    }
    if (isTrusted(firstSeg)) continue;
    return { kind: "tg_channel_link", detail: firstSeg };
  }
  return null;
}

// ---- Trusted Telegram handles allowlist (channels / bots) ----
const trustedHandlesCache = new Map<string, { allowed: Set<string>; expiresAt: number }>();

export async function loadTrustedTelegramHandles(
  adminClient: SupabaseClient,
  chatId: number,
): Promise<Set<string>> {
  const key = `${chatId}`;
  const now = Date.now();
  const cached = trustedHandlesCache.get(key);
  if (cached && cached.expiresAt > now) return cached.allowed;
  const result = await adminClient
    .from("trusted_telegram_handles")
    .select("handle, chat_id")
    .or(`chat_id.is.null,chat_id.eq.${chatId}`);
  const data = assertQuerySucceeded(result, "trusted Telegram handles");
  const set = new Set<string>(
    (data ?? []).map((r: { handle: string }) => r.handle.toLowerCase().replace(/^@/, "")),
  );
  trustedHandlesCache.set(key, { allowed: set, expiresAt: now + 60_000 });
  return set;
}

// ---- Trusted bot allowlist (in-process cache 60s) ----
const trustedBotsCache = new Map<string, { allowed: Set<string>; expiresAt: number }>();

export async function loadTrustedBotUsernames(
  adminClient: SupabaseClient,
  chatId: number,
): Promise<Set<string>> {
  const key = `${chatId}`;
  const now = Date.now();
  const cached = trustedBotsCache.get(key);
  if (cached && cached.expiresAt > now) return cached.allowed;
  const result = await adminClient
    .from("trusted_bot_usernames")
    .select("username, chat_id")
    .or(`chat_id.is.null,chat_id.eq.${chatId}`);
  const data = assertQuerySucceeded(result, "trusted bot usernames");
  const set = new Set<string>(
    (data ?? []).map((r: { username: string }) => r.username.toLowerCase().replace(/^@/, "")),
  );
  trustedBotsCache.set(key, { allowed: set, expiresAt: now + 60_000 });
  return set;
}

const BOT_MENTION_RE = /@([a-zA-Z0-9_]{3,32}_bot)\b/gi;

/** Returns the first NOT-allowlisted bot username (lowercase, no @) or null. */
export function detectExternalBotPromotion(
  text: string,
  ownBotUsername: string | null | undefined,
  allowlist: Set<string>,
): string | null {
  if (!text) return null;
  const own = (ownBotUsername ?? "").toLowerCase().replace(/^@/, "");
  let m: RegExpExecArray | null;
  while ((m = BOT_MENTION_RE.exec(text)) !== null) {
    const u = m[1].toLowerCase();
    if (u === own) continue;
    if (allowlist.has(u)) continue;
    return u;
  }
  return null;
}

// ---- OCR via Lovable AI Gateway ----

export function pickLargestPhotoFileId(message: TelegramMessage): {
  fileId: string;
  uniq: string;
} | null {
  if (Array.isArray(message.photo) && message.photo.length) {
    const largest = message.photo.reduce((a, b) =>
      (a.file_size ?? 0) > (b.file_size ?? 0) ? a : b,
    );
    return { fileId: largest.file_id, uniq: largest.file_unique_id ?? largest.file_id };
  }
  const docThumb = message.document?.thumbnail?.file_id;
  if (docThumb && message.document?.mime_type?.startsWith("image/")) {
    return { fileId: message.document.file_id ?? docThumb, uniq: docThumb };
  }
  const animThumb = message.animation?.thumbnail?.file_id;
  if (animThumb) return { fileId: animThumb, uniq: animThumb };
  const vidThumb = message.video?.thumbnail?.file_id;
  if (vidThumb) return { fileId: vidThumb, uniq: vidThumb };
  return null;
}

// Có ảnh (photo / sticker-image / document image / animation / video thumbnail) mà Angel có thể "xem" và phân tích.
export function hasAnalyzableImage(message: TelegramMessage): boolean {
  if (Array.isArray(message.photo) && message.photo.length) return true;
  const doc = message.document;
  if (doc?.mime_type?.startsWith("image/")) return true;
  if (message.animation) return true;
  if (message.video?.thumbnail) return true;
  return false;
}

// Vision describe qua Lovable AI Gateway (Gemini). Trả về mô tả chi tiết bằng ngôn ngữ của người dùng
// để lớp Angel (FUN Core / Lovable) restyle thành reply tự nhiên với persona.
// Model rẻ cho các task phụ trợ (mô tả ảnh / transcribe voice) — tiết kiệm credit Lovable.
const VISION_MODEL = Deno.env.get("ANGEL_MODEL_VISION") || "google/gemini-3.1-flash-lite";
const describeImageCache = new Map<string, { text: string; expiresAt: number }>();

export async function describeTelegramImage(
  message: TelegramMessage,
  userCaption: string,
): Promise<string | null> {
  const pick = pickLargestPhotoFileId(message);
  if (!pick) return null;

  const captionTrim = (userCaption ?? "").trim();
  const cacheKey = `${pick.uniq}|${captionTrim.slice(0, 200)}`;
  const now = Date.now();
  const cached = describeImageCache.get(cacheKey);
  if (cached && cached.expiresAt > now) return cached.text;

  if (!(await getFlag("cost.vision_describe_enabled", true))) {
    console.log("[describeTelegramImage] skipped — cost.vision_describe_enabled=false");
    return null;
  }
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return null;
  // Tải ảnh server-side rồi gửi base64 — KHÔNG đưa URL api.telegram.org cho AI.
  const media = await tryFetchTelegramMedia(pick.fileId, "describeImage", {
    allowedMimePrefixes: ["image/"],
    maxBytes: 10 * 1024 * 1024,
  });
  if (!media) return null;

  const instruction = captionTrim
    ? `Người dùng gửi hình kèm caption / yêu cầu: "${captionTrim}". Hãy mô tả bức hình một cách chi tiết, khách quan (chủ thể, bối cảnh, chữ viết nếu có, biểu cảm, chi tiết đáng chú ý) VÀ trả lời trực tiếp caption / yêu cầu của người dùng dựa trên nội dung hình.`
    : "Hãy mô tả bức hình này chi tiết, khách quan: chủ thể chính, bối cảnh, biểu cảm, chữ viết (OCR nếu có), màu sắc / không khí, chi tiết đáng chú ý.";

  try {
    const result = await callAiGateway(
      {
        model: VISION_MODEL,
        messages: [
          {
            role: "system",
            content:
              "Bạn là trợ lý mô tả hình ảnh trung thực, chi tiết. Trả lời bằng CÙNG NGÔN NGỮ với caption của người dùng; nếu không có caption thì dùng tiếng Việt. Không thêm lời chào, không xưng hô Angel/bé, không dùng emoji, chỉ trả lời nội dung mô tả + phần đáp trực tiếp yêu cầu.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: instruction },
              { type: "image_url", image_url: { url: media.dataUrl } },
            ],
          },
        ],
      },
      { apiKey, label: "describeImage" },
    );
    if (!result.ok) return null;
    const text = gatewayText(result);
    if (!text) return null;
    describeImageCache.set(cacheKey, { text, expiresAt: now + 30 * 60_000 });
    return text;
  } catch (err) {
    console.error("[telegram-community] describeImage error", err);
    return null;
  }
}

export function buildImageAnalysisContext(description: string, userCaption: string): string {
  const caption = (userCaption ?? "").trim();
  return [
    "IMAGE_ANALYSIS_CONTEXT — Angel VỪA MỚI XEM bức hình mà người dùng gửi kèm. Coi như bé đã kể lại đầy đủ nội dung hình cho Angel qua đoạn mô tả bên dưới.",
    "TUYỆT ĐỐI KHÔNG được nói các câu kiểu \"Angel không nhìn thấy hình\", \"không tìm thấy hình ảnh nào\", \"Angel không đọc được hình\", \"Angel chưa thấy hình\" — vì Angel ĐÃ có nội dung hình rồi.",
    "Hãy trả lời tự nhiên, ấm áp, đúng persona Angel/bé (hoặc Angel/Cha nếu là owner), dựa trên mô tả hình + caption/yêu cầu của người dùng.",
    "",
    `MÔ TẢ HÌNH (do vision model tạo):\n"""${description}"""`,
    "",
    caption
      ? `CAPTION / YÊU CẦU của người dùng:\n"""${caption}"""`
      : "Người dùng không kèm caption — hãy chủ động chia sẻ cảm nhận về bức hình, mô tả những gì Angel thấy và hỏi lại bé xem bé muốn Angel tập trung vào điều gì.",
  ].join("\n");
}

export { runOcrOnPhoto, type OcrResult } from "./telegram-ocr.ts";

export function classifyMessageType(message: TelegramMessage): string {
  if (message.forward_origin || message.forward_from_chat || message.forward_from) return "forward";
  if (message.external_reply) return "preview";
  if (Array.isArray(message.photo) && message.photo.length) return "photo";
  if (message.video) return "video";
  if (message.animation) return "animation";
  if (message.document) return "document";
  if (message.text) return "text";
  if (message.caption) return "caption";
  return "other";
}

// ===== Audio transcription (voice / audio / video_note DMs) =====
// Tận dụng Gemini multimodal (input_audio) qua Lovable AI Gateway.
// Telegram voice là audio/ogg opus; Gemini chấp nhận format 'ogg'.
const transcribeAudioCache = new Map<string, { text: string; expiresAt: number }>();
const TRANSCRIBE_TTL_MS = 30 * 60_000;
const MAX_TRANSCRIBE_BYTES = 20 * 1024 * 1024; // 20MB an toàn cho base64

function mimeToAudioFormat(mime: string | null | undefined): string {
  const m = (mime ?? "").toLowerCase();
  if (m.includes("ogg") || m.includes("opus")) return "ogg";
  if (m.includes("mpeg") || m.includes("mp3")) return "mp3";
  if (m.includes("wav")) return "wav";
  if (m.includes("m4a") || m.includes("mp4") || m.includes("aac")) return "m4a";
  if (m.includes("webm")) return "webm";
  if (m.includes("flac")) return "flac";
  return "ogg";
}

function bufferToBase64(buf: Uint8Array): string {
  // Chunk để tránh call-stack overflow với file lớn
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    binary += String.fromCharCode(...buf.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function transcribeTelegramAudio(params: {
  fileId: string;
  fileUniqueId?: string | null;
  mime?: string | null;
}): Promise<string | null> {
  const { fileId, fileUniqueId, mime } = params;
  const cacheKey = fileUniqueId || fileId;
  const now = Date.now();
  if (!(await getFlag("cost.voice_transcribe_enabled", true))) {
    console.log("[transcribeTelegramAudio] skipped — cost.voice_transcribe_enabled=false");
    return null;
  }
  const cached = transcribeAudioCache.get(cacheKey);
  if (cached && cached.expiresAt > now) return cached.text;

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    console.warn("[transcribeTelegramAudio] LOVABLE_API_KEY missing");
    return null;
  }

  try {
    const media = await tryFetchTelegramMedia(fileId, "transcribeAudio", {
      maxBytes: MAX_TRANSCRIBE_BYTES,
      allowedMimePrefixes: ["audio/", "video/", "application/octet-stream"],
    });
    if (!media) return null;
    const base64 = media.base64;
    const format = mimeToAudioFormat(mime || media.mime);

    const result = await callAiGateway(
      {
        model: VISION_MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are a strict transcription engine. Output ONLY the verbatim transcript of the audio in its original spoken language. No translation, no summary, no commentary, no quotation marks. If the audio is silent or unintelligible, output an empty string.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Transcribe this audio message." },
              { type: "input_audio", input_audio: { data: base64, format } },
            ],
          },
        ],
      },
      { apiKey, label: "transcribeAudio" },
    );
    if (!result.ok) return null;
    const text = gatewayText(result);
    if (!text) return null;
    transcribeAudioCache.set(cacheKey, { text, expiresAt: now + TRANSCRIBE_TTL_MS });
    return text;
  } catch (err) {
    console.error("[transcribeTelegramAudio] error", err);
    return null;
  }
}

/** All Telegram AI routes pass this mandatory, context-only addressing boundary. */
export async function askAngel(params: Parameters<typeof askAngelReply>[0]): Promise<string> {
  const reply = await askAngelReply(params);
  const lang = resolveAngelLanguageBucket(params.originalUserMessage?.trim() || params.question, params.forcedLangBucket);
  return lang === "vi" || isLikelyVietnamese(reply) ? enforceVietnamesePronouns(reply, params.conversationContext?.username) : reply;
}
