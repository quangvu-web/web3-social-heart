// Trang phụ đề trực tiếp Angel Translator — công khai theo mã phiên, không cần đăng nhập.
// Nhận dòng mới qua Supabase Realtime (INSERT trên caption_lines, lọc theo session_id).
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Minus, Plus, Loader2 } from "lucide-react";

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

  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

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
      setLines((existing as CaptionLine[]) ?? []);

      channel = supabase
        .channel(`captions:${sess.id}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "caption_lines", filter: `session_id=eq.${sess.id}` },
          (payload) => {
            const row = payload.new as CaptionLine;
            setLines((prev) => (prev.some((l) => l.id === row.id) ? prev : [...prev, row]));
          },
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "caption_sessions", filter: `id=eq.${sess.id}` },
          (payload) => {
            setSession(payload.new as CaptionSession);
          },
        )
        .subscribe();
    };

    load();
    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [code]);

  // Tự cuộn xuống dòng mới nhất (tạm dừng khi người dùng cuộn lên)
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [lines]);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
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
    <div className="min-h-screen bg-[#0B1020] text-slate-100 flex flex-col">
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
      <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto">
        {lines.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            {session.status === "live" ? "Đang lắng nghe buổi họp…" : "Chưa có phụ đề nào."}
          </div>
        ) : (
          lines.map(renderLine)
        )}
      </div>
    </div>
  );
}
