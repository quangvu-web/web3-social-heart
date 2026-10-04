import assert from "npm:assert@2.1.0";
import { handleBotInvite, type InviteDependencies, type InviteUpdate } from "./telegram-unauthorized-invite.ts";

const invited = (updateId = 100, date = 1791158400): InviteUpdate => ({ update_id: updateId, my_chat_member: {
  chat: { id: -1001, type: "supergroup", title: "Fixture group" }, date,
  old_chat_member: { status: "left" }, new_chat_member: { status: "member", user: { id: 7, is_bot: true } },
} });
function fixture() {
  const actions: string[] = [];
  let sends = 0, leaves = 0;
  const keys = new Set<string>();
  const deps: InviteDependencies = {
    lookup: async () => "unmanaged",
    claim: async e => { const key = `${e.botId}:${e.chatId}:${e.updateId}:${e.eventDate}`;
      if (keys.has(key)) return "duplicate"; keys.add(key); return "claimed"; },
    send: async () => { sends++; return { ok: true }; },
    leave: async () => { leaves++; return { ok: true }; },
    audit: async action => { actions.push(action); },
  };
  return { deps, actions, counts: () => ({ sends, leaves }) };
}
Deno.test("dual invite updates, ordinary messages and replay have one notice and leave", async () => {
  const h = fixture();
  const message = { message: { chat: { id: -1001, type: "supergroup" }, new_chat_members: [{ id: 7, is_bot: true }] } };
  for (const update of [message, invited(), message, invited(), { message: { chat: { id: -1001, type: "supergroup" } } }]) await handleBotInvite(update, h.deps);
  assert.deepStrictEqual(h.counts(), { sends: 1, leaves: 1 });
  assert.ok(h.actions.includes("unauthorized_group_duplicate"));
});
Deno.test("concurrent webhook copies have at most one notice and leave", async () => {
  const h = fixture();
  await Promise.all(Array.from({ length: 12 }, () => handleBotInvite(invited(), h.deps)));
  assert.deepStrictEqual(h.counts(), { sends: 1, leaves: 1 });
});
Deno.test("a new invitation after leaving has its own claim, old replay stays suppressed", async () => {
  const h = fixture();
  await handleBotInvite(invited(), h.deps);
  await handleBotInvite({ my_chat_member: { ...invited().my_chat_member, old_chat_member: { status: "member" }, new_chat_member: { status: "left" } } }, h.deps);
  await handleBotInvite(invited(101, 1791158401), h.deps);
  await handleBotInvite(invited(), h.deps);
  assert.deepStrictEqual(h.counts(), { sends: 2, leaves: 2 });
});
Deno.test("settings and claim errors never authorize a leave and allow subsequent retry", async () => {
  const h = fixture();
  const claim = h.deps.claim;
  h.deps.lookup = async () => "unverified";
  await assert.rejects(() => handleBotInvite(invited(), h.deps));
  assert.deepStrictEqual(h.counts(), { sends: 0, leaves: 0 });
  h.deps.lookup = async () => "unmanaged";
  h.deps.claim = async () => null;
  await assert.rejects(() => handleBotInvite(invited(), h.deps));
  assert.deepStrictEqual(h.counts(), { sends: 0, leaves: 0 });
  h.deps.claim = claim;
  await handleBotInvite(invited(), h.deps);
  assert.deepStrictEqual(h.counts(), { sends: 1, leaves: 1 });
});
Deno.test("managed groups and membership permission changes have no unauthorized side effects", async () => {
  const h = fixture(); h.deps.lookup = async () => "managed";
  await handleBotInvite(invited(), h.deps);
  assert.deepStrictEqual(h.counts(), { sends: 0, leaves: 0 });
  h.deps.lookup = async () => "unmanaged";
  const change = invited(); change.my_chat_member!.old_chat_member = { status: "member" };
  change.my_chat_member!.new_chat_member!.status = "administrator";
  await handleBotInvite(change, h.deps);
  assert.deepStrictEqual(h.counts(), { sends: 0, leaves: 0 });
});
Deno.test("notice failure still leaves once; a failed leave is not logged as success or retried", async () => {
  const h = fixture();
  let sendAttempts = 0, leaveAttempts = 0;
  h.deps.send = async () => { sendAttempts++; throw new Error("synthetic private error"); };
  h.deps.leave = async () => { leaveAttempts++; return { ok: false }; };
  await handleBotInvite(invited(), h.deps); await handleBotInvite(invited(), h.deps);
  assert.ok(h.actions.includes("unauthorized_group_notice_failed"));
  assert.ok(h.actions.includes("unauthorized_group_leave_failed"));
  assert.ok(!h.actions.includes("unauthorized_group_left"));
  assert.deepStrictEqual([sendAttempts, leaveAttempts], [1, 1]);
});
