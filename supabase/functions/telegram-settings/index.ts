import {
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
    return telegramJson({ success: false, error: "Method not allowed" }, 405);
  }

  const auth = await requireTelegramUser(req);
  if ("error" in auth) return auth.error;

  try {
    const { action, enabled } = await req.json();
    const { adminClient } = getTelegramClients(req);

    if (action === "set_enabled") {
      const { data: profile, error: profileError } = await adminClient
        .from("profiles")
        .select("telegram_chat_id")
        .eq("id", auth.userId)
        .maybeSingle();

      if (profileError) {
        console.error("[telegram-settings] profile lookup failed", profileError);
        return telegramJson({ success: false, error: "Failed to load Telegram settings" }, 500);
      }

      if (enabled && !profile?.telegram_chat_id) {
        return telegramJson({ success: false, error: "Connect Telegram before enabling 2FA" }, 400);
      }

      const { error } = await adminClient
        .from("profiles")
        .update({ telegram_2fa_enabled: Boolean(enabled) })
        .eq("id", auth.userId);

      if (error) {
        console.error("[telegram-settings] set_enabled failed", error);
        return telegramJson({ success: false, error: "Failed to update Telegram 2FA" }, 500);
      }

      return telegramJson({ success: true });
    }

    if (action === "unlink") {
      const { error } = await adminClient
        .from("profiles")
        .update({
          telegram_chat_id: null,
          telegram_username: null,
          telegram_2fa_enabled: false,
          telegram_linked_at: null,
        })
        .eq("id", auth.userId);

      if (error) {
        console.error("[telegram-settings] unlink failed", error);
        return telegramJson({ success: false, error: "Failed to disconnect Telegram" }, 500);
      }

      return telegramJson({ success: true });
    }

    return telegramJson({ success: false, error: "Invalid action" }, 400);
  } catch (error) {
    console.error("[telegram-settings] error", error);
    return telegramJson({ success: false, error: "Internal server error" }, 500);
  }
});
