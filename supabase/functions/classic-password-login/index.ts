import { createClient } from "npm:@supabase/supabase-js@2";
import { createTelegramChallenge } from "../_shared/telegram.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function generateFallbackUsername(email: string, userId: string): string {
  const base = email.split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "") || "user";
  return `${base}_${userId.slice(0, 6)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ success: false, error: "Method not allowed" }, 405);
  }

  try {
    const { email, password } = await req.json();
    const normalizedEmail = String(email ?? "").trim().toLowerCase();
    const rawPassword = String(password ?? "");

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || !rawPassword) {
      return json({ success: false, error: "Invalid email or password" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const authClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const rateLimit = await adminClient.rpc("check_rate_limit", {
      p_key: `classic_password_login:${normalizedEmail}`,
      p_limit: 10,
      p_window_ms: 60 * 60 * 1000,
    });

    if (rateLimit.data && !rateLimit.data.allowed) {
      return json({ success: false, error: "Too many login attempts. Please wait." }, 429);
    }

    const { data: signInData, error: signInError } = await authClient.auth.signInWithPassword({
      email: normalizedEmail,
      password: rawPassword,
    });

    if (signInError || !signInData.user || !signInData.session) {
      return json({ success: false, error: "Invalid login credentials" }, 401);
    }

    const user = signInData.user;
    const { data: existingProfile } = await adminClient
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (!existingProfile) {
      await adminClient.from("profiles").insert({
        id: user.id,
        username: generateFallbackUsername(normalizedEmail, user.id),
        full_name: user.user_metadata?.full_name || "",
        registered_from: "fun_profile_classic",
        oauth_provider: "Password",
        has_password_set: true,
      });
    }

    const telegramChallenge = await createTelegramChallenge({
      adminClient,
      userId: user.id,
      firstFactor: "password",
    });

    if (telegramChallenge.ok) {
      return json({
        success: true,
        requires_telegram_2fa: true,
        challenge_id: telegramChallenge.challengeId,
        user_id: user.id,
        is_new_user: false,
        expires_in_seconds: telegramChallenge.expiresInSeconds,
      });
    }

    if (telegramChallenge.code !== "not_enabled") {
      return json(
        { success: false, error: telegramChallenge.error },
        telegramChallenge.code === "rate_limited" ? 429 : 500,
      );
    }

    await adminClient
      .from("profiles")
      .update({ last_login_platform: "FUN Profile" })
      .eq("id", user.id);

    return json({
      success: true,
      user_id: user.id,
      is_new_user: false,
      access_token: signInData.session.access_token,
      refresh_token: signInData.session.refresh_token,
    });
  } catch (error) {
    console.error("[classic-password-login] error", error);
    return json({ success: false, error: "Internal server error" }, 500);
  }
});
