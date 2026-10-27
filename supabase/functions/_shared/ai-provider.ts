import { getFlag } from "./angel/flags.ts";
export type AiProvider = "lovable" | "gemini";
// Each entry requires a successful real OpenAI-compatible completion using the
// project's key. Never infer a native name by stripping the Gateway prefix.
// Verified 2026-10-27: HTTP200, choices[0].message.content nonempty, 1377ms.
export const GEMINI_TEXT_MODELS: Readonly<Record<string, string>> = Object.freeze({
  "google/gemini-3.1-flash-lite": "models/gemini-3.1-flash-lite",
});
export async function resolveAiProviderForLabel(label: string): Promise<AiProvider> {
  const key = label === "caption-translate" ? "ai.provider.caption"
    : label === "describeImage" ? "ai.provider.vision"
    : label === "ocr" ? "ai.provider.ocr" : null;
  // The retired ai.provider row and AI_PROVIDER env never override service flags.
  // Unscoped labels do not read flags and always retain the Gateway route.
  if (!key) return "lovable";
  try {
    return await getFlag(key, "lovable", {
      throwOnError: true,
      onMissing: () => console.warn("[ai-provider] provider_flag_missing", { key, label, provider: "lovable" }),
    });
  } catch {
    console.warn("[ai-provider] provider_flag_unreadable", { key, label, provider: "lovable" });
    return "lovable";
  }
}
