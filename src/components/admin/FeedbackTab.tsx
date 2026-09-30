import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, RefreshCw, Download, MessageCircle, Copy } from "lucide-react";

type FeedbackRow = {
  id: number;
  created_at: string;
  source: "dm" | "group";
  chat_id: number | null;
  chat_title: string | null;
  telegram_user_id: number | null;
  username: string | null;
  display_name: string | null;
  message_id: number | null;
  content: string;
  reply_to_message_id: number | null;
  reply_to_preview: string | null;
  status: "new" | "reviewing" | "resolved" | "archived";
  admin_note: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
};

type StatusFilter = "all" | FeedbackRow["status"];
type SourceFilter = "all" | FeedbackRow["source"];
type RangeFilter = "1" | "7" | "30" | "all" | "day" | "custom";

const RANGE_OPTIONS: { value: RangeFilter; label: string }[] = [
  { value: "1", label: "24 giờ qua" },
  { value: "7", label: "7 ngày qua" },
  { value: "30", label: "30 ngày qua" },
  { value: "all", label: "Tất cả" },
  { value: "day", label: "Theo 1 ngày cụ thể" },
  { value: "custom", label: "Từ ngày - Đến ngày" },
];

const STATUS_LABEL: Record<FeedbackRow["status"], string> = {
  new: "Mới",
  reviewing: "Đang xem",
  resolved: "Đã xử lý",
  archived: "Lưu trữ",
};

const STATUS_COLOR: Record<FeedbackRow["status"], string> = {
  new: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  reviewing: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  resolved: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  archived: "bg-slate-500/15 text-slate-600 border-slate-500/30",
};

function fmtMyt(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-GB", {
      timeZone: "Asia/Kuala_Lumpur",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return iso;
  }
}

// Convert a YYYY-MM-DD in MYT (UTC+8) to a UTC ISO string at start (00:00) or end (23:59:59.999)
function mytDayToUtcIso(dateStr: string, end = false): string {
  // MYT is UTC+8, so MYT 00:00 = UTC previous-day 16:00
  const suffix = end ? "T23:59:59.999+08:00" : "T00:00:00.000+08:00";
  return new Date(`${dateStr}${suffix}`).toISOString();
}

function todayMytStr(): string {
  const now = new Date();
  // Get YYYY-MM-DD in MYT
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return parts; // en-CA gives YYYY-MM-DD
}

function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export default function FeedbackTab() {
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [source, setSource] = useState<SourceFilter>("all");
  const [range, setRange] = useState<RangeFilter>("7");
  const [singleDate, setSingleDate] = useState<string>(todayMytStr());
  const [fromDate, setFromDate] = useState<string>(todayMytStr());
  const [toDate, setToDate] = useState<string>(todayMytStr());
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<FeedbackRow | null>(null);
  const [note, setNote] = useState("");
  const [nextStatus, setNextStatus] = useState<FeedbackRow["status"]>("new");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("telegram_feedback")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (status !== "all") query = query.eq("status", status);
    if (source !== "all") query = query.eq("source", source);

    if (range === "day" && singleDate) {
      query = query
        .gte("created_at", mytDayToUtcIso(singleDate, false))
        .lte("created_at", mytDayToUtcIso(singleDate, true));
    } else if (range === "custom" && fromDate && toDate) {
      const a = fromDate <= toDate ? fromDate : toDate;
      const b = fromDate <= toDate ? toDate : fromDate;
      query = query
        .gte("created_at", mytDayToUtcIso(a, false))
        .lte("created_at", mytDayToUtcIso(b, true));
    } else if (range !== "all" && range !== "day" && range !== "custom") {
      const days = Number(range);
      const from = new Date(Date.now() - days * 86400_000).toISOString();
      query = query.gte("created_at", from);
    }

    const { data, error } = await query;
    if (error) {
      toast.error(`Không tải được feedback: ${error.message}`);
      setLoading(false);
      return;
    }
    setRows((data ?? []) as FeedbackRow[]);
    setLoading(false);
  }, [status, source, range, singleDate, fromDate, toDate]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    if (!kw) return rows;
    return rows.filter((r) =>
      [r.content, r.username, r.display_name, r.chat_title, r.reply_to_preview, r.chat_id, r.telegram_user_id]
        .filter((v) => v !== null && v !== undefined)
        .some((v) => String(v).toLowerCase().includes(kw)),
    );
  }, [rows, q]);

  const openDetail = (r: FeedbackRow) => {
    setSelected(r);
    setNote(r.admin_note ?? "");
    setNextStatus(r.status);
  };

  const copyChatId = async (e: React.MouseEvent, chatId: number | null) => {
    e.stopPropagation();
    if (chatId === null || chatId === undefined) return;
    try {
      await navigator.clipboard.writeText(String(chatId));
      toast.success(`Đã copy ${chatId}`);
    } catch {
      toast.error("Không copy được");
    }
  };

  const saveDetail = async () => {
    if (!selected) return;
    setSaving(true);
    const patch: Partial<FeedbackRow> = {
      admin_note: note.trim() || null,
      status: nextStatus,
    };
    if (nextStatus === "resolved" && selected.status !== "resolved") {
      (patch as any).resolved_at = new Date().toISOString();
      const { data: userRes } = await supabase.auth.getUser();
      if (userRes?.user?.id) (patch as any).resolved_by = userRes.user.id;
    }
    const { error } = await supabase.from("telegram_feedback").update(patch).eq("id", selected.id);
    setSaving(false);
    if (error) {
      toast.error(`Không lưu được: ${error.message}`);
      return;
    }
    toast.success("Đã cập nhật feedback");
    setSelected(null);
    load();
  };

  const exportCsv = () => {
    const header = [
      "created_at_myt",
      "source",
      "chat_id",
      "chat_title",
      "telegram_user_id",
      "username",
      "display_name",
      "content",
      "reply_to_preview",
      "status",
      "admin_note",
    ];
    const lines = [header.join(",")];
    for (const r of filtered) {
      lines.push([
        fmtMyt(r.created_at),
        r.source,
        r.chat_id,
        r.chat_title,
        r.telegram_user_id,
        r.username,
        r.display_name,
        r.content,
        r.reply_to_preview,
        r.status,
        r.admin_note,
      ].map(csvEscape).join(","));
    }
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `feedback-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3">
        <div className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Feedback từ /feedback
            <Badge variant="outline">{filtered.length}</Badge>
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={range} onValueChange={(v) => setRange(v as RangeFilter)}>
              <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {RANGE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {range === "day" && (
              <Input
                type="date"
                value={singleDate}
                onChange={(e) => setSingleDate(e.target.value)}
                className="w-[160px]"
              />
            )}
            {range === "custom" && (
              <>
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-[160px]"
                />
                <span className="text-muted-foreground text-sm">→</span>
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-[160px]"
                />
              </>
            )}
            <Select value={source} onValueChange={(v) => setSource(v as SourceFilter)}>
              <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả nguồn</SelectItem>
                <SelectItem value="dm">DM</SelectItem>
                <SelectItem value="group">Group</SelectItem>
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Mọi trạng thái</SelectItem>
                <SelectItem value="new">Mới</SelectItem>
                <SelectItem value="reviewing">Đang xem</SelectItem>
                <SelectItem value="resolved">Đã xử lý</SelectItem>
                <SelectItem value="archived">Lưu trữ</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Tìm nội dung / user / group id…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-[240px]"
            />
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="h-4 w-4 mr-1" /> CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="p-2 whitespace-nowrap">Thời gian (MYT)</th>
                <th className="p-2">Nguồn</th>
                <th className="p-2 whitespace-nowrap">Group ID</th>
                <th className="p-2">User</th>
                <th className="p-2">Nội dung</th>
                <th className="p-2">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && !loading && (
                <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Chưa có feedback nào trong khoảng đã chọn.</td></tr>
              )}
              {filtered.map((r) => (
                <tr key={r.id} className="border-t hover:bg-muted/40 cursor-pointer" onClick={() => openDetail(r)}>
                  <td className="p-2 whitespace-nowrap">{fmtMyt(r.created_at)}</td>
                  <td className="p-2">
                    <Badge variant="outline">{r.source === "dm" ? "DM" : "Group"}</Badge>
                    {r.chat_title && <div className="text-xs text-muted-foreground max-w-[160px] truncate">{r.chat_title}</div>}
                  </td>
                  <td className="p-2 whitespace-nowrap">
                    {r.chat_id !== null && r.chat_id !== undefined ? (
                      <button
                        type="button"
                        onClick={(e) => copyChatId(e, r.chat_id)}
                        className="inline-flex items-center gap-1 font-mono text-xs px-1.5 py-0.5 rounded border hover:bg-muted"
                        title="Click để copy"
                      >
                        {r.chat_id}
                        <Copy className="h-3 w-3 opacity-60" />
                      </button>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-2">
                    <div className="font-medium">{r.display_name || r.username || `tg:${r.telegram_user_id ?? "?"}`}</div>
                    {r.username && <div className="text-xs text-muted-foreground">@{r.username}</div>}
                  </td>
                  <td className="p-2 max-w-[420px]">
                    <div className="line-clamp-2 whitespace-pre-wrap">{r.content}</div>
                    {r.reply_to_preview && (
                      <div className="text-xs text-muted-foreground mt-1 line-clamp-1">↩ {r.reply_to_preview}</div>
                    )}
                  </td>
                  <td className="p-2">
                    <Badge className={STATUS_COLOR[r.status]} variant="outline">{STATUS_LABEL[r.status]}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Chi tiết feedback #{selected?.id}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">Thời gian:</span> {fmtMyt(selected.created_at)}</div>
                <div><span className="text-muted-foreground">Nguồn:</span> {selected.source === "dm" ? "DM" : "Group"}</div>
                <div className="col-span-2"><span className="text-muted-foreground">Chat:</span> {selected.chat_title ?? "—"} <span className="font-mono text-xs">({selected.chat_id ?? "—"})</span></div>
                <div><span className="text-muted-foreground">User:</span> {selected.display_name || "—"}</div>
                <div><span className="text-muted-foreground">Username:</span> {selected.username ? `@${selected.username}` : "—"}</div>
                <div><span className="text-muted-foreground">Telegram ID:</span> {selected.telegram_user_id ?? "—"}</div>
                <div><span className="text-muted-foreground">Message ID:</span> {selected.message_id ?? "—"}</div>
              </div>
              {selected.reply_to_preview && (
                <div className="rounded border p-2 text-xs">
                  <div className="text-muted-foreground mb-1">Reply đến tin (#{selected.reply_to_message_id}):</div>
                  <div className="whitespace-pre-wrap">{selected.reply_to_preview}</div>
                </div>
              )}
              <div>
                <div className="text-sm text-muted-foreground mb-1">Nội dung góp ý</div>
                <div className="rounded border p-3 whitespace-pre-wrap bg-muted/30">{selected.content}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Trạng thái</div>
                  <Select value={nextStatus} onValueChange={(v) => setNextStatus(v as FeedbackRow["status"])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">Mới</SelectItem>
                      <SelectItem value="reviewing">Đang xem</SelectItem>
                      <SelectItem value="resolved">Đã xử lý</SelectItem>
                      <SelectItem value="archived">Lưu trữ</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {selected.telegram_user_id && (
                  <div className="flex items-end">
                    <a
                      href={`tg://user?id=${selected.telegram_user_id}`}
                      className="text-sm underline text-primary"
                    >Mở DM với user trên Telegram</a>
                  </div>
                )}
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">Ghi chú admin</div>
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Ghi chú nội bộ…" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>Đóng</Button>
            <Button onClick={saveDetail} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Lưu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
