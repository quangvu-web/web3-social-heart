// _shared/angel/persona/index.ts
// Sprint 2 — Persona canonical builder. Đây là nguồn DUY NHẤT các entry
// point mới (angel/router.ts) sẽ dùng để build system prompt cho model.
//
// Sprint 2 chỉ scaffold + wrap logic hiện có ở `angel-facts.ts`. Chưa
// migrate các call site cũ (telegram-community.ts, angel-chat, ...).
// Sprint 3 sẽ đưa versioning + `loadPersona()` đọc từ DB "published".

import * as B from "./blocks.ts";
import { buildResponseModeHint } from "../../angel-facts.ts";

export type PersonaChannel = "dm" | "group" | "web" | "inline";
export type PersonaMode = "chat" | "meditation" | "seeding" | "factual";

export interface BuildPersonaInput {
  channel: PersonaChannel;
  mode?: PersonaMode;
  userText?: string | null;
  /** true => bỏ qua LENGTH RULE, cho phép dài không giới hạn (DM). */
  unlimitedLength?: boolean;
  /** true => web/inline, thêm block mirror ngôn ngữ. */
  languageMirror?: boolean;
}

/**
 * Ghép system prompt canonical theo channel + mode.
 * Sprint 2: chỉ trả về mảng string, chưa gọi (call site cũ vẫn tự ghép).
 * Dùng cho các module mới muốn thử migrate.
 */
export function buildSystemPromptBlocks(input: BuildPersonaInput): string[] {
  const blocks: string[] = [];

  // 1. Core discipline (luôn có).
  blocks.push(B.OFFICIAL_FACTS);
  blocks.push(B.ANTI_HALLUCINATION_RULE);
  blocks.push(B.PRONOUN_SUBJECT_RULE);
  blocks.push(B.NARRATIVE_CHARACTER_VOICE_RULE);
  blocks.push(B.LIGHT_LANGUAGE_RULE);
  blocks.push(B.SCOPE_EXPANSION_RULE);
  blocks.push(B.SEED_PHRASE_WARNING_DISCIPLINE_RULE);

  // 2. Charm + attunement (áp dụng chat/DM/group).
  if (input.mode !== "factual") {
    blocks.push(B.WIT_AND_CHARM_RULE);
    blocks.push(B.EMOTIONAL_ATTUNEMENT_RULE);
    blocks.push(B.CALLBACK_MEMORY_RULE);
  }

  // 3. Seeding context giữ khi nhắc tới ví/gieo hạt.
  if (input.mode === "seeding" || /gieo hạt|trợ duyên|trợ lực/i.test(input.userText ?? "")) {
    blocks.push(B.SEEDING_CONTEXT_FIDELITY_RULE);
  }

  // 4. Length: DM có thể cởi trói.
  if (!input.unlimitedLength) blocks.push(B.RESPONSE_LENGTH_RULE);
  blocks.push(B.LONG_INPUT_HANDLING_RULE);
  blocks.push(buildResponseModeHint(input.userText ?? ""));

  // 5. Format (chỉ web/inline; Telegram tự chia dòng ngắn hơn).
  if (input.channel === "web" || input.channel === "inline") {
    blocks.push(B.RICH_FORMAT_RULE);
    if (input.languageMirror ?? true) blocks.push(B.WEB_LANGUAGE_MIRROR_RULE);
  }

  return blocks.filter(Boolean);
}

export function buildSystemPromptText(input: BuildPersonaInput): string {
  return buildSystemPromptBlocks(input).join("\n\n");
}

export * as blocks from "./blocks.ts";
