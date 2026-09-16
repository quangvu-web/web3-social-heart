// _shared/angel/persona/versions.ts
// Sprint 3 — Helper đọc/ghi bảng `angel_prompt_versions`.
//
// Mục tiêu: cho phép Admin UI snapshot, list, publish, rollback từng rule_key
// mà KHÔNG can thiệp trực tiếp vào runtime. Runtime vẫn đọc từ
// `angel_persona_settings.rule_overrides` như cũ; publish() sẽ copy content
// của version xuống overrides + đánh dấu is_published.
//
// Dùng service role client (chỉ gọi trong edge function admin, không expose
// ra frontend). Frontend gọi qua Admin UI với anon key + RLS admin policy.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

export interface PromptVersion {
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

export function serviceClient(): SupabaseClient | null {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function listVersions(
  client: SupabaseClient,
  ruleKey: string,
  limit = 20,
): Promise<PromptVersion[]> {
  const { data, error } = await client
    .from("angel_prompt_versions")
    .select("*")
    .eq("rule_key", ruleKey)
    .order("version_number", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as PromptVersion[];
}

export async function getPublishedVersion(
  client: SupabaseClient,
  ruleKey: string,
): Promise<PromptVersion | null> {
  const { data, error } = await client
    .from("angel_prompt_versions")
    .select("*")
    .eq("rule_key", ruleKey)
    .eq("is_published", true)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as PromptVersion | null;
}

/**
 * Tạo version mới cho rule_key. version_number auto = max + 1.
 * Không tự publish — Admin cần bấm publish riêng.
 */
export async function snapshotVersion(
  client: SupabaseClient,
  input: {
    ruleKey: string;
    content: string;
    notes?: string | null;
    createdBy?: string | null;
  },
): Promise<PromptVersion> {
  const { data: maxRow } = await client
    .from("angel_prompt_versions")
    .select("version_number")
    .eq("rule_key", input.ruleKey)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const next = ((maxRow?.version_number as number) ?? 0) + 1;

  const { data, error } = await client
    .from("angel_prompt_versions")
    .insert({
      rule_key: input.ruleKey,
      version_number: next,
      content: input.content,
      notes: input.notes ?? null,
      created_by: input.createdBy ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as PromptVersion;
}

/**
 * Publish một version: gỡ cờ published của các version khác cùng rule_key,
 * gắn cờ cho version mục tiêu. KHÔNG tự động sync xuống rule_overrides —
 * caller (Admin UI) chịu trách nhiệm copy content xuống để runtime pick up.
 */
export async function publishVersion(
  client: SupabaseClient,
  versionId: string,
): Promise<PromptVersion> {
  const { data: target, error: e1 } = await client
    .from("angel_prompt_versions")
    .select("*")
    .eq("id", versionId)
    .single();
  if (e1) throw e1;
  const t = target as PromptVersion;

  await client
    .from("angel_prompt_versions")
    .update({ is_published: false, published_at: null })
    .eq("rule_key", t.rule_key)
    .eq("is_published", true);

  const { data, error } = await client
    .from("angel_prompt_versions")
    .update({ is_published: true, published_at: new Date().toISOString() })
    .eq("id", versionId)
    .select("*")
    .single();
  if (error) throw error;
  return data as PromptVersion;
}

/**
 * Rollback = publish lại version cũ hơn. Chỉ là alias để rõ ý.
 */
export async function rollbackToVersion(
  client: SupabaseClient,
  versionId: string,
): Promise<PromptVersion> {
  return publishVersion(client, versionId);
}
