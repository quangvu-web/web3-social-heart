// _shared/angel/intents/registry.ts
// Sprint 2 — Intents Registry (B5). Đây là danh sách CANONICAL các intent
// mà bot phân biệt được. Mỗi entry mô tả:
//   - key: id unique (dùng cho feature flag + telemetry).
//   - label: text hiển thị ở tab Admin "Intents".
//   - description: dòng mô tả ngắn để onboard.
//   - detector: hàm nhận `{ text, hasImage }` trả `payload | null`.
//   - flagKey?: liên kết với `angel_feature_flags` để bật/tắt runtime.
//
// Sprint 2 CHỈ scaffold registry — chưa wire vào call flow. `router.ts`
// (Sprint 3) sẽ iterate registry để phát hiện intent thay vì hardcode
// chuỗi if/else trong `telegram-community.ts`.

import { detectImageIntent } from "./image.ts";
import { detectYouTubeIntent } from "./youtube.ts";
import {
  detectFactualLookupQuery,
  detectMeditationInvite,
  detectTranslationTargetLanguage,
} from "./factual.ts";
import type { FlagKey } from "../flags.ts";

export interface IntentDetectionCtx {
  text: string;
  hasImage?: boolean;
}

export interface IntentDefinition {
  key: string;
  label: string;
  description: string;
  detector: (ctx: IntentDetectionCtx) => unknown | null;
  flagKey?: FlagKey;
  category: "media" | "lookup" | "language" | "event" | "safety";
}

export const INTENT_REGISTRY: IntentDefinition[] = [
  {
    key: "image.generate_or_edit",
    label: "Tạo / sửa ảnh",
    description: "Bé yêu cầu Angel vẽ / edit ảnh (Vietnamese + English).",
    category: "media",
    detector: (c) => detectImageIntent(c.text, c.hasImage ?? false),
  },
  {
    key: "media.youtube_link",
    label: "Link YouTube",
    description: "Tin nhắn có link YouTube → phân tích transcript.",
    category: "media",
    detector: (c) => detectYouTubeIntent(c.text),
  },
  {
    key: "lookup.factual_wallet",
    label: "Truy vấn dữ liệu ví / ID",
    description: "Câu hỏi factual (ví Bé, số dư, ID...) → force Mirror clean.",
    category: "lookup",
    flagKey: "router.factual_clean_mirror",
    detector: (c) => {
      const r = detectFactualLookupQuery(c.text);
      return r.matched ? r : null;
    },
  },
  {
    key: "lang.translate_target",
    label: "Yêu cầu dịch ngôn ngữ",
    description: "Người dùng chỉ định ngôn ngữ đích để Angel trả lời.",
    category: "language",
    detector: (c) => detectTranslationTargetLanguage(c.text),
  },
  {
    key: "event.meditation_invite",
    label: "Mời vào Zoom thiền",
    description: "Tin có Zoom + chủ đề thiền → tóm tắt bài thiền dài.",
    category: "event",
    detector: (c) => detectMeditationInvite({
      // Detector gốc nhận TelegramMessage; adapter tối giản chỉ pass text.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      text: c.text,
    } as any),
  },
];

export function listIntents(): IntentDefinition[] {
  return INTENT_REGISTRY.slice();
}

export function findIntent(key: string): IntentDefinition | undefined {
  return INTENT_REGISTRY.find((i) => i.key === key);
}
