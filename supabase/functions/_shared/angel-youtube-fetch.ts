/**
 * On-demand YouTube transcript fetcher cho luồng chat Angel (DM + group).
 *
 * Khác với `angel-youtube-ingest.ts` (ingest vào knowledge base cho
 * angel_watched_channels), module này chỉ fetch + trả transcript để inline
 * vào prompt của `askAngel()`.
 *
 * Cache 2 tầng theo videoId:
 *   1. In-memory Map (hot cache, TTL 10 phút — sống trong 1 instance edge).
 *   2. Bảng `angel_youtube_transcript_cache` (persistent, TTL 30 ngày cho
 *      transcript OK / 1 giờ cho failure) — sống qua cold start & share giữa
 *      các instance edge function.
 */

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.45.0";

const YT_REGEXES: RegExp[] = [
  /https?:\/\/(?:www\.|m\.)?youtube\.com\/watch\?[^\s]*[?&]v=([a-zA-Z0-9_-]{11})/gi,
  /https?:\/\/(?:www\.|m\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/gi,
  /https?:\/\/youtu\.be\/([a-zA-Z0-9_-]{11})(?:\?[^\s]*)?/gi,
  /https?:\/\/(?:www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/gi,
  /https?:\/\/(?:www\.)?youtube\.com\/live\/([a-zA-Z0-9_-]{11})/gi,
  /https?:\/\/(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/gi,
];

const YT_BARE_LINK_RE =
  /^(?:\s|[\p{Emoji}\p{P}])*https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?[^\s]*|shorts\/[a-zA-Z0-9_-]+|live\/[a-zA-Z0-9_-]+|embed\/[a-zA-Z0-9_-]+)|youtu\.be\/[a-zA-Z0-9_-]+(?:\?[^\s]*)?)(?:\s|[\p{Emoji}\p{P}])*$/u;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const MAX_INLINE_CHARS = 12_000;
const MEM_CACHE_TTL_MS = 10 * 60 * 1000;
const DB_CACHE_TTL_OK_MS = 30 * 24 * 60 * 60 * 1000; // 30 ngày
const DB_CACHE_TTL_FAIL_SHORT_MS = 5 * 60 * 1000;    // 5 phút — cho lỗi rate-limit / network / parse
const DB_CACHE_TTL_FAIL_LONG_MS = 24 * 60 * 60 * 1000; // 24 giờ — cho no_captions / private / unplayable
const FETCH_TIMEOUT_MS = 10_000;

function pickFailTtl(reason: string): number {
  if (
    reason === "no_captions" ||
    reason.startsWith("unplayable:") ||
    reason === "LOGIN_REQUIRED" ||
    reason.startsWith("unplayable:LOGIN_REQUIRED")
  ) {
    return DB_CACHE_TTL_FAIL_LONG_MS;
  }
  return DB_CACHE_TTL_FAIL_SHORT_MS;
}

export type YouTubeTranscript = {
  videoId: string;
  url: string;
  title: string;
  author?: string;
  language: string; // e.g. "vi", "en"
  isAuto: boolean;
  transcript: string;
};

export type YouTubeFetchFailure = {
  videoId: string;
  url: string;
  reason: string;
  title?: string;
  author?: string;
};

type CachedEntry =
  | { ok: true; at: number; value: YouTubeTranscript }
  | { ok: false; at: number; value: YouTubeFetchFailure };

const memCache = new Map<string, CachedEntry>();

let _admin: SupabaseClient | null = null;
function getAdmin(): SupabaseClient | null {
  if (_admin) return _admin;
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  _admin = createClient(url, key, { auth: { persistSession: false } });
  return _admin;
}

async function readDbCache(
  videoId: string,
): Promise<YouTubeTranscript | YouTubeFetchFailure | null> {
  const admin = getAdmin();
  if (!admin) return null;
  try {
    const { data, error } = await admin
      .from("angel_youtube_transcript_cache")
      .select("*")
      .eq("video_id", videoId)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (error || !data) return null;
    // Bump hit_count (fire-and-forget).
    admin
      .from("angel_youtube_transcript_cache")
      .update({ hit_count: (data.hit_count ?? 0) + 1 })
      .eq("video_id", videoId)
      .then(() => {}, () => {});
    if (data.transcript) {
      return {
        videoId,
        url: data.url,
        title: data.title || `YouTube ${videoId}`,
        author: data.author || undefined,
        language: data.language || "vi",
        isAuto: !!data.is_auto,
        transcript: data.transcript,
      };
    }
    if (data.failure_reason) {
      return {
        videoId,
        url: data.url,
        reason: data.failure_reason,
        title: data.title || undefined,
        author: data.author || undefined,
      };
    }
    return null;
  } catch {
    return null;
  }
}

async function writeDbCache(
  videoId: string,
  entry: YouTubeTranscript | YouTubeFetchFailure,
): Promise<void> {
  const admin = getAdmin();
  if (!admin) return;
  const isOk = isYouTubeTranscript(entry);
  const ttl = isOk
    ? DB_CACHE_TTL_OK_MS
    : pickFailTtl((entry as YouTubeFetchFailure).reason || "");
  const row = {
    video_id: videoId,
    url: entry.url,
    title: entry.title ?? null,
    author: (entry as YouTubeTranscript).author ?? null,
    language: isOk ? (entry as YouTubeTranscript).language : null,
    is_auto: isOk ? (entry as YouTubeTranscript).isAuto : false,
    transcript: isOk ? (entry as YouTubeTranscript).transcript : null,
    failure_reason: isOk ? null : (entry as YouTubeFetchFailure).reason,
    fetched_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + ttl).toISOString(),
  };
  try {
    await admin
      .from("angel_youtube_transcript_cache")
      .upsert(row, { onConflict: "video_id" });
  } catch {
    // ignore cache write failures
  }
}

export function extractYouTubeIds(text: string | null | undefined): string[] {
  if (!text) return [];
  const ids = new Set<string>();
  for (const re of YT_REGEXES) {
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) {
      if (m[1]) ids.add(m[1]);
    }
  }
  return [...ids];
}

/** Trả true nếu message chỉ chứa link YouTube (có thể kèm emoji/whitespace/punct), không có câu hỏi. */
export function isBareYouTubeLink(text: string | null | undefined): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  if (!trimmed) return false;
  // Cho phép nhiều emoji xung quanh link; nhưng phải chỉ có 1 link, không có từ khác.
  if (!YT_BARE_LINK_RE.test(trimmed)) return false;
  return true;
}

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
  const noTags = xml.replace(/<[^>]+>/g, " ");
  return decodeHtmlEntities(noTags).replace(/\s+/g, " ").trim();
}

type CaptionTrack = {
  baseUrl: string;
  languageCode?: string;
  kind?: string;
  name?: { simpleText?: string };
};

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, {
      redirect: "follow",
      headers: { "User-Agent": UA, "Accept-Language": "vi,en;q=0.8" },
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchYouTubePlayer(videoId: string): Promise<
  | { ok: true; title: string; tracks: CaptionTrack[]; author?: string }
  | { ok: false; error: string; title?: string; author?: string }
> {
  const res = await fetchWithTimeout(
    `https://www.youtube.com/watch?v=${videoId}&hl=vi`,
    FETCH_TIMEOUT_MS,
  );
  if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
  const html = await res.text();
  const marker = "ytInitialPlayerResponse = ";
  const start = html.indexOf(marker);
  if (start === -1) return { ok: false, error: "no_player_response" };
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
  } catch {
    return { ok: false, error: "parse_player_response" };
  }
  const status = data?.playabilityStatus?.status;
  const title = data?.videoDetails?.title || `YouTube ${videoId}`;
  const author = data?.videoDetails?.author;
  if (status && status !== "OK") {
    return { ok: false, error: `unplayable:${status}`, title, author };
  }
  const tracks: CaptionTrack[] =
    data?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
  return { ok: true, title, tracks, author };
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
  const url = track.baseUrl;
  if (!url) return { ok: false, error: "no_baseUrl" };
  const res = await fetchWithTimeout(url, FETCH_TIMEOUT_MS);
  if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
  const body = await res.text();
  const text = stripXml(body);
  if (!text) return { ok: false, error: "empty_transcript" };
  return { ok: true, content: text };
}

/** oEmbed — public, low-rate-limit metadata endpoint. Không cần captions. */
async function fetchOEmbed(videoId: string): Promise<{ title?: string; author?: string }> {
  try {
    const res = await fetchWithTimeout(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
      6000,
    );
    if (!res.ok) return {};
    const data = await res.json().catch(() => null) as any;
    return {
      title: typeof data?.title === "string" ? data.title : undefined,
      author: typeof data?.author_name === "string" ? data.author_name : undefined,
    };
  } catch {
    return {};
  }
}

/** InnerTube player endpoint — Android/iOS client bypasses HTML consent + rate-limit. */
async function fetchInnerTubePlayer(videoId: string): Promise<
  | { ok: true; title: string; tracks: CaptionTrack[]; author?: string }
  | { ok: false; error: string; title?: string; author?: string }
> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch("https://www.youtube.com/youtubei/v1/player?prettyPrint=false", {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "Content-Type": "application/json",
        "User-Agent":
          "com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip",
        "X-Youtube-Client-Name": "3",
        "X-Youtube-Client-Version": "19.09.37",
        "Accept-Language": "vi,en;q=0.8",
      },
      body: JSON.stringify({
        videoId,
        context: {
          client: {
            clientName: "ANDROID",
            clientVersion: "19.09.37",
            androidSdkVersion: 30,
            hl: "vi",
            gl: "VN",
          },
        },
      }),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const data = await res.json().catch(() => null) as any;
    if (!data) return { ok: false, error: "parse_innertube" };
    const status = data?.playabilityStatus?.status;
    const title = data?.videoDetails?.title || `YouTube ${videoId}`;
    const author = data?.videoDetails?.author;
    if (status && status !== "OK") {
      return { ok: false, error: `unplayable:${status}`, title, author };
    }
    const tracks: CaptionTrack[] =
      data?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
    return { ok: true, title, tracks, author };
  } catch (err) {
    return { ok: false, error: `innertube_exception:${err instanceof Error ? err.message : String(err)}` };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchYouTubeTranscript(
  videoId: string,
): Promise<YouTubeTranscript | YouTubeFetchFailure> {
  const now = Date.now();

  // Layer 1: in-memory hot cache.
  const cached = memCache.get(videoId);
  if (cached && now - cached.at < MEM_CACHE_TTL_MS) {
    return cached.value;
  }

  // Layer 2: persistent DB cache (survives cold starts).
  const dbHit = await readDbCache(videoId);
  if (dbHit) {
    const ok = isYouTubeTranscript(dbHit);
    memCache.set(videoId, { ok, at: now, value: dbHit } as CachedEntry);
    return dbHit;
  }

  const url = `https://www.youtube.com/watch?v=${videoId}`;

  const finalize = (
    entry: YouTubeTranscript | YouTubeFetchFailure,
  ): YouTubeTranscript | YouTubeFetchFailure => {
    const ok = isYouTubeTranscript(entry);
    memCache.set(videoId, { ok, at: now, value: entry } as CachedEntry);
    writeDbCache(videoId, entry).catch(() => {});
    return entry;
  };

  // Multi-source strategy: InnerTube (Android) trước → HTML fallback.
  // InnerTube ít bị 429 hơn nhiều và không cần vượt consent gate.
  let title: string | undefined;
  let author: string | undefined;
  let tracks: CaptionTrack[] = [];
  let lastError = "unknown";

  const inner = await fetchInnerTubePlayer(videoId);
  if (inner.ok) {
    title = inner.title;
    author = inner.author;
    tracks = inner.tracks;
  } else {
    lastError = inner.error;
    title = inner.title;
    author = inner.author;
    // Fallback: HTML page (chỉ khi InnerTube không trả unplayable/login).
    if (!inner.error.startsWith("unplayable:") && inner.error !== "LOGIN_REQUIRED") {
      const html = await fetchYouTubePlayer(videoId).catch(() =>
        ({ ok: false as const, error: "html_exception" }),
      );
      if (html.ok) {
        title = html.title;
        author = html.author;
        tracks = html.tracks;
        lastError = "unknown";
      } else {
        lastError = html.error;
        title = title || (html as any).title;
        author = author || (html as any).author;
      }
    }
  }

  // Nếu vẫn chưa có title, xin oEmbed để có metadata tối thiểu (Angel còn giải thích được).
  if (!title) {
    const meta = await fetchOEmbed(videoId);
    title = meta.title || `YouTube ${videoId}`;
    author = author || meta.author;
  }

  if (tracks.length === 0) {
    // Phân biệt: nếu lastError khác "unknown" → dùng error đó; else no_captions.
    const reason = lastError !== "unknown" ? lastError : "no_captions";
    return finalize({ videoId, url, reason, title, author });
  }

  const track = pickTrack(tracks);
  if (!track) {
    return finalize({ videoId, url, reason: "no_captions", title, author });
  }
  const tx = await fetchTranscript(track);
  if (!tx.ok) {
    return finalize({
      videoId,
      url,
      reason: `transcript_fetch_failed:${tx.error}`,
      title,
      author,
    });
  }
  let content = tx.content;
  if (content.length > MAX_INLINE_CHARS) {
    content = content.slice(0, MAX_INLINE_CHARS) + " […truncated]";
  }
  const language = (track.languageCode || "vi").split("-")[0].toLowerCase();
  const isAuto = (track.kind || "").toLowerCase() === "asr";
  return finalize({
    videoId,
    url,
    title: title || `YouTube ${videoId}`,
    author,
    language,
    isAuto,
    transcript: content,
  });
}


export function isYouTubeTranscript(
  v: YouTubeTranscript | YouTubeFetchFailure,
): v is YouTubeTranscript {
  return (v as YouTubeTranscript).transcript !== undefined;
}

const REASON_LABEL: Record<string, string> = {
  no_captions: "video không có phụ đề",
  no_player_response: "không đọc được trang video",
  parse_player_response: "không đọc được metadata video",
};

export function humanizeFailureReason(reason: string): string {
  if (REASON_LABEL[reason]) return REASON_LABEL[reason];
  if (reason.startsWith("unplayable:")) return `video không khả dụng (${reason.slice(11)})`;
  if (reason.startsWith("transcript_fetch_failed")) return "không tải được phụ đề";
  if (reason.startsWith("HTTP ")) return `YouTube trả lỗi ${reason}`;
  if (reason.startsWith("exception:")) return "kết nối YouTube gặp sự cố";
  return reason;
}

/**
 * Build khối context inline vào user message (Mirror-safe).
 *
 * Trả về `null` nếu không có video YouTube nào trong text hoặc feature bị disable
 * qua env `ANGEL_YT_DISABLED=1`. Nếu có video nhưng fetch fail hết, vẫn trả context
 * mô tả lỗi để Angel giải thích cho user thay vì rơi vào fallback "đang bận".
 */
export async function buildYouTubeContextBlock(
  text: string,
  opts?: { maxVideos?: number },
): Promise<{
  block: string;
  fetched: YouTubeTranscript[];
  failed: YouTubeFetchFailure[];
} | null> {
  if (Deno.env.get("ANGEL_YT_DISABLED") === "1") return null;
  const ids = extractYouTubeIds(text);
  if (ids.length === 0) return null;
  const maxN = Math.max(1, Math.min(3, opts?.maxVideos ?? 2));
  const targetIds = ids.slice(0, maxN);

  const results = await Promise.all(targetIds.map((vid) => fetchYouTubeTranscript(vid)));
  const fetched: YouTubeTranscript[] = [];
  const failed: YouTubeFetchFailure[] = [];
  const parts: string[] = [];

  for (const r of results) {
    if (isYouTubeTranscript(r)) {
      fetched.push(r);
      parts.push(
        `[YOUTUBE VIDEO — Angel vừa đọc trực tiếp phụ đề, hãy dùng đúng nội dung này khi trả lời]\n` +
          `Video: ${r.title}\n` +
          (r.author ? `Kênh: ${r.author}\n` : "") +
          `URL: ${r.url}\n` +
          `Ngôn ngữ phụ đề: ${r.language}${r.isAuto ? " (tự động)" : ""}\n` +
          `--- TRANSCRIPT ---\n${r.transcript}\n--- END TRANSCRIPT ---`,
      );
    } else {
      failed.push(r);
      parts.push(
        `[YOUTUBE VIDEO — Angel KHÔNG đọc được phụ đề]\n` +
          `URL: ${r.url}\n` +
          (r.title ? `Video: ${r.title}\n` : "") +
          (r.author ? `Kênh: ${r.author}\n` : "") +
          `Lý do: ${humanizeFailureReason(r.reason)}. Hãy trả lời ngắn gọn giải thích Angel không đọc được nội dung video này, và mời user tóm tắt hoặc gửi transcript để Angel cùng suy ngẫm.`,
      );
    }
  }

  return { block: parts.join("\n\n"), fetched, failed };
}
