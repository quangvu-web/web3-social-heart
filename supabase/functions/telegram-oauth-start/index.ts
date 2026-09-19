import {
  createTelegramChallenge,
  getTelegramClients,
  requireTelegramUser,
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

  const auth = await requireTelegramUser(req);
  if ("error" in auth) return auth.error;

  const { adminClient } = getTelegramClients(req);
  const challenge = await createTelegramChallenge({
    adminClient,
    userId: auth.userId,
    firstFactor: "google",
  });

  if (!challenge.ok) {
    if (challenge.code === "not_enabled") {
      return telegramJson({ success: true, requires_telegram_2fa: false });
    }
    const status = challenge.code === "rate_limited" ? 429 : 500;
    return telegramJson({ success: false, error: challenge.error }, status);
  }

  return telegramJson({
    success: true,
    requires_telegram_2fa: true,
    challenge_id: challenge.challengeId,
    user_id: auth.userId,
    expires_in: challenge.expiresInSeconds,
  });
});
