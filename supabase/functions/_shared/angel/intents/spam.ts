// _shared/angel/intents/spam.ts
// Sprint 2 — re-export các detector spam đang nằm trong telegram-community.
// Chưa refactor logic; chỉ tạo entry point ổn định cho tab admin Intents
// (Sprint 4) tra cứu.
export {
  detectTelegramScam,
  detectTelegramPreviewSpam,
  detectExternalBotPromotion,
} from "../../telegram-community.ts";
