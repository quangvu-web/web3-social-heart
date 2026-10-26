import { getFlag } from "./angel/flags.ts";
export type AiProvider = "lovable" | "gemini";
// Each entry requires a successful real OpenAI-compatible completion using the
// project's key. Never infer a native name by stripping the Gateway prefix.
// Verified 2026-10-27: HTTP200, choices[0].message.content nonempty, 1377ms.
export const GEMINI_TEXT_MODELS: Readonly<Record<string, string>> = Object.freeze({
  "google/gemini-3.1-flash-lite": "models/gemini-3.1-flash-lite",
});
export async function resolveAiProvider(): Promise<AiProvider> {
  try { return await getFlag("ai.provider", "lovable", { throwOnError: true }); }
  catch { return Deno.env.get("AI_PROVIDER") === "gemini" ? "gemini" : "lovable"; }
}
