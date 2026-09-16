import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase as supabaseTyped } from "@/integrations/supabase/client";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = supabaseTyped as any;
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Activity, RefreshCw, AlertTriangle } from "lucide-react";
import IngestHealthCard from "./IngestHealthCard";


/**
 * Sprint 4 — AI Ops dashboard: đọc `angel_ai_events` (fill bởi `trackAi()` /
 * `logAiEvent()` ở edge functions). Không cần chart lib — dùng bảng gọn nhẹ.
 */

interface AiEvent {
  id: string;
  ts: string;
  channel: string;
  intent: string;
  tier: string | null;
  model: string | null;
  user_ref: string | null;
  duration_ms: number;
  ok: boolean;
  error: string | null;
}

type Bucket = { key: string; total: number; ok: number; err: number; avgMs: number };

const RANGES = [
  { label: "1h", ms: 60 * 60 * 1000 },
  { label: "24h", ms: 24 * 60 * 60 * 1000 },
  { label: "7d", ms: 7 * 24 * 60 * 60 * 1000 },
];

function groupBy(events: AiEvent[], keyFn: (e: AiEvent) => string): Bucket[] {
  const map = new Map<string, { total: number; ok: number; err: number; sumMs: number }>();
  for (const e of events) {
    const k = keyFn(e) || "(none)";
    const row = map.get(k) ?? { total: 0, ok: 0, err: 0, sumMs: 0 };
    row.total += 1;
    if (e.ok) row.ok += 1;
    else row.err += 1;
    row.sumMs += e.duration_ms || 0;
    map.set(k, row);
  }
  return [...map.entries()]
    .map(([key, v]) => ({
      key,
      total: v.total,
      ok: v.ok,
      err: v.err,
      avgMs: v.total ? Math.round(v.sumMs / v.total) : 0,
    }))
    .sort((a, b) => b.total - a.total);
}

function BucketTable({ title, rows }: { title: string; rows: Bucket[] }) {
  if (!rows.length) return null;
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground mb-1">{title}</div>
      <div className="rounded border overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left p-2">Key</th>
              <th className="text-right p-2">Total</th>
              <th className="text-right p-2">OK</th>
              <th className="text-right p-2">Err</th>
              <th className="text-right p-2">Avg (ms)</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 15).map((r) => {
              const errPct = r.total ? Math.round((r.err / r.total) * 100) : 0;
              return (
                <tr key={r.key} className="border-t">
                  <td className="p-2 font-mono">{r.key}</td>
                  <td className="text-right p-2">{r.total}</td>
                  <td className="text-right p-2 text-emerald-600">{r.ok}</td>
                  <td className={`text-right p-2 ${r.err ? "text-red-600" : ""}`}>
                    {r.err}
                    {r.err > 0 && <span className="text-muted-foreground ml-1">({errPct}%)</span>}
                  </td>
                  <td className="text-right p-2">{r.avgMs}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AdminAiOpsTab() {
  const [rangeMs, setRangeMs] = useState(RANGES[1].ms);
  const [events, setEvents] = useState<AiEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const sinceIso = new Date(Date.now() - rangeMs).toISOString();
    const { data, error } = await supabase
      .from("angel_ai_events")
      .select("id, ts, channel, intent, tier, model, user_ref, duration_ms, ok, error")
      .gte("ts", sinceIso)
      .order("ts", { ascending: false })
      .limit(2000);
    setLoading(false);
    if (error) {
      console.error("[ai-ops] load error", error);
      return;
    }
    setEvents((data ?? []) as AiEvent[]);
  }, [rangeMs]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(() => {
    const total = events.length;
    const ok = events.filter((e) => e.ok).length;
    const err = total - ok;
    const okPct = total ? Math.round((ok / total) * 100) : 0;
    const avgMs = total
      ? Math.round(events.reduce((s, e) => s + (e.duration_ms || 0), 0) / total)
      : 0;
    return { total, ok, err, okPct, avgMs };
  }, [events]);

  const byIntent = useMemo(() => groupBy(events, (e) => e.intent), [events]);
  const byModel = useMemo(() => groupBy(events, (e) => e.model || "(none)"), [events]);
  const byChannel = useMemo(() => groupBy(events, (e) => e.channel), [events]);
  const byTier = useMemo(() => groupBy(events, (e) => e.tier || "primary"), [events]);
  const recentErrors = useMemo(
    () => events.filter((e) => !e.ok).slice(0, 20),
    [events],
  );

  return (
    <div className="space-y-4">
      <QuotaCard />
      <IngestHealthCard />



      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-4 w-4" /> AI Ops Dashboard (Sprint 4)
            <div className="ml-auto flex items-center gap-1">
              {RANGES.map((r) => (
                <Button
                  key={r.label}
                  size="sm"
                  variant={rangeMs === r.ms ? "default" : "outline"}
                  onClick={() => setRangeMs(r.ms)}
                >
                  {r.label}
                </Button>
              ))}
              <Button size="sm" variant="ghost" onClick={() => void load()}>
                <RefreshCw className="h-3 w-3" />
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Đang tải...
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat label="Tổng call" value={summary.total.toString()} />
              <Stat
                label="Success rate"
                value={`${summary.okPct}%`}
                tone={summary.okPct >= 95 ? "ok" : summary.okPct >= 80 ? "warn" : "err"}
              />
              <Stat label="Lỗi" value={summary.err.toString()} tone={summary.err ? "err" : "ok"} />
              <Stat label="Avg latency" value={`${summary.avgMs} ms`} />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Theo Intent</CardTitle></CardHeader>
          <CardContent><BucketTable title="" rows={byIntent} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Theo Model</CardTitle></CardHeader>
          <CardContent><BucketTable title="" rows={byModel} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Theo Channel</CardTitle></CardHeader>
          <CardContent><BucketTable title="" rows={byChannel} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Theo Tier</CardTitle></CardHeader>
          <CardContent><BucketTable title="" rows={byTier} /></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500" /> Lỗi gần nhất
            <Badge variant="outline" className="ml-2">{recentErrors.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentErrors.length === 0 ? (
            <div className="text-xs text-muted-foreground">Không có lỗi trong khoảng thời gian đã chọn 💛</div>
          ) : (
            <div className="space-y-1">
              {recentErrors.map((e) => (
                <div key={e.id} className="text-xs rounded border border-red-200/60 bg-red-50/40 p-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline">{e.channel}</Badge>
                    <code className="font-mono">{e.intent}</code>
                    {e.tier && <Badge variant="secondary">{e.tier}</Badge>}
                    {e.model && <span className="text-muted-foreground">{e.model}</span>}
                    <span className="ml-auto text-muted-foreground">
                      {new Date(e.ts).toLocaleString("vi-VN", { timeZone: "Asia/Kuala_Lumpur" })}
                      · {e.duration_ms}ms
                    </span>
                  </div>
                  {e.error && (
                    <div className="mt-1 text-red-700 whitespace-pre-wrap break-words">
                      {e.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "ok" | "warn" | "err";
}) {
  const color =
    tone === "err" ? "text-red-600" :
    tone === "warn" ? "text-amber-600" :
    tone === "ok" ? "text-emerald-600" : "text-foreground";
  return (
    <div className="rounded border p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-xl font-semibold mt-1 ${color}`}>{value}</div>
    </div>
  );
}

// ─── Quota card ─────────────────────────────────────────────────────────────
interface QuotaRow {
  ok: boolean;
  missing?: boolean;
  key_name?: string | null;
  daily_limit?: number | null;
  image_daily_limit?: number | null;
  today_usage?: number | null;
  today_image_usage?: number | null;
  status?: number;
  duration_ms?: number;
  error?: string;
  fallback_to_chat?: boolean;
}
interface QuotaResp { chat?: QuotaRow; image?: QuotaRow; base?: string; ts?: number }

function QuotaCard() {
  const [data, setData] = useState<QuotaResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const { data, error } = await supabase.functions.invoke("angel-quota-status", { body: {} });
      if (error) throw error;
      setData(data as QuotaResp);
    } catch (e: any) {
      setErr(e?.message ?? "load_failed");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const renderRow = (label: string, r: QuotaRow | undefined) => {
    if (!r) return null;
    if (r.missing) {
      return (
        <div className="rounded border p-3 text-xs">
          <div className="font-medium">{label}</div>
          <div className="text-muted-foreground mt-1">
            {r.fallback_to_chat ? "Chưa cấu hình ANGEL_AI_API_KEY_IMAGE — đang dùng chung key chat." : "Chưa cấu hình key."}
          </div>
        </div>
      );
    }
    const chatUsed = r.today_usage ?? 0;
    const chatLimit = r.daily_limit ?? 0;
    const imgUsed = r.today_image_usage ?? 0;
    const imgLimit = r.image_daily_limit ?? 0;
    const chatPct = chatLimit ? Math.round((chatUsed / chatLimit) * 100) : 0;
    const imgPct = imgLimit ? Math.round((imgUsed / imgLimit) * 100) : 0;
    return (
      <div className={`rounded border p-3 text-xs ${r.ok ? "" : "border-red-300 bg-red-50/40"}`}>
        <div className="flex items-center gap-2">
          <span className="font-medium">{label}</span>
          {r.key_name && <Badge variant="outline">{r.key_name}</Badge>}
          <span className={`ml-auto ${r.ok ? "text-emerald-600" : "text-red-600"}`}>
            {r.ok ? "OK" : `Lỗi ${r.status ?? ""}`} · {r.duration_ms}ms
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <div>
            <div className="text-muted-foreground">Chat</div>
            <div className="font-mono">{chatUsed}/{chatLimit || "∞"} <span className="text-muted-foreground">({chatPct}%)</span></div>
          </div>
          <div>
            <div className="text-muted-foreground">Image</div>
            <div className="font-mono">{imgUsed}/{imgLimit || "∞"} <span className="text-muted-foreground">({imgPct}%)</span></div>
          </div>
        </div>
        {r.error && <div className="mt-1 text-red-700">{r.error}</div>}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          Quota Angel gốc
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => void load()}>
            <RefreshCw className="h-3 w-3" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 mr-2 animate-spin" /> Đang gọi /api-key-status...
          </div>
        ) : err ? (
          <div className="text-xs text-red-600">{err}</div>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {renderRow("Key Chat", data?.chat)}
            {renderRow("Key Image", data?.image)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
