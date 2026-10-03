import { createClient } from "npm:@supabase/supabase-js@2";

// Each replay can wait up to 15 seconds; keep one invocation within normal edge limits.
const BATCH_LIMIT = 3;
const RECOVERY_WINDOW_MS = 10 * 60_000;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function safeEqual(a: string | null, b: string): boolean {
  if (!a || a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) {
    difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return difference === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const cronSecret = Deno.env.get("TELEGRAM_JOIN_RECOVERY_SECRET") ??
    Deno.env.get("CRON_SECRET");
  if (!cronSecret || !safeEqual(req.headers.get("x-cron-secret"), cronSecret)) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const webhookSecret = Deno.env.get("COMMUNITY_GUARD_WEBHOOK_SECRET");
  if (!supabaseUrl || !serviceRoleKey || !webhookSecret) {
    console.error("[telegram-join-recovery] required configuration missing");
    return json({ error: "Recovery is not configured" }, 503);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: sweepError } = await admin.rpc("tg_sweep_join_events");
  if (sweepError) {
    console.error("[telegram-join-recovery] sweep failed", {
      error_code: sweepError.code ?? "unknown",
    });
    return json({ error: "Recovery sweep failed" }, 503);
  }

  const cutoff = new Date(Date.now() - RECOVERY_WINDOW_MS).toISOString();
  const columns =
    "id,chat_id,tg_user_id,event_type,old_status,new_status,occurred_at,invite_link,invite_link_name,admin_actor_tg_id,admin_actor_username,processing_status,processing_attempts,lease_until,delivery_state,metadata";
  const [pendingResult, failedResult, staleResult] = await Promise.all([
    admin.from("telegram_member_events").select(columns)
      .eq("processing_status", "pending").in("event_type", ["join", "rejoined"])
      .gte("occurred_at", cutoff).order("occurred_at", { ascending: true })
      .limit(BATCH_LIMIT),
    admin.from("telegram_member_events").select(columns)
      .eq("processing_status", "failed").in("event_type", ["join", "rejoined"])
      .gte("occurred_at", cutoff).order("occurred_at", { ascending: true })
      .limit(BATCH_LIMIT),
    admin.from("telegram_member_events").select(columns)
      .eq("processing_status", "processing").in("event_type", [
        "join",
        "rejoined",
      ])
      .gte("occurred_at", cutoff).lt("lease_until", new Date().toISOString())
      .or("delivery_state.neq.sending,delivery_state.is.null")
      .order("occurred_at", { ascending: true }).limit(BATCH_LIMIT),
  ]);
  const queryError = pendingResult.error ?? failedResult.error ??
    staleResult.error;
  if (queryError) {
    console.error("[telegram-join-recovery] event query failed", {
      error_code: queryError.code ?? "unknown",
    });
    return json({ error: "Recovery query failed" }, 503);
  }

  let invoked = 0;
  let skipped = 0;
  const rows = [
    ...(pendingResult.data ?? []),
    ...(failedResult.data ?? []),
    ...(staleResult.data ?? []),
  ].sort((a, b) => Date.parse(a.occurred_at) - Date.parse(b.occurred_at)).slice(
    0,
    BATCH_LIMIT,
  );
  for (const row of rows) {
    const metadata = row.metadata && typeof row.metadata === "object"
      ? row.metadata as Record<string, unknown>
      : {};
    const member = metadata.member && typeof metadata.member === "object"
      ? metadata.member as Record<string, unknown>
      : null;
    if (!member || typeof member.id !== "number") {
      await admin.rpc("tg_mark_join_event_review", {
        p_id: row.id,
        p_reason: "recovery_member_payload_missing",
      });
      skipped++;
      continue;
    }

    const occurredAt = Date.parse(row.occurred_at);
    const actorId = row.admin_actor_tg_id ?? member.id;
    const update = {
      chat_member: {
        chat: { id: row.chat_id, type: "supergroup" },
        from: {
          id: actorId,
          is_bot: false,
          username: row.admin_actor_username ?? undefined,
        },
        date: Math.floor(occurredAt / 1000),
        old_chat_member: { status: row.old_status, user: member },
        new_chat_member: {
          status: row.new_status,
          user: member,
          is_member: metadata.is_member !== false,
        },
        invite_link: row.invite_link
          ? { invite_link: row.invite_link, name: row.invite_link_name }
          : undefined,
      },
    };
    try {
      const response = await fetch(
        `${supabaseUrl}/functions/v1/telegram-community-webhook`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Telegram-Bot-Api-Secret-Token": webhookSecret,
          },
          body: JSON.stringify(update),
          signal: AbortSignal.timeout(15_000),
        },
      );
      if (response.ok) invoked++;
      else {
        console.warn("[telegram-join-recovery] webhook retry rejected", {
          event_id: row.id,
          status: response.status,
        });
      }
    } catch (error) {
      console.warn("[telegram-join-recovery] webhook retry failed", {
        event_id: row.id,
        error_name: error instanceof Error ? error.name : "unknown",
      });
    }
  }

  return json({ ok: true, scanned: rows.length, invoked, skipped });
});
