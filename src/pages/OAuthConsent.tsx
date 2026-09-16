import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

type SupabaseOAuthNamespace = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: any }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: any }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: any }>;
};

function oauthNs(): SupabaseOAuthNamespace | null {
  const anyAuth = supabase.auth as unknown as { oauth?: SupabaseOAuthNamespace };
  return anyAuth.oauth ?? null;
}

function safeNextFromLocation(): string {
  const next = window.location.pathname + window.location.search;
  if (!next.startsWith("/")) return "/";
  return next;
}

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Thiếu authorization_id trong URL.");
        return;
      }
      const ns = oauthNs();
      if (!ns) {
        setError("Máy chủ OAuth chưa sẵn sàng.");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = safeNextFromLocation();
        window.location.href = "/auth?return_to=" + encodeURIComponent(next);
        return;
      }
      const { data, error } = await ns.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) {
        setError(error.message);
        return;
      }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    const ns = oauthNs();
    if (!ns) return;
    setBusy(true);
    const { data, error } = approve
      ? await ns.approveAuthorization(authorizationId)
      : await ns.denyAuthorization(authorizationId);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("Máy chủ xác thực không trả về địa chỉ chuyển hướng.");
      return;
    }
    window.location.href = target;
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-2">
          <h1 className="text-xl font-semibold">Không thể xử lý yêu cầu</h1>
          <p className="text-muted-foreground text-sm">{error}</p>
        </div>
      </main>
    );
  }
  if (!details) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <p className="text-muted-foreground">Đang tải…</p>
      </main>
    );
  }

  const clientName = details.client?.name ?? "Ứng dụng bên ngoài";

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm space-y-5">
        <div className="space-y-2">
          <h1 className="text-xl font-semibold">
            Kết nối {clientName} với FUN Profile?
          </h1>
          <p className="text-sm text-muted-foreground">
            {clientName} sẽ có thể truy cập FUN Profile với danh nghĩa của bé.
            Bé có thể huỷ kết nối bất cứ lúc nào trong phần "Ứng dụng đã kết nối".
          </p>
        </div>
        <div className="flex gap-3 justify-end">
          <button
            disabled={busy}
            onClick={() => decide(false)}
            className="px-4 py-2 rounded-md border border-border text-sm hover:bg-muted disabled:opacity-50"
          >
            Từ chối
          </button>
          <button
            disabled={busy}
            onClick={() => decide(true)}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Đang xử lý…" : "Cho phép"}
          </button>
        </div>
      </div>
    </main>
  );
}
