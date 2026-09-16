import {
  getTelegramClients,
  issueSupabaseSession,
  sha256Hex,
  telegramCorsHeaders,
  telegramJson,
} from "../_shared/telegram.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: telegramCorsHeaders });
  }

  if (req.method !== "POST") {
    return telegramJson({ error: "Method not allowed" }, 405);
  }

  try {
    const { challenge_id, code } = await req.json();
    const challengeId = String(challenge_id ?? "");
    const otp = String(code ?? "").trim();

    if (!challengeId || !/^\d{6}$/.test(otp)) {
      return telegramJson({ success: false, error: "Challenge ID and 6-digit OTP are required" }, 400);
    }

    const { adminClient } = getTelegramClients(req);
    const nowIso = new Date().toISOString();

    const { data: challenge, error: challengeError } = await adminClient
      .from("telegram_otp_challenges")
      .select("id, user_id, code_hash, expires_at, attempts, max_attempts, consumed_at")
      .eq("id", challengeId)
      .maybeSingle();

    if (challengeError || !challenge || challenge.consumed_at || challenge.expires_at <= nowIso) {
      return telegramJson({ success: false, error: "Telegram OTP expired or not found" }, 400);
    }

    if (challenge.attempts >= challenge.max_attempts) {
      await adminClient
        .from("telegram_otp_challenges")
        .update({ consumed_at: nowIso })
        .eq("id", challenge.id);
      return telegramJson({ success: false, error: "Too many failed attempts. Please login again." }, 429);
    }

    const expectedHash = await sha256Hex(`${challenge.user_id}:${otp}`);
    if (expectedHash !== challenge.code_hash) {
      const attempts = challenge.attempts + 1;
      await adminClient
        .from("telegram_otp_challenges")
        .update({ attempts })
        .eq("id", challenge.id);

      return telegramJson(
        {
          success: false,
          error: "Invalid Telegram OTP",
          attempts_remaining: Math.max(0, challenge.max_attempts - attempts),
        },
        400,
      );
    }

    await adminClient
      .from("telegram_otp_challenges")
      .update({ consumed_at: nowIso })
      .eq("id", challenge.id);

    const session = await issueSupabaseSession({
      adminClient,
      userId: challenge.user_id,
    });

    if (!session.ok) {
      return telegramJson({ success: false, error: session.error }, 500);
    }

    await adminClient
      .from("profiles")
      .update({ last_login_platform: "FUN Profile" })
      .eq("id", challenge.user_id);

    return telegramJson({
      success: true,
      message: "Telegram OTP verified successfully",
      user_id: challenge.user_id,
      access_token: session.accessToken,
      refresh_token: session.refreshToken,
    });
  } catch (error) {
    console.error("[telegram-2fa-verify] error", error);
    return telegramJson({ success: false, error: "Internal server error" }, 500);
  }
});
