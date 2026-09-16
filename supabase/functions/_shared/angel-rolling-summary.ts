// Angel Rolling Summary
// ---------------------
// Nén phần đầu hội thoại dài thành 1 khối tóm tắt ngắn (~200-400 tokens),
// giữ nguyên N turn gần nhất. Chạy async fire-and-forget sau khi bot reply.
//
// Storage: bảng angel_conversation_summary, unique (channel, scope_key).

import { getFlag } from "./angel/flags.ts";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const SUMMARY_MODEL = "google/gemini-3.1-flash-lite";

export type RollingChannel = "telegram_dm" | "telegram_group" | "web";

export type RollingSummaryRow = {
  id: string;
  channel: RollingChannel;
  scope_key: string;
  summary: string;
  turns_covered: number;
  updated_at: string;
};

export type RollingSummarySettings = {
  enabled: boolean;
  turnThreshold: number; // total msgs in history to trigger summarize
  keepRecent: number; // keep this many recent turns raw
};

type HistoryMsg = { role: "user" | "assistant"; content: string };

export async function loadRollingSummary(
  admin: SupabaseClient | null | undefined,
  params: { channel: RollingChannel; scopeKey: string | number },
): Promise<RollingSummaryRow | null> {
  if (!admin) return null;
  const key = String(params.scopeKey);
  if (!key) return null;
  try {
    const { data, error } = await admin
      .from("angel_conversation_summary")
      .select("id, channel, scope_key, summary, turns_covered, updated_at")
      .eq("channel", params.channel)
      .eq("scope_key", key)
      .maybeSingle();
    if (error) {
      console.warn("[rolling-summary] read failed", error.message);
      return null;
    }
    return (data as RollingSummaryRow | null) ?? null;
  } catch (e) {
    console.warn("[rolling-summary] read threw", e);
    return null;
  }
}

/** Prepend a system-style [TÓM TẮT HỘI THOẠI TRƯỚC] message when a summary exists. */
export function buildSummaryPrefix(
  row: RollingSummaryRow | null,
): { role: "system"; content: string } | null {
  if (!row || !row.summary || row.summary.trim().length < 10) return null;
  return {
    role: "system",
    content:
      `[TÓM TẮT HỘI THOẠI TRƯỚC — dùng để bám ngữ cảnh, KHÔNG phải câu hỏi mới]\n${row.summary.trim()}\n\nGhi chú: chỉ dùng làm ngữ cảnh; ưu tiên các tin nhắn gần nhất phía dưới.`,
  };
}

function shouldTrigger(historyLen: number, settings: RollingSummarySettings): boolean {
  if (!settings.enabled) return false;
  if (settings.turnThreshold <= 0) return false;
  return historyLen >= settings.turnThreshold;
}

/**
 * Fire-and-forget: nếu history đã dài, cập nhật summary (incremental).
 * `history` là toàn bộ turn của phiên hiện tại (theo thứ tự cũ→mới).
 */
export async function scheduleRollingSummaryUpdate(
  admin: SupabaseClient | null | undefined,
  params: {
    channel: RollingChannel;
    scopeKey: string | number;
    history: HistoryMsg[];
    settings: RollingSummarySettings;
  },
): Promise<void> {
  if (!admin) return;
  if (!(await getFlag("cost.rolling_summary_enabled", true))) return;
  const scopeKey = String(params.scopeKey);
  if (!scopeKey) return;
  if (!shouldTrigger(params.history.length, params.settings)) return;

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return;

  const keep = Math.max(1, params.settings.keepRecent);
  const toCompress = params.history.slice(0, Math.max(0, params.history.length - keep));
  if (toCompress.length === 0) return;

  const existing = await loadRollingSummary(admin, { channel: params.channel, scopeKey });
  const existingSummary = existing?.summary?.trim() || "";

  // Build compact transcript
  const transcript = toCompress
    .map((m) => `[${m.role === "user" ? "BÉ" : "ANGEL"}] ${String(m.content ?? "").slice(0, 800)}`)
    .join("\n");

  const prompt = `Bạn là bộ tóm tắt hội thoại cho Angel AI (trợ lý tiếng Việt).

Nhiệm vụ: cập nhật bản TÓM TẮT DÀI HẠN cho một phiên chat, dùng để nhắc nhớ cho các lượt kế tiếp.

YÊU CẦU:
- Viết bằng tiếng Việt tự nhiên, ngôi thứ 3 ("bé", "Angel").
- Giữ ~180-320 từ, có cấu trúc gạch đầu dòng cho các chủ đề chính đã bàn.
- Chỉ giữ điều BỀN VỮNG (chủ đề đang theo, quyết định, mối bận tâm, thông tin bé chia sẻ). Bỏ chào hỏi, đùa vặt, câu hỏi lặp.
- KHÔNG chứa URL, số ví, số điện thoại, seed phrase, mã OTP.
- KHÔNG dùng markdown code block.

BẢN TÓM TẮT HIỆN CÓ (có thể rỗng):
${existingSummary || "(chưa có)"}

CÁC TIN NHẮN CŨ CẦN NÉN VÀO TÓM TẮT (theo thứ tự thời gian):
${transcript}

Trả về CHỈ nội dung tóm tắt mới (đã kết hợp bản cũ + các tin trên), không thêm tiêu đề "Tóm tắt:", không lời dẫn.`;

  try {
    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: SUMMARY_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
      }),
    });
    if (!res.ok) {
      console.warn("[rolling-summary] gateway", res.status);
      return;
    }
    const data = await res.json();
    const newSummary = String(data?.choices?.[0]?.message?.content ?? "").trim();
    if (!newSummary || newSummary.length < 20) return;

    const turnsCovered = (existing?.turns_covered ?? 0) + toCompress.length;
    await admin
      .from("angel_conversation_summary")
      .upsert(
        {
          channel: params.channel,
          scope_key: scopeKey,
          summary: newSummary.slice(0, 4000),
          turns_covered: turnsCovered,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "channel,scope_key" },
      );
    console.log(
      `[rolling-summary] updated ${params.channel}:${scopeKey} turns=${turnsCovered} len=${newSummary.length}`,
    );
  } catch (e) {
    console.warn("[rolling-summary] extract threw", e);
  }
}

/** Đọc settings từ angel_memory_settings row id=1. */
export async function getRollingSummarySettings(
  admin: SupabaseClient | null | undefined,
  channel: RollingChannel,
): Promise<RollingSummarySettings> {
  const fallback: RollingSummarySettings = { enabled: false, turnThreshold: 12, keepRecent: 8 };
  if (!admin) return fallback;
  try {
    const { data } = await admin
      .from("angel_memory_settings")
      .select(
        "rolling_summary_dm, rolling_summary_group, rolling_summary_web, rolling_summary_turn_threshold, rolling_summary_keep_recent",
      )
      .eq("id", 1)
      .maybeSingle();
    if (!data) return fallback;
    const enabled = channel === "telegram_dm"
      ? !!data.rolling_summary_dm
      : channel === "telegram_group"
      ? !!data.rolling_summary_group
      : !!data.rolling_summary_web;
    return {
      enabled,
      turnThreshold: Number(data.rolling_summary_turn_threshold ?? 12) || 12,
      keepRecent: Number(data.rolling_summary_keep_recent ?? 8) || 8,
    };
  } catch {
    return fallback;
  }
}

/** Xoá summary của 1 scope (admin/debug). */
export async function forgetRollingSummary(
  admin: SupabaseClient | null | undefined,
  params: { channel: RollingChannel; scopeKey: string | number },
): Promise<boolean> {
  if (!admin) return false;
  const scopeKey = String(params.scopeKey);
  if (!scopeKey) return false;
  try {
    const { error } = await admin
      .from("angel_conversation_summary")
      .delete()
      .eq("channel", params.channel)
      .eq("scope_key", scopeKey);
    if (error) {
      console.warn("[rolling-summary] forget failed", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn("[rolling-summary] forget threw", e);
    return false;
  }
}
