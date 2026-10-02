import {
  askAngel,
  callCommunityTelegram,
  communityCorsHeaders,
  ensureSettings,
  escapeHtml,
  getCommunityUserAvatarUrl,
  getBotInfo,
  getChatMember,
  getSettingsForGroup,
  json,
  logModeration,
  requireAdmin,
  sanitizeForTelegramHtml,
  sendMessage,
  sendPhoto,
  telegramProfileUrl,
  unrestrictChatMember,
  welcomeMarkup,
} from "../_shared/telegram-community.ts";
import { loadManagedGroupTitles } from "../_shared/managed-groups.ts";
import { managedGroupSettingsInsert } from "../_shared/telegram-welcome-defaults.ts";
import { COMMUNITY_WEBHOOK_ALLOWED_UPDATES } from "../_shared/telegram-webhook-config.ts";



type AdminRequest = {
  action?: string;
  payload?: Record<string, unknown>;
};

async function resolveSettings(
  adminClient: ReturnType<typeof requireAdmin> extends Promise<infer R> ? (R extends { adminClient: infer A } ? A : never) : never,
  payloadGroupId: unknown,
) {
  const gid = Number(payloadGroupId);
  if (Number.isFinite(gid) && gid !== 0) {
    return await getSettingsForGroup(adminClient as never, gid);
  }
  return await ensureSettings(adminClient as never);
}

function redactedWebhookUrl(projectUrl: string) {
  return `${projectUrl}/functions/v1/telegram-community-webhook?secret=***`;
}

async function loadManagedGroups(adminClient: ReturnType<typeof requireAdmin> extends Promise<infer R> ? (R extends { adminClient: infer A } ? A : never) : never) {
  const result = await loadManagedGroupTitles({
    readAllowlist: async () => await adminClient
      .from("telegram_community_settings")
      .select("id, group_id, bot_username, welcome_enabled, anti_spam_enabled, anti_link_enabled, ai_enabled, created_at")
      .order("created_at", { ascending: true }),
    readTelegramGroupConfigTitles: async (groupIds) => await adminClient
      .from("telegram_group_config")
      .select("group_id, group_title")
      .in("group_id", groupIds),
    onMetadataError: (code) => console.warn("[admin] Managed Groups title metadata lookup failed", {
      source: "telegram_group_config",
      error_code: code ?? "unknown",
    }),
  });
  if (!result.success) return { error: result.error } as const;
  return {
    groups: result.groups,
    group_title_lookup_failed: result.titleLookupFailed,
  } as const;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: communityCorsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const auth = await requireAdmin(req);
  if ("error" in auth) return auth.error;

  let body: AdminRequest = {};
  try {
    body = (await req.json()) as AdminRequest;
  } catch {
    body = {};
  }

  const action = body.action ?? "get_settings";
  const payload = body.payload ?? {};
  const adminClient = auth.adminClient;
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "");
  const secret = Deno.env.get("COMMUNITY_GUARD_WEBHOOK_SECRET");
  const groupId = Number(Deno.env.get("COMMUNITY_GUARD_GROUP_ID") ?? "0");
  const botUsername = Deno.env.get("COMMUNITY_GUARD_BOT_USERNAME") ?? null;

  if (action === "get_webhook_info") {
    const info = await callCommunityTelegram("getWebhookInfo");
    return json({
      success: info.ok,
      expected_url_prefix: `${supabaseUrl}/functions/v1/telegram-community-webhook`,
      info: info.data,
    });
  }

  if (action === "register_webhook") {
    if (!secret) return json({ success: false, error: "COMMUNITY_GUARD_WEBHOOK_SECRET is not configured" }, 500);
    const webhookUrl = `${supabaseUrl}/functions/v1/telegram-community-webhook?secret=${encodeURIComponent(secret)}`;
    const result = await callCommunityTelegram("setWebhook", {
      url: webhookUrl,
      allowed_updates: [...COMMUNITY_WEBHOOK_ALLOWED_UPDATES],
      secret_token: secret,
      drop_pending_updates: false,
    });
    if (!result.ok) return json({ success: false, error: "setWebhook failed", details: result.data }, 502);
    const info = await callCommunityTelegram("getWebhookInfo");
    return json({
      success: true,
      registered_url_redacted: redactedWebhookUrl(supabaseUrl),
      info: info.data,
    });
  }

  if (action === "clear_webhook_error") {
    if (!secret) return json({ success: false, error: "COMMUNITY_GUARD_WEBHOOK_SECRET is not configured" }, 500);
    // deleteWebhook → setWebhook lại → Telegram reset last_error_message
    await callCommunityTelegram("deleteWebhook", { drop_pending_updates: false });
    const webhookUrl = `${supabaseUrl}/functions/v1/telegram-community-webhook?secret=${encodeURIComponent(secret)}`;
    const result = await callCommunityTelegram("setWebhook", {
      url: webhookUrl,
      allowed_updates: [...COMMUNITY_WEBHOOK_ALLOWED_UPDATES],
      secret_token: secret,
      drop_pending_updates: false,
    });
    if (!result.ok) return json({ success: false, error: "setWebhook failed", details: result.data }, 502);
    const info = await callCommunityTelegram("getWebhookInfo");
    return json({ success: true, info: info.data });
  }



  if (action === "list_groups") {
    const result = await loadManagedGroups(adminClient);
    if ("error" in result) return json({ success: false, error: result.error }, 500);
    return json({ success: true, ...result });
  }

  if (action === "add_group") {
    const newGroupId = Number(payload.group_id);
    if (!Number.isFinite(newGroupId) || !Number.isInteger(newGroupId) || newGroupId === 0) {
      return json({ success: false, error: "Group ID phải là số (thường là số âm cho supergroup)" }, 400);
    }
    const { data: existing, error: lookupError } = await adminClient
      .from("telegram_community_settings")
      .select("id")
      .eq("group_id", newGroupId)
      .maybeSingle();
    if (lookupError) return json({ success: false, error: lookupError.message }, 500);
    if (existing) return json({ success: false, error: "Group này đã được quản lý rồi" }, 409);
    const { data, error } = await adminClient
      .from("telegram_community_settings")
      .insert(managedGroupSettingsInsert(newGroupId, botUsername))
      .select("*")
      .single();
    if (error) {
      const duplicate = (error as { code?: string }).code === "23505";
      return json({ success: false, error: duplicate ? "Group này đã được quản lý rồi" : error.message }, duplicate ? 409 : 500);
    }
    return json({ success: true, settings: data });
  }

  if (action === "remove_group") {
    const targetGroupId = Number(payload.group_id);
    if (!Number.isFinite(targetGroupId) || targetGroupId === 0) {
      return json({ success: false, error: "Group ID is required" }, 400);
    }
    const { error } = await adminClient
      .from("telegram_community_settings")
      .delete()
      .eq("group_id", targetGroupId);
    if (error) return json({ success: false, error: error.message }, 500);
    // Soft-delete: giữ lại logs / strikes / user_state để Cha xem lịch sử.
    return json({ success: true });
  }

  if (action === "verify_group") {
    const targetGroupId = Number(payload.group_id);
    if (!Number.isFinite(targetGroupId) || targetGroupId === 0) {
      return json({ success: false, error: "Group ID is required" }, 400);
    }
    const result = await callCommunityTelegram("getChat", { chat_id: targetGroupId });
    if (!result.ok) return json({ success: false, error: "Bot chưa được add vào group này, hoặc Group ID sai", details: result.data }, 502);
    return json({ success: true, chat: result.data?.result ?? null });
  }

  if (action === "check_delete_permission") {
    const targetGroupId = Number(payload.group_id);
    if (!Number.isFinite(targetGroupId) || targetGroupId === 0) {
      return json({ success: false, error: "Group ID is required" }, 400);
    }
    const bot = await getBotInfo();
    if (!bot) return json({ success: false, error: "Telegram bot getMe check failed" }, 502);
    const result = await getChatMember(targetGroupId, bot.id);
    if (!result.ok) {
      const details = result.data as { description?: string; error_code?: number } | undefined;
      return json({
        success: false,
        error: details?.description ?? "Telegram getChatMember failed",
        error_code: details?.error_code ?? null,
      }, 502);
    }
    const member = result.data?.result as { status?: string; can_delete_messages?: boolean } | undefined;
    const status = member?.status ?? "unknown";
    const canDeleteMessages = status === "creator" || (status === "administrator" && member?.can_delete_messages === true);
    return json({
      success: true,
      status,
      can_delete_messages: canDeleteMessages,
      warning: canDeleteMessages ? null : "Angel AI không có quyền Delete Messages trong group này.",
    });
  }

  if (action === "send_test_message") {
    const targetGroupId = Number(payload.group_id ?? groupId);
    if (!targetGroupId) return json({ success: false, error: "Group ID is required" }, 400);
    const result = await callCommunityTelegram("sendMessage", {
      chat_id: targetGroupId,
      text: "FUN.RICH Community Guard Bot test message ✅",
      parse_mode: "HTML",
    });
    return json({ success: result.ok, details: result.data }, result.ok ? 200 : 502);
  }

  if (action === "send_welcome_test") {
    const settings = await resolveSettings(adminClient, payload.group_id);
    if (!settings) return json({ success: false, error: "Group settings không tồn tại" }, 200);
    const sampleName = String(payload.name ?? "FUN.RICH Member");
    const sampleUsername = String(payload.username ?? "welcome_test").replace(/^@/, "");
    const sampleUserId = Number(payload.user_id ?? 0) || undefined;
    const profileUrl = sampleUsername
      ? `https://t.me/${sampleUsername}`
      : sampleUserId
        ? telegramProfileUrl({ id: sampleUserId, username: undefined })
        : undefined;
    const safeName = escapeHtml(sampleName);
    const usernameSuffix = sampleUsername ? ` (@${escapeHtml(sampleUsername)})` : "";
    const nameHtml = profileUrl
      ? `<a href="${profileUrl}">${safeName}</a>${usernameSuffix}`
      : `${safeName}${usernameSuffix}`;
    const text = settings.welcome_message
      .replace(/\{full_name\}/g, nameHtml)
      .replace(/\{name\}/g, nameHtml);

    const markup = welcomeMarkup(settings.mini_app_url, "group", profileUrl ?? null);

    // Try avatar if a real user_id is provided
    let avatarUrl: string | null = null;
    if (sampleUserId) {
      avatarUrl = await getCommunityUserAvatarUrl(sampleUserId).catch(() => null);
    }

    let result;
    let usedFallback = false;
    let buttonError: string | null = null;
    let mode: "photo" | "text" = "text";

    if (avatarUrl) {
      result = await sendPhoto(settings.group_id, avatarUrl, text, { reply_markup: markup });
      mode = "photo";
      if (!result.ok) {
        result = await sendMessage(settings.group_id, text, { reply_markup: markup });
        mode = "text";
      }
    } else {
      result = await sendMessage(settings.group_id, text, { reply_markup: markup });
    }
    let ok = result.ok;

    // Fallback if Telegram rejects the inline keyboard (e.g. invalid web_app URL)
    if (!ok) {
      const desc = String(result.data?.description ?? "");
      if (/button|web_app|BUTTON_TYPE_INVALID/i.test(desc)) {
        buttonError = desc;
        const retry = await sendMessage(settings.group_id, text);
        if (retry.ok) {
          result = retry;
          ok = true;
          usedFallback = true;
          mode = "text";
        }
      }
    }

    const description = String(result.data?.description ?? "");
    let logRecorded = false;
    let logErrorCode: string | null = null;
    try {
      const logResult = await logModeration(adminClient, {
        groupId: settings.group_id,
        action: ok ? "welcome_sent" : "welcome_send_failed",
        reason: usedFallback
          ? `admin_welcome_test_fallback_no_buttons: ${buttonError ?? ""}`.slice(0, 240)
          : `admin_welcome_test:${mode}${avatarUrl ? "" : ":no_avatar"}`,
        messageText: ok ? null : JSON.stringify(result.data ?? result).slice(0, 500),
        messageId: result.data?.result?.message_id ?? null,
      });
      logRecorded = logResult.ok;
      logErrorCode = logResult.errorCode ?? null;
    } catch (error) {
      logErrorCode = "exception";
      console.error("[admin] welcome test moderation log threw", {
        group_id: settings.group_id,
        name: error instanceof Error ? error.name : "unknown",
      });
    }

    if (ok) {
      const messageId = result.data?.result?.message_id ?? null;
      const warning = [
        usedFallback
          ? `Mini App URL "${settings.mini_app_url}" bị Telegram từ chối (${buttonError}). Đã gửi welcome không kèm nút. Cha hãy đổi Mini App URL sang HTTPS hợp lệ trong Settings.`
          : null,
        !logRecorded
          ? `Telegram đã nhận tin (message_id=${messageId ?? "không có"}), nhưng moderation log chưa ghi được (code=${logErrorCode}). Hãy kiểm tra log của Edge Function; chưa xác minh được bản ghi.`
          : null,
      ].filter(Boolean).join(" ") || null;
      return json({
        success: true,
        used_fallback: usedFallback,
        mode,
        avatar: Boolean(avatarUrl),
        log_recorded: logRecorded,
        log_error_code: logErrorCode,
        message_id: messageId,
        warning,
        details: result.data,
      });
    }
    return json({
      success: false,
      error: description || "Telegram rejected welcome message",
      details: result.data,
    });
  }



  if (action === "get_settings") {
    const settings = await resolveSettings(adminClient, payload.group_id);
    const groupsResult = await loadManagedGroups(adminClient);
    if ("error" in groupsResult) return json({ success: false, error: groupsResult.error }, 500);
    const [{ data: domains }, { data: keywords }, { data: logs }, { data: quickReplies }] = await Promise.all([
      adminClient.from("telegram_community_domain_whitelist").select("*").order("domain"),
      adminClient.from("telegram_community_blocked_keywords").select("*").order("keyword"),
      adminClient
        .from("telegram_community_moderation_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
      adminClient
        .from("telegram_community_quick_replies")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
    ]);

    return json({
      success: true,
      bot_username: botUsername,
      group_id_env: groupId || null,
      settings,
      groups: groupsResult.groups,
      group_title_lookup_failed: groupsResult.group_title_lookup_failed,
      domains: domains ?? [],
      keywords: keywords ?? [],
      quick_replies: quickReplies ?? [],
      logs: logs ?? [],
    });
  }


  if (action === "update_settings") {
    const settings = await resolveSettings(adminClient, payload.group_id);
    if (!settings) return json({ success: false, error: "Group settings không tồn tại — Cha hãy chọn / thêm group trước" }, 400);

    const allowed = [
      "bot_username",
      "welcome_enabled",
      "anti_spam_enabled",
      "anti_link_enabled",
      "block_telegram_previews",
      "block_external_bots",
      "block_scam_keywords",
      "block_shock_content",
      "enable_ocr_scan",
      "scam_protection_enabled",
      "scam_strict_mode",
      "scam_warning_enabled",
      "new_user_restriction_hours",
      "max_messages_per_minute",
      "warning_before_mute",
      "warning_before_ban",
      "mute_duration_minutes",
      "welcome_message",
      "rules_message",
      "verification_enabled",
      "verification_timeout_seconds",
      "verification_max_attempts",
      "verification_failure_action",
      "verification_prompt_message",
      "verification_success_message",
      "verification_failed_message",
      "ai_enabled",
      "mini_app_url",
      "ai_system_prompt",
      "ai_max_messages_per_minute",
      "always_reply_owner",
      "always_reply_admins",
      "always_reply_on_mention",
      "always_reply_on_reply_to_bot",
      "help_intent_ai_enabled",
      "positive_engagement_enabled",
      "positive_engagement_cooldown_minutes",
      "positive_engagement_max_per_hour",
      "positive_engagement_max_per_day",
      "positive_engagement_prompt",
      "community_support_prompt",
      "help_intent_prompt",
      "ai_mirror_angel_web",

      "fun_core_context_prompt",
      "community_personality",
      "ai_user_replies_per_minute",
      "ai_user_replies_per_day",
      "ai_group_replies_per_hour",
      "ai_group_replies_per_day",
      "ai_response_cache_ttl_hours",
      "ai_knowledge_version",
      "mini_app_builder_timeout_minutes",
      "event_assistant_enabled",
      "event_assistant_prompt",
      "event_followup_enabled",
      "event_followup_prompt",
      "owner_anonymous_address_prompt",
      "persona_mode",
      "persona_custom_prompt",
      "join_guard_name_enabled",
      "join_guard_name_keywords",
      "join_guard_name_allowlist",
      "join_guard_avatar_enabled",
      "join_guard_avatar_threshold",
      "join_guard_action",
    ];
    const patch: Record<string, unknown> = {};
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(payload, key)) patch[key] = payload[key];
    }
    console.log("[admin] update_settings payloadKeys=", Object.keys(payload), "patchKeys=", Object.keys(patch));
    if (!Object.keys(patch).length) return json({ success: false, error: "No valid settings fields" }, 400);

    const { error: updErr } = await adminClient
      .from("telegram_community_settings")
      .update(patch)
      .eq("id", settings.id);
    if (updErr) {
      console.error("[admin] update_settings DB error", updErr, "patch=", patch);
      return json({ success: false, error: updErr.message }, 500);
    }
    const { data, error } = await adminClient
      .from("telegram_community_settings")
      .select("*")
      .eq("id", settings.id)
      .single();
    if (error) return json({ success: false, error: error.message }, 500);
    return json({ success: true, settings: data });
  }

  if (action === "clear_ai_cache") {
    const targetGroupId = Number(payload.group_id);
    let query = adminClient.from("telegram_ai_response_cache").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (Number.isFinite(targetGroupId) && targetGroupId !== 0) {
      query = query.eq("group_id", targetGroupId);
    }
    const { error } = await query;
    if (error) return json({ success: false, error: error.message }, 500);
    return json({ success: true });
  }

  if (action === "restyle_cache_stats") {
    const { count: total } = await adminClient
      .from("telegram_ai_restyle_cache")
      .select("cache_key", { count: "exact", head: true });
    const { data: top } = await adminClient
      .from("telegram_ai_restyle_cache")
      .select("cache_key, hit_count, last_hit_at, restyled_text")
      .order("hit_count", { ascending: false })
      .limit(10);
    const totalHits = (top ?? []).reduce((sum, r: any) => sum + (r.hit_count ?? 0), 0);
    const topPreview = (top ?? []).map((r: any) => ({
      key: String(r.cache_key).slice(0, 12),
      hits: r.hit_count,
      last_hit_at: r.last_hit_at,
      preview: String(r.restyled_text ?? "").slice(0, 120),
    }));
    return json({ success: true, total_entries: total ?? 0, top_hits_sum: totalHits, top: topPreview });
  }

  if (action === "clear_restyle_cache") {
    const { error } = await adminClient
      .from("telegram_ai_restyle_cache")
      .delete()
      .neq("cache_key", "");
    if (error) return json({ success: false, error: error.message }, 500);
    return json({ success: true });
  }


  if (action === "set_bot_commands") {
    // Hướng C: menu lệnh khác nhau giữa DM và group.
    // - DM (chat riêng với bot): full menu cá nhân, kèm /profile /menu (có Web App).
    // - Group: chỉ những lệnh có ý nghĩa tập thể (rules/report/help) + /ask Angel.
    //   Ẩn /start /menu /profile khỏi group để user không gõ rồi "không thấy gì".
    const dmCommands = [
      { command: "start", description: "🌟 Start with FUN.RICH" },
      { command: "menu", description: "📱 Open main menu" },
      { command: "profile", description: "✨ My FUN.RICH profile" },
      { command: "rules", description: "📜 Community rules" },
      { command: "report", description: "🛡 Report spam / scam" },
      { command: "feedback", description: "💌 Gửi góp ý cho Angel" },
      { command: "help", description: "💬 Help" },
    ];
    const groupCommands = [
      { command: "ask", description: "💬 Ask Angel AI (e.g. /ask What is FUN.RICH?)" },
      { command: "rules", description: "📜 Community rules" },
      { command: "report", description: "🛡 Report spam / scam" },
      { command: "feedback", description: "💌 Gửi góp ý cho Angel" },
      { command: "help", description: "💬 Help" },
    ];


    // Reset default scope trước để Telegram không merge menu cũ.
    await callCommunityTelegram("deleteMyCommands", {});
    await callCommunityTelegram("deleteMyCommands", { scope: { type: "all_private_chats" } });
    await callCommunityTelegram("deleteMyCommands", { scope: { type: "all_group_chats" } });

    const dmRes = await callCommunityTelegram("setMyCommands", {
      commands: dmCommands,
      scope: { type: "all_private_chats" },
    });
    if (!dmRes.ok) return json({ success: false, error: "setMyCommands (DM) failed", details: dmRes.data }, 502);

    const groupRes = await callCommunityTelegram("setMyCommands", {
      commands: groupCommands,
      scope: { type: "all_group_chats" },
    });
    if (!groupRes.ok) return json({ success: false, error: "setMyCommands (group) failed", details: groupRes.data }, 502);

    return json({ success: true, dm_commands: dmCommands, group_commands: groupCommands });
  }


  if (action === "set_menu_button") {
    const settings = await resolveSettings(adminClient, payload.group_id);
    const miniAppUrl = settings?.mini_app_url || "https://angelquangvu-funprofile.lovable.app";
    const result = await callCommunityTelegram("setChatMenuButton", {
      menu_button: {
        type: "web_app",
        text: "🌟 FUN.RICH",
        web_app: { url: miniAppUrl },
      },
    });
    if (!result.ok) return json({ success: false, error: "setChatMenuButton failed", details: result.data }, 502);
    return json({ success: true, mini_app_url: miniAppUrl });
  }

  if (action === "pin_intro_message") {
    const settings = await ensureSettings(adminClient);
    const targetGroupId = Number(payload.group_id ?? settings?.group_id ?? groupId);
    if (!targetGroupId) return json({ success: false, error: "Group ID is required" }, 400);
    const guideUrl = String(payload.guide_url ?? "https://funprofile.camly.co/telegram-bot-guide");
    const botName = botUsername ? `@${botUsername}` : "bot FUN.RICH";
    const text = `🌟 <b>Chào Vòng Tròn Ánh Sáng</b> 💛\n\n✨ Bot FUN.RICH đã có <b>Angel AI</b> (powered by Gemini).\n\n<b>Cách dùng:</b>\n• Trong group: tag ${botName} hoặc reply tin của bot để hỏi\n• Hoặc nhắn riêng ${botName} để hỏi 24/7\n• Gõ /menu để mở menu chính\n\n📖 Hướng dẫn đầy đủ: ${guideUrl}\n\n🛡 Tuyệt đối không chia sẻ <b>seed phrase</b> hoặc <b>private key</b> với bất kỳ ai 🙏`;
    const sent = await callCommunityTelegram("sendMessage", {
      chat_id: targetGroupId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });
    if (!sent.ok) return json({ success: false, error: "sendMessage failed", details: sent.data }, 502);
    const messageId = sent.data?.result?.message_id;
    if (!messageId) return json({ success: false, error: "no message_id returned" }, 502);
    const pinned = await callCommunityTelegram("pinChatMessage", {
      chat_id: targetGroupId,
      message_id: messageId,
      disable_notification: false,
    });
    return json({ success: pinned.ok, message_id: messageId, pin: pinned.data });
  }




  if (action === "add_domain") {
    const domain = String(payload.domain ?? "").trim().toLowerCase();
    if (!domain) return json({ success: false, error: "Domain is required" }, 400);
    const { error } = await adminClient
      .from("telegram_community_domain_whitelist")
      .upsert({ domain, is_active: true }, { onConflict: "domain" });
    if (error) return json({ success: false, error: error.message }, 500);
    return json({ success: true });
  }

  if (action === "remove_domain") {
    const id = String(payload.id ?? "");
    const { error } = await adminClient.from("telegram_community_domain_whitelist").delete().eq("id", id);
    if (error) return json({ success: false, error: error.message }, 500);
    return json({ success: true });
  }

  if (action === "add_keyword") {
    const keyword = String(payload.keyword ?? "").trim().toLowerCase();
    const severity = String(payload.severity ?? "medium");
    if (!keyword) return json({ success: false, error: "Keyword is required" }, 400);
    const { error } = await adminClient
      .from("telegram_community_blocked_keywords")
      .upsert({ keyword, severity, is_active: true }, { onConflict: "keyword" });
    if (error) return json({ success: false, error: error.message }, 500);
    return json({ success: true });
  }

  if (action === "remove_keyword") {
    const id = String(payload.id ?? "");
    const { error } = await adminClient.from("telegram_community_blocked_keywords").delete().eq("id", id);
    if (error) return json({ success: false, error: error.message }, 500);
    return json({ success: true });
  }

  if (action === "reset_user_moderation_state") {
    const settings = await resolveSettings(adminClient, payload.group_id);
    const targetGroupId = Number(payload.group_id ?? settings?.group_id ?? groupId);
    const telegramUserId = Number(payload.telegram_user_id ?? payload.user_id ?? 0);
    if (!targetGroupId) return json({ success: false, error: "group_id is required" }, 400);
    if (!telegramUserId) return json({ success: false, error: "telegram_user_id is required" }, 400);

    const { data, error } = await adminClient
      .from("telegram_community_user_state")
      .update({
        warning_count: 0,
        muted_until: null,
        banned_at: null,
      })
      .eq("group_id", targetGroupId)
      .eq("telegram_user_id", telegramUserId)
      .select("id, group_id, telegram_user_id, warning_count, muted_until, banned_at")
      .maybeSingle();
    if (error) return json({ success: false, error: error.message }, 500);

    await logModeration(adminClient, {
      groupId: targetGroupId,
      userId: telegramUserId,
      username: null,
      action: "admin_reset_user_state",
      reason: "false_positive_recovery",
      messageText: "Admin reset Community Guard warning/mute/ban state. Telegram group unban must be done in Telegram if needed.",
      messageId: null,
    });

    return json({ success: true, state: data ?? null });
  }

  if (action === "unmute_user") {
    const settings = await resolveSettings(adminClient, payload.group_id);
    const targetGroupId = Number(payload.group_id ?? settings?.group_id ?? groupId);
    const rawUsername = String(payload.username ?? "").trim().replace(/^@/, "").toLowerCase();
    let telegramUserId = Number(payload.telegram_user_id ?? payload.user_id ?? 0);

    if (!targetGroupId) return json({ success: false, error: "group_id is required" }, 400);

    if (!telegramUserId && rawUsername) {
      const { data: muteRow } = await adminClient
        .from("telegram_group_mutes")
        .select("tg_user_id")
        .ilike("tg_username", rawUsername)
        .limit(1)
        .maybeSingle();
      if (muteRow?.tg_user_id) telegramUserId = Number(muteRow.tg_user_id);

      if (!telegramUserId) {
        const { data: logRow } = await adminClient
          .from("telegram_community_moderation_logs")
          .select("telegram_user_id")
          .ilike("username", rawUsername)
          .not("telegram_user_id", "is", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (logRow?.telegram_user_id) telegramUserId = Number(logRow.telegram_user_id);
      }
    }

    if (!telegramUserId) {
      return json(
        { success: false, error: "Không tìm thấy user ID cho username này. Vui lòng nhập trực tiếp telegram_user_id." },
        400,
      );
    }

    const result = await unrestrictChatMember(targetGroupId, telegramUserId);
    if (!result?.ok) {
      return json(
        {
          success: false,
          error: `Telegram từ chối: ${result?.description ?? "unknown error"}`,
          telegram_user_id: telegramUserId,
        },
        400,
      );
    }

    await adminClient
      .from("telegram_group_mutes")
      .delete()
      .eq("group_id", targetGroupId)
      .eq("tg_user_id", telegramUserId);

    await adminClient
      .from("telegram_community_user_state")
      .update({ warning_count: 0, muted_until: null, banned_at: null })
      .eq("group_id", targetGroupId)
      .eq("telegram_user_id", telegramUserId);

    const member = await callCommunityTelegram("getChatMember", {
      chat_id: targetGroupId,
      user_id: telegramUserId,
    });

    await logModeration(adminClient, {
      groupId: targetGroupId,
      userId: telegramUserId,
      username: rawUsername || null,
      action: "admin_unmute_user",
      reason: "manual_unmute",
      messageText: "Admin mở khoá quyền gửi tin nhắn trong nhóm.",
      messageId: null,
    });

    return json({
      success: true,
      telegram_user_id: telegramUserId,
      member_status: member?.result?.status ?? null,
      can_send_messages: member?.result?.can_send_messages ?? null,
    });
  }

  if (action === "upsert_quick_reply") {
    const id = payload.id ? String(payload.id) : null;
    const label = String(payload.label ?? "").trim();
    const reply_text = String(payload.reply_text ?? "").trim();
    const rawPatterns = Array.isArray(payload.patterns)
      ? (payload.patterns as unknown[])
      : String(payload.patterns ?? "")
          .split(/\r?\n/);
    const patterns = rawPatterns
      .map((p) => String(p ?? "").trim())
      .filter(Boolean);

    if (!label) return json({ success: false, error: "Label is required" }, 400);
    if (!reply_text) return json({ success: false, error: "Reply text is required" }, 400);
    if (!patterns.length) return json({ success: false, error: "At least one pattern is required" }, 400);

    for (const p of patterns) {
      try {
        new RegExp(p, "i");
      } catch (err) {
        return json({ success: false, error: `Invalid regex "${p}": ${(err as Error).message}` }, 400);
      }
    }

    const row = {
      label,
      patterns,
      reply_text,
      parse_mode: String(payload.parse_mode ?? "HTML"),
      disable_web_page_preview: payload.disable_web_page_preview !== false,
      is_active: payload.is_active !== false,
      sort_order: Number.isFinite(Number(payload.sort_order)) ? Number(payload.sort_order) : 0,
    };

    if (id) {
      const { error } = await adminClient
        .from("telegram_community_quick_replies")
        .update(row)
        .eq("id", id);
      if (error) return json({ success: false, error: error.message }, 500);
    } else {
      const { error } = await adminClient
        .from("telegram_community_quick_replies")
        .insert(row);
      if (error) return json({ success: false, error: error.message }, 500);
    }
    return json({ success: true });
  }

  if (action === "delete_quick_reply") {
    const id = String(payload.id ?? "");
    if (!id) return json({ success: false, error: "id is required" }, 400);
    const { error } = await adminClient.from("telegram_community_quick_replies").delete().eq("id", id);
    if (error) return json({ success: false, error: error.message }, 500);
    return json({ success: true });
  }


  if (action === "get_logs") {
    let query = adminClient
      .from("telegram_community_moderation_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (payload.action_filter) query = query.eq("action", String(payload.action_filter));
    if (payload.reason_filter) query = query.ilike("reason", `%${String(payload.reason_filter)}%`);
    if (payload.user_filter) query = query.or(`username.ilike.%${String(payload.user_filter)}%,telegram_user_id.eq.${Number(payload.user_filter) || 0}`);

    const { data, error } = await query;
    if (error) return json({ success: false, error: error.message }, 500);
    return json({ success: true, logs: data ?? [] });
  }

  if (action === "preview_ai_style") {
    const question = String(payload.question ?? "").trim();
    if (!question) return json({ success: false, error: "Thiếu câu hỏi mẫu" }, 400);
    const settings = await resolveSettings(adminClient, payload.group_id);
    const styleOverride = typeof payload.ai_style_prompt === "string"
      ? (payload.ai_style_prompt as string)
      : (settings?.ai_style_prompt ?? null);
    const personaOverride = typeof payload.ai_persona_prompt === "string"
      ? (payload.ai_persona_prompt as string)
      : ((settings as any)?.ai_persona_prompt ?? null);
    const t0 = Date.now();
    try {
      const reply = await askAngel({
        question,
        systemPrompt: "",
        userLabel: "be",
        personaMode: (settings?.community_personality === "silent" ? "angel_be" : "angel_be"),
        addressRuleOverride: settings?.owner_anonymous_address_prompt ?? null,
        funCoreContextPrompt: settings?.fun_core_context_prompt ?? null,
        aiStylePrompt: styleOverride,
        aiPersonaPrompt: personaOverride,
        adminClient,
      });
      const html = sanitizeForTelegramHtml(reply ?? "");
      return json({
        success: true,
        reply_html: html,
        reply_raw: reply,
        latency_ms: Date.now() - t0,
      });
    } catch (err) {
      return json({ success: false, error: (err as Error).message ?? "preview failed" }, 500);
    }
  }

  return json({ success: false, error: `Unknown action: ${action}` }, 400);
});
