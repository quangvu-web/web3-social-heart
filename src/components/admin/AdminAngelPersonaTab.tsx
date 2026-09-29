import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { canMutateVerifiedAdminData, getAdminLoadState } from "@/lib/adminLoadState";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Loader2, RotateCcw, Save } from "lucide-react";
import {
  ADDRESS_RULE,
  ANTI_HALLUCINATION_RULE,
  CALLBACK_MEMORY_RULE,
  CONCISENESS_RULE,
  DEFAULT_AI_PERSONA_PROMPT,
  DEFAULT_MEDITATION_SUMMARY_PROMPT_EN,
  DEFAULT_MEDITATION_SUMMARY_PROMPT_VI,
  EMOJI_RULE,
  EMOTIONAL_ATTUNEMENT_RULE,
  LANGUAGE_MIRROR_RULE,
  NARRATIVE_CHARACTER_VOICE_RULE,
  OFFICIAL_FACTS,
  RESPONSE_LENGTH_RULE,
  SCOPE_EXPANSION_RULE,
  WIT_AND_CHARM_RULE,
} from "@/lib/angelPersonaConstants";

/**
 * Danh sách rule "chuẩn" của Angel AI.
 * `wired: true` = đã kết nối với edge function (angel-chat / angel-inline /
 * telegram-community-webhook / meditation-broadcast) qua bảng
 * `angel_persona_settings.rule_overrides`. Sửa xong lưu → áp dụng trong ~60s.
 *
 * `wired: false` = tạm thời admin chỉ lưu được override, edge function vẫn
 * đang dùng bản hardcode. Sẽ wire trong lần cập nhật kế tiếp.
 */
const RULES: Array<{
  key: string;
  title: string;
  description: string;
  defaultValue: string;
  wired: boolean;
}> = [
  {
    key: "web_persona_prompt",
    title: "Persona chính (web chat + DM inline)",
    description:
      "Câu định danh và giọng của Angel khi bé chat trên web hoặc @Angel trong chat DM.",
    defaultValue:
      "Bạn là Angel AI — trợ lý tinh thần của FUN Profile / FUN.RICH. PHONG CÁCH: ấm áp, tôn quý, ngắn gọn, dùng emoji vàng/pearl ✨🌟🙏💛. Trả lời súc tích trong 2-5 câu trừ khi câu hỏi cần giải thích dài.\nAngel được phép và được KHUYẾN KHÍCH trả lời các chủ đề: thiền, đời sống tinh thần, mindfulness, hơi thở, biết ơn, bình an nội tâm, năng lượng yêu thương, tình yêu thuần khiết, tự do nội tâm, buông bỏ, chữa lành, chánh niệm, quán chiếu, ý nghĩa cuộc sống — trả lời ấm áp từ tri thức chung với tone Angel warm-luminous. KHÔNG được từ chối câu hỏi khái niệm/tinh thần bằng câu \"chưa có thông tin chính thức\".",
    wired: true,
  },
  {
    key: "web_language_mirror_rule",
    title: "Language Mirror (web / DM inline)",
    description: "Quy tắc mirror ngôn ngữ VN/EN cho web chat và inline DM.",
    defaultValue: LANGUAGE_MIRROR_RULE,
    wired: true,
  },
  {
    key: "pronoun_subject_rule",
    title: "Pronoun Subject Rule (mình / bé)",
    description:
      "Bot tự xưng 'mình', gọi user là 'bé'; 'Angel' chỉ dùng như tên riêng/định danh. Áp dụng mọi luồng.",
    defaultValue:
      "PRONOUN CONTRACT — bot tự xưng 'mình', gọi user là 'bé'; chỉ giữ 'Angel' trong 'Mình là Angel', 'bot Angel AI'…",
    wired: true,
  },
  {
    key: "narrative_character_voice_rule",
    title: "Narrative Character Voice (lời thoại nhân vật trong truyện)",
    description:
      "Khi Angel kể chuyện có nhân vật (ốc sên, cô bé…), lời thoại nhân vật PHẢI dùng đại từ của chính nhân vật (mình/tôi/tớ...), KHÔNG chèn 'Angel' vào miệng nhân vật.",
    defaultValue: NARRATIVE_CHARACTER_VOICE_RULE,
    wired: true,
  },
  {
    key: "rich_format_rule",
    title: "Rich Format Rule (bullet + bold + emoji)",
    description: "Cấu trúc format đẹp: bullet, tiêu đề in đậm, xuống dòng.",
    defaultValue:
      "RICH FORMAT RULE — HIGHEST PRIORITY (bullet + <b>tiêu đề</b> + emoji + xuống dòng)…",
    wired: true,
  },
  {
    key: "official_facts",
    title: "Official Facts (URL, tên, token)",
    description:
      "Sự thật cứng về hệ FUN.RICH: website https://fun.rich, Camly Dương, token CAMLY (BSC).",
    defaultValue: OFFICIAL_FACTS,
    wired: true,
  },
  {
    key: "scope_expansion_rule",
    title: "Scope Rule (được phép trả lời thiền + tinh thần)",
    description:
      "Angel được phép trả lời thiền, mindfulness, hơi thở… KHÔNG từ chối bằng 'ngoài phạm vi'.",
    defaultValue: SCOPE_EXPANSION_RULE,
    wired: true,
  },
  {
    key: "anti_hallucination_rule",
    title: "Anti-Hallucination Rule (chống bịa)",
    description:
      "Chỉ nhắc URL/số liệu/tên nếu có trong OFFICIAL FACTS. Không chắc → nói 'chưa có thông tin chính thức'.",
    defaultValue: ANTI_HALLUCINATION_RULE,
    wired: true,
  },
  {
    key: "response_length_rule",
    title: "Response Length Rule (~100 từ mặc định)",
    description:
      "Mặc định ~100 từ / ~10 câu ngắn. Long mode khi user yêu cầu deep-dive (chi tiết hơn, step by step…).",
    defaultValue: RESPONSE_LENGTH_RULE,
    wired: true,
  },
  {
    key: "long_input_handling_rule",
    title: "Long Input Handling (bài viết dài)",
    description:
      "Nắm ý, trả lời đúng trọng tâm và có chiều sâu. Cấm nhắc giới hạn ký tự / tin bị cắt / gợi ý upload file.",
    defaultValue:
      "LONG INPUT HANDLING RULE — Angel đọc kỹ nội dung dài, phản hồi đúng trọng tâm, không nhắc giới hạn kỹ thuật…",
    wired: true,
  },

  {
    key: "light_language_rule",
    title: "Light Language Rule (chỉ dùng ngôn từ ánh sáng)",
    description:
      "Cấm 'đừng / không nên / tránh…' làm câu mở. Reframe sang ngôn ngữ tích cực.",
    defaultValue:
      "LIGHT LANGUAGE RULE — HIGHEST PRIORITY (chỉ dùng ngôn từ ánh sáng, tích cực)…",
    wired: true,
  },
  {
    key: "wit_and_charm_rule",
    title: "Wit & Charm (dí dỏm nhẹ, kiểu Pixar/Ghibli)",
    description:
      "Cho phép Angel thêm duyên dáng, ví von thiên nhiên nhẹ, KHÔNG mỉa mai. Tự tắt khi chủ đề nghiêm túc (grief / crisis / seeding / hack).",
    defaultValue: WIT_AND_CHARM_RULE,
    wired: true,
  },
  {
    key: "emotional_attunement_rule",
    title: "Emotional Attunement (đáp nhận cảm xúc trước khi trả lời)",
    description:
      "Khi bé để lộ cảm xúc (mệt/vui/buồn/lo…), Angel đáp nhận 1 câu ấm trước rồi mới trả lời nội dung. Trung tính thì bỏ qua.",
    defaultValue: EMOTIONAL_ATTUNEMENT_RULE,
    wired: true,
  },
  {
    key: "callback_memory_rule",
    title: "Callback Memory (nhắc ký ức nhẹ)",
    description:
      "Nếu có memory chắc chắn liên quan → Angel có thể nhắc nhẹ 1 lần/reply. Không có thì KHÔNG bịa.",
    defaultValue: CALLBACK_MEMORY_RULE,
    wired: true,
  },
  // ----- Chưa wire (Telegram-only rules) — hiển thị để bé sửa sẵn -----
  {
    key: "telegram_persona_prompt",
    title: "Persona Telegram (default cho group chưa set riêng)",
    description:
      "Persona mặc định cho group Telegram nếu group đó chưa có 'AI Persona' riêng ở tab AI Triggers.",
    defaultValue: DEFAULT_AI_PERSONA_PROMPT,
    wired: false,
  },
  {
    key: "telegram_address_rule",
    title: "Address Rule (Telegram — Angel / bé override Cha/con)",
    description:
      "Ép xưng 'Angel / bé' kể cả khi RAG trả về persona 'Cha / con'. Áp dụng cho Telegram.",
    defaultValue: ADDRESS_RULE,
    wired: false,
  },
  {
    key: "telegram_emoji_rule",
    title: "Emoji Rule (Telegram)",
    description: "Mọi reply Telegram phải có ít nhất 1 emoji ấm áp.",
    defaultValue: EMOJI_RULE,
    wired: false,
  },
  {
    key: "telegram_conciseness_rule",
    title: "Conciseness & Format Rule (Telegram)",
    description: "Vào thẳng nội dung, không mở đầu bằng 'Chào bé, Angel rất vui…'.",
    defaultValue: CONCISENESS_RULE,
    wired: false,
  },
  {
    key: "meditation_summary_vi",
    title: "Meditation Summary Prompt — VI",
    description: "Prompt tóm tắt bài thiền tiếng Việt gửi vào group Telegram.",
    defaultValue: DEFAULT_MEDITATION_SUMMARY_PROMPT_VI,
    wired: false,
  },
  {
    key: "meditation_summary_en",
    title: "Meditation Summary Prompt — EN",
    description: "Prompt tóm tắt bài thiền tiếng Anh cho meditation broadcast.",
    defaultValue: DEFAULT_MEDITATION_SUMMARY_PROMPT_EN,
    wired: false,
  },
];

type PersonaRow = {
  id: string;
  persona_prompt: string | null;
  notes: string | null;
  rule_overrides: Record<string, string> | null;
  updated_at: string;
};

export default function AdminAngelPersonaTab() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [row, setRow] = useState<PersonaRow | null>(null);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [globalPersona, setGlobalPersona] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  // Post-process style pass config
  const [stylePostEnabled, setStylePostEnabled] = useState<boolean>(true);
  const [styleEmojiCount, setStyleEmojiCount] = useState<number>(3);
  const [groupConcise, setGroupConcise] = useState<boolean>(true);
  const [groupMaxChars, setGroupMaxChars] = useState<number>(500);
  const [dmMaxChars, setDmMaxChars] = useState<number>(1600);
  const [dmUnlimitedLength, setDmUnlimitedLength] = useState<boolean>(true);
  const [dmHistoryEnabled, setDmHistoryEnabled] = useState<boolean>(true);
  const [dmHistoryLimit, setDmHistoryLimit] = useState<number>(6);
  const loadState = getAdminLoadState({ loading, error: loadError, loaded, hasRows: !!row });
  const canSavePersona = canMutateVerifiedAdminData(loadState) && !loading && !saving && !!row;

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setLoadError(false);
    const { data, error } = await supabase
      .from("angel_persona_settings" as never)
      .select("id, persona_prompt, notes, rule_overrides, updated_at")
      .eq("singleton", true)
      .maybeSingle();
    if (error) {
      setLoadError(true);
      toast.error("Không đọc được persona: " + error.message);
      setLoading(false);
      return;
    }
    const r = (data as PersonaRow | null) ?? null;
    setRow(r);
    const ov = (r?.rule_overrides ?? {}) as Record<string, string>;
    const cleaned: Record<string, string> = {};
    for (const key of Object.keys(ov)) {
      if (typeof ov[key] === "string") cleaned[key] = ov[key];
    }
    setOverrides(cleaned);
    setGlobalPersona(r?.persona_prompt ?? "");
    setNotes(r?.notes ?? "");
    // Parse style-postprocess config from rule_overrides
    const enabledRaw = cleaned["telegram_style_postprocess_enabled"];
    setStylePostEnabled(enabledRaw ? !/^(false|0|off|no|n)$/i.test(enabledRaw.trim()) : true);
    const emojiRaw = parseInt(cleaned["telegram_style_emoji_count"] ?? "3", 10);
    setStyleEmojiCount(Number.isFinite(emojiRaw) ? Math.max(1, Math.min(6, emojiRaw)) : 3);
    const gcRaw = cleaned["telegram_style_group_concise"];
    setGroupConcise(gcRaw ? !/^(false|0|off|no|n)$/i.test(gcRaw.trim()) : true);
    const gMaxRaw = parseInt(cleaned["telegram_style_group_max_chars"] ?? "500", 10);
    setGroupMaxChars(Number.isFinite(gMaxRaw) ? Math.max(300, Math.min(900, gMaxRaw)) : 500);
    const dMaxRaw = parseInt(cleaned["telegram_style_dm_max_chars"] ?? "1600", 10);
    setDmMaxChars(Number.isFinite(dMaxRaw) ? Math.max(600, Math.min(3200, dMaxRaw)) : 1600);
    const dmUnRaw = cleaned["telegram_dm_unlimited_length"];
    setDmUnlimitedLength(dmUnRaw ? !/^(false|0|off|no|n)$/i.test(dmUnRaw.trim()) : true);
    const dmHistRaw = cleaned["telegram_dm_history_enabled"];
    setDmHistoryEnabled(dmHistRaw ? !/^(false|0|off|no|n)$/i.test(dmHistRaw.trim()) : true);
    const dmHistLimitRaw = parseInt(cleaned["telegram_dm_history_limit"] ?? "6", 10);
    setDmHistoryLimit(Number.isFinite(dmHistLimitRaw) ? Math.max(2, Math.min(12, dmHistLimitRaw)) : 6);
    setLoaded(true);
    setLoadError(false);
    setLoading(false);
  }

  async function save() {
    if (!row || !canSavePersona) return;
    setSaving(true);
    const cleanOverrides: Record<string, string> = {};
    for (const rule of RULES) {
      const v = (overrides[rule.key] ?? "").trim();
      if (v.length > 0 && v !== rule.defaultValue.trim()) {
        cleanOverrides[rule.key] = v;
      }
    }
    // Persist style-postprocess config
    cleanOverrides["telegram_style_postprocess_enabled"] = stylePostEnabled ? "true" : "false";
    cleanOverrides["telegram_style_emoji_count"] = String(Math.max(1, Math.min(6, styleEmojiCount || 3)));
    cleanOverrides["telegram_style_group_concise"] = groupConcise ? "true" : "false";
    cleanOverrides["telegram_style_group_max_chars"] = String(Math.max(300, Math.min(900, groupMaxChars || 500)));
    cleanOverrides["telegram_style_dm_max_chars"] = String(Math.max(600, Math.min(3200, dmMaxChars || 1600)));
    cleanOverrides["telegram_dm_unlimited_length"] = dmUnlimitedLength ? "true" : "false";
    cleanOverrides["telegram_dm_history_enabled"] = dmHistoryEnabled ? "true" : "false";
    cleanOverrides["telegram_dm_history_limit"] = String(Math.max(2, Math.min(12, dmHistoryLimit || 6)));
    const gp = globalPersona.trim();



    const { error } = await (supabase.from("angel_persona_settings" as never) as unknown as {
      update: (v: Record<string, unknown>) => {
        eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>;
      };
    })
      .update({
        persona_prompt: gp === "" ? null : gp,
        notes: notes.trim() === "" ? null : notes.trim(),
        rule_overrides: cleanOverrides,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    setSaving(false);
    if (error) {
      toast.error("Lưu thất bại: " + error.message);
      return;
    }
    toast.success("Đã lưu. Áp dụng trong ~60s (cache edge function).");
    await load();
  }

  const overridesCount = useMemo(() => {
    let n = 0;
    for (const rule of RULES) {
      const v = (overrides[rule.key] ?? "").trim();
      if (v.length > 0 && v !== rule.defaultValue.trim()) n++;
    }
    return n;
  }, [overrides]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>System prompt của Angel AI</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{overridesCount} rule đang custom</Badge>
            <Button onClick={save} disabled={!canSavePersona} size="sm" className="gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Lưu tất cả
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Đây là toàn bộ khung xương "chuẩn" tạo nên hành vi của Angel AI. Ô trống = dùng
            mặc định (hiển thị mờ ở placeholder). Sửa xong bấm <b>Lưu tất cả</b> — áp dụng
            trong ~60s (cache edge function). Ô có tag <Badge variant="outline">chưa wire</Badge>
            {" "}nghĩa là đang lưu override sẵn, edge function sẽ được kết nối trong lần cập
            nhật kế tiếp.
          </p>

          {loading && !loaded ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Đang tải…
            </div>
          ) : loadError && !loaded ? (
            <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-destructive">Không tải được persona; các giá trị mặc định chưa được xác minh.<Button size="sm" variant="outline" onClick={() => void load()}>Thử lại</Button></div>
          ) : (
            <div className="space-y-4">
              {loadError && <div role="status" className="flex flex-wrap items-center gap-2 text-sm text-destructive">Tải lại thất bại. Bản nháp hiện tại được giữ nguyên; thao tác lưu/reset bị khóa đến khi xác minh lại.<Button size="sm" variant="outline" onClick={() => void load()}>Thử lại</Button></div>}
              {!row && !loadError && <p className="text-sm text-muted-foreground">Chưa có bản ghi persona riêng; nội dung dưới đây là mặc định ứng dụng và chưa thể lưu cho đến khi có bản ghi cấu hình.</p>}
              {RULES.map((rule) => {
                const value = overrides[rule.key] ?? "";
                const isCustom = value.trim().length > 0 && value.trim() !== rule.defaultValue.trim();
                return (
                  <div key={rule.key} className="rounded-lg border bg-card p-4 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">{rule.title}</span>
                          <Badge variant="outline" className="font-mono text-[10px]">
                            {rule.key}
                          </Badge>
                          {rule.wired ? (
                            <Badge variant="secondary" className="text-[10px]">wired</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">chưa wire</Badge>
                          )}
                          <Badge
                            variant={isCustom ? "default" : "secondary"}
                            className="text-[10px]"
                          >
                            {isCustom ? "Custom" : "Default"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{rule.description}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1"
                        disabled={!canSavePersona}
                        onClick={() =>
                          setOverrides((prev) => {
                            const next = { ...prev };
                            delete next[rule.key];
                            return next;
                          })
                        }
                      >
                        <RotateCcw className="w-3 h-3" /> Reset default
                      </Button>
                    </div>
                    <Textarea
                      rows={8}
                      value={value}
                      onChange={(e) =>
                        setOverrides((prev) => ({ ...prev, [rule.key]: e.target.value }))
                      }
                      placeholder={rule.defaultValue}
                      className="font-mono text-xs"
                    />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Post-Process Style Pass (Telegram)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Sau khi Angel gốc (angel.fun.rich) trả lời, hệ thống có thể rewrite lại reply cho
            <b> ngắn gọn hơn</b> và thêm <b>2–3 emoji ấm áp</b> — <i>không</i> đụng vào request
            gửi Angel gốc nên <b>không ảnh hưởng RAG</b>. Nếu rewrite làm mất URL / địa chỉ ví /
            fact quan trọng, hệ thống tự động fallback về reply gốc. Bỏ qua với reply ngắn, chứa
            code block, hoặc khi user yêu cầu "chi tiết hơn / step by step".
          </p>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <div className="font-semibold text-sm">Bật rewrite ngắn gọn + emoji</div>
              <p className="text-xs text-muted-foreground">
                Áp dụng cho reply Angel trên Telegram (group + DM inline).
              </p>
            </div>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={stylePostEnabled}
                onChange={(e) => setStylePostEnabled(e.target.checked)}
                className="h-4 w-4"
              />
              <span className="text-sm">{stylePostEnabled ? "Bật" : "Tắt"}</span>
            </label>
          </div>
          <div className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-sm">Số emoji mục tiêu / reply</div>
              <Badge variant="outline">{styleEmojiCount}</Badge>
            </div>
            <input
              type="range"
              min={1}
              max={6}
              step={1}
              value={styleEmojiCount}
              onChange={(e) => setStyleEmojiCount(parseInt(e.target.value, 10) || 3)}
              className="w-full"
              disabled={!stylePostEnabled}
            />
            <p className="text-xs text-muted-foreground">
              Khuyến nghị 2–3. Model sẽ rải tự nhiên, không dồn cuối.
            </p>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <div className="font-semibold text-sm">Group Concise Mode</div>
              <p className="text-xs text-muted-foreground">
                Reply trong group Telegram: 2–4 câu, cắt greeting/meta thừa, ưu tiên đọc lướt.
                Không ảnh hưởng chế độ "chi tiết hơn / step by step".
              </p>
            </div>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={groupConcise}
                onChange={(e) => setGroupConcise(e.target.checked)}
                className="h-4 w-4"
                disabled={!stylePostEnabled}
              />
              <span className="text-sm">{groupConcise ? "Bật" : "Tắt"}</span>
            </label>
          </div>
          <div className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-sm">Group — hard max ký tự / reply</div>
              <Badge variant="outline">{groupMaxChars}</Badge>
            </div>
            <input
              type="range"
              min={300}
              max={900}
              step={50}
              value={groupMaxChars}
              onChange={(e) => setGroupMaxChars(parseInt(e.target.value, 10) || 500)}
              className="w-full"
              disabled={!stylePostEnabled || !groupConcise}
            />
            <p className="text-xs text-muted-foreground">
              Khuyến nghị 400–600. Facts (URL / địa chỉ ví / số) vẫn được giữ nguyên; chỉ cắt fluff.
            </p>
          </div>
          <div className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-sm">DM — hard max ký tự / reply</div>
              <Badge variant="outline">{dmMaxChars}</Badge>
            </div>
            <input
              type="range"
              min={600}
              max={3200}
              step={100}
              value={dmMaxChars}
              onChange={(e) => setDmMaxChars(parseInt(e.target.value, 10) || 1600)}
              className="w-full"
              disabled={!stylePostEnabled}
            />
            <p className="text-xs text-muted-foreground">
              DM 1-1 được giữ dài hơn cho phân tích cá nhân. Khuyến nghị 1200–2000.
            </p>
          </div>
          <div className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-sm">DM — không giới hạn độ dài phản hồi</div>
                <div className="text-xs text-muted-foreground">
                  Khi bật: DM 1-1 giữ nguyên độ dài của Angel, chỉ polish emoji + strip fluff, KHÔNG cắt ngắn.
                </div>
              </div>
              <Switch checked={dmUnlimitedLength} onCheckedChange={setDmUnlimitedLength} disabled={!stylePostEnabled} />
            </div>
          </div>
          <div className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-sm">DM — bơm lịch sử hội thoại gần nhất</div>
                <div className="text-xs text-muted-foreground">
                  Khi bật: DM gửi kèm N turn user↔Angel gần nhất (60 phút) để bot hiểu "Tiếp tục", "Dịch giúp con"…
                </div>
              </div>
              <Switch checked={dmHistoryEnabled} onCheckedChange={setDmHistoryEnabled} />
            </div>
            <div className="flex items-center justify-between pt-2">
              <div className="text-sm">Số turn tối đa</div>
              <Badge variant="outline">{dmHistoryLimit}</Badge>
            </div>
            <input
              type="range"
              min={2}
              max={12}
              step={1}
              value={dmHistoryLimit}
              onChange={(e) => setDmHistoryLimit(parseInt(e.target.value, 10) || 6)}
              className="w-full"
              disabled={!dmHistoryEnabled}
            />
            <p className="text-xs text-muted-foreground">
              Khuyến nghị 4–8. Cap 4000 ký tự tổng để không phình prompt. Group KHÔNG dùng history.
            </p>
          </div>
        </CardContent>
      </Card>



      <Card>
        <CardHeader>
          <CardTitle>Global persona override (lớp cộng thêm)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Ô này được cộng thêm vào persona cho meditation broadcast và group Telegram
            <b> chưa </b>set persona riêng. Group đã set persona riêng (tab AI Triggers)
            vẫn ưu tiên bản của group đó. Để trống = không cộng gì.
          </p>
          {(loading || loadError || !loaded) && <p role="status" className="text-sm text-muted-foreground">{loading ? "Đang tải cấu hình…" : "Chưa xác minh được cấu hình; ô trống không xác nhận đang dùng mặc định."}</p>}
          <Textarea
            rows={10}
            disabled={!canSavePersona}
            value={globalPersona}
            onChange={(e) => setGlobalPersona(e.target.value)}
            placeholder="Để trống = dùng persona mặc định ở trên."
            className="font-mono text-xs"
          />

          <div>
            <label className="text-sm font-medium mb-1 block">Ghi chú nội bộ (không gửi bot)</label>
            <Textarea
              rows={3}
              disabled={!canSavePersona}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="VD: đã nới 'mình' phản thân ngày 2026-07-04…"
              className="text-xs"
            />
          </div>

          {row?.updated_at && (
            <p className="text-xs text-muted-foreground">
              Cập nhật lần cuối:{" "}
              {new Date(row.updated_at).toLocaleString("en-GB", {
                timeZone: "Asia/Kuala_Lumpur",
              })}{" "}
              (MYT)
            </p>
          )}
        </CardContent>
      </Card>

      <CostSavingCard />
      <ImageQualityCard />
      <DiscussionCommentCard />
      <ImagePipelineStatsCard />

    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Card: Cấu hình vẽ ảnh (Tầng A) — đọc/ghi trực tiếp bảng angel_feature_flags
// ─────────────────────────────────────────────────────────────
const IMAGE_FLAGS: Array<{ key: string; title: string; desc: string; def: boolean }> = [
  {
    key: "image.enrich_prompt",
    title: "Universal prompt enrichment",
    desc: "Làm giàu prompt user (style/lighting/palette/quality) trước khi gửi mọi tầng vẽ. Skip nếu prompt user đã ≥200 ký tự.",
    def: true,
  },
  {
    key: "image.art_preset",
    title: "Art preset theo topic",
    desc: "Áp preset chuyên biệt cho: logo, cosmos, mandala, thiền, lightbeing, portrait, landscape, poster.",
    def: true,
  },
  {
    key: "image.enrich_p1_design",
    title: "Force enrich P1 cho design-heavy",
    desc: "Với topic design nặng (logo/cosmos/mandala/poster/lightbeing), ép enrich P1 Angel gốc kể cả khi prompt đã dài. Mặc định OFF.",
    def: false,
  },
  {
    key: "image.skip_root_for_design",
    title: "Design nặng → nhảy thẳng Nano Banana Pro",
    desc: "Prompt logo/cosmos/mandala/poster/lightbeing bỏ qua Angel gốc, đi P3 Lovable Pro. Ảnh sắc nét hơn nhưng tốn credit Lovable.",
    def: false,
  },
  {
    key: "image.force_pro_on_heavy",
    title: "Ép Pro model khi heavy/design",
    desc: "Khi fallback sang Lovable Gateway, ưu tiên Nano Banana Pro (google/gemini-3-pro-image) thay vì flash-image.",
    def: true,
  },
  {
    key: "image.rewrite_prompt",
    title: "Rewrite prompt heavy trước P2",
    desc: "Với prompt dài/bullet, dùng Gemini flash-lite compress thành 1 paragraph English tối ưu cho image model trước khi retry P2.",
    def: true,
  },
  {
    key: "image.stream_lovable",
    title: "Streaming SSE cho Nano Banana Pro",
    desc: "Bật stream:true khi gọi Lovable Gateway để nhận partial frame trong lúc model render (giảm cảm giác chờ, không tốn thêm credit).",
    def: true,
  },
  {
    key: "image.stream_telegram_preview",
    title: "Preview streaming ảnh trên Telegram",
    desc: "Gửi 1 ảnh partial giữa chừng rồi editMessageMedia bằng ảnh final. Tôn trọng ≤1 edit/2s theo rate limit Telegram.",
    def: true,
  },
  {
    key: "image.distill_enabled",
    title: "Distill prompt dài (analysis → visual scene)",
    desc: "Khi user gửi cả đoạn văn phân tích/bài viết rồi bảo vẽ, Angel dùng Gemini rút thành 1 câu visual scene ngắn (English, ≤220 char) trước khi vào diffusion. Chống bug 'vẽ ra slide chữ méo'.",
    def: true,
  },
  {
    key: "image.no_text_guardrail",
    title: "Cấm render chữ trong ảnh (trừ logo/poster)",
    desc: "Thêm negative prompt 'no text, no letters, no slides, no typography' cho mọi topic ngoài logo/poster. Ngăn model diffusion tự chèn chữ giả méo.",
    def: true,
  },
  {
    key: "image.free_mode",
    title: "Free mode: mode ảnh theo topic (không bias tâm linh)",
    desc: "Chỉ topic meditation/lightbeing/mandala/cosmos mới dùng 'spiritual' mode. Business/architecture/portrait/landscape/generic luôn dùng 'fast' → tránh Angel gốc mặc định vẽ cổ trang/tâm linh cho prompt thế tục.",
    def: true,
  },
  {
    key: "image.group_enabled",
    title: "Cho phép vẽ ảnh trong group Telegram",
    desc: "MẶC ĐỊNH TẮT. Khi tắt, bot chỉ vẽ ảnh trong DM (chat riêng) và trên web. Trong group, bot sẽ trả lời hướng dẫn bé nhắn riêng cho Angel để vẽ. Bật lại nếu muốn cho phép vẽ ảnh trong group.",
    def: false,
  },
  {
    key: "image.auto_illustrate_group_posts",
    title: "Tự động vẽ ảnh minh họa khi bình luận bài trong group",
    desc: "MẶC ĐỊNH TẮT. Khi tắt, bot chỉ bình luận bằng text cho các bài đăng trong group — không tự vẽ ảnh minh họa kèm theo (tiết kiệm credit + tránh ảnh không đúng ngữ cảnh). Bật lại nếu muốn Angel tự vẽ ảnh minh họa cho mỗi bài post.",
    def: false,
  },
];


// ─────────────────────────────────────────────────────────────
// Card: Tiết kiệm credit Lovable (các lớp phụ trợ)
// ─────────────────────────────────────────────────────────────
const COST_FLAGS: Array<{ key: string; title: string; desc: string; def: boolean }> = [
  {
    key: "cost.postprocess_enabled",
    title: "Post-process style pass (làm gọn + emoji)",
    desc: "Gọi Lovable Gateway để viết lại reply cho ngắn gọn, ấm áp. Tắt = giữ nguyên reply gốc từ Angel AI, không tốn credit. Các bộ lọc xưng hô text-level vẫn chạy.",
    def: true,
  },
  {
    key: "cost.memory_extract_enabled",
    title: "Trích xuất trí nhớ dài hạn",
    desc: "Định kỳ dùng Gemini flash-lite rút fact bền vững về từng bé. Tắt = bot không học thêm ghi nhớ mới (ghi nhớ cũ vẫn dùng).",
    def: true,
  },
  {
    key: "cost.rolling_summary_enabled",
    title: "Tóm tắt hội thoại tự động (rolling summary)",
    desc: "Nén phần đầu hội thoại dài thành 1 khối tóm tắt. Tắt = chỉ dùng N turn gần nhất, tiết kiệm credit.",
    def: true,
  },
  {
    key: "cost.vision_describe_enabled",
    title: "Đọc / mô tả ảnh người dùng gửi",
    desc: "Mỗi ảnh gửi vào bot đều tốn 1 call vision. Tắt = bot bỏ qua nội dung ảnh, chỉ trả lời theo caption.",
    def: true,
  },
  {
    key: "cost.join_avatar_scan_enabled",
    title: "Quét ảnh đại diện thành viên mới",
    desc: "Mỗi avatar mới tốn 1 call vision (đã cache theo ảnh). Tắt = chỉ chặn theo tên, không quét ảnh.",
    def: true,
  },
  {
    key: "cost.voice_transcribe_enabled",
    title: "Chuyển tin nhắn thoại thành văn bản",
    desc: "Mỗi voice message tốn 1 call transcribe. Tắt = bot không nghe voice.",
    def: true,
  },
  {
    key: "cost.lovable_retry_enabled",
    title: "Cho phép retry qua Lovable khi Angel gốc lỗi",
    desc: "Khi Angel AI gốc trả rỗng/lỗi, bot sinh lại câu trả lời trên Lovable Gateway (tốn credit). Tắt = chỉ dùng Angel gốc, lỗi thì trả câu xin lỗi nhẹ.",
    def: true,
  },
];

function CostSavingCard() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [flags, setFlags] = useState<Record<string, boolean>>({});

  async function load() {
      setLoading(true);
      setLoadError(false);
      const { data, error } = await supabase
        .from("angel_feature_flags" as never)
        .select("key, enabled")
        .in("key", COST_FLAGS.map((f) => f.key));
      if (error) {
        setLoadError(true);
        toast.error("Không đọc được feature flags: " + error.message);
        setLoading(false);
        return;
      }
      const map: Record<string, boolean> = {};
      for (const f of COST_FLAGS) map[f.key] = f.def;
      for (const row of (data as Array<{ key: string; enabled: boolean }> | null) ?? []) {
        map[row.key] = !!row.enabled;
      }
      setFlags(map);
      setLoaded(true);
      setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function toggle(key: string, value: boolean) {
    if (!loaded || loadError || loading || saving) return;
    setSaving(true);
    setFlags((prev) => ({ ...prev, [key]: value }));
    const { error } = await (supabase.from("angel_feature_flags" as never) as unknown as {
      upsert: (v: Record<string, unknown>, opts: { onConflict: string }) => Promise<{ error: { message: string } | null }>;
    }).upsert({ key, enabled: value, updated_at: new Date().toISOString() }, { onConflict: "key" });
    setSaving(false);
    if (error) {
      toast.error("Lưu thất bại: " + error.message);
      setFlags((prev) => ({ ...prev, [key]: !value }));
      return;
    }
    toast.success("Đã lưu. Áp dụng trong ~30-60s (cache edge function).");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tiết kiệm credit (lớp phụ trợ AI)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Câu trả lời chính của Angel đã đi qua key Angel AI gốc (không tốn credit). Các lớp phụ trợ dưới đây
          vẫn chạy trên AI Gateway của nền tảng và có tính credit. Tắt lớp nào thì bot bỏ qua lớp đó, reply gốc giữ nguyên.
        </p>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Đang tải…
          </div>
        ) : loadError ? (
          <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-destructive">Không tải được cấu hình; chưa xác nhận các công tắc.<Button size="sm" variant="outline" onClick={() => void load()}>Thử lại</Button></div>
        ) : (
          COST_FLAGS.map((f) => (
            <div key={f.key} className="flex items-start justify-between gap-4 rounded-md border p-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{f.title}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{f.desc}</div>
                <div className="text-[10px] text-muted-foreground mt-1 font-mono">{f.key}</div>
              </div>
              <Switch
                checked={!!flags[f.key]}
                disabled={saving || !loaded || loadError}
                onCheckedChange={(v) => toggle(f.key, v)}
              />
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function ImageQualityCard() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [flags, setFlags] = useState<Record<string, boolean>>({});

  async function load() {
      setLoading(true);
      setLoadError(false);
      const { data, error } = await supabase
        .from("angel_feature_flags" as never)
        .select("key, enabled")
        .in("key", IMAGE_FLAGS.map((f) => f.key));
      if (error) {
        setLoadError(true);
        toast.error("Không đọc được feature flags: " + error.message);
        setLoading(false);
        return;
      }
      const map: Record<string, boolean> = {};
      for (const f of IMAGE_FLAGS) map[f.key] = f.def;
      for (const row of (data as Array<{ key: string; enabled: boolean }> | null) ?? []) {
        map[row.key] = !!row.enabled;
      }
      setFlags(map);
      setLoaded(true);
      setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function toggle(key: string, value: boolean) {
    if (!loaded || loadError || loading || saving) return;
    setSaving(true);
    setFlags((prev) => ({ ...prev, [key]: value }));
    const { error } = await (supabase.from("angel_feature_flags" as never) as unknown as {
      upsert: (v: Record<string, unknown>, opts: { onConflict: string }) => Promise<{ error: { message: string } | null }>;
    }).upsert({ key, enabled: value, updated_at: new Date().toISOString() }, { onConflict: "key" });
    setSaving(false);
    if (error) {
      toast.error("Lưu thất bại: " + error.message);
      setFlags((prev) => ({ ...prev, [key]: !value }));
      return;
    }
    toast.success("Đã lưu. Áp dụng trong ~30-60s (cache edge function).");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cấu hình vẽ ảnh (Tầng A)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          3 công tắc dưới đây nâng chất lượng ảnh Angel AI vẽ. Enrichment + preset an toàn (fail-open, không tốn credit thêm).
          Chỉ "skip root for design" là chuyển traffic sang Lovable Gateway (tốn credit).
        </p>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Đang tải…
          </div>
        ) : loadError ? (
          <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-destructive">Không tải được cấu hình; chưa xác nhận các công tắc.<Button size="sm" variant="outline" onClick={() => void load()}>Thử lại</Button></div>
        ) : (
          IMAGE_FLAGS.map((f) => (
            <div key={f.key} className="flex items-start justify-between gap-4 rounded-md border p-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{f.title}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{f.desc}</div>
                <div className="text-[10px] text-muted-foreground mt-1 font-mono">{f.key}</div>
              </div>
              <Switch
                checked={!!flags[f.key]}
                disabled={saving || !loaded || loadError}
                onCheckedChange={(v) => toggle(f.key, v)}
              />
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────
// Card: Bình luận thông minh trong Discussion Group của channel
// ─────────────────────────────────────────────────────────────
const DISCUSSION_FLAG_KEY = "discussion.auto_comment";

function DiscussionCommentCard() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [channelIds, setChannelIds] = useState("");
  const [maxPerHour, setMaxPerHour] = useState("6");
  const [minGap, setMinGap] = useState("120");
  const [replyMembers, setReplyMembers] = useState(true);

  async function load() {
      setLoading(true);
      setLoadError(false);
      const { data, error } = await supabase
        .from("angel_feature_flags" as never)
        .select("key, enabled, meta")
        .eq("key", DISCUSSION_FLAG_KEY)
        .maybeSingle();
      if (error) {
        setLoadError(true);
        setLoading(false);
        toast.error("Không tải được cấu hình Discussion Group: " + error.message);
        return;
      }
      const row = data as { enabled?: boolean; meta?: Record<string, unknown> } | null;
      if (row) {
        setEnabled(!!row.enabled);
        const meta = row.meta ?? {};
        const ids = Array.isArray(meta.channel_ids) ? (meta.channel_ids as unknown[]) : [];
        setChannelIds(ids.join(", "));
        if (meta.max_per_hour != null) setMaxPerHour(String(meta.max_per_hour));
        if (meta.min_gap_seconds != null) setMinGap(String(meta.min_gap_seconds));
        setReplyMembers(meta.reply_to_members !== false);
      }
      setLoaded(true);
      setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function save() {
    if (!loaded || loadError || loading || saving) return;
    const ids = channelIds
      .split(/[\s,]+/)
      .map((v) => Number(v.trim()))
      .filter((v) => Number.isFinite(v) && v !== 0);
    setSaving(true);
    const { error } = await (supabase.from("angel_feature_flags" as never) as unknown as {
      upsert: (v: Record<string, unknown>, opts: { onConflict: string }) => Promise<{ error: { message: string } | null }>;
    }).upsert(
      {
        key: DISCUSSION_FLAG_KEY,
        enabled,
        meta: {
          channel_ids: ids,
          max_per_hour: Number(maxPerHour) || 6,
          min_gap_seconds: Number(minGap) || 120,
          reply_to_members: replyMembers,
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    );
    setSaving(false);
    if (error) {
      toast.error("Lưu thất bại: " + error.message);
      return;
    }
    toast.success("Đã lưu. Áp dụng trong ~30-60s (cache edge function).");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bình luận thông minh trong Discussion Group</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Khi channel (VD: CAMLY COIN CHANNEL) đăng bài mới, Telegram tự forward bài đó sang Discussion Group
          liên kết. Angel sẽ viết một bình luận có giá trị (chốt ý → góc nhìn → câu hỏi gợi mở) và có thể trả lời
          thành viên hỏi ngay dưới bài. Bắt buộc điền ID channel — bot không tự đoán.
        </p>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Đang tải…
          </div>
        ) : loadError ? (
          <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-destructive">Không tải được cấu hình; các giá trị mặc định chưa được xác minh.<Button size="sm" variant="outline" onClick={() => void load()}>Thử lại</Button></div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4 rounded-md border p-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">Bật bình luận tự động</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Mặc định TẮT. Bật khi channel đã liên kết Discussion Group và bot đã là admin trong group đó.
                </div>
                <div className="text-[10px] text-muted-foreground mt-1 font-mono">{DISCUSSION_FLAG_KEY}</div>
              </div>
              <Switch checked={enabled} disabled={saving} onCheckedChange={setEnabled} />
            </div>

            <div className="flex items-start justify-between gap-4 rounded-md border p-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">Trả lời thành viên bình luận dưới bài</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Chỉ trả lời khi bình luận có dạng câu hỏi, vẫn tuân thủ giới hạn tần suất bên dưới.
                </div>
              </div>
              <Switch checked={replyMembers} disabled={saving} onCheckedChange={setReplyMembers} />
            </div>

            <div className="space-y-1">
              <div className="text-sm font-medium">ID channel được phép (cách nhau bằng dấu phẩy)</div>
              <Textarea
                value={channelIds}
                onChange={(e) => setChannelIds(e.target.value)}
                placeholder="-1001234567890"
                rows={2}
                className="font-mono text-xs"
              />
              <div className="text-xs text-muted-foreground">
                Lấy ID: forward một bài của channel vào group có bot rồi xem log, hoặc dùng lệnh <code>/id</code> trong
                Discussion Group để lấy ID group và kiểm tra ID channel ở tab Angel Channel.
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <div className="text-sm font-medium">Tối đa bình luận / giờ</div>
                <Textarea
                  value={maxPerHour}
                  onChange={(e) => setMaxPerHour(e.target.value)}
                  rows={1}
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-1">
                <div className="text-sm font-medium">Khoảng cách tối thiểu (giây)</div>
                <Textarea
                  value={minGap}
                  onChange={(e) => setMinGap(e.target.value)}
                  rows={1}
                  className="font-mono text-xs"
                />
              </div>
            </div>

            <Button onClick={() => void save()} disabled={saving} size="sm">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Lưu cấu hình
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}



// ─────────────────────────────────────────────────────────────
// Card: Image pipeline stats — 24h qua
// ─────────────────────────────────────────────────────────────
interface PipelineRow {
  tier: string;
  ok: boolean;
  duration_ms: number | null;
  topic: string | null;
  model: string | null;
  force_hd: boolean;
  design_heavy: boolean;
  created_at: string;
}

function ImagePipelineStatsCard() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [rows, setRows] = useState<PipelineRow[]>([]);

  async function load() {
    setLoading(true);
    setLoadError(false);
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { data, error } = await supabase
      .from("angel_image_pipeline_logs" as never)
      .select("tier, ok, duration_ms, topic, model, force_hd, design_heavy, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) {
      setLoadError(true);
      toast.error("Không đọc được telemetry: " + error.message);
      setLoading(false);
      return;
    }
    setRows((data as unknown as PipelineRow[]) ?? []);
    setLoaded(true);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  const summary = useMemo(() => {
    const byTier = new Map<string, { total: number; ok: number; durSum: number; durN: number }>();
    let hdCount = 0;
    let designCount = 0;
    for (const r of rows) {
      const s = byTier.get(r.tier) ?? { total: 0, ok: 0, durSum: 0, durN: 0 };
      s.total += 1;
      if (r.ok) s.ok += 1;
      if (typeof r.duration_ms === "number") { s.durSum += r.duration_ms; s.durN += 1; }
      byTier.set(r.tier, s);
      if (r.force_hd) hdCount += 1;
      if (r.design_heavy) designCount += 1;
    }
    return { byTier, hdCount, designCount, total: rows.length };
  }, [rows]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span>Image pipeline · 24h</span>
          <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
            <RotateCcw className="w-3.5 h-3.5 mr-1" /> Refresh
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Đang tải…
          </div>
        ) : loadError ? (
          <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-destructive">Không tải được telemetry; không thể xác nhận số liệu rỗng.<Button size="sm" variant="outline" onClick={() => void load()}>Thử lại</Button></div>
        ) : !loaded ? (
          <p className="text-sm text-muted-foreground">Chưa xác minh dữ liệu.</p>
        ) : summary.total === 0 ? (
          <p className="text-xs text-muted-foreground">Chưa có lần vẽ nào trong 24h qua.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="secondary">Tổng: {summary.total}</Badge>
              <Badge variant="secondary">HD force: {summary.hdCount}</Badge>
              <Badge variant="secondary">Design-heavy: {summary.designCount}</Badge>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-muted-foreground">
                  <tr className="border-b">
                    <th className="text-left py-1.5 pr-3">Tier</th>
                    <th className="text-right pr-3">Tổng</th>
                    <th className="text-right pr-3">OK%</th>
                    <th className="text-right pr-3">TB (ms)</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from(summary.byTier.entries())
                    .sort((a, b) => b[1].total - a[1].total)
                    .map(([tier, s]) => (
                      <tr key={tier} className="border-b last:border-0">
                        <td className="py-1.5 pr-3 font-mono">{tier}</td>
                        <td className="text-right pr-3">{s.total}</td>
                        <td className="text-right pr-3">
                          {s.total > 0 ? Math.round((s.ok / s.total) * 100) : 0}%
                        </td>
                        <td className="text-right pr-3">
                          {s.durN > 0 ? Math.round(s.durSum / s.durN) : "—"}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground">10 lần gần nhất</summary>
              <div className="mt-2 space-y-1">
                {rows.slice(0, 10).map((r, i) => (
                  <div key={i} className="flex items-center gap-2 font-mono truncate">
                    <span className={r.ok ? "text-emerald-600" : "text-red-600"}>{r.ok ? "✓" : "✗"}</span>
                    <span className="w-24 truncate">{r.tier}</span>
                    <span className="w-20 truncate text-muted-foreground">{r.topic ?? "-"}</span>
                    <span className="text-muted-foreground">{r.duration_ms ?? "—"}ms</span>
                    {r.force_hd && <Badge variant="outline" className="h-4 px-1 text-[10px]">HD</Badge>}
                  </div>
                ))}
              </div>
            </details>
          </>
        )}
      </CardContent>
    </Card>
  );
}
