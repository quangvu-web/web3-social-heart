// _shared/angel/intents/factual.ts
// Sprint 2 — wrapper cho "factual lookup" (ví, ID, số dư...). Buộc router
// dùng Mirror sạch, không post-process. Logic vẫn nằm ở telegram-community.
export {
  detectFactualLookupQuery,
  detectTranslationTargetLanguage,
  detectMeditationInvite,
  detectMeditationTopicLanguage,
} from "../../telegram-community.ts";
