export type InviteUpdate = {
  update_id?: number;
  my_chat_member?: {
    chat?: { id?: number; type?: string; title?: string }; date?: number;
    old_chat_member?: { status?: string; is_member?: boolean };
    new_chat_member?: { status?: string; is_member?: boolean; user?: { id?: number; is_bot?: boolean } };
  };
  message?: unknown;
};
export type BotInvite = { chatId: number; botId: number; updateId: number; eventDate: number; groupName?: string };
export type InviteDependencies = {
  lookup: (chatId: number) => Promise<"managed" | "unmanaged" | "unverified">;
  claim: (event: BotInvite) => Promise<string | null>;
  send: (event: BotInvite) => Promise<{ ok: boolean }>;
  leave: (event: BotInvite) => Promise<{ ok: boolean }>;
  audit: (action: string, reason: string, event: BotInvite) => Promise<unknown>;
};
function membership(member?: { status?: string; is_member?: boolean }): boolean | null {
  if (["member", "administrator", "creator"].includes(member?.status ?? "")) return true;
  if (["left", "kicked"].includes(member?.status ?? "")) return false;
  if (member?.status === "restricted" && typeof member.is_member === "boolean") return member.is_member;
  return null;
}

/** my_chat_member owns invite effects. Messages lack the membership transition key. */
export async function handleBotInvite(update: InviteUpdate, deps: InviteDependencies): Promise<void> {
  const evt = update.my_chat_member;
  if (!evt || !["group", "supergroup"].includes(evt.chat?.type ?? "")) return;
  if (membership(evt.old_chat_member) !== false || membership(evt.new_chat_member) !== true) return;
  const bot = evt.new_chat_member?.user;
  if (bot?.is_bot !== true) return;
  if (!Number.isSafeInteger(evt.chat?.id) || evt.chat!.id! >= 0 ||
      !Number.isSafeInteger(bot.id) || bot.id! <= 0 ||
      !Number.isSafeInteger(update.update_id) || update.update_id! < 0 ||
      !Number.isSafeInteger(evt.date) || evt.date! <= 0) throw new Error("invalid_invite_metadata");
  const event: BotInvite = { chatId: evt.chat!.id!, botId: bot.id!, updateId: update.update_id!, eventDate: evt.date!, groupName: evt.chat?.title };
  const audit = async (action: string, reason: string) => {
    try { await deps.audit(action, reason, event); }
    catch { console.warn("[unauthorized-invite] audit unavailable", { action, chat_id: event.chatId, update_id: event.updateId }); }
  };
  let settings: "managed" | "unmanaged" | "unverified" = "unverified";
  try { settings = await deps.lookup(event.chatId); } catch { /* No absent-group inference from an error. */ }
  if (settings === "unverified") {
    await audit("unauthorized_group_settings_unverified", "settings_lookup_failed");
    throw new Error("invite_settings_unverified");
  }
  if (settings === "managed") return;
  let claim: string | null = null;
  try { claim = await deps.claim(event); } catch { /* Failed claim has no effects. */ }
  if (claim === "duplicate" || claim === "managed") {
    await audit(claim === "duplicate" ? "unauthorized_group_duplicate" : "unauthorized_group_now_managed", "my_chat_member");
    return;
  }
  if (claim !== "claimed") {
    await audit("unauthorized_group_claim_unverified", "durable_claim_failed");
    throw new Error("invite_claim_unverified");
  }
  // Never reclaim an uncertain attempt: retrying could send/leave twice.
  await audit("unauthorized_group_attempt_started", "my_chat_member");
  let notified = false;
  try { notified = (await deps.send(event)).ok === true; } catch { /* Still attempt leave. */ }
  await audit(notified ? "unauthorized_group_notice_sent" : "unauthorized_group_notice_failed", notified ? "telegram_confirmed" : "delivery_unconfirmed");
  let left = false;
  try { left = (await deps.leave(event)).ok === true; } catch { /* Preserve claim for admin review. */ }
  await audit(left ? "unauthorized_group_left" : "unauthorized_group_leave_failed", left ? "telegram_confirmed" : "leave_unconfirmed_claim_retained");
}
