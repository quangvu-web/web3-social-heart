// _shared/angel/index.ts
// Sprint 2 — barrel export cho module `angel/`. Các entry point mới
// (angel-chat / angel-inline / telegram-community adapter tương lai) chỉ
// cần: `import { ... } from "../_shared/angel/index.ts"`.

export * as persona from "./persona/index.ts";
export * as intents from "./intents/registry.ts";
export * as imagePipeline from "./pipelines/image.ts";
export * as postprocessPipeline from "./pipelines/postprocess.ts";
export * as router from "./router.ts";

export { MODELS, getModel, listModels } from "./models.ts";
export { getFlag, getFlagMeta, invalidateFlagCache } from "./flags.ts";
export { logAiEvent, trackAi } from "./telemetry.ts";
