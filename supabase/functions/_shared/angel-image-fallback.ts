// _shared/angel-image-fallback.ts
// Lovable AI Gateway fallback cho tạo ảnh Angel AI.
//
// Trigger:
//   - Prompt thường: chỉ chạy khi Angel gốc spiritual + fast cùng fail
//     VÀ ANGEL_LOVABLE_FALLBACK_ENABLED != false.
//   - Prompt "heavy" (logo/poster/design/mô tả dài): FORCE luôn bật, kể cả khi
//     env tắt fallback, vì đây là ca Angel gốc yếu nhất.
//
// Model:
//   - Mặc định: google/gemini-3.1-flash-image (Nano Banana 2, rẻ + nhanh).
//   - Prompt heavy: nâng lên google/gemini-3-pro-image (Nano Banana Pro, sắc nét).
//
// Quota: 5/ngày/user_ref theo Malaysia Time. Độc lập với 5/ngày Angel gốc.

import { createClient } from "npm:@supabase/supabase-js@2";
import type { AngelImageResult } from "./angel-image.ts";
import { MODELS } from "./angel/models.ts";
import { getFlag } from "./angel/flags.ts";

const LOVABLE_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/images/generations";
// Model IDs đọc từ registry MODELS (đã tôn trọng env override).
const DEFAULT_FALLBACK_MODEL = MODELS.image_fast.id;
const HEAVY_FALLBACK_MODEL = MODELS.image_heavy.id;

function fallbackDailyLimit(): number {
  const raw = Number(Deno.env.get("ANGEL_LOVABLE_FALLBACK_DAILY_LIMIT") ?? "5");
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 5;
}

// Env fallback (giữ backward-compat), có thể bị override bởi feature flag.
function envFallbackDefault(): boolean {
  const raw = (Deno.env.get("ANGEL_LOVABLE_FALLBACK_ENABLED") || "true").toLowerCase();
  return raw !== "false" && raw !== "0" && raw !== "off";
}

async function isFallbackEnabled(): Promise<boolean> {
  return await getFlag("image.fallback_lovable_enabled", envFallbackDefault());
}

export class LovableFallbackQuotaError extends Error {
  currentUsage: number;
  dailyLimit: number;
  constructor(currentUsage: number, dailyLimit: number) {
    super(`lovable_fallback_quota_exceeded [${currentUsage}/${dailyLimit}]`);
    this.currentUsage = currentUsage;
    this.dailyLimit = dailyLimit;
  }
}

export class LovableFallbackDisabledError extends Error {
  constructor() { super("lovable_fallback_disabled"); }
}

function serviceClient() {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function todayMY(): string {
  const now = new Date(Date.now() + 8 * 60 * 60 * 1000);
  return now.toISOString().slice(0, 10);
}

export async function getLovableFallbackUsage(userRef: string): Promise<{ count: number; limit: number }> {
  const limit = fallbackDailyLimit();
  const supa = serviceClient();
  if (!supa) return { count: 0, limit };
  const day = todayMY();
  const { data } = await supa
    .from("angel_lovable_image_fallback_usage")
    .select("count")
    .eq("user_ref", userRef)
    .eq("usage_day", day)
    .maybeSingle();
  return { count: (data?.count as number) ?? 0, limit };
}

async function incrementFallbackUsage(userRef: string): Promise<void> {
  const supa = serviceClient();
  if (!supa) return;
  const day = todayMY();
  const { data } = await supa
    .from("angel_lovable_image_fallback_usage")
    .select("id, count")
    .eq("user_ref", userRef)
    .eq("usage_day", day)
    .maybeSingle();
  if (data?.id) {
    await supa
      .from("angel_lovable_image_fallback_usage")
      .update({ count: (data.count as number) + 1, updated_at: new Date().toISOString() })
      .eq("id", data.id as string);
  } else {
    await supa
      .from("angel_lovable_image_fallback_usage")
      .insert({ user_ref: userRef, usage_day: day, count: 1 });
  }
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

/**
 * Sinh ảnh qua Lovable AI Gateway.
 * @param opts.model - override model (mặc định flash-image; pro-image cho prompt heavy).
 * @param opts.force - bỏ qua env ANGEL_LOVABLE_FALLBACK_ENABLED (dùng cho prompt heavy).
 * @param opts.stream - bật SSE streaming để nhận partial frame trong lúc model render.
 * @param opts.onPartial - callback nhận từng partial frame base64 (chỉ khi stream=true).
 */
export async function generateImageViaLovableFallback(input: {
  prompt: string;
  userRef: string;
  model?: string;
  force?: boolean;
  stream?: boolean;
  onPartial?: (b64: string, index: number) => void | Promise<void>;
}): Promise<AngelImageResult> {
  if (!input.force && !(await isFallbackEnabled())) throw new LovableFallbackDisabledError();

  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("LOVABLE_API_KEY not configured");

  const { count, limit } = await getLovableFallbackUsage(input.userRef);
  if (count >= limit) throw new LovableFallbackQuotaError(count, limit);

  const model = input.model || DEFAULT_FALLBACK_MODEL;
  const isPro = /pro-image/i.test(model);
  const timeoutMs = isPro ? 60_000 : 30_000;
  const stream = !!input.stream;

  const body: Record<string, unknown> = {
    model,
    messages: [{ role: "user", content: input.prompt }],
    modalities: ["image", "text"],
  };
  if (stream) body.stream = true;

  const t0 = Date.now();
  let res: Response;
  try {
    res = await fetchWithTimeout(LOVABLE_GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...(stream ? { Accept: "text/event-stream" } : {}),
      },
      body: JSON.stringify(body),
    }, timeoutMs);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`lovable_fallback_fetch_failed: ${msg}`);
  }

  if (!res.ok) {
    const rawText = await res.text().catch(() => "");
    console.warn(`[angel-image][fallback] status=${res.status} model=${model} err=${rawText.slice(0, 300)}`);
    throw new Error(`lovable_fallback_${res.status}: ${rawText.slice(0, 200)}`);
  }

  // ---- Streaming path ----
  if (stream && res.body) {
    const dec = new TextDecoder();
    const reader = res.body.getReader();
    let buf = "";
    let finalB64: string | undefined;
    let lastPartialB64: string | undefined;
    let partialIndex = 0;
    let streamErr: string | undefined;

    const handleEvent = async (event: string, data: string) => {
      if (!data || data === "[DONE]") return;
      let payload: any;
      try { payload = JSON.parse(data); } catch { return; }
      if (event === "error" || payload?.type === "error") {
        streamErr = payload?.error?.message ?? "lovable_stream_error";
        return;
      }
      const b64 = payload?.b64_json as string | undefined;
      if (!b64) return;
      if (event === "image_generation.completed" || payload?.type === "image_generation.completed") {
        finalB64 = b64;
      } else if (event === "image_generation.partial_image" || payload?.type === "image_generation.partial_image") {
        lastPartialB64 = b64;
        if (input.onPartial) {
          try { await input.onPartial(b64, partialIndex++); }
          catch (e) { console.warn("[angel-image][fallback] onPartial threw", e); }
        }
      }
    };

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        // Split on SSE record boundaries (\n\n)
        let idx: number;
        while ((idx = buf.indexOf("\n\n")) !== -1) {
          const raw = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          let ev = "message";
          const dataLines: string[] = [];
          for (const line of raw.split(/\r?\n/)) {
            if (line.startsWith("event:")) ev = line.slice(6).trim();
            else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
          }
          if (dataLines.length) await handleEvent(ev, dataLines.join("\n"));
        }
      }
    } finally {
      try { reader.cancel(); } catch { /* noop */ }
    }

    const dur = Date.now() - t0;
    if (streamErr) {
      console.warn(`[angel-image][fallback] stream error dur=${dur}ms msg=${streamErr}`);
      throw new Error(`lovable_fallback_stream: ${streamErr}`);
    }
    const b64 = finalB64 || lastPartialB64;
    console.log(`[angel-image][fallback] stream ok dur=${dur}ms partials=${partialIndex} final=${finalB64 ? "yes" : "no"} model=${model}`);
    if (!b64) throw new Error("lovable_fallback_empty_stream");

    try { await incrementFallbackUsage(input.userRef); }
    catch (e) { console.warn("[angel-image][fallback] increment usage failed", e); }

    return {
      image_base64: b64,
      mime_type: "image/png",
      provider: `lovable-gateway:${model}:stream`,
      extraction_kind: "base64",
      extraction_path: "sse.image_generation.completed.b64_json",
    };
  }

  // ---- Non-streaming path ----
  const rawText = await res.text();
  const dur = Date.now() - t0;
  console.log(`[angel-image][fallback] lovable status=${res.status} dur=${dur}ms len=${rawText.length} model=${model}`);

  let data: any = null;
  try { data = JSON.parse(rawText); } catch { data = null; }

  // Ưu tiên OpenAI-style: data[0].b64_json.
  let b64 = data?.data?.[0]?.b64_json as string | undefined;
  // Fallback: một số version trả trong choices[0].message.images[0]
  if (!b64) {
    const imgUrl = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url as string | undefined;
    if (imgUrl && imgUrl.startsWith("data:image/")) {
      const m = imgUrl.match(/^data:(image\/[^;]+);base64,(.+)$/);
      if (m) b64 = m[2];
    }
  }
  if (!b64) {
    console.warn("[angel-image][fallback] no b64 in response shape=", JSON.stringify(data).slice(0, 400));
    throw new Error("lovable_fallback_empty_response");
  }

  try { await incrementFallbackUsage(input.userRef); }
  catch (e) { console.warn("[angel-image][fallback] increment usage failed", e); }

  return {
    image_base64: b64,
    mime_type: "image/png",
    provider: `lovable-gateway:${model}`,
    extraction_kind: "base64",
    extraction_path: "data[0].b64_json",
  };
}
