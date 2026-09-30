/**
 * Handler cho Telegram channel_post / edited_channel_post.
 *
 * Được gọi từ telegram-community-webhook khi có update loại channel_post.
 *
 * Cập nhật (4-step long-content plan):
 *   1. Auto-merge tin nhắn liên tiếp cùng channel trong ≤60 giây → gộp vào 1
 *      row `angel_channel_knowledge` (cùng source_ref) để Angel gốc chunk/embed
 *      nguyên khối, không bị Telegram cắt câu.
 */

import type { SupabaseClient } from "npm:@supabase/supabase-js@2.45.0";
import { pushToAngelKnowledge } from "./angel-knowledge.ts";

// Cửa sổ auto-merge: 60s. User paste dài, Telegram tự chẻ thành nhiều tin liên tiếp
// trong vài giây → gộp lại là an toàn.
const MERGE_WINDOW_MS = 60_000;

type ChannelMessage = {
  message_id: number;
  chat: { id: number; title?: string; username?: string; type?: string };
  date?: number;
  text?: string;
  caption?: string;
  photo?: Array<{ file_id: string }>;
  video?: { file_id: string };
  document?: { file_id: string };
  voice?: { file_id: string };
  audio?: { file_id: string };
};

function detectMediaType(m: ChannelMessage): string | null {
  if (m.photo && m.photo.length > 0) return "photo";
  if (m.video) return "video";
  if (m.document) return "document";
  if (m.voice) return "voice";
  if (m.audio) return "audio";
  return null;
}

export async function ingestChannelPost(
  admin: SupabaseClient,
  message: ChannelMessage,
  opts: { edited?: boolean } = {},
): Promise<{ handled: boolean; reason?: string; merged?: boolean; warned?: boolean }> {
  const chatId = message.chat?.id;
  if (!chatId) return { handled: false, reason: "no chat_id" };

  // Chỉ xử lý channel (không phải group/private)
  const chatType = message.chat?.type;
  if (chatType !== "channel") {
    return { handled: false, reason: `chat type=${chatType}` };
  }

  // Check watched
  const { data: watched, error: wErr } = await admin
    .from("angel_watched_channels")
    .select(
      "id, is_active, auto_push_to_core, ingested_count, title, username",
    )
    .eq("chat_id", chatId)
    .maybeSingle();

  if (wErr) {
    console.error("[angel-channel-ingest] load watched failed", wErr);
    return { handled: false, reason: "db error" };
  }
  if (!watched || !watched.is_active) {
    return { handled: false, reason: "channel not watched or disabled" };
  }

  const content = (message.text || message.caption || "").trim();
  const mediaType = detectMediaType(message);

  // Bỏ qua message hoàn toàn không có text và không có caption + media
  if (!content && !mediaType) {
    return { handled: false, reason: "empty" };
  }

  const postedAt = message.date ? new Date(message.date * 1000).toISOString() : null;
  const isMediaOnly = !content && !!mediaType;

  const channelTitle = watched.title || message.chat.title || `Channel ${chatId}`;
  const channelUsername = watched.username || message.chat.username;

  // ============ AUTO-MERGE (chỉ áp cho tin mới có text, không phải edited) ============
  let mergedInto: {
    id: string;
    message_id: number;
    content: string;
    merged_message_ids: number[] | null;
    posted_at: string | null;
  } | null = null;

  if (!opts.edited && content) {
    const { data: latestRow } = await admin
      .from("angel_channel_knowledge")
      .select("id, message_id, content, merged_message_ids, posted_at")
      .eq("chat_id", chatId)
      .not("content", "is", null)
      .order("message_id", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (
      latestRow?.posted_at &&
      postedAt &&
      latestRow.message_id < message.message_id
    ) {
      const prevMs = new Date(latestRow.posted_at).getTime();
      const nowMs = new Date(postedAt).getTime();
      if (Number.isFinite(prevMs) && Number.isFinite(nowMs) && nowMs - prevMs <= MERGE_WINDOW_MS) {
        mergedInto = latestRow;
      }
    }
  }

  let knowledgeRowId: string | null = null;
  let sourceRefMessageId: number = message.message_id;
  let fullContent: string = content;
  let mergedIds: number[] = [];

  if (mergedInto) {
    // ---- MERGE ----
    sourceRefMessageId = mergedInto.message_id;
    fullContent = `${(mergedInto.content || "").trim()}\n\n${content}`.trim();
    const existing = Array.isArray(mergedInto.merged_message_ids)
      ? mergedInto.merged_message_ids
      : [];
    mergedIds = existing.includes(message.message_id)
      ? existing
      : [...existing, message.message_id];

    const { error: updErr } = await admin
      .from("angel_channel_knowledge")
      .update({
        content: fullContent,
        merged_message_ids: mergedIds,
        push_error: null,
      })
      .eq("id", mergedInto.id);
    if (updErr) {
      console.error("[angel-channel-ingest] merge update failed", updErr);
      return { handled: false, reason: "merge update failed" };
    }
    knowledgeRowId = mergedInto.id;
    console.log(
      `[angel-channel-ingest] merged msg #${message.message_id} into anchor #${sourceRefMessageId} (chat ${chatId}, total ${mergedIds.length + 1} msgs, ${fullContent.length} chars)`,
    );
  } else {
    // ---- INSERT NEW ROW ----
    const { data: knowledgeRow, error: kErr } = await admin
      .from("angel_channel_knowledge")
      .upsert(
        {
          chat_id: chatId,
          message_id: message.message_id,
          content: content || null,
          media_type: mediaType,
          posted_at: postedAt,
          raw_message: message,
          pushed_to_core: false,
          push_error: null,
          skip_reason: isMediaOnly ? "no_text_content" : null,
          merged_message_ids: [],
        },
        { onConflict: "chat_id,message_id" },
      )
      .select("id")
      .maybeSingle();

    if (kErr) {
      console.error("[angel-channel-ingest] upsert knowledge failed", kErr);
      return { handled: false, reason: "upsert failed" };
    }
    knowledgeRowId = knowledgeRow?.id || null;
    fullContent = content;
  }

  // ============ Push to Angel AI gốc ============
  let pushed = false;
  let pushRef: string | undefined;
  let pushError: string | undefined;

  if (watched.auto_push_to_core && fullContent) {
    const externalId = `${chatId}:${sourceRefMessageId}`;
    const firstLine = fullContent.split(/\r?\n/)[0]?.trim() || "";
    const title = firstLine && firstLine.length <= 200 ? firstLine : channelTitle;
    const postUrl = channelUsername
      ? `https://t.me/${channelUsername}/${sourceRefMessageId}`
      : undefined;

    const result = await pushToAngelKnowledge({
      source: "telegram_channel",
      source_ref: externalId,
      title,
      content: fullContent,
      url: postUrl,
      language: "vi",
      folder: `Telegram / ${channelTitle}`,
      metadata: {
        chat_id: chatId,
        message_id: sourceRefMessageId,
        merged_message_ids: mergedIds,
        merged_count: mergedIds.length + 1,
        channel_title: channelTitle,
        channel_username: channelUsername,
        posted_at: postedAt,
        media_type: mediaType,
        edited: opts.edited || false,
      },
    }, { chunk_now: true, verify: true });

    if (result.ok) {
      pushed = true;
      pushRef = result.reference;
    } else if (result.skipped) {
      pushError = `${result.code || "ANGEL_KNOWLEDGE_SECRET_MISSING"}: ${result.error || "Chưa cấu hình secret."}`;
    } else {
      pushError = `${result.code || "ANGEL_KNOWLEDGE_ERROR"}: ${result.error || "Không đẩy được document."}`;
    }
  }

  // Update knowledge row với kết quả push (retry sau 60s nếu tạm thời)
  if (knowledgeRowId) {
    const isTransient = [
      "ANGEL_KNOWLEDGE_NETWORK_ERROR",
      "ANGEL_KNOWLEDGE_TIMEOUT",
      "ANGEL_KNOWLEDGE_VERIFY_FAILED",
      "ANGEL_KNOWLEDGE_NOT_PERSISTED",
    ].includes(resultCodeFromPushError(pushError)) ||
      (resultCodeFromPushError(pushError) === "ANGEL_KNOWLEDGE_HTTP_ERROR" &&
        (resultStatusFromPushError(pushError) === 429 ||
          (resultStatusFromPushError(pushError) >= 500 && resultStatusFromPushError(pushError) < 600)));
    await admin
      .from("angel_channel_knowledge")
      .update({
        pushed_to_core: pushed,
        pushed_at: pushed ? new Date().toISOString() : null,
        push_error: pushError || null,
        core_reference: pushRef || null,
        next_retry_at: isTransient ? new Date(Date.now() + 60_000).toISOString() : null,
      })
      .eq("id", knowledgeRowId);
  }

  // ============ Update watched channel stats ============
  const patch: Record<string, unknown> = {
    last_synced_at: new Date().toISOString(),
    last_message_id: message.message_id,
  };
  // merged posts KHÔNG tăng ingested_count (đã đếm ở tin anchor)
  if (!opts.edited && !mergedInto) {
    patch.ingested_count = (watched.ingested_count ?? 0) + 1;
  }
  if (!watched.title && message.chat.title) patch.title = message.chat.title;
  if (!watched.username && message.chat.username) patch.username = message.chat.username;

  // Không gửi bất kỳ cảnh báo kỹ thuật nào về độ dài bài viết cho người dùng.
  const warned = false;


  await admin
    .from("angel_watched_channels")
    .update(patch)
    .eq("chat_id", chatId);

  return { handled: true, merged: !!mergedInto, warned };
}

function resultCodeFromPushError(error: string | undefined): string {
  return error?.split(":", 1)[0] || "";
}

function resultStatusFromPushError(error: string | undefined): number {
  const match = error?.match(/HTTP (\d{3})/);
  return match ? Number(match[1]) : 0;
}
