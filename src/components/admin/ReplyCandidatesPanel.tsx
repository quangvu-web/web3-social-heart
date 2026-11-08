import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { candidateDraft, candidateFlagKey, validCandidateGroup, type CandidateSource } from "../../../supabase/functions/_shared/reply-candidates-policy";
import { saveReplyCandidate } from "../../../supabase/functions/_shared/reply-candidates";

type CaptureFlag = { enabled: boolean; updated_at: string };

export default function ReplyCandidatesPanel({ onCreated }: { onCreated: () => void }) {
  const [groupText, setGroupText] = useState("");
  const [group, setGroup] = useState<number | null>(null);
  const [flag, setFlag] = useState<CaptureFlag | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState("");
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; }, []);

  async function chooseGroup() {
    if (!/^-[1-9]\d*$/.test(groupText.trim()) || !validCandidateGroup(Number(groupText))) {
      setError("Nhập Group ID là số nguyên âm hợp lệ."); return;
    }
    const selected = Number(groupText);
    const request = ++generation.current;
    setBusy(true); setReady(false); setError(""); setReport(""); setGroup(selected);
    try {
      const result = await supabase.from("angel_feature_flags").select("enabled, updated_at")
        .eq("key", candidateFlagKey(selected)).abortSignal(AbortSignal.timeout(5000)).maybeSingle();
      if (result.error) throw new Error("Không đọc được cấu hình nhóm. Hãy tải lại.");
      if (request !== generation.current) return;
      setFlag(result.data); setReady(true);
    } catch (e) { if (request === generation.current) setError(e instanceof Error ? e.message : "Không tải được cấu hình."); }
    finally { if (request === generation.current) setBusy(false); }
  }

  async function toggleCapture() {
    if (!ready || group === null || busy) return;
    setBusy(true); setError(""); setReport("");
    try {
      const key = candidateFlagKey(group);
      const enabled = flag?.enabled !== true;
      if (flag) {
        const result = await supabase.from("angel_feature_flags").update({ enabled }, { count: "exact" })
          .eq("key", key).eq("updated_at", flag.updated_at);
        if (result.error || result.count !== 1) throw new Error("Cấu hình đã thay đổi hoặc chưa lưu được. Chọn lại nhóm để tải mới.");
      } else {
        const result = await supabase.from("angel_feature_flags").insert({
          key, enabled, description: "Tự gom ứng viên FAQ thành bản nháp trong đúng nhóm; không tự duyệt.", meta: {},
        });
        if (result.error) throw new Error("Không tạo được cấu hình. Chọn lại nhóm để kiểm tra quyền hoặc thay đổi đồng thời.");
      }
      const result = await supabase.from("angel_feature_flags").select("enabled, updated_at")
        .eq("key", key).abortSignal(AbortSignal.timeout(5000)).maybeSingle();
      if (result.error || !result.data) throw new Error("Đã gửi yêu cầu lưu nhưng chưa xác minh được. Chọn lại nhóm để kiểm tra.");
      setFlag(result.data);
      setReport(`Đã đọc lại cấu hình: ${result.data.enabled ? "bật" : "tắt"} tự gom cho nhóm ${group}.`);
    } catch (e) { setReady(false); setError(e instanceof Error ? e.message : "Không lưu được cấu hình."); }
    finally { setBusy(false); }
  }

  async function scanHistory() {
    if (!ready || group === null || busy) return;
    setBusy(true); setError(""); setReport("");
    const request = generation.current;
    let created = 0;
    try {
      const result = await supabase.from("telegram_ai_conversations")
        .select("id,group_id,chat_type,source,provider,error,reply_message_id,trigger_source,user_message,bot_reply,language,full_name,username")
        .eq("group_id", group).eq("source", "telegram").eq("provider", "funcore").is("error", null)
        .in("chat_type", ["group", "supergroup"]).is("reply_message_id", null)
        .gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString())
        .order("created_at", { ascending: false }).order("id", { ascending: false })
        .limit(100).abortSignal(AbortSignal.timeout(10000));
      if (result.error || !Array.isArray(result.data)) throw new Error("Không tải được lịch sử; chưa thể kết luận nhóm không có ứng viên.");
      let eligible = 0;
      for (const raw of result.data) {
        if (request !== generation.current) return;
        const source = raw as CandidateSource;
        if (!candidateDraft(source)) continue;
        eligible++;
        if (await saveReplyCandidate(supabase, source) === "created") created++;
      }
      if (request !== generation.current) return;
      setReport(`Đã quét ${result.data.length} lượt trong 30 ngày gần nhất: ${eligible} lượt qua bộ lọc, tạo ${created} bản nháp, bỏ qua ${eligible - created} lượt đã có. Chưa duyệt mục nào.`);
    } catch {
      if (request === generation.current) setError(`Quét chưa hoàn tất. Đã tạo ${created} bản nháp trước khi gặp lỗi; có thể quét lại, hệ thống không ghi đè mục cũ.`);
    } finally {
      if (request === generation.current) { setBusy(false); if (created) onCreated(); }
    }
  }

  return <Card>
    <CardHeader><CardTitle>Tự gom ứng viên từ hội thoại</CardTitle></CardHeader>
    <CardContent className="space-y-3">
      <p className="text-sm text-muted-foreground">Chỉ tạo bản nháp từ câu hỏi độc lập và câu trả lời FUN Core phù hợp bộ lọc. Đây chưa phải đánh giá độ đúng; bé vẫn kiểm tra nguồn và duyệt từng mục. Mặc định tắt ở mọi nhóm.</p>
      <label className="block space-y-1"><span>Group ID để tự gom ứng viên</span>
        <Input value={groupText} disabled={busy} onChange={e => {
          generation.current++; setGroupText(e.target.value); setReady(false); setGroup(null); setFlag(null); setError(""); setReport("");
        }} /></label>
      <Button variant="outline" disabled={busy} onClick={() => void chooseGroup()}>Chọn nhóm / tải lại cấu hình</Button>
      {ready && <div className="space-y-3">
        <p>Nhóm {group}: tự gom {flag?.enabled ? "đang bật" : "đang tắt"}.</p>
        <Button disabled={busy} onClick={() => void toggleCapture()}>{flag?.enabled ? "Tắt tự gom cho nhóm này" : "Bật tự gom cho nhóm này"}</Button>
        <p className="text-sm text-muted-foreground">Khi bật, các lượt mới đủ điều kiện sẽ tự lưu thành bản nháp ở backend kể cả khi đóng admin. Mục chỉ thuộc nhóm nguồn, hạn 30 ngày; không tự thêm biến thể hay dùng chung nhóm khác.</p>
        <Button variant="outline" disabled={busy} onClick={() => void scanHistory()}>Quét lịch sử và tạo bản nháp (tối đa 100 lượt)</Button>
        <p className="text-sm text-muted-foreground">Quét 100 lượt FUN Core thành công gần nhất trong 30 ngày của đúng nhóm; không lấy DM. Có thể quét khi tự gom đang tắt. Không ghi đè bản đã sửa, đã duyệt hoặc đã thu hồi. Không thể xác minh đầy đủ ngữ cảnh ảnh/công cụ của lịch sử cũ; bé cần đọc lại trước khi duyệt.</p>
      </div>}
      {busy && <p role="status">Đang xử lý…</p>}
      {error && <p role="alert" className="text-destructive">{error}</p>}
      {report && <p role="status">{report}</p>}
    </CardContent>
  </Card>;
}
