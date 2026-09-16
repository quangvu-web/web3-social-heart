import { createClient } from "npm:@supabase/supabase-js@2";
import { archiveReplayToR2 } from "../_shared/archiveReplay.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const cronSecret = Deno.env.get("CRON_SECRET") ?? Deno.env.get("SCHEDULED_FUNCTION_SECRET");
    if (cronSecret) {
      const authToken = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
      const headerToken = req.headers.get("x-cron-secret");
      if (authToken !== cronSecret && headerToken !== cronSecret) {
        return json({ error: "Unauthorized" }, 401);
      }
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) return json({ error: "Missing Supabase config" }, 500);

    const body = await req.json().catch(() => ({}));
    const limit = typeof body.limit === "number" && body.limit > 0 ? Math.min(body.limit, 20) : 10;
    const now = new Date().toISOString();

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: replays, error } = await supabase
      .from("live_replays")
      .select("id")
      .in("archive_status", ["pending", "ready", "mp4_pending", "failed", "stream_delete_pending"])
      .is("stream_deleted_at", null)
      .or(`next_archive_retry_at.is.null,next_archive_retry_at.lte.${now}`)
      .order("updated_at", { ascending: true })
      .limit(limit);

    if (error) throw error;

    const results = [];
    const seenSessions = new Set<string>();
    for (const replay of replays ?? []) {
      const r = await archiveReplayToR2({ supabase, replayId: replay.id });
      if (r.live_session_id) seenSessions.add(String(r.live_session_id));
      results.push(r);
    }

    // Also scan live_sessions for OBS rows that have a cloudflare_video_uid but
    // never got a live_replays row (Cloudflare disconnected before video.ready).
    const remaining = Math.max(0, limit - results.length);
    if (remaining > 0) {
      const { data: sessions, error: sessErr } = await supabase
        .from("live_sessions")
        .select("id")
        .in("archive_status", ["pending", "ready", "mp4_pending", "failed", "stream_delete_pending"])
        .is("stream_deleted_at", null)
        .not("cloudflare_video_uid", "is", null)
        .order("updated_at", { ascending: true })
        .limit(remaining);
      if (sessErr) throw sessErr;

      for (const s of sessions ?? []) {
        if (seenSessions.has(String(s.id))) continue;
        results.push(await archiveReplayToR2({ supabase, liveSessionId: String(s.id) }));
      }
    }

    return json({ ok: true, processed: results.length, results });
  } catch (error) {
    console.error("[retry-archive-replays]", error);
    return json({ ok: false, error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
