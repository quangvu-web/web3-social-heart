import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase as supabaseTyped } from "@/integrations/supabase/client";
// Types cho angel_prompt_versions chưa regen. Cast local để dùng ngay.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = supabaseTyped as any;
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, GitBranch, Send, RotateCcw, Save } from "lucide-react";

/**
 * Sprint 3 — Admin UI tab quản lý prompt versioning.
 * Bảng backing: `angel_prompt_versions` (Sprint 3 migration).
 *
 * Luồng:
 *  1. Chọn rule_key (dropdown/free input, khớp với key trong
 *     angel_persona_settings.rule_overrides).
 *  2. Snapshot nội dung hiện tại xuống một version mới (kèm ghi chú).
 *  3. Publish version mong muốn → tự copy content sang rule_overrides để
 *     edge function pick up (~60s do flag/persona cache).
 *  4. Rollback = publish lại version cũ.
 */

interface PromptVersion {
  id: string;
  rule_key: string;
  version_number: number;
  content: string;
  notes: string | null;
  is_published: boolean;
  published_at: string | null;
  created_by: string | null;
  created_at: string;
}

const KNOWN_RULE_KEYS = [
  "web_persona_prompt",
  "web_language_mirror_rule",
  "pronoun_subject_rule",
  "narrative_character_voice_rule",
  "rich_format_rule",
  "official_facts",
  "scope_expansion_rule",
  "anti_hallucination_rule",
  "response_length_rule",
  "light_language_rule",
  "seeding_context_fidelity_rule",
  "seed_phrase_warning_discipline_rule",
  "wit_and_charm_rule",
  "emotional_attunement_rule",
  "callback_memory_rule",
];

export default function AdminPromptVersionsTab() {
  const [ruleKey, setRuleKey] = useState<string>(KNOWN_RULE_KEYS[0]);
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [snapshotContent, setSnapshotContent] = useState("");
  const [snapshotNotes, setSnapshotNotes] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("angel_prompt_versions")
      .select("*")
      .eq("rule_key", ruleKey)
      .order("version_number", { ascending: false })
      .limit(50);
    setLoading(false);
    if (error) {
      toast.error("Không tải được versions: " + error.message);
      return;
    }
    setVersions((data ?? []) as PromptVersion[]);
  }, [ruleKey]);

  const loadCurrentOverride = useCallback(async () => {
    const { data, error } = await supabase
      .from("angel_persona_settings")
      .select("rule_overrides")
      .eq("singleton", true)
      .maybeSingle();
    if (error) return;
    const overrides = (data?.rule_overrides ?? {}) as Record<string, string>;
    if (overrides[ruleKey]) setSnapshotContent(overrides[ruleKey]);
  }, [ruleKey]);

  useEffect(() => {
    void load();
    void loadCurrentOverride();
  }, [load, loadCurrentOverride]);

  const published = useMemo(() => versions.find((v) => v.is_published) ?? null, [versions]);

  const handleSnapshot = async () => {
    if (!snapshotContent.trim()) {
      toast.error("Nội dung snapshot không được rỗng");
      return;
    }
    const { data: session } = await supabase.auth.getSession();
    const uid = session.session?.user?.id ?? null;

    const { data: maxRow } = await supabase
      .from("angel_prompt_versions")
      .select("version_number")
      .eq("rule_key", ruleKey)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextVersion = ((maxRow?.version_number as number) ?? 0) + 1;

    const { error } = await supabase.from("angel_prompt_versions").insert({
      rule_key: ruleKey,
      version_number: nextVersion,
      content: snapshotContent,
      notes: snapshotNotes || null,
      created_by: uid,
    });
    if (error) {
      toast.error("Snapshot thất bại: " + error.message);
      return;
    }
    toast.success(`Đã snapshot v${nextVersion} cho ${ruleKey}`);
    setSnapshotNotes("");
    void load();
  };

  const handlePublish = async (v: PromptVersion) => {
    setBusyId(v.id);
    try {
      // 1. Bỏ published cũ.
      await supabase
        .from("angel_prompt_versions")
        .update({ is_published: false, published_at: null })
        .eq("rule_key", ruleKey)
        .eq("is_published", true);

      // 2. Publish version mục tiêu.
      const { error: e2 } = await supabase
        .from("angel_prompt_versions")
        .update({ is_published: true, published_at: new Date().toISOString() })
        .eq("id", v.id);
      if (e2) throw e2;

      // 3. Sync xuống rule_overrides để edge function pick up.
      const { data: settings } = await supabase
        .from("angel_persona_settings")
        .select("id, rule_overrides")
        .eq("singleton", true)
        .maybeSingle();
      const nextOverrides = { ...(settings?.rule_overrides ?? {}), [ruleKey]: v.content };
      if (settings?.id) {
        await supabase
          .from("angel_persona_settings")
          .update({ rule_overrides: nextOverrides, updated_at: new Date().toISOString() })
          .eq("id", settings.id as string);
      } else {
        await supabase
          .from("angel_persona_settings")
          .insert({ singleton: true, rule_overrides: nextOverrides });
      }

      toast.success(`Đã publish v${v.version_number} → runtime sẽ áp dụng trong ~60s`);
      void load();
    } catch (e) {
      toast.error("Publish thất bại: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-4 w-4" /> Prompt Versioning (Sprint 3)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <label className="text-sm text-muted-foreground w-32">Rule key</label>
            <select
              className="flex-1 rounded border bg-background px-2 py-1 text-sm"
              value={ruleKey}
              onChange={(e) => setRuleKey(e.target.value)}
            >
              {KNOWN_RULE_KEYS.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
            <Input
              className="md:w-64"
              placeholder="hoặc gõ rule_key tuỳ chỉnh"
              value={ruleKey}
              onChange={(e) => setRuleKey(e.target.value.trim())}
            />
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">Nội dung snapshot mới</div>
            <Textarea
              rows={8}
              value={snapshotContent}
              onChange={(e) => setSnapshotContent(e.target.value)}
              placeholder="Dán nội dung prompt/rule vào đây..."
            />
            <Input
              placeholder="Ghi chú (vd: giảm emoji xuống 2)"
              value={snapshotNotes}
              onChange={(e) => setSnapshotNotes(e.target.value)}
            />
            <Button onClick={handleSnapshot} size="sm">
              <Save className="h-4 w-4 mr-1" /> Snapshot version mới
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            Lịch sử {ruleKey}
            {published && (
              <Badge variant="secondary" className="ml-2">
                đang publish: v{published.version_number}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Đang tải...
            </div>
          ) : versions.length === 0 ? (
            <div className="text-sm text-muted-foreground">Chưa có version nào.</div>
          ) : (
            <div className="space-y-2">
              {versions.map((v) => (
                <div
                  key={v.id}
                  className={`rounded border p-3 text-sm ${v.is_published ? "border-primary" : ""}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={v.is_published ? "default" : "outline"}>
                        v{v.version_number}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(v.created_at).toLocaleString("vi-VN", {
                          timeZone: "Asia/Kuala_Lumpur",
                        })}
                      </span>
                    </div>
                    {!v.is_published && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === v.id}
                        onClick={() => handlePublish(v)}
                      >
                        {busyId === v.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <>
                            <Send className="h-3 w-3 mr-1" />
                            {published ? <><RotateCcw className="h-3 w-3 mr-1" />Rollback về đây</> : "Publish"}
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                  {v.notes && <div className="text-xs text-muted-foreground mb-1">{v.notes}</div>}
                  <pre className="whitespace-pre-wrap text-xs max-h-40 overflow-auto bg-muted/30 rounded p-2">
                    {v.content}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
