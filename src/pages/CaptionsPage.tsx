// Trang phụ đề trực tiếp Angel Translator — công khai theo mã phiên, không cần đăng nhập.
// Nhận dòng mới qua Supabase Realtime (INSERT trên caption_lines, lọc theo session_id).
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Minus, Plus, Loader2, ArrowDown } from "lucide-react";

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

type ViewMode = "vi" | "en" | "both";

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

export default function CaptionsPage() {
  const { code } = useParams<{ code: string }>();
  const [session, setSession] = useState<CaptionSession | null>(null);
  const [lines, setLines] = useState<CaptionLine[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [mode, setMode] = useState<ViewMode>("both");
  const [fontSize, setFontSize] = useState(28);
  const [now, setNow] = useState(Date.now());
  const [jumpState, setJumpState] = useState({ visible: false, count: 0 });

  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const maxSeq = useRef(0);
  const unreadBase = useRef(0);
  const linesCountRef = useRef(0);
  const autoScrollGuard = useRef(0);

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
          const [captions, status] = await Promise.all([
            supabase.from("caption_lines")
              .select("id, seq, speaker_name, source_lang, text_source, text_vi, text_en")
              .eq("session_id", sess.id).gt("seq", cursor)
              .order("seq", { ascending: true }).limit(1000),
            supabase.from("caption_sessions")
              .select("id, public_code, status, started_at, ended_at, created_at")
              .eq("id", sess.id).maybeSingle(),
          ]);
          if (cancelled) return;
          if (!captions.error && captions.data) mergeLines(captions.data as CaptionLine[]);
          if (!status.error && status.data) setSession(status.data as CaptionSession);
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
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  if (notFound) {
    return (
      <div className="min-h-screen bg-[#0B1020] text-slate-100 flex items-center justify-center p-6">
        <p className="text-xl text-slate-300">Không tìm thấy phiên phụ đề</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-[#0B1020] text-slate-100 flex items-center justify-center p-6">
        <Loader2 className="w-8 h-8 animate-spin text-[#06B6D4]" />
      </div>
    );
  }

  const renderLine = (line: CaptionLine) => {
    const vi = line.text_vi ?? (line.source_lang === "vi" ? line.text_source : null);
    const en = line.text_en ?? (line.source_lang === "en" ? line.text_source : null);
    const main = mode === "vi" ? vi : mode === "en" ? en : (vi ?? en);
    const sub = mode === "both" ? (main === vi ? en : vi) : null;
    return (
      <div key={line.id} className="px-4 py-3 border-b border-slate-800/60">
        {line.speaker_name && (
          <div className="text-sm font-semibold text-[#06B6D4] mb-1">{line.speaker_name}</div>
        )}
        <div className="font-medium leading-snug text-slate-50" style={{ fontSize }}>
          {main ?? line.text_source}
        </div>
        {sub && (
          <div className="mt-1 text-slate-400 leading-snug" style={{ fontSize: Math.max(14, fontSize - 10) }}>
            {sub}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-screen overflow-hidden bg-[#0B1020] text-slate-100 flex flex-col">
      {/* Header: trạng thái + đồng hồ + điều khiển */}
      <header className="sticky top-0 z-10 bg-[#0B1020]/95 backdrop-blur border-b border-slate-800 px-4 py-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <span className={`text-base font-semibold ${session.status === "live" ? "text-red-400" : "text-slate-200"}`}>
              {STATUS_LABEL[session.status]}
            </span>
            <span className="text-sm text-slate-400 tabular-nums">
              {formatDuration(session.started_at, session.ended_at, now)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg overflow-hidden border border-slate-700">
              {(["vi", "en", "both"] as ViewMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    mode === m ? "bg-[#2563EB] text-white" : "bg-slate-800/60 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  {m === "vi" ? "Tiếng Việt" : m === "en" ? "English" : "Song ngữ"}
                </button>
              ))}
            </div>
            <button
              onClick={() => setFontSize((s) => Math.max(18, s - 4))}
              className="p-2 rounded-lg bg-slate-800/60 text-slate-300 hover:bg-slate-700 border border-slate-700"
              aria-label="Giảm cỡ chữ"
            >
              <Minus className="w-4 h-4" />
            </button>
            <button
              onClick={() => setFontSize((s) => Math.min(48, s + 4))}
              className="p-2 rounded-lg bg-slate-800/60 text-slate-300 hover:bg-slate-700 border border-slate-700"
              aria-label="Tăng cỡ chữ"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Danh sách phụ đề — native div scroll theo quy ước dự án */}
      <div className="relative flex-1 flex flex-col min-h-0">
        <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto">
          {lines.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              {session.status === "live" ? "Đang lắng nghe buổi họp…" : "Chưa có phụ đề nào."}
            </div>
          ) : (
            lines.map(renderLine)
          )}
        </div>
        {jumpState.visible && (
          <button
            onClick={jumpToLatest}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-4 py-2 rounded-full bg-[#2563EB] text-white text-sm font-medium shadow-lg shadow-black/40 hover:bg-[#1D4ED8] transition-colors"
          >
            <ArrowDown className="w-4 h-4" />
            {jumpState.count > 0 ? `${jumpState.count} dòng mới` : "Dòng mới nhất"}
          </button>
        )}
      </div>
    </div>
  );
}
