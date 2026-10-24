import { buildFunKingdom8MantrasReply } from "./angel-mantras.ts";
import { getFlag } from "./angel/flags.ts";

// Heuristic: câu chào / cảm ơn / joke ngắn không cần RAG → tiết kiệm quota Angel gốc.
const SMALLTALK_RE = /^(?:\s*(?:hi|hello|hey|xin\s*chào|chào|chao|hế\s*lô|helo|cảm\s*ơn|cam\s*on|thanks?|thank\s*you|ok|okie|okey|yes|no|dạ|vâng|ừ|um|hihi|haha|hehe|😀|😄|🥰|❤️)\s*[!?.,\s]*)+$/iu;
const JOKE_RE = /\b(?:kể\s*(?:cho|1|một)?\s*(?:câu\s*)?chuyện\s*cười|joke|hài|vui\s*(?:tí|xíu)|cười\s*(?:1|một)\s*cái)\b/iu;

function isSmalltalkOrJoke(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (t.length <= 40 && SMALLTALK_RE.test(t)) return true;
  if (JOKE_RE.test(t) && t.length <= 120) return true;
  return false;
}


/**
 * Angel Core AI adapter
 *
 * Tầng "công tắc" cho phép FUN.RICH chọn nhà cung cấp AI cho Angel:
 *   - provider = "lovable" (mặc định) → ai.gateway.lovable.dev (LOVABLE_API_KEY)
 *   - provider = "funcore"           → FUN Core API (ANGEL_AI_API_KEY) của Cha
 *
 * Tất cả edge function gọi chat-completion CHỈ NÊN dùng `callAngelCore`
 * thay vì fetch trực tiếp Lovable AI Gateway.
 *
 * Env:
 *   ANGEL_AI_PROVIDER   "lovable" | "funcore"   (default: "lovable")
 *   ANGEL_AI_BASE_URL   Base URL FUN Core (mặc định "https://angel.fun.rich")
 *   ANGEL_AI_API_KEY    Secret key của Cha (cho provider=funcore)
 *   LOVABLE_API_KEY     Key Lovable AI Gateway (cho provider=lovable)
 *
 * Bước 2 (khi Cha gửi docs): cập nhật block `callFunCore` cho khớp
 * schema thật của FUN Core API.
 */

export class AngelCoreError extends Error {
  status: number;
  details?: unknown;
  /** Quota Angel gốc trả về (nếu có) khi 429/402. */
  currentUsage?: number;
  dailyLimit?: number;
  constructor(message: string, status = 500, details?: unknown) {
    super(message);
    this.name = "AngelCoreError";
    this.status = status;
    this.details = details;
    if (details && typeof details === "object") {
      const d = details as Record<string, unknown>;
      if (typeof d.current_usage === "number") this.currentUsage = d.current_usage as number;
      if (typeof d.daily_limit === "number") this.dailyLimit = d.daily_limit as number;
    }
  }
}

export type AngelMessage = { role: "system" | "user" | "assistant"; content: string };

/**
 * Attachment forwarded tới Angel gốc (`/angel-router`). Router hỗ trợ ảnh: có thể là
 * URL public hoặc base64. Router tự phân loại `image_analyze` khi có attachment.
 */
export type AngelAttachment = {
  kind: "image";
  url?: string;
  base64?: string;
  mime_type?: string;
};

export type CallAngelParams = {
  messages: AngelMessage[];
  /** Ảnh/file gửi kèm cho router bên Angel gốc tự phân tích. */
  attachments?: AngelAttachment[];
  /** Provider-agnostic logical model. Mỗi provider tự map. */
  model?: string;
  max_tokens?: number;
  /** Khi cần JSON object trả về (vd aiClassify). */
  json?: boolean;
  /** Bỏ qua env ANGEL_AI_PROVIDER, dùng provider chỉ định. */
  forceProvider?: "lovable" | "funcore";
  /** Optional sampling temperature — forward cho cả Lovable & FUN Core (bỏ qua nếu provider không hỗ trợ). */
  temperature?: number;
  /**
   * Bật RAG (knowledge base) bên Angel gốc. Mặc định `true` — khớp behavior
   * angel.fun.rich/chat. Set `false` cho chat thuần (jokes, small talk).
   */
  useKnowledge?: boolean;
  /**
   * STRICT MIRROR: chỉ forward duy nhất 1 message `{role:"user", content: lastUser}`
   * — y hệt angel.fun.rich/chat. Bỏ hết history/system/prefix để RAG hit chuẩn.
   * Mặc định đọc từ flag `router.strict_mirror` (default true) khi undefined.
   */
  strictMirror?: boolean;
  /** Verified per-group language policy; survives mirror filtering without rewriting the RAG question. */
  trustedGroupLanguagePolicy?: string | null;
  /** Override timeout (ms) cho request FUN Core. Mặc định 25s cho chat, caller có thể set 45s cho meditation/YouTube. */
  timeoutMs?: number;
  /**
   * Client-side sensitivity hint forward tới Angel gốc (`answer_mode`).
   * - `internal_only`: chỉ trả lời khi có RAG match (không fallback LLM).
   * - `open`: cho phép fallback LLM kiến thức phổ thông khi miss RAG.
   * - `auto` (default): để Angel gốc tự quyết theo persona/policy của key.
   * Angel gốc chưa support field này thì bỏ qua an toàn.
   */
  answerMode?: "internal_only" | "open" | "auto";
};

export type CallAngelResult = {
  text: string;
  raw: unknown;
  provider: "lovable" | "funcore";
  /** Router có thể trả về ảnh (image_generate | image_analyze cần ảnh output). */
  image_url?: string | null;
  image_base64?: string | null;
  mime_type?: string | null;
  /** Router mode: chat | image_generate | image_analyze (best-effort). */
  mode?: string | null;
};

function getProvider(): "lovable" | "funcore" {
  // KHOÁ CỨNG: Angel AI luôn dùng FUN Core, BẤT KỂ biến môi trường ANGEL_AI_PROVIDER.
  // Lý do: tránh trường hợp env bị đặt nhầm/trùng làm bot trả lời 2 giọng khác nhau.
  // Cách duy nhất để đổi provider là truyền `forceProvider` qua code path admin-only
  // (vd: edge function `angel-debug` đã verify role 'admin' trong public.user_roles).
  // Nếu env cố ý set 'lovable' → log warning để admin biết và bỏ qua.
  const configured = Deno.env.get("ANGEL_AI_PROVIDER")?.toLowerCase();
  if (configured && configured !== "funcore") {
    console.warn(
      `[angel-core] ANGEL_AI_PROVIDER="${configured}" bị bỏ qua — provider khoá cứng = funcore. ` +
      `Dùng forceProvider qua edge function admin-only để chẩn đoán.`,
    );
  }
  return "funcore";
}

function defaultLovableModel(model?: string): string {
  return model || "google/gemini-3-flash-preview";
}

async function callLovable(p: CallAngelParams): Promise<CallAngelResult> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new AngelCoreError("LOVABLE_API_KEY is not configured", 500);

  const body: Record<string, unknown> = {
    model: defaultLovableModel(p.model),
    messages: p.messages,
  };
  if (p.max_tokens) body.max_tokens = p.max_tokens;
  if (typeof p.temperature === "number") body.temperature = p.temperature;
  if (p.json) body.response_format = { type: "json_object" };

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new AngelCoreError(
      res.status === 429 ? "Rate limited"
        : res.status === 402 ? "Payment required"
        : "AI gateway error",
      res.status,
      detail.slice(0, 400),
    );
  }
  const data = await res.json();
  const text = (data?.choices?.[0]?.message?.content ?? "").toString().trim();
  return { text, raw: data, provider: "lovable" };
}

/**
 * FUN Core ANGEL AI (API riêng của Cha — angel.fun.rich).
 *
 * ĐÚNG THEO TÀI LIỆU CHÍNH THỨC (2026):
 *   POST https://ssjoetiitctqzapymtzl.supabase.co/functions/v1/angel-chat
 *   Header: x-api-key: ANGEL_AI_API_KEY
 *   Body:   { messages, useKnowledge?: true, stream?: false }
 *   Response: { content|reply|text, ... }
 *
 * Ảnh dùng endpoint riêng /generate-image, /edit-image (xem angel-image.ts).
 * Router cũ `/angel-router` đã deprecate.
 */
const FUN_CORE_DEFAULT_URL =
  "https://ssjoetiitctqzapymtzl.supabase.co/functions/v1/angel-chat";

const LEGACY_ROUTER_RE = /\/functions\/v1\/angel-(?:router|ai-public)\/?$/i;

function normalizeEndpointUrl(url: string): string {
  return url.trim().replace(/\/$/, "");
}

function endpointLabel(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return "custom-endpoint";
  }
}

function toCanonicalChatEndpoint(url: string): string {
  return normalizeEndpointUrl(url).replace(
    /\/functions\/v1\/angel-(?:router|ai-public)\/?$/i,
    "/functions/v1/angel-chat",
  );
}



function textFromContent(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object") {
          const record = part as Record<string, unknown>;
          return textFromContent(record.text ?? record.content ?? "");
        }
        return "";
      })
      .join("");
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return textFromContent(record.text ?? record.content ?? "");
  }
  return "";
}

function extractFunCoreText(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const record = data as Record<string, unknown>;

  const choices = record.choices;
  if (Array.isArray(choices)) {
    const firstChoice = choices[0] as Record<string, unknown> | undefined;
    const message = firstChoice?.message as Record<string, unknown> | undefined;
    const choiceText = textFromContent(message?.content ?? firstChoice?.text ?? firstChoice?.content);
    if (choiceText.trim()) return choiceText.trim();
  }

  return textFromContent(
    record.content
      ?? record.reply
      ?? record.text
      ?? record.output_text
      ?? record.message,
  ).trim();
}

function parseFunCoreSSE(text: string): { data: unknown; assembledText: string } {
  // API của Cha đôi khi trả về SSE (text/event-stream) dù đã set stream:false.
  // Ghép các dòng `data: {...}` lại, extract delta.content / message.content / content.
  let assembled = "";
  let lastJson: Record<string, unknown> | null = null;
  const lines = text.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line.startsWith("data:")) continue;
    const payload = line.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;
    let obj: unknown;
    try { obj = JSON.parse(payload); } catch { continue; }
    if (obj && typeof obj === "object") {
      lastJson = obj as Record<string, unknown>;
      const rec = obj as Record<string, unknown>;
      const choices = rec.choices;
      if (Array.isArray(choices) && choices[0]) {
        const c = choices[0] as Record<string, unknown>;
        const delta = c.delta as Record<string, unknown> | undefined;
        const msg = c.message as Record<string, unknown> | undefined;
        const piece = textFromContent(delta?.content ?? msg?.content ?? c.text ?? c.content);
        if (piece) assembled += piece;
        continue;
      }
      const piece = textFromContent(rec.content ?? rec.delta ?? rec.text ?? rec.reply);
      if (piece) assembled += piece;
    }
  }
  return { data: lastJson ?? { sse: true }, assembledText: assembled.trim() };
}

/** Extract image fields (image_url / image_base64 / mime_type / mode) từ router response. */
function extractRouterImage(data: unknown): {
  image_url: string | null;
  image_base64: string | null;
  mime_type: string | null;
  mode: string | null;
} {
  const out = { image_url: null as string | null, image_base64: null as string | null, mime_type: null as string | null, mode: null as string | null };
  if (!data || typeof data !== "object") return out;
  const rec = data as Record<string, unknown>;

  const modeVal = rec.mode ?? rec.route ?? rec.intent ?? rec.classification ?? (rec as any)?.router?.mode;
  if (typeof modeVal === "string") out.mode = modeVal;

  // Candidate paths router có thể trả về
  const urlCandidates = [rec.image_url, (rec as any)?.image?.url, (rec as any)?.output?.image_url, (rec as any)?.data?.image_url];
  for (const c of urlCandidates) {
    if (typeof c === "string" && c.length > 0) { out.image_url = c; break; }
  }
  const b64Candidates = [rec.image_base64, (rec as any)?.image?.base64, (rec as any)?.output?.image_base64, (rec as any)?.data?.image_base64, (rec as any)?.b64_json];
  for (const c of b64Candidates) {
    if (typeof c === "string" && c.length > 0) { out.image_base64 = c; break; }
  }
  const mimeCandidates = [rec.mime_type, (rec as any)?.image?.mime_type, (rec as any)?.output?.mime_type];
  for (const c of mimeCandidates) {
    if (typeof c === "string" && c.length > 0) { out.mime_type = c; break; }
  }
  return out;
}

// ─── Reliability layer: timeout + retry-once + circuit breaker ────────────
// Sống trong isolate scope. Cold-start reset là chấp nhận được.
const FUN_CORE_TIMEOUT_MS = 25_000; // TẦNG A: giảm 45s → 25s cho chat DM/group. Caller có thể override qua p.timeoutMs.
type BreakerState = { failures: number; openedAt: number };
const breaker: BreakerState = { failures: 0, openedAt: 0 };
const BREAKER_THRESHOLD = 5;      // 5 lỗi liên tiếp
const BREAKER_WINDOW_MS = 60_000; // trong 60s
const BREAKER_COOLDOWN_MS = 30_000;

function breakerIsOpen(): boolean {
  if (breaker.openedAt === 0) return false;
  if (Date.now() - breaker.openedAt < BREAKER_COOLDOWN_MS) return true;
  // Cooldown xong → half-open
  breaker.openedAt = 0;
  breaker.failures = 0;
  return false;
}
function breakerRecordSuccess(): void {
  breaker.failures = 0;
  breaker.openedAt = 0;
}
function breakerRecordFailure(): void {
  breaker.failures += 1;
  if (breaker.failures >= BREAKER_THRESHOLD) {
    breaker.openedAt = Date.now();
    console.warn(`[angel-core] circuit breaker OPEN — cooldown ${BREAKER_COOLDOWN_MS}ms`);
  }
  // Auto-reset counter nếu lâu không có failure mới
  setTimeout(() => { if (breaker.failures > 0) breaker.failures = Math.max(0, breaker.failures - 1); }, BREAKER_WINDOW_MS);
}

/**
 * TẦNG C: cho phép caller (webhook) kiểm tra breaker state trước khi post ticker
 * "Angel đang nghĩ…". Khi breaker đang OPEN, callFunCore sẽ short-circuit và
 * trả 503 gần như tức thì → không cần ticker.
 */
export function isAngelBreakerOpen(): boolean {
  return breakerIsOpen();
}

async function fetchOnce(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  return await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
}

async function postFunCoreEndpoint(
  url: string,
  headers: Record<string, string>,
  body: Record<string, unknown>,
  timeoutMs: number = FUN_CORE_TIMEOUT_MS,
): Promise<CallAngelResult> {
  if (breakerIsOpen()) {
    throw new AngelCoreError(
      "Angel đang bảo trì, bé chờ chút nhé 💛",
      503,
      { breaker: "open", cooldown_ms: BREAKER_COOLDOWN_MS },
    );
  }

  const init: RequestInit = { method: "POST", headers, body: JSON.stringify(body) };
  let res: Response;
  try {
    res = await fetchOnce(url, init, timeoutMs);
    // Retry-once cho 5xx
    if (res.status >= 500 && res.status < 600) {
      console.warn(`[angel-core] ${endpointLabel(url)} → ${res.status}, retry-once`);
      await new Promise((r) => setTimeout(r, 500));
      res = await fetchOnce(url, init, timeoutMs);
    }
  } catch (e) {
    // Network / timeout → retry 1 lần
    const msg = (e as Error)?.message || "";
    console.warn(`[angel-core] ${endpointLabel(url)} network err: ${msg}, retry-once`);
    try {
      await new Promise((r) => setTimeout(r, 500));
      res = await fetchOnce(url, init, timeoutMs);
    } catch (e2) {
      breakerRecordFailure();
      throw new AngelCoreError(
        `FUN Core network error: ${(e2 as Error).message}`,
        504,
        { cause: msg },
      );
    }
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    // Angel gốc trả JSON chuẩn kèm current_usage / daily_limit khi 429/402.
    let parsed: Record<string, unknown> | null = null;
    try { parsed = detail ? JSON.parse(detail) as Record<string, unknown> : null; } catch { parsed = null; }
    const current = typeof parsed?.current_usage === "number" ? parsed.current_usage : undefined;
    const limit = typeof parsed?.daily_limit === "number" ? parsed.daily_limit : undefined;
    const providerMsg = typeof parsed?.error === "string" ? parsed.error
      : typeof parsed?.message === "string" ? parsed.message : null;
    const baseMsg = res.status === 429 ? "Rate limited (quota Angel gốc)"
      : res.status === 402 ? "Quota exceeded"
      : `FUN Core API error (${res.status})`;
    const quotaHint = (current != null && limit != null) ? ` [${current}/${limit} hôm nay]` : "";
    // 5xx sau retry → tính vào breaker. 4xx (quota, bad request) KHÔNG tính.
    if (res.status >= 500) breakerRecordFailure();
    throw new AngelCoreError(
      `${providerMsg ?? baseMsg}${quotaHint}`,
      res.status,
      { raw: detail.slice(0, 400), current_usage: current, daily_limit: limit },
    );
  }
  breakerRecordSuccess();


  const contentType = res.headers.get("content-type") || "";
  const rawText = await res.text();

  // Trường hợp server trả SSE (text/event-stream) hoặc body bắt đầu bằng "data:" dù content-type nói json.
  const looksLikeSSE = contentType.includes("event-stream") || /^\s*data:\s*/.test(rawText);
  if (looksLikeSSE) {
    const { data, assembledText } = parseFunCoreSSE(rawText);
    if (!assembledText) {
      throw new AngelCoreError(
        "FUN Core trả về SSE nhưng không extract được nội dung",
        502,
        rawText.slice(0, 400),
      );
    }
    const img = extractRouterImage(data);
    return { text: assembledText, raw: data, provider: "funcore", ...img };
  }

  let data: unknown;
  try {
    data = JSON.parse(rawText);
  } catch (e) {
    throw new AngelCoreError(
      `FUN Core response không phải JSON hợp lệ: ${(e as Error).message}`,
      502,
      rawText.slice(0, 400),
    );
  }
  const text = extractFunCoreText(data);
  const img = extractRouterImage(data);
  return { text, raw: data, provider: "funcore", ...img };
}

async function callFunCore(p: CallAngelParams): Promise<CallAngelResult> {
  // Moderation/classification calls need JSON-object compliance; angel-chat trả text
  // thuần theo persona Angel gốc, không phù hợp JSON strict → giữ trên Lovable Gateway.
  if (p.json) return await callLovable(p);

  // Endpoint chính thức: /angel-chat. Env override giữ backward-compat.
  const configuredChatUrl = Deno.env.get("ANGEL_AI_CHAT_URL") || "";
  const configuredRouterUrl = Deno.env.get("ANGEL_AI_ROUTER_URL") || "";
  const configuredBaseUrl = Deno.env.get("ANGEL_AI_BASE_URL") || "";
  const configuredUrl = configuredChatUrl || configuredRouterUrl || configuredBaseUrl || "";
  let url = normalizeEndpointUrl(configuredUrl || FUN_CORE_DEFAULT_URL);
  if (LEGACY_ROUTER_RE.test(url)) {
    console.warn(
      `[angel-core] legacy router endpoint detected in env (${endpointLabel(url)}); overriding to /angel-chat`,
    );
    url = toCanonicalChatEndpoint(url);
  }

  // MIRROR ANGEL WEB TUYỆT ĐỐI: chuyển nguyên messages, KHÔNG prepend/append system.
  // Angel gốc /angel-chat tự chèn persona + RAG + rules khi useKnowledge=true.
  const lastUser = [...p.messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const forwardMessages = p.messages.filter((m) => m.role === "user" || m.role === "assistant");

  // STRICT MIRROR (Sprint reliability fix): mặc định bật qua flag `router.strict_mirror`.
  // Khi bật, KHÔNG forward history/prefix — chỉ 1 message user cuối, y hệt web.
  // Đây là root-cause fix cho việc RAG bên Angel gốc miss doc do embedding query bị
  // pha loãng bởi history/memory/intent-prefix từ FUNPROFILE.
  let strictMirror = p.strictMirror;
  if (strictMirror === undefined) {
    try {
      strictMirror = await getFlag("router.strict_mirror", true);
    } catch {
      strictMirror = true;
    }
  }

  const finalMessages: AngelMessage[] = strictMirror
    ? [{ role: "user" as const, content: lastUser }]
    : (forwardMessages.length > 0 ? forwardMessages : [{ role: "user" as const, content: lastUser }]);
  if (p.trustedGroupLanguagePolicy?.trim()) {
    finalMessages.unshift({ role: "system", content: p.trustedGroupLanguagePolicy.trim() });
  }

  // Body ĐÚNG CHUẨN DOC: { messages, useKnowledge, stream }. KHÔNG gửi responseStyle,
  // temperature, hoặc bất kỳ field ngoài spec — có bằng chứng Angel gốc phân nhánh
  // theo field lạ và trả sai RAG.
  // useKnowledge: caller override > luôn true (không tắt theo heuristic smalltalk nữa
  // — đó là root cause khiến câu ngắn "bé Ly?" bị miss RAG).
  const useKnowledge = p.useKnowledge !== false;
  const body: Record<string, unknown> = {
    messages: finalMessages,
    useKnowledge,
    stream: false,
    ...(p.answerMode && p.answerMode !== "auto" ? { answer_mode: p.answerMode } : {}),
  };

  // Forward attachments (ảnh gửi kèm). Bỏ khi strictMirror để không nhiễu RAG.
  if (!strictMirror && Array.isArray(p.attachments) && p.attachments.length > 0) {
    body.attachments = p.attachments.map((a) => ({
      kind: a.kind,
      ...(a.url ? { url: a.url } : {}),
      ...(a.base64 ? { base64: a.base64 } : {}),
      ...(a.mime_type ? { mime_type: a.mime_type } : {}),
    }));
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "application/json",
  };
  const apiKey = Deno.env.get("ANGEL_AI_API_KEY") || "";
  if (apiKey) headers["x-api-key"] = apiKey;
  const chatBearer = Deno.env.get("ANGEL_AI_CHAT_BEARER") || "";
  if (chatBearer) headers.Authorization = `Bearer ${chatBearer}`;

  console.log(
    `[angel-core] callFunCore strictMirror=${strictMirror} useKnowledge=${useKnowledge} ` +
    `messages=${finalMessages.length} chars=${lastUser.length}`,
  );

  return await postFunCoreEndpoint(url, headers, body, p.timeoutMs ?? FUN_CORE_TIMEOUT_MS);
}


export async function callAngelCore(p: CallAngelParams): Promise<CallAngelResult> {
  const provider = p.forceProvider ?? getProvider();
  const lastUserMessage = [...p.messages].reverse().find((message) => message.role === "user")?.content ?? "";
  const exactMantrasReply = buildFunKingdom8MantrasReply(lastUserMessage);
  if (exactMantrasReply) {
    return {
      text: exactMantrasReply,
      raw: {
        guardrail: "fun_kingdom_8_mantras_exact_reply",
        source: "local_canonical_scripture",
        matched_query: lastUserMessage.slice(0, 200),
      },
      provider,
    };
  }
  const result = provider === "funcore" ? await callFunCore(p) : await callLovable(p);
  if (!p.json) {
    result.text = sanitizeAngelReply(result.text);
  }
  return result;
}

export function getAngelProvider(): "lovable" | "funcore" {
  return getProvider();
}

/**
 * Post-process Angel reply:
 * 1) Bỏ mọi "citation tail" dạng nhãn nguồn trong ngoặc vuông/tròn ở cuối câu
 *    (VD: "[KIẾN THỨC HỌC ĐƯỢC TỪ KHO TÀI LIỆU]", "[Nguồn: ...]", "(Nguồn tham khảo: ...)").
 *    Angel AI gốc thỉnh thoảng tự chèn — làm tin nhắn dài không cần thiết.
 * 2) Nếu reply hoàn toàn không có emoji, thêm 1 emoji dịu dàng ở cuối để ấm áp hơn.
 */
const EMOJI_RE = /\p{Extended_Pictographic}/u;
const CITATION_PATTERNS: RegExp[] = [
  // Nhãn "KIẾN THỨC ... KHO TÀI LIỆU" / "KHO TRI THỨC" / "KHO DỮ LIỆU"
  /\s*[\[\(（【]\s*(?:kiến\s*thức|kien\s*thuc|nguồn|nguon|source|reference|tham\s*khảo|tham\s*khao|trích|trich|tài\s*liệu|tai\s*lieu|kho\s*(?:tài\s*liệu|tai\s*lieu|tri\s*thức|tri\s*thuc|dữ\s*liệu|du\s*lieu))[^\]\)）】]*[\]\)）】]\s*$/giu,
  // Dòng cuối kiểu "Nguồn: ...", "Tham khảo: ..."
  /\n+\s*(?:nguồn|nguon|tham\s*khảo|tham\s*khao|source|reference)\s*[:：].*$/giu,
];

export function sanitizeAngelReply(input: string): string {
  if (!input) return input;
  let text = input;
  for (let i = 0; i < 3; i++) {
    let changed = false;
    for (const re of CITATION_PATTERNS) {
      const next = text.replace(re, "");
      if (next !== text) { text = next; changed = true; }
    }
    if (!changed) break;
  }
  text = text.replace(/\s+$/g, "").trim();
  return text;
}

