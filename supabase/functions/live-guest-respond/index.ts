import {
  expireOldInvites,
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
    const response = String(body.response || "");
    if (!/^[0-9a-fA-F-]{36}$/.test(inviteId)) return jsonResponse({ error: "Valid invite_id is required" }, 400);
    if (!["accept", "decline"].includes(response)) return jsonResponse({ error: "response must be accept or decline" }, 400);

    const { data: invite, error: inviteError } = await serviceClient
      .from("live_guest_sessions")
      .select("id, live_session_id, guest_user_id, status, invited_at")
      .eq("id", inviteId)
      .maybeSingle();
    if (inviteError) throw inviteError;
    if (!invite) return jsonResponse({ error: "Invite not found" }, 404);
    if (invite.guest_user_id !== user.id) return jsonResponse({ error: "Only invited guest can respond" }, 403);

    await expireOldInvites(serviceClient, invite.live_session_id);
    if (invite.status !== "invited") {
      const { data: fresh } = await serviceClient.from("live_guest_sessions").select("id, status").eq("id", inviteId).maybeSingle();
      return jsonResponse({ inviteId, status: fresh?.status || invite.status, stale: true }, 409);
    }

    const now = new Date().toISOString();
    const next = response === "accept"
      ? { status: "accepted", accepted_at: now, updated_at: now }
      : { status: "declined", ended_at: now, end_reason: "declined", updated_at: now };
    const { data: updated, error } = await serviceClient
      .from("live_guest_sessions")
      .update(next)
      .eq("id", inviteId)
      .eq("status", "invited")
      .select("id, status")
      .single();
    if (error) throw error;

    console.log(response === "accept" ? "[live-guest-respond] guest_invite_accepted" : "[live-guest-respond] guest_invite_declined", {
      inviteId,
      liveSessionId: invite.live_session_id,
      guestUserId: user.id,
    });
    return jsonResponse({ inviteId: updated.id, status: updated.status });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("[live-guest-respond] failed", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});
