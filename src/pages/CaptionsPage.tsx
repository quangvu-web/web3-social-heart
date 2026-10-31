// Trang phụ đề trực tiếp Angel Translator — công khai theo mã phiên, không cần đăng nhập.
// Nhận dòng mới qua Supabase Realtime (INSERT trên caption_lines, lọc theo session_id).
import { memo, useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Minus, Plus, Loader2, ArrowDown } from "lucide-react";

import { CaptionThemePicker } from "@/components/captions/CaptionThemePicker";
import { readCaptionTheme, saveCaptionTheme, type CaptionTheme } from "@/components/captions/captionThemes";

type SessionStatus = "pending" | "joining" | "live" | "ended" | "failed";

interface CaptionSession {
  id: string;
  public_code: string;
  status: SessionStatus;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
}

interface CaptionLine {
  id: string;
  seq: number;
  speaker_name: string | null;
  source_lang: string | null;
  text_source: string;
  text_vi: string | null;
  text_en: string | null;
}

interface CaptionPartial {
  session_id: string;
  speaker_name: string | null;
  text_source: string;
  updated_at: string;
}

// caption_partials is introduced by a migration; generated database types are protected.
const partialsDb = supabase as unknown as SupabaseClient;

type ViewMode = "vi" | "en" | "both";

const SPEAKING_WIDTH_KEY = "caption-speaking-panel-width";
const SPEAKING_HEIGHT_KEY = "caption-speaking-panel-height-em";
const DEFAULT_SPEAKING_HEIGHT = 8.25;

function readSpeakingHeight(): number {
  try {
    const stored = window.localStorage.getItem(SPEAKING_HEIGHT_KEY);
    const height = stored === null ? NaN : Number(stored);
    return Number.isFinite(height) && height >= 4 ? height : DEFAULT_SPEAKING_HEIGHT;
  } catch {
    return DEFAULT_SPEAKING_HEIGHT;
  }
}

function readSpeakingWidth(): number {
  try {
    const stored = window.localStorage.getItem(SPEAKING_WIDTH_KEY);
    const width = stored === null ? NaN : Number(stored);
    return Number.isFinite(width) && width >= 35 && width <= 100 ? width : 100;
  } catch {
    return 100;
  }
}

const STATUS_LABEL: Record<SessionStatus, string> = {
  pending: "Đang chờ bot vào phòng…",
  joining: "Đang chờ bot vào phòng…",
  live: "🔴 Đang trực tiếp",
  ended: "Buổi họp đã kết thúc",
  failed: "Phiên phụ đề gặp lỗi",
};

function formatDuration(startIso: string | null, endIso: string | null, now: number): string {
  if (!startIso) return "00:00";
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : now;
  const sec = Math.max(0, Math.floor((end - start) / 1000));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

// Cỡ chữ dòng dịch: theo tỉ lệ 88% dòng gốc (sát kích thước, đọc rõ cho
// khách quốc tế) nhưng không bao giờ nhỏ hơn 16px. Phân cấp chính/phụ
// thể hiện bằng màu, không bằng cỡ chữ.
export function captionSubFontSize(fontSize: number): number {
  return Math.max(16, Math.round(fontSize * 0.88));
}


export const CaptionRow = memo(function CaptionRow({ line, mode, fontSize }: { line: CaptionLine; mode: ViewMode; fontSize: number }) {
  const vi = line.text_vi ?? (line.source_lang === "vi" ? line.text_source : null);
  const en = line.text_en ?? (line.source_lang === "en" ? line.text_source : null);
  const main = mode === "vi" ? vi : mode === "en" ? en : (vi ?? en);
  const sub = mode === "both" ? (main === vi ? en : vi) : null;
  return (
    <div className="px-4 py-3 border-b border-caption-border/60">
      {line.speaker_name && (
        <div className="text-sm font-semibold text-caption-speaker mb-1">{line.speaker_name}</div>
      )}
      <div className="font-medium leading-snug text-caption-foreground" style={{ fontSize }}>
        {main ?? line.text_source}
      </div>
      {sub && (
        <div className="mt-1 text-caption-muted leading-snug" style={{ fontSize: captionSubFontSize(fontSize) }}>
          {sub}
        </div>
      )}
    </div>
  );
});

// Partial state and the ticking clock live outside this memo boundary.
export const CaptionHistory = memo(function CaptionHistory({ lines, mode, fontSize, status }: {
  lines: CaptionLine[]; mode: ViewMode; fontSize: number; status: SessionStatus;
}) {
  return lines.length === 0 ? (
    <div className="p-8 text-center text-caption-muted">
      {status === "live" ? "Đang lắng nghe buổi họp…" : "Chưa có phụ đề nào."}
    </div>
  ) : lines.map((line) => <CaptionRow key={line.id} line={line} mode={mode} fontSize={fontSize} />);
});

export default function CaptionsPage() {
  const { code } = useParams<{ code: string }>();
  const [session, setSession] = useState<CaptionSession | null>(null);
  const [lines, setLines] = useState<CaptionLine[]>([]);
  const [partial, setPartial] = useState<CaptionPartial | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [mode, setMode] = useState<ViewMode>("both");
  const [fontSize, setFontSize] = useState(28);
  const [now, setNow] = useState(Date.now());
  const [jumpState, setJumpState] = useState({ visible: false, count: 0 });

  const [theme, setTheme] = useState<CaptionTheme>(() => readCaptionTheme());
  const [speakingWidth, setSpeakingWidth] = useState(readSpeakingWidth);
  const [speakingHeight, setSpeakingHeight] = useState(readSpeakingHeight);
  const changeTheme = (next: CaptionTheme) => {
    setTheme(next);
    saveCaptionTheme(next);
  };

  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const maxSeq = useRef(0);
  const unreadBase = useRef(0);
  const linesCountRef = useRef(0);
  const autoScrollGuard = useRef(0);
  const speakingPanelRef = useRef<HTMLElement>(null);
  const speakingDrag = useRef<{
    pointerId: number; startX: number; startWidth: number; pageWidth: number; direction: number;
  } | null>(null);

  const speakingHeightDrag = useRef<{
    pointerId: number; startY: number; startHeight: number; fontSize: number;
  } | null>(null);

  // Đồng hồ thời lượng
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Nạp phiên + các dòng đã có, rồi subscribe Realtime
  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let pollTimer: ReturnType<typeof setInterval> | undefined;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let fetching = false;
    let refreshRequested = false;
    maxSeq.current = 0;
    setSession(null);
    setLines([]);
    setPartial(null);
    setNotFound(false);
    stickToBottom.current = true;
    unreadBase.current = 0;
    setJumpState({ visible: false, count: 0 });

    const mergeLines = (incoming: CaptionLine[]) => {
      if (cancelled) return;
      for (const line of incoming) maxSeq.current = Math.max(maxSeq.current, line.seq);
      setLines((prev) => {
        const ids = new Set(prev.map((line) => line.id));
        const added = incoming.filter((line) => {
          if (ids.has(line.id)) return false;
          ids.add(line.id);
          return true;
        });
        return added.length ? [...prev, ...added].sort((a, b) => a.seq - b.seq) : prev;
      });
    };

    let refresh = async () => {};
    const onReturn = () => { void refresh(); };
    const onVisible = () => {
      if (document.visibilityState === "visible") onReturn();
    };

    const load = async () => {
      const { data: sess, error } = await supabase
        .from("caption_sessions")
        .select("id, public_code, status, started_at, ended_at, created_at")
        .eq("public_code", code)
        .maybeSingle();
      if (cancelled) return;
      if (error || !sess) {
        setNotFound(true);
        return;
      }
      setSession(sess as CaptionSession);

      const { data: existing } = await supabase
        .from("caption_lines")
        .select("id, seq, speaker_name, source_lang, text_source, text_vi, text_en")
        .eq("session_id", sess.id)
        .order("seq", { ascending: true })
        .limit(1000);
      if (cancelled) return;
      mergeLines((existing as CaptionLine[]) ?? []);

      const { data: initialPartial } = await partialsDb.from("caption_partials")
        .select("session_id, speaker_name, text_source, updated_at")
        .eq("session_id", sess.id).maybeSingle();
      if (cancelled) return;
      if (initialPartial) setPartial(initialPartial as CaptionPartial);

      refresh = async () => {
        if (cancelled) return;
        if (fetching) {
          refreshRequested = true;
          return;
        }
        fetching = true;
        try {
          // Capture the cursor before concurrent Realtime inserts arrive.
          const cursor = maxSeq.current;
          const [captions, status, currentPartial] = await Promise.all([
            supabase.from("caption_lines")
              .select("id, seq, speaker_name, source_lang, text_source, text_vi, text_en")
              .eq("session_id", sess.id).gt("seq", cursor)
              .order("seq", { ascending: true }).limit(1000),
            supabase.from("caption_sessions")
              .select("id, public_code, status, started_at, ended_at, created_at")
              .eq("id", sess.id).maybeSingle(),
            partialsDb.from("caption_partials")
              .select("session_id, speaker_name, text_source, updated_at")
              .eq("session_id", sess.id).maybeSingle(),
          ]);
          if (cancelled) return;
          if (!captions.error && captions.data) mergeLines(captions.data as CaptionLine[]);
          if (!status.error && status.data) setSession(status.data as CaptionSession);
          if (!currentPartial.error) setPartial((currentPartial.data as CaptionPartial | null) ?? null);
          if (captions.data?.length === 1000) refreshRequested = true;
        } catch {
          // Preserve existing captions; the next polling/return event retries.
        } finally {
          fetching = false;
          if (!cancelled && refreshRequested) {
            refreshRequested = false;
            void refresh();
          }
        }
      };

      const subscribe = () => {
        if (cancelled) return;
        channel = supabase
          .channel(`captions:${sess.id}`)
          .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "caption_lines", filter: `session_id=eq.${sess.id}` },
            (payload) => { mergeLines([payload.new as CaptionLine]); },
          )
          .on(
            "postgres_changes",
            { event: "UPDATE", schema: "public", table: "caption_sessions", filter: `id=eq.${sess.id}` },
            (payload) => { if (!cancelled) setSession(payload.new as CaptionSession); },
          )
          .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "caption_partials", filter: `session_id=eq.${sess.id}` },
            (payload) => {
              if (!cancelled) setPartial(payload.new as CaptionPartial);
            },
          )
          .on(
            "postgres_changes",
            { event: "UPDATE", schema: "public", table: "caption_partials", filter: `session_id=eq.${sess.id}` },
            (payload) => {
              if (!cancelled) setPartial(payload.new as CaptionPartial);
            },
          )
          .on(
            "postgres_changes",
            // DELETE events cannot be filtered by Postgres Changes; compare the primary key locally.
            { event: "DELETE", schema: "public", table: "caption_partials" },
            (payload) => {
              if (!cancelled && (payload.old as { session_id?: string }).session_id === sess.id) setPartial(null);
            },
          )
          .subscribe((status) => {
            if (cancelled) return;
            if (status === "SUBSCRIBED") void refresh();
            if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status) && !reconnectTimer) {
              reconnectTimer = setTimeout(async () => {
                const oldChannel = channel;
                channel = null;
                try {
                  if (oldChannel) await supabase.removeChannel(oldChannel);
                } catch {
                  // A failed socket teardown must not prevent reconnecting.
                } finally {
                  reconnectTimer = undefined;
                  if (!cancelled) subscribe();
                }
              }, 2000);
            }
          });
      };
      subscribe();
      pollTimer = setInterval(() => { void refresh(); }, 4000);
      document.addEventListener("visibilitychange", onVisible);
      window.addEventListener("focus", onReturn);
      window.addEventListener("online", onReturn);
      // Close the gap between initial load and subscribing, even with a dead socket.
      void refresh();
    };

    void load();
    return () => {
      cancelled = true;
      if (pollTimer) clearInterval(pollTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onReturn);
      window.removeEventListener("online", onReturn);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [code]);

  // Tự cuộn xuống dòng mới nhất (tạm dừng khi người dùng cuộn lên).
  // Cuộn trong requestAnimationFrame để chờ DOM/layout cập nhật xong.
  useEffect(() => {
    linesCountRef.current = lines.length;
    const el = scrollRef.current;
    if (stickToBottom.current) {
      if (el) requestAnimationFrame(() => {
        autoScrollGuard.current = Date.now();
        el.scrollTop = el.scrollHeight;
      });
      setJumpState((prev) => (prev.visible ? { visible: false, count: 0 } : prev));
    } else {
      const count = lines.length - unreadBase.current;
      if (count > 0) setJumpState({ visible: true, count });
    }
  }, [lines]);

  // Ngưỡng 160px ≈ chiều cao một dòng phụ đề trên mobile: dao động nhỏ
  // khi nội dung tăng không làm rớt cờ bám đáy.
  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Bỏ qua sự kiện cuộn do chính trang tự cuộn (tránh rớt cờ bám khi
    // dòng mới cao hơn ngưỡng, nhất là trên màn hình điện thoại).
    if (Date.now() - autoScrollGuard.current < 300) return;
    const stuck = el.scrollHeight - el.scrollTop - el.clientHeight < 160;
    if (stuck === stickToBottom.current) return;
    stickToBottom.current = stuck;
    if (stuck) {
      unreadBase.current = linesCountRef.current;
      setJumpState({ visible: false, count: 0 });
    } else {
      unreadBase.current = linesCountRef.current;
    }
  }, []);

  const jumpToLatest = useCallback(() => {
    stickToBottom.current = true;
    unreadBase.current = linesCountRef.current;
    setJumpState({ visible: false, count: 0 });
    const el = scrollRef.current;
    if (el) {
      autoScrollGuard.current = Date.now();
      el.scrollTop = el.scrollHeight;
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(SPEAKING_WIDTH_KEY, String(speakingWidth));
    } catch {
      // Resizing still works when device storage is unavailable.
    }
  }, [speakingWidth]);

  useEffect(() => {
    try {
      window.localStorage.setItem(SPEAKING_HEIGHT_KEY, String(speakingHeight));
    } catch {
      // Keep the in-page selection when device storage is unavailable.
    }
  }, [speakingHeight]);

  const clampSpeakingHeight = (height: number, size = fontSize) =>
    Math.min(Math.max(4, 0.7 * window.innerHeight / size), Math.max(4, height));

  const startSpeakingHeightResize = (event: PointerEvent<HTMLButtonElement>) => {
    const panel = speakingPanelRef.current;
    if (event.button !== 0 || speakingHeightDrag.current || speakingDrag.current || !panel) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    speakingHeightDrag.current = {
      pointerId: event.pointerId, startY: event.clientY,
      // Start from the displayed height if a smaller viewport has capped the saved preference.
      startHeight: panel.getBoundingClientRect().height / fontSize, fontSize,
    };
  };

  const moveSpeakingHeightResize = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = speakingHeightDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setSpeakingHeight(clampSpeakingHeight(drag.startHeight + (drag.startY - event.clientY) / drag.fontSize, drag.fontSize));
  };

  const stopSpeakingHeightResize = (event: PointerEvent<HTMLButtonElement>) => {
    if (speakingHeightDrag.current?.pointerId !== event.pointerId) return;
    speakingHeightDrag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const startSpeakingResize = (event: PointerEvent<HTMLButtonElement>, direction: number) => {
    if (event.button !== 0 || speakingDrag.current || speakingHeightDrag.current) return;
    const panel = speakingPanelRef.current;
    const pageWidth = panel?.parentElement?.getBoundingClientRect().width;
    if (!panel || !pageWidth) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    speakingDrag.current = {
      pointerId: event.pointerId, startX: event.clientX,
      startWidth: panel.getBoundingClientRect().width, pageWidth, direction,
    };
  };

  const moveSpeakingResize = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = speakingDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const minWidth = Math.min(100, Math.max(35, 300 / drag.pageWidth * 100));
    // Both edges move equally because the panel stays centered.
    const width = (drag.startWidth + 2 * drag.direction * (event.clientX - drag.startX)) / drag.pageWidth * 100;
    setSpeakingWidth(Math.min(100, Math.max(minWidth, width)));
  };

  const stopSpeakingResize = (event: PointerEvent<HTMLButtonElement>) => {
    if (speakingDrag.current?.pointerId !== event.pointerId) return;
    speakingDrag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  if (notFound) {
    return (
      <div data-caption-theme={theme} className="min-h-screen bg-caption-background text-caption-foreground flex items-center justify-center p-6">
        <p className="text-xl text-caption-control-foreground">Không tìm thấy phiên phụ đề</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div data-caption-theme={theme} className="min-h-screen bg-caption-background text-caption-foreground flex items-center justify-center p-6">
        <Loader2 className="w-8 h-8 animate-spin text-caption-speaker" />
      </div>
    );
  }

  // Keep the current words visible until the backend commits a final line and clears them.
  const showPartial = session.status === "live" && !!partial?.text_source;

  return (
    <div data-caption-theme={theme} className="h-dvh overflow-hidden bg-caption-background text-caption-foreground flex flex-col">
      {/* Header: trạng thái + đồng hồ + điều khiển */}
      <header className="shrink-0 sticky top-0 z-10 bg-caption-background/95 backdrop-blur border-b border-caption-border px-4 py-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <span className={`text-base font-semibold ${session.status === "live" ? "text-caption-live" : "text-caption-foreground"}`}>
              {STATUS_LABEL[session.status]}
            </span>
            <span className="text-sm text-caption-muted tabular-nums">
              {formatDuration(session.started_at, session.ended_at, now)}
            </span>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <div className="flex rounded-lg overflow-hidden border border-caption-control-border">
              {(["vi", "en", "both"] as ViewMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    mode === m ? "bg-caption-selected text-caption-selected-foreground" : "bg-caption-control/60 text-caption-control-foreground hover:bg-caption-control-hover"
                  }`}
                >
                  {m === "vi" ? "Tiếng Việt" : m === "en" ? "English" : "Song ngữ"}
                </button>
              ))}
            </div>
            <div className="flex shrink-0 items-center gap-2" role="group" aria-label="Cỡ chữ phụ đề">
              <button
                onClick={() => setFontSize((s) => Math.max(18, s - 4))}
                className="p-2 rounded-lg bg-caption-control/60 text-caption-control-foreground hover:bg-caption-control-hover border border-caption-control-border"
                aria-label="Giảm cỡ chữ"
              >
                <Minus className="w-4 h-4" />
              </button>
              <button
                onClick={() => setFontSize((s) => Math.min(48, s + 4))}
                className="p-2 rounded-lg bg-caption-control/60 text-caption-control-foreground hover:bg-caption-control-hover border border-caption-control-border"
                aria-label="Tăng cỡ chữ"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <CaptionThemePicker theme={theme} onChange={changeTheme} />
          </div>
        </div>
      </header>

      {/* Danh sách phụ đề — native div scroll theo quy ước dự án */}
      <div className="relative flex-1 flex flex-col min-h-0">
        <div ref={scrollRef} onScroll={onScroll} aria-label="Lịch sử phụ đề" className="flex-1 min-h-0 overflow-y-auto">
          <CaptionHistory lines={lines} mode={mode} fontSize={fontSize} status={session.status} />
        </div>
        {jumpState.visible && (
          <button
            onClick={jumpToLatest}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-4 py-2 rounded-full bg-caption-selected text-caption-selected-foreground text-sm font-medium shadow-lg shadow-caption-background/40 hover:bg-caption-selected-hover transition-colors"
          >
            <ArrowDown className="w-4 h-4" />
            {jumpState.count > 0 ? `${jumpState.count} dòng mới` : "Dòng mới nhất"}
          </button>
        )}
      </div>
      {/* Mặc định 6 dòng; chiều cao tùy chọn vẫn bám theo cỡ chữ bằng em.
          Partial/chờ luôn dùng cùng các node, độc lập với bám đáy của lịch sử. */}
      {session.status === "live" && (
        <section
          ref={speakingPanelRef}
          aria-label="Người đang nói"
          className="relative mx-auto h-[8.25em] shrink-0 overflow-y-auto overscroll-contain border-t border-caption-border leading-snug italic text-caption-muted"
          style={{
            fontSize, width: `${speakingWidth}%`, minWidth: "min(300px, 100%)",
            height: `${speakingHeight}em`, minHeight: "4em", maxHeight: "max(4em, 70dvh)",
          }}
        >
          <div className="h-full overflow-y-auto overscroll-contain px-4">
            <div className="text-sm min-h-[1.25em] mb-1 font-semibold text-caption-speaker">{showPartial ? partial?.speaker_name ?? "" : ""}</div>
            <div>{showPartial ? `${partial?.text_source}…` : "🎙️ Đang nghe…"}</div>
          </div>
          <button
            type="button"
            aria-label="Đổi chiều cao khung người đang nói"
            title="Kéo để đổi chiều cao; nhấp đúp để về mặc định"
            className="group absolute top-0 left-0 right-0 z-20 flex h-3 touch-none select-none cursor-ns-resize items-center justify-center hover:bg-caption-control/30 focus-visible:bg-caption-control/30 focus-visible:outline-none"
            onPointerDown={startSpeakingHeightResize}
            onPointerMove={moveSpeakingHeightResize}
            onPointerUp={stopSpeakingHeightResize}
            onPointerCancel={stopSpeakingHeightResize}
            onLostPointerCapture={stopSpeakingHeightResize}
            onDoubleClick={() => setSpeakingHeight(DEFAULT_SPEAKING_HEIGHT)}
            onKeyDown={(event) => {
              if (event.key === "Home") {
                event.preventDefault();
                setSpeakingHeight(DEFAULT_SPEAKING_HEIGHT);
              }
              if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                event.preventDefault();
                const panel = speakingPanelRef.current;
                if (!panel) return;
                const height = panel.getBoundingClientRect().height / fontSize;
                setSpeakingHeight(clampSpeakingHeight(height + (event.key === "ArrowUp" ? 0.5 : -0.5)));
              }
            }}
          >
            <span aria-hidden="true" className="w-10 border-t-2 border-caption-border opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
          </button>
          {(["trái", "phải"] as const).map((side) => (
            <button
              key={side}
              type="button"
              aria-label={`Đổi chiều rộng khung từ bên ${side}`}
              title="Kéo để đổi chiều rộng; nhấp đúp để mở rộng toàn trang"
              className={`group absolute inset-y-0 z-10 flex w-3 touch-none select-none cursor-ew-resize items-center justify-center hover:bg-caption-control/30 focus-visible:bg-caption-control/30 focus-visible:outline-none ${side === "trái" ? "left-0" : "right-0"}`}
              onPointerDown={(event) => startSpeakingResize(event, side === "trái" ? -1 : 1)}
              onPointerMove={moveSpeakingResize}
              onPointerUp={stopSpeakingResize}
              onPointerCancel={stopSpeakingResize}
              onLostPointerCapture={stopSpeakingResize}
              onDoubleClick={() => setSpeakingWidth(100)}
              onKeyDown={(event) => {
                if (event.key === "Home") setSpeakingWidth(100);
                if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                  event.preventDefault();
                  const pageWidth = speakingPanelRef.current?.parentElement?.getBoundingClientRect().width;
                  if (!pageWidth) return;
                  const minWidth = Math.min(100, Math.max(35, 300 / pageWidth * 100));
                  const direction = (event.key === "ArrowRight" ? 1 : -1) * (side === "trái" ? -1 : 1);
                  setSpeakingWidth((width) => Math.min(100, Math.max(minWidth, width + direction * 5)));
                }
              }}
            >
              <span aria-hidden="true" className="h-10 border-l-2 border-caption-border opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
            </button>
          ))}
        </section>
      )}
    </div>
  );
}
