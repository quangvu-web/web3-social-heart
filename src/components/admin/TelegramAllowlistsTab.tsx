import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Trash2, Plus, ShieldCheck, Bot, RefreshCw } from "lucide-react";

type HandleRow = {
  id: string;
  chat_id: number | null;
  handle: string;
  note: string | null;
  created_at: string;
};

type BotRow = {
  id: string;
  chat_id: number | null;
  username: string;
  created_at: string;
};

function normHandle(h: string): string {
  return h.trim().toLowerCase().replace(/^@/, "").replace(/^https?:\/\/(?:www\.)?(?:t|telegram)\.me\//i, "").split(/[/?#]/)[0];
}

export default function TelegramAllowlistsTab() {
  const [handles, setHandles] = useState<HandleRow[]>([]);
  const [bots, setBots] = useState<BotRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [handlesError, setHandlesError] = useState(false);
  const [botsError, setBotsError] = useState(false);
  const [newHandle, setNewHandle] = useState("");
  const [newHandleNote, setNewHandleNote] = useState("");
  const [newHandleChatId, setNewHandleChatId] = useState("");
  const [newBot, setNewBot] = useState("");
  const [newBotChatId, setNewBotChatId] = useState("");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const query = search.trim().toLowerCase();
  const visibleHandles = handles.filter((r) => [r.handle, r.note ?? "", String(r.chat_id ?? "global")].some((v) => v.toLowerCase().includes(query)));
  const visibleBots = bots.filter((r) => [r.username, String(r.chat_id ?? "global")].some((v) => v.toLowerCase().includes(query)));

  async function load() {
    setLoading(true);
    setHandlesError(false);
    setBotsError(false);
    const [{ data: h, error: he }, { data: b, error: be }] = await Promise.all([
      supabase.from("trusted_telegram_handles").select("*").order("created_at", { ascending: false }),
      supabase.from("trusted_bot_usernames").select("*").order("created_at", { ascending: false }),
    ]);
    if (he) { setHandlesError(true); toast.error(`Tải handles lỗi: ${he.message}`); }
    if (be) { setBotsError(true); toast.error(`Tải bots lỗi: ${be.message}`); }
    setHandles((h as HandleRow[]) ?? []);
    setBots((b as BotRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function addHandle() {
    const handle = normHandle(newHandle);
    if (!handle) return toast.error("Nhập handle");
    const chat_id = newHandleChatId.trim() ? Number(newHandleChatId.trim()) : null;
    if (newHandleChatId.trim() && !Number.isFinite(chat_id!)) return toast.error("chat_id phải là số");
    setSaving(true);
    const { error } = await supabase.from("trusted_telegram_handles").insert({
      handle,
      note: newHandleNote.trim() || null,
      chat_id,
    });
    if (error) { setSaving(false); return toast.error(/duplicate|unique/i.test(error.message) ? "Handle này đã có trong allowlist." : error.message); }
    toast.success(`Đã thêm @${handle}`);
    setNewHandle(""); setNewHandleNote(""); setNewHandleChatId("");
    setSaving(false);
    void load();
  }

  async function removeHandle(id: string) {
    const { error } = await supabase.from("trusted_telegram_handles").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Đã xoá");
    void load();
  }

  async function addBot() {
    const username = normHandle(newBot);
    if (!username) return toast.error("Nhập bot username");
    const chat_id = newBotChatId.trim() ? Number(newBotChatId.trim()) : null;
    if (newBotChatId.trim() && !Number.isFinite(chat_id!)) return toast.error("chat_id phải là số");
    setSaving(true);
    const { error } = await supabase.from("trusted_bot_usernames").insert({ username, chat_id });
    if (error) { setSaving(false); return toast.error(/duplicate|unique/i.test(error.message) ? "Bot này đã có trong allowlist." : error.message); }
    toast.success(`Đã thêm @${username}`);
    setNewBot(""); setNewBotChatId("");
    setSaving(false);
    void load();
  }

  async function removeBot(id: string) {
    const { error } = await supabase.from("trusted_bot_usernames").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Đã xoá");
    void load();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5" /> Trusted Telegram channels / handles
          </CardTitle>
          <p className="text-xs text-muted-foreground">Đã tải {handles.length} mục.</p>
          <p className="text-sm text-muted-foreground">
            Các handle hợp lệ sẽ không bị bot xoá khi xuất hiện dưới dạng link <code>t.me/&lt;handle&gt;</code>.
            Để <strong>chat_id trống</strong> = áp dụng toàn cục.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Input aria-label="Tìm trong allowlist Telegram đã tải" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm handle, bot, ghi chú hoặc chat ID…" className="sm:max-w-md" />
            <span className="text-xs text-muted-foreground">Handles: {handlesError ? "chưa tải được" : `${visibleHandles.length}/${handles.length}`} · Bots: {botsError ? "chưa tải được" : `${visibleBots.length}/${bots.length}`}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-[2fr_3fr_2fr_auto] gap-2">
            <Input placeholder="handle (vd: funrich_community)" value={newHandle} onChange={(e) => setNewHandle(e.target.value)} />
            <Input placeholder="ghi chú (tuỳ chọn)" value={newHandleNote} onChange={(e) => setNewHandleNote(e.target.value)} />
            <Input placeholder="chat_id (trống = global)" value={newHandleChatId} onChange={(e) => setNewHandleChatId(e.target.value)} />
            <Button onClick={addHandle} disabled={saving}><Plus className="w-4 h-4 mr-1" />Thêm handle</Button>
          </div>
          <div className="space-y-2">
            {loading && <p className="text-sm text-muted-foreground">Đang tải…</p>}
            {!loading && handlesError && <div className="flex items-center gap-2 text-sm text-destructive">Không tải được danh sách handle.<Button variant="outline" size="sm" onClick={() => void load()}><RefreshCw className="mr-1 h-3 w-3"/>Thử lại</Button></div>}
            {!loading && !handlesError && handles.length === 0 && <p className="text-sm text-muted-foreground">Chưa có handle nào.</p>}
            {!handlesError && visibleHandles.map((r) => (
              <div key={r.id} className="flex items-center gap-2 p-2 rounded border bg-card">
                <Badge variant="secondary">@{r.handle}</Badge>
                {r.chat_id ? <Badge variant="outline">chat {r.chat_id}</Badge> : <Badge variant="outline">global</Badge>}
                <span className="text-sm text-muted-foreground flex-1 truncate">{r.note ?? ""}</span>
                <Button size="sm" variant="ghost" onClick={() => removeHandle(r.id)}><Trash2 className="w-4 h-4" /></Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5" /> Trusted bot usernames
          </CardTitle>
          <p className="text-xs text-muted-foreground">Đã tải {bots.length} mục.</p>
          <p className="text-sm text-muted-foreground">
            Các bot Telegram được phép mention (<code>@xxx_bot</code>) mà không bị moderation xoá.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-[3fr_2fr_auto] gap-2">
            <Input placeholder="bot username (vd: funrich_community_bot)" value={newBot} onChange={(e) => setNewBot(e.target.value)} />
            <Input placeholder="chat_id (trống = global)" value={newBotChatId} onChange={(e) => setNewBotChatId(e.target.value)} />
            <Button onClick={addBot} disabled={saving}><Plus className="w-4 h-4 mr-1" />Thêm bot</Button>
          </div>
          <div className="space-y-2">
            {loading && <p className="text-sm text-muted-foreground">Đang tải…</p>}
            {!loading && botsError && <div className="flex items-center gap-2 text-sm text-destructive">Không tải được danh sách bot.<Button variant="outline" size="sm" onClick={() => void load()}><RefreshCw className="mr-1 h-3 w-3"/>Thử lại</Button></div>}
            {!loading && !botsError && bots.length === 0 && <p className="text-sm text-muted-foreground">Chưa có bot nào.</p>}
            {!botsError && visibleBots.map((r) => (
              <div key={r.id} className="flex items-center gap-2 p-2 rounded border bg-card">
                <Badge variant="secondary">@{r.username}</Badge>
                {r.chat_id ? <Badge variant="outline">chat {r.chat_id}</Badge> : <Badge variant="outline">global</Badge>}
                <div className="flex-1" />
                <Button size="sm" variant="ghost" onClick={() => removeBot(r.id)}><Trash2 className="w-4 h-4" /></Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Thay đổi có hiệu lực trong vòng ~60s (bot cache allowlist). Không cần redeploy edge function.
      </p>
    </div>
  );
}
