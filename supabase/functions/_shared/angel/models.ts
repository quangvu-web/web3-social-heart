// _shared/angel/models.ts
// Sprint 1 — Foundation: Model / endpoint registry duy nhất cho toàn bộ tầng
// Angel AI. Mọi file khác nên `import { MODELS } from "../angel/models.ts"`
// thay vì hardcode chuỗi model id.
//
// Có thể override từng role bằng ENV:
//   ANGEL_MODEL_CHAT_PRIMARY, ANGEL_MODEL_STYLE_PASS,
//   ANGEL_MODEL_IMAGE_FAST, ANGEL_MODEL_IMAGE_HEAVY,
//   ANGEL_MODEL_MEMORY_EXTRACT, ANGEL_MODEL_PROMPT_REWRITE.
//
// KHÔNG import ở đâu tại Sprint 1 (chỉ khởi tạo registry). Sprint 2 sẽ
// migrate từng file cũ sang dùng registry này để tránh vỡ runtime.

export type ModelRole =
  | "chat_primary"
  | "chat_backup"
  | "style_pass"
  | "prompt_rewrite"
  | "memory_extract"
  | "image_fast"
  | "image_heavy";

export interface ModelSpec {
  /** vendor/model id đúng theo Lovable AI Gateway catalog. */
  id: string;
  /** Endpoint cần gọi (đầy đủ URL) — mặc định gateway chat/images. */
  endpoint: string;
  /** Timeout ms cho request tới model này. */
  timeoutMs: number;
  /** Ghi chú vai trò để dễ audit. */
  purpose: string;
}

const GATEWAY = "https://ai.gateway.lovable.dev/v1";

function envOr(key: string, fallback: string): string {
  const v = Deno.env.get(key);
  return v && v.trim() ? v.trim() : fallback;
}

export const MODELS: Record<ModelRole, ModelSpec> = {
  chat_primary: {
    id: envOr("ANGEL_MODEL_CHAT_PRIMARY", "google/gemini-3.6-flash"),
    endpoint: `${GATEWAY}/chat/completions`,
    timeoutMs: 45_000,
    purpose: "Trả lời DM + Group + Web (mirror/local).",
  },
  chat_backup: {
    id: envOr("ANGEL_MODEL_CHAT_BACKUP", "google/gemini-3.5-flash"),
    endpoint: `${GATEWAY}/chat/completions`,
    timeoutMs: 45_000,
    purpose: "Fallback khi chat_primary lỗi 5xx/timeout.",
  },
  style_pass: {
    id: envOr("ANGEL_MODEL_STYLE_PASS", "google/gemini-3.1-flash-lite"),
    endpoint: `${GATEWAY}/chat/completions`,
    timeoutMs: 15_000,
    purpose: "Post-process văn phong (rút gọn, thêm emoji nhẹ).",
  },
  prompt_rewrite: {
    id: envOr("ANGEL_MODEL_PROMPT_REWRITE", "google/gemini-3.1-flash-lite"),
    endpoint: `${GATEWAY}/chat/completions`,
    timeoutMs: 15_000,
    purpose: "Chuyển brief bullet Việt → English prose cho generate-image.",
  },
  memory_extract: {
    id: envOr("ANGEL_MODEL_MEMORY_EXTRACT", "google/gemini-3.1-flash-lite"),
    endpoint: `${GATEWAY}/chat/completions`,
    timeoutMs: 20_000,
    purpose: "Trích xuất fact từ hội thoại DM để lưu memory.",
  },
  image_fast: {
    id: envOr("ANGEL_MODEL_IMAGE_FAST", "google/gemini-3.1-flash-image"),
    endpoint: `${GATEWAY}/images/generations`,
    timeoutMs: 25_000,
    purpose: "Nano Banana 2 — fallback ảnh nhanh, rẻ.",
  },
  image_heavy: {
    id: envOr("ANGEL_MODEL_IMAGE_HEAVY", "google/gemini-3-pro-image"),
    endpoint: `${GATEWAY}/images/generations`,
    timeoutMs: 45_000,
    purpose: "Nano Banana Pro — fallback ảnh chất lượng cao (logo/design).",
  },
};

export function getModel(role: ModelRole): ModelSpec {
  return MODELS[role];
}

/** Trả về snapshot để hiển thị/debug ở admin UI. */
export function listModels(): Array<{ role: ModelRole } & ModelSpec> {
  return (Object.keys(MODELS) as ModelRole[]).map((role) => ({
    role,
    ...MODELS[role],
  }));
}
