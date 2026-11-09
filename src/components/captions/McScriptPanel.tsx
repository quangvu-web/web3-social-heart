import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { hasUnclearSpeech, MC_TEXT_LIMIT, validMcText, type McStage } from "../../../supabase/functions/angel-caption/mc-script-policy";
import { recentMcSource, type McCaptionSource } from "./mcScriptSource";

export default function McScriptPanel({ lines, fontSize }: { lines: McCaptionSource[]; fontSize: number }) {
  const [source, setSource] = useState("");
  const [vietnamese, setVietnamese] = useState("");
  const [english, setEnglish] = useState("");
  const [viSource, setViSource] = useState<string | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState<McStage | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);
  const requestId = useRef(0);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => { requestId.current++; pending.current?.abort(); }, []);
  const stale = viSource !== source;
  const canTranslate = validMcText(vietnamese) && reviewed && !stale && !hasUnclearSpeech(vietnamese);
  const control = "rounded-lg border border-caption-control-border bg-caption-control/60 text-caption-control-foreground px-3 py-2 hover:bg-caption-control-hover disabled:opacity-50 disabled:cursor-not-allowed";
  const editor = "w-full rounded-lg border border-caption-control-border bg-caption-background text-caption-foreground p-3 leading-relaxed resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-caption-speaker";

  async function generate(stage: McStage) {
    if (busy) return;
    const input = stage === "edit-vi" ? source : vietnamese;
    if (!validMcText(input) || (stage === "translate-en" && !canTranslate)) return;
    const id = ++requestId.current;
    setBusy(stage); setError(""); setNotice(""); setNeedsLogin(false);
    pending.current = new AbortController();
    try {
      const session = await supabase.auth.getSession();
      if (id !== requestId.current) return;
      if (session.error || !session.data.session) { setNeedsLogin(true); throw new Error("Bé đăng nhập FUN Profile để tạo bản MC nhé."); }
      const { data, error: invokeError } = await supabase.functions.invoke("angel-caption?action=mc-script", {
        body: { stage, text: input }, signal: pending.current.signal, timeout: 45000,
      });
      if (id !== requestId.current) return;
      if (invokeError) {
        let message = "Angel chưa tạo được bản MC. Bé giữ nội dung đang soạn và thử lại nhé.";
        const response = invokeError.context;
        if (response instanceof Response) {
          if (response.status === 401) setNeedsLogin(true);
          const body = await response.json().catch(() => null);
          if (typeof body?.error === "string") message = body.error.slice(0, 300);
        }
        throw new Error(message);
      }
      if (id !== requestId.current) return;
      if (data?.stage !== stage || typeof data?.text !== "string" || !data.text.trim()) throw new Error("Angel chưa nhận được bản hoàn chỉnh. Bé thử lại nhé.");
      if (stage === "edit-vi") {
        setVietnamese(data.text); setViSource(input); setReviewed(false); setEnglish("");
        setNotice("Đã tạo bản Việt biên tập. Bé kiểm tra tên người, ý nghĩa và sửa các chỗ [chưa rõ: ...] trước khi dịch nhé.");
      } else {
        setEnglish(data.text); setNotice("Đã tạo bản Anh từ bản Việt bé đã rà soát. Bé đọc thử và chỉnh nhịp trước khi sử dụng nhé.");
      }
    } catch (e) {
      if (id === requestId.current) setError(e instanceof Error ? e.message : "Chưa tạo được bản MC.");
    } finally {
      if (id === requestId.current) { setBusy(null); pending.current = null; }
    }
  }

  function loadSource() {
    try {
      const next = recentMcSource(lines);
      setSource(next.text); setReviewed(false); setEnglish(""); setError("");
      setNotice(`Đã lấy ${next.count} dòng tiếng Việt cuối của ${next.speaker || "người nói chưa có tên"}. Đây là một đoạn, không phải toàn bộ buổi họp; bé kiểm tra đủ ý trước khi tạo bản MC.`);
    } catch (e) { setError(e instanceof Error ? e.message : "Chưa lấy được nội dung."); }
  }
  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); setNotice("Đã sao chép."); }
    catch { setError("Chưa sao chép được. Bé có thể chọn nội dung trong ô và sao chép thủ công."); }
  }

  return <div className="mx-auto max-w-5xl p-4 space-y-4 text-caption-foreground">
    <h2 className="text-xl font-semibold">Bản MC đọc lại · Việt–Anh</h2>
    <p className="text-sm text-caption-muted">Bản biên tập riêng để bé đọc thành lời; không thay phụ đề trực tiếp. Angel không tự thêm lời chào, lời cảm ơn hoặc ý mới. Bé cần kiểm tra tên và nội dung trước khi dùng.</p>
    <p className="text-sm text-caption-muted">Đăng nhập để tạo. Mỗi bước tính một lượt tạo: tối đa 3 lượt/phút và 30 lượt/24 giờ cho mỗi tài khoản và IP. Bản soạn chỉ giữ trong trang hiện tại; tải lại/đóng trang sẽ mất, bé sao chép để lưu nhé.</p>
    <button type="button" className={control} disabled={!!busy} onClick={loadSource}>Lấy đoạn tiếng Việt gần nhất</button>
    <label className="block space-y-2"><span className="font-semibold">1. Lời nói tiếng Việt gốc</span>
      <textarea aria-label="Lời nói tiếng Việt gốc" className={editor} rows={6} value={source} disabled={!!busy}
        onChange={e => { setSource(e.target.value); setReviewed(false); setEnglish(""); setNotice(""); }} />
      <span className="text-sm text-caption-muted">{source.length}/{MC_TEXT_LIMIT} ký tự · Bé có thể dán hoặc sửa đoạn nghe sai tại đây.</span>
      {source.length > MC_TEXT_LIMIT && <span className="block text-sm text-caption-live">Đoạn này quá 6.000 ký tự. Nội dung vẫn giữ nguyên; bé chia đoạn trước khi tạo bản MC nhé.</span>}
    </label>
    <button type="button" className={control} disabled={!!busy || !validMcText(source)} onClick={() => void generate("edit-vi")}>{busy === "edit-vi" ? "Đang biên tập bản Việt…" : vietnamese ? "Biên tập lại bản Việt" : "Tạo bản Việt biên tập"}</button>
    <label className="block space-y-2"><span className="font-semibold">2. Bản Việt biên tập — bé rà soát trước khi dịch</span>
      <textarea aria-label="Bản Việt biên tập" className={editor} rows={8} value={vietnamese} disabled={!!busy}
        onChange={e => { setVietnamese(e.target.value); setViSource(source); setReviewed(false); setEnglish(""); setNotice(""); }} />
      <span className="text-sm text-caption-muted">{vietnamese.length}/{MC_TEXT_LIMIT} ký tự · Bé chia đoạn nếu vượt giới hạn; Angel không tự cắt nội dung.</span>
    </label>
    {vietnamese && stale && <p className="text-sm text-caption-live">Lời gốc đã đổi. Bé biên tập lại hoặc chỉnh bản Việt để khớp nguồn mới trước khi dịch nhé.</p>}
    {hasUnclearSpeech(vietnamese) && <p className="text-sm text-caption-live">Còn đoạn [chưa rõ: ...]. Bé đối chiếu âm thanh, sửa lại và bỏ dấu đánh dấu này trước khi dịch nhé.</p>}
    <label className="flex items-start gap-2"><input type="checkbox" checked={reviewed} disabled={!!busy || !validMcText(vietnamese) || stale || hasUnclearSpeech(vietnamese)} onChange={e => setReviewed(e.target.checked)} />Bé đã kiểm tra bản Việt: tên người, số liệu, ý nghĩa và cách xưng hô.</label>
    <div className="flex flex-wrap gap-2">
      <button type="button" className={control} disabled={!!busy || !canTranslate} onClick={() => void generate("translate-en")}>{busy === "translate-en" ? "Đang dịch bản Anh…" : "Dịch bản Việt đã rà soát sang Anh"}</button>
      <button type="button" className={control} disabled={!vietnamese} onClick={() => void copy(vietnamese)}>Sao chép bản Việt</button>
    </div>
    <label className="block space-y-2"><span className="font-semibold">3. Bản Anh để đọc thành lời</span>
      <textarea aria-label="Bản Anh để đọc thành lời" className={editor} rows={10} style={{ fontSize: Math.max(18, fontSize) }} value={english} disabled={!!busy} onChange={e => setEnglish(e.target.value)} />
    </label>
    <button type="button" className={control} disabled={!english || !!busy} onClick={() => void copy(english)}>Sao chép bản Anh</button>
    {error && <p role="alert" className="text-caption-live">{error}</p>}
    {notice && <p role="status" className="text-caption-muted">{notice}</p>}
    {needsLogin && <a className="inline-block underline text-caption-speaker" href="/auth" target="_blank" rel="noopener noreferrer">Đăng nhập FUN Profile trong tab mới</a>}
  </div>;
}
