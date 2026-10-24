import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

interface JoinDmSession {
  id: string;
  public_code: string;
  recall_bot_id: string;
}

type SendChat = (path: string, init: RequestInit) => Promise<{ ok: boolean; status: number }>;

/** Transport only: caller must first verify the real join payload and session/bot identity. */
export async function sendCaptionJoinDm(
  admin: SupabaseClient,
  session: JoinDmSession,
  participantId: string,
  webhookId: string | null,
  sendChat: SendChat,
): Promise<void> {
  const log = (result: string, warning = false) => (warning ? console.warn : console.log)("[angel-caption] join_dm", {
    session_id: session.id, participant_id: participantId, result,
  });
  if (!webhookId || webhookId.length > 512) { log("missing_or_invalid_webhook_id", true); return; }
  if (!participantId || participantId.length > 128 ||
    ["everyone", "host", "everyone_except_host"].includes(participantId)) {
    log("invalid_recipient", true); return;
  }

  try {
    // Atomic unique insert across workers. Never delete/reclaim after a send failure.
    const { error } = await admin.from("caption_join_dm_claims").insert({
      webhook_id: webhookId, session_id: session.id, participant_id: participantId,
    });
    if (error) { log(error.code === "23505" ? "duplicate" : "claim_failed", error.code !== "23505"); return; }
  } catch {
    log("claim_failed", true); return;
  }

  const url = `https://web3-social-heart.lovable.app/captions/${session.public_code}`;
  try {
    const response = await sendChat(`/api/v1/bot/${encodeURIComponent(session.recall_bot_id)}/send_chat_message/`, {
      method: "POST",
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify({
        to: participantId,
        message: `👋 Welcome to the FUN Community session! Here's your live caption link: ${url} — click to view live subtitles in your preferred language. 🎙️ This session is recorded and transcribed to generate the live captions. / Chào bạn! Link phụ đề trực tiếp: ${url} — buổi họp được ghi và chép lời để tạo phụ đề.`,
      }),
    });
    log(response.ok ? "sent" : `recall_failed_${response.status}`, !response.ok);
  } catch {
    log("recall_failed", true);
  }
}

function objectValue(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

/** Paths verified in production join_payload_observed logs, 24 Oct 2026 20:11/20:13 UTC+8. */
export async function handleCaptionParticipantJoin(
  admin: SupabaseClient,
  payload: unknown,
  webhookId: string | null,
  sendChat: SendChat,
): Promise<void> {
  const event = objectValue(payload);
  const data = objectValue(event.data);
  const join = objectValue(data.data);
  const participant = objectValue(join.participant);
  const bot = objectValue(data.bot);
  const participantId = typeof participant.id === "number" && Number.isSafeInteger(participant.id) && participant.id > 0
    ? String(participant.id)
    : typeof participant.id === "string" && /^[1-9]\d*$/.test(participant.id) ? participant.id : null;
  let sessionId: string | null = null;
  const log = (result: string, warning = false) => (warning ? console.warn : console.log)("[angel-caption] join_dm", {
    session_id: sessionId, participant_id: participantId, result,
  });
  if (event.event !== "participant_events.join" || join.action !== "join" || !participantId || typeof participant.name !== "string") {
    log("invalid_join", true); return;
  }
  if (participant.name.trim() === "Angel Translator 🌐") { log("self_bot_skipped"); return; }
  if (typeof bot.id !== "string" || !bot.id) { log("missing_bot_id", true); return; }

  try {
    const columns = "id, public_code, recall_bot_id, status, platform";
    let { data: session, error } = await admin.from("caption_sessions")
      .select(columns).eq("recall_bot_id", bot.id).maybeSingle();
    if (error) { log("session_lookup_failed", true); return; }
    const metadataId = objectValue(bot.metadata).caption_session_id;
    if (!session && typeof metadataId === "string" && metadataId) {
      const fallback = await admin.from("caption_sessions").select(columns).eq("id", metadataId).maybeSingle();
      session = fallback.data; error = fallback.error;
      if (error) { log("session_lookup_failed", true); return; }
    }
    sessionId = session?.id ?? null;
    if (!session || session.recall_bot_id !== bot.id || session.platform !== "zoom" ||
      !["pending", "joining", "live"].includes(session.status)) { log("inactive_or_mismatched_session"); return; }
    await sendCaptionJoinDm(admin, session, participantId, webhookId, sendChat);
  } catch {
    log("session_lookup_failed", true);
  }
}
