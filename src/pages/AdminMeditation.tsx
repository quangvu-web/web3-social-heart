import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import {
  Loader2, Image as ImageIcon, Send, Trash2, Upload, Eye, TestTube2, Save, FolderOpen,
  Plus, RefreshCw, Link as LinkIcon,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { buildMeditationCaption, captionToPreviewHtml } from '@/lib/meditationCaption';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle,
} from '@/components/ui/dialog';
import MeditationEditor from '@/components/admin/MeditationEditor';

const MEDITATION_TEXT_RECOMMENDED_LIMIT = 2200;

type Cfg = {
  id: string;
  topic_vi: string;
  topic_en: string;
  zoom_url: string;
  zoom_id: string;
  zoom_pw: string;
  youtube_community_url: string;
  youtube_happy_url: string;
  facebook_url: string;
  funprofile_url: string;
  telegram_url: string;
  x_url: string;
  image_path: string | null;
  image_prompt: string;
  target_chat_ids: string[];
  send_times_vn: string[];
  enabled: boolean;
};

const LINK_FIELDS: Array<{ key: keyof Cfg; label: string }> = [
  { key: 'zoom_url', label: 'Zoom URL' },
  { key: 'youtube_community_url', label: 'YouTube – Thiền Cộng Đồng' },
  { key: 'youtube_happy_url', label: 'YouTube – Happy Camly Coin' },
  { key: 'facebook_url', label: 'Facebook' },
  { key: 'funprofile_url', label: 'FUN Profile' },
  { key: 'telegram_url', label: 'Telegram Live' },
  { key: 'x_url', label: 'X (Twitter)' },
];

export default function AdminMeditation() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [form, setForm] = useState<Cfg | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const userKey = user?.id ?? 'anon';
  const LS = {
    testChat: `meditation_test_chat_id::${userKey}`,
    draft: `meditation_caption_draft::${userKey}`,
    autosync: `meditation_caption_autosync::${userKey}`,
    drafts: `meditation_caption_drafts_v1::${userKey}`,
    active: `meditation_caption_active_draft::${userKey}`,
  };
  const [testChatId, setTestChatId] = useState<string>('');
  const [confirmBroadcast, setConfirmBroadcast] = useState(false);
  const [captionDraft, setCaptionDraft] = useState<string>('');
  const [autoSync, setAutoSync] = useState<boolean>(true);
  type SavedDraft = { caption: string; savedAt: string };
  const [savedDrafts, setSavedDrafts] = useState<Record<string, SavedDraft>>({});
  const [draftName, setDraftName] = useState<string>('');

  // Group manager
  const [newGroupId, setNewGroupId] = useState('');

  // Link update dialog
  const [linkDialog, setLinkDialog] = useState<{ key: keyof Cfg; label: string; value: string } | null>(null);

  const persistDrafts = (next: Record<string, SavedDraft>) => {
    setSavedDrafts(next);
    localStorage.setItem(LS.drafts, JSON.stringify(next));
  };

  useEffect(() => {
    setTestChatId(localStorage.getItem(LS.testChat) || '');
    setCaptionDraft(localStorage.getItem(LS.draft) || '');
    setAutoSync(localStorage.getItem(LS.autosync) !== 'false');
    try { setSavedDrafts(JSON.parse(localStorage.getItem(LS.drafts) || '{}')); }
    catch { setSavedDrafts({}); }
    setDraftName(localStorage.getItem(LS.active) || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userKey]);

  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    supabase.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [user]);

  const { data: cfg, isLoading } = useQuery({
    queryKey: ['meditation-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meditation_schedule_config').select('*').limit(1).maybeSingle();
      if (error) throw error;
      return data as Cfg;
    },
    enabled: isAdmin === true,
  });

  useEffect(() => { if (cfg) setForm(cfg); }, [cfg]);

  useEffect(() => {
    if (!form?.image_path) { setImagePreview(null); return; }
    supabase.storage.from('meditation-images')
      .createSignedUrl(form.image_path, 3600)
      .then(({ data }) => setImagePreview(data?.signedUrl ?? null));
  }, [form?.image_path]);

  useEffect(() => {
    if (!form || !autoSync) return;
    setCaptionDraft(buildMeditationCaption(form));
  }, [form, autoSync]);

  useEffect(() => { localStorage.setItem(LS.draft, captionDraft); }, [captionDraft]);
  useEffect(() => { localStorage.setItem(LS.autosync, String(autoSync)); }, [autoSync]);

  const { data: logs } = useQuery({
    queryKey: ['meditation-log'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meditation_post_log').select('*')
        .order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      return data;
    },
    enabled: isAdmin === true,
    refetchInterval: 30_000,
  });

  const saveMut = useMutation({
    mutationFn: async (f: Cfg) => {
      const { error } = await supabase.from('meditation_schedule_config')
        .update({
          topic_vi: f.topic_vi, topic_en: f.topic_en,
          zoom_url: f.zoom_url, zoom_id: f.zoom_id, zoom_pw: f.zoom_pw,
          youtube_community_url: f.youtube_community_url,
          youtube_happy_url: f.youtube_happy_url,
          facebook_url: f.facebook_url,
          funprofile_url: f.funprofile_url,
          telegram_url: f.telegram_url,
          x_url: f.x_url,
          image_path: f.image_path,
          image_prompt: f.image_prompt,
          target_chat_ids: f.target_chat_ids,
          send_times_vn: f.send_times_vn,
          enabled: f.enabled,
          updated_by: user?.id ?? null,
        }).eq('id', f.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: '💛 Đã lưu cấu hình' });
      qc.invalidateQueries({ queryKey: ['meditation-config'] });
    },
    onError: (e: any) => toast({ title: 'Lỗi lưu', description: e.message, variant: 'destructive' }),
  });

  // Partial patch that saves immediately (used by per-link update).
  const patchAndSave = async (patch: Partial<Cfg>) => {
    if (!form) return;
    const next = { ...form, ...patch };
    setForm(next);
    const { error } = await supabase.from('meditation_schedule_config')
      .update({ ...patch, updated_by: user?.id ?? null })
      .eq('id', form.id);
    if (error) {
      toast({ title: 'Lỗi lưu', description: error.message, variant: 'destructive' });
      return;
    }
    qc.invalidateQueries({ queryKey: ['meditation-config'] });
  };

  const sendNowMut = useMutation({
    mutationFn: async (opts: { chatId?: string; caption?: string }) => {
      const { data, error } = await supabase.functions.invoke('meditation-broadcast', {
        body: { slot: 'manual', chat_id: opts.chatId, caption_override: opts.caption },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      const failed = Array.isArray(data?.results) ? data.results.find((r: any) => r?.error) : null;
      if (failed) {
        toast({
          title: 'Gửi thất bại',
          description: `${failed.chat_id}: ${failed.error}`.slice(0, 240),
          variant: 'destructive',
        });
        qc.invalidateQueries({ queryKey: ['meditation-log'] });
        return;
      }
      toast({ title: '✨ Đã gửi', description: JSON.stringify(data?.results ?? data).slice(0, 200) });
      qc.invalidateQueries({ queryKey: ['meditation-log'] });
    },
    onError: (e: any) => toast({ title: 'Gửi thất bại', description: e.message, variant: 'destructive' }),
  });

  const uploadImage = async (file: File) => {
    const path = `admin/${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`;
    const { error } = await supabase.storage.from('meditation-images').upload(path, file, {
      contentType: file.type, upsert: false,
    });
    if (error) { toast({ title: 'Upload lỗi', description: error.message, variant: 'destructive' }); return; }
    setForm((f) => f ? { ...f, image_path: path } : f);
    toast({ title: '🌟 Ảnh đã upload — nhớ bấm Lưu' });
  };

  if (isAdmin === null || isLoading) return <div className="p-8"><Loader2 className="animate-spin" /></div>;
  if (!isAdmin) {
    return (
      <div className="p-8 text-center">
        <p>Chỉ admin mới truy cập trang này.</p>
        <Button onClick={() => navigate('/')} className="mt-4">Về trang chủ</Button>
      </div>
    );
  }
  if (!form) return null;

  const update = (patch: Partial<Cfg>) => setForm({ ...form, ...patch });

  const addGroup = () => {
    const id = newGroupId.trim();
    if (!id) return;
    if (!/^-?\d+$/.test(id)) {
      toast({ title: 'Group ID không hợp lệ', description: 'Chat ID phải là số (thường bắt đầu -100...).', variant: 'destructive' });
      return;
    }
    if (form.target_chat_ids.includes(id)) {
      toast({ title: 'Đã có trong danh sách', variant: 'destructive' });
      return;
    }
    update({ target_chat_ids: [...form.target_chat_ids, id] });
    setNewGroupId('');
  };

  const removeGroup = (id: string) => {
    update({ target_chat_ids: form.target_chat_ids.filter((x) => x !== id) });
  };

  return (
    <div className="container mx-auto max-w-4xl p-4 pb-20 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">🌟 Lịch Thiền</h1>
          <p className="text-sm text-muted-foreground">
            Chỉ gửi khi admin bấm nút — tự động (cron) đã tắt.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="enabled">Cho phép gửi</Label>
          <Switch id="enabled" checked={form.enabled} onCheckedChange={(v) => update({ enabled: v })} />
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Chủ đề</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Chủ đề (Tiếng Việt)</Label>
            <Textarea value={form.topic_vi} onChange={(e) => update({ topic_vi: e.target.value })} /></div>
          <div><Label>Topic (English)</Label>
            <Textarea value={form.topic_en} onChange={(e) => update({ topic_en: e.target.value })} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Links Livestream</CardTitle>
          <p className="text-xs text-muted-foreground">
            Bấm 🔄 bên phải mỗi link để cập nhật nhanh và lưu ngay lập tức.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {LINK_FIELDS.map(({ key, label }) => (
            <div key={key}>
              <Label>{label}</Label>
              <div className="flex gap-2">
                <Input value={(form[key] as string) ?? ''} onChange={(e) => update({ [key]: e.target.value } as Partial<Cfg>)} />
                <Button
                  type="button" variant="outline" size="icon" title="Cập nhật link này"
                  onClick={() => setLinkDialog({ key, label, value: (form[key] as string) ?? '' })}
                >
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Zoom ID</Label><Input value={form.zoom_id} onChange={(e) => update({ zoom_id: e.target.value })} /></div>
            <div><Label>Zoom Password</Label><Input value={form.zoom_pw} onChange={(e) => update({ zoom_pw: e.target.value })} /></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Ảnh đính kèm</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {imagePreview ? (
            <div className="space-y-2">
              <img src={imagePreview} alt="meditation" className="rounded-lg max-h-64 mx-auto" />
              <Button variant="outline" size="sm" onClick={() => update({ image_path: null })}>
                <Trash2 className="w-4 h-4 mr-1" /> Xoá ảnh — để AI tự tạo
              </Button>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <ImageIcon className="w-4 h-4" /> Chưa có ảnh — AI sẽ tự tạo theo prompt bên dưới
            </div>
          )}
          <label className="block">
            <input type="file" accept="image/*" className="hidden"
              onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])} />
            <span className="inline-flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer hover:bg-muted text-sm">
              <Upload className="w-4 h-4" /> Upload ảnh mới
            </span>
          </label>
          <div>
            <Label>Prompt cho AI tạo ảnh (dùng khi không có ảnh admin)</Label>
            <Textarea rows={3} value={form.image_prompt} onChange={(e) => update({ image_prompt: e.target.value })} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Nhóm Telegram đã đăng ký</CardTitle>
          <p className="text-xs text-muted-foreground">
            Chỉ các nhóm trong danh sách này mới nhận lịch thiền khi admin bấm gửi.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Thêm Group ID (ví dụ: -1001234567890)"
              value={newGroupId}
              onChange={(e) => setNewGroupId(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addGroup(); } }}
            />
            <Button type="button" onClick={addGroup} disabled={!newGroupId.trim()}>
              <Plus className="w-4 h-4 mr-1" /> Thêm
            </Button>
          </div>
          {form.target_chat_ids.length === 0 ? (
            <p className="text-sm text-muted-foreground py-3 text-center border rounded-md">
              Chưa có nhóm nào. Thêm Group ID phía trên để bắt đầu.
            </p>
          ) : (
            <div className="space-y-1 max-h-64 overflow-auto rounded-md border bg-muted/20 p-2">
              {form.target_chat_ids.map((id) => (
                <div key={id} className="flex items-center gap-2 text-sm p-2 rounded hover:bg-muted">
                  <Badge variant="secondary" className="font-mono">{id}</Badge>
                  <div className="flex-1" />
                  <Button size="sm" variant="ghost" onClick={() => removeGroup(id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Nhớ bấm <b>💾 Lưu cấu hình</b> phía cuối trang để lưu thay đổi danh sách nhóm.
          </p>
        </CardContent>
      </Card>

      {/* WYSIWYG editor */}
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">✍️ Chỉnh sửa nội dung lịch thiền</span>
            <span className="flex items-center gap-2 text-sm font-normal">
              <Label htmlFor="autosync" className="cursor-pointer">Tự động cập nhật từ template</Label>
              <Switch id="autosync" checked={autoSync} onCheckedChange={setAutoSync} />
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <MeditationEditor
            value={captionDraft}
            onChange={(tg) => { setAutoSync(false); setCaptionDraft(tg); }}
            onRestore={() => { setAutoSync(false); setCaptionDraft(buildMeditationCaption(form)); }}
          />
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              Chọn chữ rồi bấm <b>B</b> / <i>I</i> / Link ở thanh công cụ.
            </span>
            <span className={captionDraft.length > MEDITATION_TEXT_RECOMMENDED_LIMIT ? 'text-amber-600' : 'text-muted-foreground'}>
              {captionDraft.length} / {MEDITATION_TEXT_RECOMMENDED_LIMIT} {captionDraft.length > MEDITATION_TEXT_RECOMMENDED_LIMIT && '⚠️ vượt khối lượng khuyến nghị'}
            </span>
          </div>

          {/* Saved drafts */}
          <div className="mt-4 pt-4 border-t space-y-2">
            <div className="flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-primary" />
              <Label className="text-sm font-semibold">Lưu nháp theo từng lịch thiền</Label>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Tên bản nháp (vd: Sáng 04:45)"
                value={draftName}
                onChange={(e) => { setDraftName(e.target.value); localStorage.setItem(LS.active, e.target.value); }}
              />
              <Button
                size="sm" variant="default"
                disabled={!draftName.trim() || !captionDraft.trim()}
                onClick={() => {
                  const name = draftName.trim();
                  persistDrafts({ ...savedDrafts, [name]: { caption: captionDraft, savedAt: new Date().toISOString() } });
                  toast({ title: '💾 Đã lưu nháp', description: `"${name}"` });
                }}
              >
                <Save className="w-4 h-4 mr-1" /> Lưu nháp
              </Button>
            </div>

            {Object.keys(savedDrafts).length > 0 && (
              <div className="space-y-1 max-h-48 overflow-auto rounded-md border bg-muted/30 p-2">
                {Object.entries(savedDrafts)
                  .sort(([, a], [, b]) => (b.savedAt || '').localeCompare(a.savedAt || ''))
                  .map(([name, d]) => {
                    const isActive = name === draftName.trim();
                    return (
                      <div key={name} className={`flex items-center gap-2 text-xs p-2 rounded ${isActive ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted'}`}>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{name} {isActive && <span className="text-primary">●</span>}</div>
                          <div className="text-muted-foreground">
                            {new Date(d.savedAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })} • {d.caption.length} ký tự
                          </div>
                        </div>
                        <Button
                          size="sm" variant="outline"
                          onClick={() => {
                            setAutoSync(false);
                            setCaptionDraft(d.caption);
                            setDraftName(name);
                            localStorage.setItem(LS.active, name);
                            toast({ title: '📂 Đã tải nháp', description: `"${name}"` });
                          }}
                        >
                          Tải
                        </Button>
                        <Button
                          size="sm" variant="ghost"
                          onClick={() => {
                            const next = { ...savedDrafts }; delete next[name]; persistDrafts(next);
                            toast({ title: '🗑️ Đã xoá nháp', description: `"${name}"` });
                          }}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-primary" /> Xem trước (như Telegram sẽ hiển thị)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="max-w-md mx-auto rounded-2xl overflow-hidden bg-white shadow-md border">
              {imagePreview ? (
                <img src={imagePreview} alt="preview" className="w-full aspect-video object-cover" />
              ) : (
                <div className="w-full aspect-video bg-gradient-to-br from-amber-100 to-yellow-50 flex items-center justify-center text-amber-700 text-sm">
                  <ImageIcon className="w-5 h-5 mr-2" /> AI sẽ tự tạo ảnh khi gửi
                </div>
              )}
            </div>
            <div className="max-w-md mx-auto rounded-2xl bg-white shadow-md border p-3 text-sm text-slate-800 leading-relaxed [&_a]:text-blue-600 [&_a]:underline">
              <div dangerouslySetInnerHTML={{ __html: captionToPreviewHtml(captionDraft) }} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Test send */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube2 className="w-5 h-5 text-primary" /> Gửi thử riêng cho bạn
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Chat ID cá nhân (nhắn @userinfobot để lấy)</Label>
            <Input
              placeholder="Ví dụ: 123456789"
              value={testChatId}
              onChange={(e) => { setTestChatId(e.target.value); localStorage.setItem(LS.testChat, e.target.value); }}
            />
          </div>
          <Button
            variant="outline" className="w-full"
            disabled={!testChatId.trim() || sendNowMut.isPending}
            onClick={() => sendNowMut.mutate({ chatId: testChatId.trim(), caption: captionDraft })}
          >
            {sendNowMut.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <TestTube2 className="w-4 h-4 mr-1" />}
            Gửi thử cho tôi (không gửi vào nhóm)
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-col sm:flex-row gap-2">
        <Button onClick={() => saveMut.mutate(form)} disabled={saveMut.isPending} className="flex-1">
          {saveMut.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} 💾 Lưu cấu hình
        </Button>
        <Button
          variant="secondary"
          onClick={() => setConfirmBroadcast(true)}
          disabled={sendNowMut.isPending || form.target_chat_ids.length === 0}
        >
          {sendNowMut.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
          📤 Gửi lịch thiền vào các nhóm đã đăng ký ({form.target_chat_ids.length})
        </Button>
      </div>

      <AlertDialog open={confirmBroadcast} onOpenChange={setConfirmBroadcast}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bạn có chắc chắn gửi lịch thiền vào các nhóm đã đăng ký hay không?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                Sẽ gửi tới <b>{form.target_chat_ids.length} nhóm</b>:
                <div className="font-mono text-xs mt-1 max-h-32 overflow-auto">
                  {form.target_chat_ids.join(', ')}
                </div>
                <div className="mt-2">Khuyến nghị: bấm "Gửi thử cho tôi" trước để kiểm tra.</div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction onClick={() => sendNowMut.mutate({ caption: captionDraft })}>
              Xác nhận gửi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Per-link update dialog */}
      <Dialog open={!!linkDialog} onOpenChange={(open) => !open && setLinkDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LinkIcon className="w-4 h-4" /> Cập nhật {linkDialog?.label}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Link mới</Label>
            <Input
              value={linkDialog?.value ?? ''}
              onChange={(e) => setLinkDialog((d) => d ? { ...d, value: e.target.value } : d)}
              placeholder="https://..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialog(null)}>Huỷ</Button>
            <Button
              onClick={async () => {
                if (!linkDialog) return;
                await patchAndSave({ [linkDialog.key]: linkDialog.value } as Partial<Cfg>);
                toast({ title: `🔗 Đã cập nhật ${linkDialog.label}` });
                setLinkDialog(null);
              }}
            >
              Cập nhật
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader><CardTitle>Nhật ký gửi (50 dòng gần nhất)</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-1 text-xs max-h-96 overflow-auto">
            {logs?.length ? logs.map((l: any) => (
              <div key={l.id} className="flex items-center gap-2 py-1 border-b">
                <Badge variant={l.status === 'sent' ? 'default' : 'destructive'}>{l.status}</Badge>
                <span className="font-mono">{l.slot}</span>
                <span>{l.sent_date}</span>
                <span className="font-mono text-muted-foreground">{l.chat_id}</span>
                {l.error && <span className="text-destructive truncate">{l.error}</span>}
              </div>
            )) : <p className="text-muted-foreground">Chưa có log.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
