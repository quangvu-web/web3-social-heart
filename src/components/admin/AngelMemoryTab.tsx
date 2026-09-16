import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Loader2, Trash2, Save, Search, RefreshCw } from "lucide-react";
import { toast } from "sonner";

type Settings = {
  enabled_web: boolean;
  enabled_telegram_dm: boolean;
  enabled_group: boolean;
  enabled_inline: boolean;
  rolling_summary_dm: boolean;
  rolling_summary_group: boolean;
  rolling_summary_web: boolean;
  rolling_summary_turn_threshold: number;
  rolling_summary_keep_recent: number;
};


type Fact = { fact: string; created_at: string; confidence?: number };

type MemoryRow = {
  id: string;
  channel: "web" | "telegram" | "group" | "inline";
  user_key: string;
  display_name: string | null;
  facts: Fact[];
  turn_count: number;
  last_seen_at: string;
  updated_at: string;
};

const CHANNEL_LABEL: Record<MemoryRow["channel"], string> = {
  web: "Web",
  telegram: "Telegram DM",
  group: "Nhóm TG",
  inline: "Inline",
};

export default function AngelMemoryTab() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [rows, setRows] = useState<MemoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");

  async function loadSettings() {
    const { data, error } = await supabase
      .from("angel_memory_settings")
      .select("enabled_web,enabled_telegram_dm,enabled_group,enabled_inline,rolling_summary_dm,rolling_summary_group,rolling_summary_web,rolling_summary_turn_threshold,rolling_summary_keep_recent")
      .eq("id", 1)
      .maybeSingle();
    if (error) {
      toast.error("Không đọc được cấu hình: " + error.message);
      return;
    }
    const defaults: Settings = {
      enabled_web: true,
      enabled_telegram_dm: true,
      enabled_group: false,
      enabled_inline: false,
      rolling_summary_dm: false,
      rolling_summary_group: false,
      rolling_summary_web: false,
      rolling_summary_turn_threshold: 20,
      rolling_summary_keep_recent: 6,
    };
    setSettings({ ...defaults, ...(data ?? {}) });
  }


  async function loadRows() {
    setLoading(true);
    let query = supabase
      .from("angel_user_memory")
      .select("id, channel, user_key, display_name, facts, turn_count, last_seen_at, updated_at")
      .order("updated_at", { ascending: false })
      .limit(200);
    if (q.trim()) {
      query = query.or(
        `display_name.ilike.%${q.trim()}%,user_key.ilike.%${q.trim()}%`,
      );
    }
    const { data, error } = await query;
    setLoading(false);
    if (error) {
      toast.error("Không tải được danh sách: " + error.message);
      return;
    }
    setRows((data ?? []) as MemoryRow[]);
  }

  useEffect(() => {
    loadSettings();
    loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveSettings() {
    if (!settings) return;
    setSavingSettings(true);
    const { error } = await supabase
      .from("angel_memory_settings")
      .update(settings)
      .eq("id", 1);
    setSavingSettings(false);
    if (error) {
      toast.error("Lưu thất bại: " + error.message);
      return;
    }
    toast.success("Đã lưu cấu hình trí nhớ ✨");
  }

  async function deleteRow(id: string) {
    if (!confirm("Xoá toàn bộ trí nhớ của bé này?")) return;
    const { error } = await supabase.from("angel_user_memory").delete().eq("id", id);
    if (error) {
      toast.error("Xoá thất bại: " + error.message);
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
    toast.success("Đã xoá 💛");
  }

  async function deleteFact(row: MemoryRow, factIdx: number) {
    const newFacts = row.facts.filter((_, i) => i !== factIdx);
    const { error } = await supabase
      .from("angel_user_memory")
      .update({ facts: newFacts })
      .eq("id", row.id);
    if (error) {
      toast.error("Xoá fact thất bại: " + error.message);
      return;
    }
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, facts: newFacts } : r)));
  }

  return (
    <div className="space-y-6">
      {/* Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Cấu hình trí nhớ Angel AI theo kênh</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!settings ? (
            <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Đang tải...</div>
          ) : (
            <>
              {(
                [
                  ["enabled_web", "Web (Angel AI chat)"] as const,
                  ["enabled_telegram_dm", "Telegram DM (chat riêng)"] as const,
                  ["enabled_group", "Nhóm Telegram (group)"] as const,
                  ["enabled_inline", "Inline (@angel trong group)"] as const,
                ]
              ).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between gap-4 py-2 border-b last:border-b-0">
                  <Label htmlFor={key} className="flex-1">{label}</Label>
                  <Switch
                    id={key}
                    checked={settings[key]}
                    onCheckedChange={(v) => setSettings({ ...settings, [key]: v })}
                  />
                </div>
              ))}
              <div className="pt-4 mt-2 border-t space-y-3">
                <div className="text-sm font-semibold">Rolling Summary (nén hội thoại dài)</div>
                {(
                  [
                    ["rolling_summary_web", "Web"] as const,
                    ["rolling_summary_dm", "Telegram DM"] as const,
                    ["rolling_summary_group", "Telegram Group"] as const,
                  ]
                ).map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between gap-4 py-1">
                    <Label htmlFor={key} className="flex-1">{label}</Label>
                    <Switch
                      id={key}
                      checked={settings[key]}
                      onCheckedChange={(v) => setSettings({ ...settings, [key]: v })}
                    />
                  </div>
                ))}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <Label htmlFor="turnThreshold" className="text-xs">Ngưỡng số turn để nén</Label>
                    <Input
                      id="turnThreshold"
                      type="number"
                      min={6}
                      max={100}
                      value={settings.rolling_summary_turn_threshold}
                      onChange={(e) => setSettings({ ...settings, rolling_summary_turn_threshold: Number(e.target.value) || 20 })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="keepRecent" className="text-xs">Giữ N turn gần nhất nguyên bản</Label>
                    <Input
                      id="keepRecent"
                      type="number"
                      min={2}
                      max={20}
                      value={settings.rolling_summary_keep_recent}
                      onChange={(e) => setSettings({ ...settings, rolling_summary_keep_recent: Number(e.target.value) || 6 })}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Khi hội thoại vượt ngưỡng, các turn cũ nhất được nén thành 1 khối tóm tắt (~200-400 tokens), giữ nguyên N turn gần nhất.
                </p>
              </div>
              <Button onClick={saveSettings} disabled={savingSettings} className="mt-2">
                {savingSettings ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Lưu cấu hình
              </Button>
              <p className="text-xs text-muted-foreground">
                Trí nhớ được lưu qua từng lần chat, giúp Angel nhận diện bé qua nhiều thiết bị. Bé có thể dùng <code>/memory</code>, <code>/remember</code>, <code>/forget &lt;số&gt;</code>, <code>/forgetall</code> trong DM Telegram.
              </p>

            </>
          )}
        </CardContent>
      </Card>

      {/* Search + list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-3">
            <span>Danh sách trí nhớ theo user</span>
            <div className="flex gap-2 items-center">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && loadRows()}
                  placeholder="Tìm theo tên/user_key"
                  className="pl-8 w-64"
                />
              </div>
              <Button variant="outline" size="sm" onClick={loadRows} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {rows.length === 0 && !loading && (
            <p className="text-sm text-muted-foreground">Chưa có bé nào có trí nhớ.</p>
          )}
          {rows.map((r) => (
            <div key={r.id} className="border rounded-lg p-3 space-y-2 bg-card">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">
                    {r.display_name || r.user_key}
                    <span className="ml-2 text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                      {CHANNEL_LABEL[r.channel]}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    key: {r.user_key} · turns: {r.turn_count} · updated: {new Date(r.updated_at).toLocaleString("vi-VN", { timeZone: "Asia/Kuala_Lumpur" })}
                  </div>
                </div>
                <Button
                  variant="ghost" size="sm"
                  onClick={() => deleteRow(r.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-1" /> Xoá hết
                </Button>
              </div>
              {r.facts.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">(chưa có fact nào)</p>
              ) : (
                <ul className="space-y-1">
                  {r.facts.map((f, i) => (
                    <li key={i} className="flex items-start justify-between gap-2 text-sm bg-muted/40 rounded px-2 py-1">
                      <span className="flex-1">{f.fact}</span>
                      <button
                        onClick={() => deleteFact(r, i)}
                        className="text-muted-foreground hover:text-destructive shrink-0"
                        aria-label="Xoá fact"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
