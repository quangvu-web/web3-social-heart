import { json, requireUser } from "../_shared/restream.ts";
import { stopRestreamMultistream } from "../_shared/restreamMultistream.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" } });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const auth = await requireUser(req);
  if (auth instanceof Response) return auth;

  try {
    const body = await req.json().catch(() => ({}));
    const liveSessionId = String(body.live_session_id || body.liveSessionId || "");
    if (!/^[0-9a-fA-F-]{36}$/.test(liveSessionId)) return json({ success: false, error: "Valid live_session_id is required" }, 400);
    const result = await stopRestreamMultistream(auth.serviceClient, {
      userId: auth.user.id,
      liveSessionId,
    });
    return json(result);
  } catch (error) {
    return json({ success: false, error: error instanceof Error ? error.message : "Unable to stop Restream multistream" }, 500);
  }
});
