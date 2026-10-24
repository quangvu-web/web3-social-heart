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
