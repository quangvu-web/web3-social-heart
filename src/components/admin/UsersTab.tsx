import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Download, FileJson, RefreshCw, Search, Users as UsersIcon } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";

interface UserRow {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  email: string | null;
  custodial_wallet_address: string | null;
  external_wallet_address: string | null;
  default_wallet_type: string | null;
  soul_level: number | null;
  pending_reward: number | null;
  approved_reward: number | null;
  total_rewards: number | null;
  trust_level: number | null;
  oauth_provider: string | null;
  registered_from: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  linked_wallets?: Array<{ address: string; chain_id: number }>;
  [k: string]: any;
}

const PAGE_SIZE = 50;

// Malaysia Time (UTC+8) formatter
function fmtMY(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-GB", {
      timeZone: "Asia/Kuala_Lumpur",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

function stampMY() {
  const d = new Date();
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  }).formatToParts(d).reduce<Record<string, string>>((a, p) => { a[p.type] = p.value; return a; }, {});
  return `${parts.year}${parts.month}${parts.day}-${parts.hour}${parts.minute}`;
}

function escapeCsv(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s = typeof v === "object" ? JSON.stringify(v) : String(v);
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows: UserRow[]): string {
  if (!rows.length) return "";
  const keys = Array.from(
    rows.reduce<Set<string>>((set, r) => { Object.keys(r).forEach(k => set.add(k)); return set; }, new Set())
  );
  // Put important fields first
  const priority = ["id", "email", "username", "full_name", "custodial_wallet_address", "external_wallet_address", "default_wallet_type", "soul_level", "pending_reward", "approved_reward", "total_rewards", "trust_level", "oauth_provider", "registered_from", "created_at", "last_sign_in_at"];
  const ordered = [...priority.filter(k => keys.includes(k)), ...keys.filter(k => !priority.includes(k))];
  const header = ordered.join(",");
  const lines = rows.map(r => ordered.map(k => escapeCsv((r as any)[k])).join(","));
  return [header, ...lines].join("\n");
}

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function UsersTab() {
  const [search, setSearch] = useState("");
  const debounced = useDebounce(search, 400);
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-users-export", {
        body: { action: "list", search: debounced, limit: PAGE_SIZE, offset: page * PAGE_SIZE },
      });
      if (error) throw error;
      setRows(data?.users ?? []);
      setTotal(data?.total ?? 0);
    } catch (e: any) {
      toast.error("Không tải được danh sách: " + (e?.message ?? "lỗi"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { setPage(0); }, [debounced]);
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [debounced, page]);

  const exportAll = async (format: "csv" | "json") => {
    setExporting(true);
    try {
      toast.info("Đang trích xuất toàn bộ user...");
      const { data, error } = await supabase.functions.invoke("admin-users-export", {
        body: { action: "export" },
      });
      if (error) throw error;
      const users: UserRow[] = data?.users ?? [];
      const stamp = stampMY();
      if (format === "csv") {
        download(`fun-profile-users-${stamp}.csv`, toCsv(users), "text/csv;charset=utf-8");
      } else {
        download(`fun-profile-users-${stamp}.json`, JSON.stringify(users, null, 2), "application/json");
      }
      toast.success(`Đã xuất ${users.length} user`);
    } catch (e: any) {
      toast.error("Xuất thất bại: " + (e?.message ?? "lỗi"));
    } finally {
      setExporting(false);
    }
  };

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <UsersIcon className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Danh sách user ({total.toLocaleString()})</h2>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input
                placeholder="Tìm email, username, họ tên..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 w-64"
              />
            </div>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Tải lại
            </Button>
            <Button size="sm" onClick={() => exportAll("csv")} disabled={exporting}>
              <Download className="w-4 h-4 mr-1" /> Export CSV
            </Button>
            <Button size="sm" variant="secondary" onClick={() => exportAll("json")} disabled={exporting}>
              <FileJson className="w-4 h-4 mr-1" /> Export JSON
            </Button>
          </div>
        </div>
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="p-2">User</th>
              <th className="p-2">Email</th>
              <th className="p-2">Wallet</th>
              <th className="p-2 text-right">Soul</th>
              <th className="p-2 text-right">Pending</th>
              <th className="p-2 text-right">Approved</th>
              <th className="p-2 text-right">Total</th>
              <th className="p-2">Provider</th>
              <th className="p-2">Tạo lúc (MY)</th>
              <th className="p-2">Đăng nhập gần nhất (MY)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className="border-t hover:bg-muted/30">
                <td className="p-2">
                  <div className="flex items-center gap-2">
                    {u.avatar_url ? (
                      <img src={u.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-muted" />
                    )}
                    <div>
                      <div className="font-medium">{u.username ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{u.full_name ?? ""}</div>
                    </div>
                  </div>
                </td>
                <td className="p-2 font-mono text-xs">{u.email ?? "—"}</td>
                <td className="p-2 font-mono text-xs">
                  {u.custodial_wallet_address ? <div title="Custodial">C: {u.custodial_wallet_address.slice(0, 8)}…</div> : null}
                  {u.external_wallet_address ? <div title="External">E: {u.external_wallet_address.slice(0, 8)}…</div> : null}
                  {!u.custodial_wallet_address && !u.external_wallet_address ? "—" : null}
                </td>
                <td className="p-2 text-right">{u.soul_level ?? 0}</td>
                <td className="p-2 text-right">{(u.pending_reward ?? 0).toLocaleString()}</td>
                <td className="p-2 text-right">{(u.approved_reward ?? 0).toLocaleString()}</td>
                <td className="p-2 text-right">{(u.total_rewards ?? 0).toLocaleString()}</td>
                <td className="p-2 text-xs">{u.oauth_provider ?? u.registered_from ?? "—"}</td>
                <td className="p-2 text-xs">{fmtMY(u.created_at)}</td>
                <td className="p-2 text-xs">{fmtMY(u.last_sign_in_at)}</td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={10} className="p-8 text-center text-muted-foreground">Không có user</td></tr>
            )}
          </tbody>
        </table>
      </Card>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Trang {page + 1} / {totalPages}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page === 0 || loading} onClick={() => setPage(p => Math.max(0, p - 1))}>← Trước</Button>
          <Button variant="outline" size="sm" disabled={page + 1 >= totalPages || loading} onClick={() => setPage(p => p + 1)}>Sau →</Button>
        </div>
      </div>
    </div>
  );
}
