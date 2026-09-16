import { supabase } from "@/integrations/supabase/client";

const rpc = supabase.rpc.bind(supabase) as any;

export type FunGameActionCode =
  | "positive_comment_1"
  | "create_post_1"
  | "meditate_5_min"
  | "play_minigame_1"
  | "invite_friend_1";

export const trackFunGameAction = async (
  actionCode: FunGameActionCode,
  proof: Record<string, unknown> = {},
  increment = 1
) => {
  const { error } = await rpc("fun_game_track_action", {
    p_quest_code: actionCode,
    p_increment: increment,
    p_proof: {
      client: "fun-profile-web",
      tracked_at: new Date().toISOString(),
      ...proof,
    },
  });

  if (error) {
    console.warn("[FUN Play] Could not track game action:", actionCode, error.message);
    return false;
  }

  return true;
};
