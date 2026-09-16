import {
  getAuthUser,
  getSupabaseClients,
  guestCorsHeaders,
  jsonResponse,
  updateRecordingLayout,
} from "../_shared/liveGuest.ts";

const HOST_ACTIONS = new Set(["cancel", "remove", "mute", "unmute"]);
const GUEST_ACTIONS = new Set(["leave"]);

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
    const action = String(body.action || "");
    if (!/^[0-9a-fA-F-]{36}$/.test(inviteId)) return jsonResponse({ error: "Valid invite_id is required" }, 400);
    if (!HOST_ACTIONS.has(action) && !GUEST_ACTIONS.has(action)) return jsonResponse({ error: "Invalid action" }, 400);

    const { data: invite, error } = await serviceClient
      .from("live_guest_sessions")
      .select("id, live_session_id, host_user_id, guest_user_id, status")
      .eq("id", inviteId)
      .maybeSingle();
    if (error) throw error;
    if (!invite) return jsonResponse({ error: "Invite not found" }, 404);

    const isHost = invite.host_user_id === user.id;
    const isGuest = invite.guest_user_id === user.id;
    if (HOST_ACTIONS.has(action) && !isHost) return jsonResponse({ error: "Only host can control guest" }, 403);
    if (GUEST_ACTIONS.has(action) && !isGuest) return jsonResponse({ error: "Only guest can leave" }, 403);

    const now = new Date().toISOString();
    let patch: Record<string, unknown> = { updated_at: now };
    let layoutReason: string | null = null;
    if (action === "cancel") patch = { status: "expired", ended_at: now, end_reason: "cancelled", updated_at: now };
    if (action === "remove") {
      patch = { status: "removed", ended_at: now, end_reason: "removed", updated_at: now };
      layoutReason = "guest_removed";
    }
    if (action === "leave") {
      patch = { status: "left", ended_at: now, end_reason: "guest_left", updated_at: now };
      layoutReason = "guest_left";
    }
    if (action === "mute") patch = { muted_by_host: true, updated_at: now };
    if (action === "unmute") patch = { muted_by_host: false, updated_at: now };

    let layoutResult: unknown = null;
    if (layoutReason) {
      const { data: live } = await serviceClient
        .from("live_sessions")
        .select("agora_uid, agora_uid_host")
        .eq("id", invite.live_session_id)
        .maybeSingle();
      const hostUid = live?.agora_uid || live?.agora_uid_host;
      layoutResult = await updateRecordingLayout(serviceClient, invite.live_session_id, hostUid ? [hostUid] : [], layoutReason);
      patch.layout_update_result = layoutResult;
    }

    const { data: updated, error: updateError } = await serviceClient
      .from("live_guest_sessions")
      .update(patch)
      .eq("id", inviteId)
      .select("id, status, muted_by_host")
      .single();
    if (updateError) throw updateError;

    console.log(`[live-guest-control] guest_${action}`, { inviteId, liveSessionId: invite.live_session_id, actor: user.id });
    return jsonResponse({ inviteId, status: updated.status, muted_by_host: updated.muted_by_host, layoutResult });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("[live-guest-control] failed", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});
