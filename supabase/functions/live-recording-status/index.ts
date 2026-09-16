import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const url = new URL(req.url);
    const sessionId = url.searchParams.get("sessionId") || url.searchParams.get("liveId");
    if (!sessionId) {
      return jsonResponse({ error: "sessionId is required" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const workerUrl = (Deno.env.get("LIVE_AGORA_WORKER_URL") || Deno.env.get("VITE_AGORA_WORKER_URL") || "").replace(/\/+$/, "");
    const workerApiKey = Deno.env.get("LIVE_AGORA_WORKER_API_KEY") || Deno.env.get("VITE_AGORA_WORKER_API_KEY") || "";

    const client = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await client.auth.getUser();

    if (userError || !user) {
      return jsonResponse({ error: "Invalid token" }, 401);
    }

    const { data: contextRows, error: contextError } = await client.rpc("get_live_recording_context", {
      _session_id: sessionId,
    });

    if (contextError) {
      return jsonResponse({ error: contextError.message }, 400);
    }

    const context = Array.isArray(contextRows) ? contextRows[0] : contextRows;
    if (!context) {
      return jsonResponse({ error: "Forbidden or live session not found" }, 403);
    }

    let workerQuery: any = null;
    if (workerUrl && workerApiKey && context.resource_id && context.sid) {
      const queryUrl = `${workerUrl}/api/agora/recording/query?resourceId=${encodeURIComponent(context.resource_id)}&sid=${encodeURIComponent(context.sid)}&mode=mix&sessionId=${encodeURIComponent(sessionId)}`;
      const queryRes = await fetch(queryUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": workerApiKey,
          "x-correlation-id": crypto.randomUUID(),
          Origin: Deno.env.get("FUN_PROFILE_ORIGIN") || "https://angelquangvu-funprofile.lovable.app",
        },
      });

      workerQuery = await queryRes.json().catch(() => ({}));
      if (!queryRes.ok) {
        return jsonResponse({
          ok: false,
          session: context,
          workerQuery,
        }, 200);
      }
    }

    const { data: recording } = await client
      .from("live_recordings")
      .select("id, status, file_list_json, stopped_at, created_at, media_url, duration_seconds, thumbnail_url")
      .eq("live_id", sessionId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return jsonResponse({
      ok: true,
      session: context,
      recording,
      workerQuery,
    });
  } catch (error: any) {
    return jsonResponse({ error: error?.message || "Unexpected error" }, 500);
  }
});
