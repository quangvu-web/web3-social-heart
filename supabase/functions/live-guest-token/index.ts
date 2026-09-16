import {
  buildGuestRtcToken,
  getAuthUser,
  getSupabaseClients,
  guestCorsHeaders,
  jsonResponse,
} from "../_shared/liveGuest.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: guestCorsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Authorization required" }, 401);
    const { userClient, serviceClient } = getSupabaseClients(authHeader);
    const user = await getAuthUser(userClient);
    const body = await req.json().catch(() => ({}));
    const inviteId = String(body.invite_id || body.inviteId || "");
    if (!/^[0-9a-fA-F-]{36}$/.test(inviteId)) return jsonResponse({ error: "Valid invite_id is required" }, 400);

    const { data: invite, error } = await serviceClient
      .from("live_guest_sessions")
      .select("id, live_session_id, guest_user_id, agora_channel_name, agora_uid, status")
      .eq("id", inviteId)
      .maybeSingle();
    if (error) throw error;
    if (!invite) return jsonResponse({ error: "Invite not found" }, 404);
    if (invite.guest_user_id !== user.id) return jsonResponse({ error: "Only invited guest can get broadcaster token" }, 403);
    if (!["accepted", "joined", "disconnected"].includes(String(invite.status))) {
      return jsonResponse({ error: "Invite is not accepted" }, 409);
    }

    const { data: live } = await serviceClient
      .from("live_sessions")
      .select("id, status")
      .eq("id", invite.live_session_id)
      .maybeSingle();
    if (!live || live.status !== "live") return jsonResponse({ error: "Live session has ended" }, 409);

    const token = buildGuestRtcToken({
      channel: invite.agora_channel_name,
      uid: invite.agora_uid,
      expireSeconds: Number(body.expireSeconds || 3600),
    });
    return jsonResponse({
      appId: token.appId,
      channel: invite.agora_channel_name,
      token: token.token,
      uid: token.uid,
      expiresAt: token.expireAt,
      inviteId,
      sessionId: invite.live_session_id,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("[live-guest-token] failed", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});
