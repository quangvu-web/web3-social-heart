import { createClient } from "npm:@supabase/supabase-js@2";
import { callAgora, loadAgoraCreds, normalizeRecordingResult } from "../_shared/agoraRecording.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type Body = {
  sessionId?: string;
  channelName?: string;
  recorderUid?: string | number;
  resourceId?: string;
  sid?: string;
  mode?: "mix" | "individual";
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Authorization required" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !supabaseAnonKey) {
      return jsonResponse({ error: "Supabase configuration missing" }, 500);
    }

    const client = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await client.auth.getUser();
    if (userError || !user) return jsonResponse({ error: "Invalid token" }, 401);

    const body = (await req.json().catch(() => null)) as Body | null;
    const sessionId = body?.sessionId;
    if (!sessionId) return jsonResponse({ error: "sessionId is required" }, 400);

    const { data: liveSession, error: sessionError } = await client
      .from("live_sessions")
      .select("id, host_user_id, channel_name, agora_channel, status")
      .eq("id", sessionId)
      .maybeSingle();

    if (sessionError) return jsonResponse({ error: sessionError.message }, 400);
    if (!liveSession) return jsonResponse({ error: "Live session not found" }, 404);
    if (liveSession.host_user_id !== user.id) {
      return jsonResponse({ error: "Only host can stop recording" }, 403);
    }

    const channelName = (body?.channelName || liveSession.agora_channel || liveSession.channel_name || "").trim();
    const recorderUid = String(body?.recorderUid || "");
    const resourceId = body?.resourceId?.trim();
    const sid = body?.sid?.trim();
    const mode = body?.mode || "mix";

    if (!channelName || !recorderUid || !resourceId || !sid) {
      return jsonResponse({ error: "channelName, recorderUid, resourceId, sid are required" }, 400);
    }

    const creds = loadAgoraCreds();
    const stopRes = await callAgora(
      creds,
      "POST",
      `/cloud_recording/resourceid/${resourceId}/sid/${sid}/mode/${mode}/stop`,
      {
        cname: channelName,
        uid: recorderUid,
        clientRequest: {},
      },
    );
    console.log("[live-recording-stop] stop", stopRes.status, stopRes.rawText.slice(0, 400));

    const agoraBody = stopRes.body || {};
    const alreadyGone = stopRes.status === 404 && agoraBody?.code === 404;
    if ((stopRes.status < 200 || stopRes.status >= 300) && !alreadyGone) {
      return jsonResponse({
        error: "Agora stop failed",
        agora: agoraBody,
      }, 502);
    }

    const normalized = normalizeRecordingResult(agoraBody, sessionId, alreadyGone);
    const serverResponse = {
      status: normalized.status,
      uploadingStatus: normalized.uploadingStatus,
      files: normalized.files,
      mediaKey: normalized.mediaKey,
      mediaUrl: normalized.mediaUrl,
      message: normalized.message,
      durationSeconds: normalized.durationSeconds,
      thumbnailUrl: normalized.thumbnailUrl,
      rawAgoraResponse: normalized.rawAgoraResponse,
    };

    return jsonResponse({ ...serverResponse, serverResponse });
  } catch (error: any) {
    console.error("[live-recording-stop] error:", error?.message || error);
    return jsonResponse({ error: error?.message || "Unexpected error" }, 500);
  }
});
