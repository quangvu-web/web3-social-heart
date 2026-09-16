import { useCallback, useEffect, useState } from "react";
import { supabase as supabaseTyped } from "@/integrations/supabase/client";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = supabaseTyped as any;
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, AlertTriangle, CheckCircle2 } from "lucide-react";

/**
 * Card theo dõi sức khoẻ ingest từ Telegram → Angel AI gốc.
 * Đọc trực tiếp angel_channel_knowledge:
 *   - pushed / errored / pending-retry / skipped media-only / youtube-error
 * Cảnh báo khi tỉ lệ lỗi (24h) > 10%.
 */

interface Stats {
  total: number;
  pushed: number;
  errored: number;
  retrying: number;
  skipped: number;
  youtubeErr: number;
  last24hErrRate: number;
  latestPushedAt: string | null;
}

export default function IngestHealthCard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErrMsg(null);
    try {
      const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const [totalR, pushedR, erroredR, retryingR, skippedR, ytR, latestR, err24hR, tot24hR] =
        await Promise.all([
          supabase.from("angel_channel_knowledge").select("id", { count: "exact", head: true }),
          supabase.from("angel_channel_knowledge").select("id", { count: "exact", head: true }).eq("pushed_to_core", true),
          supabase.from("angel_channel_knowledge").select("id", { count: "exact", head: true })
            .eq("pushed_to_core", false).not("push_error", "is", null).is("next_retry_at", null),
          supabase.from("angel_channel_knowledge").select("id", { count: "exact", head: true })
            .eq("pushed_to_core", false).not("next_retry_at", "is", null),
          supabase.from("angel_channel_knowledge").select("id", { count: "exact", head: true })
            .not("skip_reason", "is", null),
          supabase.from("angel_channel_knowledge").select("id", { count: "exact", head: true })
            .not("youtube_error", "is", null),
          supabase.from("angel_channel_knowledge").select("pushed_at")
            .eq("pushed_to_core", true).order("pushed_at", { ascending: false }).limit(1).maybeSingle(),
          supabase.from("angel_channel_knowledge").select("id", { count: "exact", head: true })
            .gte("created_at", sinceIso).not("push_error", "is", null),
          supabase.from("angel_channel_knowledge").select("id", { count: "exact", head: true })
            .gte("created_at", sinceIso),
        ]);

      const tot24 = tot24hR.count ?? 0;
      const err24 = err24hR.count ?? 0;
      setStats({
        total: totalR.count ?? 0,
        pushed: pushedR.count ?? 0,
        errored: erroredR.count ?? 0,
        retrying: retryingR.count ?? 0,
        skipped: skippedR.count ?? 0,
        youtubeErr: ytR.count ?? 0,
        last24hErrRate: tot24 ? Math.round((err24 / tot24) * 100) : 0,
        latestPushedAt: latestR.data?.pushed_at ?? null,
      });
    } catch (e) {
      setErrMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const alertHigh = (stats?.last24hErrRate ?? 0) > 10;

  return (
    <Card className={alertHigh ? "border-amber-400" : ""}>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          {alertHigh ? (
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          )}
          Ingest Telegram → Angel gốc
          {alertHigh && (
            <Badge variant="outline" className="border-amber-400 text-amber-700">
              Lỗi 24h &gt; 10%
            </Badge>
          )}
          <Button size="sm" variant="ghost" className="ml-auto" onClick={() => void load()}>
            <RefreshCw className="h-3 w-3" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 mr-2 animate-spin" /> Đang tải...
          </div>
        ) : errMsg ? (
          <div className="text-xs text-red-600">{errMsg}</div>
        ) : stats ? (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-xs">
            <Cell label="Tổng" value={stats.total} />
            <Cell label="Đã push" value={stats.pushed} tone="ok" />
            <Cell label="Lỗi (dừng)" value={stats.errored} tone={stats.errored ? "err" : undefined} />
            <Cell label="Đang retry" value={stats.retrying} tone={stats.retrying ? "warn" : undefined} />
            <Cell label="Bỏ (media-only)" value={stats.skipped} />
            <Cell label="Lỗi YouTube" value={stats.youtubeErr} tone={stats.youtubeErr ? "warn" : undefined} />
            <div className="col-span-2 md:col-span-3 rounded border p-2">
              <div className="text-[10px] uppercase text-muted-foreground">Tỉ lệ lỗi 24h</div>
              <div className={`text-lg font-semibold ${alertHigh ? "text-amber-600" : "text-emerald-600"}`}>
                {stats.last24hErrRate}%
              </div>
            </div>
            <div className="col-span-2 md:col-span-3 rounded border p-2">
              <div className="text-[10px] uppercase text-muted-foreground">Push cuối</div>
              <div className="text-xs font-mono mt-1">
                {stats.latestPushedAt
                  ? new Date(stats.latestPushedAt).toLocaleString("vi-VN", { timeZone: "Asia/Kuala_Lumpur" })
                  : "—"}
              </div>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Cell({ label, value, tone }: { label: string; value: number; tone?: "ok" | "warn" | "err" }) {
  const color =
    tone === "err" ? "text-red-600" :
    tone === "warn" ? "text-amber-600" :
    tone === "ok" ? "text-emerald-600" : "text-foreground";
  return (
    <div className="rounded border p-2">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold ${color}`}>{value}</div>
    </div>
  );
}
