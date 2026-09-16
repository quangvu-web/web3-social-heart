// _shared/angel-knowledge-search.ts
// Client cho Angel gốc POST /knowledge-search.
// Trả về top-k đoạn tri thức khớp query. Dùng cho tra cứu nhanh không tốn quota chat.

const DEFAULT_BASE = "https://ssjoetiitctqzapymtzl.supabase.co/functions/v1";

export type KnowledgeMatch = {
  content: string;
  score?: number;
  metadata?: Record<string, unknown>;
  source?: string | null;
};

export type KnowledgeSearchResult = {
  ok: boolean;
  matches: KnowledgeMatch[];
  raw?: unknown;
};

function getBase(): string {
  const raw = Deno.env.get("ANGEL_ROOT_BASE_URL")
    || Deno.env.get("ANGEL_AI_BASE_URL")
    || "";
  if (raw) return raw.replace(/\/$/, "");
  const chatUrl = Deno.env.get("ANGEL_AI_CHAT_URL");
  if (chatUrl) return chatUrl.replace(/\/angel-(?:chat|router)\/?$/i, "").replace(/\/$/, "");
  return DEFAULT_BASE;
}

function getApiKey(): string {
  return Deno.env.get("ANGEL_AI_API_KEY")
    || Deno.env.get("ANGEL_ROOT_API_KEY")
    || "";
}

export async function searchAngelKnowledge(
  query: string,
  topK = 5,
): Promise<KnowledgeSearchResult> {
  const key = getApiKey();
  if (!key) return { ok: false, matches: [] };
  if (!query?.trim()) return { ok: false, matches: [] };

  const url = `${getBase()}/knowledge-search`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "x-api-key": key,
      },
      body: JSON.stringify({ query: query.trim(), top_k: topK }),
    });
    const rawText = await res.text();
    let data: any = null;
    try { data = rawText ? JSON.parse(rawText) : null; } catch { /* ignore */ }
    if (!res.ok) {
      console.warn(`[angel-knowledge-search] status=${res.status} body=${rawText.slice(0, 200)}`);
      return { ok: false, matches: [], raw: data ?? rawText.slice(0, 400) };
    }
    const arr = Array.isArray(data?.matches) ? data.matches
      : Array.isArray(data?.results) ? data.results
      : Array.isArray(data) ? data : [];
    const matches: KnowledgeMatch[] = arr.map((m: any) => ({
      content: String(m?.content ?? m?.text ?? m?.chunk ?? "").trim(),
      score: typeof m?.score === "number" ? m.score
        : typeof m?.similarity === "number" ? m.similarity : undefined,
      metadata: m?.metadata ?? undefined,
      source: m?.source ?? m?.url ?? null,
    })).filter((m: KnowledgeMatch) => m.content);
    return { ok: true, matches, raw: data };
  } catch (e) {
    console.warn(`[angel-knowledge-search] fetch failed: ${(e as Error).message}`);
    return { ok: false, matches: [] };
  }
}
