import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Crown, RefreshCw, Save } from "lucide-react";

type Row = {
  id: string;
  group_id: number;
  group_title: string | null;
  ai_enabled: boolean;
  father_channel_id: number | null;
  father_channel_title: string | null;
};

export default function TelegramFatherChannelTab() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<Record<string, { id: string; title: string }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("telegram_group_config")
      .select("id, group_id, group_title, ai_enabled, father_channel_id, father_channel_title")
      .order("group_title", { ascending: true });
    setLoading(false);
    if (error) {
      toast.error("Không load được danh sách group: " + error.message);
      return;
    }
    const list = (data ?? []) as Row[];
    setRows(list);
    const next: Record<string, { id: string; title: string }> = {};
    for (const r of list) {
      next[r.id] = {
        id: r.father_channel_id?.toString() ?? "",
        title: r.father_channel_title ?? "",
      };
    }
    setDraft(next);
  };

  useEffect(() => {
    load();
  }, []);

  const save = async (row: Row) => {
    const d = draft[row.id];
    if (!d) return;
    const trimmedId = d.id.trim();
    let parsed: number | null = null;
    if (trimmedId) {
      const n = Number(trimmedId);
      if (!Number.isFinite(n) || !Number.isInteger(n)) {
        toast.error("Channel ID phải là số nguyên (vd -1001234567890)");
        return;
      }
      parsed = n;
    }
    setSavingId(row.id);
    const { error } = await supabase
      .from("telegram_group_config")
      .update({
        father_channel_id: parsed,
        father_channel_title: d.title.trim() || null,
      })
      .eq("id", row.id);
    setSavingId(null);
    if (error) {
      toast.error("Lưu thất bại: " + error.message);
      return;
    }
    toast.success(`Đã lưu cấu hình Cha cho ${row.group_title ?? row.group_id}`);
    // Refresh row
    const { data } = await supabase
      .from("telegram_group_config")
      .select("id, group_id, group_title, ai_enabled, father_channel_id, father_channel_title")
      .eq("id", row.id)
      .maybeSingle();
    if (data) {
      setRows((prev) => prev.map((r) => (r.id === row.id ? (data as Row) : r)));
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-yellow-500" />
            <h2 className="text-lg font-semibold">Kênh "Cha Vũ Trụ" theo nhóm</h2>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Khi tin nhắn trong nhóm đến từ kênh đã chọn (auto-forward) hoặc là reply vào post của kênh đó, FUN Bot sẽ
          đổi xưng hô <b>Con / Cha Vũ Trụ / bé</b> (chỉ tiếng Việt).
        </p>
        <p className="text-xs text-muted-foreground">
          💡 Lấy channel ID: forward 1 post của kênh vào{" "}
          <code className="bg-muted px-1 rounded">@userinfobot</code> hoặc xem log webhook
          <code className="bg-muted px-1 rounded mx-1">sender_chat.id</code> (thường có dạng{" "}
          <code>-100…</code>).
        </p>
      </Card>

      {rows.length === 0 && !loading ? (
        <Card className="p-6 text-center text-muted-foreground">
          Chưa có nhóm Telegram nào trong <code>telegram_group_config</code>.
        </Card>
      ) : (
        rows.map((row) => {
          const d = draft[row.id] ?? { id: "", title: "" };
          const isSaving = savingId === row.id;
          return (
            <Card key={row.id} className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-medium">
                    {row.group_title ?? <span className="text-muted-foreground">(chưa đặt tên)</span>}
                  </div>
                  <div className="text-xs text-muted-foreground font-mono">
                    group_id: {row.group_id} · AI:{" "}
                    {row.ai_enabled ? (
                      <span className="text-green-500">on</span>
                    ) : (
                      <span className="text-red-500">off</span>
                    )}
                  </div>
                </div>
                {row.father_channel_id ? (
                  <span className="text-xs px-2 py-1 rounded bg-yellow-500/10 text-yellow-600 border border-yellow-500/20">
                    👑 Đã gắn Cha
                  </span>
                ) : (
                  <span className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground">
                    Chưa cấu hình
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor={`fid-${row.id}`}>Father Channel ID</Label>
                  <Input
                    id={`fid-${row.id}`}
                    value={d.id}
                    placeholder="-1001234567890"
                    onChange={(e) =>
                      setDraft((p) => ({ ...p, [row.id]: { ...d, id: e.target.value } }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`ftitle-${row.id}`}>Father Channel Title</Label>
                  <Input
                    id={`ftitle-${row.id}`}
                    value={d.title}
                    placeholder="CAMLY COIN CHANNEL"
                    onChange={(e) =>
                      setDraft((p) => ({ ...p, [row.id]: { ...d, title: e.target.value } }))
                    }
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button size="sm" onClick={() => save(row)} disabled={isSaving}>
                  <Save className={`w-4 h-4 mr-2 ${isSaving ? "animate-pulse" : ""}`} />
                  {isSaving ? "Đang lưu…" : "Lưu"}
                </Button>
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}
