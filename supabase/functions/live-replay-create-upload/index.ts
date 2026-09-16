import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BASIC_UPLOAD_LIMIT_BYTES = 200 * 1024 * 1024;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function b64(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
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
    const chunkedRecordingId = body.chunked_recording_id ? String(body.chunked_recording_id) : null;
    const expectedSize = Number(body.expected_size || 0);
    const sourceWebmKey = body.source_webm_key ? String(body.source_webm_key) : null;

    if (!liveSessionId || !Number.isFinite(expectedSize) || expectedSize <= 0) {
      return json({ error: "live_session_id and expected_size are required" }, 400);
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

    const safeName = `fun-live-replay-${liveSessionId}.webm`;
    const useTus = expectedSize > BASIC_UPLOAD_LIMIT_BYTES;

    let uploadURL = "";
    let streamUid = "";
    const uploadMethod: "form" | "tus" = useTus ? "tus" : "form";

    if (useTus) {
      const metadata = [
        `maxDurationSeconds ${b64("36000")}`,
        `requiresignedurls ${b64("false")}`,
        `name ${b64(safeName)}`,
        `filename ${b64(safeName)}`,
        `filetype ${b64("video/webm")}`,
      ].join(",");

      const cfResponse = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream?direct_user=true`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${streamToken}`,
            "Tus-Resumable": "1.0.0",
            "Upload-Length": String(expectedSize),
            "Upload-Metadata": metadata,
          },
        },
      );

      if (!cfResponse.ok) {
        const detail = await cfResponse.text();
        return json({ error: "Cloudflare TUS upload URL failed", detail }, 502);
      }

      uploadURL = cfResponse.headers.get("Location") || "";
      streamUid = cfResponse.headers.get("stream-media-id") || "";
    } else {
      const cfResponse = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream/direct_upload`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${streamToken}`,
            "Content-Type": "application/json",
            "Upload-Creator": user.id,
          },
          body: JSON.stringify({
            maxDurationSeconds: 36000,
            requireSignedURLs: false,
            allowedOrigins: ["*"],
            meta: {
              replay_id: "",
              live_session_id: liveSessionId,
              user_id: user.id,
              filename: safeName,
              filetype: "video/webm",
            },
          }),
        },
      );

      if (!cfResponse.ok) {
        const detail = await cfResponse.text();
        return json({ error: "Cloudflare direct upload URL failed", detail }, 502);
      }

      const cfData = await cfResponse.json();
      uploadURL = cfData.result?.uploadURL || "";
      streamUid = cfData.result?.uid || "";
    }

    if (!uploadURL || !streamUid) {
      return json({ error: "Cloudflare did not return upload URL or UID" }, 502);
    }

    const { data: replay, error: replayError } = await serviceClient
      .from("live_replays")
      .insert({
        user_id: user.id,
        live_session_id: liveSessionId,
        chunked_recording_id: chunkedRecordingId,
        source_webm_key: sourceWebmKey,
        stream_uid: streamUid,
        filesize_bytes: expectedSize,
        status: "uploading",
      })
      .select("id")
      .single();

    if (replayError) throw replayError;

    await serviceClient
      .from("live_sessions")
      .update({
        recording_status: "uploading",
        archive_status: "pending",
        cloudflare_video_uid: streamUid,
        recording_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", liveSessionId);

    return json({
      uploadURL,
      stream_uid: streamUid,
      replay_id: replay.id,
      upload_method: uploadMethod,
    });
  } catch (error) {
    console.error("[live-replay-create-upload]", error);
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
