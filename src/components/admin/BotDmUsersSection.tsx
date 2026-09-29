import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, MessageCircle, Eye } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { formatMyt } from "@/lib/formatMyt";
import BotDmConversationDialog from "./BotDmConversationDialog";


interface DmUserRow {
  telegram_user_id: number;
  chat_id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  language_code: string | null;
  first_seen_at: string;
  last_seen_at: string;
  message_count: number;
  last_command: string | null;
  last_message_text: string | null;
  linked_user_id: string | null;
}

type LinkFilter = "all" | "linked" | "unlinked";

function toCsv(rows: DmUserRow[]): string {
  if (!rows.length) return "";
  const headers = [
    "telegram_user_id","username","first_name","last_name","language_code",
    "message_count","last_command","first_seen_at","last_seen_at","linked",
  ];
  const lines = [headers.join(",")];
  for (const r of rows) {
    const vals = [
      r.telegram_user_id, r.username ?? "", r.first_name ?? "", r.last_name ?? "",
      r.language_code ?? "", r.message_count, r.last_command ?? "",
      r.first_seen_at, r.last_seen_at, r.linked_user_id ? "yes" : "no",
    ].map((v) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    });
    lines.push(vals.join(","));
  }
  return lines.join("\n");
}

export default function BotDmUsersSection() {
  const [filter, setFilter] = useState<LinkFilter>("all");
  const [viewing, setViewing] = useState<{ id: number; name: string } | null>(null);
  const [search, setSearch] = useState("");


  const { data: users = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ["bot-dm-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("telegram_bot_dm_users" as any)
        .select("*")
        .order("last_seen_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as DmUserRow[];
    },
    staleTime: 30_000,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      const matchesFilter = filter === "all" || (filter === "linked" ? !!u.linked_user_id : !u.linked_user_id);
      const matchesSearch = !q || [u.username, u.first_name, u.last_name, String(u.telegram_user_id)]
        .some((v) => (v ?? "").toLowerCase().includes(q));
      return matchesFilter && matchesSearch;
    });
  }, [users, filter, search]);

  const stats = useMemo(() => {
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const today = users.filter((u) => new Date(u.last_seen_at).getTime() >= dayAgo).length;
    const week = users.filter((u) => new Date(u.last_seen_at).getTime() >= weekAgo).length;
    const linked = users.filter((u) => !!u.linked_user_id).length;
    return {
      total: users.length,
      today,
      week,
      linkedPct: users.length ? Math.round((linked / users.length) * 100) : 0,
    };
  }, [users]);

  const unverifiedLabel = isLoading ? "Đang tải…" : isError ? "Chưa xác minh" : null;

  function downloadCsv() {
    if (isLoading || isError) return;
    const csv = toCsv(filtered);
    if (!csv) {
      toast.info("Chưa có dữ liệu để export");
      return;
    }
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bot-dm-users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageCircle className="h-4 w-4" />
          💬 DM riêng với Bot (@funrich_community_bot)
        </CardTitle>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={(v) => setFilter(v as LinkFilter)}>
            <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả</SelectItem>
              <SelectItem value="linked">Đã liên kết FUN.RICH</SelectItem>
              <SelectItem value="unlinked">Chưa liên kết</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={downloadCsv} disabled={isLoading || isError}>
            <Download className="h-4 w-4 mr-1" /> CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Tổng trong tối đa 500 bản ghi đã tải" value={unverifiedLabel ?? stats.total} />
          <Stat label="Hoạt động 24h · mẫu đã tải" value={unverifiedLabel ?? stats.today} />
          <Stat label="Hoạt động 7 ngày · mẫu đã tải" value={unverifiedLabel ?? stats.week} />
          <Stat label="% đã liên kết · mẫu đã tải" value={unverifiedLabel ?? `${stats.linkedPct}%`} />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Input aria-label="Tìm người dùng DM trong bản ghi đã tải" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm tên, username hoặc Telegram ID trong bản ghi đã tải…" className="sm:max-w-md" />
          <span className="text-xs text-muted-foreground">{unverifiedLabel ?? `Hiển thị ${filtered.length} / ${users.length}; truy vấn giới hạn 500 bản ghi gần nhất.`}</span>
        </div>

        <div className="max-h-[480px] overflow-auto rounded border">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="sticky top-0 bg-background z-10">
              <tr className="text-left text-muted-foreground">
                <th className="p-2">User</th>
                <th className="p-2">Msgs</th>
                <th className="p-2">Lệnh cuối</th>
                <th className="p-2">Lần cuối (MYT, UTC+8)</th>
                <th className="p-2">Trạng thái</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={6} className="text-center py-6 text-muted-foreground">Loading…</td></tr>
              )}
              {isError && (
                <tr><td colSpan={6} className="py-6 text-center text-destructive">Không tải được dữ liệu DM: {error instanceof Error ? error.message : "Lỗi không xác định"} <Button variant="outline" size="sm" onClick={() => void refetch()}>Thử lại</Button></td></tr>
              )}
              {!isLoading && !isError && filtered.length === 0 && (
                <tr><td colSpan={6} className="text-center py-6 text-muted-foreground">
                  {users.length ? "Không có bản ghi khớp bộ lọc tìm kiếm." : "Chưa có bản ghi DM trong tập dữ liệu tải được."}
                </td></tr>
              )}
              {!isError && filtered.map((u) => (
                <tr key={u.telegram_user_id} className="border-t">
                  <td className="p-2">
                    <div className="font-medium">{u.first_name || "(no name)"} {u.last_name ?? ""}</div>
                    <div className="text-xs text-muted-foreground">
                      {u.username ? `@${u.username}` : `id:${u.telegram_user_id}`}
                      {u.language_code ? ` · ${u.language_code}` : ""}
                    </div>
                  </td>
                  <td className="p-2 tabular-nums">{u.message_count}</td>
                  <td className="p-2 text-muted-foreground">{u.last_command ?? "—"}</td>
                  <td className="p-2 text-muted-foreground">{formatMyt(u.last_seen_at)}</td>
                  <td className="p-2">
                    {u.linked_user_id ? (
                      <Badge variant="default">Đã liên kết</Badge>
                    ) : (
                      <Badge variant="secondary">Chưa liên kết</Badge>
                    )}
                  </td>
                  <td className="p-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setViewing({
                          id: u.telegram_user_id,
                          name: `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() ||
                            (u.username ? `@${u.username}` : `id:${u.telegram_user_id}`),
                        })
                      }
                    >
                      <Eye className="h-4 w-4 mr-1" /> Xem
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>

      <BotDmConversationDialog
        open={!!viewing}
        onOpenChange={(o) => !o && setViewing(null)}
        telegramUserId={viewing?.id ?? null}
        displayName={viewing?.name ?? ""}
      />
    </Card>
  );
}


function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
