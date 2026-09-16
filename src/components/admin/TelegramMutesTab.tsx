import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { RefreshCw, VolumeX, Volume2, Search, Trash2 } from "lucide-react";

interface MuteRow {
  id: string;
  group_id: number;
  tg_user_id: number;
  tg_username: string | null;
  muted_until: string;
  reason: string | null;
  created_at: string;
}

const MS_TZ = "Asia/Kuala_Lumpur";

function formatMY(iso: string) {
  try {
    return new Date(iso).toLocaleString("vi-VN", { timeZone: MS_TZ, hour12: false });
  } catch {
    return iso;
  }
}

function remaining(untilIso: string, nowMs: number) {
  const diff = new Date(untilIso).getTime() - nowMs;
  if (diff <= 0) return { expired: true, label: "Đã hết hạn" };
  const s = Math.floor(diff / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const parts: string[] = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (!d && !h) parts.push(`${sec}s`);
  return { expired: false, label: parts.join(" ") };
}

export default function TelegramMutesTab() {
  const [rows, setRows] = useState<MuteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [search, setSearch] = useState("");
  const [showExpired, setShowExpired] = useState(false);
  const [unmuteGroupId, setUnmuteGroupId] = useState("");
  const [unmuteUsername, setUnmuteUsername] = useState("");
  const [unmuteUserId, setUnmuteUserId] = useState("");
  const [unmuting, setUnmuting] = useState(false);

  const handleManualUnmute = async () => {
    const groupId = Number(unmuteGroupId.trim());
    if (!Number.isFinite(groupId) || groupId === 0) {
      toast.error("Group ID không hợp lệ");
      return;
    }
    if (!unmuteUsername.trim() && !unmuteUserId.trim()) {
      toast.error("Nhập username hoặc user ID");
      return;
    }
    setUnmuting(true);
    const { data, error } = await supabase.functions.invoke("telegram-community-admin", {
      body: {
        action: "unmute_user",
        payload: {
          group_id: groupId,
          username: unmuteUsername.trim() || undefined,
          telegram_user_id: unmuteUserId.trim() ? Number(unmuteUserId.trim()) : undefined,
        },
      },
    });
    setUnmuting(false);
    if (error) {
      toast.error("Lỗi: " + error.message);
      return;
    }
    if (!data?.success) {
      toast.error(data?.error || "Không mở khoá được");
      return;
    }
    toast.success(`Đã mở khoá user ${data.telegram_user_id} (trạng thái: ${data.member_status ?? "?"})`);
    load();
  };

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("telegram_group_mutes")
      .select("*")
      .order("muted_until", { ascending: false })
      .limit(500);
    if (error) {
      toast.error("Không tải được danh sách mute: " + error.message);
    } else {
      setRows((data as MuteRow[]) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const handleUnmute = async (row: MuteRow) => {
    if (!confirm(`Xoá mute cho user ${row.tg_username || row.tg_user_id}?`)) return;
    const { error } = await supabase
      .from("telegram_group_mutes")
      .delete()
      .eq("id", row.id);
    if (error) {
      toast.error("Lỗi: " + error.message);
      return;
    }
    toast.success("Đã xoá bản ghi mute. (Telegram-side cần unrestrict thủ công nếu vẫn còn hiệu lực)");
    load();
  };

  const filtered = rows.filter((r) => {
    const exp = new Date(r.muted_until).getTime() <= now;
    if (!showExpired && exp) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (r.tg_username || "").toLowerCase().includes(q) ||
      String(r.tg_user_id).includes(q) ||
      String(r.group_id).includes(q)
    );
  });

  const activeCount = rows.filter((r) => new Date(r.muted_until).getTime() > now).length;

  return (
    <div className="space-y-6">
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Volume2 className="w-5 h-5 text-emerald-500" />
          Mở khoá quyền nhắn tin
        </CardTitle>
        <CardDescription>
          Cấp lại quyền gửi tin nhắn cho một thành viên trong nhóm (kể cả khi nhóm đang hạn chế toàn bộ).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1.2fr_1fr_auto] gap-2">
          <Input placeholder="Group ID (vd: -1001649798056)" value={unmuteGroupId} onChange={(e) => setUnmuteGroupId(e.target.value)} />
          <Input placeholder="username (không cần @)" value={unmuteUsername} onChange={(e) => setUnmuteUsername(e.target.value)} />
          <Input placeholder="user ID (tuỳ chọn)" value={unmuteUserId} onChange={(e) => setUnmuteUserId(e.target.value)} />
          <Button onClick={handleManualUnmute} disabled={unmuting}>
            {unmuting ? "Đang xử lý..." : "Mở khoá"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Nếu không nhập user ID, hệ thống sẽ tra theo username trong lịch sử kiểm duyệt.
        </p>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <VolumeX className="w-5 h-5 text-orange-500" />
              Danh sách User bị Mute
            </CardTitle>
            <CardDescription>
              {activeCount} user đang bị mute · Tổng {rows.length} bản ghi · Thời gian (UTC+8)
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowExpired((v) => !v)}>
              {showExpired ? "Ẩn đã hết hạn" : "Hiện đã hết hạn"}
            </Button>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
              Tải lại
            </Button>
          </div>
        </div>
        <div className="relative mt-3">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Tìm theo username, user ID hoặc group ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-center text-muted-foreground py-8">Đang tải...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Không có user nào bị mute.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>User ID</TableHead>
                  <TableHead>Group ID</TableHead>
                  <TableHead>Còn lại</TableHead>
                  <TableHead>Hết hạn lúc</TableHead>
                  <TableHead>Lý do</TableHead>
                  <TableHead>Bắt đầu</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((row) => {
                  const rem = remaining(row.muted_until, now);
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">
                        {row.tg_username ? `@${row.tg_username}` : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{row.tg_user_id}</TableCell>
                      <TableCell className="font-mono text-xs">{row.group_id}</TableCell>
                      <TableCell>
                        {rem.expired ? (
                          <Badge variant="outline">Hết hạn</Badge>
                        ) : (
                          <Badge variant="destructive">{rem.label}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">{formatMY(row.muted_until)}</TableCell>
                      <TableCell className="text-xs">{row.reason || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatMY(row.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleUnmute(row)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
    </div>
  );
}
