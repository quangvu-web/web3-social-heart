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

const PROVIDER_SERVICES = [
  { key: "ai.provider.caption", id: "caption", label: "Dịch phụ đề" },
  { key: "ai.provider.vision", id: "vision", label: "Đọc ảnh" },
  { key: "ai.provider.ocr", id: "ocr", label: "Quét chữ trong ảnh (OCR)" },
] as const;
type ProviderKey = typeof PROVIDER_SERVICES[number]["key"];
type ProviderService = typeof PROVIDER_SERVICES[number];
interface ProviderState { flag: FeatureFlag | null; ready: boolean; error: string | null; busy: boolean }
const RESERVED_PROVIDER_KEYS = new Set<string>(["ai.provider", ...PROVIDER_SERVICES.map(({ key }) => key)]);
const initialProviderStates = () => Object.fromEntries(PROVIDER_SERVICES.map(({ key }) => [key, {
  flag: null, ready: false, error: null, busy: false,
}])) as Record<ProviderKey, ProviderState>;
const initialRevisions = () => Object.fromEntries(PROVIDER_SERVICES.map(({ key }) => [key, 0])) as Record<ProviderKey, number>;

export default function AdminFeatureFlagsTab() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [providers, setProviders] = useState(initialProviderStates);
  const [flagsError, setFlagsError] = useState<string | null>(null);
  const providerRevisions = useRef(initialRevisions());
  const loadRequest = useRef(0);
  const providerSaving = useRef(new Set<ProviderKey>());
  const [newKey, setNewKey] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const load = useCallback(async () => {
    const request = ++loadRequest.current;
    const revisions = { ...providerRevisions.current };
    setLoading(true);
    const { data, error } = await supabase
      .from("angel_feature_flags")
      .select("*")
      .order("key", { ascending: true });
    if (request !== loadRequest.current) return;
    setLoading(false);
    if (error) {
      setFlagsError("Không tải được danh sách cờ. Hãy tải lại để kiểm tra.");
      setProviders((current) => {
        const next = { ...current };
        for (const { key } of PROVIDER_SERVICES) {
          if (revisions[key] === providerRevisions.current[key] && !providerSaving.current.has(key)) {
            next[key] = { ...current[key], ready: false, error: "Không tải được nhà cung cấp. Hãy tải lại để kiểm tra." };
          }
        }
        return next;
      });
      toast.error("Không tải được flags: " + error.message);
      return;
    }
    const loaded = (data ?? []) as FeatureFlag[];
    setFlags(loaded);
    setFlagsError(null);
    setProviders((current) => {
      const next = { ...current };
      for (const { key } of PROVIDER_SERVICES) {
        if (revisions[key] === providerRevisions.current[key] && !providerSaving.current.has(key)) {
          next[key] = { ...current[key], flag: loaded.find((flag) => flag.key === key) ?? null, ready: true, error: null };
        }
      }
      return next;
    });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const generalFlags = flags.filter((flag) => !RESERVED_PROVIDER_KEYS.has(flag.key));

  const toggleProvider = async (service: ProviderService, next: boolean) => {
    const { key, label } = service;
    const state = providers[key];
    if (providerSaving.current.has(key) || loading || !state.ready || state.error) return;
    providerSaving.current.add(key);
    providerRevisions.current[key] += 1;
    setProviders((current) => ({ ...current, [key]: { ...current[key], busy: true } }));
    const value = next ? "gemini" : "lovable";
    try {
      const { error: writeError } = await supabase.from("angel_feature_flags").upsert({
        key,
        enabled: true,
        meta: { value },
        description: state.flag?.description || `Nhà cung cấp AI cho ${label.toLowerCase()}.`,
      }, { onConflict: "key" });
      if (writeError) throw new Error(writeError.message);
      // Read this service separately; never use another row or an optimistic value.
      const { data, error: readError } = await supabase.from("angel_feature_flags")
        .select("key, enabled, meta, description, updated_at")
        .eq("key", key)
        .maybeSingle();
      if (readError) throw new Error(readError.message);
      if (!data || data.key !== key) throw new Error("Chưa đọc lại được lựa chọn đã lưu. Hãy tải lại để kiểm tra.");
      setProviders((current) => ({ ...current, [key]: { ...current[key], flag: data as FeatureFlag, ready: true, error: null } }));
      if (data.enabled === true && data.meta?.value === value) {
        toast.success(`Đã lưu nhà cung cấp AI cho ${label.toLowerCase()} (áp dụng trong ~60 giây).`);
      } else {
        toast.warning(`Lựa chọn cho ${label.toLowerCase()} đã thay đổi. Đã tải trạng thái hiện tại từ hệ thống.`);
      }
    } catch (error) {
      setProviders((current) => ({ ...current, [key]: { ...current[key], ready: false, error: "Chưa xác minh được lựa chọn hiện tại. Hãy tải lại để kiểm tra." } }));
      toast.error(`Không lưu/xác minh được nhà cung cấp cho ${label.toLowerCase()}: ` + (error instanceof Error ? error.message : "Lỗi kết nối."));
    } finally {
      providerRevisions.current[key] += 1;
      providerSaving.current.delete(key);
      setProviders((current) => ({ ...current, [key]: { ...current[key], busy: false } }));
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
    if (RESERVED_PROVIDER_KEYS.has(k)) {
      toast.error("Các cờ nhà cung cấp AI được quản lý trong thẻ Nhà cung cấp AI.");
      return;
    }
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
      <Card aria-busy={loading || PROVIDER_SERVICES.some(({ key }) => providers[key].busy)}>
        <CardHeader>
          <CardTitle>Nhà cung cấp AI</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {PROVIDER_SERVICES.map((service) => {
            const state = providers[service.key];
            const geminiEnabled = state.flag?.enabled === true && state.flag.meta?.value === "gemini";
            return (
              <div key={service.key} role="group" aria-label={service.label} className="space-y-2 rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label htmlFor={`ai-provider-${service.id}`} className="text-sm font-medium">{service.label}</label>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Lovable Gateway</span>
                    <Switch
                      id={`ai-provider-${service.id}`}
                      aria-label={`Dùng key Gemini riêng cho ${service.label.toLowerCase()}`}
                      checked={geminiEnabled}
                      onCheckedChange={(value) => void toggleProvider(service, value)}
                      disabled={loading || state.busy || !state.ready || !!state.error}
                    />
                    <span>Gemini riêng</span>
                    {state.busy && <Loader2 className="h-3 w-3 animate-spin" aria-label={`Đang lưu ${service.label.toLowerCase()}`} />}
                  </div>
                </div>
                <div role="status" aria-live="polite" className="space-y-1 text-sm">
                  {loading ? <p>Đang tải nhà cung cấp...</p> : state.error ? (
                    <p className="text-destructive">{state.error}</p>
                  ) : state.ready ? (
                    <>
                      <p>Đang dùng: {geminiEnabled ? "key Gemini riêng" : "Lovable Gateway"}</p>
                      {!state.flag && <p className="text-xs text-muted-foreground">Chưa có cấu hình dịch vụ; đang dùng Lovable Gateway.</p>}
                    </>
                  ) : <p>Đang tải nhà cung cấp...</p>}
                  {state.ready && !state.error && !loading && (
                    <p className="text-xs text-muted-foreground">
                      {state.flag?.updated_at
                        ? `Đổi gần nhất: ${new Date(state.flag.updated_at).toLocaleString("vi-VN", { timeZone: "Asia/Kuala_Lumpur" })}`
                        : "Chưa có lần đổi nhà cung cấp."}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>Mỗi dịch vụ có công tắc riêng; đổi một dịch vụ không ảnh hưởng dịch vụ khác.</p>
            <p>Chưa áp dụng cho chat, câu trả lời cho link YouTube và tóm tắt.</p>
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
          ) : flagsError ? (
            <div className="text-sm text-destructive">{flagsError}</div>
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
