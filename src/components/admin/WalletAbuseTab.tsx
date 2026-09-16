import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Wallet, Users, AlertTriangle, Ban } from "lucide-react";

interface UserData {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  wallet_address: string | null;
  is_banned: boolean;
  pending_reward: number;
}

interface WalletAbuseTabProps {
  users: UserData[];
  adminId: string;
  onRefresh: () => void;
}

const WalletAbuseTab = ({ users, adminId, onRefresh }: WalletAbuseTabProps) => {
  const [loading, setLoading] = useState<string | null>(null);

  // Detect shared wallets
  const sharedWallets = useMemo(() => {
    const walletGroups: Record<string, UserData[]> = {};
    
    users.forEach(user => {
      if (user.wallet_address && !user.is_banned) {
        const wallet = user.wallet_address.toLowerCase();
        if (!walletGroups[wallet]) walletGroups[wallet] = [];
        walletGroups[wallet].push(user);
      }
    });

    return Object.entries(walletGroups)
      .filter(([_, userList]) => userList.length > 1)
      .map(([wallet, userList]) => ({
        wallet_address: wallet,
        users: userList,
        total_pending: userList.reduce((sum, u) => sum + u.pending_reward, 0)
      }))
      .sort((a, b) => b.total_pending - a.total_pending);
  }, [users]);

  // Detect fake names
  const isFakeName = (name: string | null): boolean => {
    if (!name) return true;
    const trimmed = name.trim();
    
    if (trimmed.length < 3) return true;
    if (/^\d+$/.test(trimmed)) return true;
    if (/^[a-z]{1,4}\d{5,}$/i.test(trimmed)) return true;
    if (/^(test|user|admin|guest|demo|abc|xyz)\d*$/i.test(trimmed)) return true;
    
    return false;
  };

  const fakeNameUsers = useMemo(() => {
    return users
      .filter(u => !u.is_banned && isFakeName(u.full_name))
      .sort((a, b) => b.pending_reward - a.pending_reward);
  }, [users]);

  // Missing profile users
  const missingProfileUsers = useMemo(() => {
    return users
      .filter(u => !u.is_banned && !u.full_name && !u.avatar_url && u.pending_reward > 0)
      .sort((a, b) => b.pending_reward - a.pending_reward);
  }, [users]);

  const handleBanUser = async (user: UserData) => {
    setLoading(user.id);
    try {
      const { error } = await supabase.rpc('ban_user_permanently', {
        p_admin_id: adminId,
        p_user_id: user.id,
        p_reason: 'Lạm dụng ví/profile'
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

  const handleBanWalletGroup = async (walletGroup: { wallet_address: string; users: UserData[] }) => {
    setLoading(walletGroup.wallet_address);
    try {
      for (const user of walletGroup.users) {
        await supabase.rpc('ban_user_permanently', {
          p_admin_id: adminId,
          p_user_id: user.id,
          p_reason: `Ví dùng chung: ${walletGroup.wallet_address}`
        });
      }
      toast.success(`Đã cấm ${walletGroup.users.length} tài khoản dùng chung ví`);
      onRefresh();
    } catch (error: any) {
      console.error("Error banning wallet group:", error);
      toast.error(error.message || "Lỗi khi cấm nhóm");
    } finally {
      setLoading(null);
    }
  };

  const formatNumber = (num: number) => num.toLocaleString('vi-VN');
  const truncateAddress = (addr: string) => `${addr.slice(0, 8)}...${addr.slice(-6)}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="w-5 h-5 text-purple-500" />
          Phát hiện lạm dụng
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="shared">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="shared" className="gap-2">
              <Users className="w-4 h-4" />
              Ví chung ({sharedWallets.length})
            </TabsTrigger>
            <TabsTrigger value="fake" className="gap-2">
              <AlertTriangle className="w-4 h-4" />
              Tên ảo ({fakeNameUsers.length})
            </TabsTrigger>
            <TabsTrigger value="missing" className="gap-2">
              <Ban className="w-4 h-4" />
              Thiếu profile ({missingProfileUsers.length})
            </TabsTrigger>
          </TabsList>

          {/* Shared Wallets */}
          <TabsContent value="shared" className="max-h-[500px] overflow-y-auto space-y-4">
            {sharedWallets.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Không phát hiện ví dùng chung
              </p>
            ) : (
              sharedWallets.map((group, idx) => (
                <div key={idx} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-mono text-sm">{truncateAddress(group.wallet_address)}</p>
                      <p className="text-xs text-muted-foreground">
                        {group.users.length} tài khoản • Tổng pending: {formatNumber(group.total_pending)} CAMLY
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleBanWalletGroup(group)}
                      disabled={loading === group.wallet_address}
                    >
                      <Ban className="w-4 h-4 mr-1" />
                      Cấm tất cả
                    </Button>
                  </div>
                  <div className="grid gap-2">
                    {group.users.map(user => (
                      <div key={user.id} className="flex items-center gap-3 p-2 bg-muted/50 rounded">
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={user.avatar_url || ""} />
                          <AvatarFallback>{user.username[0]}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{user.username}</p>
                          <p className="text-xs text-muted-foreground">{formatNumber(user.pending_reward)} CAMLY</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          {/* Fake Names */}
          <TabsContent value="fake" className="max-h-[500px] overflow-y-auto space-y-3">
            {fakeNameUsers.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Không phát hiện tên ảo
              </p>
            ) : (
              fakeNameUsers.map(user => (
                <div key={user.id} className="flex items-center gap-4 p-3 border rounded-lg">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={user.avatar_url || ""} />
                    <AvatarFallback>{user.username[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-semibold">{user.username}</p>
                    <p className="text-xs text-muted-foreground">
                      Tên: {user.full_name || "(trống)"} • Pending: {formatNumber(user.pending_reward)}
                    </p>
                  </div>
                  <Badge variant="outline" className="bg-yellow-100 text-yellow-700">
                    Tên nghi ngờ
                  </Badge>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleBanUser(user)}
                    disabled={loading === user.id}
                  >
                    <Ban className="w-4 h-4" />
                  </Button>
                </div>
              ))
            )}
          </TabsContent>

          {/* Missing Profile */}
          <TabsContent value="missing" className="max-h-[500px] overflow-y-auto space-y-3">
            {missingProfileUsers.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Không có profile thiếu thông tin
              </p>
            ) : (
              missingProfileUsers.map(user => (
                <div key={user.id} className="flex items-center gap-4 p-3 border rounded-lg">
                  <Avatar className="w-10 h-10">
                    <AvatarFallback>{user.username[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-semibold">{user.username}</p>
                    <p className="text-xs text-muted-foreground">
                      Pending: {formatNumber(user.pending_reward)} CAMLY
                    </p>
                  </div>
                  <Badge variant="outline" className="bg-red-100 text-red-700">
                    Thiếu thông tin
                  </Badge>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleBanUser(user)}
                    disabled={loading === user.id}
                  >
                    <Ban className="w-4 h-4" />
                  </Button>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default WalletAbuseTab;
