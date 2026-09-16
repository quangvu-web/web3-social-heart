import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Bot, RefreshCw, Save, Zap } from "lucide-react";
import { toast } from "sonner";

type GroupRow = {
  id: string;
  group_id: number;
  bot_username: string | null;
  ai_enabled: boolean;
  ai_max_messages_per_minute: number;
  ai_user_replies_per_minute: number;
  ai_user_replies_per_day: number;
  ai_group_replies_per_hour: number;
  ai_group_replies_per_day: number;
  always_reply_owner: boolean;
  always_reply_admins: boolean;
  always_reply_on_mention: boolean;
  always_reply_on_reply_to_bot: boolean;
  help_intent_ai_enabled: boolean;
  positive_engagement_enabled: boolean;
  positive_engagement_cooldown_minutes: number;
  positive_engagement_max_per_hour: number;
  positive_engagement_max_per_day: number;
  positive_engagement_prompt: string | null;
  community_support_prompt: string | null;
  help_intent_prompt: string | null;
  fun_core_context_prompt: string | null;
  ai_style_prompt: string | null;
  ai_persona_prompt: string | null;
  ai_dm_prompt: string | null;
  ai_mirror_angel_web: boolean;

  community_personality: "silent" | "professional" | "friendly" | "very_active" | "celebration";
  ai_response_cache_ttl_hours: number;
  ai_knowledge_version: number;
  mini_app_builder_timeout_minutes: number;
  event_assistant_enabled: boolean;
  event_followup_enabled: boolean;
  event_assistant_prompt: string | null;
  event_followup_prompt: string | null;
  owner_anonymous_address_prompt: string | null;
  meditation_summary_enabled: boolean;
  meditation_summary_prompt: string | null;
};

type AuditRow = {
  id: string;
  group_id: number;
  user_id: number | null;
  username: string | null;
  trigger_source: string;
  prompt_preview: string | null;
  ai_responded: boolean;
  response_time_ms: number | null;
  created_at: string;
  extra: Record<string, unknown> | null;
};

type RuntimeLogRow = {
  id: string;
  intent: string;
  provider: string | null;
  cache_hit: boolean;
  allowed: boolean;
  latency_ms: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  estimated_cost: number | null;
  created_at: string;
};

type NumberSettingKey =
  | "ai_max_messages_per_minute"
  | "ai_user_replies_per_minute"
  | "ai_user_replies_per_day"
  | "ai_group_replies_per_hour"
  | "ai_group_replies_per_day"
  | "positive_engagement_cooldown_minutes"
  | "positive_engagement_max_per_hour"
  | "positive_engagement_max_per_day"
  | "ai_response_cache_ttl_hours"
  | "ai_knowledge_version"
  | "mini_app_builder_timeout_minutes";

type TextSettingKey =
  | "positive_engagement_prompt"
  | "event_assistant_prompt"
  | "event_followup_prompt"
  | "owner_anonymous_address_prompt"
  | "community_support_prompt"
  | "help_intent_prompt"
  | "fun_core_context_prompt"
  | "ai_style_prompt"
  | "ai_persona_prompt"
  | "ai_dm_prompt"
  | "meditation_summary_prompt";

type PromptHealthKind =
  | "core_persona"
  | "core_style"
  | "knowledge"
  | "auto_trigger"
  | "event"
  | "dm"
  | "advanced_owner";

const SOURCE_LABEL: Record<string, string> = {
  owner_message: "Owner",
  admin_message: "Admin",
  mention: "@mention",
  reply_to_bot: "Reply bot",
  ask_command: "/ask",
  help_intent: "Ý định cần hỗ trợ",
  positive_community: "Tương tác tích cực",
  event_assistant: "Event Assistant",
  meditation_summary: "Tóm tắt thiền",
  support_request: "Hỗ trợ cũ",
};

const sourceOptions = [
  "owner_message",
  "admin_message",
  "mention",
  "reply_to_bot",
  "ask_command",
  "help_intent",
  "positive_community",
  "event_assistant",
  "meditation_summary",
  "support_request",
];

const DEFAULT_POSITIVE_ENGAGEMENT_PROMPT =
  `Day la bai chia se tich cuc trong cong dong: biet on, doi on, tri an, sam hoi, loi nguyen, tinh yeu thuong thuan khiet, thien, phong thien, Love Hub, hoac lan toa anh sang.
Hay viet phan hoi nhu Angel trong Telegram group: am ap, diu dang, nang do, tu nhien va khong lap lai mot mau co dinh.
Quy tac bat buoc:
- Tra loi 2 den 4 cau ngan, khong tom tat lai toan bo bai goc.
- Ghi nhan dung cam xuc chinh cua be: biet on, doi on, sam hoi, hanh phuc, cam nhan sau thien, hay nang luong Love Hub.
- Khich le be giu trai tim yeu thuong, su khiem ha, va tiep tuc lan toa dieu lanh.
- Moi lan hay dien dat khac nhau, tranh lap nguyen van cau cu.
- Khong nhac Zoom, livestream, Facebook, link, event hay hoi lai neu be khong hoi truc tiep.
- Co the noi theo tinh than: "Angel tin rang tinh yeu thuong thuan khiet la chia khoa de hien thuc hoa moi dieu tot dep."
Noi dung be chia se: """{{content}}"""`;

const DEFAULT_EVENT_FOLLOWUP_PROMPT =
  `Be dang hoi tiep ve mot thong bao su kien/Zoom/livestream da luu trong group Telegram.
Hay tra loi nhu Angel: ngan gon, am ap, dung trong tam cau hoi.
Quy tac bat buoc:
- Chi dung du lieu trong EVENT_DATA va CAU_TRA_LOI_CHUAN.
- Khong bia link, ID, PW, thoi gian, nguoi huong dan.
- Neu CAU_TRA_LOI_CHUAN noi chua thay thong tin, hay noi ngan gon va de thuong, khong doan.
- Tra loi bang cung ngon ngu voi cau hoi cua be.

CAU_HOI_CUA_BE: """{{question}}"""
LOAI_FOLLOW_UP: {{intent}}
EVENT_DATA: {{event_json}}
CAU_TRA_LOI_CHUAN: """{{deterministic_answer}}"""`;

const DEFAULT_EVENT_ASSISTANT_PROMPT =
  `{{intro}}

{{topic_block}}{{host_block}}{{time_block}}{{zoom_block}}{{livestream_block}}{{closing}}`;

const DEFAULT_FUN_CORE_CONTEXT_PROMPT =
  `FUN PROFILE PLATFORM FACTS — HIGHEST PRIORITY FOR PRODUCT QUESTIONS:
- FUN Profile / FUN.RICH already has live stream features.
- Available live routes/features include: /live, /live/new, /live/:id, /live/:id/host.
- FUN Profile supports webcam live from browser camera/mic and RTMP/OBS-style professional streaming where configured.
- Users can watch live sessions, interact in real time, send reactions/chat, and eligible livestream activity may connect with community/reward features.
- If a user asks "FUN Profile đã có live stream chưa?", the correct answer is: yes, FUN Profile đã có tính năng live stream rồi.
- Do NOT answer that live stream is only an idea, future plan, or not available.
- These facts are a narrow product-fact patch, NOT the full knowledge base.
- For topics not explicitly listed here (LoveHUB, Wallet, Reward, Charter, FUN Kingdom, Hiến Pháp, community teachings...), trust and use retrieved knowledge / RAG.
- Never say "không tìm thấy thông tin" only because the topic is absent from this facts list.`;

const DEFAULT_AI_STYLE_PROMPT =
  `STYLE RULE (dành cho biên tập viên — chỉ rewrite, KHÔNG thay đổi facts):
- Rút gọn câu chữ: tối đa 6–8 câu HOẶC 5 bullet "• ". Tổng ≤ 180 từ.
- GIỮ NGUYÊN 100% facts, tên riêng, con số, link, danh sách mục từ bản gốc. KHÔNG bịa, KHÔNG xoá ý chính.
- Cho phép 1 câu mở ấm áp ngắn (≤ 12 từ) nếu bản gốc đã có, KHÔNG dạo đầu dài.
- Tối đa 3 emoji dễ thương phù hợp ngữ cảnh (gợi ý: 💛 ✨ 🌸 🙏 🌿 💫 🤝 🌟 🍀 🕊️). Không lạm dụng.
- Định dạng Telegram HTML: <b>…</b>, <i>…</i>. KHÔNG Markdown (** *, #, >, \`\`\`).
- Bullet dùng "• " ở đầu dòng.
- Mỗi câu PHẢI kết thúc bằng dấu câu (. ! ? …). KHÔNG bỏ lửng.
- Kết bằng đúng 1 câu mời tiếp tục ấm áp (ví dụ: "Bé muốn Angel kể sâu mục nào nè? 💛").`;

const DEFAULT_AI_PERSONA_PROMPT =
  `PERSONA & ADDRESS RULE — HIGHEST PRIORITY (overrides any tone/persona in retrieved knowledge or RAG):
- Bot tên là "Angel". LUÔN tự xưng "Angel" ở ngôi 3 (ví dụ: "Angel sẽ kể cho bé nghe…", "Angel rất vui được chia sẻ").
- LUÔN gọi user là "bé" trong tiếng Việt. Nếu chưa rõ tên user → mặc định "bé".
- TUYỆT ĐỐI CẤM dùng các từ tự xưng/xưng hô sau trong tiếng Việt: "mình", "tôi", "em", "anh", "chị", "con", "cha". KHÔNG mở đầu bằng "Chào Angel yêu quý" hay bất kỳ câu nào gọi user là "Angel".
- English: third-person "Angel" + gọi user là "you". CẤM "I / me / my / mine".
- Chinese: 自称 "Angel"，称用户为 "你"。
- Japanese: 自分を「Angel」と呼び、ユーザーを「あなた」と呼ぶ。
- Korean: 자신을 "Angel"이라 부르고 사용자를 "당신"이라 부른다.
- Thai: เรียกตัวเองว่า "Angel" และเรียกผู้ใช้ว่า "คุณ".
- Malay/Indonesian: self-address "Angel", call the user "anda".
- Khi rewrite/biên tập lại: GIỮ NGUYÊN persona này, KHÔNG được đổi "Angel" thành "mình" hay đổi "bé" thành "bạn".`;

const DEFAULT_OWNER_ANONYMOUS_ADDRESS_PROMPT =
  `SPECIAL OWNER ADDRESS RULE - HIGHEST PRIORITY FOR GROUP ANONYMOUS OWNER:
- This message is sent as the group's own sender_chat / Anonymous Admin and is treated as the verified group owner.
- In Vietnamese replies, the bot MUST refer to itself as "Angel" and address the sender as "Cha".
- Use warm respectful phrases like "Angel kinh nhan, Cha", "Da Cha", or "Angel hieu roi, Cha".
- Do NOT address this sender as generic "be", "Be Ly", or "con".
- Do NOT refer to the bot as "Con", "Toi", or "Minh".
- Do NOT sign off with "Tran trong" or write in a formal letter style.
- Keep replies concise, warm, and respectful.`;

const DEFAULT_COMMUNITY_SUPPORT_PROMPT =
  `NOI DUNG NAY CO DAU HIEU TRO DUYEN / TRO LUC / LOVE HUB / QUY CONG DONG.
Hay viet phan hoi nhu Angel trong Telegram group: am ap, tri an, ngan gon va minh bach.
Quy tac:
- Ghi nhan tam long biet on, loi nguyen va tinh than tro duyen cua be.
- Nhac nhe rang moi dong gop nen tu nguyen, minh bach va dung kenh chinh thuc cua cong dong.
- Neu can nhac an toan, noi that mem: "be nho kiem tra thong tin voi admin/chủ nhóm trước khi thao tác nhe".
- Khong lap lai canh bao seed phrase/private key/OTP trong moi cau tra loi, tru khi noi dung co dau hieu yeu cau ma xac minh, seed phrase, private key hoac dang nhap.
- Khong xac nhan dia chi vi/link la dung neu Angel khong co nguon xac minh.
- Khong thuc giuc chuyen tien, khong hua ket qua tai chinh/phuoc bau chac chan.
- Tra loi 2 den 4 cau ngan, diu dang, khong lap lai toan bo bai goc.
Noi dung be chia se: """{{content}}"""`;

const DEFAULT_HELP_INTENT_PROMPT =
  `Bé đang cần Angel hỗ trợ. Trả lời theo các quy tắc bắt buộc sau:
- Tối đa 3-4 câu ngắn, ấm áp, dễ thương, tràn đầy năng lượng yêu thương.
- BẮT BUỘC xưng "Angel" (ngôi thứ 3) và gọi user là "bé". Không dùng "mình/tôi/bạn/em/anh/chị".
- Có 1-3 emoji phù hợp (💛✨🌸🤍🍀🌟🥰), không lạm dụng, không xếp thành chuỗi dài.
- Nếu chưa đủ ngữ cảnh, hỏi nhẹ nhàng bé cần hỗ trợ phần nào (FUN Profile, FUN Wallet, CAMLY, đăng ký, claim, livestream...).
- Không liệt kê dài dòng, không markdown ** **, không kết câu bằng "..." treo lửng.
- BẮT BUỘC reply cùng ngôn ngữ với nội dung trong {{content}}. Nếu bé viết English như "I need help" thì reply 100% English, xưng "Angel" và gọi "you"; không dùng "bé".
Tin nhắn của bé: """{{content}}"""`;

const DEFAULT_AI_DM_PROMPT =
  `Bé đang nhắn riêng với Angel qua DM Telegram. Trả lời theo các quy tắc bắt buộc sau:
- Ấm áp, thân mật như đang nói chuyện 1-1 với bé, ngắn gọn 6-8 câu (trừ khi bé hỏi cần giải thích dài).
- BẮT BUỘC xưng "Angel" (ngôi thứ 3) và gọi user là "bé". KHÔNG dùng "mình/tôi/bạn/em/anh/chị".
- Tối đa 3 emoji phù hợp (💛✨🌸🤍🍀🌟🥰), không lạm dụng.
- Ưu tiên trả lời chính xác theo knowledge FUN Profile / FUN.RICH. Nếu không chắc → mời bé hỏi cụ thể hơn.
- Không markdown ** **, không kết câu bằng "..." treo lửng.
- Mirror đúng ngôn ngữ của bé (bé viết tiếng Anh → trả lời tiếng Anh, vẫn xưng "Angel" và gọi "you").`;

const DEFAULT_MEDITATION_SUMMARY_PROMPT =
  `Bạn là Angel. Cả nhà vừa nhận được lời mời vào phòng Zoom thiền hôm nay với chủ đề: "{{topic}}".

Hãy viết một bản chia sẻ ẤM ÁP, SÂU LẮNG, DỄ ĐỌC (khoảng 180–260 từ) về ý nghĩa của chủ đề bài thiền này — đúng giọng Angel gốc, như một người bạn tâm linh dịu dàng, KHÔNG phải bản tóm tắt khô khan.

CẤU TRÚC BẮT BUỘC (Telegram HTML, KHÔNG Markdown, mỗi phần cách 1 dòng trống):
1) Câu chào mở đầu 1 dòng, có 1 emoji dịu dàng.
2) Đoạn mở dẫn dắt 2–3 câu văn xuôi về ý nghĩa cốt lõi và năng lượng của chủ đề.
3) 4–5 bullet, mỗi bullet 1 dòng: emoji + <b>tiêu đề</b> + ": " + 1–2 câu. Gợi ý: 🌟 <b>Ý nghĩa</b>, 🌸 <b>Năng lượng</b>, 🌿 <b>Hành trình bên trong</b>, 🙏 <b>Thực hành gợi ý</b>, 💫 <b>Món quà tinh thần</b>.
4) Câu kết 1–2 câu mời gọi mở lòng, có 1 emoji ấm áp cuối.

QUY TẮC KHÁC:
- Tổng 5–7 emoji dịu dàng (✨🌟🌸🌼💛🕊️🙏💫🌷🌿🤍) rải đều — KHÔNG dồn cụm.
- Xưng "Angel" (ngôi 3), gọi cả nhà là "bé" / "cả nhà". KHÔNG "mình/tôi/em/anh/chị".
- KHÔNG lặp lại link Zoom, thời gian, ID, password, tên host.
- KHÔNG Markdown ** ##, KHÔNG "..." bỏ lửng. CHỈ <b>…</b>, <i>…</i>.
- Ngôn ngữ ánh sáng: khẳng định tích cực, không "đừng/tránh/không được" mệnh lệnh.`;

function fmtMalaysia(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    timeZone: "Asia/Kuala_Lumpur",
    hour12: false,
  });
}

function normaliseGroup(row: Partial<GroupRow>): GroupRow {
  return {
    id: String(row.id),
    group_id: Number(row.group_id),
    bot_username: row.bot_username ?? null,
    ai_enabled: row.ai_enabled ?? false,
    ai_max_messages_per_minute: row.ai_max_messages_per_minute ?? 10,
    ai_user_replies_per_minute: row.ai_user_replies_per_minute ?? 3,
    ai_user_replies_per_day: row.ai_user_replies_per_day ?? 100,
    ai_group_replies_per_hour: row.ai_group_replies_per_hour ?? 100,
    ai_group_replies_per_day: row.ai_group_replies_per_day ?? 1000,
    always_reply_owner: row.always_reply_owner ?? true,
    always_reply_admins: row.always_reply_admins ?? true,
    always_reply_on_mention: row.always_reply_on_mention ?? true,
    always_reply_on_reply_to_bot: row.always_reply_on_reply_to_bot ?? true,
    help_intent_ai_enabled: row.help_intent_ai_enabled ?? true,
    positive_engagement_enabled: row.positive_engagement_enabled ?? false,
    positive_engagement_cooldown_minutes: row.positive_engagement_cooldown_minutes ?? 20,
    positive_engagement_max_per_hour: row.positive_engagement_max_per_hour ?? 3,
    positive_engagement_max_per_day: row.positive_engagement_max_per_day ?? 20,
    positive_engagement_prompt: row.positive_engagement_prompt ?? null,
    community_support_prompt: row.community_support_prompt ?? null,
    help_intent_prompt: row.help_intent_prompt ?? null,
    fun_core_context_prompt: row.fun_core_context_prompt ?? null,
    ai_style_prompt: row.ai_style_prompt ?? null,
    ai_persona_prompt: row.ai_persona_prompt ?? null,
    ai_dm_prompt: row.ai_dm_prompt ?? null,
    ai_mirror_angel_web: row.ai_mirror_angel_web ?? true,

    community_personality: row.community_personality ?? "professional",
    ai_response_cache_ttl_hours: row.ai_response_cache_ttl_hours ?? 24,
    ai_knowledge_version: row.ai_knowledge_version ?? 1,
    mini_app_builder_timeout_minutes: row.mini_app_builder_timeout_minutes ?? 30,
    event_assistant_enabled: row.event_assistant_enabled ?? true,
    event_followup_enabled: row.event_followup_enabled ?? true,
    event_assistant_prompt: row.event_assistant_prompt ?? null,
    event_followup_prompt: row.event_followup_prompt ?? null,
    owner_anonymous_address_prompt: row.owner_anonymous_address_prompt ?? null,
    meditation_summary_enabled: row.meditation_summary_enabled ?? true,
    meditation_summary_prompt: row.meditation_summary_prompt ?? null,
  };
}

export default function TelegramAiTriggersTab() {
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [filterSource, setFilterSource] = useState("all");
  const [filterGroup, setFilterGroup] = useState("all");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [runtimeLogs, setRuntimeLogs] = useState<RuntimeLogRow[]>([]);
  const [cacheEntryCount, setCacheEntryCount] = useState(0);

  const loadGroups = async () => {
    const { data, error } = await (supabase as any)
      .from("telegram_community_settings")
      .select(
        "id, group_id, bot_username, ai_enabled, ai_max_messages_per_minute, ai_user_replies_per_minute, ai_user_replies_per_day, ai_group_replies_per_hour, ai_group_replies_per_day, always_reply_owner, always_reply_admins, always_reply_on_mention, always_reply_on_reply_to_bot, help_intent_ai_enabled, positive_engagement_enabled, positive_engagement_cooldown_minutes, positive_engagement_max_per_hour, positive_engagement_max_per_day, positive_engagement_prompt, community_support_prompt, help_intent_prompt, fun_core_context_prompt, ai_style_prompt, ai_persona_prompt, ai_dm_prompt, ai_mirror_angel_web, community_personality, ai_response_cache_ttl_hours, ai_knowledge_version, mini_app_builder_timeout_minutes, event_assistant_enabled, event_followup_enabled, event_assistant_prompt, event_followup_prompt, owner_anonymous_address_prompt, meditation_summary_enabled, meditation_summary_prompt",
      )
      .order("group_id", { ascending: true });

    if (error) {
      toast.error("Load group thất bại: " + error.message);
      return;
    }
    const rows = (data ?? []).map((row: Partial<GroupRow>) => normaliseGroup(row));
    setGroups(rows);
    setSelectedGroupId((current) => (
      current && rows.some((row) => row.id === current)
        ? current
        : rows[0]?.id ?? ""
    ));
  };

  const loadAudit = async () => {
    setLoading(true);
    let query = (supabase as any)
      .from("telegram_ai_audit")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (filterSource !== "all") query = query.eq("trigger_source", filterSource);
    if (filterGroup !== "all") query = query.eq("group_id", Number(filterGroup));

    const { data, error } = await query;
    setLoading(false);
    if (error) {
      toast.error("Load audit log thất bại: " + error.message);
      return;
    }
    setAudit((data ?? []) as AuditRow[]);
  };

  const loadRuntimeAnalytics = async () => {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [{ data: logs, error: logsError }, { count, error: cacheError }] = await Promise.all([
      (supabase as any)
        .from("telegram_ai_runtime_logs")
        .select("id, intent, provider, cache_hit, allowed, latency_ms, input_tokens, output_tokens, estimated_cost, created_at")
        .gte("created_at", dayAgo)
        .order("created_at", { ascending: false })
        .limit(1000),
      (supabase as any)
        .from("telegram_ai_response_cache")
        .select("id", { count: "exact", head: true }),
    ]);
    if (!logsError) setRuntimeLogs((logs ?? []) as RuntimeLogRow[]);
    if (!cacheError) setCacheEntryCount(count ?? 0);
  };

  useEffect(() => {
    loadGroups();
  }, []);

  useEffect(() => {
    loadAudit();
  }, [filterSource, filterGroup]);

  useEffect(() => {
    loadRuntimeAnalytics();
  }, []);

  const toggle = async (
    row: GroupRow,
    key:
      | "always_reply_owner"
      | "always_reply_admins"
      | "always_reply_on_mention"
      | "always_reply_on_reply_to_bot"
      | "help_intent_ai_enabled"
      | "positive_engagement_enabled"
      | "event_assistant_enabled"
      | "event_followup_enabled"
      | "meditation_summary_enabled"
      | "ai_mirror_angel_web",

    value: boolean,
  ) => {
    setSavingId(row.id);
    const { error } = await (supabase as any)
      .from("telegram_community_settings")
      .update({ [key]: value })
      .eq("id", row.id);
    setSavingId(null);

    if (error) {
      toast.error("Lưu thất bại: " + error.message);
      return;
    }
    setGroups((prev) => prev.map((item) => (item.id === row.id ? { ...item, [key]: value } : item)));
    toast.success("Đã cập nhật trigger");
  };

  const setLocalNumber = (
    rowId: string,
    key: NumberSettingKey,
    value: number,
  ) => {
    setGroups((prev) => prev.map((item) => (item.id === rowId ? { ...item, [key]: value } : item)));
  };

  const setLocalText = (rowId: string, key: TextSettingKey, value: string) => {
    setGroups((prev) => prev.map((item) => (item.id === rowId ? { ...item, [key]: value } : item)));
  };

  const saveNumber = async (
    row: GroupRow,
    key: NumberSettingKey,
  ) => {
    const value = Math.max(0, Number(row[key]) || 0);
    setSavingId(row.id);
    const { error } = await (supabase as any)
      .from("telegram_community_settings")
      .update({ [key]: value })
      .eq("id", row.id);
    setSavingId(null);

    if (error) {
      toast.error("Lưu thất bại: " + error.message);
      return;
    }
    toast.success("Đã lưu giới hạn AI");
  };

  const savePersonality = async (row: GroupRow, value: GroupRow["community_personality"]) => {
    setGroups((prev) => prev.map((item) => (item.id === row.id ? { ...item, community_personality: value } : item)));
    setSavingId(row.id);
    const { error } = await (supabase as any)
      .from("telegram_community_settings")
      .update({ community_personality: value })
      .eq("id", row.id);
    setSavingId(null);

    if (error) {
      toast.error("Lưu personality thất bại: " + error.message);
      return;
    }
    toast.success("Đã lưu Community Personality");
  };

  const clearAiCache = async (groupId?: number) => {
    const { data, error } = await supabase.functions.invoke("telegram-community-admin", {
      body: { action: "clear_ai_cache", payload: groupId ? { group_id: groupId } : {} },
    });
    if (error || (data as any)?.success === false) {
      toast.error("Clear cache thất bại: " + (error?.message ?? (data as any)?.error ?? "unknown"));
      return;
    }
    toast.success("Đã clear AI response cache");
    loadRuntimeAnalytics();
  };

  const [restyleStats, setRestyleStats] = useState<{ total: number; topHits: number } | null>(null);
  const loadRestyleStats = async () => {
    const { data, error } = await supabase.functions.invoke("telegram-community-admin", {
      body: { action: "restyle_cache_stats", payload: {} },
    });
    if (error || (data as any)?.success === false) {
      toast.error("Không đọc được restyle cache: " + (error?.message ?? (data as any)?.error ?? "unknown"));
      return;
    }
    setRestyleStats({
      total: (data as any).total_entries ?? 0,
      topHits: (data as any).top_hits_sum ?? 0,
    });
  };
  const clearRestyleCache = async () => {
    const { data, error } = await supabase.functions.invoke("telegram-community-admin", {
      body: { action: "clear_restyle_cache", payload: {} },
    });
    if (error || (data as any)?.success === false) {
      toast.error("Xoá restyle cache thất bại: " + (error?.message ?? (data as any)?.error ?? "unknown"));
      return;
    }
    toast.success("Đã xoá toàn bộ restyle cache");
    loadRestyleStats();
  };
  useEffect(() => { loadRestyleStats(); }, []);


  const saveText = async (row: GroupRow, key: TextSettingKey) => {
    const value = row[key]?.trim() ? row[key] : null;
    setSavingId(row.id);
    const { error } = await (supabase as any)
      .from("telegram_community_settings")
      .update({ [key]: value })
      .eq("id", row.id);

    if (error) {
      setSavingId(null);
      toast.error("Luu that bai: " + error.message);
      return;
    }

    const { data: fresh, error: reloadError } = await (supabase as any)
      .from("telegram_community_settings")
      .select(key)
      .eq("id", row.id)
      .maybeSingle();
    setSavingId(null);

    if (reloadError) {
      toast.warning("Da luu prompt, nhung chua doc lai duoc tu database. Refresh trang de kiem tra lai.");
      setGroups((prev) => prev.map((item) => (item.id === row.id ? { ...item, [key]: value } : item)));
      return;
    }

    const persistedValue = Object.prototype.hasOwnProperty.call(fresh ?? {}, key)
      ? (fresh as Record<string, string | null>)[key]
      : value;
    setGroups((prev) => prev.map((item) => (item.id === row.id ? { ...item, [key]: persistedValue } : item)));
    toast.success("Da luu prompt va xac nhan database");
  };

  const allowedLogs = runtimeLogs.filter((log) => log.allowed);
  const geminiCalls = runtimeLogs.filter((log) => log.allowed && !log.cache_hit && log.provider !== "deterministic").length;
  const cacheHits = runtimeLogs.filter((log) => log.cache_hit).length;
  const cacheMisses = allowedLogs.filter((log) => !log.cache_hit && log.provider !== "deterministic").length;
  const spamBlocked = runtimeLogs.filter((log) => !log.allowed && log.intent === "spam").length;
  const knowledgeSearches = runtimeLogs.filter((log) => ["knowledge_question", "mini_app_builder", "wallet_request", "livestream_request", "telegram_request"].includes(log.intent)).length;
  const toolCalls = runtimeLogs.filter((log) => ["mini_app_builder", "wallet_request", "livestream_request", "telegram_request"].includes(log.intent)).length;
  const totalTokens = runtimeLogs.reduce((sum, log) => sum + Number(log.input_tokens ?? 0) + Number(log.output_tokens ?? 0), 0);
  const totalCost = runtimeLogs.reduce((sum, log) => sum + Number(log.estimated_cost ?? 0), 0);
  const avgLatency = allowedLogs.length
    ? Math.round(allowedLogs.reduce((sum, log) => sum + Number(log.latency_ms ?? 0), 0) / allowedLogs.length)
    : 0;
  const selectedGroup = groups.find((group) => group.id === selectedGroupId) ?? groups[0] ?? null;
  const displayedGroups = selectedGroup ? [selectedGroup] : [];

  return (
    <div className="space-y-6">
      <Card className="space-y-2 p-4">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">AI trigger theo group</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Cấu hình này đọc và ghi đúng bảng webhook đang sử dụng. Moderation chạy trước, quick reply chạy trước AI,
          sau đó Angel mới xét các trigger bên dưới.
        </p>
      </Card>

      <Card className="space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">Runtime Analytics 24h</h2>
            <p className="text-sm text-muted-foreground">
              Theo dõi quyết định AI, Gemini calls, cache và spam để kiểm soát chi phí.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadRuntimeAnalytics}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={() => clearAiCache()}>
              Clear cache
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <MetricCard label="AI replies" value={allowedLogs.length} />
          <MetricCard label="Gemini calls" value={geminiCalls} />
          <MetricCard label="Cache hits" value={cacheHits} />
          <MetricCard label="Cache misses" value={cacheMisses} />
          <MetricCard label="Cache entries" value={cacheEntryCount} />
          <MetricCard label="Tokens" value={totalTokens} />
          <MetricCard label="Est. cost" value={`$${totalCost.toFixed(4)}`} />
          <MetricCard label="Spam blocked" value={spamBlocked} />
          <MetricCard label="Knowledge searches" value={knowledgeSearches} />
          <MetricCard label="Avg latency" value={`${avgLatency}ms`} />
        </div>
        <div className="text-xs text-muted-foreground">Tool calls hôm nay: {toolCalls}</div>
      </Card>

      <Card className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">♻️ Cache biên tập lại (Pass 2)</h2>
            <p className="text-sm text-muted-foreground">
              Lưu kết quả biên tập theo style prompt để câu hỏi lặp không phải gọi FUN Core lần 2 → tiết kiệm token & nhanh hơn ~1–2s.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadRestyleStats}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={clearRestyleCache}>
              Xoá toàn bộ
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <MetricCard label="Entries cache" value={restyleStats?.total ?? 0} />
          <MetricCard label="Top-10 hits (sum)" value={restyleStats?.topHits ?? 0} />
          <MetricCard label="TTL" value="30 ngày" />
        </div>
      </Card>


      {groups.length === 0 ? (
        <Card className="p-6 text-center text-muted-foreground">Chưa có group nào.</Card>
      ) : (
        <>
          <Card className="space-y-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Cau hinh theo group</h2>
                <p className="text-sm text-muted-foreground">
                  Chon group can cai dat de giao dien gon hon. Moi thay doi van luu rieng theo group_id.
                </p>
              </div>
              <Select value={selectedGroup?.id ?? ""} onValueChange={setSelectedGroupId}>
                <SelectTrigger className="w-full sm:w-[320px]">
                  <SelectValue placeholder="Chon Telegram group" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.bot_username ? `@${group.bot_username}` : "Telegram group"} · {group.group_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </Card>

          {displayedGroups.map((row) => (
          <Card key={row.id} className="space-y-4 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-medium">{row.bot_username ? `@${row.bot_username}` : "Telegram group"}</div>
                <div className="font-mono text-xs text-muted-foreground">
                  group_id: {row.group_id} · AI: {row.ai_enabled ? "on" : "off"}
                </div>
              </div>
              {savingId === row.id && (
                <Badge variant="outline" className="text-xs">
                  Đang lưu...
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <ToggleCell
                id={`owner-${row.id}`}
                label="Owner / Anonymous owner auto-reply"
                description="Bật để Angel luôn reply tin của chủ sở hữu thật hoặc khi chủ nhắn bằng tên group."
                checked={row.always_reply_owner}
                onChange={(value) => toggle(row, "always_reply_owner", value)}
              />
              <ToggleCell
                id={`admin-${row.id}`}
                label="Admin auto-reply"
                description="Bật để Angel reply admin và trusted sender_chat/channel riêng đã đăng ký."
                checked={row.always_reply_admins}
                onChange={(value) => toggle(row, "always_reply_admins", value)}
              />
              <ToggleCell
                id={`mention-${row.id}`}
                label="Mention bot"
                checked={row.always_reply_on_mention}
                onChange={(value) => toggle(row, "always_reply_on_mention", value)}
              />
              <ToggleCell
                id={`reply-${row.id}`}
                label="Reply-to-bot"
                checked={row.always_reply_on_reply_to_bot}
                onChange={(value) => toggle(row, "always_reply_on_reply_to_bot", value)}
              />
              <ToggleCell
                id={`help-${row.id}`}
                label="Ý định cần hỗ trợ"
                checked={row.help_intent_ai_enabled}
                onChange={(value) => toggle(row, "help_intent_ai_enabled", value)}
              />
              <ToggleCell
                id={`positive-${row.id}`}
                label="Tương tác cộng đồng tích cực"
                checked={row.positive_engagement_enabled}
                onChange={(value) => toggle(row, "positive_engagement_enabled", value)}
              />
              <ToggleCell
                id={`event-assistant-${row.id}`}
                label="Event Assistant Zoom/livestream"
                description="Bật để Angel tự reply lần đầu khi thấy thông báo Zoom/livestream rõ ràng; tắt để Angel im lặng với event trừ khi được hỏi."
                checked={row.event_assistant_enabled}
                onChange={(value) => toggle(row, "event_assistant_enabled", value)}
              />
              <ToggleCell
                id={`followup-${row.id}`}
                label="Event follow-up Q&A"
                description="Chỉ dùng cho câu hỏi tiếp theo như hỏi lại link, ID/PW hoặc giờ; tắt mục này không tắt auto-reply đầu tiên."
                checked={row.event_followup_enabled}
                onChange={(value) => toggle(row, "event_followup_enabled", value)}
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <NumberCell
                id={`rate-${row.id}`}
                label="AI replies/phút/user"
                value={row.ai_max_messages_per_minute}
                onChange={(value) => setLocalNumber(row.id, "ai_max_messages_per_minute", value)}
                onSave={() => saveNumber(row, "ai_max_messages_per_minute")}
              />
              <NumberCell
                id={`cooldown-${row.id}`}
                label="Positive cooldown/phút/group"
                value={row.positive_engagement_cooldown_minutes}
                onChange={(value) => setLocalNumber(row.id, "positive_engagement_cooldown_minutes", value)}
                onSave={() => saveNumber(row, "positive_engagement_cooldown_minutes")}
              />
              <NumberCell
                id={`hour-${row.id}`}
                label="Positive replies/giờ/group"
                value={row.positive_engagement_max_per_hour}
                onChange={(value) => setLocalNumber(row.id, "positive_engagement_max_per_hour", value)}
                onSave={() => saveNumber(row, "positive_engagement_max_per_hour")}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="space-y-3 rounded border bg-muted/20 p-3">
                <div>
                  <h3 className="font-medium">AI Rate Limits</h3>
                  <p className="text-xs text-muted-foreground">Giới hạn token/Gemini theo user và toàn group.</p>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <NumberCell id={`normal-minute-${row.id}`} label="Normal user / phút" value={row.ai_user_replies_per_minute} defaultValue={3} description="Tối đa mỗi phút cho user thường." onChange={(value) => setLocalNumber(row.id, "ai_user_replies_per_minute", value)} onSave={() => saveNumber(row, "ai_user_replies_per_minute")} onRestore={() => setLocalNumber(row.id, "ai_user_replies_per_minute", 3)} />
                  <NumberCell id={`normal-day-${row.id}`} label="Normal user / ngày" value={row.ai_user_replies_per_day} defaultValue={100} description="Giới hạn một user trong 24h." onChange={(value) => setLocalNumber(row.id, "ai_user_replies_per_day", value)} onSave={() => saveNumber(row, "ai_user_replies_per_day")} onRestore={() => setLocalNumber(row.id, "ai_user_replies_per_day", 100)} />
                  <NumberCell id={`group-hour-${row.id}`} label="Group / giờ" value={row.ai_group_replies_per_hour} defaultValue={100} description="Safety cap toàn group mỗi giờ." onChange={(value) => setLocalNumber(row.id, "ai_group_replies_per_hour", value)} onSave={() => saveNumber(row, "ai_group_replies_per_hour")} onRestore={() => setLocalNumber(row.id, "ai_group_replies_per_hour", 100)} />
                  <NumberCell id={`group-day-${row.id}`} label="Group / ngày" value={row.ai_group_replies_per_day} defaultValue={1000} description="Safety cap toàn group trong 24h." onChange={(value) => setLocalNumber(row.id, "ai_group_replies_per_day", value)} onSave={() => saveNumber(row, "ai_group_replies_per_day")} onRestore={() => setLocalNumber(row.id, "ai_group_replies_per_day", 1000)} />
                  <NumberCell id={`cache-ttl-${row.id}`} label="Cache TTL / giờ" value={row.ai_response_cache_ttl_hours} defaultValue={24} description="Thời gian giữ cache FAQ/knowledge." onChange={(value) => setLocalNumber(row.id, "ai_response_cache_ttl_hours", value)} onSave={() => saveNumber(row, "ai_response_cache_ttl_hours")} onRestore={() => setLocalNumber(row.id, "ai_response_cache_ttl_hours", 24)} />
                  <NumberCell id={`builder-timeout-${row.id}`} label="Builder timeout / phút" value={row.mini_app_builder_timeout_minutes} defaultValue={30} description="Hết hạn builder mode sau khi im lặng." onChange={(value) => setLocalNumber(row.id, "mini_app_builder_timeout_minutes", value)} onSave={() => saveNumber(row, "mini_app_builder_timeout_minutes")} onRestore={() => setLocalNumber(row.id, "mini_app_builder_timeout_minutes", 30)} />
                </div>
                <div className="flex justify-end">
                  <Button type="button" variant="outline" size="sm" onClick={() => clearAiCache(row.group_id)}>Clear cache group này</Button>
                </div>
              </div>

              <div className="space-y-3 rounded border bg-muted/20 p-3">
                <div>
                  <h3 className="font-medium">Community Engagement</h3>
                  <p className="text-xs text-muted-foreground">Điều tiết Angel chủ động tương tác tích cực.</p>
                </div>
                <div className="rounded border bg-background p-3">
                  <Label className="text-sm">Community Personality</Label>
                  <Select value={row.community_personality} onValueChange={(value) => savePersonality(row, value as GroupRow["community_personality"])}>
                    <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="silent">Silent</SelectItem>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="friendly">Friendly</SelectItem>
                      <SelectItem value="very_active">Very Active</SelectItem>
                      <SelectItem value="celebration">Celebration Mode</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-xs text-muted-foreground">Silent sẽ tắt proactive positive auto-reply.</p>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <NumberCell id={`cooldown-v1-${row.id}`} label="Positive cooldown / phút" value={row.positive_engagement_cooldown_minutes} defaultValue={20} description="Chờ trước positive reply tiếp theo." onChange={(value) => setLocalNumber(row.id, "positive_engagement_cooldown_minutes", value)} onSave={() => saveNumber(row, "positive_engagement_cooldown_minutes")} onRestore={() => setLocalNumber(row.id, "positive_engagement_cooldown_minutes", 20)} />
                  <NumberCell id={`positive-hour-${row.id}`} label="Positive / giờ" value={row.positive_engagement_max_per_hour} defaultValue={3} description="Tối đa mỗi giờ/group." onChange={(value) => setLocalNumber(row.id, "positive_engagement_max_per_hour", value)} onSave={() => saveNumber(row, "positive_engagement_max_per_hour")} onRestore={() => setLocalNumber(row.id, "positive_engagement_max_per_hour", 3)} />
                  <NumberCell id={`positive-day-${row.id}`} label="Positive / ngày" value={row.positive_engagement_max_per_day} defaultValue={20} description="Tối đa trong 24h/group." onChange={(value) => setLocalNumber(row.id, "positive_engagement_max_per_day", value)} onSave={() => saveNumber(row, "positive_engagement_max_per_day")} onRestore={() => setLocalNumber(row.id, "positive_engagement_max_per_day", 20)} />
                  <NumberCell id={`knowledge-version-${row.id}`} label="Knowledge version" value={row.ai_knowledge_version} defaultValue={1} description="Tăng số này để invalidate cache." onChange={(value) => setLocalNumber(row.id, "ai_knowledge_version", value)} onSave={() => saveNumber(row, "ai_knowledge_version")} onRestore={() => setLocalNumber(row.id, "ai_knowledge_version", 1)} />
                </div>
              </div>
            </div>

            <div className="rounded border border-primary/20 bg-primary/5 p-3">
              <p className="text-sm font-medium text-foreground">Gợi ý để Angel tương tác tích cực nhiều hơn</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Nếu nhóm muốn Angel chăm sóc cộng đồng nhiều hơn, hãy bật “Tương tác cộng đồng tích cực”, chọn
                Personality là Friendly/Very Active, đặt cooldown khoảng 5–10 phút và Positive/giờ khoảng 5–8.
                Prompt bên dưới quyết định giọng văn khi Angel gặp bài biết ơn, đội ơn, sám hối, lời nguyện,
                thiền, phòng thiền, Love Hub hoặc chia sẻ năng lượng tích cực.
              </p>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50/30 p-3">
              <p className="text-sm font-semibold text-foreground">Bản đồ quản lý prompt Angel AI</p>
              <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-muted-foreground md:grid-cols-2">
                <p><b>Cốt lõi:</b> xưng hô Angel/bé, độ ngắn, emoji, format Telegram.</p>
                <p><b>Fact sản phẩm:</b> livestream, replay, route, reward, chính sách cộng đồng.</p>
                <p><b>Tự động tương tác:</b> biết ơn, trợ duyên, help intent, event follow-up, DM riêng.</p>
                <p><b>Nâng cao:</b> legacy fallback, persona custom, owner anonymous sender_chat.</p>
              </div>
            </div>

            <PromptSectionHeader
              title="Nâng cao / ít đụng"
              description="Chỉ sửa khi xử lý owner/admin nhắn bằng sender_chat hoặc cần cấu hình đặc biệt; không dùng cho giọng thường ngày."
            />

            <div className="rounded border bg-muted/30 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <Label htmlFor={`owner-address-prompt-${row.id}`} className="text-sm">
                    Prompt xung ho Owner Anonymous Admin
                  </Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Ap dung khi owner nhan tin bang ten group/sender_chat. Dung de chinh Angel goi la Cha, Be Ly, hoac cach xung ho rieng.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setLocalText(row.id, "owner_anonymous_address_prompt", DEFAULT_OWNER_ANONYMOUS_ADDRESS_PROMPT)}
                >
                  Khoi phuc mac dinh
                </Button>
              </div>
              <Textarea
                id={`owner-address-prompt-${row.id}`}
                className="mt-3 min-h-[150px] font-mono text-xs"
                value={row.owner_anonymous_address_prompt ?? DEFAULT_OWNER_ANONYMOUS_ADDRESS_PROMPT}
                onChange={(event) => setLocalText(row.id, "owner_anonymous_address_prompt", event.target.value)}
              />
              <PromptHealthBox value={row.owner_anonymous_address_prompt ?? DEFAULT_OWNER_ANONYMOUS_ADDRESS_PROMPT} kind="advanced_owner" />
              <PromptUsageNote
                when="Owner/admin nhắn bằng tên group hoặc sender_chat và cần rule xưng hô riêng."
                avoid="chỉnh giọng Angel cho toàn group, thêm fact sản phẩm, hoặc sửa prompt tương tác tích cực."
              />
              <div className="mt-2 flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => saveText(row, "owner_anonymous_address_prompt")}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Luu prompt
                </Button>
              </div>
            </div>

            <PromptSectionHeader
              title="Tự động tương tác"
              description="Các prompt Angel tự dùng theo tình huống: bài biết ơn, trợ duyên, cần hỗ trợ, DM riêng và hỏi tiếp event."
            />

            <div className="rounded border bg-muted/30 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <Label htmlFor={`positive-prompt-${row.id}`} className="text-sm">
                    Prompt phản hồi sám hối / biết ơn
                  </Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Dùng <code>{"{{content}}"}</code> để chèn nội dung user gửi. Để trống sẽ dùng prompt mặc định của Angel.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setLocalText(row.id, "positive_engagement_prompt", DEFAULT_POSITIVE_ENGAGEMENT_PROMPT)}
                >
                  Khôi phục mặc định
                </Button>
              </div>
              <Textarea
                id={`positive-prompt-${row.id}`}
                className="mt-3 min-h-[180px] font-mono text-xs"
                value={row.positive_engagement_prompt ?? DEFAULT_POSITIVE_ENGAGEMENT_PROMPT}
                onChange={(event) => setLocalText(row.id, "positive_engagement_prompt", event.target.value)}
              />
              <PromptHealthBox value={row.positive_engagement_prompt ?? DEFAULT_POSITIVE_ENGAGEMENT_PROMPT} kind="auto_trigger" />
              <PromptUsageNote
                when="Muốn Angel phản hồi bài biết ơn, sám hối, thiền, lời nguyện hoặc chia sẻ tích cực khác đi."
                avoid="xử lý trợ duyên/quỹ/ví crypto, thêm fact sản phẩm, hoặc đổi persona Angel/bé."
              />
              <div className="mt-2 flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => saveText(row, "positive_engagement_prompt")}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Lưu prompt
                </Button>
              </div>
            </div>

            <div className="rounded border bg-muted/30 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <Label htmlFor={`support-prompt-${row.id}`} className="text-sm">
                    Prompt tro duyen / Love Hub
                  </Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Ap dung rieng cho bai tro duyen, tro luc, quy cong dong, USDT/CLC/vi crypto. Dung <code>{"{{content}}"}</code> de chen noi dung user gui.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setLocalText(row.id, "community_support_prompt", DEFAULT_COMMUNITY_SUPPORT_PROMPT)}
                >
                  Khoi phuc mac dinh
                </Button>
              </div>
              <Textarea
                id={`support-prompt-${row.id}`}
                className="mt-3 min-h-[190px] font-mono text-xs"
                value={row.community_support_prompt ?? DEFAULT_COMMUNITY_SUPPORT_PROMPT}
                onChange={(event) => setLocalText(row.id, "community_support_prompt", event.target.value)}
              />
              <PromptHealthBox value={row.community_support_prompt ?? DEFAULT_COMMUNITY_SUPPORT_PROMPT} kind="auto_trigger" />
              <PromptUsageNote
                when="Nội dung có dấu hiệu trợ duyên, trợ lực, Love Hub, quỹ cộng đồng, USDT/CLC hoặc ví crypto."
                avoid="hứa lợi nhuận, thúc giục chuyển tiền, hoặc phản hồi bài biết ơn thuần túy."
              />
              <div className="mt-2 flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => saveText(row, "community_support_prompt")}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Luu prompt
                </Button>
              </div>
            </div>

            <div className="rounded border bg-amber-50/40 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <Label htmlFor={`help-intent-prompt-${row.id}`} className="text-sm">
                    💛 Prompt trả lời khi bé cần hỗ trợ (Help intent)
                  </Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Áp dụng cho các tin nhắn có ý định cần hỗ trợ (audit log = "Ý định cần hỗ trợ"). Mục tiêu: ngắn gọn, dễ thương, có emoji, xưng <b>Angel/bé</b>. Dùng <code>{"{{content}}"}</code> để chèn nội dung user gửi.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setLocalText(row.id, "help_intent_prompt", DEFAULT_HELP_INTENT_PROMPT)}
                >
                  Khôi phục mặc định
                </Button>
              </div>
              <Textarea
                id={`help-intent-prompt-${row.id}`}
                className="mt-3 min-h-[180px] font-mono text-xs"
                value={row.help_intent_prompt ?? DEFAULT_HELP_INTENT_PROMPT}
                onChange={(event) => setLocalText(row.id, "help_intent_prompt", event.target.value)}
              />
              <PromptHealthBox value={row.help_intent_prompt ?? DEFAULT_HELP_INTENT_PROMPT} kind="auto_trigger" />
              <PromptUsageNote
                when="Muốn đổi cách Angel nâng đỡ khi bé có ý định cần hỗ trợ trong group."
                avoid="dạy kiến thức sản phẩm mới hoặc thay toàn bộ giọng/persona chung."
              />
              <div className="mt-2 flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => saveText(row, "help_intent_prompt")}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Lưu prompt
                </Button>
              </div>
            </div>

            <div className="rounded border bg-pink-50/40 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <Label htmlFor={`ai-dm-prompt-${row.id}`} className="text-sm">
                    📩 Prompt trả lời khi bé nhắn tin DM riêng với Angel
                  </Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Áp dụng khi user nhắn tin riêng (private chat) với bot Angel AI. Để trống sẽ dùng prompt hệ thống mặc định. Xưng <b>Angel/bé</b>, ấm áp, có emoji. (Lưu ý: prompt DM dùng chung cho toàn bộ kênh DM — lấy từ group đầu tiên.)
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setLocalText(row.id, "ai_dm_prompt", DEFAULT_AI_DM_PROMPT)}
                >
                  Khôi phục mặc định
                </Button>
              </div>
              <Textarea
                id={`ai-dm-prompt-${row.id}`}
                className="mt-3 min-h-[180px] font-mono text-xs"
                value={row.ai_dm_prompt ?? ""}
                placeholder={DEFAULT_AI_DM_PROMPT}
                onChange={(event) => setLocalText(row.id, "ai_dm_prompt", event.target.value)}
              />
              <PromptHealthBox value={row.ai_dm_prompt || DEFAULT_AI_DM_PROMPT} kind="dm" />
              <PromptUsageNote
                when="Muốn đổi giọng Angel trong tin nhắn riêng DM với bot."
                avoid="đổi hành vi group, thêm fact sản phẩm, hoặc cấu hình moderation."
              />
              <div className="mt-2 flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => saveText(row, "ai_dm_prompt")}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Lưu prompt
                </Button>
              </div>
            </div>

            <div className="rounded border bg-emerald-50/40 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <Label htmlFor={`meditation-summary-prompt-${row.id}`} className="text-sm">
                    🧘 Prompt tóm tắt chủ đề bài thiền (Meditation Summary)
                  </Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Khi bot phát hiện tin nhắn mời vào Zoom thiền (có "Chủ đề:" + link Zoom), Angel sẽ reply thêm 1 tin tóm tắt <b>ý nghĩa chủ đề bài thiền</b>. Dùng biến <code>{"{{topic}}"}</code> để chèn chủ đề.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 rounded border bg-white/60 px-3 py-1.5">
                    <Label htmlFor={`meditation-summary-enabled-${row.id}`} className="cursor-pointer text-xs">
                      Bật auto tóm tắt
                    </Label>
                    <Switch
                      id={`meditation-summary-enabled-${row.id}`}
                      checked={row.meditation_summary_enabled}
                      onCheckedChange={(value) => toggle(row, "meditation_summary_enabled", value)}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setLocalText(row.id, "meditation_summary_prompt", DEFAULT_MEDITATION_SUMMARY_PROMPT)}
                  >
                    Khôi phục mặc định
                  </Button>
                </div>
              </div>
              <Textarea
                id={`meditation-summary-prompt-${row.id}`}
                className="mt-3 min-h-[180px] font-mono text-xs"
                value={row.meditation_summary_prompt ?? ""}
                placeholder={DEFAULT_MEDITATION_SUMMARY_PROMPT}
                onChange={(event) => setLocalText(row.id, "meditation_summary_prompt", event.target.value)}
              />
              <PromptHealthBox value={row.meditation_summary_prompt || DEFAULT_MEDITATION_SUMMARY_PROMPT} kind="event" />
              <PromptUsageNote
                when="Muốn đổi cách Angel tóm tắt ý nghĩa chủ đề bài thiền hằng ngày trong nhóm."
                avoid="đưa link/thời gian/ID Zoom vào — những thứ này đã có trong tin nhắn gốc."
              />
              <p className="mt-2 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-muted-foreground">
                Lưu ý: tính năng này chỉ chạy khi bật cả “Event Assistant cho Zoom / livestream” trong cấu hình group và “Bật auto tóm tắt” tại đây.
              </p>
              <div className="mt-2 flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => saveText(row, "meditation_summary_prompt")}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Lưu prompt
                </Button>
              </div>
            </div>





            <PromptSectionHeader
              title="Fact sản phẩm"
              description="Chỉ dùng để thêm/sửa sự thật về FUN Profile/FUN.RICH: livestream, replay, route, reward hoặc chính sách cộng đồng."
            />

            <div className="rounded border bg-muted/30 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <Label htmlFor={`fun-core-context-prompt-${row.id}`} className="text-sm">
                    Prompt FUN Core / Knowledge context
                  </Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Áp dụng cho câu hỏi kiến thức FUN Profile/FUN.RICH trước khi gọi Angel AI API. Dùng để nhấn mạnh fact mới như live stream, replay, route, reward hoặc chính sách cộng đồng.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setLocalText(row.id, "fun_core_context_prompt", DEFAULT_FUN_CORE_CONTEXT_PROMPT)}
                >
                  Khôi phục mặc định
                </Button>
              </div>
              <Textarea
                id={`fun-core-context-prompt-${row.id}`}
                className="mt-3 min-h-[190px] font-mono text-xs"
                value={row.fun_core_context_prompt ?? DEFAULT_FUN_CORE_CONTEXT_PROMPT}
                onChange={(event) => setLocalText(row.id, "fun_core_context_prompt", event.target.value)}
              />
              <PromptHealthBox value={row.fun_core_context_prompt ?? DEFAULT_FUN_CORE_CONTEXT_PROMPT} kind="knowledge" />
              <PromptUsageNote
                when="Có fact sản phẩm mới hoặc cần sửa fact cũ về FUN Profile/FUN.RICH."
                avoid="chỉnh giọng văn, emoji, xưng hô Angel/bé, hoặc viết prompt tương tác tự động."
              />
              <div className="mt-2 flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => saveText(row, "fun_core_context_prompt")}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Lưu prompt FUN Core
                </Button>
              </div>
            </div>

            <PromptSectionHeader
              title="Cốt lõi — giọng, xưng hô, format"
              description="Nhóm admin nên chỉnh thường xuyên nhất khi muốn Angel nói đúng Angel/bé, ngắn hơn, ít lan man và emoji vừa đủ."
            />

            <div className="rounded border bg-muted/30 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <Label htmlFor={`ai-style-prompt-${row.id}`} className="text-sm">
                    Prompt phong cách trả lời (ngắn gọn + emoji)
                  </Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Rule này áp dụng ở bước <b>biên tập lại</b> câu trả lời của Angel chính chủ (rút gọn, thêm emoji, format Telegram HTML). Nội dung knowledge/RAG luôn được giữ nguyên 100%. Để trống sẽ dùng style mặc định.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setLocalText(row.id, "ai_style_prompt", DEFAULT_AI_STYLE_PROMPT)}
                >
                  Khôi phục mặc định
                </Button>
              </div>
              <Textarea
                id={`ai-style-prompt-${row.id}`}
                className="mt-3 min-h-[170px] font-mono text-xs"
                value={row.ai_style_prompt ?? DEFAULT_AI_STYLE_PROMPT}
                onChange={(event) => setLocalText(row.id, "ai_style_prompt", event.target.value)}
              />
              <PromptHealthBox value={row.ai_style_prompt ?? DEFAULT_AI_STYLE_PROMPT} kind="core_style" />
              <PromptUsageNote
                when="Muốn Angel trả lời ngắn hơn, bớt lan man, emoji vừa đủ hoặc đúng format Telegram HTML."
                avoid="thêm fact sản phẩm, đổi dữ liệu RAG, hoặc sửa luật xưng hô Angel/bé."
              />
              <div className="mt-2 flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => saveText(row, "ai_style_prompt")}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Lưu prompt phong cách
                </Button>
              </div>
            </div>

            <StylePreviewBox
              groupId={row.group_id}
              currentStylePrompt={row.ai_style_prompt ?? DEFAULT_AI_STYLE_PROMPT}
            />

            <div className="rounded border bg-emerald-50/40 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <Label className="text-sm">🪞 Mirror Angel chính chủ (Pass 1 không system wrapper)</Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Bật (khuyến nghị): Pass 1 gửi <b>user-only</b> tới FUN Core — giống hệt Angel web <code>angelquangvu.fun.rich</code> — để RAG hit đúng knowledge nội bộ (FUN Ecosystem, Cha Vũ Trụ, Thần Chú, LoveHUB…). Persona "Angel/bé" vẫn được ép ở Pass 2 + post-process. Tắt chỉ khi muốn rollback hành vi chèn persona system message vào Pass 1.
                  </p>
                  <PromptUsageNote
                    when="Chỉ tắt để rollback hành vi cũ hoặc debug khi nghi ngờ wrapper làm lệch RAG."
                    avoid="dùng như prompt; đây là công tắc pipeline, không phải nơi nhập nội dung."
                  />
                </div>
                <Switch
                  checked={row.ai_mirror_angel_web}
                  onCheckedChange={(value) => toggle(row, "ai_mirror_angel_web", value)}
                />
              </div>
            </div>



            <div className="rounded border bg-muted/30 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <Label htmlFor={`ai-persona-prompt-${row.id}`} className="text-sm">
                    🪪 Prompt xưng hô (Persona — Angel / bé)
                  </Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Rule này được inject ở <b>cả Pass 1 (compose) và Pass 2 (biên tập)</b> với độ ưu tiên CAO NHẤT — đảm bảo bot luôn tự xưng <b>"Angel"</b> và gọi user là <b>"bé"</b> bất kể RAG/knowledge trả về persona nào. Hệ thống còn tự sửa hậu kỳ "mình → Angel", "bạn → bé" cho reply tiếng Việt. Để trống sẽ dùng persona mặc định.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setLocalText(row.id, "ai_persona_prompt", DEFAULT_AI_PERSONA_PROMPT)}
                >
                  Khôi phục mặc định
                </Button>
              </div>
              <Textarea
                id={`ai-persona-prompt-${row.id}`}
                className="mt-3 min-h-[200px] font-mono text-xs"
                value={row.ai_persona_prompt ?? DEFAULT_AI_PERSONA_PROMPT}
                onChange={(event) => setLocalText(row.id, "ai_persona_prompt", event.target.value)}
              />
              <PromptHealthBox value={row.ai_persona_prompt ?? DEFAULT_AI_PERSONA_PROMPT} kind="core_persona" />
              <PromptUsageNote
                when="Angel xưng hô sai, không gọi user là bé, hoặc cần khóa persona đa ngôn ngữ."
                avoid="thêm fact sản phẩm, tăng tương tác tự động, hoặc chỉnh độ dài câu trả lời."
              />
              <div className="mt-2 flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => saveText(row, "ai_persona_prompt")}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Lưu prompt xưng hô
                </Button>
              </div>
            </div>

            <div className="rounded border border-amber-200 bg-background/80 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Nguyên tắc vận hành prompt V1</p>
              <p className="mt-1">
                Angel lấy knowledge/RAG qua FUN Core API. Không nhồi knowledge dài vào prompt local; prompt local chỉ nên điều khiển giọng, format, trigger và fact patch ngắn.
              </p>
              <p className="mt-1">
                Nếu muốn sửa giọng thì dùng Cốt lõi; nếu muốn sửa fact sản phẩm thì dùng Prompt FUN Core; nếu muốn sửa auto-reply thì dùng đúng prompt trigger; Legacy chỉ dùng khi rollback/debug.
              </p>
            </div>

            <PromptSectionHeader
              title="Tự động tương tác — Event Assistant / Follow-up"
              description="Event Assistant dùng cho reply đầu tiên khi thấy Zoom/livestream; Event follow-up chỉ dùng cho câu hỏi tiếp theo về event."
            />

            <div className="rounded border bg-sky-50/40 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <Label htmlFor={`event-assistant-prompt-${row.id}`} className="text-sm">
                    Prompt Event Assistant Zoom / Livestream
                  </Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Dùng cho tin reply tự động đầu tiên khi Angel phát hiện thông báo Zoom/livestream. Biến hỗ trợ: <code>{"{{intro}}"}</code>, <code>{"{{topic_block}}"}</code>, <code>{"{{host_block}}"}</code>, <code>{"{{time_block}}"}</code>, <code>{"{{zoom_block}}"}</code>, <code>{"{{livestream_block}}"}</code>, <code>{"{{closing}}"}</code>.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setLocalText(row.id, "event_assistant_prompt", DEFAULT_EVENT_ASSISTANT_PROMPT)}
                >
                  Khôi phục mặc định
                </Button>
              </div>
              <Textarea
                id={`event-assistant-prompt-${row.id}`}
                className="mt-3 min-h-[170px] font-mono text-xs"
                value={row.event_assistant_prompt ?? DEFAULT_EVENT_ASSISTANT_PROMPT}
                onChange={(event) => setLocalText(row.id, "event_assistant_prompt", event.target.value)}
              />
              <PromptHealthBox value={row.event_assistant_prompt ?? DEFAULT_EVENT_ASSISTANT_PROMPT} kind="event" />
              <PromptUsageNote
                when="Muốn đổi nội dung Angel tự reply ngay khi thấy thông báo Zoom/livestream trong nhóm."
                avoid="câu hỏi tiếp theo về event, tóm tắt ý nghĩa bài thiền, hoặc fact sản phẩm FUN Profile."
              />
              <p className="mt-2 rounded border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-muted-foreground">
                Prompt này chỉ chạy khi “Event Assistant cho Zoom / livestream” đang bật. Để trống sẽ dùng template mặc định.
              </p>
              <div className="mt-2 flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => saveText(row, "event_assistant_prompt")}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Lưu prompt
                </Button>
              </div>
            </div>

            <div className="rounded border bg-muted/30 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <Label htmlFor={`followup-prompt-${row.id}`} className="text-sm">
                    Prompt Event follow-up
                  </Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Dùng các biến <code>{"{{question}}"}</code>, <code>{"{{intent}}"}</code>, <code>{"{{event_json}}"}</code>, <code>{"{{deterministic_answer}}"}</code>. Để trống sẽ dùng câu trả lời chuẩn không gọi AI.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setLocalText(row.id, "event_followup_prompt", DEFAULT_EVENT_FOLLOWUP_PROMPT)}
                >
                  Khôi phục mặc định
                </Button>
              </div>
              <Textarea
                id={`followup-prompt-${row.id}`}
                className="mt-3 min-h-[180px] font-mono text-xs"
                value={row.event_followup_prompt ?? DEFAULT_EVENT_FOLLOWUP_PROMPT}
                onChange={(event) => setLocalText(row.id, "event_followup_prompt", event.target.value)}
              />
              <PromptHealthBox value={row.event_followup_prompt ?? DEFAULT_EVENT_FOLLOWUP_PROMPT} kind="event" />
              <PromptUsageNote
                when="Muốn đổi cách Angel trả lời câu hỏi tiếp theo về event đã ghi nhận."
                avoid="phản hồi bài biết ơn, trợ duyên, DM riêng, hoặc fact sản phẩm chung."
              />
              <div className="mt-2 flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => saveText(row, "event_followup_prompt")}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Lưu prompt
                </Button>
              </div>
            </div>
          </Card>
          ))}
        </>
      )}

      <Card className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">AI trigger audit log</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={filterSource} onValueChange={setFilterSource}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Trigger source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả nguồn</SelectItem>
                {sourceOptions.map((source) => (
                  <SelectItem key={source} value={source}>
                    {SOURCE_LABEL[source]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterGroup} onValueChange={setFilterGroup}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Group" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả group</SelectItem>
                {groups.map((group) => (
                  <SelectItem key={group.id} value={String(group.group_id)}>
                    {group.bot_username ? `@${group.bot_username}` : group.group_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={loadAudit} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-2 pr-3">Thời gian (MYT)</th>
                <th className="py-2 pr-3">Nguồn</th>
                <th className="py-2 pr-3">Group</th>
                <th className="py-2 pr-3">User</th>
                <th className="py-2 pr-3">Prompt</th>
                <th className="py-2 pr-3 text-right">Status</th>
                <th className="py-2 pr-3 text-right">ms</th>
              </tr>
            </thead>
            <tbody>
              {audit.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-muted-foreground">
                    Chưa có log.
                  </td>
                </tr>
              ) : (
                audit.map((row) => {
                  const group = groups.find((item) => item.group_id === row.group_id);
                  return (
                    <tr key={row.id} className="border-b align-top last:border-0">
                      <td className="whitespace-nowrap py-2 pr-3 font-mono text-xs">
                        {fmtMalaysia(row.created_at)}
                      </td>
                      <td className="py-2 pr-3">
                        <Badge variant="outline" className="text-xs">
                          {SOURCE_LABEL[row.trigger_source] ?? row.trigger_source}
                        </Badge>
                      </td>
                      <td className="py-2 pr-3 text-xs">
                        {group?.bot_username ? `@${group.bot_username}` : <span className="font-mono">{row.group_id}</span>}
                      </td>
                      <td className="py-2 pr-3 text-xs">
                        {row.username ? `@${row.username}` : row.user_id ?? "-"}
                      </td>
                      <td className="max-w-[360px] truncate py-2 pr-3 text-xs" title={row.prompt_preview ?? ""}>
                        {row.prompt_preview ?? ""}
                      </td>
                      <td className="py-2 pr-3 text-right text-xs">
                        {row.ai_responded ? "đã trả lời" : "lỗi"}
                      </td>
                      <td className="py-2 pr-3 text-right font-mono text-xs">
                        {row.response_time_ms ?? "-"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function ToggleCell(props: {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded border bg-muted/30 p-3">
      <div className="space-y-1">
        <Label htmlFor={props.id} className="cursor-pointer text-sm">
          {props.label}
        </Label>
        {props.description ? (
          <p className="text-xs text-muted-foreground">{props.description}</p>
        ) : null}
      </div>
      <Switch id={props.id} checked={props.checked} onCheckedChange={props.onChange} />
    </div>
  );
}

function PromptSectionHeader(props: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
      <p className="text-sm font-semibold text-foreground">{props.title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{props.description}</p>
    </div>
  );
}

function PromptUsageNote(props: {
  when: string;
  avoid: string;
}) {
  return (
    <div className="mt-2 rounded border bg-background/70 p-2 text-xs text-muted-foreground">
      <p><b>Khi nào sửa:</b> {props.when}</p>
      <p className="mt-1"><b>Không nên dùng để:</b> {props.avoid}</p>
    </div>
  );
}

function getPromptHealthIssues(value: string | null | undefined, kind: PromptHealthKind): string[] {
  const text = (value ?? "").trim();
  if (!text) return ["Prompt đang trống: hệ thống sẽ dùng mặc định nếu có."];

  const lower = text.toLowerCase();
  const issues: string[] = [];

  if (text.length > 4000) {
    issues.push("Prompt khá dài (>4.000 ký tự), dễ làm phản hồi chậm hoặc nhiễu RAG.");
  } else if (text.length > 2500) {
    issues.push("Prompt dài (>2.500 ký tự), nên rút gọn nếu chỉ là rule giọng/format.");
  }

  const forcesVietnamese = /100%\s*(tiếng\s*việt|vietnamese)|luôn\s+trả\s+lời\s+(bằng\s+)?tiếng\s*việt|chỉ\s+trả\s+lời\s+(bằng\s+)?tiếng\s*việt/i.test(text);
  if (forcesVietnamese) {
    issues.push("Có dấu hiệu ép tiếng Việt; nên để Angel mirror theo ngôn ngữ user.");
  }

  if (/(chỉ|chi)\s+hỗ\s*trợ|ngoài\s+phạm\s+vi|không\s+thể\s+trả\s+lời/i.test(text)) {
    issues.push("Có câu giới hạn phạm vi; dễ xung đột với RAG và scope mở rộng của Angel.");
  }

  const hasOwnerWords = /\bcha\b|\/\s*con|cha\s*\/\s*con|\bcon\b/i.test(text);
  if (hasOwnerWords && kind !== "advanced_owner") {
    issues.push("Có từ Cha/con; chỉ nên dùng trong prompt Owner Anonymous, tránh xung đột Angel/bé.");
  }

  if ((kind === "core_style" || kind === "core_persona" || kind === "auto_trigger" || kind === "dm") && /(available\s+routes?|already\s+has|supports|do\s+not\s+answer|route|\/live|reward\s+policy|chính\s*sách\s+cộng\s+đồng)/i.test(text)) {
    issues.push("Có fact sản phẩm; nên chuyển fact sang Prompt FUN Core / Knowledge context.");
  }

  if (kind === "knowledge" && /(emoji|xưng|gọi user|angel\/bé|ngắn gọn|bullet|markdown|telegram html)/i.test(lower)) {
    issues.push("Có rule giọng/format; nên chuyển sang Prompt xưng hô hoặc Prompt phong cách.");
  }

  return issues;
}

function PromptHealthBox(props: {
  value: string | null | undefined;
  kind: PromptHealthKind;
}) {
  const issues = getPromptHealthIssues(props.value, props.kind);
  if (issues.length === 0) {
    return (
      <div className="mt-2 rounded border border-emerald-200 bg-emerald-50/60 p-2 text-xs text-emerald-700">
        Prompt ổn: chưa thấy dấu hiệu xung đột lớn.
      </div>
    );
  }

  return (
    <div className="mt-2 rounded border border-amber-200 bg-amber-50/70 p-2 text-xs text-amber-800">
      <p className="font-medium">Prompt health checker</p>
      <ul className="mt-1 list-disc space-y-1 pl-4">
        {issues.map((issue) => (
          <li key={issue}>{issue}</li>
        ))}
      </ul>
    </div>
  );
}

function NumberCell(props: {
  id: string;
  label: string;
  value: number;
  description?: string;
  defaultValue?: number;
  onChange: (value: number) => void;
  onSave: () => void;
  onRestore?: () => void;
}) {
  return (
    <div className="rounded border bg-muted/30 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <Label htmlFor={props.id} className="text-sm">
            {props.label}
          </Label>
          {props.description && <p className="mt-1 text-xs text-muted-foreground">{props.description}</p>}
          {props.defaultValue !== undefined && <p className="mt-1 text-[11px] text-muted-foreground">Mặc định: {props.defaultValue}</p>}
        </div>
        {props.onRestore && (
          <Button type="button" variant="ghost" size="sm" onClick={props.onRestore}>
            Reset
          </Button>
        )}
      </div>
      <div className="mt-2 flex gap-2">
        <Input
          id={props.id}
          type="number"
          min={0}
          value={props.value}
          onChange={(event) => props.onChange(Number(event.target.value))}
        />
        <Button type="button" variant="outline" size="icon" onClick={props.onSave} aria-label={`Lưu ${props.label}`}>
          <Save className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function StylePreviewBox(props: { groupId: number; currentStylePrompt: string }) {
  const [question, setQuestion] = useState("LoveHUB là gì hả Angel?");
  const [loading, setLoading] = useState(false);
  const [replyHtml, setReplyHtml] = useState<string>("");
  const [latency, setLatency] = useState<number | null>(null);
  const [error, setError] = useState<string>("");

  const runPreview = async () => {
    setLoading(true);
    setError("");
    setReplyHtml("");
    setLatency(null);
    const { data, error: invokeErr } = await supabase.functions.invoke("telegram-community-admin", {
      body: {
        action: "preview_ai_style",
        payload: {
          group_id: props.groupId,
          question: question.trim(),
          ai_style_prompt: props.currentStylePrompt,
        },
      },
    });
    setLoading(false);
    if (invokeErr || (data as any)?.success === false) {
      setError((data as any)?.error ?? invokeErr?.message ?? "Preview thất bại");
      return;
    }
    setReplyHtml((data as any)?.reply_html ?? "");
    setLatency((data as any)?.latency_ms ?? null);
  };

  return (
    <div className="rounded border border-primary/30 bg-primary/5 p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <Label className="text-sm">🔬 Xem trước phản hồi mẫu</Label>
          <p className="mt-1 text-xs text-muted-foreground">
            Thử nghiệm Prompt phong cách hiện tại (chưa cần lưu). Angel sẽ trả lời ngay tại đây như khi user hỏi trong group.
          </p>
        </div>
        <Button type="button" variant="default" size="sm" onClick={runPreview} disabled={loading || !question.trim()}>
          {loading ? "Đang gọi Angel..." : "Chạy preview"}
        </Button>
      </div>
      <Textarea
        className="mt-3 min-h-[70px] text-sm"
        placeholder="Nhập câu hỏi mẫu để test..."
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
      />
      {error && (
        <div className="mt-3 rounded border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
          {error}
        </div>
      )}
      {replyHtml && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>💬 Bot Angel trả lời (Telegram HTML) — ✨ đã biên tập lại từ Angel chính chủ</span>
            {latency !== null && <span className="font-mono">{latency}ms</span>}
          </div>
          <div
            className="rounded-2xl bg-background border p-3 text-sm leading-relaxed whitespace-pre-wrap break-words [&_b]:font-semibold [&_i]:italic"
            dangerouslySetInnerHTML={{ __html: replyHtml }}
          />
        </div>
      )}
    </div>
  );
}


function MetricCard(props: { label: string; value: string | number }) {
  return (
    <div className="rounded border bg-muted/30 p-3">
      <div className="text-xs text-muted-foreground">{props.label}</div>
      <div className="mt-1 text-xl font-semibold">{props.value}</div>
    </div>
  );
}

