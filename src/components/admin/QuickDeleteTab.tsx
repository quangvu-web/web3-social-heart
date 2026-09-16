import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Search, Trash2, Ban, AlertTriangle } from "lucide-react";

interface UserData {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  wallet_address: string | null;
  is_banned: boolean;
  pending_reward: number;
  approved_reward: number;
  posts_count?: number;
}

interface QuickDeleteTabProps {
  users: UserData[];
  adminId: string;
  onRefresh: () => void;
}

const QuickDeleteTab = ({ users, adminId, onRefresh }: QuickDeleteTabProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<UserData[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  
  // Ban confirmation dialog
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [banReason, setBanReason] = useState("");

  const handleSearch = () => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }
    
    const term = searchTerm.toLowerCase().trim();
    const results = users.filter(u => 
      u.id.toLowerCase() === term ||
      u.username.toLowerCase().includes(term) ||
      (u.wallet_address && u.wallet_address.toLowerCase().includes(term))
    );
    
    setSearchResults(results);
    
    if (results.length === 0) {
      toast.error("Không tìm thấy user");
    }
  };

  // High risk users suggestion
  const highRiskUsers = users
    .filter(u => !u.is_banned)
    .map(user => {
      let riskScore = 0;
      const reasons: string[] = [];
      
      // High pending with no posts
      if (user.pending_reward > 500000 && (user.posts_count || 0) === 0) {
        riskScore += 2;
        reasons.push("Pending cao, không bài viết");
      }
      
      // No avatar
      if (!user.avatar_url) {
        riskScore += 1;
        reasons.push("Không avatar");
      }
      
      // No name
      if (!user.full_name) {
        riskScore += 1;
        reasons.push("Không tên");
      }
      
      // Very high pending
      if (user.pending_reward > 2000000) {
        riskScore += 2;
        reasons.push("Pending rất cao");
      }
      
      return { ...user, riskScore, reasons };
    })
    .filter(u => u.riskScore >= 2)
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 10);

  const openBanDialog = (user: UserData) => {
    setSelectedUser(user);
    setBanReason("");
    setBanDialogOpen(true);
  };

  const handleBan = async () => {
    if (!selectedUser) return;
    if (!banReason.trim()) {
      toast.error("Vui lòng nhập lý do cấm");
      return;
    }

    setLoading(selectedUser.id);
    try {
      const { error } = await supabase.rpc('ban_user_permanently', {
        p_admin_id: adminId,
        p_user_id: selectedUser.id,
        p_reason: banReason
      });

      if (error) throw error;
      
      toast.success(`Đã cấm vĩnh viễn ${selectedUser.username}`);
      setBanDialogOpen(false);
      setSelectedUser(null);
      setSearchResults(prev => prev.filter(u => u.id !== selectedUser.id));
      onRefresh();
    } catch (error: any) {
      console.error("Error banning user:", error);
      toast.error(error.message || "Lỗi khi cấm user");
    } finally {
      setLoading(null);
    }
  };

  const formatNumber = (num: number) => num.toLocaleString('vi-VN');

  const getRiskBadge = (riskScore: number) => {
    if (riskScore >= 4) return <Badge className="bg-red-500">Rủi ro cao</Badge>;
    if (riskScore >= 2) return <Badge className="bg-yellow-500">Nghi ngờ</Badge>;
    return <Badge variant="outline">Theo dõi</Badge>;
  };

  const UserCard = ({ user, showRisk = false, riskScore = 0, reasons = [] }: { 
    user: UserData; 
    showRisk?: boolean; 
    riskScore?: number;
    reasons?: string[];
  }) => (
    <div className="flex items-center gap-4 p-4 border rounded-lg hover:shadow-sm transition-shadow">
      <Avatar className="w-12 h-12">
        <AvatarImage src={user.avatar_url || ""} />
        <AvatarFallback>{user.username[0]?.toUpperCase()}</AvatarFallback>
      </Avatar>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold truncate">{user.username}</p>
          {user.is_banned && <Badge variant="destructive">Đã cấm</Badge>}
          {showRisk && getRiskBadge(riskScore)}
        </div>
        <p className="text-xs text-muted-foreground font-mono truncate">{user.id}</p>
        {showRisk && reasons.length > 0 && (
          <p className="text-xs text-orange-600 mt-1">{reasons.join(" • ")}</p>
        )}
        <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
          <span>Pending: {formatNumber(user.pending_reward)}</span>
          <span>Approved: {formatNumber(user.approved_reward)}</span>
        </div>
      </div>

      {!user.is_banned && (
        <Button
          size="sm"
          variant="destructive"
          className="gap-1"
          onClick={() => openBanDialog(user)}
          disabled={loading === user.id}
        >
          <Ban className="w-4 h-4" />
          Cấm vĩnh viễn
        </Button>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Search Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Tìm & Xóa nhanh
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Nhập UUID, username hoặc wallet address..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1"
            />
            <Button onClick={handleSearch} className="gap-2">
              <Search className="w-4 h-4" />
              Tìm
            </Button>
          </div>

          {searchResults.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Tìm thấy {searchResults.length} kết quả
              </p>
              {searchResults.map(user => (
                <UserCard key={user.id} user={user} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* High Risk Suggestions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-500" />
            Gợi ý rủi ro cao ({highRiskUsers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {highRiskUsers.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Không có user rủi ro cao
            </p>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {highRiskUsers.map(user => (
                <UserCard 
                  key={user.id} 
                  user={user} 
                  showRisk 
                  riskScore={user.riskScore}
                  reasons={user.reasons}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ban Confirmation Dialog */}
      <Dialog open={banDialogOpen} onOpenChange={setBanDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" />
              Cấm vĩnh viễn tài khoản
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-red-50 rounded-lg border border-red-200">
              <p className="text-sm text-red-800">
                <strong>Cảnh báo:</strong> Hành động này sẽ:
              </p>
              <ul className="text-sm text-red-700 mt-2 list-disc list-inside">
                <li>Khóa tài khoản vĩnh viễn</li>
                <li>Reset toàn bộ thưởng về 0</li>
                <li>Đưa ví vào danh sách đen</li>
                <li>Gửi thông báo cho user</li>
              </ul>
            </div>
            
            <div>
              <p className="text-sm mb-2">
                Tài khoản: <strong>{selectedUser?.username}</strong>
              </p>
              <p className="text-sm text-muted-foreground">
                Pending: {formatNumber(selectedUser?.pending_reward || 0)} CAMLY
              </p>
            </div>
            
            <Textarea
              placeholder="Nhập lý do cấm (bắt buộc)..."
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBanDialogOpen(false)}>
              Hủy
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleBan} 
              disabled={loading !== null}
              className="gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Xác nhận cấm vĩnh viễn
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default QuickDeleteTab;
