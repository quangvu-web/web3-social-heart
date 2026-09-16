import {
  getAuthUser,
  getSupabaseClients,
  guestCorsHeaders,
  jsonResponse,
  updateRecordingLayout,
} from "../_shared/liveGuest.ts";

const VALID_CLIENT_STATES = new Set(["live", "reconnecting", "background", "closing"]);

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
    const clientState = VALID_CLIENT_STATES.has(String(body.client_state)) ? String(body.client_state) : "live";
    if (!/^[0-9a-fA-F-]{36}$/.test(inviteId)) return jsonResponse({ error: "Valid invite_id is required" }, 400);

    const { data: invite, error } = await serviceClient
      .from("live_guest_sessions")
      .select("id, live_session_id, guest_user_id, agora_uid, status")
      .eq("id", inviteId)
      .maybeSingle();
    if (error) throw error;
    if (!invite) return jsonResponse({ error: "Invite not found" }, 404);
    if (invite.guest_user_id !== user.id) return jsonResponse({ error: "Only guest can heartbeat" }, 403);

    const { data: live } = await serviceClient
      .from("live_sessions")
      .select("status, agora_uid, agora_uid_host")
      .eq("id", invite.live_session_id)
      .maybeSingle();
    if (!live || live.status !== "live") {
      return jsonResponse({ ok: true, ended: true, status: invite.status });
    }

    const now = new Date().toISOString();
    const firstJoin = invite.status === "accepted" || invite.status === "disconnected";
    const nextStatus = clientState === "closing" ? "left" : "joined";
    const patch: Record<string, unknown> = {
      status: nextStatus,
      last_heartbeat_at: now,
      updated_at: now,
    };
    if (firstJoin) patch.joined_at = now;
    if (clientState === "closing") {
      patch.ended_at = now;
      patch.end_reason = "guest_left";
    }

    let layoutResult: unknown = null;
    if (firstJoin && clientState !== "closing") {
      const hostUid = live.agora_uid || live.agora_uid_host;
      layoutResult = await updateRecordingLayout(
        serviceClient,
        invite.live_session_id,
        hostUid ? [hostUid, invite.agora_uid] : [invite.agora_uid],
        "guest_joined",
      );
      patch.layout_update_result = layoutResult;
    }
    if (clientState === "closing") {
      const hostUid = live.agora_uid || live.agora_uid_host;
      layoutResult = await updateRecordingLayout(serviceClient, invite.live_session_id, hostUid ? [hostUid] : [], "guest_left");
      patch.layout_update_result = layoutResult;
    }

    const { data: updated, error: updateError } = await serviceClient
      .from("live_guest_sessions")
      .update(patch)
      .eq("id", inviteId)
      .select("id, status, muted_by_host")
      .single();
    if (updateError) throw updateError;

    return jsonResponse({ ok: true, inviteId, status: updated.status, muted_by_host: updated.muted_by_host, layoutResult });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("[live-guest-heartbeat] failed", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});
