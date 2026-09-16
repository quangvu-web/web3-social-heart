import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Shield, AlertTriangle, UserCheck, Ban, Eye } from "lucide-react";

interface UserData {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  is_banned: boolean;
  pending_reward: number;
  approved_reward: number;
  posts_count?: number;
  comments_count?: number;
  created_at?: string;
}

interface UserReviewTabProps {
  users: UserData[];
  adminId: string;
  onRefresh: () => void;
}

const UserReviewTab = ({ users, adminId, onRefresh }: UserReviewTabProps) => {
  const [loading, setLoading] = useState<string | null>(null);

  // Calculate suspicion score
  const getSuspicionScore = (user: UserData): number => {
    let score = 0;
    
    // High pending reward (+40)
    if (user.pending_reward > 5000000) score += 40;
    else if (user.pending_reward > 2000000) score += 20;
    
    // No avatar (+15)
    if (!user.avatar_url) score += 15;
    
    // No name or short name (+15)
    if (!user.full_name || user.full_name.length < 3) score += 15;
    
    // No posts but high pending (+20)
    if ((user.posts_count || 0) === 0 && user.pending_reward > 100000) score += 20;
    
    // Very new account with high rewards
    if (user.created_at) {
      const daysSinceCreation = (Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceCreation < 7 && user.pending_reward > 500000) score += 25;
    }
    
    return Math.min(score, 100);
  };

  const getSuspicionLevel = (score: number): { level: string; color: string; bgColor: string } => {
    if (score >= 70) return { level: "Rất cao", color: "text-red-600", bgColor: "bg-red-100" };
    if (score >= 50) return { level: "Cao", color: "text-orange-600", bgColor: "bg-orange-100" };
    if (score >= 30) return { level: "Trung bình", color: "text-yellow-600", bgColor: "bg-yellow-100" };
    return { level: "Thấp", color: "text-green-600", bgColor: "bg-green-100" };
  };

  const categorizedUsers = useMemo(() => {
    const suspicious = users
      .filter(u => !u.is_banned && getSuspicionScore(u) >= 30)
      .sort((a, b) => getSuspicionScore(b) - getSuspicionScore(a));
    
    const banned = users.filter(u => u.is_banned);
    
    const verified = users.filter(u => 
      !u.is_banned && 
      getSuspicionScore(u) < 30 && 
      u.avatar_url && 
      (u.posts_count || 0) > 0
    );

    return { suspicious, banned, verified };
  }, [users]);

  const handleBanUser = async (user: UserData) => {
    setLoading(user.id);
    try {
      const { error } = await supabase.rpc('ban_user_permanently', {
        p_admin_id: adminId,
        p_user_id: user.id,
        p_reason: 'Tài khoản nghi ngờ lạm dụng hệ thống'
      });

      if (error) throw error;
      
      toast.success(`Đã cấm ${user.username}`);
      onRefresh();
    } catch (error: any) {
      console.error("Error banning user:", error);
      toast.error(error.message || "Lỗi khi cấm user");
    } finally {
      setLoading(null);
    }
  };

  const formatNumber = (num: number) => num.toLocaleString('vi-VN');

  const UserCard = ({ user, showBanButton = false }: { user: UserData; showBanButton?: boolean }) => {
    const score = getSuspicionScore(user);
    const { level, color, bgColor } = getSuspicionLevel(score);

    return (
      <div className="flex items-center gap-4 p-4 bg-background border rounded-lg hover:shadow-sm transition-shadow">
        <Avatar className="w-12 h-12">
          <AvatarImage src={user.avatar_url || ""} />
          <AvatarFallback>{user.username[0]?.toUpperCase()}</AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold truncate">{user.username}</p>
            {user.is_banned && (
              <Badge variant="destructive" className="text-xs">Đã cấm</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">{user.full_name || "Chưa có tên"}</p>
          <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
            <span>Pending: {formatNumber(user.pending_reward)}</span>
            <span>Posts: {user.posts_count || 0}</span>
          </div>
        </div>

        {!user.is_banned && (
          <div className={`px-3 py-1 rounded-full ${bgColor}`}>
            <span className={`text-sm font-semibold ${color}`}>
              {score}% - {level}
            </span>
          </div>
        )}

        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-1">
            <Eye className="w-4 h-4" />
            Xem
          </Button>
          {showBanButton && !user.is_banned && (
            <Button
              size="sm"
              variant="destructive"
              className="gap-1"
              onClick={() => handleBanUser(user)}
              disabled={loading === user.id}
            >
              <Ban className="w-4 h-4" />
              Cấm
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-blue-500" />
          Rà soát User
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="suspicious">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="suspicious" className="gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-500" />
              Nghi ngờ ({categorizedUsers.suspicious.length})
            </TabsTrigger>
            <TabsTrigger value="banned" className="gap-2">
              <Ban className="w-4 h-4 text-red-500" />
              Đã cấm ({categorizedUsers.banned.length})
            </TabsTrigger>
            <TabsTrigger value="verified" className="gap-2">
              <UserCheck className="w-4 h-4 text-green-500" />
              User thật ({categorizedUsers.verified.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="suspicious" className="max-h-[500px] overflow-y-auto space-y-3">
            {categorizedUsers.suspicious.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Không có user nghi ngờ nào
              </p>
            ) : (
              categorizedUsers.suspicious.map(user => (
                <UserCard key={user.id} user={user} showBanButton />
              ))
            )}
          </TabsContent>

          <TabsContent value="banned" className="max-h-[500px] overflow-y-auto space-y-3">
            {categorizedUsers.banned.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Không có user nào bị cấm
              </p>
            ) : (
              categorizedUsers.banned.map(user => (
                <UserCard key={user.id} user={user} />
              ))
            )}
          </TabsContent>

          <TabsContent value="verified" className="max-h-[500px] overflow-y-auto space-y-3">
            {categorizedUsers.verified.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Không có user đã xác thực
              </p>
            ) : (
              categorizedUsers.verified.map(user => (
                <UserCard key={user.id} user={user} />
              ))
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default UserReviewTab;
