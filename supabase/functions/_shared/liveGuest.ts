import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { buildRtcToken } from "./agoraToken.ts";
import { callAgora, loadAgoraCreds } from "./agoraRecording.ts";

export const guestCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export type LiveGuestStatus =
  | "invited"
  | "accepted"
  | "joined"
  | "declined"
  | "removed"
  | "left"
  | "disconnected"
  | "expired";

export const ACTIVE_GUEST_STATUSES: LiveGuestStatus[] = ["invited", "accepted", "joined", "disconnected"];

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...guestCorsHeaders, "Content-Type": "application/json" },
  });
}

export function numericUid(input: string, salt = ""): number {
  let hash = 2166136261;
  const source = `${input}:${salt}`;
  for (let i = 0; i < source.length; i++) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) || 10001;
}

export function getSupabaseClients(authHeader: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw new Error("Supabase configuration missing");
  }
  return {
    userClient: createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    }),
    serviceClient: createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    }),
  };
}

export async function getAuthUser(userClient: SupabaseClient) {
  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) {
    throw new Response(JSON.stringify({ error: "Invalid token" }), {
      status: 401,
      headers: { ...guestCorsHeaders, "Content-Type": "application/json" },
    });
  }
  return user;
}

export async function expireOldInvites(serviceClient: SupabaseClient, liveSessionId?: string) {
  const cutoff = new Date(Date.now() - 60_000).toISOString();
  let query = serviceClient
    .from("live_guest_sessions")
    .update({
      status: "expired",
      ended_at: new Date().toISOString(),
      end_reason: "expired",
      updated_at: new Date().toISOString(),
    })
    .eq("status", "invited")
    .lt("invited_at", cutoff);
  if (liveSessionId) query = query.eq("live_session_id", liveSessionId);
  await query;
}

export async function updateRecordingLayout(
  serviceClient: SupabaseClient,
  liveSessionId: string,
  participantUids: Array<string | number>,
  reason: string,
) {
  const { data: live, error } = await serviceClient
    .from("live_sessions")
    .select("id, agora_channel, channel_name, recording_uid, recording_resource_id, recording_sid, resource_id, sid, recording_provider, recording_status")
    .eq("id", liveSessionId)
    .maybeSingle();
  if (error || !live) return { ok: false, skipped: "live-not-found", error: error?.message };

  const resourceId = String(live.recording_resource_id || live.resource_id || "");
  const sid = String(live.recording_sid || live.sid || "");
  const channel = String(live.agora_channel || live.channel_name || "");
  const recorderUid = String(live.recording_uid || "");
  const active = String(live.recording_provider || "agora") === "agora" && ["starting", "started", "recording"].includes(String(live.recording_status || ""));
  if (!active || !resourceId || !sid || !channel || !recorderUid) {
    return { ok: true, skipped: "recording-not-active" };
  }

  const uids = participantUids.map((uid) => String(uid)).filter(Boolean).slice(0, 2);
  const clientRequest = uids.length >= 2
    ? {
        mixedVideoLayout: 3,
        backgroundColor: "#000000",
        layoutConfig: [
          { uid: uids[0], x_axis: 0, y_axis: 0, width: 0.5, height: 1, alpha: 1, render_mode: 1 },
          { uid: uids[1], x_axis: 0.5, y_axis: 0, width: 0.5, height: 1, alpha: 1, render_mode: 1 },
        ],
      }
    : {
        mixedVideoLayout: 3,
        backgroundColor: "#000000",
        layoutConfig: uids[0]
          ? [{ uid: uids[0], x_axis: 0, y_axis: 0, width: 1, height: 1, alpha: 1, render_mode: 1 }]
          : [],
      };

  try {
    const creds = loadAgoraCreds();
    const res = await callAgora(
      creds,
      "POST",
      `/cloud_recording/resourceid/${resourceId}/sid/${sid}/mode/mix/updateLayout`,
      { cname: channel, uid: recorderUid, clientRequest },
    );
    const result = {
      ok: res.status >= 200 && res.status < 300,
      status: res.status,
      body: res.body,
      reason,
      uids,
      at: new Date().toISOString(),
    };
    console.log("[live-guest] updateLayout", { liveSessionId, reason, status: res.status, uids });
    return result;
  } catch (err) {
    const result = {
      ok: false,
      status: null,
      error: err instanceof Error ? err.message : String(err),
      reason,
      uids,
      at: new Date().toISOString(),
    };
    console.warn("[live-guest] updateLayout failed", { liveSessionId, reason, error: result.error });
    return result;
  }
}

export function buildGuestRtcToken(params: {
  channel: string;
  uid: string | number;
  expireSeconds?: number;
}) {
  const appId = Deno.env.get("AGORA_APP_ID") ?? "";
  const appCertificate = Deno.env.get("AGORA_APP_CERTIFICATE") ?? "";
  if (!appId || !appCertificate) throw new Error("Agora credentials missing");
  return {
    appId,
    ...buildRtcToken({
      appId,
      appCertificate,
      channel: params.channel,
      uid: params.uid,
      role: "host",
      expireSeconds: params.expireSeconds || 3600,
    }),
  };
}
