import { useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import ReplyCandidatesPanel from "./ReplyCandidatesPanel";
import {
  type ApprovedReply,
  isStandaloneLibraryQuestion,
} from "../../../supabase/functions/_shared/approved-replies-policy";

// The generated client types will be refreshed by Lovable after migration.
const db: SupabaseClient = supabase;
type Entry = ApprovedReply & {
  aliases: string[];
  updated_at: string;
  source_conversation_id: string | null;
};
type Candidate = {
  id: string;
  user_message: string;
  bot_reply: string;
  created_at: string;
};
type Form = {
  id?: string;
  revision?: number;
  question: string;
  aliases: string;
  answer: string;
  language: string;
  group: string;
  expiry: string;
  source: string | null;
};
const myt = (iso: string) =>
  new Date(iso).toLocaleString("vi-VN", { timeZone: "Asia/Kuala_Lumpur" });
const dateMyt = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
const emptyForm = (): Form => ({
  question: "",
  aliases: "",
  answer: "",
  language: "vi",
  group: "",
  expiry: dateMyt(new Date(Date.now() + 30 * 86400000).toISOString()),
  source: null,
});
const statusLabels: Record<string, string> = {
  draft: "Bản nháp",
  approved: "Đã duyệt",
  revoked: "Đã thu hồi",
};
const groupNumber = (value: string) =>
  /^-[1-9]\d*$/.test(value.trim()) && Number.isSafeInteger(Number(value))
    ? Number(value)
    : null;

export default function ApprovedRepliesTab() {
  const [rows, setRows] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<Form>(emptyForm);
  const [review, setReview] = useState<Entry | null>(null);
  const [checked, setChecked] = useState(false);
  const [candidateGroup, setCandidateGroup] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [candidateError, setCandidateError] = useState("");
  const [candidateLoading, setCandidateLoading] = useState(false);
  const [candidateLoaded, setCandidateLoaded] = useState(false);
  const candidateRequest = useRef(0);
  const listRequest = useRef(0);

  async function load(pageIndex = page) {
    const request = ++listRequest.current;
    setLoading(true);
    setError("");
    try {
      const result = await db.from("telegram_approved_replies").select("*")
        .order("updated_at", { ascending: false }).order("id", {
          ascending: false,
        }).range(pageIndex * 50, pageIndex * 50 + 50);
      if (request !== listRequest.current) return;
      if (result.error) throw result.error;
      setRows((result.data ?? []).slice(0, 50));
      setHasNext((result.data ?? []).length > 50);
      setPage(pageIndex);
    } catch (e) {
      if (request === listRequest.current) {
        setError(
          `Không tải được thư viện: ${
            e instanceof Error ? e.message : String(e)
          }. Nếu bảng chưa có, cần Lovable áp dụng migration.`,
        );
      }
    } finally {
      if (request === listRequest.current) setLoading(false);
    }
  }
  useEffect(() => {
    void load();
    return () => {
      listRequest.current++;
      candidateRequest.current++;
    };
  }, []);

  function edit(row: Entry) {
    setForm({
      id: row.id,
      revision: row.revision,
      question: row.question,
      aliases: row.aliases.join("\n"),
      answer: row.answer,
      language: row.language,
      group: row.group_id === null ? "" : String(row.group_id),
      expiry: dateMyt(row.expires_at),
      source: row.source_conversation_id,
    });
  }
  async function save() {
    const aliases = form.aliases.split("\n").map((v) => v.trim()).filter(
      Boolean,
    );
    const expires = new Date(`${form.expiry}T23:59:59+08:00`);
    if (
      ![form.question, ...aliases].every(isStandaloneLibraryQuestion) ||
      aliases.length > 20
    ) {
      return toast.error(
        "Câu hỏi/biến thể cần 8–300 ký tự, đủ ngữ cảnh, tối đa 20 biến thể; không dùng câu hỏi tiếp nối hay dữ liệu tức thời.",
      );
    }
    if (!form.answer.trim() || form.answer.length > 3500) {
      return toast.error("Câu trả lời cần 1–3.500 ký tự văn bản thuần.");
    }
    if (form.group.trim() && groupNumber(form.group) === null) {
      return toast.error("Group ID phải là số nguyên âm hợp lệ.");
    }
    if (
      !Number.isFinite(expires.getTime()) || expires.getTime() <= Date.now()
    ) return toast.error("Chọn ngày hết hạn trong tương lai (giờ Malaysia).");
    setBusy(true);
    try {
      const payload = {
        question: form.question.trim(),
        aliases,
        answer: form.answer.trim(),
        language: form.language,
        group_id: form.group.trim() ? groupNumber(form.group) : null,
        expires_at: expires.toISOString(),
        source_conversation_id: form.source,
        status: "draft",
      };
      if (form.id) {
        const result = await db.from("telegram_approved_replies").update(
          payload,
          { count: "exact" },
        ).eq("id", form.id).eq("revision", form.revision);
        if (result.error) throw result.error;
        if (result.count !== 1) {
          throw new Error(
            "Bản ghi đã thay đổi hoặc quyền chưa được xác minh. Tải lại trước khi sửa.",
          );
        }
      } else {
        const result = await db.from("telegram_approved_replies").insert(
          payload,
        );
        if (result.error) throw result.error;
      }
      toast.success("Đã lưu bản nháp; bot chỉ dùng sau khi duyệt.");
      setForm(emptyForm());
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  async function changeStatus(row: Entry, status: "approved" | "revoked") {
    if (status === "approved" && !checked) return;
    setBusy(true);
    try {
      const result = await db.from("telegram_approved_replies").update({
        status,
      }, { count: "exact" }).eq("id", row.id).eq("revision", row.revision);
      if (result.error) throw result.error;
      if (result.count !== 1) {
        throw new Error(
          "Bản ghi đã thay đổi; tải lại và duyệt lại nội dung mới.",
        );
      }
      setReview(null);
      setChecked(false);
      toast.success(status === "approved" ? "Đã duyệt." : "Đã thu hồi.");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  async function loadCandidates() {
    const group = groupNumber(candidateGroup);
    if (group === null) {
      return toast.error(
        "Nhập Group ID âm hợp lệ để xem lịch sử của đúng nhóm.",
      );
    }
    const request = ++candidateRequest.current;
    setCandidateLoading(true);
    setCandidateLoaded(false);
    setCandidateError("");
    setCandidates([]);
    try {
      const result = await supabase.from("telegram_ai_conversations").select(
        "id,user_message,bot_reply,created_at",
      )
        .eq("group_id", group).in("chat_type", ["group", "supergroup"]).eq(
          "provider",
          "funcore",
        ).is("error", null)
        .not("bot_reply", "is", null).order("created_at", { ascending: false })
        .limit(20);
      if (request !== candidateRequest.current) return;
      if (result.error) throw result.error;
      setCandidates(result.data as Candidate[]);
      setCandidateLoaded(true);
    } catch (e) {
      if (request === candidateRequest.current) {
        setCandidateError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      if (request === candidateRequest.current) setCandidateLoading(false);
    }
  }
  const field = (key: keyof Form, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));
  return (
    <div className="space-y-6">
      <ReplyCandidatesPanel onCreated={() => void load(0)} />
      <Card>
        <CardHeader>
          <CardTitle>Thư viện câu trả lời đã duyệt</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Dành cho FAQ ổn định. Bot chỉ dùng khi khớp câu hỏi hoặc biến thể đã
            duyệt, đúng nhóm, ngôn ngữ và còn hạn. Không dùng cho DM, ảnh, câu
            hỏi tiếp nối hoặc dữ liệu tức thời. Bản nháp và bản thu hồi không
            được dùng.
          </p>
          <p className="text-sm text-muted-foreground">
            Biên tập bỏ tên người, dữ liệu riêng và chi tiết sự kiện. Nội dung
            do AI tạo cần đối chiếu nguồn; đây chưa phải hệ thống tự học hay tìm
            kiếm theo ý nghĩa.
          </p>
          <Button onClick={() => void load()} disabled={loading || busy}>
            Tải lại thư viện
          </Button>
          {loading
            ? <p>Đang tải…</p>
            : error
            ? <p role="alert" className="text-destructive">{error}</p>
            : rows.length === 0
            ? <p>Chưa có câu trả lời nào.</p>
            : (
              <>
                <p className="text-sm text-muted-foreground">
                  Trang{" "}
                  {page + 1}, tối đa 50 mục/trang. Lượt sử dụng được ghi trong
                  AI triggers → runtime logs với provider approved_library.
                </p>
                {rows.map((row) => (
                  <div key={row.id} className="rounded-lg border p-3 space-y-2">
                    <p className="font-medium">{row.question}</p>
                    <p className="text-sm text-muted-foreground">
                      {statusLabels[row.status]} · {row.language} ·{" "}
                      {row.group_id ?? "Tất cả nhóm"} · Hết hạn{" "}
                      {myt(row.expires_at)} (MYT)
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                          edit(row)}
                      >
                        Biên tập
                      </Button>
                      {row.status !== "approved" && (
                        <Button
                          disabled={busy}
                          onClick={() => {
                            setReview(row);
                            setChecked(false);
                          }}
                        >
                          Xem & duyệt
                        </Button>
                      )}
                      {row.status === "approved" && (
                        <Button
                          variant="outline"
                          disabled={busy}
                          onClick={() => void changeStatus(row, "revoked")}
                        >
                          Thu hồi
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    disabled={busy || page === 0}
                    onClick={() => void load(page - 1)}
                  >
                    Trang trước
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy || !hasNext}
                    onClick={() => void load(page + 1)}
                  >
                    Trang sau
                  </Button>
                </div>
              </>
            )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>
            {form.id ? "Biên tập → lưu lại bản nháp" : "Soạn bản nháp"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="block space-y-1">
            <span>Câu hỏi chuẩn</span>
            <Input
              disabled={busy}
              value={form.question}
              onChange={(e) => field("question", e.target.value)}
            />
          </label>
          <label className="block space-y-1">
            <span>Biến thể tương đương (mỗi dòng một câu, tối đa 20)</span>
            <Textarea
              disabled={busy}
              value={form.aliases}
              onChange={(e) => field("aliases", e.target.value)}
            />
          </label>
          <label className="block space-y-1">
            <span>Câu trả lời bằng văn bản thuần, không HTML</span>
            <Textarea
              rows={6}
              disabled={busy}
              value={form.answer}
              onChange={(e) => field("answer", e.target.value)}
            />
          </label>
          <label className="block space-y-1">
            <span>Ngôn ngữ câu trả lời</span>
            <select
              className="rounded-md border bg-background p-2"
              disabled={busy}
              value={form.language}
              onChange={(e) => field("language", e.target.value)}
            >
              <option value="vi">Tiếng Việt</option>
              <option value="en">English</option>
            </select>
          </label>
          <label className="block space-y-1">
            <span>Group ID (để trống = dùng chung tất cả nhóm)</span>
            <Input
              disabled={busy}
              value={form.group}
              onChange={(e) => field("group", e.target.value)}
            />
          </label>
          <label className="block space-y-1">
            <span>Ngày hết hạn (cuối ngày Malaysia, UTC+8)</span>
            <Input
              type="date"
              disabled={busy}
              value={form.expiry}
              onChange={(e) => field("expiry", e.target.value)}
            />
          </label>
          <div className="flex gap-2">
            <Button
              disabled={busy || loading || Boolean(error)}
              onClick={() => void save()}
            >
              Lưu bản nháp
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setForm(emptyForm())}
            >
              Soạn mục mới
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Chọn câu trả lời từ lịch sử nhóm</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Chỉ lấy 20 lượt FUN Core thành công gần nhất trong nhóm được chọn.
            Chọn một lượt sẽ điền vào trình soạn; chưa lưu hoặc duyệt tự động.
          </p>
          <Input
            aria-label="Group ID để xem lịch sử"
            disabled={busy}
            value={candidateGroup}
            onChange={(e) => {
              candidateRequest.current++;
              setCandidateGroup(e.target.value);
              setCandidates([]);
              setCandidateLoaded(false);
              setCandidateLoading(false);
              setCandidateError("");
            }}
          />
          <Button
            disabled={candidateLoading || busy}
            onClick={() => void loadCandidates()}
          >
            Xem lịch sử nhóm
          </Button>
          {candidateLoading
            ? <p>Đang tải lịch sử…</p>
            : candidateError
            ? (
              <p role="alert" className="text-destructive">
                Không tải được lịch sử: {candidateError}
              </p>
            )
            : candidateLoaded && candidates.length === 0
            ? <p>Chưa có lượt phù hợp trong nhóm này.</p>
            : candidates.map((c) => (
              <div className="rounded-lg border p-3 space-y-2" key={c.id}>
                <p className="text-sm text-muted-foreground">
                  {myt(c.created_at)} (MYT)
                </p>
                <p className="font-medium">{c.user_message}</p>
                <p className="whitespace-pre-wrap text-sm">{c.bot_reply}</p>
                <Button
                  disabled={busy}
                  variant="outline"
                  onClick={() => {
                    setForm({
                      ...emptyForm(),
                      question: c.user_message,
                      answer: c.bot_reply,
                      group: candidateGroup.trim(),
                      source: c.id,
                    });
                    toast.info(
                      "Đã điền bản nháp. Biên tập và chọn đúng ngôn ngữ trước khi lưu.",
                    );
                  }}
                >
                  Dùng để soạn bản nháp
                </Button>
              </div>
            ))}
        </CardContent>
      </Card>
      <Dialog
        open={Boolean(review)}
        onOpenChange={(open) => {
          if (!busy && !open) setReview(null);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Duyệt nội dung tái sử dụng</DialogTitle>
          </DialogHeader>
          {review && (
            <>
              <p className="font-medium">{review.question}</p>
              <p className="text-sm">
                Biến thể: {review.aliases.join(" · ") || "Không có"}
              </p>
              <p className="whitespace-pre-wrap">{review.answer}</p>
              <p className="text-sm">
                Phạm vi: {review.group_id ?? "TẤT CẢ NHÓM"} · {review.language}
                {" "}
                · Hết hạn {myt(review.expires_at)} (MYT)
              </p>
              {review.source_conversation_id && <p className="text-sm text-muted-foreground break-all">Nguồn hội thoại: {review.source_conversation_id}. Bé cần đối chiếu nguồn và ngữ cảnh trước khi duyệt.</p>}
              <label className="flex items-start gap-2 text-sm">
                <Checkbox
                  checked={checked}
                  disabled={busy}
                  onCheckedChange={(v) => setChecked(v === true)}
                />Đã kiểm tra nguồn, ngôn ngữ, phạm vi và các biến thể tương
                đương; nội dung không chứa dữ liệu cá nhân, không phụ thuộc sự
                kiện hoặc hội thoại trước.
              </label>
              <Button
                disabled={busy || !checked ||
                  Date.parse(review.expires_at) <= Date.now()}
                onClick={() => void changeStatus(review, "approved")}
              >
                Duyệt cho bot sử dụng
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
