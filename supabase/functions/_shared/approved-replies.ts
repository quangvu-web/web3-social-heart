import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  type ApprovedReply,
  isStandaloneLibraryQuestion,
  normalizeLibraryQuestion,
  selectApprovedReply,
} from "./approved-replies-policy.ts";

export async function findApprovedReply(
  db: SupabaseClient,
  question: string,
  groupId: number,
  language: string,
): Promise<ApprovedReply | null> {
  if (
    !isStandaloneLibraryQuestion(question) ||
    !["vi", "en"].includes(language) || !Number.isSafeInteger(groupId) ||
    groupId >= 0
  ) return null;
  try {
    const { data, error } = await db.from("telegram_approved_replies")
      .select(
        "id,question,answer,match_keys,language,group_id,status,expires_at,revision",
      )
      .eq("status", "approved").eq("language", language)
      .contains("match_keys", [normalizeLibraryQuestion(question)])
      .or(`group_id.is.null,group_id.eq.${groupId}`)
      .gt("expires_at", new Date().toISOString()).limit(20).abortSignal(
        AbortSignal.timeout(1500),
      );
    if (error) {
      console.warn("[approved-replies] lookup_unavailable", {
        code: error.code,
      });
      return null;
    }
    if (!Array.isArray(data) || data.length >= 20) return null;
    return selectApprovedReply(
      data as ApprovedReply[],
      question,
      groupId,
      language,
    );
  } catch {
    console.warn("[approved-replies] lookup_unavailable");
    return null;
  }
}
