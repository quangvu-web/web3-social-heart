/**
 * Angel AI — Bình luận thông minh trong Telegram Discussion Group.
 *
 * Bối cảnh: một Telegram Channel (VD: CAMLY COIN CHANNEL) có thể liên kết với
 * một Discussion Group. Mỗi bài đăng mới của channel được Telegram tự động
 * forward vào group đó dưới dạng message có:
 *      is_automatic_forward = true
 *      sender_chat = { id: <channel_id>, type: "channel" }
 *
 * Module này:
 *   1. Phát hiện bài mới được forward → Angel viết 1 bình luận có giá trị
 *      (tóm ý + góc nhìn tích cực + câu hỏi gợi mở).
 *   2. Trả lời thành viên khi họ đặt câu hỏi ngay dưới bài viết đó.
 *   3. Chống spam: allowlist channel, giới hạn số bình luận/giờ, khoảng cách
 *      tối thiểu giữa 2 bình luận, chống bình luận trùng bài và chống lặp
 *      nội dung (Jaccard similarity với các bình luận gần nhất).
 *
 * BẬT/TẮT & CẤU HÌNH: bảng `angel_feature_flags`, key `discussion.auto_comment`
 *   enabled: true/false
 *   meta: {
 *     "channel_ids": [-1001234567890],   // ID channel được phép (BẮT BUỘC)
 *     "max_per_hour": 6,
 *     "min_gap_seconds": 120,
 *     "reply_to_members": true
 *   }
 * Nếu `channel_ids` rỗng → KHÔNG bình luận (không đoán ID).
 */

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { getFlag, getFlagMeta } from "./angel/flags.ts";

const DEFAULTS = {
  maxPerHour: 6,
  minGapSeconds: 120,
  replyToMembers: true,
  similarityThreshold: 0.62,
  recentWindow: 20,
  minPostChars: 60,
};

type AnyMessage = {
  message_id: number;
  date?: number;
  text?: string;
  caption?: string;
  chat: { id: number; type?: string; title?: string };
  from?: { id?: number; is_bot?: boolean; username?: string; first_name?: string };
  sender_chat?: { id?: number; type?: string; title?: string; username?: string };
  is_automatic_forward?: boolean;
  reply_to_message?: AnyMessage;
};

export interface DiscussionConfig {
  enabled: boolean;
  channelIds: number[];
  maxPerHour: number;
  minGapSeconds: number;
  replyToMembers: boolean;
}

export async function loadDiscussionConfig(): Promise<DiscussionConfig> {
  const enabled = await getFlag("discussion.auto_comment", false);
  const meta = (await getFlagMeta("discussion.auto_comment")) ?? {};
  const rawIds = Array.isArray((meta as Record<string, unknown>).channel_ids)
    ? ((meta as Record<string, unknown>).channel_ids as unknown[])
    : [];
  const channelIds = rawIds
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v) && v !== 0);
  const num = (key: string, fallback: number) => {
    const v = Number((meta as Record<string, unknown>)[key]);
    return Number.isFinite(v) && v > 0 ? v : fallback;
  };
  return {
    enabled,
    channelIds,
    maxPerHour: num("max_per_hour", DEFAULTS.maxPerHour),
    minGapSeconds: num("min_gap_seconds", DEFAULTS.minGapSeconds),
    replyToMembers:
      (meta as Record<string, unknown>).reply_to_members !== false
        ? DEFAULTS.replyToMembers
        : false,
  };
}

/** Bài mới của channel được Telegram auto-forward vào discussion group. */
export function isChannelPostForward(message: AnyMessage): boolean {
  return Boolean(
    message?.is_automatic_forward === true &&
      message?.sender_chat?.id &&
      (message.sender_chat.type ?? "channel") === "channel",
  );
}

/** Thành viên trả lời/bình luận ngay dưới bài viết được forward. */
export function isMemberCommentOnPost(message: AnyMessage): boolean {
  return Boolean(
    message?.reply_to_message &&
      isChannelPostForward(message.reply_to_message) &&
      !message.from?.is_bot,
  );
}

const QUESTION_RE =
  /(\?|\bvì sao\b|\btại sao\b|\bnhư thế nào\b|\blàm sao\b|\bthế nào\b|\bkhi nào\b|\bở đâu\b|\bcó nên\b|\bgiải thích\b|\bhỏi\b|\bwhat\b|\bwhy\b|\bhow\b|\bwhen\b)/i;

function textOf(m?: AnyMessage | null): string {
  return ((m?.text || m?.caption) ?? "").trim();
}

function tokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/https?:\/\/\S+/g, " ")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 3),
  );
}

function jaccard(a: string, b: string): number {
  const A = tokens(a);
  const B = tokens(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}

async function hash(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

interface GateResult {
  ok: boolean;
  reason?: string;
  recent: string[];
}

async function passRateGate(
  admin: SupabaseClient,
  cfg: DiscussionConfig,
  discussionChatId: number,
  postMessageId: number,
  kind: string,
): Promise<GateResult> {
  const sinceHour = new Date(Date.now() - 3_600_000).toISOString();

  const { data: rows } = await admin
    .from("angel_discussion_comments")
    .select("content, created_at, post_message_id, kind")
    .eq("discussion_chat_id", discussionChatId)
    .order("created_at", { ascending: false })
    .limit(DEFAULTS.recentWindow);

  const list = rows ?? [];
  const recent = list.map((r) => String(r.content ?? ""));

  if (list.some((r) => Number(r.post_message_id) === postMessageId && r.kind === kind)) {
    return { ok: false, reason: "already_commented", recent };
  }
  const lastAt = list[0]?.created_at ? new Date(list[0].created_at).getTime() : 0;
  if (lastAt && Date.now() - lastAt < cfg.minGapSeconds * 1000) {
    return { ok: false, reason: "min_gap", recent };
  }
  const inHour = list.filter((r) => r.created_at && r.created_at >= sinceHour).length;
  if (inHour >= cfg.maxPerHour) {
    return { ok: false, reason: "hourly_limit", recent };
  }
  return { ok: true, recent };
}

function tooSimilar(candidate: string, recent: string[]): boolean {
  return recent.some((prev) => jaccard(candidate, prev) >= DEFAULTS.similarityThreshold);
}

const COMMENT_BRIEF = `NHIỆM VỤ: Angel viết MỘT bình luận cộng đồng cho bài đăng mới của kênh bên dưới.
Yêu cầu:
- 3–5 câu, ~60–110 từ, ấm áp, đúng trọng tâm bài viết, 2–3 emoji vàng/pearl.
- Cấu trúc: 1 câu chốt ý cốt lõi → 1–2 câu góc nhìn giá trị/tích cực bám sát nội dung → 1 câu hỏi gợi mở cho cộng đồng.
- Chỉ dùng thông tin có trong bài; KHÔNG bịa số liệu, link, cam kết lợi nhuận.
- KHÔNG chào hỏi dài dòng, KHÔNG nhắc giới hạn kỹ thuật hay độ dài bài viết, KHÔNG lặp lại nguyên văn bài viết.
- Viết cùng ngôn ngữ với bài viết.

BÀI ĐĂNG:
"""{{POST}}"""`;

const MEMBER_BRIEF = `NHIỆM VỤ: Angel trả lời bình luận của một thành viên ngay dưới bài đăng của kênh.
- Bám sát bài đăng và câu hỏi của thành viên, 2–4 câu, ~40–90 từ, ấm áp, 1–2 emoji.
- Chỉ dùng thông tin có trong bài hoặc kiến thức chắc chắn; không bịa.

BÀI ĐĂNG:
"""{{POST}}"""

BÌNH LUẬN CỦA THÀNH VIÊN ({{USER}}):
"""{{COMMENT}}"""`;

export interface DiscussionDeps {
  askAngel: (params: Record<string, unknown>) => Promise<string>;
  sendMessage: (
    chatId: number | string,
    text: string,
    extra?: Record<string, unknown>,
  ) => Promise<{ ok: boolean; data?: unknown }>;
  settings: Record<string, unknown>;
}

async function generate(
  deps: DiscussionDeps,
  admin: SupabaseClient,
  question: string,
  chatId: number,
  messageId: number,
  variationHint = "",
): Promise<string> {
  return await deps.askAngel({
    question: variationHint ? `${question}\n\n${variationHint}` : question,
    originalUserMessage: question,
    systemPrompt: (deps.settings.ai_system_prompt as string) ?? "",
    personaMode: deps.settings.persona_mode,
    personaCustomPrompt: deps.settings.persona_custom_prompt,
    funCoreContextPrompt: deps.settings.fun_core_context_prompt,
    aiStylePrompt: deps.settings.ai_style_prompt,
    aiPersonaPrompt: deps.settings.ai_persona_prompt,
    adminClient: admin,
    mirrorAngelWeb: (deps.settings as Record<string, unknown>).ai_mirror_angel_web !== false,
    conversationContext: {
      chatId,
      chatType: "supergroup",
      groupId: chatId,
      messageId,
      triggerSource: "discussion_comment",
    },
  });
}

/**
 * Xử lý một message trong discussion group. Trả về true nếu Angel đã bình luận.
 */
export async function handleDiscussionComment(
  admin: SupabaseClient,
  message: AnyMessage,
  deps: DiscussionDeps,
): Promise<boolean> {
  const isPost = isChannelPostForward(message);
  const isMember = !isPost && isMemberCommentOnPost(message);
  if (!isPost && !isMember) return false;

  const cfg = await loadDiscussionConfig();
  if (!cfg.enabled) return false;

  const channelId = isPost
    ? Number(message.sender_chat?.id)
    : Number(message.reply_to_message?.sender_chat?.id);
  if (!Number.isFinite(channelId)) return false;

  if (cfg.channelIds.length === 0) {
    console.log("[angel-discussion] chưa cấu hình channel_ids → bỏ qua (không đoán ID)");
    return false;
  }
  if (!cfg.channelIds.includes(channelId)) return false;

  const discussionChatId = message.chat.id;
  const postText = isPost ? textOf(message) : textOf(message.reply_to_message);
  if (!postText || postText.length < DEFAULTS.minPostChars) return false;

  const kind = isPost ? "post_comment" : "member_reply";
  const postMessageId = isPost
    ? message.message_id
    : Number(message.reply_to_message?.message_id ?? message.message_id);

  if (isMember) {
    if (!cfg.replyToMembers) return false;
    const commentText = textOf(message);
    if (!commentText || !QUESTION_RE.test(commentText)) return false;
  }

  // Dedupe theo message của thành viên (mỗi comment chỉ trả lời 1 lần).
  const dedupeId = isPost ? postMessageId : message.message_id;
  const gate = await passRateGate(admin, cfg, discussionChatId, dedupeId, kind);
  if (!gate.ok) {
    console.log(`[angel-discussion] skip kind=${kind} reason=${gate.reason}`);
    return false;
  }

  const brief = isPost
    ? COMMENT_BRIEF.replace("{{POST}}", postText.slice(0, 6000))
    : MEMBER_BRIEF.replace("{{POST}}", postText.slice(0, 4000))
        .replace("{{USER}}", message.from?.first_name || message.from?.username || "thành viên")
        .replace("{{COMMENT}}", textOf(message).slice(0, 1500));

  let reply = "";
  try {
    reply = (await generate(deps, admin, brief, discussionChatId, message.message_id)).trim();
    if (reply && tooSimilar(reply, gate.recent)) {
      const retry = await generate(
        deps,
        admin,
        brief,
        discussionChatId,
        message.message_id,
        "LƯU Ý: hãy chọn một góc nhìn KHÁC HẲN và cách mở đầu khác với các bình luận trước của Angel.",
      );
      reply = tooSimilar(retry.trim(), gate.recent) ? "" : retry.trim();
    }
  } catch (err) {
    console.error("[angel-discussion] generate failed", err);
    return false;
  }

  if (!reply) {
    console.log("[angel-discussion] skip — nội dung trùng lặp với bình luận gần đây");
    return false;
  }

  const res = await deps.sendMessage(discussionChatId, reply, {
    reply_to_message_id: message.message_id,
    allow_sending_without_reply: true,
    skipAutoDelete: true,
  });
  if (!res?.ok) {
    console.log("[angel-discussion] send failed", res);
    return false;
  }

  const sentId =
    (res.data as { result?: { message_id?: number } } | undefined)?.result?.message_id ?? null;

  await admin.from("angel_discussion_comments").insert({
    discussion_chat_id: discussionChatId,
    channel_chat_id: channelId,
    post_message_id: dedupeId,
    trigger_message_id: message.message_id,
    comment_message_id: sentId,
    kind,
    content: reply,
    content_hash: await hash(reply),
  });

  console.log(`[angel-discussion] commented kind=${kind} chat=${discussionChatId} post=${dedupeId}`);
  return true;
}
