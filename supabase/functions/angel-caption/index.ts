// angel-caption/index.ts
// Angel Caption Bot — Phase 1 MVP: phụ đề dịch trực tiếp cho họp FUN Community.
//
// Một function duy nhất, định tuyến theo query ?action=:
//   start          POST  (x-caption-token) — tạo phiên + gọi Recall tạo bot vào phòng
//   recall-webhook POST  (chữ ký Svix)     — nhận transcript.data / bot.status_change
//   stop           POST  (x-caption-token) — kết thúc phiên, bot rời phòng, tóm tắt
//   summarize      POST  (x-caption-token) — tóm tắt song ngữ + đăng nhóm cộng đồng
//
// Chỉ dịch đoạn final; lỗi dịch → ghi dòng chỉ với text gốc.
// Đóng phiên phải ghi thành công trước ACK; tóm tắt chạy nền, lỗi đóng cho phép retry.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { withUsage } from "../_shared/track-cloud-usage.ts";
import { callAiGateway, gatewayText } from "../_shared/ai-gateway-retry.ts";
import { callCommunityTelegram } from "../_shared/telegram-community.ts";
import { MODELS } from "../_shared/angel/models.ts";
import { formatSummaryForTelegram } from "./summary-format.ts";
import {
  applyHearingCorrections,
  computeDedupeKey,
  detectPlatform,
  detectSourceLang,
  extractMeetingKey,
  generatePublicCode,
  isValidMeetingUrl,
  verifySvixSignature,
  wordsToSentence,
} from "./caption-utils.ts";

const RECALL_BASE = "https://ap-northeast-1.recall.ai"; // region Tokyo — cố định
const CAPTION_PAGE_BASE = "https://web3-social-heart.lovable.app/captions";

const KEYTERMS = [
  "Urantia", "Melchizedek", "Machiventa", "Nebadon", "Orvonton", "Havona",
  "Satania", "Norlatiadek", "Thought Adjuster", "Điều Chỉnh Tư Duy",
  "Đấng Cha Vũ Trụ", "Sảnh Phục Sinh", "Resurrection Hall",
  "thiên thần hộ mệnh", "sứ giả trung gian", "thế giới nhà ở",
  "hành trình thăng thiên", "Kinh Urantia", "FUN Community", "Fun.Rich",
  "LoveHub", "FUN-ID", "CAMLY", "Angel Translator", "Daniels Hussaini",
  "Angel Kim", "Hoàng Tỷ Đô", "bé Ly", "Richard E. Warren",
  "The Melchizedek Mission", "The First Humans", "Abuja", "Nigeria",
  "meditation", "mindfulness",
];

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getAdmin(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

function checkInternalToken(req: Request): boolean {
  const expected = Deno.env.get("CAPTION_INTERNAL_TOKEN") ?? "";
  if (!expected) return false;
  return req.headers.get("x-caption-token") === expected;
}

function captionUrl(publicCode: string): string {
  return `${CAPTION_PAGE_BASE}/${publicCode}`;
}

// ---------- Recall API ----------

async function recallFetch(path: string, init: RequestInit = {}): Promise<{ ok: boolean; status: number; data: any }> {
  const apiKey = Deno.env.get("RECALL_API_KEY") ?? "";
  if (!apiKey) return { ok: false, status: 0, data: { error: "RECALL_API_KEY missing" } };
  try {
    const res = await fetch(`${RECALL_BASE}${path}`, {
      ...init,
      headers: {
        // Recall dùng key thô, KHÔNG có chữ Bearer.
        Authorization: apiKey,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  } catch (e) {
    return { ok: false, status: 0, data: { error: e instanceof Error ? e.message : String(e) } };
  }
}

function buildRecallBotBody(meetingUrl: string, sessionId: string, webhookUrl: string) {
  return {
    meeting_url: meetingUrl,
    bot_name: "Angel Translator 🌐",
    recording_config: {
      transcript: {
        provider: {
          assembly_ai_v3_streaming: {
            language_detection: true,
            keyterms_prompt: KEYTERMS,
          },
        },
        diarization: { use_separate_streams_when_available: true },
      },
      realtime_endpoints: [
        { type: "webhook", url: `${webhookUrl}?action=recall-webhook`, events: ["transcript.data"] },
      ],
    },
    metadata: { caption_session_id: sessionId },
  };
}

/** Tạo bot Recall; nếu Recall từ chối một trường trong assembly_ai_v3_streaming, bỏ trường đó và thử lại 1 lần. */
async function createRecallBot(meetingUrl: string, sessionId: string, webhookUrl: string) {
  const body = buildRecallBotBody(meetingUrl, sessionId, webhookUrl);
  const first = await recallFetch("/api/v1/bot/", { method: "POST", body: JSON.stringify(body) });
  if (first.ok) return { ok: true as const, botId: String(first.data?.id ?? ""), droppedField: null as string | null };

  const errText = JSON.stringify(first.data ?? "");
  const providerCfg = body.recording_config.transcript.provider.assembly_ai_v3_streaming;
  let droppedField: string | null = null;
  for (const field of ["keyterms_prompt", "language_detection"] as const) {
    if (errText.includes(field)) {
      delete (providerCfg as Record<string, unknown>)[field];
      droppedField = field;
      break;
    }
  }
  if (!droppedField) {
    return { ok: false as const, status: first.status, error: errText.slice(0, 300), droppedField: null };
  }
  console.warn("[angel-caption] Recall rejected field, retrying without it", { field: droppedField, status: first.status });
  const second = await recallFetch("/api/v1/bot/", { method: "POST", body: JSON.stringify(body) });
  if (second.ok) return { ok: true as const, botId: String(second.data?.id ?? ""), droppedField };
  return { ok: false as const, status: second.status, error: JSON.stringify(second.data ?? "").slice(0, 300), droppedField };
}

// ---------- Dịch & tóm tắt qua AI Gateway (đường dùng chung của dự án) ----------

const GLOSSARY_NOTE =
  "Giữ nguyên không dịch các tên riêng/thuật ngữ: Urantia, Melchizedek, Machiventa, Nebadon, Orvonton, Havona, Satania, Norlatiadek, Thought Adjuster (= Điều Chỉnh Tư Duy), Resurrection Hall (= Sảnh Phục Sinh), FUN Community, Fun.Rich, LoveHub, FUN-ID, CAMLY, Angel Translator. Dịch \"Thầy\" sang Anh là \"our Teacher\". Giữ nguyên số liệu, tên người.";

async function translateCaption(text: string, from: "vi" | "en"): Promise<string | null> {
  const to = from === "vi" ? "English" : "Vietnamese";
  const result = await callAiGateway(
    {
      model: MODELS.style_pass.id,
      messages: [
        {
          role: "system",
          content:
            `You are a live-meeting subtitle translator. Translate the subtitle line into natural, conversational ${to}. ` +
            `Output ONLY the translation, no quotes, no notes. ${GLOSSARY_NOTE}`,
        },
        { role: "user", content: text },
      ],
      temperature: 0.2,
    },
    { label: "caption-translate", timeoutMs: 15_000, maxAttempts: 2 },
  );
  if (!result.ok) {
    console.warn("[angel-caption] translate failed", { status: result.status, error: result.error });
    return null;
  }
  const out = gatewayText(result);
  return out || null;
}

async function summarizeSession(lines: Array<{ speaker_name: string | null; text_source: string; text_vi: string | null; text_en: string | null }>): Promise<{ vi: string; en: string } | null> {
  const transcript = lines
    .map((l) => `[${l.speaker_name ?? "?"}] ${l.text_source}${l.text_en && l.text_en !== l.text_source ? ` / ${l.text_en}` : ""}`)
    .join("\n")
    .slice(0, 24_000);

  const result = await callAiGateway(
    {
      model: MODELS.style_pass.id,
      messages: [
        {
          role: "system",
          content:
            "Bạn là trợ lý tóm tắt buổi họp cộng đồng FUN. Tóm tắt SONG NGỮ theo đúng cấu trúc sau, mỗi phần có bản Tiếng Việt rồi bản English:\n" +
            "🎯 **1) Chủ đề chính / Main topic**\n" +
            "💡 **2) Điểm chính / Key points**\n" +
            "❓ **3) Câu hỏi & trả lời nổi bật / Notable Q&A**\n" +
            "✅ **4) Việc cần làm sau họp / Action items**\n" +
            "Trong mỗi mục, viết tiếng Việt trước rồi English; mục Điểm chính có 3–7 ý, mục Việc cần làm chỉ nêu việc có thật trong buổi họp. " +
            "Mỗi ý một dòng bắt đầu bằng '- '. Trong Q&A, bao đậm các nhãn **- Câu hỏi:**, **- Trả lời:**, **- Q:**, **- A:**. " +
            `Ngoài các cặp ** theo mẫu trên, không dùng ký tự * ở bất cứ đâu khác; không dùng markdown code block. Viết ngắn gọn. ${GLOSSARY_NOTE}`,
        },
        { role: "user", content: `TRANSCRIPT:\n${transcript}` },
      ],
      temperature: 0.3,
    },
    { label: "caption-summarize", timeoutMs: 60_000, maxAttempts: 2 },
  );
  if (!result.ok) {
    console.warn("[angel-caption] summarize failed", { status: result.status, error: result.error });
    return null;
  }
  const text = gatewayText(result);
  if (!text) return null;
  return { vi: text, en: text }; // model trả song ngữ trong cùng một khối
}

// ---------- Telegram: gửi tóm tắt vào nhóm cộng đồng ----------

async function sendSummaryToCommunity(admin: SupabaseClient, text: string, dmChatId: number | null) {
  const { data: primary, error: primaryError } = await admin
    .from("telegram_community_settings")
    .select("caption_summary_chat_id, member_alerts_chat_id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  let target = primary?.caption_summary_chat_id ? String(primary.caption_summary_chat_id) : null;
  let failureReason = "chưa cấu hình nhóm nhận";
  if (primaryError) {
    console.warn("[angel-caption] community group lookup failed", { error_code: primaryError.code ?? "unknown" });
    failureReason = "không đọc được cấu hình nhóm";
  } else if (!target) {
    // Legacy fallback only; daily/weekly reports keep their own shared setting.
    const { data: fallback, error: fallbackError } = await admin
      .from("telegram_community_settings")
      .select("member_alerts_chat_id")
      .not("member_alerts_chat_id", "is", null)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (fallbackError) {
      console.warn("[angel-caption] community group fallback lookup failed", { error_code: fallbackError.code ?? "unknown" });
      failureReason = "không đọc được cấu hình nhóm";
    } else if (fallback?.member_alerts_chat_id) {
      target = String(fallback.member_alerts_chat_id);
    }
  }
  let groupDelivered = false;
  if (target) {
    try {
      const res = await callCommunityTelegram("sendMessage", {
        chat_id: target,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      });
      groupDelivered = res.ok;
      if (!res.ok) {
        const description = typeof res.data?.description === "string"
          ? res.data.description : typeof res.data?.error === "string" ? res.data.error : `HTTP ${res.status}`;
        failureReason = description.slice(0, 160);
        console.warn("[angel-caption] summary send to community failed", {
          chat_id: target, status: res.status, description,
        });
      }
    } catch (error) {
      failureReason = "lỗi kết nối Telegram";
      console.warn("[angel-caption] summary send to community failed", {
        chat_id: target, status: 0,
        description: error instanceof Error ? error.message : String(error),
      });
    }
  } else {
    console.warn("[angel-caption] no community summary chat configured; summary not posted");
  }
  if (dmChatId) {
    const deliveryStatus = groupDelivered
      ? "📣 Tóm tắt đã được đăng vào nhóm cộng đồng."
      : `⚠️ Chưa đăng được tóm tắt vào nhóm cộng đồng (lý do: ${escapeHtml(failureReason)}). Bé vẫn nhận bản sao tại đây.`;
    const res = await callCommunityTelegram("sendMessage", {
      chat_id: dmChatId,
      text: `${text}\n${deliveryStatus}`,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });
    if (!res.ok) console.warn("[angel-caption] summary DM copy failed", { status: res.status });
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function runSummarize(admin: SupabaseClient, sessionId: string) {
  const { data: session } = await admin
    .from("caption_sessions")
    .select("id, public_code, started_at, ended_at, created_at, created_by_chat_id")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) return;

  const { data: lines, error } = await admin
    .from("caption_lines")
    .select("speaker_name, text_source, text_vi, text_en")
    .eq("session_id", sessionId)
    .order("seq", { ascending: true })
    .limit(1000);
  if (error) {
    console.warn("[angel-caption] summarize load lines failed", { error_code: error.code ?? "unknown" });
    return;
  }
  if (!lines || lines.length === 0) {
    console.log("[angel-caption] summarize skipped: no lines", { sessionId });
    return;
  }

  const summary = await summarizeSession(lines);
  if (!summary) return;

  const start = session.started_at ? new Date(session.started_at).getTime() : new Date(session.created_at).getTime();
  const end = session.ended_at ? new Date(session.ended_at).getTime() : Date.now();
  const minutes = Math.max(1, Math.round((end - start) / 60_000));

  const text = [
    "📝 <b>Tóm tắt buổi họp (phụ đề Angel Translator)</b>",
    `⏱ Thời lượng / Duration: ~${minutes} phút / min`,
    `🔗 Xem lại toàn bộ phụ đề / Full transcript: ${captionUrl(session.public_code)}`,
    "",
    formatSummaryForTelegram(escapeHtml(summary.vi)),
  ].join("\n");

  await sendSummaryToCommunity(admin, text, session.created_by_chat_id ?? null);
  console.log("[angel-caption] summary_finished", { session_id: sessionId });
}

// Lazy work factories keep AI/Recall calls outside the webhook acknowledgement path.
function scheduleCaptionWork(kind: "summarize" | "reconcile" | "announce", sessionId?: string) {
  const runtime = (globalThis as typeof globalThis & {
    EdgeRuntime?: { waitUntil: (task: Promise<unknown>) => void };
  }).EdgeRuntime;
  const failure = () => console.error("[angel-caption] background_failed", { kind, session_id: sessionId ?? null });
  if (runtime?.waitUntil) {
    const task = Promise.resolve().then(() => kind === "reconcile"
      ? reconcileOrphanSessions()
      : sessionId ? kind === "announce"
        ? runCaptionAnnouncement(getAdmin(), sessionId, "transcript")
        : runSummarize(getAdmin(), sessionId) : undefined).catch(failure);
    runtime.waitUntil(task);
    return;
  }
  const url = Deno.env.get("SUPABASE_URL");
  const token = Deno.env.get("CAPTION_INTERNAL_TOKEN");
  if (!url || !token) { failure(); return; }
  // One authenticated hop only; background requests never kick another reconcile.
  void fetch(`${url}/functions/v1/angel-caption?action=${kind}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-caption-token": token, "x-caption-background": "1" },
    body: JSON.stringify({ session_id: sessionId }),
  }).then((response) => { if (!response.ok) failure(); }).catch(failure);
}

function reconcileOnTouch(req: Request) {
  if (req.headers.get("x-caption-background") !== "1") scheduleCaptionWork("reconcile");
}

async function closeCaptionSession(admin: SupabaseClient, session: { id: string; status: string }, finalStatus: "ended" | "failed") {
  if (!["pending", "joining", "live"].includes(session.status)) return false;
  // Counted compare-and-swap gives exactly one delivery/reconciler the summary.
  const { error, count } = await admin.from("caption_sessions")
    .update({ status: finalStatus, ended_at: new Date().toISOString() }, { count: "exact" })
    .eq("id", session.id).eq("status", session.status);
  if (error) throw new Error("caption_close_write_failed");
  if (count !== 1) return false;
  if (finalStatus === "ended") scheduleCaptionWork("summarize", session.id);
  return true;
}

interface CaptionAnnouncementSession {
  id: string;
  public_code: string;
  recall_bot_id: string | null;
}

async function announceCaptionLink(
  admin: SupabaseClient,
  session: CaptionAnnouncementSession,
  trigger: "status" | "transcript" | "reconcile",
) {
  const logResult = (result: string) => console.log("[angel-caption] chat_announce", {
    session_id: session.id, trigger, result,
  });
  const claimedAt = new Date().toISOString();
  const { count, error } = await admin.from("caption_sessions")
    .update({ chat_announced_at: claimedAt }, { count: "exact" })
    .eq("id", session.id).is("chat_announced_at", null);
  if (error) {
    console.warn("[angel-caption] chat announce claim failed", { session_id: session.id, trigger, code: error.code ?? "unknown" });
    logResult("claim_failed");
    return;
  }
  if (count !== 1) { logResult("claimed_by_other"); return; }

  try {
    if (!session.recall_bot_id) throw new Error("recall_bot_id_missing");
    const chatRes = await recallFetch(`/api/v1/bot/${encodeURIComponent(session.recall_bot_id)}/send_chat_message/`, {
      method: "POST",
      body: JSON.stringify({
        to: "everyone",
        message:
          `Dear international friends, welcome to our FUN Community Zoom session! ❤️🙏🌍

Our program includes guided meditation and presentations in both Vietnamese and English.

To help everyone follow and understand the session, please click the translation link below to view live subtitles in your preferred language.

🔗 Translation link: ${captionUrl(session.public_code)}

We hope everyone can fully participate, learn, and enjoy this beautiful journey of love, peace, and spiritual growth together.

Thank you so much for joining us!

May Father Universe bless you all with love, light, and peace! 🙏💜💙🩵🌈

🎙️ This session is recorded and transcribed to generate the live captions. / Buổi họp được ghi và chép lời để tạo phụ đề trực tiếp.`,
      }),
    });
    if (!chatRes.ok) throw new Error(`recall_status_${chatRes.status}`);
    logResult("sent");
  } catch (error) {
    const rollback = await admin.from("caption_sessions")
      .update({ chat_announced_at: null }, { count: "exact" })
      .eq("id", session.id).eq("chat_announced_at", claimedAt);
    console.warn("[angel-caption] meeting chat message failed", {
      session_id: session.id, trigger,
      error: error instanceof Error ? error.message : String(error),
      rollback_code: rollback.error?.code ?? null,
    });
    logResult(rollback.error || rollback.count !== 1 ? "rollback_failed" : "recall_failed_rolled_back");
  }
}

async function runCaptionAnnouncement(
  admin: SupabaseClient,
  sessionId: string,
  trigger: "transcript" | "reconcile",
) {
  const { data: session, error } = await admin.from("caption_sessions")
    .select("id, public_code, recall_bot_id, status")
    .eq("id", sessionId).maybeSingle();
  if (error) throw new Error("caption_announce_lookup_failed");
  if (!session || !["pending", "joining", "live"].includes(session.status)) return;
  await announceCaptionLink(admin, session, trigger);
}

// A short background probe covers quiet rooms when Recall's status webhook never arrives.
// The normal status/transcript/reconcile paths remain the durable fallbacks.
async function probeJoinAnnouncement(
  session: CaptionAnnouncementSession,
  attempts = 6,
  intervalMs = 8_000,
) {
  if (!session.recall_bot_id) return;
  for (let attempt = 0; attempt < attempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    try {
      const bot = await recallFetch(`/api/v1/bot/${encodeURIComponent(session.recall_bot_id)}/`, {
        signal: AbortSignal.timeout(4_000),
      });
      if (!bot.ok) continue;
      const changes = Array.isArray(bot.data?.status_changes) ? bot.data.status_changes : [];
      const code = changes.at(-1)?.code ?? "";
      if (code === "call_ended" || code === "done") return;
      if (code === "in_call_recording" || code === "in_call_not_recording") {
        await announceCaptionLink(getAdmin(), session, "reconcile");
        return;
      }
    } catch {
      console.warn("[angel-caption] join_announce_probe_failed", { session_id: session.id, attempt: attempt + 1 });
    }
  }
}

function scheduleJoinAnnouncementProbe(session: CaptionAnnouncementSession) {
  const runtime = (globalThis as typeof globalThis & {
    EdgeRuntime?: { waitUntil: (task: Promise<unknown>) => void };
  }).EdgeRuntime;
  if (!runtime?.waitUntil) return;
  runtime.waitUntil(probeJoinAnnouncement(session).catch(() => {
    console.warn("[angel-caption] join_announce_probe_failed", { session_id: session.id });
  }));
}

async function reconcileOrphanSessions() {
  const admin = getAdmin();
  const closeCutoff = new Date(Date.now() - 3 * 60_000).toISOString();
  const announceCutoff = new Date(Date.now() - 2 * 60_000).toISOString();
  const { data: staleSessions, error: staleError } = await admin.from("caption_sessions")
    .select("id, public_code, status, recall_bot_id, created_at, chat_announced_at")
    .in("status", ["joining", "live"]).not("recall_bot_id", "is", null)
    .lt("created_at", closeCutoff).order("created_at", { ascending: true }).limit(5);
  const { data: unannouncedSessions, error: announceError } = await admin.from("caption_sessions")
    .select("id, public_code, status, recall_bot_id, created_at, chat_announced_at")
    .in("status", ["joining", "live"]).not("recall_bot_id", "is", null)
    .is("chat_announced_at", null)
    .lt("created_at", announceCutoff).order("created_at", { ascending: true }).limit(5);
  if (staleError || announceError) throw new Error("caption_reconcile_lookup_failed");
  const sessions = new Map<string, NonNullable<typeof staleSessions>[number]>();
  for (const session of [...(staleSessions ?? []), ...(unannouncedSessions ?? [])]) sessions.set(session.id, session);
  // The two overlapping queries must still share one five-bot Recall budget.
  const candidates = [...sessions.values()]
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
    .slice(0, 5);
  for (const session of candidates) {
    if (!session.recall_bot_id) continue;
    try {
      const bot = await recallFetch(`/api/v1/bot/${encodeURIComponent(session.recall_bot_id)}/`, {
        signal: AbortSignal.timeout(10_000),
      });
      if (!bot.ok) {
        console.warn("[angel-caption] reconcile_bot_lookup_failed", { session_id: session.id, status: bot.status });
        continue;
      }
      const changes = Array.isArray(bot.data?.status_changes) ? bot.data.status_changes : [];
      const code = changes.at(-1)?.code ?? "";
      if ((code === "call_ended" || code === "done") && Date.parse(session.created_at) < Date.parse(closeCutoff)) {
        const closed = await closeCaptionSession(admin, session, "ended");
        console.log("[angel-caption] reconcile_result", { session_id: session.id, code, result: closed ? "closed" : "ignored" });
      } else if ((code === "in_call_recording" || code === "in_call_not_recording") &&
        session.chat_announced_at === null && Date.parse(session.created_at) < Date.parse(announceCutoff)) {
        await announceCaptionLink(admin, session, "reconcile");
      }
    } catch {
      console.error("[angel-caption] reconcile_failed", { session_id: session.id });
    }
  }
}

// ---------- Action: start ----------

interface ActiveSession {
  id: string;
  public_code: string;
  status: string;
  recall_bot_id: string | null;
  started_at: string | null;
  created_at: string;
}

/** Phiên đang hoạt động (pending/joining/live) mới nhất của cùng một phòng họp. */
async function findActiveSessionByKey(admin: SupabaseClient, meetingKey: string): Promise<ActiveSession | null> {
  const { data, error } = await admin
    .from("caption_sessions")
    .select("id, public_code, status, recall_bot_id, started_at, created_at")
    .eq("meeting_key", meetingKey)
    .in("status", ["pending", "joining", "live"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[angel-caption] dedupe lookup failed", { code: error.code ?? "unknown" });
    throw new Error("caption_dedupe_lookup_failed");
  }
  return data ?? null;
}

/** Tra trạng thái bot thật trên Recall: true = bot đã kết thúc; null = không tra được (coi như còn chạy). */
async function isRecallBotFinished(botId: string): Promise<boolean | null> {
  try {
    const bot = await recallFetch(`/api/v1/bot/${encodeURIComponent(botId)}/`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (!bot.ok) return null;
    const changes = Array.isArray(bot.data?.status_changes) ? bot.data.status_changes : [];
    const code = changes.at(-1)?.code ?? "";
    return code === "call_ended" || code === "done";
  } catch {
    return null;
  }
}

function alreadyRunningPayload(session: ActiveSession) {
  return {
    already_running: true,
    session_id: session.id,
    public_code: session.public_code,
    caption_url: captionUrl(session.public_code),
    started_at: session.started_at ?? session.created_at,
  };
}

async function handleStart(req: Request): Promise<Response> {
  if (!checkInternalToken(req)) return json({ error: "Unauthorized" }, 401);
  reconcileOnTouch(req);

  let body: { meeting_url?: string; telegram_user_id?: number; telegram_chat_id?: number };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Body JSON không hợp lệ." }, 400);
  }
  const meetingUrl = String(body.meeting_url ?? "").trim();
  if (!meetingUrl || !isValidMeetingUrl(meetingUrl)) {
    return json({ error: "Link phòng họp không hợp lệ. Angel hỗ trợ Zoom, Google Meet và Microsoft Teams." }, 400);
  }

  const admin = getAdmin();
  const meetingKey = extractMeetingKey(meetingUrl);

  // Chống trùng: cùng một phòng họp chỉ có một bot Angel Translator đang chạy.
  if (meetingKey) {
    let existing: ActiveSession | null;
    try {
      existing = await findActiveSessionByKey(admin, meetingKey);
    } catch {
      // Không thể xác nhận phiên cũ thì dừng an toàn, tránh tạo thêm bot khi DB đang lỗi.
      return json({ error: "Chưa kiểm tra được phiên phụ đề hiện tại. Bé thử lại sau ít phút nhé." }, 503);
    }
    if (existing) {
      let reuse = true;
      if (existing.recall_bot_id) {
        const finished = await isRecallBotFinished(existing.recall_bot_id);
        if (finished === true) {
          // Lưới tự lành: phiên kẹt (bot đã kết thúc mà phiên chưa đóng) không được khoá chết
          // các buổi sau dùng chung link phòng cá nhân.
          const closed = await closeCaptionSession(admin, existing, "ended");
          console.log("[angel-caption] dedupe_stuck_session_closed", { session_id: existing.id, closed });
          reuse = false;
        } else if (finished === null) {
          // Không tra được trạng thái bot (lỗi mạng) → thà trả link cũ còn hơn sinh bot trùng.
          console.warn("[angel-caption] dedupe_bot_lookup_failed", { session_id: existing.id });
        }
      } else if (Date.now() - Date.parse(existing.created_at) > 3 * 60_000) {
        // Phiên chưa có bot mà đã quá cửa sổ đua 3 phút → kẹt, đóng và tạo mới.
        const closed = await closeCaptionSession(admin, existing, "failed");
        console.log("[angel-caption] dedupe_botless_session_closed", { session_id: existing.id, closed });
        reuse = false;
      }
      if (reuse) {
        console.log("[angel-caption] dedupe_reuse_session", { session_id: existing.id, meeting_key: meetingKey });
        return json(alreadyRunningPayload(existing));
      }
    }
  }

  const publicCode = generatePublicCode();
  const { data: session, error: insertErr } = await admin
    .from("caption_sessions")
    .insert({
      public_code: publicCode,
      meeting_url: meetingUrl,
      meeting_key: meetingKey,
      platform: detectPlatform(meetingUrl),
      status: "pending",
      created_by_telegram_id: body.telegram_user_id ?? null,
      created_by_chat_id: body.telegram_chat_id ?? null,
    })
    .select("id, public_code")
    .single();
  if (insertErr || !session) {
    // Hai lệnh đua nhau thật: partial unique index bắt được → trả phiên đang chạy, không trả 500.
    if (insertErr?.code === "23505" && meetingKey) {
      let winner: ActiveSession | null;
      try {
        winner = await findActiveSessionByKey(admin, meetingKey);
      } catch {
        // Không trả 500 cho xung đột unique; yêu cầu thử lại nếu chưa đọc được phiên thắng.
        return json({ error: "Phiên phụ đề vừa được tạo nhưng chưa đọc lại được. Bé thử lại sau ít phút nhé." }, 503);
      }
      if (winner) {
        console.log("[angel-caption] dedupe_race_caught", { session_id: winner.id, meeting_key: meetingKey });
        return json(alreadyRunningPayload(winner));
      }
      return json({ error: "Phiên phụ đề vừa thay đổi trạng thái. Bé thử lại sau ít phút nhé." }, 503);
    }
    console.error("[angel-caption] session insert failed", { error_code: insertErr?.code ?? "unknown" });
    return json({ error: "Không tạo được phiên phụ đề." }, 500);
  }

  const functionUrl = `${Deno.env.get("SUPABASE_URL") ?? ""}/functions/v1/angel-caption`;
  const bot = await createRecallBot(meetingUrl, session.id, functionUrl);
  if (!bot.ok) {
    await admin.from("caption_sessions").update({ status: "failed" }).eq("id", session.id);
    console.error("[angel-caption] Recall create bot failed", { status: bot.status, dropped: bot.droppedField });
    return json({ error: "Không gọi được bot vào phòng họp. Bé thử lại sau ít phút nhé." }, 502);
  }

  await admin
    .from("caption_sessions")
    .update({ recall_bot_id: bot.botId, status: "joining" })
    .eq("id", session.id);

  scheduleJoinAnnouncementProbe({ ...session, recall_bot_id: bot.botId });

  return json({
    session_id: session.id,
    public_code: session.public_code,
    caption_url: captionUrl(session.public_code),
    ...(bot.droppedField ? { recall_dropped_field: bot.droppedField } : {}),
  });
}

// ---------- Action: recall-webhook ----------

interface TranscriptEvent {
  event?: string;
  data?: {
    bot?: { id?: string; metadata?: { caption_session_id?: string } };
    bot_id?: string;
    data?: {
      words?: Array<{ text?: string; start_timestamp?: { relative?: number | null } | null }>;
      participant?: { name?: string | null } | null;
    };
  };
}

async function findSessionByBot(admin: SupabaseClient, botId: string | null, metadataSessionId: string | null) {
  if (botId) {
    const { data } = await admin
      .from("caption_sessions")
      .select("id, public_code, recall_bot_id, status, started_at")
      .eq("recall_bot_id", botId)
      .maybeSingle();
    if (data) return data;
  }
  if (metadataSessionId) {
    const { data } = await admin
      .from("caption_sessions")
      .select("id, public_code, recall_bot_id, status, started_at")
      .eq("id", metadataSessionId)
      .maybeSingle();
    if (data) return data;
  }
  return null;
}

async function handleTranscriptData(admin: SupabaseClient, payload: TranscriptEvent, metadataSessionId: string | null) {
  const botId = payload.data?.bot?.id ?? payload.data?.bot_id ?? null;
  const session = await findSessionByBot(admin, botId, metadataSessionId);
  if (!session) {
    console.warn("[angel-caption] transcript for unknown bot", { bot_id: botId });
    return;
  }

  if (session.status === "pending" || session.status === "joining") {
    await admin
      .from("caption_sessions")
      .update({ status: "live", ...(!session.started_at ? { started_at: new Date().toISOString() } : {}) })
      .eq("id", session.id)
      .in("status", ["pending", "joining"]);
    scheduleCaptionWork("announce", session.id);
  }

  const words = payload.data?.data?.words ?? [];
  const { text: rawText, startSec } = wordsToSentence(words);
  if (!rawText) return;

  const textSource = applyHearingCorrections(rawText);
  const speaker = payload.data?.data?.participant?.name ?? null;
  const sourceLang = detectSourceLang(textSource);
  const dedupeKey = await computeDedupeKey(botId ?? "unknown", startSec, textSource);

  // Chống trùng: webhook Recall có thể gửi lại cùng một đoạn.
  const { data: existing } = await admin
    .from("caption_lines")
    .select("id")
    .eq("session_id", session.id)
    .eq("dedupe_key", dedupeKey)
    .maybeSingle();
  if (existing) return;

  const translation = await translateCaption(textSource, sourceLang);

  const { data: maxRow } = await admin
    .from("caption_lines")
    .select("seq")
    .eq("session_id", session.id)
    .order("seq", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSeq = (maxRow?.seq ?? 0) + 1;

  const { error: insertErr } = await admin.from("caption_lines").insert({
    session_id: session.id,
    seq: nextSeq,
    speaker_name: speaker,
    source_lang: sourceLang,
    text_source: textSource,
    text_vi: sourceLang === "vi" ? textSource : translation,
    text_en: sourceLang === "en" ? textSource : translation,
    ts_offset_sec: startSec,
    dedupe_key: dedupeKey,
  });
  if (insertErr) {
    // Trùng dedupe do race → coi như đã xử lý.
    if (insertErr.code === "23505") return;
    console.error("[angel-caption] caption line insert failed", { error_code: insertErr.code ?? "unknown" });
  }
}

async function handleBotStatusChange(
  admin: SupabaseClient,
  payload: { data?: { bot?: { id?: string; metadata?: { caption_session_id?: string } }; bot_id?: string; data?: { code?: string }; status?: { code?: string } } },
  metadataSessionId: string | null,
) {
  const botId = payload.data?.bot?.id ?? payload.data?.bot_id ?? null;
  const code = payload.data?.data?.code ?? payload.data?.status?.code ?? "";
  const session = await findSessionByBot(admin, botId, metadataSessionId);
  const logResult = (result: string) => console.log("[angel-caption] bot_status_delivery", {
    event: "bot.status_change", code, session_id: session?.id ?? null, result,
  });
  if (!session || !code) { logResult(!session ? "session_not_found" : "ignored"); return; }

  if (code === "call_ended" || code === "done" || code === "fatal") {
    try {
      const closed = await closeCaptionSession(admin, session, code === "fatal" ? "failed" : "ended");
      logResult(closed ? "closed" : "ignored");
    } catch (error) { logResult("write_failed"); throw error; }
    return;
  }
  if (session.status === "ended" || session.status === "failed") { logResult("ignored"); return; }

  const nowIso = new Date().toISOString();
  if (code === "in_waiting_room" || code === "joining") {
    if (session.status === "pending") {
      await admin.from("caption_sessions").update({ status: "joining" }).eq("id", session.id);
    }
    logResult("joining");
    return;
  }
  if (code === "in_call_recording" || code === "in_call_not_recording") {
    await admin
      .from("caption_sessions")
      .update({ status: "live", ...(session.status !== "live" ? { started_at: nowIso } : {}) })
      .eq("id", session.id);

    await announceCaptionLink(admin, { ...session, recall_bot_id: session.recall_bot_id ?? botId }, "status");
    logResult("live");
    return;
  }
  logResult("ignored");
}

async function handleRecallWebhook(req: Request): Promise<Response> {
  const receivedAt = performance.now();
  const rawBody = await req.text(); // PHẢI đọc raw trước khi parse JSON
  const secret = Deno.env.get("RECALL_VERIFICATION_SECRET") ?? "";
  const valid = await verifySvixSignature({
    webhookId: req.headers.get("webhook-id"),
    timestamp: req.headers.get("webhook-timestamp"),
    signatureHeader: req.headers.get("webhook-signature"),
    rawBody,
    secret,
  });
  if (!valid) return json({ error: "Invalid signature" }, 401);

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json({ ok: true, ignored: "invalid_json" });
  }

  const admin = getAdmin();
  const event = String(payload?.event ?? "");
  const metadataSessionId = payload?.data?.bot?.metadata?.caption_session_id ?? payload?.data?.metadata?.caption_session_id ?? payload?.metadata?.caption_session_id ?? null;

  try {
    if (event === "transcript.data") {
      await handleTranscriptData(admin, payload as TranscriptEvent, metadataSessionId);
    } else if (event === "bot.status_change") {
      await handleBotStatusChange(admin, payload, metadataSessionId);
    }
  } catch (e) {
    // Lỗi từng sự kiện: log + vẫn 200 để Recall không retry dồn dập.
    console.error("[angel-caption] event handling failed", {
      event,
      error: event === "bot.status_change" ? "status_processing_failed" : e instanceof Error ? e.message : String(e),
    });
    if (event === "bot.status_change") return json({ error: "Status persistence failed" }, 503);
  }
  if (event === "bot.status_change") console.log("[angel-caption] webhook_ack", {
    event, response_ms: Math.round(performance.now() - receivedAt), status: 200,
  });
  return json({ ok: true });
}

// ---------- Action: stop ----------

async function handleStop(req: Request): Promise<Response> {
  if (!checkInternalToken(req)) return json({ error: "Unauthorized" }, 401);
  reconcileOnTouch(req);

  let body: { session_id?: string; public_code?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Body JSON không hợp lệ." }, 400);
  }

  const admin = getAdmin();
  let query = admin.from("caption_sessions").select("id, recall_bot_id, status");
  if (body.session_id) query = query.eq("id", body.session_id);
  else if (body.public_code) query = query.eq("public_code", body.public_code);
  else return json({ error: "Thiếu session_id hoặc public_code." }, 400);

  const { data: session } = await query.maybeSingle();
  if (!session) return json({ error: "Không tìm thấy phiên phụ đề." }, 404);

  if (session.recall_bot_id && (session.status === "live" || session.status === "joining")) {
    const leave = await recallFetch(`/api/v1/bot/${session.recall_bot_id}/leave_call/`, {
      method: "POST",
      body: "{}",
    });
    if (!leave.ok) console.warn("[angel-caption] leave_call failed", { status: leave.status });
  }

  await admin
    .from("caption_sessions")
    .update({ status: "ended", ended_at: new Date().toISOString() })
    .eq("id", session.id);

  await runSummarize(admin, session.id).catch((e) =>
    console.warn("[angel-caption] summarize after stop failed", e instanceof Error ? e.message : String(e))
  );

  return json({ ok: true, session_id: session.id });
}

// ---------- Action: summarize (gọi ngoài có token) ----------

async function handleSummarize(req: Request): Promise<Response> {
  if (!checkInternalToken(req)) return json({ error: "Unauthorized" }, 401);
  reconcileOnTouch(req);
  let body: { session_id?: string; public_code?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Body JSON không hợp lệ." }, 400);
  }
  const admin = getAdmin();
  let sessionId = body.session_id ?? null;
  if (!sessionId && body.public_code) {
    const { data } = await admin
      .from("caption_sessions")
      .select("id")
      .eq("public_code", body.public_code)
      .maybeSingle();
    sessionId = data?.id ?? null;
  }
  if (!sessionId) return json({ error: "Không tìm thấy phiên phụ đề." }, 404);
  await runSummarize(admin, sessionId);
  return json({ ok: true });
}

async function handleAnnounce(req: Request): Promise<Response> {
  if (!checkInternalToken(req)) return json({ error: "Unauthorized" }, 401);
  let body: { session_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Body JSON không hợp lệ." }, 400);
  }
  if (!body.session_id) return json({ error: "Thiếu session_id." }, 400);
  await runCaptionAnnouncement(getAdmin(), body.session_id, "transcript");
  return json({ ok: true });
}

// ---------- Entry ----------

Deno.serve(withUsage("angel-caption", "Angel Caption Bot", async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const action = new URL(req.url).searchParams.get("action") ?? "";
  switch (action) {
    case "start":
      return await handleStart(req);
    case "recall-webhook":
      return await handleRecallWebhook(req);
    case "stop":
      return await handleStop(req);
    case "summarize":
      return await handleSummarize(req);
    case "announce":
      return await handleAnnounce(req);
    case "reconcile":
      if (!checkInternalToken(req)) return json({ error: "Unauthorized" }, 401);
      await reconcileOrphanSessions();
      return json({ ok: true });
    default:
      return json({ error: "Unknown action" }, 404);
  }
}));
