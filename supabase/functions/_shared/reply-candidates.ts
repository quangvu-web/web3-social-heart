import { candidateDraft, candidateDraftId, candidateFlagKey, type CandidateSource } from "./reply-candidates-policy.ts";
import { normalizeLibraryQuestion } from "./approved-replies-policy.ts";

// Narrow table boundary shared by the browser admin and Deno SDK versions.
export type CandidateDatabase = { from(table: "angel_feature_flags" | "telegram_approved_replies"): any };

export async function saveReplyCandidate(db: CandidateDatabase, source: CandidateSource): Promise<"created" | "skipped"> {
  const draft = candidateDraft(source);
  if (!draft) return "skipped";
  const existing = await db.from("telegram_approved_replies").select("id")
    .eq("group_id", source.group_id).eq("language", draft.language)
    .contains("match_keys", [normalizeLibraryQuestion(draft.question)])
    .limit(1).abortSignal(AbortSignal.timeout(1000));
  if (existing.error || !Array.isArray(existing.data)) throw new Error("candidate_lookup_unavailable");
  if (existing.data.length) return "skipped";
  const result = await db.from("telegram_approved_replies").insert({
    ...draft, id: await candidateDraftId(source.group_id, draft.language, draft.question),
  }).abortSignal(AbortSignal.timeout(1000));
  if (result.error?.code === "23505") return "skipped";
  if (result.error) throw new Error("candidate_insert_unavailable");
  return "created";
}

/** Runs in the existing conversation logging background task; never blocks Telegram delivery. */
export async function collectReplyCandidate(db: CandidateDatabase, source: CandidateSource): Promise<void> {
  const draft = candidateDraft(source);
  if (!draft) return;
  try {
    const flag = await db.from("angel_feature_flags").select("enabled")
      .eq("key", candidateFlagKey(source.group_id)).abortSignal(AbortSignal.timeout(1000)).maybeSingle();
    if (flag.error || flag.data?.enabled !== true) return;
    await saveReplyCandidate(db, source);
  } catch {
    console.warn("[reply-candidates] capture_unavailable");
  }
}
