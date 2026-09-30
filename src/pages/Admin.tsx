import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Shield, BarChart3, Gift, Users, Wallet, Trash2, Link2, LogOut, CloudUpload, GitMerge, DollarSign, ShieldAlert, Radio, Send, RadioTower, LineChart, MessageCircle, VolumeX, Crown, Zap, KeyRound, Search } from "lucide-react";

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


const removeDiacritics = (str: string) => {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

const tabsConfig = [
  { value: "overview", label: "Tổng quan", keywords: "overview dashboard" },
  { value: "users", label: "Users", keywords: "users nguoi dung" },
  { value: "security", label: "Security", keywords: "security app keys" },
  { value: "members", label: "Thành viên", keywords: "members thanh vien analytics" },
  { value: "financial", label: "Financial", keywords: "financial tai chinh" },
  { value: "rewards", label: "Duyệt thưởng", keywords: "rewards duyet thuong" },
  { value: "review", label: "Rà soát", keywords: "review ra soat" },
  { value: "abuse", label: "Lạm dụng", keywords: "abuse lam dung wallet" },
  { value: "delete", label: "Xóa nhanh", keywords: "delete xoa nhanh" },
  { value: "blockchain", label: "Blockchain", keywords: "blockchain" },
  { value: "migration", label: "Migration", keywords: "migration media" },
  { value: "live-recording", label: "Live Rec", keywords: "live recording" },
  { value: "merge", label: "Merge User", keywords: "merge user" },
  { value: "antisybil", label: "Anti-Sybil", keywords: "antisybil" },
  { value: "telegram", label: "TG Group", keywords: "telegram group register webhook webhook" },
  { value: "dm-bot", label: "DM Bot", keywords: "dm bot" },
  { value: "mutes", label: "Mutes", keywords: "mutes" },
  { value: "father", label: "Cha VT", keywords: "father cha vt" },
  { value: "ai-triggers", label: "AI Triggers", keywords: "ai triggers" },
  { value: "allowlists", label: "Allowlists", keywords: "allowlists" },
  { value: "restream", label: "Restream", keywords: "restream" },
  { value: "meditation", label: "Lịch Thiền", keywords: "meditation thien" },
  { value: "angel-persona", label: "Angel Persona", keywords: "angel persona" },
  { value: "ai-conversations", label: "AI Conversations", keywords: "ai conversations" },
  { value: "angel-channels", label: "Angel Channels", keywords: "angel channels camlychannel" },
  { value: "angel-memory", label: "Angel Memory", keywords: "angel memory tri nho" },
  { value: "feedback", label: "Feedback", keywords: "feedback gop y phan hoi" },
  { value: "cloud-usage", label: "Cloud Usage", keywords: "cloud usage cost compute edge function report bao cao" },
  { value: "prompt-versions", label: "Prompt Versions", keywords: "prompt versions versioning rollback publish sprint3" },
  { value: "feature-flags", label: "Feature Flags", keywords: "feature flags co bat tat runtime sprint4" },
  { value: "ai-ops", label: "AI Ops", keywords: "ai ops dashboard telemetry events sprint4 monitor" },
];




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
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserData[]>([]);
  const [activeTab, setActiveTab] = useState("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/feed");
        return;
      }

      setCurrentUserId(session.user.id);

      const { data: hasRole, error } = await supabase.rpc('has_role', {
        _user_id: session.user.id,
        _role: 'admin'
      });

      if (error || !hasRole) {
        toast.error("Bạn không có quyền truy cập trang này");
        navigate("/feed");
        return;
      }

      setIsAdmin(true);
      await loadAllUsers();
    } catch (error) {
      console.error("Error checking admin status:", error);
      navigate("/feed");
    } finally {
      setLoading(false);
    }
  };

  const loadAllUsers = async () => {
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
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredTabs = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const normalizedQuery = removeDiacritics(searchQuery.toLowerCase());
    return tabsConfig.filter((tab) => {
      const haystack = removeDiacritics(`${tab.label} ${tab.keywords}`.toLowerCase());
      return haystack.includes(normalizedQuery);
    });
  }, [searchQuery]);

  const stats = {
    totalUsers: users.length,
    pendingRewards: users.filter(u => u.pending_reward > 0).length,
    approvedRewards: users.filter(u => u.approved_reward > 0).length,
    onChainClaims: 0, // Will be loaded from reward_claims
    bannedUsers: users.filter(u => u.is_banned).length,
    suspiciousUsers: users.filter(u => !u.is_banned && (!u.avatar_url || !u.full_name)).length
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Đang kiểm tra quyền truy cập...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-[#f0f2f5] p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl shadow-lg">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Ultimate Admin Dashboard</h1>
              <p className="text-muted-foreground">FUN Profile - Trái tim điều hành</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => navigate("/")} className="gap-2">
            <LogOut className="w-4 h-4" />
            Thoát
          </Button>
        </div>

        {/* Tab Search */}
        <div ref={searchRef} className="relative mb-4 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Tìm tab: Angel Channels, Register webhook..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && filteredTabs.length > 0) {
                  setActiveTab(filteredTabs[0].value);
                  setSearchQuery("");
                  setSearchOpen(false);
                } else if (e.key === "Escape") {
                  setSearchOpen(false);
                }
              }}
              className="pl-9"
            />
          </div>
          {searchOpen && searchQuery.trim() && (
            <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
              {filteredTabs.length === 0 ? (
                <div className="px-3 py-2 text-sm text-muted-foreground">Không tìm thấy tab</div>
              ) : (
                filteredTabs.map((tab) => (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => {
                      setActiveTab(tab.value);
                      setSearchQuery("");
                      setSearchOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                  >
                    {tab.label}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="flex w-full flex-nowrap overflow-x-auto justify-start h-auto gap-1">
            <TabsTrigger value="overview" className="gap-2 py-3">
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">📊 Tổng quan</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2 py-3">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">👥 Users</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2 py-3">
              <KeyRound className="w-4 h-4" />
              <span className="hidden sm:inline">🔐 Security</span>
            </TabsTrigger>
            <TabsTrigger value="members" className="gap-2 py-3 relative">
              <LineChart className="w-4 h-4" />
              <span className="hidden sm:inline">👥 Thành viên</span>
              <span className="ml-1 text-[10px] bg-primary/20 text-primary px-1 rounded">Mới</span>
            </TabsTrigger>
            <TabsTrigger value="financial" className="gap-2 py-3">
              <DollarSign className="w-4 h-4" />
              <span className="hidden sm:inline">💰 Financial</span>
            </TabsTrigger>
            <TabsTrigger value="rewards" className="gap-2 py-3">
              <Gift className="w-4 h-4" />
              <span className="hidden sm:inline">🎁 Duyệt thưởng</span>
            </TabsTrigger>
            <TabsTrigger value="review" className="gap-2 py-3">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">🛡️ Rà soát</span>
            </TabsTrigger>
            <TabsTrigger value="abuse" className="gap-2 py-3">
              <Wallet className="w-4 h-4" />
              <span className="hidden sm:inline">💳 Lạm dụng</span>
            </TabsTrigger>
            <TabsTrigger value="delete" className="gap-2 py-3">
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">🗑️ Xóa nhanh</span>
            </TabsTrigger>
            <TabsTrigger value="blockchain" className="gap-2 py-3">
              <Link2 className="w-4 h-4" />
              <span className="hidden sm:inline">⛓️ Blockchain</span>
            </TabsTrigger>
            <TabsTrigger value="migration" className="gap-2 py-3">
              <CloudUpload className="w-4 h-4" />
              <span className="hidden sm:inline">☁️ Migration</span>
            </TabsTrigger>
            <TabsTrigger value="live-recording" className="gap-2 py-3">
              <Radio className="w-4 h-4" />
              <span className="hidden sm:inline">Live Rec</span>
            </TabsTrigger>
            <TabsTrigger value="merge" className="gap-2 py-3">
              <GitMerge className="w-4 h-4" />
              <span className="hidden sm:inline">🔗 Merge User</span>
            </TabsTrigger>
            <TabsTrigger value="antisybil" className="gap-2 py-3">
              <ShieldAlert className="w-4 h-4" />
              <span className="hidden sm:inline">🛡️ Anti-Sybil</span>
            </TabsTrigger>
            <TabsTrigger value="telegram" className="gap-2 py-3">
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">✈️ TG Group</span>
            </TabsTrigger>
            <TabsTrigger value="dm-bot" className="gap-2 py-3">
              <MessageCircle className="w-4 h-4" />
              <span className="hidden sm:inline">💬 DM Bot</span>
            </TabsTrigger>
            <TabsTrigger value="mutes" className="gap-2 py-3">
              <VolumeX className="w-4 h-4" />
              <span className="hidden sm:inline">🔇 Mutes</span>
            </TabsTrigger>
            <TabsTrigger value="father" className="gap-2 py-3">
              <Crown className="w-4 h-4" />
              <span className="hidden sm:inline">👑 Cha VT</span>
            </TabsTrigger>
            <TabsTrigger value="ai-triggers" className="gap-2 py-3">
              <Zap className="w-4 h-4" />
              <span className="hidden sm:inline">⚡ AI Triggers</span>
            </TabsTrigger>
            <TabsTrigger value="allowlists" className="gap-2 py-3">
              <ShieldAlert className="w-4 h-4" />
              <span className="hidden sm:inline">✅ Allowlists</span>
            </TabsTrigger>

            <TabsTrigger value="restream" className="gap-2 py-3">
              <RadioTower className="w-4 h-4" />
              <span className="hidden sm:inline">Restream</span>
            </TabsTrigger>
            <TabsTrigger value="meditation" className="gap-2 py-3">
              <span className="text-base leading-none">🌟</span>
              <span className="hidden sm:inline">Lịch Thiền</span>
            </TabsTrigger>
            <TabsTrigger value="angel-persona" className="gap-2 py-3">
              <span className="text-base leading-none">🕊️</span>
              <span className="hidden sm:inline">Angel Persona</span>
            </TabsTrigger>
            <TabsTrigger value="ai-conversations" className="gap-2 py-3">
              <span className="text-base leading-none">🗒️</span>
              <span className="hidden sm:inline">AI Conversations</span>
            </TabsTrigger>
            <TabsTrigger value="angel-channels" className="gap-2 py-3">
              <span className="text-base leading-none">📡</span>
              <span className="hidden sm:inline">Angel Channels</span>
            </TabsTrigger>
            <TabsTrigger value="angel-memory" className="gap-2 py-3">
              <span className="text-base leading-none">🧠</span>
              <span className="hidden sm:inline">Angel Memory</span>
            </TabsTrigger>
            <TabsTrigger value="feedback" className="gap-2 py-3">
              <span className="text-base leading-none">💌</span>
              <span className="hidden sm:inline">Feedback</span>
            </TabsTrigger>
          </TabsList>



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
            <BotDmUsersSection />
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

      </div>
    </div>
  );
};

export default Admin;
