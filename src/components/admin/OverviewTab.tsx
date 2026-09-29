import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CircleHelp, Clock3, RefreshCw, ShieldAlert, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getTelegramWebhookStatus, type TelegramWebhookInfo, type TelegramWebhookStatus } from "./telegramWebhookStatus";
import { formatMyt } from "@/lib/formatMyt";

type WebhookSnapshot = {
  info: TelegramWebhookInfo;
  expectedUrl: string;
};

const metricPlaceholders = [
  { label: "Thành viên cộng đồng", icon: Users },
  { label: "Moderation · 24 giờ", icon: ShieldAlert },
  { label: "DM bot", icon: Users },
  { label: "Job lỗi", icon: AlertTriangle },
];

function statusLabel(status: TelegramWebhookStatus): string {
  if (status.state === "unverified") return "Chưa xác minh";
  if (status.state === "error") return "Có lỗi";
  return "Cần theo dõi";
}

function statusDescription(status: TelegramWebhookStatus, requestFailed: boolean): string {
  if (requestFailed || status.reason === "unavailable") {
    return "Chưa lấy được trạng thái từ dịch vụ Telegram; phản hồi của bot chưa được xác minh.";
  }
  if (status.reason === "missing_url") return "Telegram chưa đăng ký webhook cho bot cộng đồng.";
  if (status.reason === "wrong_target") return "Webhook hiện không trỏ tới endpoint Telegram Community dự kiến.";
  if (status.reason === "recent_delivery_error") return "Telegram ghi nhận lỗi gửi update gần đây. Kiểm tra invocation và lỗi giao nhận.";
  return "Webhook đúng endpoint và chưa có lỗi giao nhận gần đây; chưa có bằng chứng xác nhận bot đã trả lời người dùng.";
}

function statusVariant(status: TelegramWebhookStatus): "default" | "secondary" | "destructive" | "outline" {
  if (status.state === "error") return "destructive";
  if (status.state === "monitor") return "secondary";
  return "outline";
}

export default function OverviewTab() {
  const [snapshot, setSnapshot] = useState<WebhookSnapshot | null>(null);
  const [requestFailed, setRequestFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setRequestFailed(false);
    try {
      const { data, error } = await supabase.functions.invoke("telegram-community-admin", {
        body: { action: "get_webhook_info" },
      });
      const info = data?.info?.result as TelegramWebhookInfo | undefined;
      const expectedUrl = typeof data?.expected_url_prefix === "string" ? data.expected_url_prefix : "";
      if (error || data?.success !== true || !info || !expectedUrl) {
        setSnapshot(null);
        setRequestFailed(true);
        return;
      }
      setSnapshot({ info, expectedUrl });
    } catch {
      setSnapshot(null);
      setRequestFailed(true);
    } finally {
      setCheckedAt(new Date());
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const status = loading
    ? null
    : getTelegramWebhookStatus(snapshot?.info, snapshot?.expectedUrl ?? "", Date.now());

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <span className="h-2.5 w-2.5 rounded-full bg-primary" aria-hidden="true" />
              Trạng thái bot cộng đồng
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Webhook chỉ cho biết nơi Telegram gửi update; trạng thái này không tự xác nhận bot đã trả lời DM.
            </p>
          </div>
          <Button variant="outline" onClick={() => void refresh()} disabled={loading} className="shrink-0">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Làm mới
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            {loading ? (
              <Badge variant="outline" role="status">Đang tải trạng thái…</Badge>
            ) : status ? (
              <Badge variant={statusVariant(status)} role="status">{statusLabel(status)}</Badge>
            ) : null}
            {checkedAt && (
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock3 className="h-3.5 w-3.5" />
                Kiểm tra lúc {formatMyt(checkedAt)} MYT (UTC+8)
              </span>
            )}
          </div>

          {!loading && status && (
            <p className="text-sm text-foreground">{statusDescription(status, requestFailed)}</p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border bg-background p-3">
              <p className="text-xs text-muted-foreground">Update đang chờ</p>
              <p className="mt-1 text-xl font-semibold">
                {loading ? "…" : snapshot?.info.pending_update_count ?? "Chưa có dữ liệu"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Số lượng này không xác nhận bot đã hoạt động.</p>
            </div>
            <div className="rounded-md border bg-background p-3">
              <p className="text-xs text-muted-foreground">Lỗi giao nhận gần nhất</p>
              <p className="mt-1 text-sm font-medium">
                {loading ? "Đang tải…" : status?.hasHistoricalError ? "Có ghi nhận lịch sử" : snapshot ? "Chưa có lỗi được ghi nhận" : "Chưa xác minh"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Lỗi cũ được phân biệt với lỗi trong 10 phút gần đây.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <section aria-labelledby="telegram-metrics-title" className="space-y-3">
        <div>
          <h2 id="telegram-metrics-title" className="text-base font-semibold">Chỉ số vận hành</h2>
          <p className="text-sm text-muted-foreground">Các nguồn dữ liệu này chưa được nối vào trang tổng quan.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {metricPlaceholders.map(({ label, icon: Icon }) => (
            <Card key={label}>
              <CardContent className="flex items-start gap-3 p-4">
                <Icon className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CircleHelp className="h-3.5 w-3.5" /> Chưa có dữ liệu
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
