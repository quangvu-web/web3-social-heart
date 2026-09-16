import { json, requireUser } from "../_shared/restream.ts";
import { startRestreamMultistream } from "../_shared/restreamMultistream.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" } });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;

  try {
    const body = await req.json().catch(() => ({}));
    const liveSessionId = String(body.live_session_id || body.liveSessionId || "");
    if (!/^[0-9a-fA-F-]{36}$/.test(liveSessionId)) return json({ success: false, error: "Valid live_session_id is required" }, 400);
    const result = await startRestreamMultistream(auth.serviceClient, {
      userId: auth.user.id,
      liveSessionId,
      channelIds: body.channel_ids || body.channelIds || [],
    });
    return json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start Restream multistream";
    const status = message.includes("egress_unavailable") ? 503 : 500;
    return json({ success: false, error: message }, status);
  }
});
