// Read the same oldest settings row as ensureSettings, fresh for every authorization.
export async function isCaptionOperator(adminClient: any, telegramUserId: number | undefined): Promise<boolean> {
  if (!Number.isSafeInteger(telegramUserId) || (telegramUserId ?? 0) <= 0) return false;
  try {
    const { data, error } = await adminClient
      .from("telegram_community_settings")
      .select("caption_operator_ids")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) {
      console.warn("[dm] caption_operator_lookup_failed", { telegram_user_id: telegramUserId });
      return false;
    }
    return Array.isArray(data?.caption_operator_ids) && data.caption_operator_ids.some(
      (id: unknown) => (typeof id === "number" || typeof id === "string") && String(id) === String(telegramUserId),
    );
  } catch {
    console.warn("[dm] caption_operator_lookup_failed", { telegram_user_id: telegramUserId });
    return false;
  }
}