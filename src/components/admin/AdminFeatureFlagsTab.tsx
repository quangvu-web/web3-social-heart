import { useCallback, useEffect, useState } from "react";
import { supabase as supabaseTyped } from "@/integrations/supabase/client";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = supabaseTyped as any;
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Flag, RefreshCw, Plus } from "lucide-react";
import { canMutateVerifiedAdminData, getAdminLoadState } from "@/lib/adminLoadState";

/**
 * Sprint 4 — Admin UI cho `angel_feature_flags`.
 * Bật/tắt runtime các cờ mà edge function đọc qua `getFlag()`.
 * Cache flag ở edge function là 60s, nên toggle ở đây có thể mất ~1 phút mới áp dụng.
 */

interface FeatureFlag {
  key: string;
  enabled: boolean;
  description: string | null;
  meta: Record<string, unknown> | null;
  updated_at: string;
}

export default function AdminFeatureFlagsTab() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [newKey, setNewKey] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const loadState = getAdminLoadState({ loading, error: loadError, loaded, hasRows: flags.length > 0 });
  const canManageFlags = canMutateVerifiedAdminData(loadState) && !loading && !busyKey;

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    const { data, error } = await supabase
      .from("angel_feature_flags")
      .select("*")
      .order("key", { ascending: true });
    setLoading(false);
    if (error) {
      setLoadError(true);
      toast.error("Không tải được flags: " + error.message);
      return;
    }
    setFlags((data ?? []) as FeatureFlag[]);
    setLoaded(true);
    setLoadError(false);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async (flag: FeatureFlag, next: boolean) => {
    if (!canManageFlags) return;
    setBusyKey(flag.key);
    const { error } = await supabase
      .from("angel_feature_flags")
      .update({ enabled: next })
      .eq("key", flag.key);
    setBusyKey(null);
    if (error) {
      toast.error(`Không update được ${flag.key}: ${error.message}`);
      return;
    }
    toast.success(`${flag.key} → ${next ? "BẬT" : "TẮT"} (áp dụng trong ~60s)`);
    setFlags((prev) => prev.map((f) => (f.key === flag.key ? { ...f, enabled: next } : f)));
  };

  const createFlag = async () => {
    if (!canManageFlags) return;
    const k = newKey.trim();
    if (!k) return;
    const { error } = await supabase.from("angel_feature_flags").insert({
      key: k,
      enabled: false,
      description: newDesc.trim() || null,
    });
    if (error) {
      toast.error("Tạo flag thất bại: " + error.message);
      return;
    }
    toast.success(`Đã tạo ${k}`);
    setNewKey("");
    setNewDesc("");
    void load();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flag className="h-4 w-4" /> Feature Flags (Sprint 4)
            <Button size="sm" variant="ghost" onClick={() => void load()} disabled={loading} className="ml-auto">
              <RefreshCw className="h-3 w-3 mr-1" /> Reload
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Bật/tắt các cờ runtime. Edge function cache 60s, nên toggle sẽ áp dụng sau ~1 phút.
          </p>

          {loading ? (
            <div className="flex items-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Đang tải...
            </div>
          ) : loadError ? (
            <div className="flex flex-wrap items-center gap-2 text-sm text-destructive">Không tải được cấu hình; danh sách trống chưa được xác nhận.<Button size="sm" variant="outline" onClick={() => void load()}>Thử lại</Button></div>
          ) : flags.length === 0 ? (
            <div className="text-sm text-muted-foreground">Chưa có flag nào.</div>
          ) : (
            <div className="space-y-2">
              {flags.map((f) => (
                <div
                  key={f.key}
                  className="flex items-start justify-between gap-3 rounded border p-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="text-sm font-mono">{f.key}</code>
                      <Badge variant={f.enabled ? "default" : "outline"}>
                        {f.enabled ? "ON" : "OFF"}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(f.updated_at).toLocaleString("vi-VN", {
                          timeZone: "Asia/Kuala_Lumpur",
                        })}
                      </span>
                    </div>
                    {f.description && (
                      <p className="text-xs text-muted-foreground mt-1">{f.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {busyKey === f.key && <Loader2 className="h-3 w-3 animate-spin" />}
                    <Switch
                      checked={f.enabled}
                      onCheckedChange={(v) => toggle(f, v)}
                      disabled={!canManageFlags || busyKey === f.key}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Plus className="h-4 w-4" /> Tạo flag mới
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Input
            placeholder="key (vd: postprocess.style_pass)"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
          />
          <Input
            placeholder="mô tả ngắn"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
          />
          {loadError && <p role="status" className="text-sm text-destructive">Tải lại thành công trước khi tạo flag hoặc thay đổi giá trị.</p>}
          <Button size="sm" onClick={createFlag} disabled={!canManageFlags || !newKey.trim()}>
            <Plus className="h-4 w-4 mr-1" /> Tạo (mặc định TẮT)
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
