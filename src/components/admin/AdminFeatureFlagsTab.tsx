import { useCallback, useEffect, useRef, useState } from "react";
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
  const [loading, setLoading] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [providerFlag, setProviderFlag] = useState<FeatureFlag | null>(null);
  const [providerReady, setProviderReady] = useState(false);
  const [providerError, setProviderError] = useState<string | null>(null);
  const [providerBusy, setProviderBusy] = useState(false);
  const providerRevision = useRef(0);
  const loadRequest = useRef(0);
  const providerSaving = useRef(false);
  const [newKey, setNewKey] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const load = useCallback(async () => {
    const request = ++loadRequest.current;
    const revision = providerRevision.current;
    setLoading(true);
    const { data, error } = await supabase
      .from("angel_feature_flags")
      .select("*")
      .order("key", { ascending: true });
    if (request !== loadRequest.current) return;
    setLoading(false);
    if (error) {
      if (revision === providerRevision.current && !providerSaving.current) {
        setProviderReady(false);
        setProviderError("Không tải được nhà cung cấp. Hãy tải lại để kiểm tra.");
      }
      toast.error("Không tải được flags: " + error.message);
      return;
    }
    const loaded = (data ?? []) as FeatureFlag[];
    setFlags(loaded);
    if (revision === providerRevision.current && !providerSaving.current) {
      setProviderFlag(loaded.find((flag) => flag.key === "ai.provider") ?? null);
      setProviderReady(true);
      setProviderError(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const geminiEnabled = providerFlag?.enabled === true && providerFlag.meta?.value === "gemini";
  const generalFlags = flags.filter((flag) => flag.key !== "ai.provider");

  const toggleProvider = async (next: boolean) => {
    if (providerSaving.current || loading || !providerReady || providerError) return;
    providerSaving.current = true;
    providerRevision.current += 1;
    setProviderBusy(true);
    const value = next ? "gemini" : "lovable";
    try {
      const { error: writeError } = await supabase.from("angel_feature_flags").upsert({
        key: "ai.provider",
        enabled: true,
        meta: { value },
        description: providerFlag?.description || "Chọn nhà cung cấp AI cho dịch phụ đề, đọc ảnh và OCR.",
      }, { onConflict: "key" });
      if (writeError) throw new Error(writeError.message);
      // Read separately: show the current DB value, including concurrent changes.
      const { data, error: readError } = await supabase.from("angel_feature_flags")
        .select("key, enabled, meta, description, updated_at")
        .eq("key", "ai.provider")
        .maybeSingle();
      if (readError) throw new Error(readError.message);
      if (!data) throw new Error("Chưa đọc lại được lựa chọn đã lưu. Hãy tải lại để kiểm tra.");
      setProviderFlag(data as FeatureFlag);
      setProviderReady(true);
      setProviderError(null);
      if (data.enabled === true && data.meta?.value === value) {
        toast.success("Đã lưu nhà cung cấp AI (áp dụng trong ~60 giây).");
      } else {
        toast.warning("Lựa chọn đã thay đổi. Đã tải trạng thái hiện tại từ hệ thống.");
      }
    } catch (error) {
      setProviderReady(false);
      setProviderError("Chưa xác minh được lựa chọn hiện tại. Hãy tải lại để kiểm tra.");
      toast.error("Không lưu/xác minh được nhà cung cấp: " + (error instanceof Error ? error.message : "Lỗi kết nối."));
    } finally {
      providerRevision.current += 1;
      providerSaving.current = false;
      setProviderBusy(false);
    }
  };

  const toggle = async (flag: FeatureFlag, next: boolean) => {
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
      <Card aria-busy={loading || providerBusy}>
        <CardHeader>
          <CardTitle>Nhà cung cấp AI</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label htmlFor="caption-ai-provider" className="text-sm font-medium">
              Dùng key Gemini riêng
            </label>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Lovable Gateway</span>
              <Switch
                id="caption-ai-provider"
                aria-label="Dùng key Gemini riêng"
                checked={geminiEnabled}
                onCheckedChange={(value) => void toggleProvider(value)}
                disabled={loading || providerBusy || !providerReady || !!providerError}
              />
              <span>Gemini riêng</span>
              {providerBusy && <Loader2 className="h-3 w-3 animate-spin" aria-label="Đang lưu" />}
            </div>
          </div>
          <div role="status" aria-live="polite" className="space-y-1 text-sm">
            {loading ? <p>Đang tải nhà cung cấp...</p> : providerError ? (
              <p className="text-destructive">{providerError}</p>
            ) : providerReady ? (
              <p>Đang dùng: {geminiEnabled ? "key Gemini riêng" : "Lovable Gateway"}</p>
            ) : <p>Đang tải nhà cung cấp...</p>}
            {providerReady && !providerError && !loading && (
              <p className="text-xs text-muted-foreground">
                {providerFlag?.updated_at
                  ? `Đổi gần nhất: ${new Date(providerFlag.updated_at).toLocaleString("vi-VN", { timeZone: "Asia/Kuala_Lumpur" })}`
                  : "Chưa có lần đổi nhà cung cấp."}
              </p>
            )}
          </div>
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>Áp dụng cho: dịch phụ đề, đọc ảnh và quét chữ trong ảnh (OCR).</p>
            <p>Công tắc này chưa áp dụng cho chat, câu trả lời cho link YouTube và tóm tắt.</p>
            <p>Đổi cờ có hiệu lực trong ~60 giây (cache của edge function).</p>
            <p>Khi dùng key riêng, các lần gọi AI trực tiếp sẽ không hiện trong bảng AI activity của Lovable — đó là đúng; nếu đường key riêng lỗi, hệ thống tự về Lovable cho lần gọi đó.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flag className="h-4 w-4" /> Feature Flags (Sprint 4)
            <Button size="sm" variant="ghost" onClick={() => void load()} className="ml-auto">
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
          ) : generalFlags.length === 0 ? (
            <div className="text-sm text-muted-foreground">Chưa có flag nào.</div>
          ) : (
            <div className="space-y-2">
              {generalFlags.map((f) => (
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
                      disabled={busyKey === f.key}
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
          <Button size="sm" onClick={createFlag} disabled={!newKey.trim()}>
            <Plus className="h-4 w-4 mr-1" /> Tạo (mặc định TẮT)
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
