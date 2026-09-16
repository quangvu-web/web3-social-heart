// _shared/angel-image-fal.ts
// P5 fallback — fal.ai (FLUX / Ideogram / Recraft). Provider độc lập với Google
// nên KHÔNG cùng chết khi Gemini upstream throttle.
//
// Kích hoạt: chỉ chạy khi P1-P4 đều fail và có FAL_API_KEY.
// Không tốn Lovable credit; billing do fal.ai enforce theo key.
//
// Model routing (mặc định, có thể override qua feature flag):
//   - logo             → fal-ai/ideogram/v2   (giỏi text trong ảnh)
//   - architecture     → fal-ai/flux-pro/v1.1 (kiến trúc/không gian)
//   - poster/cosmos/…  → fal-ai/flux-pro/v1.1
//   - còn lại          → fal-ai/flux/schnell  (rẻ, nhanh, ~$0.003)
//
// Quota: 5/ngày/user_ref theo Malaysia Time, bảng `angel_fal_image_usage`.

import { createClient } from "npm:@supabase/supabase-js@2";
import type { AngelImageResult } from "./angel-image.ts";
import type { ArtTopic } from "./angel/image-enrich.ts";
import { getFlag } from "./angel/flags.ts";


const FAL_QUEUE_BASE = "https://queue.fal.run";
const FAL_DIRECT_BASE = "https://fal.run"; // sync_mode fallback nếu queue chậm

const DEFAULT_MODEL_MISC = "fal-ai/flux/schnell";
const DEFAULT_MODEL_LOGO = "fal-ai/ideogram/v2";
const DEFAULT_MODEL_HEAVY = "fal-ai/flux-pro/v1.1";

export class FalNoKeyError extends Error {
  constructor() { super("fal_no_key"); }
}
export class FalDisabledError extends Error {
  constructor() { super("fal_disabled"); }
}
export class FalQuotaError extends Error {
  currentUsage: number;
  dailyLimit: number;
  constructor(currentUsage: number, dailyLimit: number) {
    super(`fal_quota_exceeded [${currentUsage}/${dailyLimit}]`);
    this.currentUsage = currentUsage;
    this.dailyLimit = dailyLimit;
  }
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

function dailyLimit(): number {
  const raw = Number(Deno.env.get("ANGEL_FAL_DAILY_LIMIT") ?? "5");
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 5;
}

async function isEnabled(): Promise<boolean> {
  const envRaw = (Deno.env.get("ANGEL_FAL_ENABLED") || "true").toLowerCase();
  const envDefault = envRaw !== "false" && envRaw !== "0" && envRaw !== "off";
  return await getFlag("image.fal_enabled", envDefault);
}

export async function getFalUsage(userRef: string): Promise<{ count: number; limit: number }> {
  const limit = dailyLimit();
  const supa = serviceClient();
  if (!supa) return { count: 0, limit };
  const { data } = await supa
    .from("angel_fal_image_usage")
    .select("count")
    .eq("user_ref", userRef)
    .eq("usage_day", todayMY())
    .maybeSingle();
  return { count: (data?.count as number) ?? 0, limit };
}

async function incrementUsage(userRef: string): Promise<void> {
  const supa = serviceClient();
  if (!supa) return;
  const day = todayMY();
  const { data } = await supa
    .from("angel_fal_image_usage")
    .select("id, count")
    .eq("user_ref", userRef)
    .eq("usage_day", day)
    .maybeSingle();
  if (data?.id) {
    await supa
      .from("angel_fal_image_usage")
      .update({ count: (data.count as number) + 1, updated_at: new Date().toISOString() })
      .eq("id", data.id as string);
  } else {
    await supa
      .from("angel_fal_image_usage")
      .insert({ user_ref: userRef, usage_day: day, count: 1 });
  }
}

/** Chọn model fal theo topic nghệ thuật (env override được). */
export function pickFalModel(topic: ArtTopic | undefined, heavy: boolean): string {
  if (topic === "logo") {
    return Deno.env.get("ANGEL_FAL_MODEL_LOGO") || DEFAULT_MODEL_LOGO;
  }
  if (heavy || topic === "architecture" || topic === "poster" || topic === "cosmos" ||
      topic === "mandala" || topic === "lightbeing") {
    return Deno.env.get("ANGEL_FAL_MODEL_HEAVY") || DEFAULT_MODEL_HEAVY;
  }
  return Deno.env.get("ANGEL_FAL_MODEL_DEFAULT") || DEFAULT_MODEL_MISC;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(url, { ...init, signal: controller.signal }); }
  finally { clearTimeout(t); }
}

async function urlToBase64(url: string, timeoutMs = 20_000): Promise<{ b64: string; mime: string }> {
  const res = await fetchWithTimeout(url, {}, timeoutMs);
  if (!res.ok) throw new Error(`fal_image_download_${res.status}`);
  const mime = res.headers.get("content-type") || "image/png";
  const buf = new Uint8Array(await res.arrayBuffer());
  // chunked base64 để tránh call apply với arg quá lớn
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < buf.length; i += CHUNK) {
    bin += String.fromCharCode(...buf.subarray(i, i + CHUNK));
  }
  return { b64: btoa(bin), mime };
}

/**
 * Sinh ảnh qua fal.ai. Dùng sync endpoint (fal.run) để đơn giản hoá — model
 * hoàn thành thì trả JSON có `images[0].url` ngay, không cần poll.
 * Với model chậm (>60s) fal vẫn stream giữ kết nối qua HTTP.
 */
export async function generateImageViaFal(input: {
  prompt: string;
  userRef: string;
  model?: string;
  negativePrompt?: string;
  timeoutMs?: number;
}): Promise<AngelImageResult> {
  if (!(await isEnabled())) throw new FalDisabledError();

  const key = Deno.env.get("FAL_API_KEY");
  if (!key) throw new FalNoKeyError();

  const { count, limit } = await getFalUsage(input.userRef);
  if (count >= limit) throw new FalQuotaError(count, limit);

  const model = input.model || DEFAULT_MODEL_MISC;
  const timeoutMs = input.timeoutMs ?? 60_000;
  const url = `${FAL_DIRECT_BASE}/${model}`;

  // Body chung — hầu hết model FLUX/Ideogram/Recraft accept `prompt`.
  const body: Record<string, unknown> = {
    prompt: input.prompt,
    num_images: 1,
    enable_safety_checker: true,
    output_format: "png",
  };
  if (input.negativePrompt && /flux/i.test(model)) {
    // FLUX không có negative_prompt riêng; nhét vào prompt.
    body.prompt = `${input.prompt}\n\nAvoid: ${input.negativePrompt}`;
  } else if (input.negativePrompt) {
    (body as any).negative_prompt = input.negativePrompt;
  }
  if (/ideogram/i.test(model)) {
    (body as any).style = "auto";
    (body as any).expand_prompt = true;
  }
  if (/schnell/i.test(model)) {
    (body as any).num_inference_steps = 4;
  }

  const t0 = Date.now();
  let res: Response;
  try {
    res = await fetchWithTimeout(url, {
      method: "POST",
      headers: {
        Authorization: `Key ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }, timeoutMs);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`fal_fetch_failed: ${msg}`);
  }

  const rawText = await res.text();
  const dur = Date.now() - t0;
  console.log(`[angel-image][fal] status=${res.status} dur=${dur}ms len=${rawText.length} model=${model} user=${input.userRef}`);

  if (!res.ok) {
    throw new Error(`fal_${res.status}: ${rawText.slice(0, 200)}`);
  }

  let data: any = null;
  try { data = JSON.parse(rawText); } catch { data = null; }

  // Response shape: { images: [{ url, width, height, content_type }], ... }
  const first = data?.images?.[0] || data?.image;
  const imgUrl = first?.url as string | undefined;
  if (!imgUrl) {
    console.warn("[angel-image][fal] no image url", JSON.stringify(data).slice(0, 300));
    throw new Error("fal_empty_response");
  }

  // Tải ảnh về base64 để đồng nhất với các tier khác (Telegram/Chat cần base64).
  const { b64, mime } = await urlToBase64(imgUrl);

  try { await incrementUsage(input.userRef); }
  catch (e) { console.warn("[angel-image][fal] increment usage failed", e); }

  return {
    image_base64: b64,
    image_url: imgUrl,
    mime_type: mime,
    provider: `fal:${model}`,
    extraction_kind: "base64",
    extraction_path: "images[0].url",
  };
}
