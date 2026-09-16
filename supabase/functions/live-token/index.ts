import { createClient } from "npm:@supabase/supabase-js@2";
import { buildRtcToken } from "../_shared/agoraToken.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type LiveRole = "host" | "audience" | "recorder" | "guest";

function numericUid(input: string, salt = ""): number {
  let hash = 2166136261;
  const source = `${input}:${salt}`;
  for (let i = 0; i < source.length; i++) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) || 10001;
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function badRequest(error: string, status = 400) {
  return jsonResponse({ error }, status);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return badRequest("Method not allowed", 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return badRequest("Authorization required", 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !supabaseAnonKey) {
      return badRequest("Supabase configuration missing", 500);
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return badRequest("Invalid token", 401);

    const body = await req.json().catch(() => null) as {
      session_id?: string;
      sessionId?: string;
      channelName?: string;
      uid?: string | number;
      role?: LiveRole;
      expireSeconds?: number;
      invite_id?: string;
      inviteId?: string;
    } | null;

    const sessionId = body?.session_id || body?.sessionId;
    const directChannelName = body?.channelName?.trim();
    const role = body?.role;
    if (!sessionId && !directChannelName) {
      return badRequest("session_id or channelName is required");
    }
    if (role !== "host" && role !== "audience" && role !== "recorder" && role !== "guest") {
      return badRequest("role must be host, audience, recorder, or guest");
    }

    let channel = directChannelName || "";
    let requestUid = body?.uid ? String(body.uid) : user.id;
    let liveSession:
      | {
          id: string;
          host_user_id: string;
          status: string;
          agora_channel: string | null;
          channel_name: string;
          recording_uid: number | null;
        }
      | null = null;

    if (sessionId) {
      const { data: sessionRow, error: sessionError } = await supabase
        .from("live_sessions")
        .select("id, host_user_id, status, agora_channel, channel_name, recording_uid")
        .eq("id", sessionId)
        .maybeSingle();
      if (sessionError) return badRequest(sessionError.message, 400);
      if (!sessionRow) return badRequest("Live session not found", 404);
      liveSession = sessionRow;

      channel = sessionRow.agora_channel || sessionRow.channel_name;
      if (!channel) return badRequest("Live channel not configured", 400);

      if ((role === "host" || role === "recorder") && sessionRow.host_user_id !== user.id) {
        return badRequest("Only host can request host/recorder token", 403);
      }
      if (role !== "recorder" && sessionRow.status !== "live") {
        return badRequest("Live session has ended", 409);
      }
      if (role === "recorder") {
        requestUid = String(sessionRow.recording_uid || user.id);
      }
      if (role === "guest") {
        const inviteId = body?.invite_id || body?.inviteId;
        if (!inviteId) return badRequest("invite_id is required for guest token");
        const { data: invite, error: inviteError } = await supabase
          .from("live_guest_sessions")
          .select("id, guest_user_id, status, agora_uid, live_session_id")
          .eq("id", inviteId)
          .eq("live_session_id", sessionRow.id)
          .maybeSingle();
        if (inviteError) return badRequest(inviteError.message, 400);
        if (!invite) return badRequest("Guest invite not found", 404);
        if (invite.guest_user_id !== user.id) return badRequest("Only invited guest can request guest token", 403);
        if (!["accepted", "joined", "disconnected"].includes(String(invite.status))) {
          return badRequest("Guest invite is not accepted", 409);
        }
        requestUid = String(invite.agora_uid || numericUid(invite.id, "guest"));
      }
    }

    const appId = Deno.env.get("AGORA_APP_ID");
    const appCertificate = Deno.env.get("AGORA_APP_CERTIFICATE");
    if (!appId || !appCertificate) {
      return badRequest("Agora credentials missing", 500);
    }

    const { token, expireAt, uid } = buildRtcToken({
      appId,
      appCertificate,
      channel,
      uid: requestUid,
      role: role === "guest" ? "host" : role,
      expireSeconds: body?.expireSeconds || 3600,
    });

    return jsonResponse({
      token,
      channel,
      uid,
      appId,
      expiresAt: expireAt,
      sessionId: liveSession?.id ?? null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[live-token] error:", message);
    return badRequest(message, 500);
  }
});
