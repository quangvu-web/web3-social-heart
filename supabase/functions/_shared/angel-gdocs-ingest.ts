/**
 * Ingest Google Docs links từ tin nhắn Telegram (channel hoặc group) vào
 * Angel AI knowledge.
 *
 * Chỉ đọc được document ở chế độ "Anyone with the link – Viewer" (public).
 * Nếu doc private → export endpoint trả 401/403 → skip và log.
 *
 * Row lưu vào `angel_channel_knowledge` (dùng chung schema), source
 * `google_doc` để phân biệt với `telegram_channel`.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { pushToAngelKnowledge } from "./angel-knowledge.ts";
import { authoritativeMetadata } from "./angel-authoritative.ts";

const GDOC_REGEX = /https?:\/\/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]{20,})/gi;
const MAX_CONTENT = 190_000;
// Nội dung ngắn hơn ngưỡng này (sau khi trim) coi là nghi ngờ doc chưa mở
// quyền chia sẻ (Google đôi khi trả 200 + vài dòng preview/redirect thay vì
// HTML login page). Chặn không push lên Angel để tránh "âm thầm push nội dung
// rỗng/link" như user báo.
const MIN_CONTENT_CHARS = 40;

export function extractGoogleDocIds(text: string | null | undefined): string[] {
  if (!text) return [];
  const ids = new Set<string>();
  for (const m of text.matchAll(GDOC_REGEX)) {
    if (m[1]) ids.add(m[1]);
  }
  return [...ids];
}

async function fetchGoogleDocText(docId: string): Promise<
  { ok: true; content: string; title?: string } | { ok: false; error: string; status?: number }
> {
  const url = `https://docs.google.com/document/d/${docId}/export?format=txt`;
  try {
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) {
      return { ok: false, status: res.status, error: `HTTP ${res.status}` };
    }
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("text/html")) {
      // Google trả HTML login page khi doc không public.
      return { ok: false, status: res.status, error: "doc_not_public (got HTML login page)" };
    }
    let text = await res.text();
    // Strip BOM
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    text = text.trim();
    if (!text) return { ok: false, error: "doc_not_shared (empty response — nghi ngờ chưa bật 'Anyone with the link — Viewer')" };
    if (text.length < MIN_CONTENT_CHARS) {
      return {
        ok: false,
        error: `doc_not_shared_or_empty (chỉ fetch được ${text.length} ký tự — nghi ngờ doc chưa mở quyền 'Anyone with the link — Viewer'. Preview: ${JSON.stringify(text.slice(0, 60))})`,
      };
    }
    const firstLine = text.split(/\r?\n/)[0]?.trim();
    if (text.length > MAX_CONTENT) text = text.slice(0, MAX_CONTENT) + "\n\n[...truncated]";
    return { ok: true, content: text, title: firstLine };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export type GdocIngestContext = {
  chatId: number;
  messageId: number;
  chatTitle?: string | null;
  chatUsername?: string | null;
  postedAt?: string | null;
  senderName?: string | null;
};

export async function ingestGoogleDocsFromMessage(
  admin: SupabaseClient,
  text: string | null | undefined,
  ctx: GdocIngestContext,
): Promise<{ found: number; pushed: number; failed: number; errors: string[] }> {
  const ids = extractGoogleDocIds(text);
  const summary = { found: ids.length, pushed: 0, failed: 0, errors: [] as string[] };
  if (ids.length === 0) return summary;

  for (const docId of ids) {
    const sourceRef = `gdoc:${docId}`;
    const docUrl = `https://docs.google.com/document/d/${docId}/edit`;

    const fetched = await fetchGoogleDocText(docId);
    if (!fetched.ok) {
      summary.failed++;
      summary.errors.push(`${docId}: ${fetched.error}`);
      const isNotShared = /doc_not_shared|doc_not_public/i.test(fetched.error);
      // Ghi lại row với push_error để admin còn thấy
      await admin
        .from("angel_channel_knowledge")
        .upsert(
          {
            chat_id: ctx.chatId,
            message_id: ctx.messageId,
            content: null,
            media_type: "google_doc",
            posted_at: ctx.postedAt ?? null,
            raw_message: {
              google_doc_id: docId,
              google_doc_url: docUrl,
              source_message_id: ctx.messageId,
              not_shared: isNotShared || undefined,
            },
            pushed_to_core: false,
            push_error: fetched.error,
            core_reference: null,
          },
          { onConflict: "chat_id,message_id" },
        );
      console.log(`[gdocs-ingest] fetch failed docId=${docId} err=${fetched.error}`);
      // Nếu nghi ngờ chưa share → reply trong channel để user biết cần mở quyền.
      if (isNotShared) {
        try {
          const { sendMessage } = await import("./telegram-community.ts");
          await sendMessage(
            ctx.chatId,
            `⚠️ <b>Angel không đọc được Google Doc</b> <a href="${docUrl}">${docId.slice(0, 12)}…</a>\n\n` +
              `Bé vui lòng mở doc → <b>Share</b> → chọn <b>"Anyone with the link — Viewer"</b> rồi gửi lại link để Angel ingest vào knowledge nhé. 🌟`,
            {
              reply_to_message_id: ctx.messageId,
              allow_sending_without_reply: true,
              parse_mode: "HTML",
              disable_web_page_preview: true,
              skipAutoDelete: true,
            },
          );
        } catch (e) {
          console.warn("[gdocs-ingest] warn reply failed", e);
        }
      }
      continue;
    }

    const title = (fetched.title && fetched.title.length <= 200 ? fetched.title : null) ||
      `Google Doc từ ${ctx.chatTitle || ctx.chatUsername || ctx.chatId}`;

    const result = await pushToAngelKnowledge(
      {
        source: "google_doc",
        source_ref: sourceRef,
        title,
        content: fetched.content,
        url: docUrl,
        language: "vi",
        folder: `Google Docs / ${ctx.chatTitle || ctx.chatUsername || ctx.chatId}`,
        metadata: {
          google_doc_id: docId,
          chat_id: ctx.chatId,
          chat_title: ctx.chatTitle,
          chat_username: ctx.chatUsername,
          source_message_id: ctx.messageId,
          sender_name: ctx.senderName,
          posted_at: ctx.postedAt,
          ...authoritativeMetadata(title, fetched.content),
        },
      },
      { chunk_now: true, verify: true },
    );

    // Ghi log vào angel_channel_knowledge. Dùng message_id gốc + docId để không đè
    // trên cùng chat_id/message_id nếu 1 tin có nhiều link → chỉ giữ được 1 row
    // (chấp nhận vì hiếm).
    await admin
      .from("angel_channel_knowledge")
      .upsert(
        {
          chat_id: ctx.chatId,
          message_id: ctx.messageId,
          content: fetched.content.slice(0, 10_000),
          media_type: "google_doc",
          posted_at: ctx.postedAt ?? null,
          raw_message: {
            google_doc_id: docId,
            google_doc_url: docUrl,
            source_message_id: ctx.messageId,
            title,
          },
          pushed_to_core: result.ok,
          pushed_at: result.ok ? new Date().toISOString() : null,
          push_error: result.ok ? null : (result.skipped ? null : result.error || "unknown"),
          core_reference: result.reference || null,
        },
        { onConflict: "chat_id,message_id" },
      );

    if (result.ok) {
      summary.pushed++;
      if (result.duplicate) {
        console.log(`[gdocs-ingest] duplicate docId=${docId} — nội dung đã có sẵn trên Angel gốc (không lỗi, không re-embed)`);
      } else {
        console.log(`[gdocs-ingest] pushed docId=${docId} ref=${result.reference || "-"}`);
      }
    } else if (result.skipped) {
      console.log(`[gdocs-ingest] skipped docId=${docId} (no ingest key)`);
    } else {
      summary.failed++;
      summary.errors.push(`${docId}: push_failed ${result.error}`);
      console.log(`[gdocs-ingest] push failed docId=${docId} err=${result.error}`);
    }
  }

  return summary;
}
