// _shared/angel/intents/image.ts
// Sprint 2 — thin wrapper cho intent "tạo/sửa ảnh". Detector thật vẫn nằm
// ở `angel-image.ts` (đã test kỹ với regex Unicode).
export {
  detectImageIntent,
  classifyImageTopic,
  hasPositiveTopicHint,
  isHeavyPrompt,
  pickImageMode,
  withPositiveStyleSuffix,
} from "../../angel-image.ts";
export type { ImageIntent, TopicClassification } from "../../angel-image.ts";
