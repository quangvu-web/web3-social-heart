// _shared/angel/intents/youtube.ts
// Sprint 2 — Thin wrapper cho phát hiện link YouTube. Regex hiện đặt inline
// trong `telegram-community.ts` (~line 1964). Sprint 3 sẽ tách hẳn ra file
// riêng ở `angel-youtube-fetch.ts`; hiện tại giữ 1 detector độc lập tối
// giản để dùng ở entry point mới.

const YT_REGEX =
  /https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/i;

export interface YouTubeIntent {
  url: string;
  videoId: string;
}

export function detectYouTubeIntent(text: string | null | undefined): YouTubeIntent | null {
  if (!text) return null;
  const m = YT_REGEX.exec(text);
  if (!m) return null;
  return { url: m[0], videoId: m[1] };
}
