// Weekly retention report for FunRich community: new vs lost members in last
// 7 days, retention rate, top invite links by retention, top recruiters, plus
// an AI-generated loss-cause analysis from Lovable AI Gateway.
import { createClient } from "npm:@supabase/supabase-js@2";
import { callCommunityTelegram, communityCorsHeaders, json } from "../_shared/telegram-community.ts";

type EventRow = {
  tg_user_id: number;
  event_type: string;
  invite_link: string | null;
  invite_link_name: string | null;
  invited_by_username: string | null;
  occurred_at: string;
};

async function aiLossAnalysis(promptText: string): Promise<string | null> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return null;
  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Bạn là community analyst của FUN.RICH. Quan sát dữ liệu, chỉ ra giai đoạn mất nhiều member và đưa 2–3 khuyến nghị ngắn, tiếng Việt, ấm áp, ngắn gọn (<=250 từ)." },
          { role: "user", content: promptText },
        ],
      }),
    });
    if (!r.ok) return null;
    const data = await r.json();
    return data?.choices?.[0]?.message?.content ?? null;
  } catch (_e) {
    return null;
  }
}

async function runWeekly(admin: ReturnType<typeof createClient>, chatId: number, alertChatId: string) {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const { data: thisWeek } = await admin
    .from("telegram_member_events")
    .select("tg_user_id, event_type, invite_link, invite_link_name, invited_by_username, occurred_at")
    .eq("chat_id", chatId)
    .gte("occurred_at", weekAgo.toISOString());

  const { data: prevWeek } = await admin
    .from("telegram_member_events")
    .select("event_type")
    .eq("chat_id", chatId)
    .gte("occurred_at", twoWeeksAgo.toISOString())
    .lt("occurred_at", weekAgo.toISOString());

  const tw = (thisWeek ?? []) as EventRow[];
  const pw = (prevWeek ?? []) as Array<{ event_type: string }>;

  const newMembers = tw.filter((e) => e.event_type === "join" || e.event_type === "rejoined");
  const lost = tw.filter((e) => ["left", "kicked", "banned"].includes(e.event_type));
  const prevNew = pw.filter((e) => e.event_type === "join" || e.event_type === "rejoined").length;
  const prevLost = pw.filter((e) => ["left", "kicked", "banned"].includes(e.event_type)).length;

  // Retention: of users who joined this week, how many are NOT in lost set within same window.
  const newUserIds = new Set(newMembers.map((e) => e.tg_user_id));
  const lostNewUsers = new Set(lost.filter((e) => newUserIds.has(e.tg_user_id)).map((e) => e.tg_user_id));
  const retained = newUserIds.size - lostNewUsers.size;
  const retentionRate = newUserIds.size > 0 ? (retained / newUserIds.size) * 100 : 0;

  // Top invite links by joins
  const linkAgg = new Map<string, { name: string | null; joins: number; retained: number }>();
  for (const e of newMembers) {
    if (!e.invite_link) continue;
    const cur = linkAgg.get(e.invite_link) ?? { name: e.invite_link_name, joins: 0, retained: 0 };
    cur.joins += 1;
    if (!lostNewUsers.has(e.tg_user_id)) cur.retained += 1;
    linkAgg.set(e.invite_link, cur);
  }
  const topLinks = [...linkAgg.entries()]
    .sort((a, b) => b[1].joins - a[1].joins)
    .slice(0, 5);

  // Top recruiters
  const recruiters = new Map<string, number>();
  for (const e of newMembers) {
    if (!e.invited_by_username) continue;
    recruiters.set(e.invited_by_username, (recruiters.get(e.invited_by_username) ?? 0) + 1);
  }
  const topRecruiters = [...recruiters.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  const trend = prevNew - prevLost === 0 ? "—" :
    ((newMembers.length - lost.length) - (prevNew - prevLost)) >= 0 ? "↑" : "↓";

  const lines = [
    "📈 <b>FUNRICH WEEKLY RETENTION REPORT</b>",
    `Period: last 7 days (KL)`,
    "",
    `New Members: ${newMembers.length}`,
    `Lost Members: ${lost.length}`,
    `Retention Rate: ${retentionRate.toFixed(1)}%`,
    `Growth Trend vs prev week: ${trend} (net ${newMembers.length - lost.length} vs ${prevNew - prevLost})`,
    "",
    "<b>Top Invite Links</b>",
    topLinks.length
      ? topLinks.map(([link, v], i) => `${i + 1}. ${v.name ?? link} — ${v.joins} joins, ${v.joins ? Math.round((v.retained / v.joins) * 100) : 0}% retained`).join("\n")
      : "—",
    "",
    "<b>Top Recruiters</b>",
    topRecruiters.length
      ? topRecruiters.map(([u, c], i) => `${i + 1}. @${u} — ${c}`).join("\n")
      : "—",
  ];

  await callCommunityTelegram("sendMessage", {
    chat_id: alertChatId,
    text: lines.join("\n"),
    parse_mode: "HTML",
    disable_web_page_preview: true,
  });

  // AI loss-cause analysis (uses last 30 days daily stats)
  const { data: stats } = await admin
    .from("telegram_member_daily_stats")
    .select("stat_date, joined_count, left_count, kicked_count, banned_count, net_growth, total_members")
    .eq("chat_id", chatId)
    .gte("stat_date", monthAgo.toISOString().slice(0, 10))
    .order("stat_date");

  const prompt = `Dữ liệu 30 ngày của group ${chatId}:\n` +
    (stats ?? []).map((s) => `${s.stat_date}: +${s.joined_count} / -${s.left_count} kick:${s.kicked_count} ban:${s.banned_count} net:${s.net_growth} total:${s.total_members ?? "?"}`).join("\n") +
    `\n\nTuần này: ${newMembers.length} mới, ${lost.length} rời, retention ${retentionRate.toFixed(1)}%. Top invite: ${topLinks.map(([l, v]) => `${v.name ?? l}(${v.joins})`).join(", ")}.`;

  const ai = await aiLossAnalysis(prompt);
  if (ai) {
    const text = `🧠 <b>Loss-cause analysis</b>\n\n${ai.slice(0, 3500)}`;
    await callCommunityTelegram("sendMessage", {
      chat_id: alertChatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: communityCorsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  const url = new URL(req.url);
  const chatIdParam = url.searchParams.get("chat_id");

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
      await runWeekly(admin, Number(g.group_id), String(g.member_alerts_chat_id));
      results.push({ chat_id: Number(g.group_id), ok: true });
    } catch (e) {
      results.push({ chat_id: Number(g.group_id), ok: false, error: String(e) });
    }
  }

  return json({ ok: true, processed: results });
});
