// _shared/angel/image-distill.ts
// Bước 1 — Prompt Distillation Layer.
// Khi user gửi 1 đoạn văn phân tích DÀI rồi bảo "vẽ ảnh minh hoạ", model
// diffusion nhận nguyên đoạn tiếng Việt → hiểu nhầm là "vẽ slide có chữ" và
// sinh ra ảnh slide chữ méo, vô nghĩa. Distill = chuyển đoạn văn dài đó
// thành 1 câu visual scene ngắn (English, ≤ 240 char) trước khi vào enrich.
//
// Chỉ chạy khi:
//   - Flag `image.distill_enabled` bật (default ON)
//   - Prompt length ≥ ngưỡng (meta.min_chars, default 180) HOẶC có dấu hiệu
//     văn bản phân tích: bullet `1.`/`-`, nhiều xuống dòng, câu hoàn chỉnh nhiều.

import { getFlag, getFlagMeta } from "./flags.ts";

interface DistillOutput {
  prompt: string;                 // Prompt đã distill (hoặc gốc nếu skip)
  distilled: boolean;             // true nếu đã distill thành công
  reason?: string;                // lý do skip
  duration_ms?: number;
  original_len?: number;
  distilled_len?: number;
}

const ANALYTICAL_MARKERS = [
  /\n\s*\d+\.\s/,                 // "1. Che slide"
  /\n\s*[-•*]\s/,                 // bullet
  /###\s/,                        // markdown heading
  /\*\*[^*]+\*\*/,                // bold heading
];

function looksAnalytical(text: string): boolean {
  const markerHits = ANALYTICAL_MARKERS.reduce((n, re) => n + (re.test(text) ? 1 : 0), 0);
  if (markerHits >= 1) return true;
  // Nhiều xuống dòng + nhiều câu → coi là văn bản dài dạng phân tích.
  const newlines = (text.match(/\n/g) ?? []).length;
  const sentences = (text.match(/[.!?…]\s+[A-ZÁÀẢÃẠÂẦẤẨẪẬĂẰẮẲẴẶÉÈẺẼẸÊỀẾỂỄỆÍÌỈĨỊÓÒỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÚÙỦŨỤƯỪỨỬỮỰÝỲỶỸỴĐ]/g) ?? []).length;
  return newlines >= 3 && sentences >= 3;
}

export interface DistillTelemetry {
  original_len: number;
  distilled_len: number;
  distilled: boolean;
  duration_ms: number;
  reason?: string;
  fallback_used?: boolean;
}

/**
 * Fallback graceful (Bước 6): cắt câu đầu + 200 ký tự cuối, thêm hint no-text.
 */
function graceFallback(prompt: string): string {
  const t = prompt.trim();
  const firstSentence = t.split(/[.!?…\n]/)[0]?.trim() ?? "";
  const tail = t.slice(-200).trim();
  const head = firstSentence.length >= 20 ? firstSentence : t.slice(0, 200).trim();
  const merged = `${head}. ${tail}`.replace(/\s{2,}/g, " ").trim();
  return `${merged}. Illustrative visual scene, no text, no captions, no slides.`.slice(0, 500);
}

/**
 * Distill prompt dài thành visual scene ngắn.
 * Trả về prompt gốc nếu bị skip hoặc distill fail (Angel không chặn user).
 */
export async function distillImagePrompt(prompt: string): Promise<DistillOutput> {
  const raw = (prompt ?? "").trim();
  if (!raw) return { prompt: raw, distilled: false, reason: "empty" };

  const enabled = await getFlag("image.distill_enabled", true);
  if (!enabled) return { prompt: raw, distilled: false, reason: "flag_off" };

  const meta = (await getFlagMeta("image.distill_enabled")) ?? {};
  const minChars = typeof meta.min_chars === "number" ? (meta.min_chars as number) : 180;

  const long = raw.length >= minChars;
  const analytical = looksAnalytical(raw);
  if (!long && !analytical) {
    return { prompt: raw, distilled: false, reason: "short_and_plain", original_len: raw.length };
  }

  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) {
    const g = graceFallback(raw);
    return {
      prompt: g, distilled: true, reason: "no_lovable_key_grace_fallback",
      original_len: raw.length, distilled_len: g.length,
    };
  }

  const t0 = Date.now();
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3_000);
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content: [
              "You convert a Vietnamese passage (analysis, article, notes, or short request) into ONE short English visual-scene prompt for a text-to-image diffusion model.",
              "Guiding principle: stay faithful to the source's real subject and setting. Keep the mood POSITIVE, LUMINOUS and UPLIFTING.",
              "Rules:",
              "- Output ONE sentence, ≤ 240 characters, describing a concrete visual scene.",
              "- PRESERVE the concrete anchors from the source: WHO (person/role: speaker, investor, engineer, meditator, child…), WHERE (setting: boardroom, stage, seaside villa, mountain, cosmos…), WHAT they are doing, and the ERA/STYLE implied (modern, contemporary, futuristic, classical — do not invent a different era).",
              "- If the source is modern/business/tech/education (pitch deck, investors, startup, presenting, coding, meeting, classroom) → depict a MODERN, contemporary scene with realistic modern clothing. Do NOT default to ancient/historical/traditional costumes unless the source clearly asks for them.",
              "- Ignore bullets, numbers, headings, and person names. Do not paste the source text back.",
              "- Output ONLY the sentence, no preface, no quotes, no explanation.",
            ].join("\n"),
          },
          { role: "user", content: raw },
        ],
      }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      console.warn(`[image-distill] gateway status=${res.status}`);
      const g = graceFallback(raw);
      return {
        prompt: g, distilled: true, reason: `gateway_${res.status}_grace_fallback`,
        original_len: raw.length, distilled_len: g.length, duration_ms: Date.now() - t0,
      };
    }
    const data = await res.json();
    const out = String(data?.choices?.[0]?.message?.content ?? "").trim().replace(/^["']|["']$/g, "");
    if (out.length < 20) {
      const g = graceFallback(raw);
      return {
        prompt: g, distilled: true, reason: "distill_too_short_grace_fallback",
        original_len: raw.length, distilled_len: g.length, duration_ms: Date.now() - t0,
      };
    }
    const dur = Date.now() - t0;
    console.log(`[image-distill] ok dur=${dur}ms in=${raw.length} out=${out.length}`);
    return {
      prompt: out, distilled: true,
      original_len: raw.length, distilled_len: out.length, duration_ms: dur,
    };
  } catch (e) {
    console.warn("[image-distill] error → grace fallback", e instanceof Error ? e.message : e);
    const g = graceFallback(raw);
    return {
      prompt: g, distilled: true, reason: "exception_grace_fallback",
      original_len: raw.length, distilled_len: g.length, duration_ms: Date.now() - t0,
    };
  }
}
