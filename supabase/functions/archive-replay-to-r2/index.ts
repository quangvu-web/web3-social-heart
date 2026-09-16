import { createClient } from "npm:@supabase/supabase-js@2";
import { archiveReplayToR2 } from "../_shared/archiveReplay.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey) return json({ error: "Missing Supabase config" }, 500);

    const cronSecret = Deno.env.get("CRON_SECRET") ?? Deno.env.get("SCHEDULED_FUNCTION_SECRET");
    if (cronSecret) {
      const authToken = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
      const headerToken = req.headers.get("x-cron-secret");
      if (authToken !== cronSecret && headerToken !== cronSecret) {
        return json({ error: "Unauthorized" }, 401);
      }
    }

    const body = await req.json().catch(() => ({}));
    const replayId = typeof body.replay_id === "string" ? body.replay_id : undefined;
    const liveSessionId = typeof body.live_session_id === "string" ? body.live_session_id : undefined;

    if (!replayId && !liveSessionId) {
      return json({ error: "replay_id or live_session_id required" }, 400);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const result = await archiveReplayToR2({ supabase, replayId, liveSessionId });
    const status = result.ok
      ? 200
      : result.error === "Replay not found"
        ? 404
        : 500;
    return json(result, status);
  } catch (error) {
    console.error("[archive-replay-to-r2]", error);
    return json({ ok: false, status: "failed", error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
