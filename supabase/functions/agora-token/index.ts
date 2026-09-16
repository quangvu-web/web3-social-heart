import { createClient } from "npm:@supabase/supabase-js@2";
import { buildRtcToken } from "../_shared/agoraToken.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Authorization required" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return jsonResponse({ error: "Invalid token" }, 401);
    }

    const body = await req.json();
    const { channel_name, call_session_id, expire_seconds } = body || {};

    if (!channel_name) {
      return jsonResponse({ error: "channel_name is required" }, 400);
    }

    if (call_session_id) {
      const { data: session, error: sessionError } = await supabase
        .from("call_sessions")
        .select("id, conversation_id")
        .eq("id", call_session_id)
        .single();
      if (sessionError || !session) {
        return jsonResponse({ error: "Call session not found" }, 404);
      }
    }

    const appId = Deno.env.get("AGORA_APP_ID");
    const appCertificate = Deno.env.get("AGORA_APP_CERTIFICATE");
    if (!appId || !appCertificate) {
      return jsonResponse({ error: "Agora credentials missing" }, 500);
    }

    const { token, expireAt, uid } = buildRtcToken({
      appId,
      appCertificate,
      channel: channel_name,
      uid: user.id,
      role: "publisher",
      expireSeconds: typeof expire_seconds === "number" ? expire_seconds : 86400,
    });

    console.log(`[AGORA-TOKEN] Token issued user=${user.id} channel=${channel_name}`);

    return jsonResponse({
      token,
      app_id: appId,
      channel: channel_name,
      uid,
      expires_at: expireAt,
    });
  } catch (error: unknown) {
    console.error("[AGORA-TOKEN] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});
