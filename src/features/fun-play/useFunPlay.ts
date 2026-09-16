import { useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import type { FunGameActionCode } from "./trackFunGameAction";

type RewardType =
  | "fun_money"
  | "camly_coin"
  | "xp"
  | "light_score"
  | "nft_badge"
  | "nft_item"
  | "mystery_box";

export interface FunGameProfile {
  user_id: string;
  xp: number;
  light_score: number;
  streak_days: number;
  risk_score: number;
  reward_multiplier: number;
}

export interface FunGamePet {
  id: string;
  name: string;
  level: number;
  xp: number;
  energy: number;
  mood: number;
  aura: number;
  rarity: string;
}

export interface FunDailyQuest {
  id: string;
  quest_template_id: string;
  title: string;
  description: string;
  progress_count: number;
  target_count: number;
  completed_at: string | null;
  claimed_at: string | null;
  reward_type: RewardType;
  reward_amount: number;
  light_score_delta: number;
  ai_moderation_required: boolean;
}

export interface FunLeaderboardUser {
  user_id: string;
  username: string;
  avatar_url: string | null;
  light_score: number;
  xp: number;
  streak_days: number;
}

export interface FunRewardLedgerItem {
  id: string;
  source_type: string;
  reward_type: RewardType;
  amount: number;
  status: string;
  created_at: string;
  metadata: Record<string, unknown>;
}

interface EnsureResult {
  profile: FunGameProfile;
  pet: FunGamePet;
  unopened_boxes: number;
}

interface QuestResult {
  quests: FunDailyQuest[];
}

interface SummaryResult {
  recent_rewards: FunRewardLedgerItem[];
  inventory_count: number;
  next_daily_reset_at: string;
}

const rpc = supabase.rpc.bind(supabase) as any;

const funPlayKey = ["fun-play"];

const normalizeNumber = (value: unknown) => Number(value ?? 0);

const normalizeQuest = (quest: any): FunDailyQuest => ({
  ...quest,
  progress_count: normalizeNumber(quest.progress_count),
  target_count: normalizeNumber(quest.target_count),
  reward_amount: normalizeNumber(quest.reward_amount),
  light_score_delta: normalizeNumber(quest.light_score_delta),
});

const rewardLabels: Record<RewardType, string> = {
  fun_money: "FUN Money",
  camly_coin: "Camly Coin",
  xp: "XP",
  light_score: "Light Score",
  nft_badge: "NFT Badge",
  nft_item: "NFT Item",
  mystery_box: "Mystery Box",
};

export const formatReward = (quest: Pick<FunDailyQuest, "reward_type" | "reward_amount" | "light_score_delta">) => {
  if (quest.reward_type === "mystery_box") return "Mystery Box";
  const amount = normalizeNumber(quest.reward_amount);
  const base = `${amount.toLocaleString("en-US")} ${rewardLabels[quest.reward_type]}`;
  if (quest.light_score_delta > 0 && quest.reward_type !== "light_score") {
    return `${base} + ${quest.light_score_delta} Light`;
  }
  return base;
};

export const useFunPlay = () => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const enabled = isAuthenticated && !authLoading;

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: funPlayKey });
  }, [queryClient]);

  const overviewQuery = useQuery({
    queryKey: [...funPlayKey, "overview"],
    enabled,
    queryFn: async () => {
      const [
        { data: ensureData, error: ensureError },
        { data: questData, error: questError },
        { data: leaderboardData, error: leaderboardError },
        { data: summaryData, error: summaryError },
      ] =
        await Promise.all([
          rpc("fun_game_ensure_profile"),
          rpc("fun_game_assign_daily_quests"),
          rpc("fun_game_leaderboard", { p_limit: 10 }),
          rpc("fun_game_player_summary"),
        ]);

      if (ensureError) throw ensureError;
      if (questError) throw questError;
      if (leaderboardError) throw leaderboardError;
      if (summaryError) throw summaryError;

      const ensure = ensureData as EnsureResult;
      const quests = ((questData as QuestResult)?.quests ?? []).map(normalizeQuest);
      const summary = summaryData as SummaryResult;

      return {
        profile: {
          ...ensure.profile,
          xp: normalizeNumber(ensure.profile?.xp),
          light_score: normalizeNumber(ensure.profile?.light_score),
          streak_days: normalizeNumber(ensure.profile?.streak_days),
          risk_score: normalizeNumber(ensure.profile?.risk_score),
          reward_multiplier: normalizeNumber(ensure.profile?.reward_multiplier),
        },
        pet: {
          ...ensure.pet,
          xp: normalizeNumber(ensure.pet?.xp),
          level: normalizeNumber(ensure.pet?.level),
          energy: normalizeNumber(ensure.pet?.energy),
          mood: normalizeNumber(ensure.pet?.mood),
          aura: normalizeNumber(ensure.pet?.aura),
        },
        unopenedBoxes: normalizeNumber(ensure.unopened_boxes),
        inventoryCount: normalizeNumber(summary?.inventory_count),
        nextDailyResetAt: summary?.next_daily_reset_at,
        recentRewards: ((summary?.recent_rewards ?? []) as any[]).map((reward) => ({
          ...reward,
          amount: normalizeNumber(reward.amount),
          metadata: reward.metadata ?? {},
        })) as FunRewardLedgerItem[],
        quests,
        leaderboard: ((leaderboardData ?? []) as any[]).map((user) => ({
          ...user,
          light_score: normalizeNumber(user.light_score),
          xp: normalizeNumber(user.xp),
          streak_days: normalizeNumber(user.streak_days),
        })) as FunLeaderboardUser[],
      };
    },
    staleTime: 30 * 1000,
    retry: 1,
  });

  const trackQuestMutation = useMutation({
    mutationFn: async (questId: string) => {
      const { error } = await rpc("fun_game_track_demo_action", {
        p_daily_quest_id: questId,
        p_increment: 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      refresh();
      toast({ title: "Quest updated", description: "Progress was recorded by the reward engine." });
    },
    onError: (error: any) => {
      toast({ title: "Quest update failed", description: error.message, variant: "destructive" });
    },
  });

  const trackActionMutation = useMutation({
    mutationFn: async (actionCode: FunGameActionCode) => {
      const { error } = await rpc("fun_game_track_action", {
        p_quest_code: actionCode,
        p_increment: 1,
        p_proof: {
          source: "fun_play_page",
          tracked_at: new Date().toISOString(),
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      refresh();
      toast({ title: "Mini game completed", description: "Daily quest progress was recorded." });
    },
    onError: (error: any) => {
      toast({ title: "Mini game tracking failed", description: error.message, variant: "destructive" });
    },
  });

  const claimQuestMutation = useMutation({
    mutationFn: async (questId: string) => {
      const { data, error } = await rpc("fun_game_claim_daily_reward", {
        p_daily_quest_id: questId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      refresh();
      const reward = data?.reward;
      toast({
        title: reward?.status === "pending" ? "Reward pending review" : "Reward claimed",
        description: reward ? `${reward.amount} ${rewardLabels[reward.reward_type as RewardType]}` : "Reward ledger updated.",
      });
    },
    onError: (error: any) => {
      toast({ title: "Claim failed", description: error.message, variant: "destructive" });
    },
  });

  const openBoxMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await rpc("fun_game_open_next_box");
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      refresh();
      const reward = data?.reward;
      toast({
        title: reward ? "Mystery Box opened" : "No unopened boxes",
        description: reward ? `${reward.amount} ${rewardLabels[reward.reward_type as RewardType]}` : "Earn a box from daily quests or events.",
      });
    },
    onError: (error: any) => {
      toast({ title: "Box opening failed", description: error.message, variant: "destructive" });
    },
  });

  const petActionMutation = useMutation({
    mutationFn: async (action: "feed" | "meditate" | "train") => {
      const { error } = await rpc("fun_game_pet_action", { p_action: action });
      if (error) throw error;
    },
    onSuccess: () => {
      refresh();
      toast({ title: "Pet updated", description: "Your Light Pet gained energy, mood, or XP." });
    },
    onError: (error: any) => {
      toast({ title: "Pet action failed", description: error.message, variant: "destructive" });
    },
  });

  const completedQuestCount = useMemo(
    () => overviewQuery.data?.quests.filter((quest) => quest.completed_at).length ?? 0,
    [overviewQuery.data?.quests]
  );

  const claimedQuestCount = useMemo(
    () => overviewQuery.data?.quests.filter((quest) => quest.claimed_at).length ?? 0,
    [overviewQuery.data?.quests]
  );

  return {
    ...overviewQuery,
    isReady: enabled,
    completedQuestCount,
    claimedQuestCount,
    trackQuest: trackQuestMutation.mutate,
    trackAction: trackActionMutation.mutate,
    claimQuest: claimQuestMutation.mutate,
    openBox: openBoxMutation.mutate,
    petAction: petActionMutation.mutate,
    isMutating:
      trackQuestMutation.isPending ||
      trackActionMutation.isPending ||
      claimQuestMutation.isPending ||
      openBoxMutation.isPending ||
      petActionMutation.isPending,
  };
};
