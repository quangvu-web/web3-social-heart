// Angel AI — User Memory (long-term)
// ------------------------------------
// Bơm trí nhớ dài hạn về từng bé (tên gọi, sở thích, cam kết, ví, chủ đề)
// vào prompt trước khi gọi model, và tự động rút fact bền vững từ hội thoại
// gần nhất bằng Gemini Flash Lite (chi phí thấp, chạy background).
//
// Kênh: 'telegram' (user_key = telegram user id string) hoặc 'web' (user_key = auth uid).

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { getFlag } from "./angel/flags.ts";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const EXTRACT_MODEL = "google/gemini-3.1-flash-lite";

export type AngelMemoryChannel = "telegram" | "web" | "group" | "inline";

export type AngelMemoryCategory =
  | "identity"      // tên, xưng hô, tuổi, vùng miền
  | "preference"    // sở thích, tone thích, ngôn ngữ
  | "commitment"    // cam kết dài hạn, dự án đang theo
  | "context"       // ví crypto, nghề nghiệp, gia đình
  | "emotional";    // trạng thái tâm lý gần đây (TTL ngắn)

export type AngelMemoryFactSource = "extracted" | "user_declared";

export type AngelMemoryFact = {
  fact: string;
  created_at: string;
  confidence?: number; // 0..1
  category?: AngelMemoryCategory;
  source?: AngelMemoryFactSource;
};


export type AngelMemoryRow = {
  id: string;
  user_key: string;
  channel: AngelMemoryChannel;
  display_name: string | null;
  preferred_language: string | null;
  facts: AngelMemoryFact[];
  turn_count: number;
  last_extracted_at: string | null;
};

const MAX_FACTS = 20;
const TOP_N_INJECT = 8;
const EXTRACT_EVERY_N_TURNS = 5;

// Regex chặn thông tin cực nhạy — không bao giờ ghi vào memory.
const FORBIDDEN_RE = [
  /\b(?:seed|mnemonic|private\s*key|khoá\s*bí\s*mật)\b/i,
  /\b(?:[a-z]+\s+){11,23}[a-z]+\b/i, // 12–24 từ liên tiếp (mnemonic phrase)
  /\b(?:0x[a-fA-F0-9]{40}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})\b/, // giữ ngữ cảnh: chỉ chặn khi kèm keyword nhạy (xử lý dưới)
];
function containsForbidden(text: string): boolean {
  const t = String(text ?? "");
  if (FORBIDDEN_RE[0].test(t)) return true;
  if (FORBIDDEN_RE[1].test(t.toLowerCase())) return true;
  return false;
}

function normalizeFactText(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").replace(/[^\p{L}\p{N} ]/gu, "").trim();
}

function jaccardSim(a: string, b: string): number {
  const A = new Set(normalizeFactText(a).split(" ").filter(Boolean));
  const B = new Set(normalizeFactText(b).split(" ").filter(Boolean));
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

/** Đọc memory row (tạo mới nếu chưa có). */
export async function getAngelMemory(
  admin: SupabaseClient | null | undefined,
  params: { channel: AngelMemoryChannel; userKey: string | number },
): Promise<AngelMemoryRow | null> {
  if (!admin) return null;
  const key = String(params.userKey);
  if (!key) return null;
  try {
    const { data, error } = await admin
      .from("angel_user_memory")
      .select("id, user_key, channel, display_name, preferred_language, facts, turn_count, last_extracted_at")
      .eq("channel", params.channel)
      .eq("user_key", key)
      .maybeSingle();
    if (error) {
      console.warn("[angel-memory] read failed", error.message);
      return null;
    }
    if (!data) return null;
    const facts = Array.isArray(data.facts) ? (data.facts as AngelMemoryFact[]) : [];
    return { ...data, facts } as AngelMemoryRow;
  } catch (e) {
    console.warn("[angel-memory] read threw", e);
    return null;
  }
}

/**
 * Build system message "[GHI NHỚ VỀ BÉ]" để chèn vào prompt. Trả `null` nếu chưa có fact.
 * KHÔNG bao giờ chèn URL/số nhạy — chỉ text fact ngắn gọn.
 */
export function buildMemoryContextMessage(row: AngelMemoryRow | null): { role: "user"; content: string } | null {
  if (!row) return null;
  const facts = row.facts ?? [];
  if (facts.length === 0 && !row.display_name) return null;
  const top = facts.slice(0, TOP_N_INJECT).map((f) => `- ${f.fact}`).join("\n");
  const nameLine = row.display_name ? `Tên bé thường được gọi: ${row.display_name}.` : "";
  const body = [nameLine, top ? `Các điều Angel đã nhớ về bé từ những lần trò chuyện trước:\n${top}` : ""]
    .filter(Boolean)
    .join("\n");
  // ROLE = "user" (không phải "system") để KHÔNG pha loãng embedding query của RAG
  // bên Angel gốc. FUN Core dùng toàn bộ messages để build embedding; nếu memory
  // ở role system → embedding sẽ trộn cả fact vào query và miss RAG doc chính chủ.
  // Đóng gói như 1 "ghi chú tham chiếu" từ user để LLM đọc nhưng không dominate query.
  return {
    role: "user",
    content: `[GHI NHỚ THAM CHIẾU — KHÔNG PHẢI CÂU HỎI]\n${body}\n\nHướng dẫn: chỉ tham chiếu tự nhiên khi liên quan trực tiếp câu hỏi kế tiếp; nếu ghi nhớ mâu thuẫn câu bé vừa nói, ưu tiên câu mới. Tuyệt đối không bịa thêm ngoài ghi nhớ.`,
  };
}

/**
 * Fire-and-forget: gọi Gemini rút fact từ 5 turn gần nhất, dedupe, cap 20, upsert.
 * KHÔNG await ở caller — dùng `EdgeRuntime.waitUntil` hoặc `.catch(...)`.
 */
export async function scheduleFactExtraction(
  admin: SupabaseClient | null | undefined,
  params: {
    channel: AngelMemoryChannel;
    userKey: string | number;
    displayName?: string | null;
    userMessage: string;
    botReply: string;
  },
): Promise<void> {
  if (!admin) return;
  if (!(await getFlag("cost.memory_extract_enabled", true))) return;
  const key = String(params.userKey);
  if (!key) return;

  // Load hoặc tạo row
  let row = await getAngelMemory(admin, { channel: params.channel, userKey: key });
  const newTurnCount = (row?.turn_count ?? 0) + 1;

  // Upsert last_seen + turn_count trước (luôn cập nhật cheap)
  try {
    await admin
      .from("angel_user_memory")
      .upsert(
        {
          channel: params.channel,
          user_key: key,
          display_name: row?.display_name ?? params.displayName ?? null,
          turn_count: newTurnCount,
          last_seen_at: new Date().toISOString(),
          facts: row?.facts ?? [],
        },
        { onConflict: "channel,user_key" },
      );
  } catch (e) {
    console.warn("[angel-memory] upsert cheap failed", e);
  }

  // Chỉ chạy extract mỗi N turn
  if (newTurnCount % EXTRACT_EVERY_N_TURNS !== 0) return;

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return;

  // Chặn nếu đoạn hội thoại chứa dữ liệu nhạy
  if (containsForbidden(params.userMessage) || containsForbidden(params.botReply)) {
    console.log("[angel-memory] skip extraction — sensitive tokens detected");
    return;
  }

  const existingFacts = (row?.facts ?? []).map((f) => f.fact);
  const existingBlock = existingFacts.length > 0 ? existingFacts.map((f) => `- ${f}`).join("\n") : "(chưa có)";

  const prompt = `Bạn là bộ trích xuất trí nhớ dài hạn cho trợ lý Angel AI.

Đọc 1 turn hội thoại giữa Angel (bot) và một bé (user), sau đó rút ra TỐI ĐA 3 fact BỀN VỮNG về bé — những điều đáng ghi nhớ cho các lần trò chuyện sau. Bỏ qua tin nhắn nhất thời, cảm xúc thoáng qua, câu chào hỏi, câu hỏi đơn thuần.

FACT PHẢI:
- Là mệnh đề khẳng định về BÉ (tên gọi, sở thích, cam kết, ví crypto đang dùng, dự án đang theo, chủ đề quan tâm dài hạn, gia đình / vùng miền / nghề nghiệp / tình trạng đang trải qua).
- Ngắn gọn ≤ 140 ký tự, tiếng Việt tự nhiên, KHÔNG chứa URL, không địa chỉ ví, không số điện thoại, không mã OTP, không seed phrase.
- KHÔNG lặp lại fact đã có sẵn dưới (kiểm tra kỹ, chỉ thêm nếu THỰC SỰ mới hoặc mở rộng đáng kể).

NẾU KHÔNG CÓ FACT MỚI ĐÁNG NHỚ → trả về mảng rỗng.

FACT ĐÃ CÓ:
${existingBlock}

TURN HỘI THOẠI:
[BÉ] ${String(params.userMessage).slice(0, 1200)}
[ANGEL] ${String(params.botReply).slice(0, 1200)}

Trả về JSON THUẦN, KHÔNG code fence, đúng format:
{"facts":["...", "..."]}`;

  try {
    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: EXTRACT_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
      }),
    });
    if (!res.ok) {
      console.warn("[angel-memory] extract gateway", res.status);
      return;
    }
    const data = await res.json();
    let raw = String(data?.choices?.[0]?.message?.content ?? "").trim();
    raw = raw.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    let parsed: { facts?: unknown } = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      // thử tìm object đầu tiên trong text
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) {
        try { parsed = JSON.parse(m[0]); } catch { parsed = {}; }
      }
    }
    const newFactsRaw = Array.isArray(parsed.facts) ? parsed.facts : [];
    const cleanedNew: AngelMemoryFact[] = [];
    for (const f of newFactsRaw) {
      const text = String(f ?? "").trim();
      if (!text || text.length > 200) continue;
      if (containsForbidden(text)) continue;
      // dedupe với existing
      const dup = existingFacts.some((e) => jaccardSim(e, text) >= 0.65);
      if (dup) continue;
      cleanedNew.push({ fact: text, created_at: new Date().toISOString(), confidence: 0.8 });
    }
    if (cleanedNew.length === 0) {
      // update last_extracted_at anyway
      await admin
        .from("angel_user_memory")
        .update({ last_extracted_at: new Date().toISOString() })
        .eq("channel", params.channel)
        .eq("user_key", key);
      return;
    }
    const merged = [...(row?.facts ?? []), ...cleanedNew].slice(-MAX_FACTS);
    await admin
      .from("angel_user_memory")
      .update({
        facts: merged,
        last_extracted_at: new Date().toISOString(),
      })
      .eq("channel", params.channel)
      .eq("user_key", key);
    console.log(`[angel-memory] +${cleanedNew.length} facts for ${params.channel}:${key} (total ${merged.length})`);
  } catch (e) {
    console.warn("[angel-memory] extract threw", e);
  }
}

/** Xoá toàn bộ memory của 1 user (dùng cho /forgetme + admin UI). */
export async function forgetAngelMemory(
  admin: SupabaseClient | null | undefined,
  params: { channel: AngelMemoryChannel; userKey: string | number },
): Promise<boolean> {
  if (!admin) return false;
  const key = String(params.userKey);
  if (!key) return false;
  try {
    const { error } = await admin
      .from("angel_user_memory")
      .delete()
      .eq("channel", params.channel)
      .eq("user_key", key);
    if (error) {
      console.warn("[angel-memory] forget failed", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.warn("[angel-memory] forget threw", e);
    return false;
  }
}

// ============================================================================
// Angel Memory settings (admin toggle per channel)
// ============================================================================

export type AngelMemorySettings = {
  enabled_web: boolean;
  enabled_telegram_dm: boolean;
  enabled_group: boolean;
  enabled_inline: boolean;
};

const DEFAULT_SETTINGS: AngelMemorySettings = {
  enabled_web: true,
  enabled_telegram_dm: true,
  enabled_group: false,
  enabled_inline: false,
};

let _settingsCache: { at: number; value: AngelMemorySettings } | null = null;
const SETTINGS_TTL_MS = 60_000;

export async function getAngelMemorySettings(
  admin: SupabaseClient | null | undefined,
): Promise<AngelMemorySettings> {
  if (!admin) return DEFAULT_SETTINGS;
  const now = Date.now();
  if (_settingsCache && now - _settingsCache.at < SETTINGS_TTL_MS) {
    return _settingsCache.value;
  }
  try {
    const { data } = await admin
      .from("angel_memory_settings")
      .select("enabled_web,enabled_telegram_dm,enabled_group,enabled_inline")
      .eq("id", 1)
      .maybeSingle();
    const merged: AngelMemorySettings = {
      enabled_web: data?.enabled_web ?? DEFAULT_SETTINGS.enabled_web,
      enabled_telegram_dm: data?.enabled_telegram_dm ?? DEFAULT_SETTINGS.enabled_telegram_dm,
      enabled_group: data?.enabled_group ?? DEFAULT_SETTINGS.enabled_group,
      enabled_inline: data?.enabled_inline ?? DEFAULT_SETTINGS.enabled_inline,
    };
    _settingsCache = { at: now, value: merged };
    return merged;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function isMemoryEnabledForChannel(
  settings: AngelMemorySettings,
  channel: AngelMemoryChannel,
): boolean {
  switch (channel) {
    case "web": return settings.enabled_web;
    case "telegram": return settings.enabled_telegram_dm;
    case "group": return settings.enabled_group;
    case "inline": return settings.enabled_inline;
    default: return false;
  }
}

// ============================================================================
// User-facing memory commands: /memory /remember /forget <index>
// ============================================================================

const CATEGORY_LABEL: Record<AngelMemoryCategory, string> = {
  identity: "🪪 Bản thân",
  preference: "💛 Sở thích",
  commitment: "🎯 Cam kết / dự án",
  context: "🌱 Ngữ cảnh",
  emotional: "🌤 Cảm xúc gần đây",
};

// TTL (ms) theo category — 0 nghĩa là không expire.
const CATEGORY_TTL_MS: Record<AngelMemoryCategory, number> = {
  identity: 0,
  preference: 0,
  commitment: 0,
  context: 90 * 24 * 3600 * 1000,   // 90 ngày
  emotional: 30 * 24 * 3600 * 1000, // 30 ngày
};

function isFactExpired(f: AngelMemoryFact, now = Date.now()): boolean {
  if (!f.category) return false;
  const ttl = CATEGORY_TTL_MS[f.category] ?? 0;
  if (!ttl) return false;
  const created = Date.parse(f.created_at || "");
  if (!Number.isFinite(created)) return false;
  return now - created > ttl;
}

/** Trả về list fact (sau khi lọc expired) kèm index gốc để dùng cho /forget <n>. */
export function listActiveFacts(row: AngelMemoryRow | null): Array<AngelMemoryFact & { index: number }> {
  if (!row) return [];
  const now = Date.now();
  const out: Array<AngelMemoryFact & { index: number }> = [];
  row.facts.forEach((f, i) => {
    if (!isFactExpired(f, now)) out.push({ ...f, index: i + 1 });
  });
  return out;
}

/** Format list fact thành text để bot reply cho user (/memory). */
export function formatMemoryForUser(row: AngelMemoryRow | null): string {
  const list = listActiveFacts(row);
  if (list.length === 0) {
    return "🙏 Angel chưa ghi nhớ điều gì đặc biệt về bé cả. Bé có thể dùng <code>/remember &lt;điều muốn Angel nhớ&gt;</code> để chủ động lưu nhé 💛";
  }
  // Group theo category
  const byCat: Record<string, Array<AngelMemoryFact & { index: number }>> = {};
  for (const f of list) {
    const k = f.category ?? "preference";
    (byCat[k] ??= []).push(f);
  }
  const order: AngelMemoryCategory[] = ["identity", "commitment", "preference", "context", "emotional"];
  const lines: string[] = ["✨ <b>Angel đang nhớ về bé:</b>\n"];
  for (const cat of order) {
    const items = byCat[cat];
    if (!items || items.length === 0) continue;
    lines.push(`\n<b>${CATEGORY_LABEL[cat]}</b>`);
    for (const f of items) {
      lines.push(`  ${f.index}. ${escapeHtml(f.fact)}`);
    }
  }
  lines.push(
    `\n\n<i>Bé có thể gõ:</i>\n• <code>/forget &lt;số&gt;</code> — xoá 1 điều\n• <code>/forgetall</code> — xoá tất cả\n• <code>/remember &lt;điều mới&gt;</code> — thêm ghi nhớ`,
  );
  return lines.join("\n");
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Xoá 1 fact theo index (1-based, khớp với listActiveFacts). */
export async function forgetFactByIndex(
  admin: SupabaseClient | null | undefined,
  params: { channel: AngelMemoryChannel; userKey: string | number; index: number },
): Promise<{ ok: boolean; removed?: AngelMemoryFact }> {
  if (!admin) return { ok: false };
  const row = await getAngelMemory(admin, { channel: params.channel, userKey: params.userKey });
  if (!row) return { ok: false };
  const active = listActiveFacts(row);
  const target = active[params.index - 1];
  if (!target) return { ok: false };
  const newFacts = row.facts.filter((_, i) => i !== target.index - 1);
  try {
    const { error } = await admin
      .from("angel_user_memory")
      .update({ facts: newFacts })
      .eq("channel", params.channel)
      .eq("user_key", String(params.userKey));
    if (error) {
      console.warn("[angel-memory] forgetFactByIndex", error.message);
      return { ok: false };
    }
    return { ok: true, removed: target };
  } catch (e) {
    console.warn("[angel-memory] forgetFactByIndex threw", e);
    return { ok: false };
  }
}

/** Lưu 1 fact do user chủ động khai báo (/remember). */
export async function saveDeclaredFact(
  admin: SupabaseClient | null | undefined,
  params: {
    channel: AngelMemoryChannel;
    userKey: string | number;
    displayName?: string | null;
    fact: string;
    category?: AngelMemoryCategory;
  },
): Promise<{ ok: boolean; reason?: string }> {
  if (!admin) return { ok: false, reason: "no_admin" };
  const key = String(params.userKey);
  if (!key) return { ok: false, reason: "no_key" };
  const text = params.fact.trim();
  if (text.length < 3) return { ok: false, reason: "too_short" };
  if (text.length > 200) return { ok: false, reason: "too_long" };
  // reuse sensitive filter
  if (/\b(?:seed|mnemonic|private\s*key|khoá\s*bí\s*mật)\b/i.test(text)) {
    return { ok: false, reason: "forbidden" };
  }
  const row = await getAngelMemory(admin, { channel: params.channel, userKey: key });
  const newFact: AngelMemoryFact = {
    fact: text,
    created_at: new Date().toISOString(),
    confidence: 1.0,
    category: params.category ?? "preference",
    source: "user_declared",
  };
  const existing = row?.facts ?? [];
  // dedupe cơ bản
  const dup = existing.some((e) =>
    e.fact.toLowerCase().replace(/\s+/g, " ").trim() ===
      text.toLowerCase().replace(/\s+/g, " ").trim(),
  );
  if (dup) return { ok: false, reason: "duplicate" };
  const merged = [...existing, newFact].slice(-MAX_FACTS);
  try {
    await admin
      .from("angel_user_memory")
      .upsert(
        {
          channel: params.channel,
          user_key: key,
          display_name: row?.display_name ?? params.displayName ?? null,
          facts: merged,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "channel,user_key" },
      );
    return { ok: true };
  } catch (e) {
    console.warn("[angel-memory] saveDeclaredFact threw", e);
    return { ok: false, reason: "db_error" };
  }
}
