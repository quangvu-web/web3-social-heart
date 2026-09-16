import {
  createRandomToken,
  getTelegramClients,
  requireTelegramUser,
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

  const auth = await requireTelegramUser(req);
  if ("error" in auth) return auth.error;

  const botUsername = Deno.env.get("TELEGRAM_BOT_USERNAME");
  if (!botUsername) {
    return telegramJson({ error: "TELEGRAM_BOT_USERNAME is not configured" }, 500);
  }

  const { adminClient } = getTelegramClients(req);

  const rateLimit = await adminClient.rpc("check_rate_limit", {
    p_key: `telegram_link_start:${auth.userId}`,
    p_limit: 5,
    p_window_ms: 15 * 60 * 1000,
  });
  if (rateLimit.data && !rateLimit.data.allowed) {
    return telegramJson({ error: "Too many Telegram link requests. Please wait." }, 429);
  }

  const token = createRandomToken(24);
  const tokenHash = await sha256Hex(token);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();


  await adminClient
    .from("telegram_link_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("user_id", auth.userId)
    .is("used_at", null);

  const { error } = await adminClient.from("telegram_link_tokens").insert({
    user_id: auth.userId,
    token_hash: tokenHash,
    expires_at: expiresAt,
  });

  if (error) {
    console.error("[telegram-link-start] insert failed", error);
    return telegramJson({ error: "Failed to create Telegram link" }, 500);
  }

  return telegramJson({
    success: true,
    link_token: token,
    deep_link: `https://t.me/${botUsername}?start=${token}`,
    expires_at: expiresAt,
  });
});
