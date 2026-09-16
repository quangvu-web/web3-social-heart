// _shared/angel/pipelines/image.ts
// Sprint 2 — pipeline orchestrator cho tạo ảnh. Hiện chỉ re-export API cũ
// từ `angel-image.ts` + expose `runImagePipeline()` gói `trackAi` telemetry
// (không đổi hành vi). Sprint 3 sẽ tách 3 tier ra file riêng
// (angel-root-spiritual / angel-root-fast / lovable-fallback) và kill switch.

import {
  generateAngelImage,
  generateAngelImageResilient,
  editAngelImage,
  isHeavyPrompt,
  type AngelImageResult,
} from "../../angel-image.ts";
import { trackAi } from "../telemetry.ts";
import { MODELS } from "../models.ts";

export {
  generateAngelImage,
  generateAngelImageResilient,
  editAngelImage,
  isHeavyPrompt,
};
export type { AngelImageResult };

export interface RunImagePipelineInput {
  channel: "dm" | "group" | "web" | "inline";
  prompt: string;
  userRef: string;
  mode?: "generate" | "edit";
  imageUrl?: string | null;
  imageBase64?: string | null;
}

/**
 * Wrapper có telemetry cho code mới. Hàm cũ vẫn dùng được không đổi.
 */
export function runImagePipeline(input: RunImagePipelineInput): Promise<AngelImageResult> {
  const heavy = isHeavyPrompt(input.prompt);
  const model = heavy ? MODELS.image_heavy.id : MODELS.image_fast.id;
  return trackAi(
    {
      channel: input.channel,
      intent: input.mode === "edit" ? "image.edit" : "image.generate",
      tier: "primary",
      model,
      user_ref: input.userRef,
      meta: { heavy, len: input.prompt.length },
    },
    async () => {
      if (input.mode === "edit") {
        return editAngelImage({
          instruction: input.prompt,
          imageUrl: input.imageUrl ?? null,
          imageBase64: input.imageBase64 ?? null,
          userRef: input.userRef,
        });
      }
      return generateAngelImageResilient({
        prompt: input.prompt,
        userRef: input.userRef,
        initialMode: heavy ? "spiritual" : "spiritual",
      });
    },
  );
}
