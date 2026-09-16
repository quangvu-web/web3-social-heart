/**
 * After webcam live ends, the frontend has assembled an R2 multipart object
 * containing the entire recording. This function asks Cloudflare Stream to
 * "copy from URL" — Stream pulls the file from R2 (public URL) and transcodes
 * it into HLS/DASH/MP4. The existing `stream-webhook` then flips
 * `live_sessions.recording_status` to 'ready' when CF finishes.
 *
 * Body: { live_session_id, r2_key, r2_url, total_size }
 * Returns: { stream_uid, replay_id }
 */

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization header" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const accountId = Deno.env.get("CLOUDFLARE_ACCOUNT_ID") ?? "";
    const streamToken =
      Deno.env.get("CLOUDFLARE_STREAM_TOKEN") ??
      Deno.env.get("CLOUDFLARE_STREAM_API_TOKEN") ??
      Deno.env.get("CLOUDFLARE_API_TOKEN") ??
      "";

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return json({ error: "Missing Supabase configuration" }, 500);
    }
    if (!accountId || !streamToken) {
      return json({ error: "Missing Cloudflare Stream configuration" }, 500);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const liveSessionId = String(body.live_session_id || "");
    const r2Key = String(body.r2_key || "");
    const r2Url = String(body.r2_url || "");
    const totalSize = Number(body.total_size || 0);

    if (!liveSessionId || !r2Key || !r2Url) {
      return json({ error: "live_session_id, r2_key, r2_url are required" }, 400);
    }

    const { data: live, error: liveError } = await serviceClient
      .from("live_sessions")
      .select("id, host_user_id, owner_id, post_id, title")
      .eq("id", liveSessionId)
      .maybeSingle();

    if (liveError) throw liveError;
    if (!live) return json({ error: "Live session not found" }, 404);

    const { data: isAdmin } = await userClient.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    const isHost = live.host_user_id === user.id || live.owner_id === user.id;
    if (!isHost && !isAdmin) return json({ error: "Forbidden" }, 403);

    // Ask Cloudflare Stream to copy the R2 file. CF will fetch the URL and transcode.
    const safeName = `fun-live-replay-${liveSessionId}.webm`;
    const cfResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/copy`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${streamToken}`,
          "Content-Type": "application/json",
          "Upload-Creator": user.id,
        },
        body: JSON.stringify({
          url: r2Url,
          meta: {
            name: safeName,
            live_session_id: liveSessionId,
            user_id: user.id,
            source: "r2_webcam_chunked",
          },
          requireSignedURLs: false,
          allowedOrigins: ["*"],
        }),
      },
    );

    if (!cfResponse.ok) {
      const detail = await cfResponse.text();
      console.error("[live-replay-finalize-r2] CF copy failed:", detail);
      return json({ error: "Cloudflare Stream copy failed", detail }, 502);
    }

    const cfData = await cfResponse.json();
    const streamUid = cfData?.result?.uid;
    if (!streamUid) {
      return json({ error: "Cloudflare did not return a stream UID", detail: cfData }, 502);
    }

    // Insert live_replays row tracking this upload
    const { data: replay, error: replayError } = await serviceClient
      .from("live_replays")
      .insert({
        user_id: user.id,
        live_session_id: liveSessionId,
        source_webm_key: r2Key,
        stream_uid: streamUid,
        filesize_bytes: totalSize > 0 ? totalSize : null,
        status: "processing",
      })
      .select("id")
      .single();

    if (replayError) throw replayError;

    // Update session status — webhook will flip recording_status to 'ready'
    await serviceClient
      .from("live_sessions")
      .update({
        recording_status: "processing",
        archive_status: "pending",
        cloudflare_video_uid: streamUid,
        r2_recording_key: r2Key,
        r2_recording_size: totalSize > 0 ? totalSize : null,
        recording_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", liveSessionId);

    return json({ stream_uid: streamUid, replay_id: replay.id });
  } catch (error) {
    console.error("[live-replay-finalize-r2]", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
