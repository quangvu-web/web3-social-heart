/**
 * Angel Knowledge push adapter (Angel AI gốc — angel.fun.rich)
 *
 * Endpoint contract: https://angel.fun.rich/docs/knowledge-ingest-api
 *   POST https://ssjoetiitctqzapymtzl.supabase.co/functions/v1/knowledge-external-ingest
 *   Header: x-api-key: <ANGEL_KNOWLEDGE_INGEST_KEY>
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
  return Deno.env.get("ANGEL_KNOWLEDGE_INGEST_KEY") || null;
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
  sentCount?: number;
  persistedCount?: number;
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
): Promise<{ ok: boolean; status: number; data: T | null; code?: string }> {
  const key = getKey();
  if (!key) {
    return { ok: false, status: 0, data: null, code: "ANGEL_KNOWLEDGE_SECRET_MISSING" };
  }
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 15_000);
  try {
    const res = await fetch(INGEST_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    let text: string;
    try {
      text = await res.text();
    } catch {
      return {
        ok: false,
        status: 0,
        data: null,
        code: timedOut ? "ANGEL_KNOWLEDGE_TIMEOUT" : "ANGEL_KNOWLEDGE_NETWORK_ERROR",
      };
    }
    if (timedOut) {
      return { ok: false, status: 0, data: null, code: "ANGEL_KNOWLEDGE_TIMEOUT" };
    }
    let data: T | null = null;
    try {
      data = text ? (JSON.parse(text) as T) : null;
    } catch {
      data = null;
    }
    return res.ok
      ? { ok: true, status: res.status, data }
      : { ok: false, status: res.status, data, code: "ANGEL_KNOWLEDGE_HTTP_ERROR" };
  } catch {
    return {
      ok: false,
      status: 0,
      data: null,
      code: timedOut ? "ANGEL_KNOWLEDGE_TIMEOUT" : "ANGEL_KNOWLEDGE_NETWORK_ERROR",
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Upsert 1 hoặc nhiều document vào Angel AI knowledge base.
 * Chấp nhận cả shape cũ (external_id/content) và shape mới (AngelDoc).
 */
export async function pushToAngelKnowledge(
  input: AngelKnowledgePayload | AngelDoc | Array<AngelKnowledgePayload | AngelDoc>,
  options: { chunk_now?: boolean; verify?: boolean } = {},
): Promise<AngelKnowledgeResult> {
  const verifyPersistence = options.verify ?? true;
  if (!getKey()) {
    return {
      ok: false,
      skipped: true,
      code: "ANGEL_KNOWLEDGE_SECRET_MISSING",
      error: "Chưa cấu hình secret kết nối Angel AI gốc.",
    };
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
  console.log(`[angel-knowledge] POST upsert docs=${documents.length} chars=${totalChars} chunk_now=${chunkNow}`);

  const t0 = Date.now();
  const { ok, status, data, code: transportCode } = await postAction<AngelKnowledgeUpsertResponse>({
    action: "upsert",
    chunk_now: chunkNow,
    documents,
  });
  const duration_ms = Date.now() - t0;

  console.log(`[angel-knowledge] response status=${status} ok=${ok}`);

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
    return {
      ok: false,
      status: status || undefined,
      code: transportCode || "ANGEL_KNOWLEDGE_HTTP_ERROR",
      error: transportCode === "ANGEL_KNOWLEDGE_TIMEOUT"
        ? "Kết nối Angel AI gốc quá thời gian chờ. Có thể thử lại."
        : transportCode === "ANGEL_KNOWLEDGE_NETWORK_ERROR"
        ? "Không thể kết nối tới Angel AI gốc do lỗi mạng. Có thể thử lại."
        : `Angel AI gốc từ chối yêu cầu (HTTP ${status}).`,
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
    return {
      ok: false,
      status,
      code: "ANGEL_KNOWLEDGE_DOCUMENT_REJECTED",
      error: `Angel AI gốc nhận ${documents.length} document nhưng từ chối ${resultErrors.length}.`,
      itemStatuses: itemStatuses.map(({ source_ref, status: itemStatus }) => ({ source_ref, status: itemStatus })),
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
  if (verifyPersistence) {
    const bySource = new Map<string, string[]>();
    for (const d of documents) {
      const arr = bySource.get(d.source) ?? [];
      arr.push(d.source_ref);
      bySource.set(d.source, arr);
    }
    const missing: string[] = [];
    let verifyOk = true;
    let verifyErr = "";
    let verifyCode = "ANGEL_KNOWLEDGE_VERIFY_FAILED";
    for (const [src, refs] of bySource) {
      const st = await getAngelKnowledgeStatus(src, refs);
      if (!st.ok) {
        verifyOk = false;
        verifyErr = st.error || "Không xác minh được trạng thái lưu trên Angel AI gốc.";
        verifyCode = st.code || "ANGEL_KNOWLEDGE_VERIFY_FAILED";
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
      console.log(`[angel-knowledge] verify failed code=${verifyCode}`);
      return {
        ok: false,
        status,
        code: verifyCode,
        error: verifyErr,
        sentCount: documents.length,
        persistedCount: 0,
      };
    }
    if (missing.length > 0) {
      console.log(`[angel-knowledge] persistence verify missing docs=${missing.length}`);
      return {
        ok: false,
        status,
        code: "ANGEL_KNOWLEDGE_NOT_PERSISTED",
        error: `Angel AI gốc nhận HTTP ${status} nhưng chưa xác nhận lưu ${missing.length}/${documents.length} document.`,
        sentCount: documents.length,
        persistedCount: documents.length - missing.length,
      };
    }
    console.log(`[angel-knowledge] verify OK — ${documents.length} doc(s) persisted`);
  }

  return {
    ok: true,
    status,
    reference: reference ? String(reference) : undefined,
    duplicate: duplicateCount > 0 && duplicateCount === documents.length,
    itemStatuses,
    sentCount: documents.length,
    persistedCount: verifyPersistence ? documents.length : undefined,
  };
}

/** Xoá 1 doc theo source_ref, hoặc bỏ source_ref để xoá toàn bộ nguồn. */
export async function deleteFromAngelKnowledge(
  source: string,
  source_ref?: string,
): Promise<AngelKnowledgeResult> {
  if (!getKey()) {
    return { ok: false, skipped: true, error: "ANGEL_KNOWLEDGE_INGEST_KEY not configured" };
  }
  const body: Record<string, unknown> = { action: "delete", source };
  if (source_ref) body.source_ref = source_ref;
  const { ok, status, code } = await postAction(body);
  return ok
    ? { ok: true, status }
    : { ok: false, status: status || undefined, code, error: safeTransportError(code, status) };
}

/** Tra cứu ingest_status của nhiều source_refs. */
export async function getAngelKnowledgeStatus(
  source: string,
  source_refs: string[],
): Promise<{ ok: boolean; items?: unknown[]; error?: string; skipped?: boolean; status?: number; code?: string }> {
  if (!getKey()) {
    return { ok: false, skipped: true, code: "ANGEL_KNOWLEDGE_SECRET_MISSING", error: "Chưa cấu hình secret kết nối Angel AI gốc." };
  }
  const { ok, status, data, code } = await postAction<{ items?: unknown[] }>({
    action: "status",
    source,
    source_refs,
  });
  if (!ok) return { ok: false, status: status || undefined, code, error: safeTransportError(code, status) };
  if (!Array.isArray(data?.items)) {
    return { ok: false, status, code: "ANGEL_KNOWLEDGE_INVALID_RESPONSE", error: "Angel AI gốc trả phản hồi không đúng định dạng." };
  }
  return { ok: true, status, items: data.items };
}

function safeTransportError(code: string | undefined, status: number): string {
  if (code === "ANGEL_KNOWLEDGE_SECRET_MISSING") return "Chưa cấu hình secret kết nối Angel AI gốc.";
  if (code === "ANGEL_KNOWLEDGE_TIMEOUT") return "Kết nối Angel AI gốc quá thời gian chờ.";
  if (code === "ANGEL_KNOWLEDGE_NETWORK_ERROR") return "Không thể kết nối tới Angel AI gốc do lỗi mạng.";
  if (code === "ANGEL_KNOWLEDGE_INVALID_RESPONSE") return "Angel AI gốc trả phản hồi không đúng định dạng.";
  return `Angel AI gốc từ chối yêu cầu (HTTP ${status}).`;
}

/** Read-only connection check against a synthetic reference. Never upserts or deletes data. */
export async function testAngelKnowledgeConnection(): Promise<{
  ok: boolean;
  code?: string;
  status?: number;
  error?: string;
}> {
  const result = await getAngelKnowledgeStatus("telegram_channel", ["__connection_check__"]);
  if (!result.ok) {
    return { ok: false, code: result.code, status: result.status, error: result.error };
  }
  return { ok: true, status: result.status };
}
