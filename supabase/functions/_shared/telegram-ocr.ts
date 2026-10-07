import { fetchTelegramMedia } from "./telegram-media.ts";
import { callAiGateway } from "./ai-gateway-retry.ts";

export type OcrResult =
  | { readonly status: "text"; readonly text: string }
  | { readonly status: "empty"; readonly text: "" }
  | {
    readonly status: "unavailable";
    readonly reason:
      | "missing_configuration"
      | "media_unavailable"
      | "api_error"
      | "transport_error"
      | "invalid_response"
      | "internal_error";
    readonly httpStatus?: number;
  };

type OcrSuccess = Exclude<OcrResult, { status: "unavailable" }>;
const MODEL = "google/gemini-3.1-flash-lite";
const TTL_MS = 6 * 60 * 60_000;
// Instance-local only: neither cache nor single-flight coordinates other isolates.
const cache = new Map<string, { result: OcrSuccess; expiresAt: number }>();
const inFlight = new Map<string, Promise<OcrResult>>();

async function scan(fileId: string): Promise<OcrResult> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    return { status: "unavailable", reason: "missing_configuration" };
  }
  let media;
  try {
    media = await fetchTelegramMedia(fileId, {
      allowedMimePrefixes: ["image/"],
      maxBytes: 10 * 1024 * 1024,
    });
  } catch {
    // Never log media errors/URLs; even an upstream message may contain a token.
    return { status: "unavailable", reason: "media_unavailable" };
  }
  const result = await callAiGateway({
    model: MODEL,
    messages: [
      {
        role: "system",
        content:
          "You are an OCR engine. Output ONLY the literal text visible in the image, preserving the original language. No commentary, no translation. If no text is visible, output an empty string.",
      },
      {
        role: "user",
        content: [
          { type: "text", text: "Extract all readable text from this image." },
          { type: "image_url", image_url: { url: media.dataUrl } },
        ],
      },
    ],
  }, { apiKey, label: "ocr", logResponseDetails: false });
  if (!result.ok) {
    if (!result.status) {
      return { status: "unavailable", reason: "transport_error" };
    }
    return {
      status: "unavailable",
      reason: result.status >= 400 ? "api_error" : "invalid_response",
      httpStatus: result.status,
    };
  }
  // A valid empty string is success. Missing/null/object content is not a clean scan.
  const content = result.data?.choices?.[0]?.message?.content;
  if (
    typeof content !== "string" ||
    result.data?.choices?.[0]?.finish_reason === "content_filter"
  ) {
    return {
      status: "unavailable",
      reason: "invalid_response",
      httpStatus: result.status,
    };
  }
  const text = content.trim();
  return text ? { status: "text", text } : { status: "empty", text: "" };
}

export async function runOcrOnPhoto(
  fileId: string,
  uniq: string,
): Promise<OcrResult> {
  // Separate namespaces prevent a missing unique ID colliding with another image's ID.
  const key = uniq ? `unique:${uniq}` : `file:${fileId}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.result;
  if (cached) cache.delete(key);
  const pending = inFlight.get(key);
  if (pending) return pending;

  const work = (async (): Promise<OcrResult> => {
    const started = Date.now();
    let result: OcrResult;
    try {
      result = await scan(fileId);
    } catch {
      result = { status: "unavailable", reason: "internal_error" };
    }
    if (result.status !== "unavailable") {
      Object.freeze(result);
      cache.set(key, { result, expiresAt: Date.now() + TTL_MS });
    }
    console.log("[telegram-ocr] scan", {
      provider: "lovable",
      model: MODEL,
      status: result.status,
      ...(result.status === "unavailable"
        ? { reason: result.reason, httpStatus: result.httpStatus }
        : {}),
      latencyMs: Date.now() - started,
    });
    return result;
  })();
  inFlight.set(key, work);
  try {
    return await work;
  } finally {
    inFlight.delete(key);
  }
}
