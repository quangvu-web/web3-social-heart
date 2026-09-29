import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { formatMyt } from "@/lib/formatMyt";
import { getTelegramWebhookStatus, sanitizeWebhookUrl } from "./telegramWebhookStatus";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  Shield,
  Sparkles,
  Trash2,
  Plus,
} from "lucide-react";

const DEFAULT_ANGEL_PROMPT = `Bạn là Angel AI — trợ lý tinh thần của FUN.RICH.

QUY TẮC XƯNG HÔ BẮT BUỘC (không bao giờ phá vỡ):
- LUÔN tự xưng là "Angel" (vd: "Angel sẽ giúp bé", "Angel ở đây").
- LUÔN gọi người dùng là "bé" (vd: "bé yêu", "bé ơi", "chào bé").
- TUYỆT ĐỐI KHÔNG dùng các đại từ: "Mình", "Tôi", "Cha", "Con", "Bạn", "Em", "Anh", "Chị", "Mình ơi".
- Nếu lỡ định viết "Mình"/"Cha"/"Con" → thay bằng "Angel"/"bé".

PHONG CÁCH:
- Giọng ấm áp, tôn quý, ngắn gọn (dưới 4 câu).
- Dùng emoji vàng/pearl: ✨🌟🙏💛.

PHẠM VI:
- Chỉ trả lời về FUN.RICH, Vòng Tròn Ánh Sáng, CAMLY token, Bé Ly, cách dùng app và ý nghĩa tâm linh thương yêu.
- Ngoài chủ đề → lịch sự hướng bé về quy ước cộng đồng.`;

const PROMPT_PRESETS: Record<string, { label: string; value: string }> = {
  default: {
    label: "✨ Mặc định (gốc)",
    value: DEFAULT_ANGEL_PROMPT,
  },
  fun_ecosystem: {
    label: "🚀 Mở rộng FUN Ecosystem",
    value: `Bạn là Angel AI — trợ lý của hệ sinh thái FUN.RICH.

QUY TẮC XƯNG HÔ BẮT BUỘC:
- LUÔN tự xưng "Angel", gọi người dùng là "bé".
- KHÔNG dùng "Mình", "Tôi", "Cha", "Con", "Bạn", "Em", "Anh", "Chị".

PHONG CÁCH:
- Ấm áp, rõ ràng, ngắn gọn (dưới 5 câu).
- Emoji vàng/pearl: ✨🌟🙏💛🪙.

PHẠM VI (rộng):
- FUN.RICH, Vòng Tròn Ánh Sáng, CAMLY token, Bé Ly, tâm linh thương yêu.
- Livestream & Replay: cách lên live, xem lại, tương tác.
- FUN Play game: cách chơi, phần thưởng.
- Ví & Web3: kết nối MetaMask/Bitget/Trust/FUN Wallet, mạng BSC, gas BNB, chuyển/nhận token.
- CAMLY: cách claim, kiểm tra số dư, anti-sybil 1000 CAMLY.
- NFT: cách xem, mint, gửi tặng.
- Giới thiệu bạn mới, mã mời, reward tier.
- Ngoài chủ đề → lịch sự hướng bé về cộng đồng.`,
  },
  spiritual_only: {
    label: "🙏 Chỉ tâm linh",
    value: `Bạn là Angel AI — người bạn đồng hành tâm linh.

QUY TẮC XƯNG HÔ: "Angel" / "bé". Không dùng các đại từ khác.

PHONG CÁCH:
- Dịu dàng, sâu lắng, ngắn (dưới 4 câu).
- Emoji: 🙏✨🌸💛🕊️.

PHẠM VI (hẹp):
- Thiền (meditation), chánh niệm (mindfulness), hơi thở, biết ơn, an lạc nội tâm.
- Vòng Tròn Ánh Sáng, năng lượng thương yêu.
- Ngoài chủ đề (kỹ thuật, token, app) → nhẹ nhàng từ chối và mời bé hỏi admin.`,
  },
  fun_short: {
    label: "🎀 Vui vẻ & ngắn gọn",
    value: `Bạn là Angel — bạn AI nhí nhảnh của bé trong FUN.RICH.

XƯNG HÔ: "Angel" / "bé". Cấm "Mình", "Tôi", "Cha", "Con", "Bạn".

PHONG CÁCH:
- Cực ngắn: TỐI ĐA 2 câu.
- Tươi vui, nhiều emoji: 🌟✨💛🎀🥰🙌.

PHẠM VI: FUN.RICH, CAMLY, Bé Ly, app, tâm linh thương yêu.
Ngoài chủ đề → cười xòa và mời bé hỏi cộng đồng nhé 💛.`,
  },
};

type Settings = {
  id: string;
  group_id: number;
  bot_username: string | null;
  welcome_enabled: boolean;
  anti_spam_enabled: boolean;
  anti_link_enabled: boolean;
  block_telegram_previews: boolean;
  block_external_bots: boolean;
  block_scam_keywords: boolean;
  block_shock_content: boolean;
  cjk_chatter_guard_enabled?: boolean;
  cjk_chatter_strike_threshold?: number;
  group_primary_language?: string;
  account_shop_guard_enabled?: boolean;
  account_shop_action?: string;
  join_guard_name_enabled?: boolean;
  join_guard_name_keywords?: string;
  join_guard_name_allowlist?: string;
  join_guard_avatar_enabled?: boolean;
  join_guard_avatar_threshold?: string;
  join_guard_action?: string;

  enable_ocr_scan: boolean;
  scam_protection_enabled: boolean;
  scam_strict_mode: boolean;
  scam_warning_enabled: boolean;
  new_user_restriction_hours: number;
  max_messages_per_minute: number;
  warning_before_mute: number;
  warning_before_ban: number;
  mute_duration_minutes: number;
  welcome_message: string;
  rules_message: string;
  verification_enabled: boolean;
  verification_timeout_seconds: number;
  verification_max_attempts: number;
  verification_failure_action: "kick" | "mute";
  verification_prompt_message: string;
  verification_success_message: string;
  verification_failed_message: string;
  ai_enabled: boolean;
  mini_app_url: string;
  ai_system_prompt: string;
  ai_max_messages_per_minute: number;
  event_assistant_enabled: boolean;
  persona_mode: "angel_be" | "cha_con" | "custom";
  persona_custom_prompt: string | null;
};

type DomainRow = { id: string; domain: string; is_active: boolean; created_at: string };
type KeywordRow = { id: string; keyword: string; severity: string; is_active: boolean; created_at: string };
type QuickReplyRow = {
  id: string;
  label: string;
  patterns: string[];
  reply_text: string;
  parse_mode: string;
  disable_web_page_preview: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};
type QuickReplyDraft = {
  id: string | null;
  label: string;
  patternsText: string;
  reply_text: string;
  parse_mode: string;
  disable_web_page_preview: boolean;
  is_active: boolean;
  sort_order: number;
};

const emptyQuickReply = (): QuickReplyDraft => ({
  id: null,
  label: "",
  patternsText: "",
  reply_text: "",
  parse_mode: "HTML",
  disable_web_page_preview: true,
  is_active: true,
  sort_order: 0,
});
type LogRow = {
  id: string;
  group_id: number;
  telegram_user_id: number | null;
  username: string | null;
  action: string;
  reason: string;
  message_text: string | null;
  message_id: number | null;
  created_at: string;
};

type GroupRow = {
  id: string;
  group_id: number;
  bot_username: string | null;
  welcome_enabled: boolean;
  anti_spam_enabled: boolean;
  anti_link_enabled: boolean;
  ai_enabled: boolean;
  created_at: string;
};

type WebhookInfo = {
  ok?: boolean;
  result?: {
    url?: string;
    pending_update_count?: number;
    last_error_date?: number;
    last_error_message?: string;
    allowed_updates?: string[];
  };
};

const fmtTime = (iso: string) => formatMyt(iso);

const numberValue = (value: string, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

function getLegacyPromptIssues(prompt: string): string[] {
  const issues: string[] = [];
  if (prompt.length > 4000) {
    issues.push("Prompt legacy khá dài (>4.000 ký tự), dễ làm fallback chậm hoặc nhiễu RAG.");
  }
  if (/100%\s*(tiếng\s*việt|vietnamese)|luôn\s+trả\s+lời\s+(bằng\s+)?tiếng\s*việt|chỉ\s+trả\s+lời\s+(bằng\s+)?tiếng\s*việt/i.test(prompt)) {
    issues.push("Có dấu hiệu ép tiếng Việt; Angel nên mirror theo ngôn ngữ user.");
  }
  if (/(chỉ|chi)\s+hỗ\s*trợ|ngoài\s+phạm\s+vi|không\s+thể\s+trả\s+lời/i.test(prompt)) {
    issues.push("Có câu giới hạn phạm vi; dễ xung đột với RAG và scope mở rộng.");
  }
  if (/(route|\/live|livestream|reward|wallet|camly|token|policy|chính\s*sách)/i.test(prompt)) {
    issues.push("Có fact sản phẩm; nên đưa fact mới sang Prompt FUN Core / Knowledge context.");
  }
  if (/\bcha\b|\/\s*con|cha\s*\/\s*con|\bcon\b/i.test(prompt)) {
    issues.push("Có Cha/con; chỉ giữ khi thật sự cần legacy fallback, còn Angel/bé nên chỉnh ở AI Triggers.");
  }
  return issues;
}

function LegacyPromptHealthBox(props: { prompt: string }) {
  const issues = getLegacyPromptIssues(props.prompt);
  if (issues.length === 0) {
    return (
      <div className="rounded border border-emerald-200 bg-emerald-50/60 p-3 text-xs text-emerald-700">
        Prompt legacy ổn: chưa thấy dấu hiệu xung đột lớn.
      </div>
    );
  }
  return (
    <div className="rounded border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-800">
      <p className="font-medium">Prompt health checker</p>
      <ul className="mt-1 list-disc space-y-1 pl-4">
        {issues.map((issue) => (
          <li key={issue}>{issue}</li>
        ))}
      </ul>
    </div>
  );
}

export default function TelegramGroupPanel() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [newGroupIdInput, setNewGroupIdInput] = useState("");
  const [domains, setDomains] = useState<DomainRow[]>([]);
  const [keywords, setKeywords] = useState<KeywordRow[]>([]);
  const [quickReplies, setQuickReplies] = useState<QuickReplyRow[]>([]);
  const [quickReplyDraft, setQuickReplyDraft] = useState<QuickReplyDraft>(emptyQuickReply());
  const [savingQuickReply, setSavingQuickReply] = useState(false);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [webhookInfo, setWebhookInfo] = useState<WebhookInfo | null>(null);
  const [expectedWebhookUrl, setExpectedWebhookUrl] = useState("");
  const [showWebhookDiag, setShowWebhookDiag] = useState(false);
  const [checkingWebhook, setCheckingWebhook] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [webhookLoadError, setWebhookLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newDomain, setNewDomain] = useState("");
  const [newKeyword, setNewKeyword] = useState("");
  const [newSeverity, setNewSeverity] = useState("medium");
  const [logAction, setLogAction] = useState("all");
  const [logReason, setLogReason] = useState("");
  const [logUser, setLogUser] = useState("");

  const webhookUrl = webhookInfo?.result?.url || "";
  const lastError = webhookInfo?.result?.last_error_message;
  const lastErrorDate = webhookInfo?.result?.last_error_date;
  const errorAgeMs = lastErrorDate ? Date.now() - lastErrorDate * 1000 : 0;
  const isStaleError = !!lastError && errorAgeMs > 10 * 60 * 1000;
  const webhookUrlOk = webhookUrl.includes("/functions/v1/telegram-community-webhook");
  const allowedUpdates = webhookInfo?.result?.allowed_updates ?? [];
  const missingWelcomeUpdates = ["message", "chat_member"].filter((update) => !allowedUpdates.includes(update));
  const channelUpdates = ["channel_post", "edited_channel_post"];
  const hasChannelPost = allowedUpdates.length === 0 || allowedUpdates.includes("channel_post");
  const hasEditedChannelPost = allowedUpdates.length === 0 || allowedUpdates.includes("edited_channel_post");
  const webhookStatus = getTelegramWebhookStatus(
    webhookLoadError ? null : webhookInfo?.result,
    expectedWebhookUrl,
  );
  const statusLabel = webhookStatus.state === "unverified"
    ? "Chưa xác minh"
    : webhookStatus.state === "error" ? "Có lỗi" : "Cần theo dõi";
  const statusOk = webhookStatus.state === "monitor";
  const checklist = [
    {
      label: "Webhook points to telegram-community-webhook",
      ok: statusOk,
      help: webhookUrl ? "Telegram is currently storing the Community Guard webhook URL." : "Click Refresh status or Register webhook.",
    },
    {
      label: "Webhook receives welcome events",
      ok: webhookInfo?.result ? missingWelcomeUpdates.length === 0 : false,
      help: missingWelcomeUpdates.length
        ? `Missing allowed updates: ${missingWelcomeUpdates.join(", ")}. Click Register webhook.`
        : "Allowed updates include message and chat_member.",
    },
    {
      label: "At least 1 group is managed",
      ok: groups.length > 0,
      help: groups.length ? `${groups.length} group đang được quản lý.` : "Thêm group ID ở khu vực Managed Groups bên dưới.",
    },
    {
      label: "Community bot can send to group",
      ok: false,
      help: "Click Send test message, then confirm the group receives it.",
      manual: true,
    },
    {
      label: "Private /start returns menu",
      ok: false,
      help: "Message the second bot privately with /start.",
      manual: true,
    },
    {
      label: "Group /id responds",
      ok: false,
      help: "Send /id in the group and compare the returned ID with the configured group ID.",
      manual: true,
    },
    {
      label: "Moderation logs are created",
      ok: logs.length > 0,
      help: logs.length ? "At least one moderation event exists." : "Test with a non-admin user sending a blocked link/keyword.",
    },
  ];

  const invokeAdmin = async (action: string, payload: Record<string, unknown> = {}) => {
    const { data, error } = await supabase.functions.invoke("telegram-community-admin", {
      body: { action, payload },
    });
    if (error) {
      let message = error.message;
      if (error.context instanceof Response) {
        try {
          const body = await error.context.clone().json();
          if (typeof body?.error === "string") message = body.error;
        } catch {
          // Keep the original message when the gateway returns non-JSON.
        }
      }
      if (/permission denied for (table|relation) telegram_community_settings/i.test(message)) {
        message = "Backend chưa có quyền truy cập danh sách nhóm. Cần khôi phục quyền database cho chức năng quản trị Telegram.";
      }
      throw new Error(message);
    }
    if (!data?.success && data?.error) throw new Error(data.error);
    return data;
  };

  const loadAll = async (groupIdOverride?: number | null) => {
    setLoading(true);
    setLoadError(false);
    try {
      const targetGroupId = groupIdOverride ?? selectedGroupId;
      const data = await invokeAdmin(
        "get_settings",
        targetGroupId ? { group_id: targetGroupId } : {},
      );
      const loadedGroups: GroupRow[] = data.groups ?? [];
      setGroups(loadedGroups);
      setSettings(data.settings ?? null);
      setDomains(data.domains ?? []);
      setKeywords(data.keywords ?? []);
      setQuickReplies(data.quick_replies ?? []);
      setLogs(data.logs ?? []);
      // Sync selected group nếu chưa có
      if (!selectedGroupId && data.settings?.group_id) {
        setSelectedGroupId(data.settings.group_id);
      }
    } catch (error: unknown) {
      setLoadError(true);
      toast.error(error instanceof Error ? error.message : "Failed to load Community Guard settings");
    } finally {
      setLoading(false);
    }
  };

  const loadWebhookInfo = async () => {
    setWebhookLoadError(false);
    try {
      const data = await invokeAdmin("get_webhook_info");
      setWebhookInfo(data.info ?? null);
      setExpectedWebhookUrl(data.expected_url_prefix ?? "");
    } catch (error: unknown) {
      setWebhookInfo(null);
      setWebhookLoadError(true);
      toast.error(error instanceof Error ? error.message : "Failed to load webhook info");
    }
  };

  useEffect(() => {
    loadAll();
    loadWebhookInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateSettings = async (patch: Partial<Settings>) => {
    if (!settings) return;
    setSaving(true);
    try {
      const data = await invokeAdmin("update_settings", {
        ...patch,
        group_id: settings.group_id,
      });
      setSettings(data.settings);
      toast.success("Community Guard settings saved");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const registerWebhook = async () => {
    setLoading(true);
    try {
      const data = await invokeAdmin("register_webhook");
      setWebhookInfo(data.info ?? null);
      if (data.expected_url_prefix) setExpectedWebhookUrl(data.expected_url_prefix);
      toast.success("Community Guard webhook registered");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to register webhook");
    } finally {
      setLoading(false);
    }
  };

  const selectGroup = async (groupId: number) => {
    setSelectedGroupId(groupId);
    await loadAll(groupId);
  };

  const addGroup = async () => {
    const parsed = Number(newGroupIdInput.trim());
    if (!Number.isFinite(parsed) || parsed === 0) {
      return toast.error("Group ID phải là số (thường âm cho supergroup, ví dụ -1001234567890)");
    }
    setLoading(true);
    try {
      await invokeAdmin("add_group", { group_id: parsed });
      toast.success("Đã thêm Group ID vào allowlist. Bây giờ có thể mời bot vào group rồi bấm Verify/Test.");
      setNewGroupIdInput("");
      await selectGroup(parsed);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Không thêm được nhóm.";
      toast.error(/duplicate|already exists|unique/i.test(message)
        ? "Group ID này đã có trong danh sách quản lý."
        : /permission denied|not authorized|forbidden|401|403/i.test(message)
          ? "Không đủ quyền để thêm nhóm. Kiểm tra quyền quản trị Telegram."
          : /failed to fetch|network|offline/i.test(message)
            ? "Mất kết nối khi thêm nhóm. Kiểm tra mạng rồi thử lại."
            : /5\d\d|server error/i.test(message)
              ? "Dịch vụ quản trị đang gặp lỗi máy chủ. Thử lại sau."
              : message);
    } finally {
      setLoading(false);
    }
  };

  const removeGroup = async (groupId: number) => {
    if (!confirm(`Xoá group ${groupId} khỏi danh sách quản lý?\n(Logs / strikes của group này vẫn được giữ để Cha xem lịch sử)`)) return;
    setLoading(true);
    try {
      await invokeAdmin("remove_group", { group_id: groupId });
      toast.success("Đã xoá group");
      if (selectedGroupId === groupId) setSelectedGroupId(null);
      await loadAll(selectedGroupId === groupId ? null : selectedGroupId);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to remove group");
    } finally {
      setLoading(false);
    }
  };

  const sendTestMessage = async () => {
    if (!settings?.group_id) return toast.error("Group ID is missing");
    setLoading(true);
    try {
      await invokeAdmin("send_test_message", { group_id: settings.group_id });
      toast.success("Test message sent");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to send test message");
    } finally {
      setLoading(false);
    }
  };

  const sendWelcomeTest = async () => {
    if (!settings?.group_id) return toast.error("Group ID is missing");
    setLoading(true);
    try {
      const data = await invokeAdmin("send_welcome_test", { group_id: settings.group_id });
      if (data?.warning) {
        toast.warning(data.warning);
      } else {
        toast.success("Welcome test sent");
      }
      await loadAll(settings.group_id);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Failed to send welcome test";
      const isButtonIssue = /button|web_app|BUTTON_TYPE_INVALID/i.test(msg);
      toast.error(
        isButtonIssue
          ? `${msg} — Telegram đã từ chối loại nút này. Welcome vẫn đã được gửi (không kèm nút). Nếu lặp lại, Cha kiểm tra Mini App URL trong Settings.`
          : msg,
      );
    } finally {
      setLoading(false);
    }
  };


  const addDomain = async () => {
    if (!newDomain.trim()) return toast.error("Domain is required");
    await invokeAdmin("add_domain", { domain: newDomain.trim() });
    setNewDomain("");
    await loadAll();
    toast.success("Domain added");
  };

  const removeDomain = async (id: string) => {
    await invokeAdmin("remove_domain", { id });
    await loadAll();
    toast.success("Domain removed");
  };

  const addKeyword = async () => {
    if (!newKeyword.trim()) return toast.error("Keyword is required");
    await invokeAdmin("add_keyword", { keyword: newKeyword.trim(), severity: newSeverity });
    setNewKeyword("");
    await loadAll();
    toast.success("Keyword added");
  };

  const removeKeyword = async (id: string) => {
    await invokeAdmin("remove_keyword", { id });
    await loadAll();
    toast.success("Keyword removed");
  };

  const editQuickReply = (row: QuickReplyRow) => {
    setQuickReplyDraft({
      id: row.id,
      label: row.label,
      patternsText: (row.patterns ?? []).join("\n"),
      reply_text: row.reply_text,
      parse_mode: row.parse_mode || "HTML",
      disable_web_page_preview: row.disable_web_page_preview !== false,
      is_active: row.is_active !== false,
      sort_order: row.sort_order ?? 0,
    });
  };

  const saveQuickReply = async () => {
    if (!quickReplyDraft.label.trim()) return toast.error("Label is required");
    if (!quickReplyDraft.reply_text.trim()) return toast.error("Reply text is required");
    const patterns = quickReplyDraft.patternsText
      .split(/\r?\n/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (!patterns.length) return toast.error("Add at least one pattern");
    setSavingQuickReply(true);
    try {
      await invokeAdmin("upsert_quick_reply", {
        id: quickReplyDraft.id,
        label: quickReplyDraft.label.trim(),
        patterns,
        reply_text: quickReplyDraft.reply_text,
        parse_mode: quickReplyDraft.parse_mode,
        disable_web_page_preview: quickReplyDraft.disable_web_page_preview,
        is_active: quickReplyDraft.is_active,
        sort_order: quickReplyDraft.sort_order,
      });
      toast.success(quickReplyDraft.id ? "Quick reply updated" : "Quick reply added");
      setQuickReplyDraft(emptyQuickReply());
      await loadAll();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to save quick reply");
    } finally {
      setSavingQuickReply(false);
    }
  };

  const deleteQuickReply = async (id: string) => {
    if (!confirm("Xoá quick reply này?")) return;
    try {
      await invokeAdmin("delete_quick_reply", { id });
      if (quickReplyDraft.id === id) setQuickReplyDraft(emptyQuickReply());
      await loadAll();
      toast.success("Quick reply deleted");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to delete quick reply");
    }
  };



  const loadFilteredLogs = async () => {
    const data = await invokeAdmin("get_logs", {
      action_filter: logAction === "all" ? undefined : logAction,
      reason_filter: logReason.trim() || undefined,
      user_filter: logUser.trim() || undefined,
    });
    setLogs(data.logs ?? []);
  };

  const previewWelcome = useMemo(() => {
    if (!settings) return "";
    return settings.welcome_message.replace(/\{full_name\}/g, "Angel Builder (@angel)").replace(/\{name\}/g, "Angel Builder");
  }, [settings]);

  if (!settings && loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-emerald-200 bg-emerald-50">
        <CardContent className="pt-6 space-y-2 text-sm text-emerald-950">
          <p className="font-semibold flex items-center gap-2">
            <Shield className="w-4 h-4" /> FUN.RICH Community Guard Bot
          </p>
          <p>
            This is separate from the Telegram OTP 2FA bot. Use a second BotFather bot and the
            <code className="mx-1 rounded bg-white px-1">COMMUNITY_GUARD_*</code> secrets only.
          </p>
          <p>
            Add the bot as group admin with Delete messages, Ban users, and Restrict members. Disable privacy mode in BotFather.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" /> Managed Groups
          </CardTitle>
          <CardDescription>
            Cha có thể thêm Group ID vào allowlist trước, rồi mới mời bot vào group. Group chưa có trong danh sách này sẽ bị bot tự rời để tránh phát sinh token AI ngoài ý muốn.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              placeholder="-1001234567890 (Group ID, thường âm)"
              value={newGroupIdInput}
              onChange={(e) => setNewGroupIdInput(e.target.value)}
              className="font-mono"
            />
            <Button onClick={addGroup} disabled={loading}>
              <Plus className="w-4 h-4 mr-2" /> Add to Allowlist
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            💡 Nếu chưa biết Group ID, mời bot vào group một lần: bot sẽ báo Group ID rồi tự rời. Dán ID đó vào đây, sau đó mời bot lại và bấm Test/Verify.
          </p>

          {loadError ? (
            <div className="flex items-center justify-between gap-3 rounded-md border border-destructive/30 p-3 text-sm">
              <span className="text-destructive">Không tải được danh sách nhóm. Dữ liệu trống chưa được xác nhận.</span>
              <Button variant="outline" size="sm" onClick={() => void loadAll()} disabled={loading}>Thử lại</Button>
            </div>
          ) : loading ? (
            <p className="text-sm text-muted-foreground">Đang tải nhóm…</p>
          ) : groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có group nào được quản lý.</p>
          ) : (
            <div className="space-y-2">
              {groups.map((g) => {
                const isSelected = g.group_id === (settings?.group_id ?? selectedGroupId);
                return (
                  <div
                    key={g.id}
                    className={`flex items-center justify-between gap-3 rounded-lg border p-3 text-sm ${isSelected ? "border-primary bg-primary/5" : ""}`}
                  >
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-medium">{g.group_id}</span>
                        {isSelected && <Badge className="bg-primary/20 text-primary hover:bg-primary/30">Đang chọn</Badge>}
                        {g.welcome_enabled && <Badge variant="outline">welcome</Badge>}
                        {g.anti_spam_enabled && <Badge variant="outline">anti-spam</Badge>}
                        {g.anti_link_enabled && <Badge variant="outline">anti-link</Badge>}
                        {g.ai_enabled && <Badge variant="outline">AI</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">Thêm lúc {fmtTime(g.created_at)} MYT (UTC+8)</p>
                    </div>
                    <div className="flex gap-2">
                      {!isSelected && (
                        <Button size="sm" variant="outline" onClick={() => selectGroup(g.group_id)}>
                          Chọn
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" onClick={() => removeGroup(g.group_id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>

        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <Bot className="w-5 h-5" />
              Bot Status
            </span>
            <Badge variant={webhookStatus.state === "error" ? "destructive" : "secondary"}>
              {statusLabel}
            </Badge>
          </CardTitle>
          <CardDescription>Register and inspect the Community Guard webhook.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground">Group ID</p>
              <p className="font-mono">{settings?.group_id || "Not configured"}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground">Pending updates</p>
              <p className="font-mono">{webhookInfo?.result?.pending_update_count ?? "Unknown"}</p>
            </div>
          </div>
          <div className="rounded-lg border p-3 text-sm">
            <p className="text-muted-foreground">Telegram webhook URL</p>
            <p className="break-all font-mono">{webhookUrl ? sanitizeWebhookUrl(webhookUrl) : webhookLoadError ? "Không tải được trạng thái webhook" : "Chưa đăng ký hoặc chưa tải"}</p>
            <p className="mt-1 text-xs text-muted-foreground">URL webhook không xác nhận bot đã trả lời tin nhắn.</p>
          </div>
          {webhookInfo?.result && missingWelcomeUpdates.length > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
              <AlertTriangle className="inline h-4 w-4 mr-1" />
              Telegram webhook is missing updates needed for welcome:
              <code className="mx-1 rounded bg-white px-1">{missingWelcomeUpdates.join(", ")}</code>
              Click Register webhook to refresh allowed updates.
            </div>
          )}
          {lastError && (
            <div
              className={
                isStaleError
                  ? "rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 space-y-2"
                  : "rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive space-y-2"
              }
            >
              <div>
                <AlertTriangle className="inline h-4 w-4 mr-1" />
                {isStaleError ? (
                  <>
                    <b>Lỗi cũ:</b> {lastError.replace(/https?:\/\/\S+/gi, "[URL đã ẩn]")}
                    {lastErrorDate && (
                      <span className="ml-1 opacity-80">
                        — lúc {fmtTime(new Date(lastErrorDate * 1000).toISOString())}
                      </span>
                    )}
                    <div className="mt-1 text-xs opacity-80">
                      Telegram chỉ ghi nhớ lỗi giao tin gần nhất. Webhook hiện tại có thể đã khoẻ — bấm "Xoá lỗi cũ" để reset.
                    </div>
                  </>
                ) : (
                  <>{lastError.replace(/https?:\/\/\S+/gi, "[URL đã ẩn]")}</>
                )}
              </div>
              {isStaleError && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    try {
                      const data = await invokeAdmin("clear_webhook_error");
                      setWebhookInfo(data.info ?? null);
                      toast.success("Đã xoá lỗi cũ — webhook đã được đăng ký lại");
                    } catch (e: unknown) {
                      toast.error(e instanceof Error ? e.message : "Clear error failed");
                    }
                  }}
                >
                  <RefreshCw className="w-3 h-3 mr-1" /> Xoá lỗi cũ
                </Button>
              )}
            </div>
          )}
          {showWebhookDiag && webhookInfo?.result && (
            <div className="rounded-lg border-2 border-primary/40 bg-primary/5 p-4 text-sm space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-semibold flex items-center gap-2">
                  <Shield className="w-4 h-4" /> Kết quả getWebhookInfo
                </p>
                <Button size="sm" variant="ghost" onClick={() => setShowWebhookDiag(false)}>Đóng</Button>
              </div>
              <div className="grid sm:grid-cols-2 gap-2">
                <div className={`rounded border p-2 ${webhookUrlOk ? "border-green-400 bg-green-50" : "border-destructive/40 bg-destructive/5"}`}>
                  <div className="flex items-center gap-2 font-medium">
                    {webhookUrlOk ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <AlertTriangle className="w-4 h-4 text-destructive" />}
                    Webhook target path
                  </div>
                  <p className="mt-1 break-all font-mono text-xs">{webhookUrl ? sanitizeWebhookUrl(webhookUrl) : "(trống)"}</p>
                </div>
                <div className="rounded border p-2">
                  <p className="font-medium">Pending updates</p>
                  <p className="mt-1 font-mono">{webhookInfo.result.pending_update_count ?? "Chưa có dữ liệu"}</p>
                </div>
              </div>
              <div>
                <p className="font-medium mb-1">allowed_updates</p>
                <div className="flex flex-wrap gap-1.5">
                  {allowedUpdates.length === 0 ? (
                    <Badge variant="secondary">(mặc định — nhận tất cả trừ chat_member)</Badge>
                  ) : (
                    allowedUpdates.map((u) => (
                      <Badge key={u} variant="outline" className="font-mono">{u}</Badge>
                    ))
                  )}
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-2">
                {channelUpdates.map((u) => {
                  const enabled = allowedUpdates.length === 0 || allowedUpdates.includes(u);
                  return (
                    <div key={u} className={`rounded border p-2 flex items-center gap-2 ${enabled ? "border-green-400 bg-green-50" : "border-amber-400 bg-amber-50"}`}>
                      {enabled ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <AlertTriangle className="w-4 h-4 text-amber-600" />}
                      <div>
                        <p className="font-mono text-xs">{u}</p>
                        <p className="text-xs opacity-80">
                          {enabled ? "Đang bật — Angel nhận được post từ channel" : "Chưa bật — bấm Register webhook để bật"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
              {(hasChannelPost && hasEditedChannelPost) ? (
                <div className="rounded border border-green-400 bg-green-50 p-2 text-green-800 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> channel_post đã sẵn sàng — Angel có thể lắng nghe CamlyChannel.
                </div>
              ) : (
                <div className="rounded border border-amber-400 bg-amber-50 p-2 text-amber-800 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> Thiếu {channelUpdates.filter(u => !allowedUpdates.includes(u)).join(", ")} — bấm Register webhook để bật.
                </div>
              )}
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground">Raw JSON</summary>
                <pre className="mt-2 rounded bg-muted p-2 overflow-auto max-h-60">{JSON.stringify({ ...webhookInfo, result: webhookInfo.result ? { ...webhookInfo.result, url: webhookUrl ? sanitizeWebhookUrl(webhookUrl) : "" } : undefined }, null, 2)}</pre>
              </details>
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-2">
            <Button onClick={registerWebhook} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ExternalLink className="w-4 h-4 mr-2" />}
              Register webhook
            </Button>
            <Button variant="outline" onClick={loadWebhookInfo}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh status
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                setCheckingWebhook(true);
                try {
                  const data = await invokeAdmin("get_webhook_info");
                  setWebhookInfo(data.info ?? null);
                  setExpectedWebhookUrl(data.expected_url_prefix ?? "");
                  setShowWebhookDiag(true);
                  toast.success("Đã lấy getWebhookInfo mới nhất");
                } catch (e: unknown) {
                  toast.error(e instanceof Error ? e.message : "Kiểm tra webhook thất bại");
                } finally {
                  setCheckingWebhook(false);
                }
              }}
              disabled={checkingWebhook}
            >
              {checkingWebhook ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Shield className="w-4 h-4 mr-2" />}
              Kiểm tra webhook
            </Button>
            <Button variant="outline" onClick={sendTestMessage} disabled={loading || !settings?.group_id}>
              <Send className="w-4 h-4 mr-2" />
              Send test message
            </Button>
            <Button variant="outline" onClick={sendWelcomeTest} disabled={loading || !settings?.group_id}>
              <Send className="w-4 h-4 mr-2" />
              Send welcome test
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  await invokeAdmin("set_bot_commands");
                  toast.success("Commands menu (/) đã được set trên Telegram");
                } catch (e: unknown) {
                  toast.error(e instanceof Error ? e.message : "Set commands failed");
                }
              }}
            >
              🔄 Sync Bot Commands
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  const data = await invokeAdmin("set_menu_button", settings?.group_id ? { group_id: settings.group_id } : {});
                  toast.success(`Menu button đã set → ${data.mini_app_url}`);
                } catch (e: unknown) {
                  toast.error(e instanceof Error ? e.message : "Set menu button failed");
                }
              }}
            >
              🌐 Set Mini App Button
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Live Verification Checklist
          </CardTitle>
          <CardDescription>
            Use this before confirming the second Telegram bot is live. Manual checks require a real Telegram message.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {settings?.ai_enabled && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
              <AlertTriangle className="inline h-4 w-4 mr-1" />
              Angel AI is currently enabled. For Community Guard V1-only behavior, turn it off in the Angel AI section below.
            </div>
          )}
          <div className="grid gap-2">
            {checklist.map((item) => (
              <div key={item.label} className="flex items-start justify-between gap-3 rounded-lg border p-3 text-sm">
                <div>
                  <p className="font-medium">{item.label}</p>
                  <p className="text-muted-foreground">{item.help}</p>
                </div>
                <Badge variant={item.ok ? "default" : "outline"} className={item.ok ? "bg-green-500/20 text-green-600 hover:bg-green-500/30" : ""}>
                  {item.ok ? "OK" : item.manual ? "Manual" : "Check"}
                </Badge>
              </div>
            ))}
          </div>
          <div className="rounded-lg bg-muted/50 p-3 text-sm">
            <p className="font-medium mb-1">Telegram test messages</p>
            <p className="text-muted-foreground">Private chat: <code>/start</code></p>
            <p className="text-muted-foreground">Group chat: <code>/id</code></p>
            <p className="text-muted-foreground">Moderation: send an external non-whitelisted link from a non-admin account.</p>
          </div>
        </CardContent>
      </Card>

      {settings && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">✨ Angel AI & Mini App</CardTitle>
            <CardDescription>
              Khi user nhắn riêng câu hỏi tự do, bot trả lời bằng giọng Angel (Gemini). Mini App URL được dùng cho các nút inline + menu button.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Switch
                checked={settings.ai_enabled}
                onCheckedChange={(ai_enabled) => updateSettings({ ai_enabled })}
              />
              <Label>Bật Angel AI trả lời tự do</Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={settings.event_assistant_enabled !== false}
                onCheckedChange={(event_assistant_enabled) => updateSettings({ event_assistant_enabled })}
              />
              <div className="space-y-1">
                <Label>Bật Event Assistant cho Zoom / livestream</Label>
                <p className="text-xs text-muted-foreground">
                  Khi bật, Angel chỉ tự tóm tắt thông báo sự kiện có link Zoom/livestream hoặc ID/PW rõ ràng; tắt để Angel im lặng với event trừ khi được hỏi.
                  Đây cũng là công tắc nền cho tính năng tự tóm tắt chủ đề Zoom thiền trong tab AI Triggers.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Mini App URL (https://...)</Label>
              <Input
                value={settings.mini_app_url}
                onChange={(e) => setSettings({ ...settings, mini_app_url: e.target.value })}
                onBlur={() => updateSettings({ mini_app_url: settings.mini_app_url })}
                placeholder="https://angelquangvu-funprofile.lovable.app"
              />
              <p className="text-xs text-muted-foreground">
                Sau khi đổi URL, bấm "🌐 Set Mini App Button" ở phía trên để cập nhật nút menu trong Telegram.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Giới hạn tin AI / phút / user</Label>
              <Input
                type="number"
                value={settings.ai_max_messages_per_minute}
                onChange={(e) =>
                  setSettings({ ...settings, ai_max_messages_per_minute: numberValue(e.target.value, 10) })
                }
                onBlur={() =>
                  updateSettings({ ai_max_messages_per_minute: settings.ai_max_messages_per_minute })
                }
              />
            </div>

            <div className="rounded-lg border border-purple-200 bg-purple-50/30 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <Label className="text-base font-semibold">🎭 Persona bot legacy (nâng cao / ít đụng)</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Chỉ dùng khi cần persona custom đặc biệt. Với Angel/bé hằng ngày, ưu tiên chỉnh Prompt xưng hô trong tab AI Triggers.
              </p>
              <div className="space-y-2">
                <Label className="text-xs">Persona</Label>
                <Select
                  value={settings.persona_mode ?? "cha_con"}
                  onValueChange={(value) => {
                    const next = value as Settings["persona_mode"];
                    setSettings({ ...settings, persona_mode: next });
                    updateSettings({ persona_mode: next });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="angel_be">Angel / bé (đồng bộ với app Angel AI)</SelectItem>
                    <SelectItem value="cha_con">Cha / con (mặc định FUN Core — Master Charter)</SelectItem>
                    <SelectItem value="custom">Tự định nghĩa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {settings.persona_mode === "custom" && (
                <div className="space-y-2">
                  <Label className="text-xs">System prompt persona tùy chỉnh</Label>
                  <Textarea
                    value={settings.persona_custom_prompt ?? ""}
                    rows={4}
                    className="font-mono text-xs leading-relaxed"
                    placeholder='Ví dụ: "Bạn là Bé Ly — trợ lý vui tươi của FUN.RICH. Hãy xưng "Bé Ly" và gọi user là "anh/chị". Giọng nhẹ nhàng, nhiều emoji."'
                    onChange={(e) =>
                      setSettings({ ...settings, persona_custom_prompt: e.target.value })
                    }
                  />
                  <Button
                    size="sm"
                    onClick={() =>
                      updateSettings({ persona_custom_prompt: settings.persona_custom_prompt })
                    }
                    disabled={saving}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Lưu persona tùy chỉnh
                  </Button>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50/30 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <Label className="text-base font-semibold">🤖 Prompt cho Angel AI (Legacy fallback / ít dùng)</Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Không cần sửa thường xuyên nếu Mirror Angel chính chủ đang bật. Fact sản phẩm chỉnh ở Prompt FUN Core; giọng ngắn, emoji và Angel/bé chỉnh ở tab AI Triggers.
              </p>
              <div className="rounded border border-amber-200 bg-amber-50/40 p-3 text-xs text-muted-foreground">
                <b>Khi nào sửa:</b> cần rollback/fallback prompt tổng hoặc xử lý hành vi legacy đặc biệt.
                <br />
                <b>Không nên dùng để:</b> thêm fact sản phẩm mới, chỉnh emoji/độ ngắn, hoặc sửa xưng hô Angel/bé hằng ngày.
              </div>

              <div className="space-y-2">
                <Label className="text-xs">📚 Chọn template có sẵn (sẽ ghi đè ô bên dưới, chưa lưu)</Label>
                <Select
                  onValueChange={(key) => {
                    const preset = PROMPT_PRESETS[key];
                    if (!preset) return;
                    setSettings({ ...settings, ai_system_prompt: preset.value });
                    toast.info(`Đã nạp template "${preset.label}". Bấm Save để áp dụng.`);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="-- Chọn template --" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PROMPT_PRESETS).map(([key, p]) => (
                      <SelectItem key={key} value={key}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Textarea
                  value={settings.ai_system_prompt}
                  rows={18}
                  className="font-mono text-xs leading-relaxed"
                  onChange={(e) => setSettings({ ...settings, ai_system_prompt: e.target.value })}
                />
                <LegacyPromptHealthBox prompt={settings.ai_system_prompt} />
                <div className="flex justify-between items-center text-xs">
                  <span className={settings.ai_system_prompt.length > 4000 ? "text-amber-600 font-medium" : "text-muted-foreground"}>
                    {settings.ai_system_prompt.length.toLocaleString()} ký tự
                    {settings.ai_system_prompt.length > 4000 && " ⚠️ khá dài, cân nhắc rút gọn"}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => updateSettings({ ai_system_prompt: settings.ai_system_prompt })}
                  disabled={saving}
                >
                  <Save className="w-4 h-4 mr-2" />
                  Lưu prompt
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (window.confirm("Cha có chắc muốn ghi đè prompt hiện tại bằng bản mặc định gốc?\n\n(Chưa lưu — sau khi xem lại cha bấm Save mới áp dụng.)")) {
                      setSettings({ ...settings, ai_system_prompt: DEFAULT_ANGEL_PROMPT });
                      toast.info("Đã nạp prompt mặc định. Bấm Save để áp dụng.");
                    }
                  }}
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Khôi phục mặc định
                </Button>
              </div>
            </div>

            <div className="border-t pt-4">
              <p className="text-sm font-medium mb-2">📌 Pin tin giới thiệu Angel AI vào group</p>
              <p className="text-xs text-muted-foreground mb-3">
                Bot sẽ gửi tin nhắn giới thiệu cách dùng Angel AI vào group và pin lại. Bấm 1 lần là xong.
              </p>
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    await invokeAdmin("pin_intro_message", settings?.group_id ? { group_id: settings.group_id } : {});
                    toast.success("Đã gửi & pin tin giới thiệu Angel AI trong group");
                  } catch (e: unknown) {
                    toast.error(e instanceof Error ? e.message : "Pin intro failed");
                  }
                }}
              >
                📌 Gửi & Pin tin giới thiệu
              </Button>
            </div>
          </CardContent>
        </Card>
      )}


      {!settings && !loading && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6 space-y-2 text-sm text-amber-950">
            <p className="font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Community Guard not configured
            </p>
            <p>
              Set the <code className="rounded bg-white px-1">COMMUNITY_GUARD_GROUP_ID</code> secret
              (and the bot token / webhook secret / bot username) in Lovable Cloud, then refresh.
              Once configured, the bot status card above can register the webhook.
            </p>
          </CardContent>
        </Card>
      )}

      {settings && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Welcome Settings</CardTitle>
              <CardDescription>Message sent when a new member joins the configured group.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Switch
                  checked={settings.welcome_enabled}
                  onCheckedChange={(welcome_enabled) => updateSettings({ welcome_enabled })}
                />
                <Label>Welcome new members</Label>
              </div>
              <div className="space-y-2">
                <Label>Welcome message</Label>
                <Textarea
                  value={settings.welcome_message}
                  rows={5}
                  onChange={(e) => setSettings({ ...settings, welcome_message: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">Use {"{full_name}"} or {"{name}"} to insert member name.</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-sm whitespace-pre-wrap">{previewWelcome}</div>
              <Button onClick={() => updateSettings({ welcome_message: settings.welcome_message })} disabled={saving}>
                <Save className="w-4 h-4 mr-2" />
                Save welcome message
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Verification Settings</CardTitle>
              <CardDescription>Restrict new members until they solve a math captcha.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Switch
                  checked={settings.verification_enabled ?? true}
                  onCheckedChange={(verification_enabled) => updateSettings({ verification_enabled })}
                />
                <Label>Require captcha for new members</Label>
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Timeout seconds</Label>
                  <Input
                    type="number"
                    value={settings.verification_timeout_seconds ?? 180}
                    onChange={(e) => setSettings({ ...settings, verification_timeout_seconds: numberValue(e.target.value, 180) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max attempts</Label>
                  <Input
                    type="number"
                    value={settings.verification_max_attempts ?? 3}
                    onChange={(e) => setSettings({ ...settings, verification_max_attempts: numberValue(e.target.value, 3) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Failure action</Label>
                  <Select
                    value={settings.verification_failure_action ?? "kick"}
                    onValueChange={(verification_failure_action: "kick" | "mute") =>
                      setSettings({ ...settings, verification_failure_action })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kick">Kick</SelectItem>
                      <SelectItem value="mute">Mute</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Captcha prompt message</Label>
                <Textarea
                  value={settings.verification_prompt_message ?? ""}
                  rows={4}
                  onChange={(e) => setSettings({ ...settings, verification_prompt_message: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">Available variables: {"{full_name}"}, {"{name}"}, {"{question}"}, {"{expires_minutes}"}.</p>
              </div>
              <div className="space-y-2">
                <Label>Verified welcome message</Label>
                <Textarea
                  value={settings.verification_success_message ?? ""}
                  rows={3}
                  onChange={(e) => setSettings({ ...settings, verification_success_message: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Failed verification message</Label>
                <Textarea
                  value={settings.verification_failed_message ?? ""}
                  rows={3}
                  onChange={(e) => setSettings({ ...settings, verification_failed_message: e.target.value })}
                />
              </div>
              <Button
                onClick={() =>
                  updateSettings({
                    verification_enabled: settings.verification_enabled ?? true,
                    verification_timeout_seconds: settings.verification_timeout_seconds ?? 180,
                    verification_max_attempts: settings.verification_max_attempts ?? 3,
                    verification_failure_action: settings.verification_failure_action ?? "kick",
                    verification_prompt_message: settings.verification_prompt_message,
                    verification_success_message: settings.verification_success_message,
                    verification_failed_message: settings.verification_failed_message,
                  })
                }
                disabled={saving}
              >
                <Save className="w-4 h-4 mr-2" />
                Save verification settings
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Rules Message</CardTitle>
              <CardDescription>Shown from /rules and the private menu rules button.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={settings.rules_message}
                rows={7}
                onChange={(e) => setSettings({ ...settings, rules_message: e.target.value })}
              />
              <div className="rounded-lg bg-muted/50 p-3 text-sm whitespace-pre-wrap">{settings.rules_message}</div>
              <Button onClick={() => updateSettings({ rules_message: settings.rules_message })} disabled={saving}>
                <Save className="w-4 h-4 mr-2" />
                Save rules
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Anti-Spam Settings</CardTitle>
              <CardDescription>Deterministic moderation rules for Community Guard V1.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={settings.anti_spam_enabled}
                    onCheckedChange={(anti_spam_enabled) => updateSettings({ anti_spam_enabled })}
                  />
                  <Label>Enable anti-spam</Label>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={settings.anti_link_enabled}
                    onCheckedChange={(anti_link_enabled) => updateSettings({ anti_link_enabled })}
                  />
                  <Label>Block non-whitelisted links</Label>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={settings.block_scam_keywords !== false}
                    onCheckedChange={(block_scam_keywords) => updateSettings({ block_scam_keywords })}
                  />
                  <Label>Block scam keywords</Label>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={settings.block_telegram_previews !== false}
                    onCheckedChange={(block_telegram_previews) => updateSettings({ block_telegram_previews })}
                  />
                  <Label>Block Telegram previews</Label>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={settings.block_external_bots !== false}
                    onCheckedChange={(block_external_bots) => updateSettings({ block_external_bots })}
                  />
                  <Label>Block external bot mentions</Label>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={settings.block_shock_content !== false}
                    onCheckedChange={(block_shock_content) => updateSettings({ block_shock_content })}
                  />
                  <Label>Block shock/scam image text</Label>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={settings.cjk_chatter_guard_enabled !== false}
                    onCheckedChange={(cjk_chatter_guard_enabled) => updateSettings({ cjk_chatter_guard_enabled })}
                  />
                  <Label>Chặn tin nhắn tiếng Trung mồi (lặp lại)</Label>
                </div>
                <div className="flex items-center gap-3">
                  <Label className="w-56">Ngưỡng vi phạm (24h)</Label>
                  <Input
                    type="number"
                    min={2}
                    className="w-24"
                    value={settings.cjk_chatter_strike_threshold ?? 2}
                    onChange={(e) =>
                      updateSettings({ cjk_chatter_strike_threshold: Math.max(2, Number(e.target.value) || 2) })
                    }
                  />
                </div>
                <div className="flex items-center gap-3">
                  <Label className="w-56">Ngôn ngữ chính của nhóm</Label>
                  <Input
                    className="w-24"
                    value={settings.group_primary_language ?? "vi"}
                    onChange={(e) => updateSettings({ group_primary_language: e.target.value.trim().toLowerCase() })}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={settings.account_shop_guard_enabled !== false}
                    onCheckedChange={(account_shop_guard_enabled) => updateSettings({ account_shop_guard_enabled })}
                  />
                  <Label>Chặn quảng cáo bán tài khoản Telegram / số ảo / OTP</Label>
                </div>
                <div className="flex items-center gap-3">
                  <Label className="w-56">Hành động khi phát hiện</Label>
                  <select
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                    value={settings.account_shop_action ?? "ban"}
                    onChange={(e) => updateSettings({ account_shop_action: e.target.value })}
                  >
                    <option value="ban">Cấm vĩnh viễn</option>
                    <option value="warn">Chỉ xoá + cảnh cáo</option>
                  </select>
                </div>

                <div id="join-guard" className="rounded-lg border-2 border-primary/40 bg-primary/5 p-4 space-y-3">
                  <Label className="text-base font-semibold">🛡️ Chặn khi vào nhóm (Join Guard)</Label>
                  <p className="text-xs text-muted-foreground">
                    Quét tên và ảnh đại diện ngay khi có người vào nhóm; vi phạm sẽ bị ban hoặc kick.
                  </p>
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={settings.join_guard_name_enabled !== false}
                      onCheckedChange={(join_guard_name_enabled) => updateSettings({ join_guard_name_enabled })}
                    />
                    <Label>Quét tên / username nhạy cảm</Label>
                  </div>
                  <div className="space-y-2">
                    <Label>Từ khoá chặn thêm (mỗi dòng hoặc cách bởi dấu phẩy)</Label>
                    <Textarea
                      rows={3}
                      value={settings.join_guard_name_keywords ?? ""}
                      onChange={(e) => updateSettings({ join_guard_name_keywords: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Danh sách miễn trừ (allowlist)</Label>
                    <Textarea
                      rows={2}
                      value={settings.join_guard_name_allowlist ?? ""}
                      onChange={(e) => updateSettings({ join_guard_name_allowlist: e.target.value })}
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={settings.join_guard_avatar_enabled !== false}
                      onCheckedChange={(join_guard_avatar_enabled) => updateSettings({ join_guard_avatar_enabled })}
                    />
                    <Label>Quét ảnh đại diện nhạy cảm</Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <Label className="w-56">Mức chặn ảnh</Label>
                    <select
                      className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                      value={settings.join_guard_avatar_threshold ?? "explicit"}
                      onChange={(e) => updateSettings({ join_guard_avatar_threshold: e.target.value })}
                    >
                      <option value="explicit">Chỉ ảnh phản cảm rõ ràng</option>
                      <option value="suspicious">Cả ảnh gợi dục / nghi ngờ</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-3">
                    <Label className="w-56">Hành động</Label>
                    <select
                      className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                      value={settings.join_guard_action ?? "ban"}
                      onChange={(e) => updateSettings({ join_guard_action: e.target.value })}
                    >
                      <option value="ban">Chặn vĩnh viễn (ban)</option>
                      <option value="kick">Mời ra khỏi nhóm (kick)</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Switch
                    checked={settings.enable_ocr_scan !== false}
                    onCheckedChange={(enable_ocr_scan) => updateSettings({ enable_ocr_scan })}
                  />
                  <Label>Enable OCR scan</Label>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={settings.scam_protection_enabled !== false}
                    onCheckedChange={(scam_protection_enabled) => updateSettings({ scam_protection_enabled })}
                  />
                  <Label>Block fake verification / QR login scam</Label>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={settings.scam_warning_enabled !== false}
                    onCheckedChange={(scam_warning_enabled) => updateSettings({ scam_warning_enabled })}
                  />
                  <Label>Warn group after QR scam removal</Label>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={settings.scam_strict_mode === true}
                    onCheckedChange={(scam_strict_mode) => updateSettings({ scam_strict_mode })}
                  />
                  <Label>Strict mode: include admins</Label>
                </div>
                <div className="space-y-2">
                  <Label>New user restriction hours</Label>
                  <Input
                    type="number"
                    value={settings.new_user_restriction_hours}
                    onChange={(e) => setSettings({ ...settings, new_user_restriction_hours: numberValue(e.target.value, 24) })}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label>Rate-limit flood messages</Label>
                    <Switch
                      checked={settings.max_messages_per_minute > 0}
                      onCheckedChange={(enabled) =>
                        updateSettings({
                          max_messages_per_minute: enabled
                            ? settings.max_messages_per_minute > 0
                              ? settings.max_messages_per_minute
                              : 60
                            : 0,
                        })
                      }
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Tắt riêng flood rate-limit cho đội chấm Zoom gửi nhiều ảnh; scam keywords, link, bot mention và OCR vẫn hoạt động.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Max messages per minute</Label>
                  <Input
                    type="number"
                    value={settings.max_messages_per_minute}
                    disabled={settings.max_messages_per_minute <= 0}
                    onChange={(e) => setSettings({ ...settings, max_messages_per_minute: numberValue(e.target.value, 3) })}
                  />
                  <p className="text-xs text-muted-foreground">0 = tắt riêng rule message_rate_limit.</p>
                </div>
                <div className="space-y-2">
                  <Label>Warning before mute</Label>
                  <Input
                    type="number"
                    value={settings.warning_before_mute}
                    onChange={(e) => setSettings({ ...settings, warning_before_mute: numberValue(e.target.value, 2) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Warning before ban</Label>
                  <Input
                    type="number"
                    value={settings.warning_before_ban}
                    onChange={(e) => setSettings({ ...settings, warning_before_ban: numberValue(e.target.value, 3) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Mute duration minutes</Label>
                  <Input
                    type="number"
                    value={settings.mute_duration_minutes}
                    onChange={(e) => setSettings({ ...settings, mute_duration_minutes: numberValue(e.target.value, 1440) })}
                  />
                </div>
              </div>
              <Button
                onClick={() =>
                  updateSettings({
                    new_user_restriction_hours: settings.new_user_restriction_hours,
                    max_messages_per_minute: settings.max_messages_per_minute,
                    warning_before_mute: settings.warning_before_mute,
                    warning_before_ban: settings.warning_before_ban,
                    mute_duration_minutes: settings.mute_duration_minutes,
                    block_telegram_previews: settings.block_telegram_previews,
                    block_external_bots: settings.block_external_bots,
                    block_scam_keywords: settings.block_scam_keywords,
                    block_shock_content: settings.block_shock_content,
                    enable_ocr_scan: settings.enable_ocr_scan,
                    scam_protection_enabled: settings.scam_protection_enabled,
                    scam_strict_mode: settings.scam_strict_mode,
                    scam_warning_enabled: settings.scam_warning_enabled,
                  })
                }
                disabled={saving}
              >
                <Save className="w-4 h-4 mr-2" />
                Save anti-spam settings
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Whitelist Domains</CardTitle>
            <CardDescription>Links from these domains are allowed.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input placeholder="fun.rich" value={newDomain} onChange={(e) => setNewDomain(e.target.value)} />
              <Button onClick={addDomain}>Add</Button>
            </div>
            <div className="space-y-2">
              {domains.map((domain) => (
                <div key={domain.id} className="flex items-center justify-between rounded-lg border p-2 text-sm">
                  <span className="font-mono">{domain.domain}</span>
                  <Button variant="ghost" size="icon" onClick={() => removeDomain(domain.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Blocked Keywords</CardTitle>
            <CardDescription>
              Messages containing these phrases are removed. Add scam/adult preview handles,
              external bot usernames, or phrases visible in Telegram previews.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-[1fr_130px_auto] gap-2">
              <Input placeholder="seed phrase" value={newKeyword} onChange={(e) => setNewKeyword(e.target.value)} />
              <Select value={newSeverity} onValueChange={setNewSeverity}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={addKeyword}>Add</Button>
            </div>
            <div className="space-y-2">
              {keywords.map((keyword) => (
                <div key={keyword.id} className="flex items-center justify-between rounded-lg border p-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-mono">{keyword.keyword}</span>
                    <Badge variant={keyword.severity === "high" ? "destructive" : "outline"}>{keyword.severity}</Badge>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeKeyword(keyword.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5" /> Quick Replies (Keyword Auto-answer)
          </CardTitle>
          <CardDescription>
            Khi tin nhắn của user khớp 1 trong các pattern (regex, case-insensitive), bot sẽ trả lời nội dung card tương ứng — chạy <b>sau moderation</b>, <b>trước Angel AI</b>, không tốn AI credit. Mặc định có card <b>CAMLY Contract / BscScan / Token Tracker</b>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3 rounded-lg border p-4 bg-muted/30">
            <div className="text-sm font-semibold">
              {quickReplyDraft.id ? "Chỉnh sửa quick reply" : "Thêm quick reply mới"}
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Label</Label>
                <Input
                  placeholder="CAMLY Contract Info"
                  value={quickReplyDraft.label}
                  onChange={(e) => setQuickReplyDraft((d) => ({ ...d, label: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Sort order</Label>
                <Input
                  type="number"
                  value={quickReplyDraft.sort_order}
                  onChange={(e) =>
                    setQuickReplyDraft((d) => ({ ...d, sort_order: numberValue(e.target.value, 0) }))
                  }
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Patterns (mỗi dòng 1 regex)</Label>
              <Textarea
                rows={6}
                className="font-mono text-xs"
                placeholder={"\\bcontract\\b\nhợp\\s*đồng\n\\bcamly(\\s*coin)?\\b"}
                value={quickReplyDraft.patternsText}
                onChange={(e) => setQuickReplyDraft((d) => ({ ...d, patternsText: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Regex JS chuẩn, luôn case-insensitive. Ví dụ <code>\bcontract\b</code>, <code>hợp\s*đồng</code>.
              </p>
            </div>
            <div className="space-y-1">
              <Label>Reply text (HTML Telegram)</Label>
              <Textarea
                rows={8}
                className="font-mono text-xs"
                placeholder="👉 <b>Contract:</b> <code>0x...</code>"
                value={quickReplyDraft.reply_text}
                onChange={(e) => setQuickReplyDraft((d) => ({ ...d, reply_text: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Hỗ trợ thẻ <code>&lt;b&gt;</code>, <code>&lt;code&gt;</code>, <code>&lt;a href=&quot;...&quot;&gt;</code>. Xuống dòng = ký tự xuống dòng thường.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={quickReplyDraft.is_active}
                  onCheckedChange={(checked) =>
                    setQuickReplyDraft((d) => ({ ...d, is_active: checked }))
                  }
                />
                <Label className="!m-0">Active</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={quickReplyDraft.disable_web_page_preview}
                  onCheckedChange={(checked) =>
                    setQuickReplyDraft((d) => ({ ...d, disable_web_page_preview: checked }))
                  }
                />
                <Label className="!m-0">Disable link preview</Label>
              </div>
              <div className="flex items-center gap-2">
                <Label className="!m-0">Parse mode</Label>
                <Select
                  value={quickReplyDraft.parse_mode}
                  onValueChange={(v) => setQuickReplyDraft((d) => ({ ...d, parse_mode: v }))}
                >
                  <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HTML">HTML</SelectItem>
                    <SelectItem value="MarkdownV2">MarkdownV2</SelectItem>
                    <SelectItem value="Markdown">Markdown</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="ml-auto flex gap-2">
                {quickReplyDraft.id && (
                  <Button variant="outline" onClick={() => setQuickReplyDraft(emptyQuickReply())}>
                    Cancel
                  </Button>
                )}
                <Button onClick={saveQuickReply} disabled={savingQuickReply}>
                  {savingQuickReply ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  {quickReplyDraft.id ? "Save changes" : "Add quick reply"}
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Bot cache quick replies trong 30s, đổi sẽ áp dụng tự động sau đó (không cần redeploy).
            </p>
          </div>

          <div className="space-y-2">
            {quickReplies.length === 0 && (
              <p className="text-sm text-muted-foreground">Chưa có quick reply nào.</p>
            )}
            {quickReplies.map((row) => (
              <div key={row.id} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{row.label}</span>
                    <Badge variant={row.is_active ? "default" : "outline"}>
                      {row.is_active ? "Active" : "Disabled"}
                    </Badge>
                    <Badge variant="secondary">{row.patterns?.length ?? 0} patterns</Badge>
                    <Badge variant="outline">sort {row.sort_order}</Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" onClick={() => editQuickReply(row)}>
                      Edit
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteQuickReply(row.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(row.patterns ?? []).map((p, idx) => (
                    <code key={idx} className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
                      {p}
                    </code>
                  ))}
                </div>
                <pre className="text-xs whitespace-pre-wrap rounded bg-muted/50 p-2 max-h-48 overflow-y-auto">
                  {row.reply_text}
                </pre>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>



      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Moderation Logs</span>
            <Button variant="outline" size="sm" onClick={loadFilteredLogs}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Apply filters
            </Button>
          </CardTitle>
          <CardDescription>{logs.length} sự kiện đang tải · tối đa 100 sự kiện mới nhất · thời gian MYT (UTC+8)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-3">
            <Select value={logAction} onValueChange={setLogAction}>
              <SelectTrigger>
                <SelectValue placeholder="Action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                <SelectItem value="deleted_warned">Deleted/warned</SelectItem>
                <SelectItem value="muted">Muted</SelectItem>
                <SelectItem value="banned">Banned</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="Reason contains" value={logReason} onChange={(e) => setLogReason(e.target.value)} />
            <Input placeholder="Username or user ID" value={logUser} onChange={(e) => setLogUser(e.target.value)} />
          </div>
          <div className="space-y-2 max-h-[520px] overflow-y-auto">
            {logs.length === 0 && <p className="text-sm text-muted-foreground">No moderation logs yet.</p>}
            {logs.map((log) => (
              <div key={log.id} className="rounded-lg border p-3 text-sm space-y-1">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={log.action === "banned" || log.action === "muted" ? "destructive" : "outline"}>
                      {log.action}
                    </Badge>
                    <Badge variant="secondary">{log.reason}</Badge>
                    <span className="font-medium">@{log.username || log.telegram_user_id || "unknown"}</span>
                    <span className="text-muted-foreground">
                      {Number(log.group_id) > 0 ? "Private chat" : "Group"} {log.group_id}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{fmtTime(log.created_at)}</span>
                    {log.telegram_user_id && Number(log.group_id) < 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={async () => {
                          if (!confirm(`Reset warning/mute/ban nội bộ cho user ${log.username || log.telegram_user_id}?\n\nLưu ý: nếu user đã bị Telegram ban thật, Cha cần unban thủ công trong Telegram.`)) return;
                          try {
                            await invokeAdmin("reset_user_moderation_state", {
                              group_id: log.group_id,
                              telegram_user_id: log.telegram_user_id,
                            });
                            toast.success(`✅ User ${log.username || log.telegram_user_id} đã được gỡ chặn nhầm.`);
                            await loadFilteredLogs();
                          } catch (err) {
                            toast.error(`Reset thất bại: ${(err as Error).message}`);
                          }
                        }}
                      >
                        Reset
                      </Button>
                    )}
                  </div>
                </div>
                {log.message_text && <p className="text-muted-foreground break-all italic">"{log.message_text}"</p>}
                {log.action !== "error" && <CheckCircle2 className="w-4 h-4 text-green-500" />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
