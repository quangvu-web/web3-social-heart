export function playbackDeadline(durationSec: unknown, now = Date.now()): string {
  const seconds = typeof durationSec === "number" && Number.isFinite(durationSec) && durationSec > 0
    ? Math.min(Math.ceil(durationSec), 7000) : 1800;
  return new Date(now + (seconds + 20) * 1000).toISOString();
}

export function playbackSuppressesTranscript(status: string | null, until: string | null, now = Date.now()): boolean {
  return status === "playing" && (!until || Date.parse(until) > now);
}

export function isCaptionMediaSignedUrl(trackUrl: string, backendUrl: string, expectedPath?: string): boolean {
  try {
    const track = new URL(trackUrl);
    const backend = new URL(backendUrl);
    const objectPath = decodeURIComponent(track.pathname.slice("/storage/v1/object/sign/caption-media/".length));
    return track.protocol === "https:" && track.origin === backend.origin &&
      track.pathname.startsWith("/storage/v1/object/sign/caption-media/") &&
      (!expectedPath || objectPath === expectedPath) &&
      Boolean(track.searchParams.get("token"));
  } catch { return false; }
}

export function captionPlayerUrl(base: string, code: string, trackUrl: string, title: string): string {
  const url = new URL(`${base}/${encodeURIComponent(code)}`);
  url.searchParams.set("t", trackUrl);
  url.searchParams.set("title", title);
  return url.toString();
}
