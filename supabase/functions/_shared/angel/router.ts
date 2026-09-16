// _shared/angel/router.ts
// Sprint 2 — Skeleton router chung cho DM + Group + Web + Inline.
//
// Hiện tại (Sprint 2) chỉ scaffold interface + hàm `detectAllIntents()` để
// entry point mới có thể thử. `telegram-community.ts` vẫn là adapter chính
// và chưa gọi router này (giữ nguyên hành vi runtime).
//
// Sprint 3 sẽ:
//   1. Wire `telegram-community.ts` → gọi `routeAngelRequest()`.
//   2. Thêm `handleIntent()` cho từng key registry.
//   3. Thay chain if/else trong 4400 dòng bằng registry-driven dispatch.

import { INTENT_REGISTRY, type IntentDefinition } from "./intents/registry.ts";

export type AngelChannel = "dm" | "group" | "web" | "inline";

export interface AngelRequest {
  channel: AngelChannel;
  text: string;
  userRef: string;
  hasImage?: boolean;
  meta?: Record<string, unknown>;
}

export interface DetectedIntent {
  intent: IntentDefinition;
  payload: unknown;
}

/**
 * Duyệt registry, trả về TẤT CẢ intent match (order theo registry).
 * Sprint 3 sẽ thêm priority + short-circuit theo category.
 */
export function detectAllIntents(req: AngelRequest): DetectedIntent[] {
  const out: DetectedIntent[] = [];
  for (const intent of INTENT_REGISTRY) {
    let payload: unknown = null;
    try {
      payload = intent.detector({ text: req.text, hasImage: req.hasImage });
    } catch (e) {
      console.warn(`[angel/router] intent ${intent.key} detector threw`, e);
      continue;
    }
    if (payload) out.push({ intent, payload });
  }
  return out;
}

/**
 * Sprint 3 sẽ implement. Hiện trả về marker để rõ ràng "chưa wire".
 */
export function routeAngelRequest(_req: AngelRequest): { status: "not_implemented" } {
  return { status: "not_implemented" };
}
