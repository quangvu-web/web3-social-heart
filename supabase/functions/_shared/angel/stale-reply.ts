// _shared/angel/stale-reply.ts
// TIER 2 (Step 3) — Stale content fallback.
// Khi mọi provider AI đều lỗi cho câu hỏi lặp lại của user, thay vì trả
// "🙏 Angel đang bận đôi chút…", ta cố gắng lấy lại bot_reply thành công
// gần nhất cho câu hỏi tương tự trong 24h qua và trả về (kèm 1 câu mở nhẹ
// để không giống hệt lần trước).

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

function normalize(s: string): string {
  return (s || "").toLowerCase().replace(/\s+/g, " ").replace(/[.,!?…"'“”‘’]+/g, "").trim();
}

function tokenSet(s: string): Set<string> {
  return new Set(normalize(s).split(/\s+/).filter((w) => w.length >= 2));
}

function jaccard(a: string, b: string): number {
  const A = tokenSet(a);
  const B = tokenSet(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  const union = A.size + B.size - inter;
  return union > 0 ? inter / union : 0;
}

const STALE_WINDOW_HOURS = 24;
const STALE_JACCARD_THRESHOLD = 0.6;
const STALE_ROW_LIMIT = 20;

export interface StaleReplyResult {
  reply: string;
  similarity: number;
  ageMinutes: number;
}

/**
 * Tìm bot_reply thành công gần nhất cho câu hỏi tương tự.
 * Chỉ dùng khi askAngel đã vào catch block và tất cả retry đều fail.
 */
export async function findStaleGoodReply(
  adminClient: SupabaseClient | null | undefined,
  params: {
    chatId: number | string;
    telegramUserId: number | string;
    currentQuestion: string;
  },
): Promise<StaleReplyResult | null> {
  if (!adminClient) return null;
  try {
    const chatId = typeof params.chatId === "string" ? Number(params.chatId) : params.chatId;
    const userId = typeof params.telegramUserId === "string" ? Number(params.telegramUserId) : params.telegramUserId;
    if (!Number.isFinite(chatId) || !Number.isFinite(userId)) return null;
    const cur = normalize(params.currentQuestion);
    if (!cur) return null;

    const since = new Date(Date.now() - STALE_WINDOW_HOURS * 3600_000).toISOString();
    const { data, error } = await adminClient
      .from("telegram_ai_conversations")
      .select("user_message, bot_reply, error, created_at")
      .eq("chat_id", chatId)
      .eq("user_id", userId)
      .is("error", null)
      .not("bot_reply", "is", null)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(STALE_ROW_LIMIT);
    if (error || !Array.isArray(data)) return null;

    for (const row of data) {
      const prev = String(row?.user_message ?? "");
      const reply = String(row?.bot_reply ?? "").trim();
      if (!prev || !reply || reply.length < 30) continue;
      // Skip stale busy/fallback text.
      if (/Angel đang bận|Angel đang bảo trì|Angel đang nghỉ/i.test(reply)) continue;
      const p = normalize(prev);
      if (!p) continue;
      const sim = p === cur ? 1 : jaccard(p, cur);
      if (sim >= STALE_JACCARD_THRESHOLD) {
        const age = Math.round((Date.now() - new Date(row.created_at as string).getTime()) / 60_000);
        return { reply, similarity: sim, ageMinutes: age };
      }
    }
    return null;
  } catch (e) {
    console.warn("[findStaleGoodReply] failed (non-fatal)", e);
    return null;
  }
}

/** Thêm câu mở nhẹ để không giống hệt lần trước. */
export function decorateStaleReply(reply: string, ageMinutes: number): string {
  const opener = ageMinutes < 60
    ? "💛 Angel vừa chia sẻ với bé rồi, xin gửi lại để bé đọc kỹ hơn nhé:\n\n"
    : "💛 Angel gửi lại nội dung đã chia sẻ với bé về câu này:\n\n";
  return opener + reply;
}
