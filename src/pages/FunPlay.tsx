import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Boxes,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Coins,
  Gamepad2,
  Gift,
  Heart,
  History,
  Lock,
  MapPin,
  Medal,
  PawPrint,
  Play,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  Star,
  Trophy,
  Users,
  WalletCards,
  Zap,
} from "lucide-react";
import { FacebookNavbar } from "@/components/layout/FacebookNavbar";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  architectureLayers,
  economyRules,
  gamePillars,
  roadmap,
  uiFlows,
} from "@/features/fun-play/gameDesign";
import { formatReward, useFunPlay } from "@/features/fun-play/useFunPlay";

const demoDailyMissions = [
  {
    id: "demo-positive-comment",
    title: "Write 1 positive comment",
    description: "Create one helpful or kind comment in the community.",
    progress_count: 1,
    target_count: 1,
    completed_at: new Date().toISOString(),
    claimed_at: null,
    reward_type: "light_score" as const,
    reward_amount: 8,
    light_score_delta: 8,
    ai_moderation_required: true,
  },
  {
    id: "demo-create-post",
    title: "Create 1 community post",
    description: "Publish one original post that follows the Law of Light.",
    progress_count: 0,
    target_count: 1,
    completed_at: null,
    claimed_at: null,
    reward_type: "fun_money" as const,
    reward_amount: 25,
    light_score_delta: 5,
    ai_moderation_required: true,
  },
  {
    id: "demo-meditate",
    title: "Meditate 5 minutes",
    description: "Complete one short light meditation session.",
    progress_count: 3,
    target_count: 5,
    completed_at: null,
    claimed_at: null,
    reward_type: "xp" as const,
    reward_amount: 12,
    light_score_delta: 3,
    ai_moderation_required: false,
  },
];

const demoLeaderboard = [
  { username: "Camly", light_score: 9820, badge: "Light Guardian" },
  { username: "Trang", light_score: 7440, badge: "Quest Maker" },
  { username: "Tri", light_score: 6920, badge: "Treasure Scout" },
  { username: "Van", light_score: 6310, badge: "Pet Mentor" },
];

const boxRates = [
  { tier: "Common", rate: "64.0%", color: "bg-emerald-500" },
  { tier: "Rare", rate: "24.0%", color: "bg-sky-500" },
  { tier: "Epic", rate: "9.0%", color: "bg-violet-500" },
  { tier: "Legendary", rate: "2.7%", color: "bg-amber-500" },
  { tier: "Cosmic", rate: "0.3%", color: "bg-rose-500" },
];

const StatTile = ({ label, value, icon: Icon }: { label: string; value: string; icon: typeof Sparkles }) => (
  <div className="rounded-lg border border-white/15 bg-white/10 p-3 backdrop-blur">
    <Icon className="mb-2 h-5 w-5 text-amber-200" />
    <div className="text-lg font-bold text-white">{value}</div>
    <div className="text-xs text-white/70">{label}</div>
  </div>
);

const SectionTitle = ({ eyebrow, title }: { eyebrow: string; title: string }) => (
  <div className="mb-4">
    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
    <h2 className="text-2xl font-bold text-foreground">{title}</h2>
  </div>
);

const FunPlay = () => {
  const navigate = useNavigate();
  const [activePillar, setActivePillar] = useState(gamePillars[0].id);
  const {
    data: gameData,
    error,
    isLoading,
    isReady,
    completedQuestCount,
    claimedQuestCount,
    refetch,
    trackQuest,
    trackAction,
    claimQuest,
    openBox,
    petAction,
    isMutating,
  } = useFunPlay();
  const selectedPillar = useMemo(
    () => gamePillars.find((pillar) => pillar.id === activePillar) ?? gamePillars[0],
    [activePillar]
  );
  const dailyMissions = gameData?.quests?.length ? gameData.quests : demoDailyMissions;
  const leaderboard = gameData?.leaderboard?.length ? gameData.leaderboard : demoLeaderboard;
  const lightScore = gameData?.profile?.light_score ?? 8420;
  const unopenedBoxes = gameData?.unopenedBoxes ?? 3;
  const pet = gameData?.pet;
  const allQuestsClaimed = dailyMissions.length > 0 && claimedQuestCount >= dailyMissions.length;
  const nextReset = gameData?.nextDailyResetAt
    ? new Date(gameData.nextDailyResetAt).toLocaleString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
      })
    : "tomorrow";

  return (
    <div className="min-h-screen bg-background pb-20 lg:pb-0">
      <FacebookNavbar />

      <main className="pt-12 md:pt-14">
        <section className="relative overflow-hidden bg-[#0c1230] text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.32),transparent_30%),radial-gradient(circle_at_72%_18%,rgba(168,85,247,0.28),transparent_28%),linear-gradient(135deg,#0c1230_0%,#123d43_48%,#2a1857_100%)]" />
          <div className="relative mx-auto grid max-w-6xl gap-6 px-4 py-6 md:grid-cols-[1.1fr_0.9fr] md:py-10">
            <div className="flex min-h-[420px] flex-col justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(-1)}
                className="mb-6 w-fit gap-2 text-white hover:bg-white/10 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>

              <div>
                <div className="mb-4 flex w-fit items-center gap-2 rounded-full border border-amber-300/40 bg-white/10 px-3 py-1 text-sm text-amber-100">
                  <Gamepad2 className="h-4 w-4" />
                  FUN.Rich Mini Game System
                </div>
                <h1 className="max-w-2xl text-4xl font-black leading-tight md:text-6xl">
                  Free to join. Free to use. Earn together.
                </h1>
                <p className="mt-4 max-w-xl text-base text-white/78 md:text-lg">
                  A mobile-first game layer for FUN Profile: daily light quests, treasure hunts,
                  AI companion pets, mystery boxes, Light Score, NFT rewards, and BNB Chain payouts.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Button
                    className="gap-2 bg-amber-400 text-slate-950 hover:bg-amber-300"
                    onClick={() => (isReady ? refetch() : navigate("/auth"))}
                    disabled={isLoading}
                  >
                    <Play className="h-4 w-4" />
                    {isReady ? "Load Daily Quests" : "Sign in to Play"}
                  </Button>
                  <Button variant="outline" className="gap-2 border-white/30 bg-white/10 text-white hover:bg-white/15 hover:text-white">
                    <ShieldCheck className="h-4 w-4" />
                    Review Economy
                  </Button>
                </div>
              </div>

              <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatTile label="Daily missions" value={`${dailyMissions.length}`} icon={CheckCircle2} />
                <StatTile label="Core games" value="4" icon={Boxes} />
                <StatTile label="Completed" value={`${completedQuestCount}`} icon={Coins} />
                <StatTile label="Claimed" value={`${claimedQuestCount}`} icon={Users} />
              </div>
            </div>

            <div className="grid content-end gap-3">
              <div className="rounded-lg border border-white/15 bg-white/10 p-4 backdrop-blur-xl">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white/70">Today Light Score</p>
                    <p className="text-3xl font-black">{lightScore.toLocaleString("en-US")}</p>
                  </div>
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-300 text-slate-950">
                    <Sparkles className="h-7 w-7" />
                  </div>
                </div>
                <div className="space-y-3">
                  {dailyMissions.map((mission) => {
                    const value = Math.round((mission.progress_count / mission.target_count) * 100);
                    const isComplete = Boolean(mission.completed_at);
                    const isClaimed = Boolean(mission.claimed_at);
                    return (
                      <div key={mission.title} className="rounded-lg bg-white/10 p-3">
                        <div className="mb-2 flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold">{mission.title}</p>
                            <p className="text-xs text-white/60">{formatReward(mission)}</p>
                          </div>
                          {isComplete ? <CheckCircle2 className="h-5 w-5 text-emerald-300" /> : <Clock3 className="h-5 w-5 text-amber-200" />}
                        </div>
                        <Progress value={value} className="h-2 bg-white/15" />
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className="text-xs text-white/60">
                            {mission.progress_count}/{mission.target_count}
                          </span>
                          {isClaimed ? (
                            <Badge className="rounded-full bg-emerald-400 text-emerald-950 hover:bg-emerald-400">Claimed</Badge>
                          ) : isComplete ? (
                            <Button
                              size="sm"
                              className="h-8 bg-amber-300 text-slate-950 hover:bg-amber-200"
                              onClick={() => claimQuest(mission.id)}
                              disabled={!isReady || isMutating || mission.id.startsWith("demo")}
                            >
                              Claim
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 border-white/25 bg-white/10 text-white hover:bg-white/15 hover:text-white"
                              onClick={() => trackQuest(mission.id)}
                              disabled={!isReady || isMutating || mission.id.startsWith("demo")}
                            >
                              Record
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {allQuestsClaimed && (
                  <div className="mt-4 rounded-lg border border-emerald-300/30 bg-emerald-300/15 p-3">
                    <p className="text-sm font-bold text-emerald-100">Daily Light complete</p>
                    <p className="text-xs text-white/70">New quests reset at {nextReset}. Keep earning through posts, comments, pet care, and events.</p>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-white/15 bg-white/10 p-3 text-center">
                  <PawPrint className="mx-auto mb-2 h-6 w-6 text-emerald-200" />
                  <p className="text-sm font-bold">Aura Pet</p>
                  <p className="text-xs text-white/60">Level {pet?.level ?? 12}</p>
                </div>
                <div className="rounded-lg border border-white/15 bg-white/10 p-3 text-center">
                  <Gift className="mx-auto mb-2 h-6 w-6 text-amber-200" />
                  <p className="text-sm font-bold">Boxes</p>
                  <p className="text-xs text-white/60">{unopenedBoxes} ready</p>
                </div>
                <div className="rounded-lg border border-white/15 bg-white/10 p-3 text-center">
                  <WalletCards className="mx-auto mb-2 h-6 w-6 text-sky-200" />
                  <p className="text-sm font-bold">BNB</p>
                  <p className="text-xs text-white/60">Ready</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-white/25 bg-white/10 text-white hover:bg-white/15 hover:text-white"
                  onClick={() => petAction("feed")}
                  disabled={!isReady || isMutating}
                >
                  Feed
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-white/25 bg-white/10 text-white hover:bg-white/15 hover:text-white"
                  onClick={() => petAction("meditate")}
                  disabled={!isReady || isMutating}
                >
                  Meditate
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-white/25 bg-white/10 text-white hover:bg-white/15 hover:text-white"
                  onClick={() => petAction("train")}
                  disabled={!isReady || isMutating}
                >
                  Train
                </Button>
              </div>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-6xl space-y-8 px-4 py-6 md:py-8">
          {error && (
            <section className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-bold">FUN Play backend is not ready yet</p>
                  <p className="text-sm">
                    Deploy the latest Supabase migration, then refresh this page. Demo content remains visible for review.
                  </p>
                </div>
                <Button size="sm" variant="outline" className="gap-2 border-amber-400" onClick={() => refetch()}>
                  <RefreshCcw className="h-4 w-4" />
                  Retry
                </Button>
              </div>
            </section>
          )}

          <section>
            <SectionTitle eyebrow="Game Systems" title="Four loops that make the community return" />
            <div className="mb-4 rounded-lg border bg-card p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-bold">Mini Game Session</h3>
                  <p className="text-sm text-muted-foreground">
                    Complete this light demo session to progress the "Play 1 mini game" quest.
                  </p>
                </div>
                <Button
                  className="gap-2"
                  onClick={() => trackAction("play_minigame_1")}
                  disabled={!isReady || isMutating}
                >
                  <Gamepad2 className="h-4 w-4" />
                  Complete Mini Game
                </Button>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              {gamePillars.map((pillar) => (
                <button
                  key={pillar.id}
                  onClick={() => setActivePillar(pillar.id)}
                  className={`min-h-[132px] rounded-lg border p-4 text-left transition ${
                    activePillar === pillar.id
                      ? "border-primary bg-primary text-primary-foreground shadow-md"
                      : "border-border bg-card hover:border-gold/70"
                  }`}
                >
                  <pillar.icon className="mb-3 h-7 w-7" />
                  <p className="font-bold">{pillar.title}</p>
                  <p className={`mt-1 text-sm ${activePillar === pillar.id ? "text-white/80" : "text-muted-foreground"}`}>
                    {pillar.subtitle}
                  </p>
                </button>
              ))}
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr_1fr]">
              <div className="rounded-lg border bg-card p-4">
                <h3 className="mb-3 font-bold">Gameplay Loop</h3>
                <div className="space-y-2">
                  {selectedPillar.loop.map((item, index) => (
                    <div key={item} className="flex gap-3 text-sm">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                        {index + 1}
                      </span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border bg-card p-4">
                <h3 className="mb-3 font-bold">Rewards and MVP</h3>
                <div className="mb-4 flex flex-wrap gap-2">
                  {selectedPillar.rewards.map((reward) => (
                    <Badge key={reward} variant="secondary" className="rounded-full">
                      {reward}
                    </Badge>
                  ))}
                </div>
                <div className="space-y-2">
                  {selectedPillar.mvp.map((item) => (
                    <div key={item} className="flex items-center gap-2 text-sm">
                      <Star className="h-4 w-4 text-gold" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border bg-card p-4">
                <h3 className="mb-3 font-bold">Anti-Cheat Design</h3>
                <div className="space-y-2">
                  {selectedPillar.antiCheat.map((item) => (
                    <div key={item} className="flex items-start gap-2 text-sm">
                      <Lock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <SectionTitle eyebrow="Reward Economy" title="Sustainable by ledger, caps, and trust" />
              <div className="grid gap-3 sm:grid-cols-2">
                {economyRules.map((rule) => (
                  <div key={rule.label} className="rounded-lg border bg-card p-4">
                    <rule.icon className="mb-3 h-6 w-6 text-primary" />
                    <p className="text-sm text-muted-foreground">{rule.label}</p>
                    <p className="font-bold">{rule.value}</p>
                    <p className="mt-2 text-sm text-muted-foreground">{rule.detail}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <SectionTitle eyebrow="Mystery Box" title="Rarity and jackpot control" />
              <div className="rounded-lg border bg-card p-4">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="font-bold">Season 1 Cosmic Box</p>
                    <p className="text-sm text-muted-foreground">Server-side probability table</p>
                  </div>
                  <Gift className="h-9 w-9 text-gold" />
                </div>
                <div className="space-y-3">
                  {boxRates.map((rate) => (
                    <div key={rate.tier}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span>{rate.tier}</span>
                        <span className="font-semibold">{rate.rate}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div className={`h-full ${rate.color}`} style={{ width: rate.rate }} />
                      </div>
                    </div>
                  ))}
                </div>
                <Button
                  className="mt-5 w-full gap-2"
                  onClick={() => openBox()}
                  disabled={!isReady || isMutating || unopenedBoxes <= 0}
                >
                  <Zap className="h-4 w-4" />
                  Open Mystery Box
                </Button>
              </div>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <SectionTitle eyebrow="Player State" title="What to do after today's claims" />
              <div className="rounded-lg border bg-card p-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground">Next reset</p>
                    <p className="font-bold">{nextReset}</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground">Inventory</p>
                    <p className="font-bold">{gameData?.inventoryCount ?? 0} items</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3">
                    <p className="text-xs text-muted-foreground">Pet mood</p>
                    <p className="font-bold">{pet?.mood ?? 80}/100</p>
                  </div>
                </div>
                <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                  <p>Create a post to progress community quests.</p>
                  <p>Write helpful comments to earn Light Score.</p>
                  <p>Open boxes when available, then check reward status below.</p>
                </div>
              </div>
            </div>

            <div>
              <SectionTitle eyebrow="Reward Ledger" title="Recent rewards" />
              <div className="rounded-lg border bg-card">
                {(gameData?.recentRewards?.length ?? 0) === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground">No rewards yet. Complete a quest to start the ledger.</div>
                ) : (
                  gameData?.recentRewards?.map((reward) => (
                    <div key={reward.id} className="flex items-center gap-3 border-b p-4 last:border-b-0">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <History className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold capitalize">{reward.reward_type.replace(/_/g, " ")}</p>
                        <p className="text-xs text-muted-foreground capitalize">{reward.source_type.replace(/_/g, " ")}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-primary">{reward.amount.toLocaleString("en-US")}</p>
                        <Badge variant={reward.status === "approved" ? "default" : "secondary"} className="rounded-full">
                          {reward.status}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>

          <section>
            <SectionTitle eyebrow="Architecture" title="Production-ready system layers" />
            <div className="grid gap-3 md:grid-cols-3">
              {architectureLayers.map((layer) => (
                <div key={layer.label} className="rounded-lg border bg-card p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-bold">{layer.label}</h3>
                    <ChevronRight className="h-5 w-5 text-gold" />
                  </div>
                  <p className="text-sm text-muted-foreground">{layer.detail}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <SectionTitle eyebrow="Leaderboard" title="Positive energy ranking" />
              <div className="rounded-lg border bg-card">
                {leaderboard.map((user, index) => (
                  <div key={user.username} className="flex items-center gap-3 border-b p-4 last:border-b-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold">{user.username}</p>
                      <p className="text-xs text-muted-foreground">{"badge" in user ? user.badge : `${user.streak_days} day streak`}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-primary">{user.light_score.toLocaleString("en-US")}</p>
                      <p className="text-xs text-muted-foreground">Light</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <SectionTitle eyebrow="UI/UX Flow" title="Mobile-first screens for MVP" />
              <div className="grid gap-3 sm:grid-cols-2">
                {uiFlows.map((flow) => (
                  <div key={flow.label} className="rounded-lg border bg-card p-4">
                    <flow.icon className="mb-3 h-6 w-6 text-primary" />
                    <p className="font-bold">{flow.label}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{flow.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section>
            <SectionTitle eyebrow="Roadmap" title="From MVP to Telegram and Web3 scale" />
            <div className="grid gap-3 md:grid-cols-4">
              {roadmap.map((item) => (
                <div key={item.phase} className="rounded-lg border bg-card p-4">
                  <Badge className="mb-3 rounded-full">{item.phase}</Badge>
                  <h3 className="font-bold">{item.title}</h3>
                  <div className="mt-3 space-y-2">
                    {item.goals.map((goal) => (
                      <div key={goal} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <Medal className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                        {goal}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border bg-card p-4 md:p-6">
            <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">MVP Decision</p>
                <h2 className="text-2xl font-bold">Start with Daily Light Quest + Reward Ledger</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  This gives FUN Profile the fastest retention loop, produces clean data for anti-cheat,
                  and prepares the economy before Camly Coin or NFT rewards are distributed on-chain.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:w-[420px]">
                <Badge variant="secondary" className="justify-center rounded-full py-2">
                  <Heart className="mr-1 h-3.5 w-3.5" />
                  Positive
                </Badge>
                <Badge variant="secondary" className="justify-center rounded-full py-2">
                  <MapPin className="mr-1 h-3.5 w-3.5" />
                  Viral
                </Badge>
                <Badge variant="secondary" className="justify-center rounded-full py-2">
                  <Trophy className="mr-1 h-3.5 w-3.5" />
                  Ranked
                </Badge>
                <Badge variant="secondary" className="justify-center rounded-full py-2">
                  <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                  Audited
                </Badge>
              </div>
            </div>
          </section>
        </div>
      </main>

      <MobileBottomNav />
    </div>
  );
};

export default FunPlay;
