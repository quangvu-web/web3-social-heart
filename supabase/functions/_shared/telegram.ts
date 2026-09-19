import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

export const telegramCorsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-forwarded-for, user-agent, x-real-ip, cf-connecting-ip",
};

const encoder = new TextEncoder();

export function telegramJson(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...telegramCorsHeaders, "Content-Type": "application/json" },
  });
}

export function getTelegramClients(req?: Request): {
  userClient: SupabaseClient;
  adminClient: SupabaseClient;
} {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const authHeader = req?.headers.get("Authorization");

  return {
    userClient: createClient(supabaseUrl, anonKey, {
      global: authHeader ? { headers: { Authorization: authHeader } } : undefined,
    }),
    adminClient: createClient(supabaseUrl, serviceRoleKey),
  };
}

export async function requireTelegramUser(req: Request): Promise<{ userId: string } | { error: Response }> {
  const { userClient } = getTelegramClients(req);
  const {
    data: { user },
    error,
  } = await userClient.auth.getUser();

  if (error || !user) {
    return { error: telegramJson({ error: "Unauthorized" }, 401) };
  }

  return { userId: user.id };
}

export function createRandomToken(byteLength = 24): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function createOtpCode(): string {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return String(100000 + (bytes[0] % 900000));
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function sendTelegramMessage(chatId: string, text: string): Promise<boolean> {
  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!botToken) {
    console.warn("[telegram] TELEGRAM_BOT_TOKEN is not configured");
    return false;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });

    if (!response.ok) {
      console.error("[telegram] sendMessage failed", response.status, await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error("[telegram] sendMessage error", error);
    return false;
  }
}

export async function createTelegramChallenge(params: {
  adminClient: SupabaseClient;
  userId: string;
  firstFactor: "email_otp" | "wallet" | "password" | "google";
}): Promise<
  | { ok: true; challengeId: string; expiresInSeconds: number }
  | { ok: false; code: "not_enabled" | "rate_limited" | "send_failed" | "db_error"; error: string }
> {
  const { data: profile, error: profileError } = await params.adminClient
    .from("profiles")
    .select("telegram_chat_id, telegram_2fa_enabled")
    .eq("id", params.userId)
    .maybeSingle();

  if (profileError) {
    console.error("[telegram] profile lookup failed", profileError);
    return { ok: false, code: "db_error", error: "Failed to check Telegram 2FA" };
  }

  if (!profile?.telegram_2fa_enabled || !profile.telegram_chat_id) {
    return { ok: false, code: "not_enabled", error: "Telegram 2FA is not enabled" };
  }

  const rateLimit = await params.adminClient.rpc("check_rate_limit", {
    p_key: `telegram_2fa:${params.userId}`,
    p_limit: 5,
    p_window_ms: 15 * 60 * 1000,
  });

  if (rateLimit.data && !rateLimit.data.allowed) {
    return { ok: false, code: "rate_limited", error: "Too many Telegram OTP requests. Please wait." };
  }

  const code = createOtpCode();
  const codeHash = await sha256Hex(`${params.userId}:${code}`);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  await params.adminClient
    .from("telegram_otp_challenges")
    .update({ consumed_at: new Date().toISOString() })
    .eq("user_id", params.userId)
    .is("consumed_at", null);

  const { data: challenge, error: insertError } = await params.adminClient
    .from("telegram_otp_challenges")
    .insert({
      user_id: params.userId,
      code_hash: codeHash,
      first_factor: params.firstFactor,
      expires_at: expiresAt,
      max_attempts: 5,
    })
    .select("id")
    .single();

  if (insertError || !challenge) {
    console.error("[telegram] challenge insert failed", insertError);
    return { ok: false, code: "db_error", error: "Failed to create Telegram OTP" };
  }

  const sent = await sendTelegramMessage(
    profile.telegram_chat_id,
    `FUN.RICH login code: <b>${code}</b>\n\nThis code expires in 5 minutes. Do not share it with anyone.`,
  );

  if (!sent) {
    await params.adminClient
      .from("telegram_otp_challenges")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", challenge.id);
    return { ok: false, code: "send_failed", error: "Failed to send Telegram OTP" };
  }

  return { ok: true, challengeId: challenge.id, expiresInSeconds: 300 };
}

export async function issueSupabaseSession(params: {
  adminClient: SupabaseClient;
  userId: string;
}): Promise<
  | { ok: true; accessToken: string; refreshToken: string }
  | { ok: false; error: string }
> {
  const { data: userData, error: userError } = await params.adminClient.auth.admin.getUserById(params.userId);
  const email = userData?.user?.email;

  if (userError || !email) {
    console.error("[telegram] user lookup failed", userError);
    return { ok: false, error: "User email not found" };
  }

  const { data: linkData, error: linkError } = await params.adminClient.auth.admin.generateLink({
    type: "magiclink",
    email,
  });

  if (linkError || !linkData?.properties?.action_link) {
    console.error("[telegram] generateLink failed", linkError);
    return { ok: false, error: "Failed to create session" };
  }

  const magicLinkUrl = new URL(linkData.properties.action_link);
  const tokenHash = magicLinkUrl.searchParams.get("token");
  const type = (magicLinkUrl.searchParams.get("type") || "magiclink") as "magiclink";

  if (!tokenHash) {
    return { ok: false, error: "Failed to extract session token" };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const anonClient = createClient(supabaseUrl, anonKey);
  const { data: sessionData, error: sessionError } = await anonClient.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  });

  if (sessionError || !sessionData.session) {
    console.error("[telegram] verifyOtp failed", sessionError);
    return { ok: false, error: "Failed to create session" };
  }

  return {
    ok: true,
    accessToken: sessionData.session.access_token,
    refreshToken: sessionData.session.refresh_token,
  };
}
