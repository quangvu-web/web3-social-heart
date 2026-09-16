/**
 * angel-channel-retry — cron mỗi 2 phút.
 *
 * Quét angel_channel_knowledge tìm row đang kẹt do lỗi tạm thời
 * (HTTP 429, duplicate key, HTTP 5xx) và có next_retry_at <= now().
 * Backoff exponential: 60s → 120s → 300s → 600s → 1800s. retry_count >= 5 → bỏ.
 *
 * Tôn trọng rate-limit 60 req/phút / key Angel gốc → tối đa 25 row/lần chạy.
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { pushToAngelKnowledge } from "../_shared/angel-knowledge.ts";
import { withUsage } from "../_shared/track-cloud-usage.ts";

const MAX_BATCH = 25;
const MAX_RETRIES = 5;
const BACKOFF_SEC = [60, 120, 300, 600, 1800];

async function handle(): Promise<Response> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const nowIso = new Date().toISOString();
  const { data: rows, error } = await admin
    .from("angel_channel_knowledge")
    .select("id, chat_id, message_id, content, media_type, posted_at, retry_count, push_error")
    .eq("pushed_to_core", false)
    .lte("next_retry_at", nowIso)
    .not("content", "is", null)
    .lt("retry_count", MAX_RETRIES)
    .order("next_retry_at", { ascending: true })
    .limit(MAX_BATCH);

  if (error) {
    console.error("[angel-channel-retry] query error", error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 });
  }

  if (!rows || rows.length === 0) {
    return new Response(JSON.stringify({ ok: true, processed: 0 }), { status: 200 });
  }

  // Load channel metadata một lần cho tất cả chat_ids trong batch
  const chatIds = Array.from(new Set(rows.map((r) => Number(r.chat_id))));
  const { data: channels } = await admin
    .from("angel_watched_channels")
    .select("chat_id, title, username")
    .in("chat_id", chatIds);
  const chanMap = new Map(
    (channels || []).map((c) => [Number(c.chat_id), c] as const),
  );

  let success = 0;
  let failed = 0;
  let dupResolved = 0;
  let giveUp = 0;

  for (const row of rows) {
    const chan = chanMap.get(Number(row.chat_id));
    const title = chan?.title || `Channel ${row.chat_id}`;
    const uname = chan?.username ? String(chan.username).replace(/^@/, "") : null;
    const url = uname ? `https://t.me/${uname}/${row.message_id}` : undefined;

    const result = await pushToAngelKnowledge({
      source: "telegram_channel",
      source_ref: `${row.chat_id}:${row.message_id}`,
      title: `${title} #${row.message_id}`,
      content: String(row.content),
      url,
      language: "vi",
      folder: `Telegram / ${title}`,
      metadata: {
        chat_id: row.chat_id,
        message_id: row.message_id,
        channel_title: title,
        channel_username: uname,
        posted_at: row.posted_at,
        media_type: row.media_type,
        retry: true,
        retry_count: (row.retry_count ?? 0) + 1,
      },
    }, { chunk_now: true, verify: true });

    if (result.ok) {
      success++;
      await admin
        .from("angel_channel_knowledge")
        .update({
          pushed_to_core: true,
          pushed_at: new Date().toISOString(),
          push_error: null,
          core_reference: result.reference || null,
          next_retry_at: null,
        })
        .eq("id", row.id);
    } else if (result.skipped) {
      // Không đếm — chưa cấu hình secret
    } else if ((result.error || "").toLowerCase().includes("duplicate key")) {
      // Idempotent success
      dupResolved++;
      await admin
        .from("angel_channel_knowledge")
        .update({
          pushed_to_core: true,
          pushed_at: new Date().toISOString(),
          push_error: null,
          core_reference: "duplicate-accepted",
          next_retry_at: null,
        })
        .eq("id", row.id);
    } else {
      const nextCount = (row.retry_count ?? 0) + 1;
      const stop = nextCount >= MAX_RETRIES;
      const backoffSec = BACKOFF_SEC[Math.min(nextCount, BACKOFF_SEC.length - 1)];
      if (stop) giveUp++;
      else failed++;
      await admin
        .from("angel_channel_knowledge")
        .update({
          retry_count: nextCount,
          push_error: result.error || "unknown",
          next_retry_at: stop
            ? null
            : new Date(Date.now() + backoffSec * 1000).toISOString(),
        })
        .eq("id", row.id);
    }

    // Nhẹ tay với rate-limit 60/phút → 1s giữa các request
    await new Promise((r) => setTimeout(r, 1_000));
  }

  // Telemetry
  await admin.from("angel_ai_events").insert({
    channel: "worker",
    intent: "channel.retry.batch",
    tier: "primary",
    duration_ms: 0,
    ok: failed === 0 && giveUp === 0,
    error: failed || giveUp ? `failed=${failed} giveup=${giveUp}` : null,
    meta: { processed: rows.length, success, dupResolved, failed, giveUp },
  });

  return new Response(
    JSON.stringify({ ok: true, processed: rows.length, success, dupResolved, failed, giveUp }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

Deno.serve(withUsage("angel-channel-retry", "Angel AI · Ingest Retry", handle));
