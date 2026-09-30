/**
 * Admin endpoint quản lý channel Angel theo dõi.
 *
 * Actions (POST body { action, ... }):
 *   - "list"          → trả danh sách channel + số knowledge đã ingest
 *   - "add"           → thêm channel { chat_id, username?, title? }
 *   - "toggle"        → bật/tắt { chat_id, is_active }
 *   - "toggle_push"   → bật/tắt auto push { chat_id, auto_push_to_core }
 *   - "remove"        → xoá channel (không xoá knowledge cũ) { chat_id }
 *   - "repush"        → re-push toàn bộ knowledge chưa pushed của channel { chat_id }
 *   - "recent"        → xem 50 message mới nhất đã ingest { chat_id }
 *
 * Ai gọi: chỉ user có role 'admin' trong public.user_roles.
 */

import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import {
  pushToAngelKnowledge,
  deleteFromAngelKnowledge,
  getAngelKnowledgeStatus,
  testAngelKnowledgeConnection,
} from "../_shared/angel-knowledge.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function retryAtForAngelError(code?: string, status?: number): string | null {
  const transient = [
    "ANGEL_KNOWLEDGE_NETWORK_ERROR",
    "ANGEL_KNOWLEDGE_TIMEOUT",
    "ANGEL_KNOWLEDGE_VERIFY_FAILED",
    "ANGEL_KNOWLEDGE_NOT_PERSISTED",
  ].includes(code || "") || (code === "ANGEL_KNOWLEDGE_HTTP_ERROR" && (status === 429 || (status !== undefined && status >= 500)));
  return transient ? new Date(Date.now() + 60_000).toISOString() : null;
}

function safeKnowledgeError(error: string | null): string | null {
  if (!error) return null;
  const code = error.match(/\bANGEL_KNOWLEDGE_[A-Z_]+\b/)?.[0];
  const status = error.match(/HTTP (\d{3})/)?.[1];
  if (code === "ANGEL_KNOWLEDGE_SECRET_MISSING") return `${code}: Chưa cấu hình secret.`;
  if (code === "ANGEL_KNOWLEDGE_TIMEOUT") return `${code}: Quá thời gian chờ.`;
  if (code === "ANGEL_KNOWLEDGE_NETWORK_ERROR") return `${code}: Lỗi mạng.`;
  if (code === "ANGEL_KNOWLEDGE_NOT_PERSISTED") return `${code}: HTTP 2xx nhưng document chưa được xác nhận lưu.`;
  if (code === "ANGEL_KNOWLEDGE_HTTP_ERROR") return `${code}${status ? ` (HTTP ${status})` : ""}.`;
  return `${code || "ANGEL_KNOWLEDGE_ERROR"}: Push chưa thành công.`;
}

function maskedReference(reference: string | null): string | null {
  return reference ? `••••${reference.slice(-4)}` : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization") || "";

  // Verify user + admin role
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return json({ ok: false, code: "AUTH_REQUIRED", error: "Bé cần đăng nhập lại để tiếp tục." }, 401);
  }
  const uid = userData.user.id;

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: roleRow, error: roleError } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", uid)
    .eq("role", "admin")
    .maybeSingle();
  if (roleError) return json({ ok: false, code: "ADMIN_CHECK_FAILED", error: "Không kiểm tra được quyền quản trị." }, 500);
  if (!roleRow) return json({ ok: false, code: "ADMIN_REQUIRED", error: "Chỉ admin mới được quản lý Angel Channels." }, 403);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const action = String(body.action || "");

  try {
    switch (action) {
      case "list": {
        const { data, error } = await admin
          .from("angel_watched_channels")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) throw error;
        return json({ channels: data || [] });
      }

      case "add": {
        const chatId = Number(body.chat_id);
        if (!Number.isFinite(chatId)) return json({ error: "chat_id required" }, 400);
        const { data, error } = await admin
          .from("angel_watched_channels")
          .upsert(
            {
              chat_id: chatId,
              username: body.username ? String(body.username).replace(/^@/, "") : null,
              title: body.title ? String(body.title) : null,
              is_active: true,
              auto_push_to_core: true,
              added_by: uid,
              notes: body.notes ? String(body.notes) : null,
            },
            { onConflict: "chat_id" },
          )
          .select()
          .maybeSingle();
        if (error) throw error;
        return json({ channel: data });
      }

      case "toggle": {
        const chatId = Number(body.chat_id);
        const isActive = Boolean(body.is_active);
        if (!Number.isFinite(chatId)) return json({ error: "chat_id required" }, 400);
        const { error } = await admin
          .from("angel_watched_channels")
          .update({ is_active: isActive })
          .eq("chat_id", chatId);
        if (error) throw error;
        return json({ ok: true });
      }

      case "toggle_push": {
        const chatId = Number(body.chat_id);
        const auto = Boolean(body.auto_push_to_core);
        if (!Number.isFinite(chatId)) return json({ error: "chat_id required" }, 400);
        const { error } = await admin
          .from("angel_watched_channels")
          .update({ auto_push_to_core: auto })
          .eq("chat_id", chatId);
        if (error) throw error;
        return json({ ok: true });
      }

      case "remove": {
        const chatId = Number(body.chat_id);
        if (!Number.isFinite(chatId)) return json({ error: "chat_id required" }, 400);
        const { error } = await admin
          .from("angel_watched_channels")
          .delete()
          .eq("chat_id", chatId);
        if (error) throw error;
        return json({ ok: true });
      }

      case "recent": {
        const chatId = Number(body.chat_id);
        if (!Number.isFinite(chatId)) return json({ error: "chat_id required" }, 400);
        const { data, error } = await admin
          .from("angel_channel_knowledge")
          .select("id, message_id, content, media_type, posted_at, pushed_to_core, pushed_at, push_error, core_reference, merged_message_ids, next_retry_at")
          .eq("chat_id", chatId)
          .order("message_id", { ascending: false })
          .limit(50);
        if (error) throw error;
        const messages = data || [];
        const refs = messages.map((row) => `${chatId}:${row.message_id}`);
        const remoteStatus = refs.length
          ? await getAngelKnowledgeStatus("telegram_channel", refs)
          : { ok: true, items: [] as unknown[], code: undefined as string | undefined };
        const persistedRefs = new Set((remoteStatus.items || []).flatMap((item) => {
          if (!item || typeof item !== "object") return [];
          const ref = (item as Record<string, unknown>).source_ref ?? (item as Record<string, unknown>).sourceRef;
          return typeof ref === "string" ? [ref] : [];
        }));
        return json({
          messages: messages.map((row) => ({
            ...row,
            push_error: safeKnowledgeError(row.push_error),
            core_reference: maskedReference(row.core_reference),
            persisted_on_core: remoteStatus.ok ? persistedRefs.has(`${chatId}:${row.message_id}`) : null,
            verification_code: !remoteStatus.ok
              ? remoteStatus.code || "ANGEL_KNOWLEDGE_VERIFY_FAILED"
              : row.pushed_to_core && !persistedRefs.has(`${chatId}:${row.message_id}`)
              ? "ANGEL_KNOWLEDGE_NOT_PERSISTED"
              : null,
          })),
        });
      }

      case "test_connection": {
        const result = await testAngelKnowledgeConnection();
        return json({
          ok: result.ok,
          code: result.code,
          status: result.status,
          error: result.error,
        });
      }

      case "toggle_warn_long": {
        const chatId = Number(body.chat_id);
        const warn = Boolean(body.warn_long_posts);
        if (!Number.isFinite(chatId)) return json({ error: "chat_id required" }, 400);
        const { error } = await admin
          .from("angel_watched_channels")
          .update({ warn_long_posts: warn })
          .eq("chat_id", chatId);
        if (error) throw error;
        return json({ ok: true });
      }

      case "repush": {
        const chatId = Number(body.chat_id);
        if (!Number.isFinite(chatId)) return json({ error: "chat_id required" }, 400);
        const force = body.force === true;

        // Bao gồm cả false-positive: pushed_to_core=true nhưng core_reference IS NULL
        // (HTTP 2xx nhưng Angel AI gốc không lưu thật). force=true → repush tất cả.
        let query = admin
          .from("angel_channel_knowledge")
          .select("id, message_id, content, media_type, posted_at")
          .eq("chat_id", chatId)
          .not("content", "is", null);
        if (!force) {
          query = query.or("pushed_to_core.eq.false,core_reference.is.null");
        }
        const { data: rows, error } = await query
          .order("message_id", { ascending: true })
          .limit(200);
        if (error) throw error;

        const { data: channel } = await admin
          .from("angel_watched_channels")
          .select("title, username")
          .eq("chat_id", chatId)
          .maybeSingle();

        let success = 0;
        let failed = 0;
        let skipped = 0;
        let sentCount = 0;
        let persistedCount = 0;
        let lastPushAt: string | null = null;
        const errors: Array<{ message_id: number; code: string; error: string }> = [];
        for (const row of rows || []) {
          const postUrl = channel?.username
            ? `https://t.me/${String(channel.username).replace(/^@/, "")}/${row.message_id}`
            : undefined;
          const result = await pushToAngelKnowledge(
            {
              source: "telegram_channel",
              external_id: `${chatId}:${row.message_id}`,
              title: `${channel?.title || channel?.username || "Telegram Channel"} #${row.message_id}`,
              content: row.content || "",
              url: postUrl,
              language: "vi",
              folder: `Telegram / ${channel?.title || channel?.username || chatId}`,
              metadata: {
                chat_id: chatId,
                message_id: row.message_id,
                channel_title: channel?.title,
                channel_username: channel?.username,
                posted_at: row.posted_at,
                media_type: row.media_type,
              },
            },
            { chunk_now: true, verify: true },
          );
          if (result.ok) {
            success++;
            sentCount += result.sentCount ?? 1;
            persistedCount += result.persistedCount ?? 0;
            lastPushAt = new Date().toISOString();
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
            skipped++;
            await admin
              .from("angel_channel_knowledge")
              .update({
                pushed_to_core: false,
                pushed_at: null,
                push_error: `${result.code || "ANGEL_KNOWLEDGE_SECRET_MISSING"}: ${result.error || "Chưa cấu hình secret."}`,
                core_reference: null,
                next_retry_at: null,
              })
              .eq("id", row.id);
          } else {
            // Duplicate key = server gốc đã có doc này rồi → coi như success idempotent.
            const isDuplicate = (result.error || "").toLowerCase().includes("duplicate key");
            if (isDuplicate) {
              success++;
              sentCount += result.sentCount ?? 1;
              persistedCount += result.persistedCount ?? 1;
              lastPushAt = new Date().toISOString();
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
              failed++;
              sentCount += result.sentCount ?? 1;
              persistedCount += result.persistedCount ?? 0;
              const safeError = result.error || "Không đẩy được document.";
              errors.push({ message_id: row.message_id, code: result.code || "ANGEL_KNOWLEDGE_ERROR", error: safeError });
              await admin
                .from("angel_channel_knowledge")
                .update({
                  pushed_to_core: false,
                  pushed_at: null,
                  push_error: `${result.code || "ANGEL_KNOWLEDGE_ERROR"}: ${safeError}`,
                  core_reference: null,
                  retry_count: 0,
                  next_retry_at: retryAtForAngelError(result.code, result.status),
                })
                .eq("id", row.id);
            }
          }

        }
        return json({
          total: rows?.length ?? 0,
          sent: sentCount,
          persisted: persistedCount,
          success,
          failed,
          skipped,
          lastPushAt,
          errors: errors.slice(0, 10),
        });
      }

      case "force_repush_row": {
        // Repush 1 row cụ thể với verify=true. Nếu server báo not_persisted
        // và delete_first=true → xoá bên gốc trước rồi push lại (fix dedupe/tombstone).
        const knowledgeId = String(body.knowledge_id || "");
        const deleteFirst = body.delete_first === true;
        if (!knowledgeId) return json({ error: "knowledge_id required" }, 400);

        const { data: row, error: rowErr } = await admin
          .from("angel_channel_knowledge")
          .select("id, chat_id, message_id, content, media_type, posted_at")
          .eq("id", knowledgeId)
          .maybeSingle();
        if (rowErr) throw rowErr;
        if (!row) return json({ error: "row not found" }, 404);
        if (!row.content) return json({ error: "row has no text content" }, 400);

        const { data: channel } = await admin
          .from("angel_watched_channels")
          .select("title, username")
          .eq("chat_id", row.chat_id)
          .maybeSingle();

        const uname = channel?.username ? String(channel.username).replace(/^@/, "") : null;
        const url = uname ? `https://t.me/${uname}/${row.message_id}` : undefined;
        const sourceRef = `${row.chat_id}:${row.message_id}`;
        const title = channel?.title || channel?.username || `Channel ${row.chat_id}`;

        let deleted = false;
        if (deleteFirst) {
          const del = await deleteFromAngelKnowledge("telegram_channel", sourceRef);
          deleted = del.ok;
          if (!del.ok && !del.skipped) {
            console.log(`[force_repush_row] delete failed: ${del.error}`);
          }
        }

        const push = await pushToAngelKnowledge(
          {
            source: "telegram_channel",
            source_ref: sourceRef,
            title: `${title} #${row.message_id}`,
            content: String(row.content),
            url,
            language: "vi",
            folder: `Telegram / ${title}`,
            metadata: {
              chat_id: row.chat_id,
              message_id: row.message_id,
              channel_title: channel?.title,
              channel_username: uname,
              posted_at: row.posted_at,
              media_type: row.media_type,
              force_repush: true,
              delete_first: deleteFirst,
            },
          },
          { chunk_now: true, verify: true },
        );

        if (push.ok) {
          await admin
            .from("angel_channel_knowledge")
            .update({
              pushed_to_core: true,
              pushed_at: new Date().toISOString(),
              push_error: null,
              core_reference: push.reference || "verified",
              next_retry_at: null,
              retry_count: 0,
            })
            .eq("id", row.id);
          return json({
            ok: true,
            deleted,
            verified: true,
            sent: push.sentCount ?? 1,
            persisted: push.persistedCount ?? 1,
            lastPushAt: new Date().toISOString(),
            reference: maskedReference(push.reference || null),
          });
        }

        // Ghi lỗi rõ ràng (không âm thầm báo thành công)
        const errMsg = `${push.code || "ANGEL_KNOWLEDGE_ERROR"}: ${push.error || "Không đẩy được document."}`;
        await admin
          .from("angel_channel_knowledge")
          .update({
            pushed_to_core: false,
            pushed_at: null,
            push_error: errMsg,
            core_reference: null,
            retry_count: 0,
            next_retry_at: retryAtForAngelError(push.code, push.status),
          })
          .eq("id", row.id);

        return json({
          ok: false,
          deleted,
          verified: false,
          code: push.code || "ANGEL_KNOWLEDGE_ERROR",
          error: push.error || "Không đẩy được document.",
          hint: push.code === "ANGEL_KNOWLEDGE_NOT_PERSISTED"
            ? "Server gốc nhận HTTP 200 nhưng không lưu. Thử lại với delete_first=true để xoá tombstone trước."
            : undefined,
        });
      }

      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    console.error("[angel-channel-manage] action failed", action, err instanceof Error ? err.name : "unknown");
    return json({ ok: false, code: "CHANNEL_MANAGE_FAILED", error: "Không hoàn tất được thao tác quản lý channel." }, 500);
  }
});
