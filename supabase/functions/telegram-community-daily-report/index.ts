// Daily Member Tracking report for FunRich community groups.
// Computes per-chat counts from telegram_member_events, fetches total member
// count from Telegram, upserts telegram_member_daily_stats, and sends a
// formatted report to the configured admin chat.
import { createClient } from "npm:@supabase/supabase-js@2";
import { callCommunityTelegram, communityCorsHeaders, json } from "../_shared/telegram-community.ts";

const TZ = "Asia/Kuala_Lumpur";

function klDateString(d: Date): string {
  // YYYY-MM-DD in Asia/Kuala_Lumpur
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

function klDayBoundsUtc(dateStr: string): { startUtc: string; endUtc: string } {
  // dateStr = YYYY-MM-DD in KL. KL is UTC+8 (no DST).
  const start = new Date(`${dateStr}T00:00:00+08:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { startUtc: start.toISOString(), endUtc: end.toISOString() };
}

async function getChatMemberCount(chatId: number): Promise<number | null> {
  const r = await callCommunityTelegram("getChatMemberCount", { chat_id: chatId });
  if (!r.ok) return null;
  const n = (r.data as { result?: number }).result;
  return typeof n === "number" ? n : null;
}

async function buildAndSendReport(admin: ReturnType<typeof createClient>, chatId: number, alertChatId: string, dateStr: string): Promise<void> {
  const { startUtc, endUtc } = klDayBoundsUtc(dateStr);
  const { data: events } = await admin
    .from("telegram_member_events")
    .select("event_type, invite_link, invite_link_name")
    .eq("chat_id", chatId)
    .gte("occurred_at", startUtc)
    .lt("occurred_at", endUtc);

  const counts = { join: 0, rejoined: 0, left: 0, kicked: 0, banned: 0, unbanned: 0 };
  const inviteJoins = new Map<string, { name: string | null; count: number }>();
  for (const e of (events ?? []) as Array<{ event_type: keyof typeof counts; invite_link: string | null; invite_link_name: string | null }>) {
    if (e.event_type in counts) counts[e.event_type] += 1;
    if ((e.event_type === "join" || e.event_type === "rejoined") && e.invite_link) {
      const cur = inviteJoins.get(e.invite_link) ?? { name: e.invite_link_name, count: 0 };
      cur.count += 1;
      cur.name = cur.name ?? e.invite_link_name;
      inviteJoins.set(e.invite_link, cur);
    }
  }

  const joinedTotal = counts.join + counts.rejoined;
  const leftTotal = counts.left;
  const kickedTotal = counts.kicked;
  const bannedTotal = counts.banned;
  const netGrowth = joinedTotal - leftTotal - kickedTotal - bannedTotal + counts.unbanned;

  const totalMembers = await getChatMemberCount(chatId);
  const topInvites = [...inviteJoins.entries()]
    .map(([link, v]) => ({ invite_link: link, name: v.name, count: v.count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  await admin.from("telegram_member_daily_stats").upsert({
    chat_id: chatId,
    stat_date: dateStr,
    total_members: totalMembers,
    joined_count: joinedTotal,
    left_count: leftTotal,
    kicked_count: kickedTotal,
    banned_count: bannedTotal,
    unbanned_count: counts.unbanned,
    rejoined_count: counts.rejoined,
    net_growth: netGrowth,
    top_invite_links: topInvites,
    updated_at: new Date().toISOString(),
  });

  const top3 = topInvites.slice(0, 3);
  const inviteLines = top3.length
    ? top3.map((t, i) => `${i + 1}. ${t.name ?? t.invite_link} = ${t.count} joins`).join("\n")
    : "—";

  const text = [
    "📊 <b>FUNRICH COMMUNITY DAILY REPORT</b>",
    `Date (KL): ${dateStr}`,
    "",
    `Total Members: <b>${totalMembers ?? "?"}</b>`,
    "",
    "Today:",
    `✅ Joined: +${joinedTotal}`,
    `❌ Left: -${leftTotal}`,
    `🚫 Kicked: -${kickedTotal}`,
    `⛔ Banned: -${bannedTotal}`,
    "",
    `Net Growth: ${netGrowth >= 0 ? "+" : ""}${netGrowth}`,
    "",
    "Top Invite Links:",
    inviteLines,
  ].join("\n");

  await callCommunityTelegram("sendMessage", {
    chat_id: alertChatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: communityCorsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  // Optional ?date=YYYY-MM-DD override (KL day). Default = yesterday in KL.
  const url = new URL(req.url);
  const overrideDate = url.searchParams.get("date");
  const chatIdParam = url.searchParams.get("chat_id");
  const dateStr = overrideDate ?? klDateString(new Date(Date.now() - 24 * 60 * 60 * 1000));

  let query = admin
    .from("telegram_community_settings")
    .select("group_id, member_alerts_enabled, member_alerts_chat_id");
  if (chatIdParam) query = query.eq("group_id", Number(chatIdParam));
  const { data: groups } = await query;

  const targets = (groups ?? []).filter(
    (g) => g.member_alerts_chat_id && (g.member_alerts_enabled || chatIdParam),
  );

  const results: Array<{ chat_id: number; ok: boolean; error?: string }> = [];
  for (const g of targets) {
    try {
      await buildAndSendReport(admin, Number(g.group_id), String(g.member_alerts_chat_id), dateStr);
      results.push({ chat_id: Number(g.group_id), ok: true });
    } catch (e) {
      results.push({ chat_id: Number(g.group_id), ok: false, error: String(e) });
    }
  }

  return json({ ok: true, date: dateStr, processed: results });
});
