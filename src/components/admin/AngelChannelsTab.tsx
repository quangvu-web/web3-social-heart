import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Plus, RefreshCw, Trash2, Eye, RotateCw } from "lucide-react";

interface WatchedChannel {
  id: string;
  chat_id: number;
  username: string | null;
  title: string | null;
  is_active: boolean;
  auto_push_to_core: boolean;
  last_synced_at: string | null;
  last_message_id: number | null;
  ingested_count: number;
  notes: string | null;
  created_at: string;
}

interface KnowledgeRow {
  id: string;
  message_id: number;
  content: string | null;
  media_type: string | null;
  posted_at: string | null;
  pushed_to_core: boolean;
  pushed_at: string | null;
  push_error: string | null;
  core_reference: string | null;
  merged_message_ids: number[] | null;
}


function formatMY(dt: string | null) {
  if (!dt) return "—";
  try {
    return new Date(dt).toLocaleString("en-GB", { timeZone: "Asia/Kuala_Lumpur", hour12: false });
  } catch {
    return dt;
  }
}

export default function AngelChannelsTab() {
  const [channels, setChannels] = useState<WatchedChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newChatId, setNewChatId] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [viewingChatId, setViewingChatId] = useState<number | null>(null);
  const [recent, setRecent] = useState<KnowledgeRow[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  async function call(action: string, payload: Record<string, unknown> = {}) {
    const { data, error } = await supabase.functions.invoke("angel-channel-manage", {
      body: { action, ...payload },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  }

  async function load() {
    setLoading(true);
    try {
      const data = await call("list");
      setChannels(data.channels || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không tải được danh sách");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAdd() {
    const chatId = Number(newChatId.trim());
    if (!Number.isFinite(chatId) || chatId === 0) {
      toast.error("chat_id phải là số (ví dụ: -1001234567890)");
      return;
    }
    setAdding(true);
    try {
      await call("add", {
        chat_id: chatId,
        username: newUsername.trim() || undefined,
        title: newTitle.trim() || undefined,
      });
      toast.success("Đã thêm channel");
      setNewChatId("");
      setNewUsername("");
      setNewTitle("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không thêm được");
    } finally {
      setAdding(false);
    }
  }

  async function handleToggle(
    ch: WatchedChannel,
    field: "is_active" | "auto_push_to_core",
  ) {
    setBusy(ch.id + field);
    try {
      const action = field === "is_active" ? "toggle" : "toggle_push";
      const payload =
        field === "is_active"
          ? { chat_id: ch.chat_id, is_active: !ch.is_active }
          : { chat_id: ch.chat_id, auto_push_to_core: !ch.auto_push_to_core };

      await call(action, payload);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không đổi được");
    } finally {
      setBusy(null);
    }
  }

  async function handleRemove(ch: WatchedChannel) {
    if (!confirm(`Xoá channel "${ch.title || ch.username || ch.chat_id}" khỏi danh sách theo dõi?\n\n(Knowledge đã ingest KHÔNG bị xoá.)`)) return;
    setBusy(ch.id + "rm");
    try {
      await call("remove", { chat_id: ch.chat_id });
      toast.success("Đã xoá");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không xoá được");
    } finally {
      setBusy(null);
    }
  }

  async function handleRepush(ch: WatchedChannel, force = false) {
    if (force && !confirm(`Ép đẩy lại TẤT CẢ bài của "${ch.title || ch.chat_id}" vào Angel AI gốc (kể cả các bài đã pushed)?\n\nDùng khi nghi ngờ ✓ pushed là false-positive.`)) return;
    setBusy(ch.id + (force ? "fp" : "rp"));
    try {
      const data = await call("repush", { chat_id: ch.chat_id, force });
      const errMsg = data.errors?.length ? `\nLỗi mẫu: ${data.errors.slice(0, 3).map((e: { message_id: number; error: string }) => `#${e.message_id}: ${e.error.slice(0, 80)}`).join(" | ")}` : "";
      const msg = `Đã đẩy lại (${force ? "force" : "chỉ chưa push"}): ${data.success} OK / ${data.failed} lỗi / ${data.skipped} bỏ qua${errMsg}`;
      if (data.failed > 0) toast.error(msg, { duration: 8000 });
      else toast.success(msg);
      if (viewingChatId === ch.chat_id) await handleView(ch);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không đẩy lại được");
    } finally {
      setBusy(null);
    }
  }

  async function handleRepushRow(row: KnowledgeRow, ch: WatchedChannel, deleteFirst: boolean) {
    if (deleteFirst && !confirm(`Xoá bản ghi #${row.message_id} bên Angel AI gốc rồi push lại (verify)?\n\nDùng khi verify báo not_persisted (server gốc dedupe/tombstone).`)) return;
    setBusy(row.id + (deleteFirst ? "del" : "vf"));
    try {
      const data = await call("force_repush_row", { knowledge_id: row.id, delete_first: deleteFirst });
      if (data.ok) {
        toast.success(`#${row.message_id}: verify OK${data.deleted ? " (đã xoá trước)" : ""} — reference: ${data.reference || "verified"}`);
      } else {
        const hint = data.hint ? `\n💡 ${data.hint}` : "";
        toast.error(`#${row.message_id}: ${data.error || "push failed"}${hint}`, { duration: 10000 });
      }
      await handleView(ch);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không re-push được");
    } finally {
      setBusy(null);
    }
  }

  async function handleView(ch: WatchedChannel) {
    setViewingChatId(ch.chat_id);
    setRecent([]);
    setRecentLoading(true);
    try {
      const data = await call("recent", { chat_id: ch.chat_id });
      setRecent(data.messages || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không tải được");
    } finally {
      setRecentLoading(false);
    }
  }

  const [seedingMantras, setSeedingMantras] = useState(false);

  async function handleSeedMantras() {
    setSeedingMantras(true);
    try {
      const { data, error } = await supabase.functions.invoke("angel-seed-mantras", {
        body: {},
      });
      if (error) throw error;
      if (!data?.ok) {
        throw new Error(data?.push?.error || data?.error || "Không đẩy được");
      }
      const items = Array.isArray(data?.status?.items) ? data.status.items.length : 0;
      toast.success(`Đã đẩy 8 Câu Thần Chú vào Angel AI gốc (verified: ${items} doc)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không đẩy được");
    } finally {
      setSeedingMantras(false);
    }
  }

  return (
    <div className="space-y-6">

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle>🕉️ Kiến thức cốt lõi Fun Kingdom</CardTitle>
            <CardDescription>
              Đẩy nguyên văn 8 Câu Thần Chú (VI + EN) vào Angel AI gốc để bot Telegram và web trả lời đồng nhất, không tự bịa.
            </CardDescription>
          </div>
          <Button onClick={handleSeedMantras} disabled={seedingMantras}>
            {seedingMantras ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Đẩy 8 Câu Thần Chú
          </Button>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>📡 Angel theo dõi Telegram Channel</CardTitle>
          <CardDescription>
            Bot Angel sẽ tự đọc mọi bài viết mới trong các channel dưới đây và đẩy vào knowledge của Angel AI gốc.
            <br />
            <strong>Yêu cầu:</strong> Bot Angel phải được add làm <em>admin</em> trong channel (bot chỉ nhận được channel_post khi là admin).
            Lịch sử cũ trước khi add bot KHÔNG đọc được — Telegram Bot API giới hạn.
          </CardDescription>
        </CardHeader>


        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4 items-end">
            <div>
              <Label htmlFor="chatid">Chat ID *</Label>
              <Input
                id="chatid"
                placeholder="-1001234567890"
                value={newChatId}
                onChange={(e) => setNewChatId(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="uname">Username (không @)</Label>
              <Input
                id="uname"
                placeholder="CamlyChannel"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="title">Tên hiển thị</Label>
              <Input
                id="title"
                placeholder="Cam Ly Channel"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
            </div>
            <Button onClick={handleAdd} disabled={adding}>
              {adding ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Thêm channel
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            💡 Lấy chat_id: forward 1 bài từ channel về @userinfobot, hoặc dùng bot @RawDataBot.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Danh sách channel ({channels.length})</CardTitle>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : channels.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Chưa có channel nào. Thêm channel đầu tiên ở trên ↑
            </p>
          ) : (
            <div className="space-y-3">
              {channels.map((ch) => (
                <div key={ch.id} className="rounded-lg border p-4 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{ch.title || "(chưa có tên)"}</span>
                        {ch.username && (
                          <a
                            href={`https://t.me/${ch.username}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline"
                          >
                            @{ch.username}
                          </a>
                        )}
                        <Badge variant={ch.is_active ? "default" : "secondary"}>
                          {ch.is_active ? "Đang theo dõi" : "Tạm dừng"}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 font-mono">
                        chat_id: {ch.chat_id}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleView(ch)}
                        title="Xem 50 bài mới nhất"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRepush(ch, false)}
                        disabled={busy === ch.id + "rp"}
                        title="Đẩy lại các bài chưa push (hoặc pushed-false-positive) vào Angel AI gốc, kèm verify"
                      >
                        {busy === ch.id + "rp" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCw className="w-4 h-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRepush(ch, true)}
                        disabled={busy === ch.id + "fp"}
                        title="Force: đẩy lại TẤT CẢ bài (kể cả đã pushed) — verify bằng action=status"
                        className="text-amber-600 hover:text-amber-700"
                      >
                        {busy === ch.id + "fp" ? <Loader2 className="w-4 h-4 animate-spin" /> : <span className="text-[10px] font-bold">FORCE</span>}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemove(ch)}
                        disabled={busy === ch.id + "rm"}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-2 md:grid-cols-3 text-sm">
                    <label className="flex items-center gap-2">
                      <Switch
                        checked={ch.is_active}
                        onCheckedChange={() => handleToggle(ch, "is_active")}
                        disabled={busy === ch.id + "is_active"}
                      />
                      <span>Theo dõi channel</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <Switch
                        checked={ch.auto_push_to_core}
                        onCheckedChange={() => handleToggle(ch, "auto_push_to_core")}
                        disabled={busy === ch.id + "auto_push_to_core"}
                      />
                      <span>Tự đẩy vào Angel AI gốc</span>
                    </label>
                  </div>

                  <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                    <span>Đã ingest: <strong className="text-foreground">{ch.ingested_count}</strong></span>
                    <span>Bài mới nhất: <strong className="text-foreground">{ch.last_message_id ?? "—"}</strong></span>
                    <span>Sync cuối: <strong className="text-foreground">{formatMY(ch.last_synced_at)}</strong></span>
                  </div>

                  {viewingChatId === ch.chat_id && (
                    <div className="mt-3 border-t pt-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">50 bài mới nhất</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setViewingChatId(null)}
                          className="h-6 text-xs"
                        >
                          Đóng
                        </Button>
                      </div>
                      {recentLoading ? (
                        <div className="flex justify-center py-4">
                          <Loader2 className="w-4 h-4 animate-spin" />
                        </div>
                      ) : recent.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Chưa có bài nào được ingest.</p>
                      ) : (
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                          {recent.map((m) => {
                            const mergedCount = Array.isArray(m.merged_message_ids) ? m.merged_message_ids.length : 0;
                            return (
                            <div key={m.id} className="text-xs border-l-2 border-muted pl-3 py-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-muted-foreground">#{m.message_id}</span>
                                {m.media_type && <Badge variant="outline" className="text-[10px] h-4">{m.media_type}</Badge>}
                                {mergedCount > 0 && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] h-4 border-blue-500/40 text-blue-600"
                                    title={`Đã gộp ${mergedCount + 1} tin liên tiếp: #${m.message_id}, ${m.merged_message_ids?.join(", #")}`}
                                  >
                                    gộp {mergedCount + 1} tin
                                  </Badge>
                                )}
                                {m.pushed_to_core ? (
                                  <Badge variant="default" className="text-[10px] h-4 bg-green-600">✓ pushed</Badge>
                                ) : m.push_error ? (
                                  <Badge variant="destructive" className="text-[10px] h-4" title={m.push_error}>lỗi</Badge>
                                ) : (
                                  <Badge variant="secondary" className="text-[10px] h-4">chờ push</Badge>
                                )}
                                <span className="text-muted-foreground">{formatMY(m.posted_at)}</span>
                                {m.content && (
                                  <div className="ml-auto flex items-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 px-2 text-[10px]"
                                      onClick={() => handleRepushRow(m, ch, false)}
                                      disabled={busy === m.id + "vf"}
                                      title="Re-push kèm verify — báo lỗi rõ nếu server không persist"
                                    >
                                      {busy === m.id + "vf" ? <Loader2 className="w-3 h-3 animate-spin" /> : "Re-push ✓"}
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 px-2 text-[10px] text-amber-600 hover:text-amber-700"
                                      onClick={() => handleRepushRow(m, ch, true)}
                                      disabled={busy === m.id + "del"}
                                      title="Xoá bên gốc trước rồi push lại (fix dedupe/tombstone)"
                                    >
                                      {busy === m.id + "del" ? <Loader2 className="w-3 h-3 animate-spin" /> : "Del+Push"}
                                    </Button>
                                  </div>
                                )}
                              </div>
                              {m.content && (
                                <div className="mt-1 text-foreground line-clamp-3 whitespace-pre-wrap">
                                  {m.content}
                                </div>
                              )}
                              {m.push_error && (
                                <div className="mt-1 text-destructive text-[10px]">{m.push_error}</div>
                              )}
                            </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">⚙️ Cấu hình Angel AI gốc</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>
            Endpoint đã hardcode theo docs <code className="text-xs bg-muted px-1 py-0.5 rounded">knowledge-external-ingest</code> của Angel AI gốc (angel.fun.rich). Chỉ cần set secret <code className="text-xs bg-muted px-1 py-0.5 rounded">ANGEL_KNOWLEDGE_INGEST_KEY</code> do đội Angel AI cấp.
          </p>
          <p>
            Chưa set → nội dung vẫn được lưu trong bảng <code className="text-xs bg-muted px-1 py-0.5 rounded">angel_channel_knowledge</code> và có thể push lại sau bằng nút <RotateCw className="w-3 h-3 inline" /> ở mỗi channel.
          </p>
          <p className="text-muted-foreground">
            Body Angel gửi: <code className="text-xs">{`{ action: "upsert", documents: [{ source, source_ref, title, content, url, folder, metadata }] }`}</code>. Idempotent theo <code className="text-xs">(source, source_ref)</code> — content không đổi thì không re-embed. Rate limit 60 req/phút.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
