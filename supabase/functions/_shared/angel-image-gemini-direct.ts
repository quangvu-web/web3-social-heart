// _shared/angel-image-gemini-direct.ts
// P4 fallback — gọi TRỰC TIẾP Google Generative Language API (gemini-2.5-flash-image)
// bằng secret `GEMINI_API_KEY` do Bé cung cấp riêng. KHÔNG đi qua Lovable Gateway
// nên KHÔNG tốn Lovable credit; quota do Google enforce ở phía key.
//
// Kích hoạt: chỉ chạy khi P3 (Lovable fallback) fail vì DISABLED / HTTP 402 / quota.
// Nếu `GEMINI_API_KEY` chưa được set → throw GeminiDirectNoKeyError → caller bỏ qua.

import type { AngelImageResult } from "./angel-image.ts";

const GEMINI_MODEL = Deno.env.get("ANGEL_GEMINI_DIRECT_MODEL") || "gemini-2.5-flash-image";
const GEMINI_URL = (model: string, key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;

export class GeminiDirectNoKeyError extends Error {
  constructor() { super("gemini_direct_no_key"); }
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(url, { ...init, signal: controller.signal }); }
  finally { clearTimeout(t); }
}

/**
 * Sinh ảnh trực tiếp qua Google Generative Language API.
 * Auto retry 1 lần với model dự phòng khi upstream 503/UNAVAILABLE.
 */
export async function generateImageViaGeminiDirect(input: {
  prompt: string;
  userRef: string;
  model?: string;
}): Promise<AngelImageResult> {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) throw new GeminiDirectNoKeyError();

  const primary = input.model || GEMINI_MODEL;
  // Model dự phòng khác họ để không cùng chết khi flash-image bị throttle.
  const fallback = Deno.env.get("ANGEL_GEMINI_DIRECT_FALLBACK") || "gemini-3.1-flash-image";
  const attempts: string[] = [primary];
  if (fallback && fallback !== primary) attempts.push(fallback);

  let lastErr: Error | null = null;
  for (let i = 0; i < attempts.length; i++) {
    const model = attempts[i];
    try {
      return await callGeminiOnce(key, model, input.prompt, input.userRef);
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      const msg = lastErr.message;
      const retriable = /_(503|429|500|502|504)|UNAVAILABLE|RESOURCE_EXHAUSTED/i.test(msg);
      if (!retriable || i === attempts.length - 1) throw lastErr;
      console.warn(`[angel-image][gemini-direct] retry with ${attempts[i + 1]} after ${msg.slice(0, 100)}`);
      await new Promise((r) => setTimeout(r, 800));
    }
  }
  throw lastErr || new Error("gemini_direct_unknown");
}

async function callGeminiOnce(key: string, model: string, prompt: string, userRef: string): Promise<AngelImageResult> {
  const url = GEMINI_URL(model, key);
  const t0 = Date.now();

  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
  };

  let res: Response;
  try {
    res = await fetchWithTimeout(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }, 45_000);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`gemini_direct_fetch_failed: ${msg}`);
  }

  const rawText = await res.text();
  const dur = Date.now() - t0;
  console.log(`[angel-image][gemini-direct] status=${res.status} dur=${dur}ms len=${rawText.length} model=${model} user=${userRef}`);

  if (!res.ok) {
    throw new Error(`gemini_direct_${res.status}: ${rawText.slice(0, 200)}`);
  }

  let data: any = null;
  try { data = JSON.parse(rawText); } catch { data = null; }

  // Response shape: candidates[0].content.parts[*].inlineData.data
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) {
    console.warn("[angel-image][gemini-direct] no parts", JSON.stringify(data).slice(0, 300));
    throw new Error("gemini_direct_empty_response");
  }
  let b64: string | undefined;
  let mime = "image/png";
  for (const p of parts) {
    const inline = p?.inlineData || p?.inline_data;
    if (inline?.data) {
      b64 = inline.data as string;
      mime = (inline.mimeType || inline.mime_type || "image/png") as string;
      break;
    }
  }
  if (!b64) throw new Error("gemini_direct_no_image_part");

  return {
    image_base64: b64,
    mime_type: mime,
    provider: `gemini-direct:${model}`,
    extraction_kind: "base64",
    extraction_path: "candidates[0].content.parts[].inlineData.data",
  };
}
