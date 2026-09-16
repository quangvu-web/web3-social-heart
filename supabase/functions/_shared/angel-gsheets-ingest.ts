/**
 * Ingest Google Sheets links vào Angel AI knowledge — clone của angel-gdocs-ingest
 * nhưng cho spreadsheet.
 *
 * Chiến lược fetch:
 *   1. `?format=csv` cho sheet đầu tiên (đủ dùng cho các sheet đơn giản như "Tài
 *      khoản Fun.Rich" — chỉ có 1 tab).
 *   2. Nếu có `gid=...` trong URL, ưu tiên fetch đúng tab đó.
 *   3. Chỉ đọc được khi sheet share "Anyone with the link — Viewer".
 *
 * Post-ingest verification: pushToAngelKnowledge(..., { verify: true }) —
 * bắt được silent failure như phía Google Docs đã áp dụng.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { pushToAngelKnowledge } from "./angel-knowledge.ts";
import { authoritativeMetadata, detectAuthoritative } from "./angel-authoritative.ts";

const GSHEET_REGEX =
  /https?:\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]{20,})(?:\/[^\s?#]*)?(?:[?#][^\s]*)?/gi;
const MAX_CONTENT = 190_000;
const MIN_CONTENT_CHARS = 20;

export type GSheetHit = { id: string; gid?: string };

export function extractGoogleSheetIds(text: string | null | undefined): GSheetHit[] {
  if (!text) return [];
  const seen = new Set<string>();
  const out: GSheetHit[] = [];
  for (const m of text.matchAll(GSHEET_REGEX)) {
    const id = m[1];
    if (!id) continue;
    // Parse gid nếu có (?gid=... hoặc #gid=...)
    const full = m[0];
    const gidMatch = full.match(/[?#&]gid=(\d+)/);
    const gid = gidMatch?.[1];
    const key = `${id}::${gid || "0"}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ id, gid });
  }
  return out;
}

function csvToText(csv: string): string {
  // Chuyển CSV thành text đọc được: mỗi dòng → "col1 | col2 | col3"
  // Giữ nguyên các dòng trống thành line break. Không parse quote phức tạp —
  // Google export csv đã escape đầy đủ, cắt naive theo dấu phẩy đủ dùng cho
  // sheet danh sách ví (không có dấu phẩy trong ô).
  const lines = csv.split(/\r?\n/);
  const out: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { out.push(""); continue; }
    // Naive split — nếu có ô chứa dấu phẩy trong quote thì fallback giữ raw
    if (line.includes('"')) { out.push(line); continue; }
    const cells = line.split(",").map((c) => c.trim()).filter((c) => c.length > 0);
    out.push(cells.join(" | "));
  }
  return out.join("\n").trim();
}

async function fetchGoogleSheetText(
  sheetId: string,
  gid: string | undefined,
): Promise<
  { ok: true; content: string; title?: string } | { ok: false; error: string; status?: number }
> {
  const gidParam = gid ? `&gid=${gid}` : "";
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv${gidParam}`;
  try {
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) return { ok: false, status: res.status, error: `HTTP ${res.status}` };
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("text/html")) {
      return { ok: false, status: res.status, error: "sheet_not_public (got HTML login page)" };
    }
    let raw = await res.text();
    if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
    raw = raw.trim();
    if (!raw) return { ok: false, error: "sheet_not_shared (empty response — nghi ngờ chưa bật 'Anyone with the link — Viewer')" };
    let text = csvToText(raw);
    if (text.length < MIN_CONTENT_CHARS) {
      return {
        ok: false,
        error: `sheet_not_shared_or_empty (chỉ fetch được ${text.length} ký tự — nghi ngờ sheet chưa mở quyền 'Anyone with the link — Viewer'. Preview: ${JSON.stringify(text.slice(0, 60))})`,
      };
    }
    const firstLine = text.split(/\r?\n/)[0]?.trim();
    if (text.length > MAX_CONTENT) text = text.slice(0, MAX_CONTENT) + "\n\n[...truncated]";
    return { ok: true, content: text, title: firstLine };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export type GSheetIngestContext = {
  chatId: number;
  messageId: number;
  chatTitle?: string | null;
  chatUsername?: string | null;
  postedAt?: string | null;
  senderName?: string | null;
  /** Nếu caller biết title chính xác (vd: đọc từ Telegram link preview) → truyền vào để override title lấy từ dòng đầu CSV. */
  titleHint?: string | null;
};

export async function ingestGoogleSheetsFromMessage(
  admin: SupabaseClient,
  text: string | null | undefined,
  ctx: GSheetIngestContext,
): Promise<{ found: number; pushed: number; failed: number; errors: string[]; refs: string[] }> {
  const hits = extractGoogleSheetIds(text);
  const summary = {
    found: hits.length,
    pushed: 0,
    failed: 0,
    errors: [] as string[],
    refs: [] as string[],
  };
  if (hits.length === 0) return summary;

  for (const { id: sheetId, gid } of hits) {
    const sourceRef = gid ? `gsheet:${sheetId}:${gid}` : `gsheet:${sheetId}`;
    const sheetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/edit${gid ? `#gid=${gid}` : ""}`;
    summary.refs.push(sourceRef);

    const fetched = await fetchGoogleSheetText(sheetId, gid);
    if (!fetched.ok) {
      summary.failed++;
      summary.errors.push(`${sheetId}: ${fetched.error}`);
      const isNotShared = /sheet_not_shared|sheet_not_public/i.test(fetched.error);
      await admin.from("angel_channel_knowledge").upsert(
        {
          chat_id: ctx.chatId,
          message_id: ctx.messageId,
          content: null,
          media_type: "google_sheet",
          posted_at: ctx.postedAt ?? null,
          raw_message: {
            google_sheet_id: sheetId,
            google_sheet_gid: gid ?? null,
            google_sheet_url: sheetUrl,
            source_message_id: ctx.messageId,
            not_shared: isNotShared || undefined,
          },
          pushed_to_core: false,
          push_error: fetched.error,
          core_reference: null,
        },
        { onConflict: "chat_id,message_id" },
      );
      console.log(`[gsheets-ingest] fetch failed sheetId=${sheetId} err=${fetched.error}`);
      if (isNotShared) {
        try {
          const { sendMessage } = await import("./telegram-community.ts");
          await sendMessage(
            ctx.chatId,
            `⚠️ <b>Angel không đọc được Google Sheet</b> <a href="${sheetUrl}">${sheetId.slice(0, 12)}…</a>\n\n` +
              `Bé vui lòng mở sheet → <b>Share</b> → chọn <b>"Anyone with the link — Viewer"</b> rồi gửi lại link để Angel ingest vào knowledge nhé. 🌟`,
            {
              reply_to_message_id: ctx.messageId,
              allow_sending_without_reply: true,
              parse_mode: "HTML",
              disable_web_page_preview: true,
              skipAutoDelete: true,
            },
          );
        } catch (e) {
          console.warn("[gsheets-ingest] warn reply failed", e);
        }
      }
      continue;
    }

    const hintedTitle = (ctx.titleHint || "").trim();
    const firstLineTitle = (fetched.title && fetched.title.length <= 200 ? fetched.title : null);
    const title = hintedTitle || firstLineTitle ||
      `Google Sheet từ ${ctx.chatTitle || ctx.chatUsername || ctx.chatId}`;

    const isAuthoritative = detectAuthoritative(title, fetched.content);
    const extraMeta = authoritativeMetadata(title, fetched.content);

    const result = await pushToAngelKnowledge(
      {
        source: "google_sheet",
        source_ref: sourceRef,
        title,
        content: fetched.content,
        url: sheetUrl,
        language: "vi",
        folder: `Google Sheets / ${ctx.chatTitle || ctx.chatUsername || ctx.chatId}`,
        metadata: {
          google_sheet_id: sheetId,
          google_sheet_gid: gid ?? null,
          chat_id: ctx.chatId,
          chat_title: ctx.chatTitle,
          chat_username: ctx.chatUsername,
          source_message_id: ctx.messageId,
          sender_name: ctx.senderName,
          posted_at: ctx.postedAt,
          ...extraMeta,
        },
      },
      { chunk_now: true, verify: true },
    );

    await admin.from("angel_channel_knowledge").upsert(
      {
        chat_id: ctx.chatId,
        message_id: ctx.messageId,
        content: fetched.content.slice(0, 10_000),
        media_type: "google_sheet",
        posted_at: ctx.postedAt ?? null,
        raw_message: {
          google_sheet_id: sheetId,
          google_sheet_gid: gid ?? null,
          google_sheet_url: sheetUrl,
          source_message_id: ctx.messageId,
          title,
          authoritative: isAuthoritative || undefined,
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
      console.log(
        `[gsheets-ingest] pushed sheetId=${sheetId}${gid ? `/gid=${gid}` : ""} authoritative=${isAuthoritative} duplicate=${result.duplicate ? 1 : 0} ref=${result.reference || "-"}`,
      );
    } else if (result.skipped) {
      console.log(`[gsheets-ingest] skipped sheetId=${sheetId} (no ingest key)`);
    } else {
      summary.failed++;
      summary.errors.push(`${sheetId}: push_failed ${result.error}`);
      console.log(`[gsheets-ingest] push failed sheetId=${sheetId} err=${result.error}`);
    }
  }

  return summary;
}
