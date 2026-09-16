import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify user via getUser
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = user.id;

    // Parse body
    const { device_hash, user_agent } = await req.json();
    if (!device_hash) {
      return new Response(
        JSON.stringify({ error: "device_hash is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Hash IP from request headers (never store raw)
    const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || req.headers.get("x-real-ip")
      || "unknown";
    // Hash IP and user agent in parallel
    const [ipHash, userAgentHash] = await Promise.all([
      sha256(clientIP),
      sha256(user_agent || req.headers.get("user-agent") || "unknown"),
    ]);

    // Service role client for insert (bypasses RLS)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Check if we already have a recent fingerprint for this user+device (within 24h)
    const { data: existing } = await supabaseAdmin
      .from("user_device_fingerprint")
      .select("id")
      .eq("user_id", userId)
      .eq("device_hash", device_hash)
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .limit(1);

    if (existing && existing.length > 0) {
      return new Response(
        JSON.stringify({ ok: true, message: "Already recorded" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert fingerprint
    const { error: insertError } = await supabaseAdmin
      .from("user_device_fingerprint")
      .insert({
        user_id: userId,
        ip_hash: ipHash,
        device_hash: device_hash,
        user_agent_hash: userAgentHash,
      });

    if (insertError) {
      console.error("[collect-fingerprint] Insert error:", insertError.message);
      return new Response(
        JSON.stringify({ error: "Failed to store fingerprint" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for device clusters (>3 accounts on same device)
    const { data: clusterUsers } = await supabaseAdmin
      .from("user_device_fingerprint")
      .select("user_id")
      .eq("device_hash", device_hash);

    const uniqueUsers = new Set(clusterUsers?.map(r => r.user_id) || []);

    if (uniqueUsers.size > 3) {
      console.warn(`[collect-fingerprint] Device cluster detected: ${uniqueUsers.size} users on device ${device_hash.substring(0, 8)}...`);

      // Fire-and-forget: recalculate trust scores without blocking response
      Promise.all(
        Array.from(uniqueUsers).map(uid =>
          supabaseAdmin.rpc("calculate_trust_score", { p_user_id: uid })
        )
      ).catch(err => console.error("[collect-fingerprint] trust recalc error:", err));
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[collect-fingerprint] Error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
