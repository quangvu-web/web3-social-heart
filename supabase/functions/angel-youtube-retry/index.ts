/**
 * angel-youtube-retry — chạy on-demand để retry các row media_type='youtube'
 * đang kẹt (LOGIN_REQUIRED, HTTP 429, no_captions...). Sử dụng cookie YouTube
 * từ env YOUTUBE_COOKIE nếu có.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { ingestYouTubeFromMessage } from "../_shared/angel-youtube-ingest.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") || "50"), 100);

  const { data: rows, error } = await admin
    .from("angel_channel_knowledge")
    .select("id, chat_id, message_id, posted_at, raw_message, push_error, youtube_error")
    .eq("media_type", "youtube")
    .eq("pushed_to_core", false)
    .limit(limit);

  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const chatIds = Array.from(new Set((rows || []).map((r) => Number(r.chat_id))));
  const { data: chans } = await admin
    .from("angel_watched_channels")
    .select("chat_id, title, username")
    .in("chat_id", chatIds);
  const chanMap = new Map((chans || []).map((c) => [Number(c.chat_id), c] as const));

  const hasCookie = !!Deno.env.get("YOUTUBE_COOKIE");
  const results: any[] = [];
  let pushed = 0;
  let failed = 0;

  for (const row of rows || []) {
    const raw = (row.raw_message ?? {}) as Record<string, unknown>;
    const vid = String(raw.youtube_id || "");
    const videoUrl = String(raw.youtube_url || (vid ? `https://www.youtube.com/watch?v=${vid}` : ""));
    if (!vid || !videoUrl) {
      failed++;
      results.push({ id: row.id, skipped: "no_youtube_id" });
      continue;
    }
    const chan = chanMap.get(Number(row.chat_id));
    const summary = await ingestYouTubeFromMessage(admin, videoUrl, {
      chatId: Number(row.chat_id),
      messageId: Number(row.message_id),
      chatTitle: chan?.title ?? null,
      chatUsername: chan?.username ?? null,
      postedAt: row.posted_at ?? null,
      senderName: null,
    });
    if (summary.pushed > 0) pushed++;
    else failed++;
    results.push({ id: row.id, vid, ...summary });
    await new Promise((r) => setTimeout(r, 1200)); // nhẹ tay rate-limit
  }

  return new Response(
    JSON.stringify({
      ok: true,
      hasCookie,
      total: rows?.length || 0,
      pushed,
      failed,
      results,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
