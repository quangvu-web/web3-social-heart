/**
 * Ingest tài liệu / ảnh gửi vào channel/group Angel đang theo dõi vào Angel AI
 * knowledge gốc.
 *
 * Hỗ trợ:
 *   - Ảnh (photo hoặc gửi as-file image/*)  → mô tả + OCR bằng Gemini vision
 *   - PDF                                    → Gemini multimodal (file input base64)
 *   - DOCX (.docx)                           → parse XML <w:t> qua JSZip
 *   - XLSX / XLS                             → SheetJS, mỗi sheet nối thành CSV
 *   - Markdown / plain text (.md/.txt/.csv)  → decode UTF-8 trực tiếp
 *   - Google Sheets link                     → export CSV (cần "Anyone with the link")
 *   - .doc (Word 97-2003 binary)             → SKIP (chỉ nhận .docx)
 *
 * Cả file gửi trực tiếp lẫn file forward đều đi qua cùng field message.photo/
 * message.document nên không cần logic đặc biệt cho forward.
 *
 * Row lưu vào `angel_channel_knowledge` (dùng chung schema),
 * source = "telegram_file" hoặc "google_sheet".
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import JSZip from "npm:jszip@3.10.1";
import { pushToAngelKnowledge } from "./angel-knowledge.ts";
import { fetchTelegramMedia, TelegramMediaError, redactToken } from "./telegram-media.ts";
import { callAiGateway, gatewayText } from "./ai-gateway-retry.ts";

const MAX_CONTENT = 190_000;
const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20MB — giới hạn Telegram bot getFile

export type FileIngestContext = {
  chatId: number;
  messageId: number;
  chatTitle?: string | null;
  chatUsername?: string | null;
  postedAt?: string | null;
  senderName?: string | null;
};

type TgPhoto = { file_id: string; file_unique_id?: string; width?: number; height?: number };
type TgDocument = {
  file_id: string;
  file_unique_id?: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
};
type TgMessage = {
  message_id: number;
  chat: { id: number; title?: string; username?: string };
  date?: number;
  text?: string;
  caption?: string;
  photo?: TgPhoto[];
  document?: TgDocument;
};

// ============ Helpers ============
function truncate(text: string): string {
  const clean = text.trim();
  if (clean.length <= MAX_CONTENT) return clean;
  return clean.slice(0, MAX_CONTENT) + "\n\n[...truncated]";
}

async function downloadFile(fileId: string): Promise<Uint8Array | null> {
  try {
    const media = await fetchTelegramMedia(fileId, { maxBytes: MAX_FILE_BYTES });
    return media.bytes;
  } catch (err) {
    if (err instanceof TelegramMediaError) throw new Error(`${err.code}: ${redactToken(err.message)}`);
    throw new Error(redactToken(err));
  }
}

function bytesToBase64(buf: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    binary += String.fromCharCode(...buf.subarray(i, i + chunk));
  }
  return btoa(binary);
}

// ============ Text extractors ============
async function extractDocxText(buf: Uint8Array): Promise<string> {
  const zip = await JSZip.loadAsync(buf);
  const docXml = zip.file("word/document.xml");
  if (!docXml) throw new Error("docx: missing word/document.xml");
  const xml = await docXml.async("string");
  // Nối các <w:t>…</w:t> lại thành text. Paragraph break tại </w:p>.
  const paragraphs = xml.split(/<\/w:p>/i).map((p) => {
    const texts = [...p.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/gi)].map((m) => m[1]);
    return texts.join("");
  });
  return paragraphs
    .map((s) =>
      s
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'"),
    )
    .filter((s) => s.trim())
    .join("\n");
}

async function extractPdfText(buf: Uint8Array, filename: string): Promise<string> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");
  const dataUrl = `data:application/pdf;base64,${bytesToBase64(buf)}`;
  const result = await callAiGateway(
    {
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "system",
          content:
            "Bạn là bộ trích xuất văn bản. Trả về nguyên văn nội dung có trong PDF, giữ nguyên ngôn ngữ gốc, giữ cấu trúc đoạn. Không thêm bình luận, không dịch, không tóm tắt.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: `Trích xuất toàn bộ nội dung văn bản trong file PDF (${filename}).` },
            { type: "file", file: { filename, file_data: dataUrl } },
          ],
        },
      ],
    },
    { apiKey, label: "pdf-extract" },
  );
  if (!result.ok) throw new Error(result.error || "pdf extract failed");
  return gatewayText(result);
}

async function extractXlsxText(buf: Uint8Array, filename: string): Promise<string> {
  // Lazy import — xlsx ~1MB, chỉ load khi thực sự cần.
  const XLSX = await import("npm:xlsx@0.18.5");
  const wb = XLSX.read(buf, { type: "array" });
  const parts: string[] = [];
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
    const trimmed = csv.trim();
    if (!trimmed) continue;
    parts.push(`# Sheet: ${sheetName}\n${trimmed}`);
  }
  if (parts.length === 0) throw new Error(`xlsx empty: ${filename}`);
  return parts.join("\n\n");
}

/** Nhận file_id Telegram, tải ảnh server-side rồi gửi base64 cho AI Gateway. */
async function extractImageText(fileId: string): Promise<string> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");
  const media = await fetchTelegramMedia(fileId, {
    allowedMimePrefixes: ["image/"],
    maxBytes: MAX_FILE_BYTES,
  });
  const result = await callAiGateway(
    {
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "system",
          content:
            "Bạn là bộ trích xuất và mô tả nội dung ảnh. Trả về 2 phần: (1) TEXT: toàn bộ văn bản đọc được trong ảnh (giữ ngôn ngữ gốc, giữ dòng), (2) DESCRIPTION: mô tả ngắn nội dung ảnh bằng tiếng Việt. Nếu ảnh không có chữ, để TEXT trống.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Trích xuất text + mô tả ảnh này." },
            { type: "image_url", image_url: { url: media.dataUrl } },
          ],
        },
      ],
    },
    { apiKey, label: "image-extract" },
  );
  if (!result.ok) throw new Error(result.error || "image extract failed");
  return gatewayText(result);
}

// ============ Google Sheets ============
const GSHEET_REGEX = /https?:\/\/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]{20,})/gi;
export function extractGoogleSheetIds(text: string | null | undefined): string[] {
  if (!text) return [];
  const ids = new Set<string>();
  for (const m of text.matchAll(GSHEET_REGEX)) if (m[1]) ids.add(m[1]);
  return [...ids];
}

async function fetchGoogleSheetCsv(
  sheetId: string,
): Promise<{ ok: true; content: string } | { ok: false; error: string }> {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
  try {
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("text/html")) return { ok: false, error: "sheet_not_public" };
    let text = await res.text();
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    text = text.trim();
    if (!text) return { ok: false, error: "empty sheet" };
    return { ok: true, content: text };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ============ Main ingest per attachment ============
async function saveKnowledgeRow(
  admin: SupabaseClient,
  ctx: FileIngestContext,
  meta: {
    mediaType: string;
    sourceRef: string;
    title: string;
    content: string;
    rawInfo: Record<string, unknown>;
    fileUrl?: string;
    pushOk: boolean;
    pushError?: string;
    reference?: string;
  },
) {
  await admin
    .from("angel_channel_knowledge")
    .upsert(
      {
        chat_id: ctx.chatId,
        message_id: ctx.messageId,
        content: meta.content.slice(0, 10_000),
        media_type: meta.mediaType,
        posted_at: ctx.postedAt ?? null,
        raw_message: { ...meta.rawInfo, source_message_id: ctx.messageId, title: meta.title },
        pushed_to_core: meta.pushOk,
        pushed_at: meta.pushOk ? new Date().toISOString() : null,
        push_error: meta.pushError || null,
        core_reference: meta.reference || null,
      },
      { onConflict: "chat_id,message_id" },
    );
}

export async function ingestTelegramFilesFromMessage(
  admin: SupabaseClient,
  message: TgMessage,
  ctx: FileIngestContext,
): Promise<{ processed: number; pushed: number; failed: number; errors: string[] }> {
  const summary = { processed: 0, pushed: 0, failed: 0, errors: [] as string[] };
  const caption = (message.caption || "").trim();
  const chatLabel = ctx.chatTitle || ctx.chatUsername || String(ctx.chatId);

  const doIngest = async (payload: {
    kind: string;
    sourceRef: string;
    title: string;
    content: string;
    url?: string;
    rawInfo: Record<string, unknown>;
  }) => {
    summary.processed++;
    const content = truncate(
      caption ? `${caption}\n\n---\n${payload.content}` : payload.content,
    );
    if (!content.trim()) {
      summary.failed++;
      summary.errors.push(`${payload.sourceRef}: empty content`);
      await saveKnowledgeRow(admin, ctx, {
        mediaType: payload.kind,
        sourceRef: payload.sourceRef,
        title: payload.title,
        content: "",
        rawInfo: payload.rawInfo,
        pushOk: false,
        pushError: "empty content",
      });
      return;
    }
    const result = await pushToAngelKnowledge(
      {
        source: payload.kind === "google_sheet" ? "google_sheet" : "telegram_file",
        source_ref: payload.sourceRef,
        title: payload.title,
        content,
        url: payload.url,
        language: "vi",
        folder: `Telegram Files / ${chatLabel}`,
        metadata: {
          chat_id: ctx.chatId,
          chat_title: ctx.chatTitle,
          chat_username: ctx.chatUsername,
          source_message_id: ctx.messageId,
          sender_name: ctx.senderName,
          posted_at: ctx.postedAt,
          media_type: payload.kind,
          ...payload.rawInfo,
        },
      },
      { chunk_now: true, verify: true },
    );

    if (result.ok) summary.pushed++;
    else if (!result.skipped) {
      summary.failed++;
      summary.errors.push(`${payload.sourceRef}: ${result.error}`);
    }

    await saveKnowledgeRow(admin, ctx, {
      mediaType: payload.kind,
      sourceRef: payload.sourceRef,
      title: payload.title,
      content,
      rawInfo: payload.rawInfo,
      pushOk: result.ok,
      pushError: result.ok ? undefined : result.skipped ? undefined : result.error,
      reference: result.reference,
    });
  };

  // ---- Google Sheets links trong text/caption ----
  const linkSource = `${message.text || ""}\n${caption}`;
  for (const sheetId of extractGoogleSheetIds(linkSource)) {
    try {
      const fetched = await fetchGoogleSheetCsv(sheetId);
      if (!fetched.ok) {
        summary.processed++;
        summary.failed++;
        summary.errors.push(`sheet ${sheetId}: ${fetched.error}`);
        console.log(`[files-ingest] sheet fetch failed ${sheetId}: ${fetched.error}`);
        continue;
      }
      await doIngest({
        kind: "google_sheet",
        sourceRef: `gsheet:${sheetId}`,
        title: `Google Sheet từ ${chatLabel}`,
        content: fetched.content,
        url: `https://docs.google.com/spreadsheets/d/${sheetId}/edit`,
        rawInfo: { google_sheet_id: sheetId },
      });
    } catch (err) {
      summary.failed++;
      summary.errors.push(`sheet ${sheetId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // ---- Ảnh ----
  if (Array.isArray(message.photo) && message.photo.length > 0) {
    const largest = message.photo[message.photo.length - 1];
    try {
      const content = await extractImageText(largest.file_id);
      const uniq = largest.file_unique_id || largest.file_id;
      await doIngest({
        kind: "photo",
        sourceRef: `tg-photo:${uniq}`,
        title: caption ? `Ảnh: ${caption.slice(0, 120)}` : `Ảnh từ ${chatLabel}`,
        content,
        rawInfo: { file_unique_id: largest.file_unique_id, file_id: largest.file_id },
      });
    } catch (err) {
      summary.processed++;
      summary.failed++;
      const msg = err instanceof Error ? err.message : String(err);
      summary.errors.push(`photo: ${msg}`);
      console.error(`[files-ingest] photo failed`, err);
    }
  }

  // ---- Document ----
  const doc = message.document;
  if (doc?.file_id) {
    const filename = doc.file_name || "document";
    const mime = (doc.mime_type || "").toLowerCase();
    const lower = filename.toLowerCase();
    const isPdf = mime.includes("pdf") || lower.endsWith(".pdf");
    const isDocx =
      mime.includes("officedocument.wordprocessingml") || lower.endsWith(".docx");
    const isXlsx =
      mime.includes("officedocument.spreadsheetml") || lower.endsWith(".xlsx");
    const isXls =
      !isXlsx && (mime === "application/vnd.ms-excel" || lower.endsWith(".xls"));
    const isDocLegacy =
      !isDocx && (mime === "application/msword" || lower.endsWith(".doc"));
    const isImageDoc =
      mime.startsWith("image/") ||
      lower.endsWith(".jpg") || lower.endsWith(".jpeg") ||
      lower.endsWith(".png") || lower.endsWith(".webp") ||
      lower.endsWith(".gif") || lower.endsWith(".bmp");
    const isMd = mime.includes("markdown") || lower.endsWith(".md") || lower.endsWith(".markdown");
    const isText =
      !isMd &&
      (mime.startsWith("text/") ||
        lower.endsWith(".txt") ||
        lower.endsWith(".log") ||
        lower.endsWith(".csv"));

    if (isDocLegacy) {
      console.log(`[files-ingest] skip legacy .doc (use .docx instead): ${filename}`);
    } else if (!isPdf && !isDocx && !isXlsx && !isXls && !isImageDoc && !isMd && !isText) {
      console.log(`[files-ingest] skip unsupported doc: ${filename} (${mime})`);
    } else {
      const uniq = doc.file_unique_id || doc.file_id;
      try {
        let content = "";
        let kind = "document";
        if (isImageDoc) {
          // Ảnh gửi dạng "Send as File" — tải server-side, gửi base64 cho AI.
          content = await extractImageText(doc.file_id);
          kind = "image-doc";
        } else {
          const buf = await downloadFile(doc.file_id);
          if (!buf) throw new Error("cannot download");
          if (isPdf) {
            content = await extractPdfText(buf, filename);
            kind = "pdf";
          } else if (isDocx) {
            content = await extractDocxText(buf);
            kind = "docx";
          } else if (isXlsx || isXls) {
            content = await extractXlsxText(buf, filename);
            kind = isXlsx ? "xlsx" : "xls";
          } else {
            content = new TextDecoder("utf-8", { fatal: false }).decode(buf);
            if (content.charCodeAt(0) === 0xfeff) content = content.slice(1);
            kind = isMd ? "markdown" : "text";
          }
        }
        await doIngest({
          kind,
          sourceRef: `tg-doc:${uniq}`,
          title: filename,
          content,
          rawInfo: { file_name: filename, mime_type: mime, file_size: doc.file_size, file_unique_id: doc.file_unique_id },
        });
      } catch (err) {
        summary.processed++;
        summary.failed++;
        const msg = err instanceof Error ? err.message : String(err);
        summary.errors.push(`${filename}: ${msg}`);
        console.error(`[files-ingest] doc ${filename} failed`, err);
      }
    }
  }

  return summary;
}
