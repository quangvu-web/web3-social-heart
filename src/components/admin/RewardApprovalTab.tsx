import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, XCircle, Search, ArrowUpDown, Coins, RefreshCw, TrendingUp, Wallet } from "lucide-react";

interface UserWithReward {
  id: string;
  username: string;
  avatar_url: string | null;
  posts_count: number;
  comments_count: number;
  reactions_count: number;
  friends_count: number;
  shares_count: number;
  reactions_on_posts: number;
  livestreams_count: number;
  today_reward: number;
  total_reward: number;
  claimed_amount: number;
  claimable_amount: number;
}

interface RewardApprovalTabProps {
  adminId: string;
  onRefresh: () => void;
}

const RewardApprovalTab = ({ adminId, onRefresh }: RewardApprovalTabProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"claimable_desc" | "claimable_asc" | "total_desc">("claimable_desc");
  const [loading, setLoading] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [users, setUsers] = useState<UserWithReward[]>([]);
  
  // Reject dialog
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithReward | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    loadRewardData();
  }, []);

  const loadRewardData = async () => {
    setDataLoading(true);
    try {
      // Fetch reward data from RPC V2
      const { data: rewardsData, error: rewardsError } = await supabase.rpc('get_user_rewards_v2', { 
        limit_count: 1000 
      });

      if (rewardsError) throw rewardsError;

      // Fetch all claimed amounts
      const { data: claimsData, error: claimsError } = await supabase
        .from('reward_claims')
        .select('user_id, amount');

      if (claimsError) throw claimsError;

      // Build claimed map
      const claimedMap = new Map<string, number>();
      claimsData?.forEach(claim => {
        const current = claimedMap.get(claim.user_id) || 0;
        claimedMap.set(claim.user_id, current + claim.amount);
      });

      // Combine data
      const combinedUsers: UserWithReward[] = (rewardsData || []).map((r: any) => {
        const claimed = claimedMap.get(r.id) || 0;
        return {
          id: r.id,
          username: r.username,
          avatar_url: r.avatar_url,
          posts_count: Number(r.posts_count) || 0,
          comments_count: Number(r.comments_count) || 0,
          reactions_count: Number(r.reactions_count) || 0,
          friends_count: Number(r.friends_count) || 0,
          shares_count: Number(r.shares_count) || 0,
          reactions_on_posts: Number(r.reactions_on_posts) || 0,
          livestreams_count: Number(r.livestreams_count) || 0,
          today_reward: Number(r.today_reward) || 0,
          total_reward: Number(r.total_reward) || 0,
          claimed_amount: claimed,
          claimable_amount: Math.max(0, Number(r.total_reward) - claimed),
        };
      });

      setUsers(combinedUsers);
    } catch (error) {
      console.error("Error loading reward data:", error);
      toast.error("Lỗi khi tải dữ liệu thưởng");
    } finally {
      setDataLoading(false);
    }
  };

  // Filter users with claimable amount > 0
  const pendingUsers = users.filter(u => u.claimable_amount > 0);

  const filteredUsers = pendingUsers
    .filter(u => 
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.id.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      switch (sortBy) {
        case "claimable_desc":
          return b.claimable_amount - a.claimable_amount;
        case "claimable_asc":
          return a.claimable_amount - b.claimable_amount;
        case "total_desc":
          return b.total_reward - a.total_reward;
        default:
          return b.claimable_amount - a.claimable_amount;
      }
    });

  const handleApprove = async (user: UserWithReward) => {
    setLoading(user.id);
    try {
      // Update profile with approved amount
      const { error } = await supabase
        .from('profiles')
        .update({ 
          pending_reward: 0,
          approved_reward: user.claimable_amount,
          reward_status: 'approved'
        })
        .eq('id', user.id);

      if (error) throw error;
      
      // Record approval
      await supabase.from('reward_approvals').insert({
        user_id: user.id,
        amount: user.claimable_amount,
        status: 'approved',
        admin_id: adminId,
        admin_note: 'Đã duyệt thưởng (RPC V2)',
        reviewed_at: new Date().toISOString()
      });

      // Log the action
      await supabase.from('audit_logs').insert({
        admin_id: adminId,
        action: 'APPROVE_REWARD_V2',
        target_user_id: user.id,
        reason: 'Đã duyệt thưởng',
        details: { amount: user.claimable_amount, total_reward: user.total_reward }
      });
      
      toast.success(`Đã duyệt ${formatNumber(user.claimable_amount)} CAMLY cho ${user.username}`);
      loadRewardData();
      onRefresh();
    } catch (error: any) {
      console.error("Error approving reward:", error);
      toast.error(error.message || "Lỗi khi duyệt thưởng");
    } finally {
      setLoading(null);
    }
  };

  const openRejectDialog = (user: UserWithReward) => {
    setSelectedUser(user);
    setRejectReason("");
    setRejectDialogOpen(true);
  };

  const handleReject = async () => {
    if (!selectedUser) return;
    if (!rejectReason.trim()) {
      toast.error("Vui lòng nhập lý do từ chối");
      return;
    }

    setLoading(selectedUser.id);
    try {
      // Record rejection
      await supabase.from('reward_approvals').insert({
        user_id: selectedUser.id,
        amount: selectedUser.claimable_amount,
        status: 'rejected',
        admin_id: adminId,
        admin_note: rejectReason,
        reviewed_at: new Date().toISOString()
      });

      // Update status
      await supabase
        .from('profiles')
        .update({ reward_status: 'rejected' })
        .eq('id', selectedUser.id);

      // Log the action
      await supabase.from('audit_logs').insert({
        admin_id: adminId,
        action: 'REJECT_REWARD_V2',
        target_user_id: selectedUser.id,
        reason: rejectReason,
        details: { amount: selectedUser.claimable_amount }
      });
      
      toast.success(`Đã từ chối thưởng của ${selectedUser.username}`);
      setRejectDialogOpen(false);
      setSelectedUser(null);
      loadRewardData();
      onRefresh();
    } catch (error: any) {
      console.error("Error rejecting reward:", error);
      toast.error(error.message || "Lỗi khi từ chối thưởng");
    } finally {
      setLoading(null);
    }
  };

  const formatNumber = (num: number) => num.toLocaleString('vi-VN');

  // Calculate totals
  const totalClaimable = pendingUsers.reduce((sum, u) => sum + u.claimable_amount, 0);
  const totalRewardAll = users.reduce((sum, u) => sum + u.total_reward, 0);

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-200">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Coins className="w-8 h-8 text-yellow-600" />
              <div>
                <p className="text-sm text-muted-foreground">Tổng Claimable</p>
                <p className="text-xl font-bold text-yellow-700">{formatNumber(totalClaimable)} CAMLY</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-8 h-8 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">Tổng Reward (All Users)</p>
                <p className="text-xl font-bold text-green-700">{formatNumber(totalRewardAll)} CAMLY</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Wallet className="w-8 h-8 text-blue-600" />
              <div>
                <p className="text-sm text-muted-foreground">Đang chờ duyệt</p>
                <p className="text-xl font-bold text-blue-700">{pendingUsers.length} users</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Coins className="w-5 h-5 text-yellow-500" />
              Duyệt thưởng V2 ({filteredUsers.length} users)
            </CardTitle>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={loadRewardData}
              disabled={dataLoading}
              className="gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${dataLoading ? 'animate-spin' : ''}`} />
              Làm mới
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search and Sort */}
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Tìm theo username hoặc ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button 
              variant="outline"
              onClick={() => setSortBy(prev => {
                if (prev === "claimable_desc") return "claimable_asc";
                if (prev === "claimable_asc") return "total_desc";
                return "claimable_desc";
              })}
              className="gap-2"
            >
              <ArrowUpDown className="w-4 h-4" />
              {sortBy === "claimable_desc" && "Claimable ↓"}
              {sortBy === "claimable_asc" && "Claimable ↑"}
              {sortBy === "total_desc" && "Total ↓"}
            </Button>
          </div>

          {/* User List */}
          {dataLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="max-h-[500px] overflow-y-auto space-y-3">
              {filteredUsers.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Không có user nào đang chờ duyệt thưởng
                </p>
              ) : (
                filteredUsers.map((user) => (
                  <div 
                    key={user.id} 
                    className="flex items-center gap-4 p-4 bg-background border rounded-lg hover:shadow-sm transition-shadow"
                  >
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={user.avatar_url || ""} />
                      <AvatarFallback>{user.username[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold truncate">{user.username}</p>
                        {user.today_reward > 0 && (
                          <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                            +{formatNumber(user.today_reward)} hôm nay
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground font-mono truncate">{user.id}</p>
                      <div className="flex gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                        <span>📝 {user.posts_count}</span>
                        <span>❤️ {user.reactions_on_posts}</span>
                        <span>💬 {user.comments_count}</span>
                        <span>🔄 {user.shares_count}</span>
                        <span>👥 {user.friends_count}</span>
                        {user.livestreams_count > 0 && <span>📺 {user.livestreams_count}</span>}
                      </div>
                    </div>
                    
                    <div className="text-right min-w-[140px]">
                      <p className="text-lg font-bold text-yellow-600">
                        {formatNumber(user.claimable_amount)} CAMLY
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Total: {formatNumber(user.total_reward)}
                      </p>
                      <p className="text-xs text-green-600">
                        Claimed: {formatNumber(user.claimed_amount)}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="bg-green-500 hover:bg-green-600 text-white gap-1"
                        onClick={() => handleApprove(user)}
                        disabled={loading === user.id}
                      >
                        <CheckCircle className="w-4 h-4" />
                        Duyệt
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="gap-1"
                        onClick={() => openRejectDialog(user)}
                        disabled={loading === user.id}
                      >
                        <XCircle className="w-4 h-4" />
                        Từ chối
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Từ chối thưởng</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Từ chối thưởng của <strong>{selectedUser?.username}</strong> ({formatNumber(selectedUser?.claimable_amount || 0)} CAMLY)
            </p>
            <Textarea
              placeholder="Nhập lý do từ chối..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Hủy
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={loading !== null}>
              Xác nhận từ chối
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RewardApprovalTab;
