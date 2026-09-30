import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Copy, KeyRound, RefreshCcw, ShieldAlert, Eye, EyeOff } from "lucide-react";

interface AppKeyRow {
  id: string;
  key_prefix: string;
  key_last4: string;
  status: "active" | "rotated" | "revoked";
  notes: string | null;
  created_by: string | null;
  created_at: string;
  rotated_at: string | null;
  revoked_at: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  rotated: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  revoked: "bg-rose-500/15 text-rose-700 border-rose-500/30",
};

function mask(prefix: string, last4: string) {
  return `${prefix}${"•".repeat(20)}${last4}`;
}

function formatTime(ts: string | null) {
  if (!ts) return "—";
  // Malaysia Time (UTC+8)
  return new Date(ts).toLocaleString("en-GB", {
    timeZone: "Asia/Kuala_Lumpur",
    hour12: false,
  });
}

export default function SecurityAppKeysTab() {
  const [keys, setKeys] = useState<AppKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [notes, setNotes] = useState("");
  const [confirmOpen, setConfirmOpen] = useState<null | "generate" | "rotate">(null);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [reveal, setReveal] = useState(false);

  const active = keys.find((k) => k.status === "active") ?? null;

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("admin-app-keys", {
      body: { action: "list" },
    });
    if (error) {
      toast.error(`Không tải được danh sách: ${error.message}`);
    } else {
      setKeys((data as { keys: AppKeyRow[] })?.keys ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const runAction = async (action: "generate" | "rotate") => {
    setWorking(true);
    const { data, error } = await supabase.functions.invoke("admin-app-keys", {
      body: { action, notes: notes || undefined },
    });
    setWorking(false);
    setConfirmOpen(null);
    setNotes("");
    if (error) {
      toast.error(error.message);
      return;
    }
    const key = (data as { key?: string }).key;
    if (key) {
      setGeneratedKey(key);
      setReveal(false);
      toast.success(action === "generate" ? "Đã tạo key mới" : "Đã xoay key");
      load();
    }
  };

  const revoke = async (id: string) => {
    if (!confirm("Thu hồi key này? Các service đang dùng sẽ ngừng hoạt động.")) return;
    const { error } = await supabase.functions.invoke("admin-app-keys", {
      body: { action: "revoke", id },
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Đã thu hồi");
      load();
    }
  };

  const copy = (value: string, label = "Đã copy") => {
    navigator.clipboard.writeText(value);
    toast.success(label);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Application API Key
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Key nội bộ duy nhất để các service tin cậy (Angel AI, Fun Hub Core, Telegram services,
            các microservice tương lai) gọi vào FUN Profile qua header{" "}
            <code className="rounded bg-muted px-1">Authorization: Bearer …</code>. Key chỉ tồn tại
            trong backend secrets — không bao giờ hiện ra frontend hay logs.
          </p>

          <div className="rounded-lg border bg-muted/40 p-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
              Key đang hoạt động
            </div>
            {active ? (
              <div className="flex flex-wrap items-center gap-3">
                <code className="font-mono text-sm">
                  {mask(active.key_prefix, active.key_last4)}
                </code>
                <Badge variant="outline" className={STATUS_COLORS[active.status]}>
                  {active.status}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Tạo lúc {formatTime(active.created_at)} (MYT)
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copy(active.key_prefix, "Đã copy prefix")}
                >
                  <Copy className="h-3.5 w-3.5 mr-1" /> Copy prefix
                </Button>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                Chưa có key. Bấm "Generate" để tạo key đầu tiên.
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => setConfirmOpen("generate")}
              disabled={!!active || working}
            >
              <KeyRound className="h-4 w-4 mr-2" /> Generate
            </Button>
            <Button
              variant="secondary"
              onClick={() => setConfirmOpen("rotate")}
              disabled={!active || working}
            >
              <RefreshCcw className="h-4 w-4 mr-2" /> Rotate
            </Button>
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-50/60 p-3 text-sm">
            <ShieldAlert className="h-4 w-4 mt-0.5 text-amber-700" />
            <div className="text-amber-900">
              Sau khi generate/rotate, copy plaintext key và dán vào secret{" "}
              <code className="rounded bg-amber-100 px-1">FUN_PROFILE_APP_KEY</code> trong Lovable
              Cloud → Settings → Secrets. Key sẽ KHÔNG hiện lại lần nào nữa.
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rotation history</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground">Đang tải…</div>
          ) : keys.length === 0 ? (
            <div className="text-sm text-muted-foreground">Chưa có lịch sử.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created (MYT)</TableHead>
                  <TableHead>Rotated</TableHead>
                  <TableHead>Revoked</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((k) => (
                  <TableRow key={k.id}>
                    <TableCell className="font-mono text-xs">
                      {mask(k.key_prefix, k.key_last4)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_COLORS[k.status]}>
                        {k.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{formatTime(k.created_at)}</TableCell>
                    <TableCell className="text-xs">{formatTime(k.rotated_at)}</TableCell>
                    <TableCell className="text-xs">{formatTime(k.revoked_at)}</TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate">
                      {k.notes ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {k.status !== "revoked" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-rose-700 hover:text-rose-800"
                          onClick={() => revoke(k.id)}
                        >
                          Revoke
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Confirm generate/rotate */}
      <Dialog
        open={confirmOpen !== null}
        onOpenChange={(o) => !o && setConfirmOpen(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmOpen === "rotate" ? "Rotate Application Key" : "Generate Application Key"}
            </DialogTitle>
            <DialogDescription>
              {confirmOpen === "rotate"
                ? "Key cũ sẽ chuyển sang trạng thái rotated. Hãy update FUN_PROFILE_APP_KEY và secrets của các caller service trước khi revoke."
                : "Tạo key mới cho FUN Profile. Plaintext chỉ hiện 1 lần."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="notes">Ghi chú (tuỳ chọn)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="VD: rotate sau khi rotate Angel AI token"
              maxLength={500}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(null)} disabled={working}>
              Huỷ
            </Button>
            <Button
              onClick={() => confirmOpen && runAction(confirmOpen)}
              disabled={working}
            >
              {working ? "Đang xử lý…" : "Xác nhận"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* One-time plaintext reveal */}
      <Dialog
        open={!!generatedKey}
        onOpenChange={(o) => {
          if (!o) {
            setGeneratedKey(null);
            setReveal(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Key mới — copy ngay!</DialogTitle>
            <DialogDescription>
              Đây là lần duy nhất plaintext key được hiển thị. Dán vào secret{" "}
              <code>FUN_PROFILE_APP_KEY</code> và secrets của các caller service.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border bg-muted/50 p-3 font-mono text-xs break-all">
            {reveal ? generatedKey : "•".repeat(generatedKey?.length ?? 0)}
          </div>
          <DialogFooter className="flex-row justify-between sm:justify-between">
            <Button variant="outline" onClick={() => setReveal((v) => !v)}>
              {reveal ? (
                <>
                  <EyeOff className="h-4 w-4 mr-1" /> Ẩn
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-1" /> Hiện
                </>
              )}
            </Button>
            <div className="flex gap-2">
              <Button
                onClick={() => generatedKey && copy(generatedKey, "Đã copy key")}
              >
                <Copy className="h-4 w-4 mr-1" /> Copy
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setGeneratedKey(null);
                  setReveal(false);
                }}
              >
                Đóng
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
