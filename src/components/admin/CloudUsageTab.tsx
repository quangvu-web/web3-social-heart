import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Cloud, AlertTriangle, Zap, DollarSign, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

type Range = "hour" | "day" | "month" | "year";

type TopFn = {
  function_name: string;
  feature: string;
  invocations: number;
  total_ms: number;
  avg_ms: number;
  max_ms: number;
  errors: number;
  share: number;
};

type AiRow = {
  model: string;
  provider: string;
  calls: number;
  latency_ms: number;
  input_tokens: number;
  output_tokens: number;
  est_cost: number;
  errors: number;
  cache_hits: number;
};

type UsageResponse = {
  ok: boolean;
  range: Range;
  label: string;
  since: string;
  generated_at: string;
  kpi: {
    invocations: number;
    compute_seconds: number;
    errors_5xx: number;
    distinct_functions: number;
    ai_calls: number;
    ai_input_tokens: number;
    ai_output_tokens: number;
    ai_est_cost: number;
  };
  features: string[];
  series: Array<Record<string, string | number>>;
  topFunctions: TopFn[];
  aiByModel: AiRow[];
  notes: string[];
};

// Malaysia Time formatter
const MYT = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Kuala_Lumpur",
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit",
});
const fmtMyt = (iso: string) => MYT.format(new Date(iso));
const fmtBucketShort = (iso: string, range: Range) => {
  const d = new Date(iso);
  const opts: Intl.DateTimeFormatOptions =
    range === "hour" ? { timeZone: "Asia/Kuala_Lumpur", hour: "2-digit", minute: "2-digit" }
    : range === "day" ? { timeZone: "Asia/Kuala_Lumpur", month: "2-digit", day: "2-digit" }
    : range === "month" ? { timeZone: "Asia/Kuala_Lumpur", month: "2-digit", year: "numeric" }
    : { timeZone: "Asia/Kuala_Lumpur", year: "numeric" };
  return new Intl.DateTimeFormat("vi-VN", opts).format(d);
};

const COLORS = [
  "hsl(45 90% 55%)",   // gold
  "hsl(200 70% 55%)",
  "hsl(340 70% 60%)",
  "hsl(140 55% 50%)",
  "hsl(270 60% 60%)",
  "hsl(20 80% 55%)",
  "hsl(180 55% 50%)",
  "hsl(0 0% 60%)",
];

export default function CloudUsageTab() {
  const [range, setRange] = useState<Range>("day");
  const [data, setData] = useState<UsageResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: resp, error: fnErr } = await supabase.functions.invoke("admin-cloud-usage", {
        body: { range },
      });
      if (fnErr) throw fnErr;
      if (!resp?.ok) throw new Error(resp?.error || "Không tải được cloud usage.");
      setData(resp as UsageResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi không xác định");
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  const chartData = useMemo(() => {
    if (!data) return [];
    return data.series.map((r) => ({ ...r, _label: fmtBucketShort(String(r.bucket), data.range) }));
  }, [data]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Cloud className="h-5 w-5" /> Cloud Usage Report
          </h2>
          <p className="text-sm text-muted-foreground">
            Function/feature nào đang ngốn Cloud compute — {data?.label ?? "..."} · Cập nhật lúc {data ? fmtMyt(data.generated_at) : "..."} (MYT)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={range} onValueChange={(v) => setRange(v as Range)}>
            <TabsList>
              <TabsTrigger value="hour">Giờ</TabsTrigger>
              <TabsTrigger value="day">Ngày</TabsTrigger>
              <TabsTrigger value="month">Tháng</TabsTrigger>
              <TabsTrigger value="year">Năm</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <Card className="p-4 text-sm text-destructive flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" /> {error}
        </Card>
      )}

      {data && (
        <>
          {/* KPI */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard icon={<Activity className="h-4 w-4" />} label="Lần gọi" value={data.kpi.invocations.toLocaleString("vi-VN")} />
            <KpiCard icon={<Zap className="h-4 w-4" />} label="Compute-seconds" value={data.kpi.compute_seconds.toLocaleString("vi-VN")} />
            <KpiCard icon={<AlertTriangle className="h-4 w-4" />} label="Lỗi 5xx" value={data.kpi.errors_5xx.toLocaleString("vi-VN")} tone={data.kpi.errors_5xx > 0 ? "warn" : "ok"} />
            <KpiCard icon={<DollarSign className="h-4 w-4" />} label="AI est. cost (USD)" value={`$${data.kpi.ai_est_cost.toFixed(4)}`} />
          </div>

          {/* Chart */}
          <Card className="p-4">
            <div className="text-sm font-medium mb-2">Compute-seconds theo feature</div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="_label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  {data.features.map((f, i) => (
                    <Area
                      key={f}
                      type="monotone"
                      dataKey={f}
                      stackId="1"
                      stroke={COLORS[i % COLORS.length]}
                      fill={COLORS[i % COLORS.length]}
                      fillOpacity={0.6}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Top functions */}
          <Card className="p-4">
            <div className="text-sm font-medium mb-3">Top edge functions ngốn compute</div>
            {data.topFunctions.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                Chưa có function nào ghi vào <code>cloud_usage_events</code>. Thêm <code>startCloudUsage()</code> vào đầu handler để bắt đầu tracking.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-muted-foreground border-b">
                    <tr>
                      <th className="py-2 pr-3">Feature</th>
                      <th className="py-2 pr-3">Function</th>
                      <th className="py-2 pr-3 text-right">Calls</th>
                      <th className="py-2 pr-3 text-right">Total (s)</th>
                      <th className="py-2 pr-3 text-right">Avg (ms)</th>
                      <th className="py-2 pr-3 text-right">Max (ms)</th>
                      <th className="py-2 pr-3 text-right">5xx</th>
                      <th className="py-2 pr-3 text-right">Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topFunctions.map((f) => (
                      <tr key={f.function_name} className="border-b last:border-0">
                        <td className="py-2 pr-3"><Badge variant="secondary">{f.feature}</Badge></td>
                        <td className="py-2 pr-3 font-mono text-xs">{f.function_name}</td>
                        <td className="py-2 pr-3 text-right">{f.invocations.toLocaleString("vi-VN")}</td>
                        <td className="py-2 pr-3 text-right">{Math.round(f.total_ms / 1000).toLocaleString("vi-VN")}</td>
                        <td className="py-2 pr-3 text-right">{f.avg_ms.toLocaleString("vi-VN")}</td>
                        <td className="py-2 pr-3 text-right">{f.max_ms.toLocaleString("vi-VN")}</td>
                        <td className={`py-2 pr-3 text-right ${f.errors > 0 ? "text-destructive" : ""}`}>{f.errors}</td>
                        <td className="py-2 pr-3 text-right font-medium">{f.share}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* AI models */}
          <Card className="p-4">
            <div className="text-sm font-medium mb-3">AI models (Angel AI runtime logs)</div>
            {data.aiByModel.length === 0 ? (
              <div className="text-sm text-muted-foreground">Không có AI call trong khoảng này.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-muted-foreground border-b">
                    <tr>
                      <th className="py-2 pr-3">Provider</th>
                      <th className="py-2 pr-3">Model</th>
                      <th className="py-2 pr-3 text-right">Calls</th>
                      <th className="py-2 pr-3 text-right">Cache hit</th>
                      <th className="py-2 pr-3 text-right">Latency (s)</th>
                      <th className="py-2 pr-3 text-right">In tokens</th>
                      <th className="py-2 pr-3 text-right">Out tokens</th>
                      <th className="py-2 pr-3 text-right">Est. $</th>
                      <th className="py-2 pr-3 text-right">Err</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.aiByModel.map((a) => (
                      <tr key={`${a.provider}/${a.model}`} className="border-b last:border-0">
                        <td className="py-2 pr-3"><Badge variant="outline">{a.provider}</Badge></td>
                        <td className="py-2 pr-3 font-mono text-xs">{a.model}</td>
                        <td className="py-2 pr-3 text-right">{a.calls.toLocaleString("vi-VN")}</td>
                        <td className="py-2 pr-3 text-right">{a.cache_hits}</td>
                        <td className="py-2 pr-3 text-right">{Math.round(a.latency_ms / 1000).toLocaleString("vi-VN")}</td>
                        <td className="py-2 pr-3 text-right">{a.input_tokens.toLocaleString("vi-VN")}</td>
                        <td className="py-2 pr-3 text-right">{a.output_tokens.toLocaleString("vi-VN")}</td>
                        <td className="py-2 pr-3 text-right">${a.est_cost.toFixed(4)}</td>
                        <td className={`py-2 pr-3 text-right ${a.errors > 0 ? "text-destructive" : ""}`}>{a.errors}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {data.notes?.length ? (
            <Card className="p-3 text-xs text-muted-foreground space-y-1">
              {data.notes.map((n, i) => <div key={i}>• {n}</div>)}
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}

function KpiCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone?: "ok" | "warn" }) {
  return (
    <Card className={`p-4 ${tone === "warn" ? "border-destructive/40" : ""}`}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon} {label}
      </div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </Card>
  );
}
