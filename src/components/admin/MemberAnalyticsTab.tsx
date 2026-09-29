import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Users, UserPlus, UserMinus, TrendingUp } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from "recharts";
import { toast } from "sonner";
import BotDmUsersSection from "./BotDmUsersSection";


type Range = "today" | "7d" | "30d";

interface EventRow {
  id: string;
  chat_id: number;
  tg_user_id: number;
  username: string | null;
  display_name: string | null;
  event_type: string;
  invite_link: string | null;
  invite_link_name: string | null;
  admin_actor_username: string | null;
  occurred_at: string;
}

interface DailyStat {
  chat_id: number;
  stat_date: string;
  total_members: number | null;
  joined_count: number;
  left_count: number;
  kicked_count: number;
  banned_count: number;
  net_growth: number;
}

function rangeStartIso(range: Range): string {
  const now = new Date();
  if (range === "today") {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
  const days = range === "7d" ? 7 : 30;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

function toCsv<T extends Record<string, unknown>>(rows: T[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
}

function download(filename: string, content: string, mime = "text/csv") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function MemberAnalyticsTab() {
  const [range, setRange] = useState<Range>("7d");
  const [events, setEvents] = useState<EventRow[]>([]);
  const [stats, setStats] = useState<DailyStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventsError, setEventsError] = useState(false);
  const [statsError, setStatsError] = useState(false);

  const load = async () => {
      setLoading(true);
      const since = rangeStartIso(range);
      const [eventsRes, statsRes] = await Promise.all([
        supabase
          .from("telegram_member_events")
          .select("id, chat_id, tg_user_id, username, display_name, event_type, invite_link, invite_link_name, admin_actor_username, occurred_at")
          .gte("occurred_at", since)
          .order("occurred_at", { ascending: false })
          .limit(2000),
        supabase
          .from("telegram_member_daily_stats")
          .select("chat_id, stat_date, total_members, joined_count, left_count, kicked_count, banned_count, net_growth")
          .gte("stat_date", since.slice(0, 10))
          .order("stat_date"),
      ]);
      setEventsError(Boolean(eventsRes.error));
      setStatsError(Boolean(statsRes.error));
      if (!eventsRes.error) setEvents((eventsRes.data ?? []) as EventRow[]);
      if (!statsRes.error) setStats((statsRes.data ?? []) as DailyStat[]);
      if (eventsRes.error || statsRes.error) toast.error("Không tải được một phần dữ liệu member analytics.");
      setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [range]);

  const kpis = useMemo(() => {
    const joined = events.filter((e) => e.event_type === "join" || e.event_type === "rejoined").length;
    const left = events.filter((e) => e.event_type === "left").length;
    const kicked = events.filter((e) => e.event_type === "kicked").length;
    const banned = events.filter((e) => e.event_type === "banned").length;
    const totalMembers = stats.length ? stats[stats.length - 1].total_members ?? null : null;
    return { joined, left, kicked, banned, net: joined - left - kicked - banned, totalMembers };
  }, [events, stats]);

  const chartData = useMemo(() => {
    return stats.map((s) => ({
      date: s.stat_date,
      Joined: s.joined_count,
      Left: s.left_count + s.kicked_count + s.banned_count,
      Net: s.net_growth,
    }));
  }, [stats]);

  const inviteData = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of events) {
      if ((e.event_type === "join" || e.event_type === "rejoined") && e.invite_link) {
        const label = e.invite_link_name ?? e.invite_link;
        m.set(label, (m.get(label) ?? 0) + 1);
      }
    }
    return [...m.entries()].map(([name, joins]) => ({ name, joins })).sort((a, b) => b.joins - a.joins).slice(0, 8);
  }, [events]);

  const recruiters = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of events) {
      if ((e.event_type === "join" || e.event_type === "rejoined")) {
        const actor = e.admin_actor_username;
        if (actor) m.set(actor, (m.get(actor) ?? 0) + 1);
      }
    }
    return [...m.entries()].map(([u, c]) => ({ username: u, count: c })).sort((a, b) => b.count - a.count).slice(0, 10);
  }, [events]);

  const exportEventsCsv = () => download(`member-events-${range}.csv`, toCsv(events as unknown as Record<string, unknown>[]));
  const exportStatsCsv = () => download(`daily-stats-${range}.csv`, toCsv(stats as unknown as Record<string, unknown>[]));


  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">📊 Member Tracking & Retention</h2>
        <div className="flex items-center gap-2">
          <Select value={range} onValueChange={(v) => setRange(v as Range)}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="7d">7 Days</SelectItem>
              <SelectItem value="30d">30 Days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportEventsCsv} disabled={loading || eventsError}><Download className="w-4 h-4 mr-1" />Events CSV</Button>
          <Button variant="outline" size="sm" onClick={exportStatsCsv} disabled={loading || statsError}><Download className="w-4 h-4 mr-1" />Stats CSV</Button>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>Thử tải lại</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-muted-foreground text-xs"><Users className="w-4 h-4" />Total Members</div><div className="text-2xl font-bold mt-1">{statsError ? "Lỗi tải" : kpis.totalMembers ?? (loading ? "Đang tải…" : "—")}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-muted-foreground text-xs"><UserPlus className="w-4 h-4" />Joined</div><div className="text-2xl font-bold mt-1 text-green-600">{eventsError ? "Lỗi tải" : loading ? "Đang tải…" : `+${kpis.joined}`}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-muted-foreground text-xs"><UserMinus className="w-4 h-4" />Left</div><div className="text-2xl font-bold mt-1 text-orange-600">{eventsError ? "Lỗi tải" : loading ? "Đang tải…" : `-${kpis.left}`}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-muted-foreground text-xs">🚫 Kick / ⛔ Ban</div><div className="text-2xl font-bold mt-1 text-red-600">{eventsError ? "Lỗi tải" : loading ? "Đang tải…" : `-${kpis.kicked + kpis.banned}`}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-2 text-muted-foreground text-xs"><TrendingUp className="w-4 h-4" />Net Growth</div><div className={`text-2xl font-bold mt-1 ${kpis.net >= 0 ? "text-green-600" : "text-red-600"}`}>{eventsError ? "Lỗi tải" : loading ? "Đang tải…" : `${kpis.net >= 0 ? "+" : ""}${kpis.net}`}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Joins vs Leaves</CardTitle></CardHeader>
        <CardContent className="h-72">
          {loading ? <p className="text-sm text-muted-foreground">Đang tải…</p> : statsError ? <p className="text-sm text-destructive">Không tải được thống kê; hãy dùng Thử tải lại.</p> : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="Joined" stroke="#16a34a" />
              <Line type="monotone" dataKey="Left" stroke="#ea580c" />
              <Line type="monotone" dataKey="Net" stroke="#2563eb" />
            </LineChart>
          </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Top Invite Links</CardTitle></CardHeader>
          <CardContent className="h-72">
            {loading ? <p className="text-sm text-muted-foreground">Đang tải…</p> : eventsError ? <p className="text-sm text-destructive">Không tải được event; hãy dùng Thử tải lại.</p> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={inviteData} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={140} />
                <Tooltip />
                <Bar dataKey="joins" fill="#eab308" />
              </BarChart>
            </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Top Recruiters (admin actor on add)</CardTitle></CardHeader>
          <CardContent>
            {eventsError ? <p className="text-sm text-destructive">Không tải được event; hãy dùng Thử tải lại.</p> : recruiters.length === 0 && !loading ? (
              <p className="text-sm text-muted-foreground">No recruiter data yet for this range.</p>
            ) : (
              <table className="w-full text-sm">
                <thead><tr className="text-left text-muted-foreground"><th>#</th><th>Username</th><th className="text-right">Joins</th></tr></thead>
                <tbody>
                  {recruiters.map((r, i) => (
                    <tr key={r.username} className="border-t"><td className="py-1">{i + 1}</td><td>@{r.username}</td><td className="text-right">{r.count}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Recent Events</CardTitle></CardHeader>
        <CardContent>
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background"><tr className="text-left text-muted-foreground"><th>Time (KL)</th><th>Event</th><th>User</th><th>Invite / Actor</th></tr></thead>
              <tbody>
                {loading && <tr><td colSpan={4} className="text-center py-4 text-muted-foreground">Đang tải…</td></tr>}
                {!loading && eventsError && <tr><td colSpan={4} className="text-center py-4 text-destructive">Không tải được event trong khoảng này.</td></tr>}
                {!loading && !eventsError && events.length === 0 && <tr><td colSpan={4} className="text-center py-4 text-muted-foreground">Không có event trong khoảng đã chọn.</td></tr>}
                {!loading && !eventsError && events.slice(0, 200).map((e) => (
                  <tr key={e.id} className="border-t">
                    <td className="py-1">{new Date(e.occurred_at).toLocaleString("en-GB", { timeZone: "Asia/Kuala_Lumpur" })}</td>
                    <td>{e.event_type}</td>
                    <td>{e.display_name} {e.username ? `(@${e.username})` : ""}</td>
                    <td className="text-muted-foreground">{e.invite_link_name ?? e.invite_link ?? (e.admin_actor_username ? `by @${e.admin_actor_username}` : "")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <BotDmUsersSection />
    </div>
  );
}
