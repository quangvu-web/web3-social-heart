import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { Crown, Loader2, Plus, RefreshCw, Search, Shield, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { changeCaptionOperators, parseTelegramId, PROJECT_OWNER_TELEGRAM_ID, searchCaptionCandidates, type CaptionDmUser } from "./captionOperators";

async function readSettings() {
  const { data, error } = await supabase.from("telegram_community_settings")
    .select("id, caption_operator_ids").order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Không tìm thấy hàng cài đặt cộng đồng. Chưa thể quản lý quyền phụ đề.");
  return data;
}

async function readDmUsers(): Promise<CaptionDmUser[]> {
  const users: CaptionDmUser[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from("telegram_bot_dm_users")
      .select("telegram_user_id, first_name, last_name, username")
      .order("last_seen_at", { ascending: false }).order("telegram_user_id", { ascending: true })
      .range(offset, offset + 499);
    if (error) throw error;
    users.push(...data);
    if (data.length < 500) return users;
  }
}

function errorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && "message" in error) return String(error.message);
  return "Lỗi không xác định. Hãy thử lại.";
}

function userName(user: CaptionDmUser | undefined): string {
  return user ? `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() : "";
}

export default function CaptionOperatorsSection() {
  const [search, setSearch] = useState("");
  const [manualId, setManualId] = useState("");
  const [removing, setRemoving] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const writeLock = useRef(false);
  const settings = useQuery({ queryKey: ["caption-operator-settings"], queryFn: readSettings, staleTime: 0 });
  const dmUsers = useQuery({ queryKey: ["caption-operator-dm-users"], queryFn: readDmUsers, staleTime: 30_000 });
  const ids = [...new Set(settings.data?.caption_operator_ids ?? [])];
  const candidates = searchCaptionCandidates(dmUsers.data ?? [], ids, search);
  const busy = saving || settings.isFetching || settings.isError || !settings.data;

  async function save(id: number, action: "add" | "remove") {
    if (writeLock.current) return;
    writeLock.current = true;
    setSaving(true);
    setSaveError(null);
    let written = false;
    try {
      // Always re-read the same oldest row before editing, not a stale UI snapshot.
      const current = await readSettings();
      const next = changeCaptionOperators(current.caption_operator_ids ?? [], id, action);
      let update = supabase.from("telegram_community_settings")
        .update({ caption_operator_ids: next }, { count: "exact" }).eq("id", current.id);
      // Compare-and-swap: do not silently overwrite a concurrent administrator's change.
      update = current.caption_operator_ids === null
        ? update.is("caption_operator_ids", null)
        : update.filter("caption_operator_ids", "eq", `{${current.caption_operator_ids.join(",")}}`);
      const { error, count } = await update;
      if (error) throw error;
      if (count !== 1) throw new Error("Chưa cập nhật được: danh sách đã thay đổi hoặc quyền ghi bị từ chối. Hãy tải lại rồi thử lại.");
      written = true;
      const fresh = await settings.refetch();
      if (fresh.error || !fresh.data) throw fresh.error ?? new Error("Không đọc lại được danh sách sau khi lưu.");
      const present = (fresh.data.caption_operator_ids ?? []).includes(id);
      if (present !== (action === "add")) throw new Error("Danh sách vừa bị thay đổi bởi thao tác khác. Trạng thái mới nhất đã được tải lại.");
      setManualId("");
      setRemoving(null);
      toast.success(action === "add" ? "Đã cấp quyền bật phụ đề." : "Đã thu hồi quyền bật phụ đề.");
    } catch (error) {
      const message = `${written ? "Đã ghi nhưng chưa xác nhận được trạng thái: " : "Không thể cập nhật quyền: "}${errorMessage(error)}`;
      setSaveError(message);
      toast.error(message);
      if (!written) await settings.refetch();
    } finally {
      writeLock.current = false;
      setSaving(false);
    }
  }

  function requestRemove(id: number) {
    try {
      changeCaptionOperators(ids, id, "remove");
      setSaveError(null);
      setRemoving(id);
    } catch (error) {
      setSaveError(errorMessage(error));
      toast.error(errorMessage(error));
    }
  }

  return (
    <section aria-labelledby="caption-operators-title" className="space-y-5 border-b pb-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <h2 id="caption-operators-title" className="flex items-start gap-2 text-lg font-semibold">
            <Shield className="mt-1 h-5 w-5 shrink-0 text-primary" />
            Quyền bật phụ đề — Caption Operators
          </h2>
          <p className="text-sm text-muted-foreground">Thay đổi có hiệu lực ngay từ lệnh /caption tiếp theo.</p>
        </div>
        <Button variant="outline" size="icon" aria-label="Tải lại quyền phụ đề" title="Tải lại quyền phụ đề"
          disabled={saving || settings.isFetching} onClick={() => { void settings.refetch(); void dmUsers.refetch(); }}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {settings.isLoading ? <p role="status" className="text-sm text-muted-foreground">Đang tải quyền phụ đề…</p>
        : settings.isError ? <p role="alert" className="text-sm text-destructive">Không tải được quyền phụ đề: {errorMessage(settings.error)}</p>
        : <>
          {ids.length === 0 ? <p className="text-sm text-muted-foreground">Chưa có operator được cấp quyền.</p> : (
            <ul className="divide-y rounded-md border">
              {ids.map((id) => {
                const user = dmUsers.data?.find((item) => item.telegram_user_id === id);
                return <li key={id} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm">{id}</span>
                      {id === PROJECT_OWNER_TELEGRAM_ID && <Badge variant="secondary" className="gap-1"><Crown className="h-3 w-3" />Chủ dự án</Badge>}
                    </div>
                    {(userName(user) || user?.username) && <p className="break-words text-sm text-muted-foreground">
                      {userName(user)}{userName(user) && user?.username ? " · " : ""}{user?.username ? `@${user.username}` : ""}
                    </p>}
                  </div>
                  <Button variant="ghost" size="icon" disabled={busy} aria-label={`Xóa operator ${id}`}
                    title="Thu hồi quyền" onClick={() => requestRemove(id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </li>;
              })}
            </ul>
          )}
          <div className="grid gap-5 md:grid-cols-2">
            <div className="min-w-0 space-y-2">
              <Label htmlFor="caption-operator-search">Chọn người đã nhắn DM bot</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <Input id="caption-operator-search" className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm tên, @username hoặc ID" />
              </div>
              {dmUsers.isLoading ? <p role="status" className="text-sm text-muted-foreground">Đang tải người dùng DM…</p>
                : dmUsers.isError ? <div role="alert" className="space-y-2 text-sm text-destructive">
                  <p>Không tải được người dùng DM: {errorMessage(dmUsers.error)}</p>
                  <Button variant="outline" size="sm" onClick={() => void dmUsers.refetch()}>Thử lại</Button>
                </div> : <div className="max-h-60 overflow-y-auto rounded-md border">
                  {candidates.length === 0 ? <p className="p-3 text-sm text-muted-foreground">Không có người phù hợp.</p>
                    : candidates.map((user) => <Button key={user.telegram_user_id} variant="ghost" disabled={busy}
                      className="h-auto w-full justify-between gap-3 whitespace-normal rounded-none px-3 py-2 text-left"
                      aria-label={`Cấp quyền cho ${user.telegram_user_id}`} onClick={() => void save(user.telegram_user_id, "add")}>
                      <span className="min-w-0 break-words">
                        <span className="block font-medium">{userName(user) || user.telegram_user_id}</span>
                        <span className="block text-xs text-muted-foreground">{user.username ? `@${user.username} · ` : ""}{user.telegram_user_id}</span>
                      </span><Plus className="h-4 w-4 shrink-0" />
                    </Button>)}
                </div>}
            </div>
            <form className="min-w-0 space-y-2" onSubmit={(event) => {
              event.preventDefault();
              const id = parseTelegramId(manualId);
              if (id === null) { toast.error("Telegram ID phải là số nguyên dương hợp lệ."); return; }
              void save(id, "add");
            }}>
              <Label htmlFor="caption-operator-id">Nhập trực tiếp Telegram ID</Label>
              <div className="flex gap-2">
                <Input id="caption-operator-id" className="min-w-0" inputMode="numeric" value={manualId} onChange={(event) => setManualId(event.target.value)} placeholder="Telegram ID số" />
                <Button type="submit" disabled={busy || !manualId.trim()}><Plus className="h-4 w-4" />Thêm</Button>
              </div>
            </form>
          </div>
        </>}
      <p className="text-sm leading-relaxed text-muted-foreground">Người được cấp quyền phải từng nhắn tin riêng cho bot Angel AI ít nhất một lần để xuất hiện trong danh sách chọn; hoặc nhập trực tiếp Telegram ID số của họ. Quyền gắn theo ID số nên vẫn giữ nguyên kể cả khi họ đổi username.</p>
      {saving && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Đang cập nhật và đọc lại danh sách…</p>}
      {saveError && <p role="alert" className="break-words text-sm text-destructive">{saveError}</p>}
      <AlertDialog open={removing !== null} onOpenChange={(open) => { if (!open && !saving) setRemoving(null); }}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] rounded-lg sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Thu hồi quyền bật phụ đề?</AlertDialogTitle>
            <AlertDialogDescription>Telegram ID {removing} sẽ không thể bật phụ đề từ lệnh /caption tiếp theo.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Hủy</AlertDialogCancel>
            <Button variant="destructive" disabled={busy} onClick={() => { if (removing !== null) void save(removing, "remove"); }}>
              <Trash2 className="h-4 w-4" />{saving ? "Đang xóa…" : "Xóa operator"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}