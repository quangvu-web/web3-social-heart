import {
  BadgeCheck,
  Bot,
  BrainCircuit,
  CalendarCheck,
  Coins,
  Crown,
  Gift,
  HeartHandshake,
  Map,
  PawPrint,
  QrCode,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
  WalletCards,
  Zap,
  type LucideIcon,
} from "lucide-react";

export type RewardType = "FUN Money" | "Camly Coin" | "XP" | "Light Score" | "NFT";

export interface GamePillar {
  id: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  loop: string[];
  rewards: RewardType[];
  antiCheat: string[];
  mvp: string[];
}

export interface EconomyRule {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
}

export interface RoadmapPhase {
  phase: string;
  title: string;
  goals: string[];
}

export const gamePillars: GamePillar[] = [
  {
    id: "daily-light-quest",
    title: "Daily Light Quest",
    subtitle: "3-7 positive missions each day to create social energy.",
    icon: CalendarCheck,
    loop: [
      "Receive daily quest set",
      "Create, comment, learn, meditate, play, invite, tip",
      "Claim rewards after proof checks",
      "Build streak, badges, seasonal rank",
    ],
    rewards: ["FUN Money", "Camly Coin", "XP", "Light Score", "NFT"],
    antiCheat: [
      "Daily caps per quest type",
      "AI sentiment and spam scoring",
      "Cooldown between repetitive actions",
      "Reward pending state for risky behavior",
    ],
    mvp: [
      "Quest board",
      "Progress bars",
      "Streak counter",
      "Claim reward ledger",
    ],
  },
  {
    id: "treasure-hunt",
    title: "FUN Treasure Hunt",
    subtitle: "Digital clues, QR codes, community puzzles, and limited drops.",
    icon: Map,
    loop: [
      "Discover clue from feed, QR, live, or event",
      "Submit answer or scan code",
      "Join team challenge",
      "Unlock rare reward before event closes",
    ],
    rewards: ["FUN Money", "Camly Coin", "NFT", "Light Score"],
    antiCheat: [
      "One verified claim per device/user/event",
      "Geo fence confidence score",
      "QR nonce and expiry validation",
      "Bot velocity and referral graph checks",
    ],
    mvp: [
      "Event list",
      "Clue detail",
      "Team leaderboard",
      "Reward rarity table",
    ],
  },
  {
    id: "ai-pet",
    title: "AI Companion Pet",
    subtitle: "A Light Pet that grows with user behavior and emotional bonds.",
    icon: PawPrint,
    loop: [
      "Feed and train pet",
      "Talk with AI companion",
      "Complete co-op pet missions",
      "Evolve aura, skills, and NFT skins",
    ],
    rewards: ["XP", "Light Score", "FUN Money", "NFT"],
    antiCheat: [
      "Energy budget limits",
      "Action proof from server events",
      "AI memory moderation",
      "Marketplace transfer audit trail",
    ],
    mvp: [
      "Pet profile",
      "Mood and energy",
      "Daily care actions",
      "Multiplier preview",
    ],
  },
  {
    id: "mystery-box",
    title: "Mystery Box",
    subtitle: "Seasonal boxes with sustainable rarity, jackpot, and boosts.",
    icon: Gift,
    loop: [
      "Earn boxes from login, quests, referrals, events",
      "Open with animated reveal",
      "Receive item, boost, coin, or badge",
      "Track inventory and seasonal sets",
    ],
    rewards: ["FUN Money", "Camly Coin", "XP", "Light Score", "NFT"],
    antiCheat: [
      "Server-side random seed commitment",
      "Pity counter with transparent caps",
      "No client-side reward decisions",
      "Inflation guard and reward treasury budgets",
    ],
    mvp: [
      "Box inventory",
      "Open result",
      "Rarity config",
      "Reward ledger entry",
    ],
  },
];

export const economyRules: EconomyRule[] = [
  {
    label: "Reward Source",
    value: "Server events only",
    detail: "Rewards should be created from verified actions, never from client-only clicks.",
    icon: ShieldCheck,
  },
  {
    label: "Soft Currency",
    value: "FUN Money",
    detail: "High-frequency reward for quests, tips, boosts, and light social actions.",
    icon: Coins,
  },
  {
    label: "Token Layer",
    value: "Camly Coin",
    detail: "Lower-frequency, capped distribution with treasury, staking, and anti-fraud review.",
    icon: WalletCards,
  },
  {
    label: "Reputation",
    value: "Light Score",
    detail: "Non-transferable trust signal for positive behavior, moderation, and access gates.",
    icon: Sparkles,
  },
  {
    label: "Retention",
    value: "Streak + seasons",
    detail: "Daily return loop without forcing pay-to-win mechanics.",
    icon: Zap,
  },
  {
    label: "Community",
    value: "Earn together",
    detail: "Team quests and cooperative events reward positive group contribution.",
    icon: HeartHandshake,
  },
];

export const architectureLayers = [
  { label: "Client", detail: "React PWA, Telegram Mini App shell, WalletConnect, QR scan, push notifications" },
  { label: "Game API", detail: "Quest, pet, box, event, leaderboard, referral, inventory, and reward endpoints" },
  { label: "Trust Layer", detail: "AI moderation, device fingerprint, velocity checks, graph risk, manual review queue" },
  { label: "Reward Engine", detail: "Idempotent ledger, treasury budgets, caps, rarity tables, pending/approved payouts" },
  { label: "Data Layer", detail: "Supabase Postgres, RLS, realtime updates, analytics events, audit logs" },
  { label: "Web3 Layer", detail: "BNB Chain, custodial and non-custodial wallets, NFT minting, token distribution" },
];

export const roadmap: RoadmapPhase[] = [
  {
    phase: "MVP 1",
    title: "Quest and Reward Core",
    goals: ["Daily quest UI", "Reward ledger", "Light Score", "Basic leaderboard", "Admin balancing table"],
  },
  {
    phase: "MVP 2",
    title: "Pet and Mystery Box",
    goals: ["Light Pet profile", "Care actions", "Box inventory", "Server-side box opening", "NFT badge metadata"],
  },
  {
    phase: "MVP 3",
    title: "Treasure Hunt Events",
    goals: ["QR clues", "Team events", "Geo confidence", "Limited drops", "Viral share cards"],
  },
  {
    phase: "Scale",
    title: "Telegram and Web3 Economy",
    goals: ["Telegram Mini App", "BNB payouts", "Staking compatibility", "Marketplace", "Fraud analytics dashboard"],
  },
];

export const uiFlows = [
  { icon: BadgeCheck, label: "Onboarding", detail: "Choose Light Pet, accept Law of Light, receive first quest bundle." },
  { icon: Trophy, label: "Daily Home", detail: "Quest progress, streak, pet mood, box inventory, and leaderboard rank." },
  { icon: QrCode, label: "Treasure", detail: "Scan QR or solve clue, then submit proof to unlock event reward." },
  { icon: Bot, label: "AI Pet", detail: "Chat, feed, train, evolve, and unlock co-op quests with friends." },
  { icon: Gift, label: "Reward Popup", detail: "Show claim result, rarity, ledger status, and next best action." },
  { icon: BrainCircuit, label: "Moderation", detail: "AI reviews sentiment, repetition, risk score, and escalation cases." },
  { icon: Crown, label: "Season", detail: "Season pass style achievements without blocking free participation." },
  { icon: Users, label: "Viral Loop", detail: "Invite friends into team quests, shared boxes, and community puzzle events." },
];
