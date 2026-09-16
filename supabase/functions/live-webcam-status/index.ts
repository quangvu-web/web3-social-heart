import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "GET" && req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    if (!supabaseUrl || !anonKey) return json({ error: "Supabase configuration missing" }, 500);

    const client = createClient(supabaseUrl, anonKey, {
      global: authHeader ? { headers: { Authorization: authHeader } } : undefined,
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const url = new URL(req.url);
    let sessionId = url.searchParams.get("sessionId") || url.searchParams.get("session_id") || "";
    if (req.method === "POST" && !sessionId) {
      const body = await req.json().catch(() => ({}));
      sessionId = String(body.sessionId || body.session_id || "");
    }
    if (!/^[0-9a-fA-F-]{36}$/.test(sessionId)) return json({ error: "Valid sessionId is required" }, 400);

    const { data, error } = await client
      .from("live_sessions")
      .select("id, status, end_reason, recording_provider, recording_status, recording_error_code, browser_recording_status, browser_recording_chunk_count, browser_recording_total_bytes, replay_url, thumbnail_url, duration_seconds, error_message, recording_error, r2_video_url, playback_url")
      .eq("id", sessionId)
      .maybeSingle();
    if (error) return json({ error: error.message }, 400);
    if (!data) return json({ error: "Live session not found" }, 404);

    const status = data.status === "ended" && data.recording_status === "processing"
      ? "processing"
      : data.status;

    return json({
      sessionId,
      status,
      ended: ["ended", "processing", "ready", "posted", "failed"].includes(String(status)),
      end_reason: data.end_reason || null,
      replay_url: data.replay_url || data.r2_video_url || data.playback_url || null,
      thumbnail_url: data.thumbnail_url || null,
      duration_seconds: data.duration_seconds ?? null,
      error_message: data.error_message || data.recording_error || null,
      recording_provider: data.recording_provider || null,
      recording_status: data.recording_status || null,
      recording_error_code: data.recording_error_code || null,
      browser_recording_status: data.browser_recording_status || null,
      browser_recording_chunk_count: data.browser_recording_chunk_count ?? 0,
      browser_recording_total_bytes: data.browser_recording_total_bytes ?? 0,
    });
  } catch (error) {
    console.error("[live-webcam-status] failed reason", error);
    return json({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});
