import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { captionPlayerUrl, isCaptionMediaSignedUrl, playbackDeadline, playbackSuppressesTranscript } from "./playback-utils.ts";

Deno.test("playback deadline uses Telegram duration, 20-second buffer, and safe fallback", () => {
  const now = Date.parse("2026-10-24T00:00:00Z");
  assertEquals(playbackDeadline(20, now), "2026-10-24T00:00:40.000Z");
  assertEquals(playbackDeadline(null, now), "2026-10-24T00:30:20.000Z");
  assertEquals(playbackDeadline(9000, now), "2026-10-24T01:57:00.000Z");
});

Deno.test("transcript pauses only within playback window", () => {
  const now = Date.parse("2026-10-24T00:00:00Z");
  assert(playbackSuppressesTranscript("playing", "2026-10-24T00:00:40Z", now));
  assertEquals(playbackSuppressesTranscript("playing", "2026-10-23T23:59:59Z", now), false);
  assertEquals(playbackSuppressesTranscript("idle", "2026-10-24T00:00:40Z", now), false);
});

Deno.test("player accepts only a signed private caption-media object at the configured backend", () => {
  const backend = "https://project.supabase.co";
  const track = `${backend}/storage/v1/object/sign/caption-media/session/track.mp3?token=secret`;
  assert(isCaptionMediaSignedUrl(track, backend, "session/track.mp3"));
  assertEquals(isCaptionMediaSignedUrl(track, backend, "another/track.mp3"), false);
  assertEquals(isCaptionMediaSignedUrl(track.replace("project.supabase.co", "attacker.example"), backend), false);
  assertEquals(isCaptionMediaSignedUrl(track.replace("?token=secret", ""), backend), false);
  const player = new URL(captionPlayerUrl("https://example.com/angel-player", "abc123", track, "Thiền & Bình an"));
  assertEquals(player.pathname, "/angel-player/abc123");
  assertEquals(player.searchParams.get("t"), track);
  assertEquals(player.searchParams.get("title"), "Thiền & Bình an");
});
