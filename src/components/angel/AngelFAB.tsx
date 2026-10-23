import { useEffect, useRef, useState } from 'react';
import { Sparkles, X, Send, Loader2 } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import angelAvatar from '@/assets/angel-avatar.jpg';
import { Button } from '@/components/ui/button';
import { clampFabPosition, loadFabPosition, isCaptionGuest, FAB_POSITION_KEY, FAB_DRAG_THRESHOLD, type FabPosition } from './fabPosition';

type ChatMessage = { role: 'user' | 'assistant'; content: string; ts: number; imageUrl?: string };

// Client-side image intent detector (mirror server _shared/angel-image.ts)
const IMAGE_GEN_RE = /\b(vẽ|tạo (?:ra )?(?:một |1 )?(?:cái |bức |tấm )?(?:ảnh|hình|tranh)|thiết kế (?:ảnh|hình|tranh|poster|thumbnail)|generate (?:an? )?image|make (?:an? )?(?:picture|image)|draw (?:me |an? )?|paint (?:me |an? )?|create (?:an? )?image|imagine\b|render (?:an? )?image)/i;
function detectImageIntentClient(text: string): boolean {
  return IMAGE_GEN_RE.test(text);
}

const HIDDEN_ROUTES = [
  '/auth',
  '/set-password',
  '/law-of-light',
  '/begin',
];

const HIDDEN_PREFIXES = [
  '/live/', // hide on any live page (host/audience/studio)
];

function shouldHide(pathname: string): boolean {
  if (HIDDEN_ROUTES.includes(pathname)) return true;
  if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  return false;
}

function storageKey(userId: string) {
  return `angel-fab-history:${userId}`;
}

function loadHistory(userId: string): ChatMessage[] {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(-50);
  } catch {
    return [];
  }
}

function saveHistory(userId: string, msgs: ChatMessage[]) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(msgs.slice(-50)));
  } catch {
    // ignore quota errors
  }
}

export function AngelFAB() {
  const { user } = useAuth();
  const location = useLocation();
  const guest = isCaptionGuest(location.pathname, user);
  const [guestId] = useState(() => {
    try {
      const existing = localStorage.getItem('angel-fab-guest-id');
      if (existing && /^[0-9a-f-]{36}$/i.test(existing)) return existing;
      const id = crypto.randomUUID();
      localStorage.setItem('angel-fab-guest-id', id);
      return id;
    } catch { return crypto.randomUUID(); }
  });
  const historyId = user?.id ?? (guest ? `guest:${guestId}` : null);
  const [position, setPosition] = useState<FabPosition | null>(() => loadFabPosition(localStorage, window.innerWidth, window.innerHeight));
  const drag = useRef<{ id: number; startX: number; startY: number; offsetX: number; offsetY: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const resize = () => setPosition(previous => previous ? clampFabPosition(previous, window.innerWidth, window.innerHeight) : null);
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    if (!position) return;
    try { localStorage.setItem(FAB_POSITION_KEY, JSON.stringify(position)); } catch { /* Storage may be unavailable. */ }
  }, [position]);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setMessages(historyId ? loadHistory(historyId) : []);
      return;
    }
    // Load local trước để UI hiện ngay, sau đó merge với server
    setMessages(loadHistory(user.id));
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('angel-web-history', {
          method: 'GET' as never,
        });
        if (error) return;
        const rows = (data as { messages?: Array<{ role: 'user' | 'assistant'; content: string; created_at: string }> })?.messages;
        if (!Array.isArray(rows) || rows.length === 0) return;
        const server: ChatMessage[] = rows.map((r) => ({
          role: r.role,
          content: r.content,
          ts: new Date(r.created_at).getTime(),
        }));
        // Server là nguồn sự thật cho cross-device — thay thế
        if (!cancelled) setMessages(server.slice(-50));
      } catch {
        // fail silently, giữ localStorage
      }
    })();
    return () => { cancelled = true; };
  }, [user, historyId]);

  useEffect(() => {
    if (!historyId) return;
    // Avoid saving the previous identity's messages during an identity transition.
    // Load occurs in the effect above; save only explicit chat changes below.
  }, [historyId]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      inputRef.current?.focus();
    }, 100);
    return () => clearTimeout(t);
  }, [open, messages.length]);

  const askAngel = useMutation({
    mutationFn: async (history: ChatMessage[]) => {
      const last = history[history.length - 1];
      // === IMAGE INTENT SHORT-CIRCUIT ===
      if (!guest && last?.role === 'user' && detectImageIntentClient(last.content)) {
        const { data, error } = await supabase.functions.invoke('angel-image', {
          body: { mode: 'generate', prompt: last.content, source: 'web' },
        });
        if (error) throw error;
        const d = data as { ok?: boolean; image_url?: string | null; data_url?: string | null; user_message?: string };
        if (!d?.ok) throw new Error(d?.user_message || 'Angel chưa vẽ được');
        const url = d.image_url || d.data_url || '';
        if (!url) throw new Error('Empty image');
        return { text: 'Angel vẽ cho bé đây ✨💛', imageUrl: url };
      }
      const { data, error } = await supabase.functions.invoke('angel-chat', {
        body: { messages: history.map((m) => ({ role: m.role, content: m.content })), ...(guest ? { guest: true, guest_id: guestId } : {}) },
      });
      if (error) {
        const context = (error as { context?: Response }).context;
        const details = await context?.clone().json().catch(() => null);
        throw new Error(details?.error || error.message);
      }
      const reply = (data as { reply?: string })?.reply;
      if (!reply) throw new Error('Empty reply');
      return { text: reply };
    },
    onSuccess: (result) => {
      setMessages((prev) => {
        const next: ChatMessage[] = [...prev, { role: 'assistant', content: result.text, ts: Date.now(), imageUrl: result.imageUrl }];
        if (historyId) saveHistory(historyId, next);
        return next;
      });
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : 'Angel chưa thể trả lời';
      toast.error(msg.includes('429') ? 'Bé yêu, Angel cần nghỉ chút. Bé thử lại sau nhé 💛' : `Angel: ${msg}`);
    },
  });

  if ((!user && !guest) || shouldHide(location.pathname)) return null;

  const handleSend = () => {
    const text = input.trim();
    if (!text || askAngel.isPending) return;
    const next: ChatMessage[] = [
      ...messages,
      { role: 'user', content: text, ts: Date.now() },
    ];
    setMessages(next);
    if (historyId) saveHistory(historyId, next);
    setInput('');
    askAngel.mutate(next);
  };

  const handleClearHistory = async () => {
    setMessages([]);
    if (historyId) saveHistory(historyId, []);
    if (guest) return;
    try {
      await supabase.functions.invoke('angel-web-history', { method: 'DELETE' as never });
    } catch {
      // ignore
    }
  };

  return (
    <>
      {/* Floating Button */}
      <Button
        variant="ghost"
        size="icon"
        onPointerDown={(event) => {
          if (!event.isPrimary || event.button !== 0) return;
          const rect = event.currentTarget.getBoundingClientRect();
          suppressClick.current = false;
          drag.current = { id: event.pointerId, startX: event.clientX, startY: event.clientY, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top, moved: false };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const active = drag.current;
          if (!active || active.id !== event.pointerId) return;
          if (Math.hypot(event.clientX - active.startX, event.clientY - active.startY) >= FAB_DRAG_THRESHOLD) active.moved = true;
          if (active.moved) setPosition(clampFabPosition({ x: event.clientX - active.offsetX, y: event.clientY - active.offsetY }, window.innerWidth, window.innerHeight));
        }}
        onPointerUp={(event) => {
          const active = drag.current;
          if (!active || active.id !== event.pointerId) return;
          suppressClick.current = active.moved;
          drag.current = null;
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => { suppressClick.current = true; drag.current = null; }}
        onClick={() => {
          if (suppressClick.current) { suppressClick.current = false; return; }
          setOpen(previous => !previous);
        }}
        style={position ? { left: position.x, top: position.y, right: 'auto', bottom: 'auto' } : undefined}
        aria-label="Hỏi Angel AI"
        title="Hỏi Angel AI ✨"
        className={cn(
          'fixed z-40 flex items-center justify-center',
          'right-4 bottom-24 md:right-6 md:bottom-6',
          'w-14 h-14 p-0 rounded-full touch-none select-none cursor-grab active:cursor-grabbing',
          'bg-background shadow-lg border-2 border-gold hover:bg-background hover:border-gold',
          'transition-none',
          'group',
        )}
      >
        <span className="pointer-events-none absolute inset-0 rounded-full bg-gold/60 motion-safe:animate-ping opacity-40" />
        <img
          src={angelAvatar}
          alt="Angel"
          draggable={false}
          className="pointer-events-none relative w-10 h-10 rounded-full object-cover ring-2 ring-background"
        />
        <span className="pointer-events-none absolute -top-1 -right-1 bg-background rounded-full p-0.5 shadow-md">
          <Sparkles className="w-3.5 h-3.5 text-gold" />
        </span>
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="p-0 w-full max-w-full sm:max-w-md h-[100dvh] flex flex-col gap-0 bg-background [&>button:last-child]:hidden"
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b bg-white/80 backdrop-blur">
            <img src={angelAvatar} alt="Angel" className="w-10 h-10 rounded-full object-cover ring-2 ring-yellow-300" />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm flex items-center gap-1.5">
                Angel AI
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              </div>
              <div className="text-[11px] text-muted-foreground">Trợ lý ánh sáng · luôn online</div>
            </div>
            {messages.length > 0 && (
              <button
                onClick={handleClearHistory}
                className="text-[11px] text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted"
              >
                Xoá
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-full hover:bg-muted"
              aria-label="Đóng"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-center py-8">
                <img src={angelAvatar} alt="Angel" className="w-16 h-16 rounded-full object-cover mx-auto mb-3 ring-4 ring-yellow-200" />
                <p className="font-medium text-sm">Chào bé, Angel ở đây ✨</p>
                <p className="text-xs text-muted-foreground mt-1 px-4">
                  Bé hỏi Angel bất cứ điều gì về FUN.RICH, FUN Profile, hay hành trình ánh sáng của bé nhé 💛
                </p>
                <div className="mt-4 flex flex-wrap gap-2 justify-center">
                  {['FUN.RICH là gì?', 'Hồ Sơ Ánh Sáng?', 'What is CAMLY?'].map((q) => (
                    <button
                      key={q}
                      onClick={() => {
                        setInput(q);
                        setTimeout(() => inputRef.current?.focus(), 0);
                      }}
                      className="text-[11px] px-3 py-1.5 rounded-full bg-white border border-yellow-200 hover:bg-yellow-50 transition"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}
              >
                {m.role === 'assistant' && (
                  <img src={angelAvatar} alt="" className="w-7 h-7 rounded-full mr-2 mt-1 object-cover flex-shrink-0" />
                )}
                <div
                  className={cn(
                    'max-w-[78%] px-3.5 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words leading-relaxed',
                    m.role === 'user'
                      ? 'bg-gradient-to-br from-amber-400 to-yellow-500 text-white rounded-br-sm shadow'
                      : 'bg-white border border-yellow-100 rounded-bl-sm shadow-sm',
                  )}
                >
                  {m.imageUrl && (
                    <img
                      src={m.imageUrl}
                      alt="Angel vẽ"
                      className="rounded-xl mb-2 max-w-full h-auto"
                      loading="lazy"
                    />
                  )}
                  {m.content}
                </div>
              </div>
            ))}
            {askAngel.isPending && (
              <div className="flex justify-start">
                <img src={angelAvatar} alt="" className="w-7 h-7 rounded-full mr-2 mt-1 object-cover" />
                <div className="bg-white border border-yellow-100 rounded-2xl rounded-bl-sm px-3.5 py-2 shadow-sm flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Angel đang viết...
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t bg-white/80 backdrop-blur px-3 py-3 space-y-1.5">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Gõ tin nhắn để hỏi Angel..."
                rows={1}
                maxLength={1500}
                className="flex-1 resize-none rounded-2xl border border-yellow-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-300 max-h-32"
                disabled={askAngel.isPending}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || askAngel.isPending}
                className={cn(
                  'h-10 w-10 rounded-full flex items-center justify-center shrink-0 transition',
                  input.trim() && !askAngel.isPending
                    ? 'bg-gradient-to-br from-amber-400 to-yellow-500 text-white shadow hover:scale-105'
                    : 'bg-muted text-muted-foreground',
                )}
                aria-label="Gửi"
              >
                {askAngel.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground text-center">
              ✍️ Gõ <code className="bg-muted px-1 rounded">@angel</code> trong group chat để gọi Angel ở đó
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

export default AngelFAB;
