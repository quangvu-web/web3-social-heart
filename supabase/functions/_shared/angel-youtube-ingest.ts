/**
 * Ingest YouTube links từ tin nhắn Telegram (channel hoặc group) vào
 * Angel AI knowledge.
 *
 * Trích xuất transcript/phụ đề (ưu tiên tiếng Việt → tiếng Anh → bất kỳ)
 * từ trang xem video công khai. Nếu video không có phụ đề (auto hoặc thủ
 * công), row vẫn được lưu với push_error để admin thấy.
 *
 * Row lưu vào `angel_channel_knowledge`, media_type = "youtube",
 * source = "youtube" khi push lên Angel AI gốc.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { pushToAngelKnowledge } from "./angel-knowledge.ts";

const YT_REGEXES: RegExp[] = [
  /https?:\/\/(?:www\.|m\.)?youtube\.com\/watch\?[^\s]*[?&]v=([a-zA-Z0-9_-]{11})/gi,
  /https?:\/\/(?:www\.|m\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/gi,
  /https?:\/\/youtu\.be\/([a-zA-Z0-9_-]{11})/gi,
  /https?:\/\/(?:www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/gi,
  /https?:\/\/(?:www\.)?youtube\.com\/live\/([a-zA-Z0-9_-]{11})/gi,
  /https?:\/\/(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/gi,
];

const MAX_CONTENT = 190_000;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export function extractYouTubeIds(text: string | null | undefined): string[] {
  if (!text) return [];
  const ids = new Set<string>();
  for (const re of YT_REGEXES) {
    for (const m of text.matchAll(re)) {
      if (m[1]) ids.add(m[1]);
    }
  }
  return [...ids];
}

type CaptionTrack = {
  baseUrl: string;
  languageCode?: string;
  kind?: string; // "asr" = auto
  name?: { simpleText?: string };
};

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function stripXml(xml: string): string {
  // Loại tags, giữ text; hỗ trợ cả <text ...>...</text> và WebVTT-ish.
  const noTags = xml.replace(/<[^>]+>/g, " ");
  return decodeHtmlEntities(noTags).replace(/\s+/g, " ").trim();
}

function ytAuthHeaders(): Record<string, string> {
  const cookie = Deno.env.get("YOUTUBE_COOKIE") || "";
  const h: Record<string, string> = {
    "User-Agent": UA,
    "Accept-Language": "vi,en;q=0.8",
  };
  if (cookie) h["Cookie"] = cookie;
  return h;
}

async function fetchYouTubePlayer(videoId: string): Promise<
  | { ok: true; title: string; tracks: CaptionTrack[]; author?: string }
  | { ok: false; error: string }
> {
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=vi`, {
      redirect: "follow",
      headers: ytAuthHeaders(),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const html = await res.text();
    const marker = "ytInitialPlayerResponse = ";
    const start = html.indexOf(marker);
    if (start === -1) return { ok: false, error: "no_player_response" };
    // Parse JSON tới dấu `;</script>` hoặc `};` ổn định.
    let i = start + marker.length;
    let depth = 0;
    let inStr = false;
    let esc = false;
    const begin = i;
    for (; i < html.length; i++) {
      const c = html[i];
      if (inStr) {
        if (esc) esc = false;
        else if (c === "\\") esc = true;
        else if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') inStr = true;
      else if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) {
          i++;
          break;
        }
      }
    }
    const jsonStr = html.slice(begin, i);
    let data: any;
    try {
      data = JSON.parse(jsonStr);
    } catch (e) {
      return { ok: false, error: "parse_player_response" };
    }
    const status = data?.playabilityStatus?.status;
    if (status && status !== "OK") {
      return { ok: false, error: `unplayable:${status}` };
    }
    const title = data?.videoDetails?.title || `YouTube ${videoId}`;
    const author = data?.videoDetails?.author;
    const tracks: CaptionTrack[] =
      data?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
    return { ok: true, title, tracks, author };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function pickTrack(tracks: CaptionTrack[]): CaptionTrack | null {
  if (!tracks.length) return null;
  const byLang = (code: string, kind?: string) =>
    tracks.find(
      (t) =>
        t.languageCode?.toLowerCase().startsWith(code) &&
        (kind === undefined || (t.kind || "") === kind),
    );
  return (
    byLang("vi", "") ||
    byLang("vi") ||
    byLang("en", "") ||
    byLang("en") ||
    tracks[0]
  );
}

async function fetchTranscript(track: CaptionTrack): Promise<
  { ok: true; content: string } | { ok: false; error: string }
> {
  try {
    const url = track.baseUrl;
    if (!url) return { ok: false, error: "no_baseUrl" };
    const res = await fetch(url, { headers: ytAuthHeaders() });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const body = await res.text();
    const text = stripXml(body);
    if (!text) return { ok: false, error: "empty_transcript" };
    return { ok: true, content: text };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export type YoutubeIngestContext = {
  chatId: number;
  messageId: number;
  chatTitle?: string | null;
  chatUsername?: string | null;
  postedAt?: string | null;
  senderName?: string | null;
};

export async function ingestYouTubeFromMessage(
  admin: SupabaseClient,
  text: string | null | undefined,
  ctx: YoutubeIngestContext,
): Promise<{ found: number; pushed: number; failed: number; errors: string[] }> {
  const ids = extractYouTubeIds(text);
  const summary = { found: ids.length, pushed: 0, failed: 0, errors: [] as string[] };
  if (ids.length === 0) return summary;

  for (const vid of ids) {
    const sourceRef = `youtube:${vid}`;
    const videoUrl = `https://www.youtube.com/watch?v=${vid}`;

    const player = await fetchYouTubePlayer(vid);
    if (!player.ok) {
      summary.failed++;
      summary.errors.push(`${vid}: ${player.error}`);
      await admin.from("angel_channel_knowledge").upsert(
        {
          chat_id: ctx.chatId,
          message_id: ctx.messageId,
          content: null,
          media_type: "youtube",
          posted_at: ctx.postedAt ?? null,
          raw_message: { youtube_id: vid, youtube_url: videoUrl, source_message_id: ctx.messageId },
          pushed_to_core: false,
          push_error: null,
          youtube_error: player.error,
          core_reference: null,
        },
        { onConflict: "chat_id,message_id" },
      );

      console.log(`[youtube-ingest] player failed vid=${vid} err=${player.error}`);
      continue;
    }

    const track = pickTrack(player.tracks);
    if (!track) {
      summary.failed++;
      summary.errors.push(`${vid}: no_captions`);
      await admin.from("angel_channel_knowledge").upsert(
        {
          chat_id: ctx.chatId,
          message_id: ctx.messageId,
          content: null,
          media_type: "youtube",
          posted_at: ctx.postedAt ?? null,
          raw_message: {
            youtube_id: vid,
            youtube_url: videoUrl,
            title: player.title,
            author: player.author,
            source_message_id: ctx.messageId,
          },
          pushed_to_core: false,
          push_error: null,
          youtube_error: "no_captions (video không có phụ đề)",
          core_reference: null,
        },
        { onConflict: "chat_id,message_id" },
      );

      console.log(`[youtube-ingest] no captions vid=${vid} title="${player.title}"`);
      continue;
    }

    const tx = await fetchTranscript(track);
    if (!tx.ok) {
      summary.failed++;
      summary.errors.push(`${vid}: ${tx.error}`);
      await admin.from("angel_channel_knowledge").upsert(
        {
          chat_id: ctx.chatId,
          message_id: ctx.messageId,
          content: null,
          media_type: "youtube",
          posted_at: ctx.postedAt ?? null,
          raw_message: {
            youtube_id: vid,
            youtube_url: videoUrl,
            title: player.title,
            language: track.languageCode,
            source_message_id: ctx.messageId,
          },
          pushed_to_core: false,
          push_error: null,
          youtube_error: `transcript_fetch_failed: ${tx.error}`,
          core_reference: null,
        },
        { onConflict: "chat_id,message_id" },
      );

      console.log(`[youtube-ingest] transcript failed vid=${vid} err=${tx.error}`);
      continue;
    }

    let content = tx.content;
    if (content.length > MAX_CONTENT) content = content.slice(0, MAX_CONTENT) + "\n\n[...truncated]";

    const isAuto = (track.kind || "").toLowerCase() === "asr";
    const lang = (track.languageCode || "vi").split("-")[0].toLowerCase();
    const header =
      `Video YouTube: ${player.title}\n` +
      `URL: ${videoUrl}\n` +
      (player.author ? `Kênh: ${player.author}\n` : "") +
      `Ngôn ngữ phụ đề: ${track.languageCode || "?"}${isAuto ? " (tự động)" : ""}\n\n` +
      `--- TRANSCRIPT ---\n`;
    const fullContent = (header + content).slice(0, MAX_CONTENT);

    const title = player.title.length > 200 ? player.title.slice(0, 197) + "…" : player.title;

    const result = await pushToAngelKnowledge(
      {
        source: "youtube",
        source_ref: sourceRef,
        title,
        content: fullContent,
        url: videoUrl,
        language: lang === "en" ? "en" : "vi",
        folder: `YouTube / ${ctx.chatTitle || ctx.chatUsername || ctx.chatId}`,
        metadata: {
          youtube_id: vid,
          youtube_url: videoUrl,
          video_title: player.title,
          author: player.author,
          caption_language: track.languageCode,
          caption_is_auto: isAuto,
          chat_id: ctx.chatId,
          chat_title: ctx.chatTitle,
          chat_username: ctx.chatUsername,
          source_message_id: ctx.messageId,
          sender_name: ctx.senderName,
          posted_at: ctx.postedAt,
        },
      },
      { chunk_now: true, verify: true },
    );

    await admin.from("angel_channel_knowledge").upsert(
      {
        chat_id: ctx.chatId,
        message_id: ctx.messageId,
        content: fullContent.slice(0, 10_000),
        media_type: "youtube",
        posted_at: ctx.postedAt ?? null,
        raw_message: {
          youtube_id: vid,
          youtube_url: videoUrl,
          title: player.title,
          author: player.author,
          caption_language: track.languageCode,
          caption_is_auto: isAuto,
          source_message_id: ctx.messageId,
        },
        pushed_to_core: result.ok,
        pushed_at: result.ok ? new Date().toISOString() : null,
        push_error: result.ok ? null : result.skipped ? null : result.error || "unknown",
        core_reference: result.reference || null,
      },
      { onConflict: "chat_id,message_id" },
    );

    if (result.ok) {
      summary.pushed++;
      console.log(`[youtube-ingest] pushed vid=${vid} lang=${track.languageCode} auto=${isAuto}`);
    } else if (result.skipped) {
      console.log(`[youtube-ingest] skipped vid=${vid} (no ingest key)`);
    } else {
      summary.failed++;
      summary.errors.push(`${vid}: push_failed ${result.error}`);
      console.log(`[youtube-ingest] push failed vid=${vid} err=${result.error}`);
    }
  }

  return summary;
}
