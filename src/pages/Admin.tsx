import { useState, useEffect, useCallback, type ComponentType } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { toast } from "sonner";
import {
  Activity, BarChart3, ChartNoAxesCombined, CircleHelp, CloudUpload, Crown, DollarSign, FileClock,
  Gift, GitMerge, KeyRound, Link2, ListChecks, LogOut, Menu, MessageCircle,
  Radio, RadioTower, Send, Settings2, Shield, ShieldAlert, Sparkles, Trash2, Users, VolumeX, Wallet, Zap,
} from "lucide-react";

import OverviewTab from "@/components/admin/OverviewTab";
import RewardApprovalTab from "@/components/admin/RewardApprovalTab";
import UserReviewTab from "@/components/admin/UserReviewTab";
import WalletAbuseTab from "@/components/admin/WalletAbuseTab";
import QuickDeleteTab from "@/components/admin/QuickDeleteTab";
import BlockchainTab from "@/components/admin/BlockchainTab";
import MediaMigrationTab from "@/components/admin/MediaMigrationTab";
import { MergeRequestsTab } from "@/components/admin/MergeRequestsTab";
import FinancialTab from "@/components/admin/FinancialTab";
import AntiSybilTab from "@/components/admin/AntiSybilTab";
import LiveRecordingDebugTab from "@/components/admin/LiveRecordingDebugTab";
import TelegramGroupPanel from "@/components/admin/TelegramGroupPanel";
import RestreamMultistreamTab from "@/components/admin/RestreamMultistreamTab";
import MemberAnalyticsTab from "@/components/admin/MemberAnalyticsTab";
import BotDmUsersSection from "@/components/admin/BotDmUsersSection";
import CaptionOperatorsSection from "@/components/admin/CaptionOperatorsSection";
import TelegramMutesTab from "@/components/admin/TelegramMutesTab";
import TelegramFatherChannelTab from "@/components/admin/TelegramFatherChannelTab";
import TelegramAiTriggersTab from "@/components/admin/TelegramAiTriggersTab";
import TelegramAllowlistsTab from "@/components/admin/TelegramAllowlistsTab";
import SecurityAppKeysTab from "@/components/admin/SecurityAppKeysTab";
import UsersTab from "@/components/admin/UsersTab";
import AdminAngelPersonaTab from "@/components/admin/AdminAngelPersonaTab";
import AdminAiConversationsTab from "@/components/admin/AdminAiConversationsTab";
import AngelChannelsTab from "@/components/admin/AngelChannelsTab";
import FeedbackTab from "@/components/admin/FeedbackTab";
import AngelMemoryTab from "@/components/admin/AngelMemoryTab";
import CloudUsageTab from "@/components/admin/CloudUsageTab";
import AdminPromptVersionsTab from "@/components/admin/AdminPromptVersionsTab";
import AdminFeatureFlagsTab from "@/components/admin/AdminFeatureFlagsTab";
import AdminAiOpsTab from "@/components/admin/AdminAiOpsTab";
import AdminMeditation from "@/pages/AdminMeditation";
import {
  adminNavigationGroups,
  buildAdminTabSearch,
  resolveAdminTab,
  type AdminTab,
} from "@/components/admin/telegramOperationsConfig";
import { resolveAdminAccess } from "@/components/admin/adminAccess";

const adminTabIcons = {
  overview: BarChart3,
  users: Users,
  security: KeyRound,
  members: ChartNoAxesCombined,
  financial: DollarSign,
  rewards: Gift,
  review: ShieldAlert,
  abuse: Wallet,
  delete: Trash2,
  blockchain: Link2,
  migration: CloudUpload,
  "live-recording": Radio,
  merge: GitMerge,
  antisybil: ShieldAlert,
  telegram: Send,
  "dm-bot": MessageCircle,
  mutes: VolumeX,
  father: Crown,
  "ai-triggers": Zap,
  allowlists: ListChecks,
  restream: RadioTower,
  meditation: Sparkles,
  "angel-persona": Shield,
  "ai-conversations": MessageCircle,
  "angel-channels": Radio,
  "angel-memory": CircleHelp,
  feedback: MessageCircle,
  "cloud-usage": ChartNoAxesCombined,
  "prompt-versions": FileClock,
  "feature-flags": Settings2,
  "ai-ops": Activity,
} satisfies Record<AdminTab, ComponentType<{ className?: string }>>;

function AdminNavigation({ activeTab, onSelect }: { activeTab: AdminTab; onSelect: (tab: AdminTab) => void }) {
  return (
    <nav aria-label="Điều hướng Telegram Operations" className="space-y-5">
      {adminNavigationGroups.map((group) => (
        <section key={group.label} aria-label={group.label} className="space-y-1">
          <h2 className="px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</h2>
          <div className="space-y-1">
            {group.items.map((item) => {
              const Icon = adminTabIcons[item.value] ?? CircleHelp;
              const selected = activeTab === item.value;
              return (
                <button key={item.value} type="button" aria-current={selected ? "page" : undefined}
                  aria-pressed={selected} onClick={() => onSelect(item.value)}
                  className={`flex min-h-10 w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selected ? "bg-primary/10 font-medium text-primary" : "text-foreground hover:bg-muted"}`}>
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </nav>
  );
}




interface UserData {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  is_banned: boolean;
  pending_reward: number;
  approved_reward: number;
  wallet_address: string | null;
  reward_status: string;
  created_at: string;
  posts_count?: number;
  comments_count?: number;
  reactions_count?: number;
}

const Admin = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserData[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const activeTab = resolveAdminTab(searchParams);

  const selectTab = (tab: string) => {
    setSearchParams(new URLSearchParams(buildAdminTabSearch(location.search, tab as AdminTab).slice(1)));
    setMobileMenuOpen(false);
  };

  const [accessError, setAccessError] = useState<string | null>(null);

  useEffect(() => {
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    setLoading(true);
    setAccessError(null);
    const result = await resolveAdminAccess({
      // getSession chờ khôi phục phiên xong (kể cả refresh token) trước khi trả kết quả.
      getUserId: async () => {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        return session?.user.id ?? null;
      },
      hasRole: async (userId) => {
        const { data, error } = await supabase.rpc('has_role', { _user_id: userId, _role: 'admin' });
        return { data, error };
      },
      refreshSession: async () => { await supabase.auth.refreshSession(); },
    });

    if (result.status === "no-session") {
      navigate(`/auth?redirect=${encodeURIComponent(location.pathname + location.search)}`, { replace: true });
      return;
    }
    if (result.status === "denied") {
      toast.error("Tài khoản này không có quyền admin");
      navigate("/feed", { replace: true });
      return;
    }
    if (result.status === "error") {
      console.error("[Admin] Không xác minh được quyền admin:", result.reason);
      setAccessError(result.reason);
      setLoading(false);
      return;
    }

    setCurrentUserId(result.userId);
    setIsAdmin(true);
    setLoading(false);
    void loadAllUsers();
  };

  const loadAllUsers = useCallback(async () => {
    try {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      if (profiles) {
        // Get posts count for each user
        const { data: rewardsData } = await supabase.rpc('get_user_rewards', { limit_count: 500 });
        const rewardsMap = new Map(rewardsData?.map((r: any) => [r.id, r]) || []);

        const enrichedUsers = profiles.map(profile => {
          const rewardInfo = rewardsMap.get(profile.id) as any;
          return {
            ...profile,
            pending_reward: profile.pending_reward || 0,
            approved_reward: profile.approved_reward || 0,
            wallet_address: profile.wallet_address || null,
            reward_status: profile.reward_status || 'pending',
            posts_count: rewardInfo?.posts_count || 0,
            comments_count: rewardInfo?.comments_count || 0,
            reactions_count: rewardInfo?.reactions_count || 0,
          };
        });
        
        setUsers(enrichedUsers);
      }
    } catch (error) {
      console.error("Error loading users:", error);
    }
  }, []);

  useEffect(() => {
    if (isAdmin && ["rewards", "review", "abuse", "delete", "antisybil"].includes(activeTab)) {
      void loadAllUsers();
    }
  }, [isAdmin, activeTab, loadAllUsers]);

  const stats = {
    totalUsers: users.length,
    pendingRewards: users.filter((user) => user.pending_reward > 0).length,
    approvedRewards: users.filter((user) => user.approved_reward > 0).length,
    onChainClaims: 0,
    bannedUsers: users.filter((user) => user.is_banned).length,
    suspiciousUsers: users.filter((user) => !user.is_banned && (!user.avatar_url || !user.full_name)).length,
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4" role="status" aria-live="polite">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Đang kiểm tra quyền truy cập…</p>
        </div>
      </div>
    );
  }

  if (accessError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="max-w-md space-y-4 text-center" role="alert">
          <ShieldAlert className="mx-auto h-10 w-10 text-destructive" aria-hidden="true" />
          <h1 className="text-lg font-semibold text-foreground">Chưa xác minh được quyền truy cập</h1>
          <p className="text-sm text-muted-foreground">
            Không kiểm tra được quyền admin do lỗi kết nối hoặc phiên đăng nhập. Đây không phải kết luận rằng tài khoản không có quyền.
          </p>
          <p className="text-xs text-muted-foreground">Mã chẩn đoán: {accessError}</p>
          <div className="flex justify-center gap-2">
            <Button onClick={() => void checkAdminStatus()}>Thử lại</Button>
            <Button variant="outline" onClick={() => navigate("/")}>Về trang chủ</Button>
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-muted/30 text-foreground">
      <div className="mx-auto flex min-h-screen max-w-screen-2xl">
        <aside className="hidden w-72 shrink-0 border-r bg-background lg:flex xl:w-80">
          <div className="flex w-full flex-col gap-7 px-4 py-6">
            <div className="flex items-center gap-3 px-2">
              <div className="rounded-md bg-primary/10 p-2 text-primary"><Shield className="h-5 w-5" /></div>
              <div><p className="font-semibold">Telegram Operations</p><p className="text-xs text-muted-foreground">FUN Profile</p></div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto pr-1"><AdminNavigation activeTab={activeTab} onSelect={selectTab} /></div>
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex min-h-20 items-center justify-between gap-3 border-b bg-background px-4 py-3 md:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild><Button variant="outline" size="icon" className="shrink-0 lg:hidden" aria-label="Mở menu điều hướng"><Menu className="h-4 w-4" /></Button></SheetTrigger>
                <SheetContent side="left" className="w-[min(20rem,85vw)] overflow-y-auto">
                  <SheetHeader className="mb-6 pr-8 text-left"><SheetTitle>Telegram Operations</SheetTitle><SheetDescription>Điều hướng vận hành bot Telegram.</SheetDescription></SheetHeader>
                  <AdminNavigation activeTab={activeTab} onSelect={selectTab} />
                </SheetContent>
              </Sheet>
              <div className="min-w-0"><h1 className="truncate text-xl font-semibold md:text-2xl">Telegram Operations</h1><p className="hidden text-sm text-muted-foreground sm:block">Theo dõi bot, webhook và hoạt động cộng đồng.</p></div>
            </div>
            <Button variant="outline" onClick={() => navigate("/")} className="shrink-0"><LogOut className="h-4 w-4" /><span className="hidden sm:inline">Thoát</span></Button>
          </header>
          <main className="min-w-0 flex-1 overflow-x-hidden px-4 py-5 md:px-6 md:py-6">
            <Tabs value={activeTab} onValueChange={selectTab} className="min-w-0">
          <TabsContent value="overview">
            <OverviewTab stats={stats} />
          </TabsContent>

          <TabsContent value="financial">
            <FinancialTab />
          </TabsContent>

          <TabsContent value="rewards">
            <RewardApprovalTab 
              adminId={currentUserId!} 
              onRefresh={loadAllUsers} 
            />
          </TabsContent>

          <TabsContent value="review">
            <UserReviewTab 
              users={users} 
              adminId={currentUserId!} 
              onRefresh={loadAllUsers} 
            />
          </TabsContent>

          <TabsContent value="abuse">
            <WalletAbuseTab 
              users={users} 
              adminId={currentUserId!} 
              onRefresh={loadAllUsers} 
            />
          </TabsContent>

          <TabsContent value="delete">
            <QuickDeleteTab 
              users={users} 
              adminId={currentUserId!} 
              onRefresh={loadAllUsers} 
            />
          </TabsContent>

          <TabsContent value="blockchain">
            <BlockchainTab adminId={currentUserId!} />
          </TabsContent>

          <TabsContent value="migration">
            <MediaMigrationTab />
          </TabsContent>

          <TabsContent value="live-recording">
            <LiveRecordingDebugTab />
          </TabsContent>

          <TabsContent value="merge">
            <MergeRequestsTab />
          </TabsContent>

          <TabsContent value="antisybil">
            <AntiSybilTab adminId={currentUserId!} />
          </TabsContent>

          <TabsContent value="telegram">
            <TelegramGroupPanel />
          </TabsContent>

          <TabsContent value="dm-bot">
            <div className="space-y-6">
              <CaptionOperatorsSection />
              <BotDmUsersSection />
            </div>
          </TabsContent>

          <TabsContent value="mutes">
            <TelegramMutesTab />
          </TabsContent>

          <TabsContent value="father">
            <TelegramFatherChannelTab />
          </TabsContent>

          <TabsContent value="ai-triggers">
            <TelegramAiTriggersTab />
          </TabsContent>

          <TabsContent value="allowlists">
            <TelegramAllowlistsTab />
          </TabsContent>

          <TabsContent value="users">
            <UsersTab />
          </TabsContent>

          <TabsContent value="security">
            <SecurityAppKeysTab />
          </TabsContent>

          <TabsContent value="restream">
            <RestreamMultistreamTab />
          </TabsContent>


          <TabsContent value="members">
            <MemberAnalyticsTab />
          </TabsContent>

          <TabsContent value="meditation">
            <AdminMeditation />
          </TabsContent>

          <TabsContent value="angel-persona">
            <AdminAngelPersonaTab />
          </TabsContent>

          <TabsContent value="ai-conversations">
            <AdminAiConversationsTab />
          </TabsContent>

          <TabsContent value="angel-channels">
            <AngelChannelsTab />
          </TabsContent>

          <TabsContent value="angel-memory">
            <AngelMemoryTab />
          </TabsContent>

          <TabsContent value="feedback">
            <FeedbackTab />
          </TabsContent>

          <TabsContent value="cloud-usage">
            <CloudUsageTab />
          </TabsContent>

          <TabsContent value="prompt-versions">
            <AdminPromptVersionsTab />
          </TabsContent>

          <TabsContent value="feature-flags">
            <AdminFeatureFlagsTab />
          </TabsContent>

          <TabsContent value="ai-ops">
            <AdminAiOpsTab />
          </TabsContent>



            </Tabs>
          </main>
        </div>
      </div>
    </div>
  );
};

export default Admin;
