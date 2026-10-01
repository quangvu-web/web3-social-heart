/**
 * Angel Knowledge push adapter (Angel AI gốc — angel.fun.rich)
 *
 * Endpoint contract: https://angel.fun.rich/docs/knowledge-ingest-api
 *   POST https://ssjoetiitctqzapymtzl.supabase.co/functions/v1/knowledge-external-ingest
 *   Header: x-api-key: <khóa được chọn bởi getKey()>
 *
 * 3 action:
 *   - upsert (documents[])  → pushToAngelKnowledge()
 *   - delete (source, source_ref?) → deleteFromAngelKnowledge()
 *   - status (source, source_refs[]) → getAngelKnowledgeStatus()
 *
 * Idempotent theo (source, source_ref). Content không đổi (sha256) → không re-embed.
 * Rate limit: 60 req/phút / key. Nếu 429 → caller nên retry sau 60s.
 * Nếu chưa có secret → trả skipped=true, KHÔNG throw (row vẫn lưu để repush sau).
 */

import { logAiEvent } from "./angel/telemetry.ts";

const INGEST_URL =
  "https://ssjoetiitctqzapymtzl.supabase.co/functions/v1/knowledge-external-ingest";

function getKey(): string | null {
  return (
    // Thứ tự ưu tiên áp dụng cho mọi caller của adapter, không phân theo source.
    // Chỉ dùng khóa cũ khi khóa ưu tiên chưa cấu hình; không đổi khóa khi HTTP lỗi.
    Deno.env.get("ANGEL_KNOWLEDGE_INGEST_KEY_FUNRICHBOT") ||
    Deno.env.get("ANGEL_KNOWLEDGE_INGEST_KEY") ||
    Deno.env.get("ANGEL_AI_API_KEY") || // fallback tương thích ngược 1 nhịp
    null
  );
}

export type AngelDoc = {
  source: string;           // vd: "telegram_channel", "fun_profile"
  source_ref: string;       // id ổn định để upsert
  title: string;            // ≤ 300 ký tự
  content: string;          // thuần text, ≤ 200 000 ký tự
  url?: string;
  language?: string;        // mặc định "vi"
  folder?: string;
  metadata?: Record<string, unknown>;
};

export type AngelKnowledgeResult = {
  ok: boolean;
  reference?: string;
  error?: string;
  skipped?: boolean;
  status?: number;
  code?: string;
  /** Angel gốc báo doc đã tồn tại/không đổi — coi là thành công, không phải lỗi. */
  duplicate?: boolean;
  /** Chi tiết per-doc từ Angel gốc (dedup/persisted/…) để caller log/hiển thị. */
  itemStatuses?: Array<{ source_ref?: string; status?: string; error?: string }>;
};

type AngelKnowledgeUpsertResponse = {
  ok?: boolean;
  processed?: number;
  results?: Array<{
    source?: string;
    source_ref?: string;
    status?: string;
    error?: string;
    id?: string;
    reference?: string;
    document_id?: string;
  }>;
  id?: string;
  reference?: string;
  document_id?: string;
};

// Giữ tên cũ + shape cũ để caller không phải đổi ngay.
export type AngelKnowledgePayload = {
  source: string;
  external_id: string;      // deprecated — sẽ map sang source_ref
  content: string;
  metadata?: Record<string, unknown>;
  // optional bổ sung (khuyến nghị caller mới truyền vào):
  title?: string;
  url?: string;
  language?: string;
  folder?: string;
};

function normalizeTitle(raw: string | undefined, fallbackContent: string): string {
  const source = (raw || "").trim() || fallbackContent.trim().split(/\r?\n/)[0] || "";
  const clean = source.replace(/\s+/g, " ").trim() || "(untitled)";
  return clean.length > 300 ? clean.slice(0, 297) + "…" : clean;
}

function normalizeSourceUrl(raw: string | undefined, source: string, sourceRef: string): string {
  const clean = (raw || "").trim();
  if (clean) return clean;
  // Angel AI gốc hiện đang có constraint `knowledge_documents.file_url NOT NULL`.
  // Vì vậy các document text-only từ FUN Profile vẫn phải gửi một URL nguồn ổn định,
  // nếu không ingest endpoint trả HTTP 200 nhưng từng item status=error và không persist.
  const safeSource = encodeURIComponent(source || "fun_profile");
  const safeRef = encodeURIComponent(sourceRef || crypto.randomUUID());
  return `https://angelquangvu-funprofile.lovable.app/knowledge-source/${safeSource}/${safeRef}`;
}

async function postAction<T = unknown>(
  body: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; data: T | null; text: string }> {
  const key = getKey();
  if (!key) {
    return { ok: false, status: 0, data: null, text: "no_key" };
  }
  const res = await fetch(INGEST_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text().catch(() => "");
  let data: T | null = null;
  try {
    data = text ? (JSON.parse(text) as T) : null;
  } catch {
    data = null;
  }
  return { ok: res.ok, status: res.status, data, text };
}

/**
 * Upsert 1 hoặc nhiều document vào Angel AI knowledge base.
 * Chấp nhận cả shape cũ (external_id/content) và shape mới (AngelDoc).
 */
export async function pushToAngelKnowledge(
  input: AngelKnowledgePayload | AngelDoc | Array<AngelKnowledgePayload | AngelDoc>,
  options: { chunk_now?: boolean; verify?: boolean } = {},
): Promise<AngelKnowledgeResult> {
  if (!getKey()) {
    console.log("[angel-knowledge] Chưa cấu hình ingest credential — skip push");
    return { ok: false, skipped: true, error: "Angel knowledge ingest key not configured" };
  }

  const list = Array.isArray(input) ? input : [input];
  if (list.length === 0) return { ok: false, error: "empty documents" };
  if (list.length > 200) {
    return { ok: false, error: "content_too_large: max 200 documents/request" };
  }

  const documents: AngelDoc[] = list.map((raw) => {
    const anyRaw = raw as AngelKnowledgePayload & AngelDoc;
    const source_ref = anyRaw.source_ref || anyRaw.external_id;
    const content = anyRaw.content || "";
    const source = anyRaw.source;
    return {
      source,
      source_ref,
      title: normalizeTitle(anyRaw.title, content),
      content,
      url: normalizeSourceUrl(anyRaw.url, source, source_ref),
      language: anyRaw.language || "vi",
      folder: anyRaw.folder,
      metadata: anyRaw.metadata,
    };
  });

  // Guard content size (200k ký tự / doc)
  for (const d of documents) {
    if (!d.source || !d.source_ref || !d.content) {
      return { ok: false, code: "invalid_payload", error: "missing source/source_ref/content" };
    }
    if (d.content.length > 200_000) {
      return { ok: false, code: "content_too_large", error: `doc ${d.source_ref}: >200000 chars` };
    }
  }

  const chunkNow = options.chunk_now ?? false;
  const totalChars = documents.reduce((s, d) => s + d.content.length, 0);
  console.log(
    `[angel-knowledge] POST upsert docs=${documents.length} chars=${totalChars} chunk_now=${chunkNow} refs=${documents
      .map((d) => `${d.source}:${d.source_ref}`)
      .join(",")
      .slice(0, 300)}`,
  );

  const t0 = Date.now();
  const { ok, status, data, text } = await postAction<AngelKnowledgeUpsertResponse>({
    action: "upsert",
    chunk_now: chunkNow,
    documents,
  });
  const duration_ms = Date.now() - t0;

  console.log(
    `[angel-knowledge] response status=${status} ok=${ok} body=${text.slice(0, 300)}`,
  );

  // Telemetry: log ingest attempt (fire-and-forget).
  logAiEvent({
    channel: "worker",
    intent: "knowledge.push",
    tier: "primary",
    duration_ms,
    ok,
    error: ok ? null : `HTTP ${status}`,
    meta: {
      docs: documents.length,
      chars: totalChars,
      status,
      sources: Array.from(new Set(documents.map((d) => d.source))).slice(0, 5),
    },
  });

  if (!ok) {
    const code = (data && typeof data === "object" && (data as { code?: string }).code) || undefined;
    return {
      ok: false,
      status,
      code,
      error: `HTTP ${status}${code ? ` (${code})` : ""}: ${text.slice(0, 300)}`,
    };
  }

  // Các status coi là THÀNH CÔNG (không phải lỗi):
  //   persisted / stored / created / updated  → doc đã lưu mới
  //   duplicate / duplicated / already_exists / unchanged / skipped / no_change / noop
  //     → nội dung đã tồn tại (cùng sha256) — Angel gốc bỏ qua để tiết kiệm embed,
  //       vẫn tính là ingest OK.
  const SUCCESS_STATUSES = new Set([
    "ok", "success", "persisted", "stored", "created", "updated",
    "duplicate", "duplicated", "already_exists", "already-exists",
    "unchanged", "no_change", "no-change", "noop", "skipped",
  ]);
  const items: Array<Record<string, unknown>> = Array.isArray(data?.results) ? (data!.results as any) : [];
  const itemStatuses = items.map((r) => ({
    source_ref: (r?.source_ref as string) || (r?.sourceRef as string) || undefined,
    status: (r?.status as string) || undefined,
    error: (r?.error as string) || undefined,
  }));
  const duplicateCount = itemStatuses.filter((r) =>
    ["duplicate", "duplicated", "already_exists", "already-exists", "unchanged", "no_change", "no-change", "noop"].includes((r.status || "").toLowerCase())
  ).length;
  const resultErrors = itemStatuses.filter((r) => {
    const s = (r.status || "").toLowerCase();
    if (SUCCESS_STATUSES.has(s)) return false;
    return s === "error" || s === "failed" || !!r.error;
  });
  if (resultErrors.length > 0) {
    const sample = resultErrors
      .slice(0, 5)
      .map((r) => `${r.source_ref || "unknown"}: ${r.error || r.status || "error"}`)
      .join(" | ");
    return {
      ok: false,
      status,
      code: "remote_item_error",
      error: `Angel AI gốc nhận request nhưng từ chối ${resultErrors.length}/${documents.length} document: ${sample}`,
      itemStatuses,
    };
  }
  if (duplicateCount > 0) {
    console.log(`[angel-knowledge] duplicate/unchanged: ${duplicateCount}/${documents.length} doc(s) đã có sẵn, không cần re-embed`);
  }

  const reference =
    (data && typeof data === "object" &&
      (data.id ||
        data.reference ||
        data.document_id ||
        data.results?.find((r) => r.id || r.reference || r.document_id)?.id ||
        data.results?.find((r) => r.id || r.reference || r.document_id)?.reference ||
        data.results?.find((r) => r.id || r.reference || r.document_id)?.document_id)) ||
    undefined;

  // Verify persistence bằng action=status. HTTP 2xx từ upsert KHÔNG đảm bảo
  // Angel AI gốc đã lưu — đã có bằng chứng "pushed" false-positive
  // (status trả về items=[] cho các ref đã HTTP 200). Với verify=true, ép
  // check thêm để đánh dấu thất bại thật khi server không persist.
  if (options.verify) {
    const bySource = new Map<string, string[]>();
    for (const d of documents) {
      const arr = bySource.get(d.source) ?? [];
      arr.push(d.source_ref);
      bySource.set(d.source, arr);
    }
    const missing: string[] = [];
    let verifyOk = true;
    let verifyErr: string | undefined;
    for (const [src, refs] of bySource) {
      const st = await getAngelKnowledgeStatus(src, refs);
      if (!st.ok) {
        verifyOk = false;
        verifyErr = `verify_status_failed: ${st.error || "unknown"}`;
        break;
      }
      const items = (st.items || []) as Array<Record<string, unknown>>;
      const seen = new Set(
        items
          .map((it) => (it?.source_ref ?? it?.sourceRef ?? "") as string)
          .filter(Boolean),
      );
      for (const r of refs) if (!seen.has(r)) missing.push(`${src}:${r}`);
    }
    if (!verifyOk) {
      console.log(`[angel-knowledge] verify failed: ${verifyErr}`);
      return { ok: false, status, error: verifyErr };
    }
    if (missing.length > 0) {
      const err = `not_persisted: server accepted upsert (HTTP ${status}) but status returned no items for ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? ` (+${missing.length - 5} more)` : ""}`;
      console.log(`[angel-knowledge] ${err}`);
      return { ok: false, status, code: "not_persisted", error: err };
    }
    console.log(`[angel-knowledge] verify OK — ${documents.length} doc(s) persisted`);
  }

  return {
    ok: true,
    status,
    reference: reference ? String(reference) : undefined,
    duplicate: duplicateCount > 0 && duplicateCount === documents.length,
    itemStatuses,
  };
}

/** Xoá 1 doc theo source_ref, hoặc bỏ source_ref để xoá toàn bộ nguồn. */
export async function deleteFromAngelKnowledge(
  source: string,
  source_ref?: string,
): Promise<AngelKnowledgeResult> {
  if (!getKey()) {
    return { ok: false, skipped: true, error: "Angel knowledge ingest key not configured" };
  }
  const body: Record<string, unknown> = { action: "delete", source };
  if (source_ref) body.source_ref = source_ref;
  const { ok, status, text } = await postAction(body);
  return ok ? { ok: true, status } : { ok: false, status, error: `HTTP ${status}: ${text.slice(0, 300)}` };
}

/** Tra cứu ingest_status của nhiều source_refs. */
export async function getAngelKnowledgeStatus(
  source: string,
  source_refs: string[],
): Promise<{ ok: boolean; items?: unknown[]; error?: string; skipped?: boolean }> {
  if (!getKey()) {
    return { ok: false, skipped: true, error: "Angel knowledge ingest key not configured" };
  }
  const { ok, status, data, text } = await postAction<{ items?: unknown[] }>({
    action: "status",
    source,
    source_refs,
  });
  if (!ok) return { ok: false, error: `HTTP ${status}: ${text.slice(0, 300)}` };
  return { ok: true, items: data?.items || [] };
}
