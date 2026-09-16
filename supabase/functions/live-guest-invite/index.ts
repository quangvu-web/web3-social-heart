import {
  ACTIVE_GUEST_STATUSES,
  expireOldInvites,
  getAuthUser,
  getSupabaseClients,
  guestCorsHeaders,
  jsonResponse,
  numericUid,
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
    const liveSessionId = String(body.live_session_id || body.sessionId || "");
    const guestUserId = String(body.guest_user_id || body.guestUserId || "");
    if (!/^[0-9a-fA-F-]{36}$/.test(liveSessionId) || !/^[0-9a-fA-F-]{36}$/.test(guestUserId)) {
      return jsonResponse({ error: "Valid live_session_id and guest_user_id are required" }, 400);
    }
    if (guestUserId === user.id) return jsonResponse({ error: "Host cannot invite self" }, 400);

    await expireOldInvites(serviceClient, liveSessionId);

    const { data: live, error: liveError } = await serviceClient
      .from("live_sessions")
      .select("id, user_id, host_user_id, owner_id, status, agora_channel, channel_name, mode, live_post_id, post_id")
      .eq("id", liveSessionId)
      .maybeSingle();
    if (liveError) throw liveError;
    if (!live) return jsonResponse({ error: "Live session not found" }, 404);
    const hostId = live.user_id || live.host_user_id || live.owner_id;
    if (hostId !== user.id) return jsonResponse({ error: "Only host can invite guest" }, 403);
    if (live.status !== "live") return jsonResponse({ error: "Live session is not live" }, 409);
    if (!["agora_webcam", "mobile", "agora"].includes(String(live.mode || "agora_webcam"))) {
      return jsonResponse({ error: "Guest invite is only supported for Agora webcam/mobile live" }, 409);
    }

    const cutoff = new Date(Date.now() - 30_000).toISOString();
    const { data: presence } = await serviceClient
      .from("live_viewer_presence")
      .select("id, last_seen_at")
      .eq("live_session_id", liveSessionId)
      .eq("user_id", guestUserId)
      .gte("last_seen_at", cutoff)
      .maybeSingle();
    if (!presence) return jsonResponse({ error: "Guest must be watching this live right now" }, 409);

    const { data: active } = await serviceClient
      .from("live_guest_sessions")
      .select("id, status, guest_user_id")
      .eq("live_session_id", liveSessionId)
      .in("status", ACTIVE_GUEST_STATUSES)
      .maybeSingle();
    if (active) {
      return jsonResponse({ error: "This live already has an active guest invite", activeGuestSessionId: active.id }, 409);
    }

    const channel = live.agora_channel || live.channel_name;
    const guestSessionId = crypto.randomUUID();
    const agoraUid = numericUid(guestSessionId, "guest");
    const { data: invite, error: inviteError } = await serviceClient
      .from("live_guest_sessions")
      .insert({
        id: guestSessionId,
        live_session_id: liveSessionId,
        host_user_id: hostId,
        guest_user_id: guestUserId,
        agora_channel_name: channel,
        agora_uid: agoraUid,
        status: "invited",
      })
      .select("id, status")
      .single();
    if (inviteError) throw inviteError;

    await serviceClient
      .from("notifications")
      .insert({
        user_id: guestUserId,
        actor_id: hostId,
        post_id: live.live_post_id || live.post_id || null,
        type: "live_guest_invite",
      })
      .then(({ error }) => {
        if (error) console.warn("[live-guest-invite] notification failed", error.message);
      });

    console.log("[live-guest-invite] guest_invite_sent", { liveSessionId, inviteId: invite.id, hostId, guestUserId });
    return jsonResponse({ inviteId: invite.id, status: invite.status });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("[live-guest-invite] failed", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});
