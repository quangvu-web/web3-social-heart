import {
  createRandomToken,
  getTelegramClients,
  requireTelegramUser,
  sha256Hex,
  telegramCorsHeaders,
  telegramJson,
} from "../_shared/telegram.ts";

async function ensureTelegramWebhook(): Promise<boolean> {
  const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const webhookSecret = Deno.env.get("TELEGRAM_WEBHOOK_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "");

  if (!botToken || !webhookSecret || !supabaseUrl) {
    console.error("[telegram-link-start] webhook environment is incomplete");
    return false;
  }

  const webhookUrl = `${supabaseUrl}/functions/v1/telegram-webhook?secret=${encodeURIComponent(webhookSecret)}`;

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ["message"],
        drop_pending_updates: false,
      }),
    });
    const result = (await response.json().catch(() => ({}))) as { ok?: boolean };
    if (!response.ok || result?.ok === false) {
      console.error("[telegram-link-start] setWebhook failed", response.status, result);
      return false;
    }
    return true;
  } catch (error) {
    console.error("[telegram-link-start] setWebhook request failed", error);
    return false;
  }
}

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

  if (!(await ensureTelegramWebhook())) {
    return telegramJson({ error: "Failed to configure Telegram webhook" }, 502);
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
