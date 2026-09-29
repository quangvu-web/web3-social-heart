import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, RefreshCw, Copy, Download, Trash2 } from "lucide-react";

type Row = {
  id: string;
  created_at: string;
  group_id: number | null;
  chat_id: number | null;
  chat_type: string | null;
  user_id: number | null;
  username: string | null;
  full_name: string | null;
  trigger_source: string | null;
  source: string | null;
  web_user_id: string | null;
  web_conversation_id: string | null;
  user_message: string;
  bot_reply: string | null;
  language: string | null;
  provider: string | null;
  latency_ms: number | null;
  error: string | null;
};

type PresetRange = "1" | "7" | "30" | "all" | "day" | "range";

const PRESETS: { value: PresetRange; label: string }[] = [
  { value: "1", label: "24 giờ qua" },
  { value: "7", label: "7 ngày qua" },
  { value: "30", label: "30 ngày qua" },
  { value: "all", label: "Tất cả" },
  { value: "day", label: "Theo 1 ngày cụ thể" },
  { value: "range", label: "Từ ngày - Đến ngày" },
];

// MYT = UTC+8 → offset trong ISO
const MYT_OFFSET_MIN = 8 * 60;

function mytDayToUtcRange(dayYmd: string): { from: string; to: string } | null {
  // dayYmd = "YYYY-MM-DD" theo giờ MYT. Chuyển sang UTC ISO.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayYmd)) return null;
  const [y, m, d] = dayYmd.split("-").map(Number);
  // 00:00 MYT = (00:00 - 8h) UTC = 16:00 UTC ngày trước
  const startUtcMs = Date.UTC(y, m - 1, d, 0, 0, 0) - MYT_OFFSET_MIN * 60_000;
  const endUtcMs = startUtcMs + 86400_000;
  return { from: new Date(startUtcMs).toISOString(), to: new Date(endUtcMs).toISOString() };
}

function fmtMyt(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-GB", {
      timeZone: "Asia/Kuala_Lumpur",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  } catch { return iso; }
}

function trunc(s: string | null | undefined, n = 90): string {
  if (!s) return "";
  return s.length > n ? s.slice(0, n) + "…" : s;
}

function todayMytYmd(): string {
  // Lấy YYYY-MM-DD theo MYT
  const nowMytMs = Date.now() + MYT_OFFSET_MIN * 60_000;
  return new Date(nowMytMs).toISOString().slice(0, 10);
}

export default function AdminAiConversationsTab() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [preset, setPreset] = useState<PresetRange>("7");
  const [singleDay, setSingleDay] = useState<string>(todayMytYmd());
  const [rangeFrom, setRangeFrom] = useState<string>(todayMytYmd());
  const [rangeTo, setRangeTo] = useState<string>(todayMytYmd());
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Row | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    setLoading(true);
    let q = supabase
      .from("telegram_ai_conversations" as never)
      .select("id, created_at, group_id, chat_id, chat_type, user_id, username, full_name, trigger_source, source, web_user_id, web_conversation_id, user_message, bot_reply, language, provider, latency_ms, error")
      .order("created_at", { ascending: false })
      .limit(500);

    if (preset === "1" || preset === "7" || preset === "30") {
      const days = Number(preset);
      const since = new Date(Date.now() - days * 86400_000).toISOString();
      q = q.gte("created_at", since);
    } else if (preset === "day") {
      const r = mytDayToUtcRange(singleDay);
      if (r) q = q.gte("created_at", r.from).lt("created_at", r.to);
    } else if (preset === "range") {
      const a = mytDayToUtcRange(rangeFrom);
      const b = mytDayToUtcRange(rangeTo);
      if (a) q = q.gte("created_at", a.from);
      if (b) q = q.lt("created_at", b.to);
    }
    if (search.trim()) {
      const s = search.trim().replace(/[%_]/g, "\\$&");
      q = q.or(`user_message.ilike.%${s}%,bot_reply.ilike.%${s}%,username.ilike.%${s}%`);
    }
    const { data, error } = await q;
    if (error) {
      setLoadError(true);
      setLoading(false);
      toast.error("Không tải được lịch sử hội thoại Telegram.");
      return;
    }
    setRows((data as unknown as Row[]) ?? []);
    setCheckedIds(new Set());
    setLoaded(true);
    setLoadError(false);
    setLoading(false);
  }

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [preset]);

  function toggleOne(id: string) {
    setCheckedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    if (checkedIds.size === rows.length) setCheckedIds(new Set());
    else setCheckedIds(new Set(rows.map(r => r.id)));
  }

  async function doDelete() {
    if (checkedIds.size === 0 || !loaded || loadError || loading) return;
    setDeleting(true);
    const ids = Array.from(checkedIds);
    const { error } = await supabase
      .from("telegram_ai_conversations" as never)
      .delete()
      .in("id", ids);
    setDeleting(false);
    setConfirmDelete(false);
    if (error) {
      toast.error("Xoá thất bại: " + error.message);
      return;
    }
    toast.success(`Đã xoá ${ids.length} bản ghi`);
    setRows(prev => prev.filter(r => !checkedIds.has(r.id)));
    setCheckedIds(new Set());
  }

  function exportCsv() {
    if (!rows.length || !loaded || loadError || loading) return;
    const header = ["created_at_myt", "source", "group_id", "chat_id", "user_id", "web_user_id", "username", "full_name", "trigger_source", "language", "provider", "latency_ms", "user_message", "bot_reply", "error"];
    const escape = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return `"${s.replace(/"/g, '""')}"`;
    };
    const lines = [header.join(",")];
    for (const r of rows) {
      lines.push([
        fmtMyt(r.created_at), r.source ?? "", r.group_id ?? "", r.chat_id ?? "", r.user_id ?? "", r.web_user_id ?? "",
        r.username ?? "", r.full_name ?? "", r.trigger_source ?? "", r.language ?? "", r.provider ?? "", r.latency_ms ?? "",
        r.user_message, r.bot_reply ?? "", r.error ?? "",
      ].map(escape).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `angel-conversations-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copyText(t: string, label: string) {
    try {
      await navigator.clipboard.writeText(t);
      toast.success(`Đã copy ${label}`);
    } catch {
      toast.error("Copy thất bại");
    }
  }

  const allChecked = rows.length > 0 && checkedIds.size === rows.length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
        <CardTitle>Lịch sử Angel AI ↔ User</CardTitle>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={preset} onValueChange={(v) => setPreset(v as PresetRange)}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PRESETS.map((r) => (
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {preset === "day" && (
            <Input
              type="date"
              value={singleDay}
              onChange={(e) => setSingleDay(e.target.value)}
              className="w-40"
            />
          )}
          {preset === "range" && (
            <>
              <Input type="date" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} className="w-40" />
              <span className="text-xs text-muted-foreground">→</span>
              <Input type="date" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} className="w-40" />
            </>
          )}

          <Input
            placeholder="Tìm trong nội dung / username…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
            className="w-56"
          />
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Refresh
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setConfirmDelete(true)}
            disabled={!loaded || loadError || loading || checkedIds.size === 0 || deleting}
            className="gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Xoá ({checkedIds.size})
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!loaded || loadError || loading || !rows.length} className="gap-2">
            <Download className="w-4 h-4" /> CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground mb-3">
          Hiển thị tối đa 500 dòng mới nhất trong khoảng thời gian đã chọn (giờ MYT). Click 1 dòng để xem toàn văn. Tick checkbox rồi bấm "Xoá" để xoá record.
        </p>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-xs">
            <thead className="bg-muted/40">
              <tr className="text-left">
                <th className="px-2 py-2 w-8">
                  <Checkbox
                    checked={allChecked}
                    onCheckedChange={toggleAll}
                    aria-label="Chọn tất cả"
                  />
                </th>
                <th className="px-2 py-2">Thời gian (MYT)</th>
                <th className="px-2 py-2">Nguồn</th>
                <th className="px-2 py-2">Group</th>
                <th className="px-2 py-2">User</th>
                <th className="px-2 py-2">Trigger</th>
                <th className="px-2 py-2">User message</th>
                <th className="px-2 py-2">Angel reply</th>
                <th className="px-2 py-2 text-right">ms</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={9} className="px-2 py-6 text-center text-muted-foreground">Đang tải…</td></tr>}
              {!loading && loadError && <tr><td colSpan={9} className="px-2 py-6 text-center text-destructive">Không tải được dữ liệu. <Button variant="outline" size="sm" onClick={() => void load()}>Thử lại</Button></td></tr>}
              {!loading && loaded && !loadError && rows.length === 0 && <tr><td colSpan={9} className="px-2 py-6 text-center text-muted-foreground">Không có hội thoại trong phạm vi đã chọn.</td></tr>}
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-t hover:bg-muted/30 align-top"
                >
                  <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                    <Checkbox disabled={!loaded || loadError || loading}
                      checked={checkedIds.has(r.id)}
                      onCheckedChange={() => toggleOne(r.id)}
                      aria-label="Chọn"
                    />
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap cursor-pointer" onClick={() => setSelected(r)}>{fmtMyt(r.created_at)}</td>
                  <td className="px-2 py-2 whitespace-nowrap cursor-pointer" onClick={() => setSelected(r)}>{r.source ?? "telegram"}</td>
                  <td className="px-2 py-2 whitespace-nowrap cursor-pointer" onClick={() => setSelected(r)}>{r.group_id ?? (r.source && r.source !== "telegram" ? "-" : "(DM)")}</td>
                  <td className="px-2 py-2 whitespace-nowrap cursor-pointer" onClick={() => setSelected(r)}>
                    {r.username ? (r.source && r.source !== "telegram" ? r.username : `@${r.username}`) : (r.full_name ?? r.user_id ?? r.web_user_id?.slice(0, 8) ?? "-")}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap cursor-pointer" onClick={() => setSelected(r)}>{r.trigger_source ?? "-"}</td>
                  <td className="px-2 py-2 max-w-[280px] cursor-pointer" onClick={() => setSelected(r)}>{trunc(r.user_message, 80)}</td>
                  <td className="px-2 py-2 max-w-[280px] cursor-pointer" onClick={() => setSelected(r)}>
                    {r.error
                      ? <span className="text-destructive">⚠ {trunc(r.error, 60)}</span>
                      : trunc(r.bot_reply, 80)}
                  </td>
                  <td className="px-2 py-2 text-right whitespace-nowrap cursor-pointer" onClick={() => setSelected(r)}>{r.latency_ms ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Chi tiết cuộc hội thoại</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div><b>Time:</b> {fmtMyt(selected.created_at)}</div>
                <div><b>Nguồn:</b> {selected.source ?? "telegram"}</div>
                <div><b>Group / Chat:</b> {selected.group_id ?? selected.chat_id ?? selected.web_conversation_id ?? "-"} ({selected.chat_type ?? "?"})</div>
                <div><b>User:</b> {selected.username ? `@${selected.username}` : "-"} · {selected.full_name ?? ""} · id {selected.user_id ?? selected.web_user_id ?? "-"}</div>
                <div><b>Trigger:</b> {selected.trigger_source ?? "-"}</div>
                <div><b>Lang:</b> {selected.language ?? "-"}</div>
                <div><b>Provider:</b> {selected.provider ?? "-"} · {selected.latency_ms ?? "-"}ms</div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="font-semibold">User message</div>
                  <Button size="sm" variant="ghost" className="gap-1" onClick={() => copyText(selected.user_message, "user message")}>
                    <Copy className="w-3 h-3" /> Copy
                  </Button>
                </div>
                <pre className="rounded-md border bg-muted/30 p-3 text-xs whitespace-pre-wrap font-mono max-h-64 overflow-auto">
                  {selected.user_message}
                </pre>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="font-semibold">Angel reply</div>
                  <Button size="sm" variant="ghost" className="gap-1" onClick={() => copyText(selected.bot_reply ?? "", "bot reply")} disabled={!selected.bot_reply}>
                    <Copy className="w-3 h-3" /> Copy
                  </Button>
                </div>
                <pre className="rounded-md border bg-muted/30 p-3 text-xs whitespace-pre-wrap font-mono max-h-96 overflow-auto">
                  {selected.bot_reply ?? "(không có reply)"}
                </pre>
              </div>

              {selected.error && (
                <div>
                  <div className="font-semibold text-destructive mb-1">Lỗi</div>
                  <pre className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs whitespace-pre-wrap font-mono">
                    {selected.error}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Xoá {checkedIds.size} bản ghi?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Hành động này không thể hoàn tác. Các bản ghi được chọn sẽ bị xoá vĩnh viễn khỏi lịch sử Angel AI ↔ User.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={deleting}>Huỷ</Button>
            <Button variant="destructive" onClick={doDelete} disabled={deleting} className="gap-2">
              {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
              Xoá
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
