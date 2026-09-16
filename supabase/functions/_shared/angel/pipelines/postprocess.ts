// _shared/angel/pipelines/postprocess.ts
// Sprint 2 — thin wrapper cho post-process (style + pronoun + narrative
// fixup). Logic thật vẫn ở `angel-postprocess.ts`. Ta chỉ bọc telemetry
// và feature-flag để Sprint 3 có thể kill switch từ Admin UI.

import {
  postProcessAngelStyle,
  revertOverPronounRewrite,
  type PostProcessInput,
  type PostProcessResult,
} from "../../angel-postprocess.ts";
import { trackAi } from "../telemetry.ts";
import { getFlag } from "../flags.ts";
import { MODELS } from "../models.ts";

export { revertOverPronounRewrite };
export type { PostProcessInput, PostProcessResult };

export interface RunPostProcessInput extends PostProcessInput {
  channel: "dm" | "group" | "web" | "inline";
  userRef?: string | null;
}

/**
 * Chạy style pass qua telemetry + kiểm tra feature flag
 * `postprocess.style_pass`. Nếu flag OFF → trả nguyên input.text.
 * Default flag ON (giữ hành vi cũ khi bảng flags trống).
 */
export async function runPostProcess(
  input: RunPostProcessInput,
): Promise<PostProcessResult> {
  const enabled = await getFlag("postprocess.style_pass", true);
  if (!enabled) {
    return { text: input.text, applied: false, reason: "flag_off" } as PostProcessResult;
  }
  return trackAi(
    {
      channel: input.channel,
      intent: "postprocess.style",
      tier: "postprocess",
      model: MODELS.style_pass.id,
      user_ref: input.userRef ?? null,
      meta: { len_in: input.text?.length ?? 0 },
    },
    () => postProcessAngelStyle(input),
  );
}
