// angel-caption/index.ts
// Angel Caption Bot — Phase 1 MVP: phụ đề dịch trực tiếp cho họp FUN Community.
//
// Một function duy nhất, định tuyến theo query ?action=:
//   start          POST  (x-caption-token) — tạo phiên + gọi Recall tạo bot vào phòng
//   recall-webhook POST  (chữ ký Svix)     — nhận transcript.data / bot.status_change
//   stop           POST  (x-caption-token) — kết thúc phiên, bot rời phòng, tóm tắt
//   summarize      POST  (x-caption-token) — tóm tắt song ngữ + đăng nhóm cộng đồng
//
// Nguyên tắc: chỉ dịch đoạn final; lỗi từng sự kiện → log + vẫn trả 200 (trừ
// sai chữ ký) để Recall không retry dồn dập; lỗi dịch → ghi dòng chỉ với text gốc.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { withUsage } from "../_shared/track-cloud-usage.ts";
import { callAiGateway, gatewayText } from "../_shared/ai-gateway-retry.ts";
import { callCommunityTelegram } from "../_shared/telegram-community.ts";
import { MODELS } from "../_shared/angel/models.ts";
import {
  applyHearingCorrections,
  computeDedupeKey,
  detectPlatform,
  detectSourceLang,
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
            "1) Chủ đề chính / Main topic\n2) Điểm chính (3–7 ý) / Key points\n3) Câu hỏi & trả lời nổi bật / Notable Q&A\n4) Việc cần làm sau họp (nếu có) / Action items\n" +
            `Viết ngắn gọn, gạch đầu dòng, không markdown code block. ${GLOSSARY_NOTE}`,
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
  // Tái dùng cơ chế của telegram-community-daily-report: nhóm cộng đồng chính
  // lấy từ telegram_community_settings.member_alerts_chat_id.
  const { data: groups, error } = await admin
    .from("telegram_community_settings")
    .select("group_id, member_alerts_chat_id")
    .not("member_alerts_chat_id", "is", null)
    .limit(1);
  if (error) {
    console.warn("[angel-caption] community group lookup failed", { error_code: error.code ?? "unknown" });
  }
  const target = groups?.[0]?.member_alerts_chat_id ? String(groups[0].member_alerts_chat_id) : null;
  if (target) {
    const res = await callCommunityTelegram("sendMessage", {
      chat_id: target,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });
    if (!res.ok) console.warn("[angel-caption] summary send to community failed", { status: res.status });
  } else {
    console.warn("[angel-caption] no community alert chat configured; summary not posted");
  }
  if (dmChatId) {
    const res = await callCommunityTelegram("sendMessage", {
      chat_id: dmChatId,
      text,
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
    escapeHtml(summary.vi).replace(/\n/g, "\n"),
  ].join("\n");

  await sendSummaryToCommunity(admin, text, session.created_by_chat_id ?? null);
}

// ---------- Action: start ----------

async function handleStart(req: Request): Promise<Response> {
  if (!checkInternalToken(req)) return json({ error: "Unauthorized" }, 401);

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
  const publicCode = generatePublicCode();
  const { data: session, error: insertErr } = await admin
    .from("caption_sessions")
    .insert({
      public_code: publicCode,
      meeting_url: meetingUrl,
      platform: detectPlatform(meetingUrl),
      status: "pending",
      created_by_telegram_id: body.telegram_user_id ?? null,
      created_by_chat_id: body.telegram_chat_id ?? null,
    })
    .select("id, public_code")
    .single();
  if (insertErr || !session) {
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
      .select("id, public_code, status")
      .eq("recall_bot_id", botId)
      .maybeSingle();
    if (data) return data;
  }
  if (metadataSessionId) {
    const { data } = await admin
      .from("caption_sessions")
      .select("id, public_code, status")
      .eq("id", metadataSessionId)
      .maybeSingle();
    if (data) return data;
  }
  return null;
}

async function handleTranscriptData(admin: SupabaseClient, payload: TranscriptEvent, metadataSessionId: string | null) {
  const botId = payload.data?.bot_id ?? null;
  const session = await findSessionByBot(admin, botId, metadataSessionId);
  if (!session) {
    console.warn("[angel-caption] transcript for unknown bot", { bot_id: botId });
    return;
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
  payload: { data?: { bot_id?: string; status?: { code?: string } } },
  metadataSessionId: string | null,
) {
  const botId = payload.data?.bot_id ?? null;
  const code = payload.data?.status?.code ?? "";
  const session = await findSessionByBot(admin, botId, metadataSessionId);
  if (!session || !code) return;

  const nowIso = new Date().toISOString();
  if (code === "in_waiting_room" || code === "joining") {
    if (session.status === "pending") {
      await admin.from("caption_sessions").update({ status: "joining" }).eq("id", session.id);
    }
    return;
  }
  if (code === "in_call_recording" || code === "in_call_not_recording") {
    const firstLive = session.status !== "live";
    await admin
      .from("caption_sessions")
      .update({ status: "live", ...(session.status !== "live" ? { started_at: nowIso } : {}) })
      .eq("id", session.id);

    if (firstLive && botId) {
      const chatRes = await recallFetch(`/api/v1/bot/${botId}/send_chat_message/`, {
        method: "POST",
        body: JSON.stringify({
          to: "everyone",
          message:
            `🌐 Angel Translator đã tham gia để hỗ trợ phụ đề dịch Anh–Việt trực tiếp cho khách quốc tế. ` +
            `Buổi họp được ghi và chép lời để tạo phụ đề. Xem phụ đề / Live captions: ${captionUrl(session.public_code)}`,
        }),
      });
      if (!chatRes.ok) {
        // Không chặn luồng — người điều phối sẽ dán link tay.
        console.warn("[angel-caption] meeting chat message failed", { status: chatRes.status, bot_id: botId });
      }
    }
    return;
  }
  if (code === "call_ended" || code === "done" || code === "fatal") {
    const finalStatus = code === "fatal" ? "failed" : "ended";
    await admin
      .from("caption_sessions")
      .update({ status: finalStatus, ended_at: nowIso })
      .eq("id", session.id);
    if (finalStatus === "ended") {
      await runSummarize(admin, session.id).catch((e) =>
        console.warn("[angel-caption] auto summarize failed", e instanceof Error ? e.message : String(e))
      );
    }
  }
}

async function handleRecallWebhook(req: Request): Promise<Response> {
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
  const metadataSessionId = payload?.data?.metadata?.caption_session_id ?? payload?.metadata?.caption_session_id ?? null;

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
      error: e instanceof Error ? e.message : String(e),
    });
  }
  return json({ ok: true });
}

// ---------- Action: stop ----------

async function handleStop(req: Request): Promise<Response> {
  if (!checkInternalToken(req)) return json({ error: "Unauthorized" }, 401);

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
    default:
      return json({ error: "Unknown action" }, 404);
  }
}));
