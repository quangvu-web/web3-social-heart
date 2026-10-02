import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Shield, AlertTriangle, Fingerprint, Clock, Ban, Snowflake, RefreshCw, Search, Download, Play, History, Wallet } from "lucide-react";

interface TrustUser {
  user_id: string;
  trust_score: number;
  account_age_score: number;
  engagement_score: number;
  report_penalty: number;
  fingerprint_penalty: number;
  is_flagged: boolean;
  flag_reason: string | null;
  updated_at: string;
  username?: string;
  avatar_url?: string;
}

interface DeviceCluster {
  device_hash: string;
  user_count: number;
  user_ids: string[];
  usernames: string[];
}

interface PendingReward {
  id: string;
  user_id: string;
  amount: number;
  action_type: string;
  status: string;
  created_at: string;
  unlock_at: string;
  username?: string;
}

interface AuditLog {
  id: string;
  admin_id: string;
  action: string;
  details: any;
  reason: string | null;
  created_at: string;
}

interface SuspiciousWallet {
  user_id: string;
  username: string;
  wallet_address: string | null;
  duplicate_users: string[];
}

interface AntiSybilTabProps {
  adminId: string;
}

const AntiSybilTab = ({ adminId }: AntiSybilTabProps) => {
  const [flaggedUsers, setFlaggedUsers] = useState<TrustUser[]>([]);
  const [lowTrustUsers, setLowTrustUsers] = useState<TrustUser[]>([]);
  const [deviceClusters, setDeviceClusters] = useState<DeviceCluster[]>([]);
  const [pendingRewards, setPendingRewards] = useState<PendingReward[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [suspiciousWallets, setSuspiciousWallets] = useState<SuspiciousWallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [auditRunning, setAuditRunning] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [trustRange, setTrustRange] = useState({ min: 0, max: 100 });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadFlaggedUsers(),
        loadLowTrustUsers(),
        loadDeviceClusters(),
        loadPendingRewards(),
        loadAuditLogs(),
        loadSuspiciousWallets(),
      ]);
    } finally {
      setLoading(false);
    }
  };

  const loadFlaggedUsers = async () => {
    const { data } = await supabase
      .from("user_trust")
      .select("*")
      .eq("is_flagged", true)
      .order("trust_score", { ascending: true });

    if (data && data.length > 0) {
      const userIds = data.map(d => d.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .in("id", userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      setFlaggedUsers(data.map(d => ({
        ...d,
        username: profileMap.get(d.user_id)?.username,
        avatar_url: profileMap.get(d.user_id)?.avatar_url,
      })));
    } else {
      setFlaggedUsers([]);
    }
  };

  const loadLowTrustUsers = async () => {
    const { data } = await supabase
      .from("user_trust")
      .select("*")
      .lt("trust_score", 30)
      .order("trust_score", { ascending: true })
      .limit(50);

    if (data && data.length > 0) {
      const userIds = data.map(d => d.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .in("id", userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      setLowTrustUsers(data.map(d => ({
        ...d,
        username: profileMap.get(d.user_id)?.username,
        avatar_url: profileMap.get(d.user_id)?.avatar_url,
      })));
    } else {
      setLowTrustUsers([]);
    }
  };

  const loadDeviceClusters = async () => {
    const { data, error } = await supabase.rpc("detect_device_clusters");
    if (error) {
      console.error("Error loading device clusters:", error);
      setDeviceClusters([]);
    } else {
      setDeviceClusters((data || []) as unknown as DeviceCluster[]);
    }
  };

  const loadPendingRewards = async () => {
    const { data } = await supabase
      .from("reward_pending")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(100);

    if (data && data.length > 0) {
      const userIds = [...new Set(data.map(d => d.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username")
        .in("id", userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      setPendingRewards(data.map(d => ({
        ...d,
        username: profileMap.get(d.user_id)?.username,
      })));
    } else {
      setPendingRewards([]);
    }
  };

  const loadAuditLogs = async () => {
    const { data } = await supabase
      .from("audit_logs")
      .select("*")
      .eq("action", "RANDOM_AUDIT")
      .order("created_at", { ascending: false })
      .limit(20);

    setAuditLogs(data || []);
  };

  const loadSuspiciousWallets = async () => {
    // Find wallets shared by multiple users
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username, wallet_address")
      .not("wallet_address", "is", null);

    if (!profiles) {
      setSuspiciousWallets([]);
      return;
    }

    const walletMap = new Map<string, { user_id: string; username: string }[]>();
    for (const p of profiles) {
      if (!p.wallet_address) continue;
      const addr = p.wallet_address.toLowerCase();
      if (!walletMap.has(addr)) walletMap.set(addr, []);
      walletMap.get(addr)!.push({ user_id: p.id, username: p.username });
    }

    const suspicious: SuspiciousWallet[] = [];
    for (const [addr, users] of walletMap) {
      if (users.length > 1) {
        for (const u of users) {
          suspicious.push({
            user_id: u.user_id,
            username: u.username,
            wallet_address: addr,
            duplicate_users: users.filter(x => x.user_id !== u.user_id).map(x => x.username),
          });
        }
      }
    }
    setSuspiciousWallets(suspicious);
  };

  const handleFreeze = async (userId: string) => {
    const { error } = await supabase
      .from("user_trust")
      .update({ is_flagged: true, flag_reason: "Admin flagged for review" })
      .eq("user_id", userId);

    if (error) {
      toast.error("Lỗi khi freeze user");
    } else {
      await supabase
        .from("reward_pending")
        .update({ status: "frozen" })
        .eq("user_id", userId)
        .eq("status", "pending");

      toast.success("Đã freeze tài khoản");
      loadData();
    }
  };

  const handleUnfreeze = async (userId: string) => {
    const { error } = await supabase
      .from("user_trust")
      .update({ is_flagged: false, flag_reason: null })
      .eq("user_id", userId);

    if (error) {
      toast.error("Lỗi khi unfreeze");
    } else {
      toast.success("Đã unfreeze tài khoản");
      loadData();
    }
  };

  const handleBanAndBurn = async (userId: string) => {
    if (!window.confirm(`Cấm VĨNH VIỄN và hủy thưởng của tài khoản ${userId.slice(0, 8)}…?\n\nThao tác này không thể hoàn tác.`)) return;
    const { error } = await supabase.rpc("ban_user_permanently", {
      p_admin_id: adminId,
      p_user_id: userId,
      p_reason: "Anti-Sybil: Bot/Farm detected",
    });

    if (error) {
      toast.error("Lỗi khi ban user: " + error.message);
    } else {
      await supabase
        .from("reward_pending")
        .update({ status: "rejected", processed_at: new Date().toISOString() })
        .eq("user_id", userId);

      toast.success("Đã ban user và burn pending rewards");
      loadData();
    }
  };

  const handleBulkFreeze = async () => {
    if (selectedUsers.size === 0) {
      toast.error("Chọn ít nhất 1 user");
      return;
    }

    let success = 0;
    for (const userId of selectedUsers) {
      const { error } = await supabase
        .from("user_trust")
        .update({ is_flagged: true, flag_reason: "Bulk freeze by admin" })
        .eq("user_id", userId);

      if (!error) success++;
    }

    toast.success(`Đã freeze ${success}/${selectedUsers.size} tài khoản`);
    setSelectedUsers(new Set());
    loadData();
  };

  const handleRecalcTrust = async (userId: string) => {
    const { data, error } = await supabase.rpc("calculate_trust_score", { p_user_id: userId });
    if (error) {
      toast.error("Lỗi tính lại trust: " + error.message);
    } else {
      toast.success(`Trust score mới: ${data}`);
      loadData();
    }
  };

  const handleRunAudit = async () => {
    setAuditRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('random-audit');
      if (error) {
        toast.error("Lỗi chạy audit: " + error.message);
      } else {
        toast.success(`Audit hoàn tất: ${data.audited} kiểm tra, ${data.flagged} flagged`);
        loadData();
      }
    } catch (e: any) {
      toast.error("Lỗi: " + e.message);
    } finally {
      setAuditRunning(false);
    }
  };

  const handleExportCSV = useCallback(() => {
    const rows = flaggedUsers.map(u => ({
      username: u.username || 'unknown',
      user_id: u.user_id,
      trust_score: u.trust_score,
      flag_reason: u.flag_reason || '',
      account_age: u.account_age_score,
      engagement: u.engagement_score,
      report_penalty: u.report_penalty,
      fingerprint_penalty: u.fingerprint_penalty,
    }));

    if (rows.length === 0) {
      toast.error("Không có dữ liệu để xuất");
      return;
    }

    const headers = Object.keys(rows[0]).join(',');
    const csv = [headers, ...rows.map(r => Object.values(r).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flagged-users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Đã xuất CSV");
  }, [flaggedUsers]);

  const getTrustBadge = (score: number) => {
    if (score >= 70) return <Badge className="bg-green-600/20 text-green-600">Tin cậy ({score})</Badge>;
    if (score >= 30) return <Badge className="bg-yellow-600/20 text-yellow-600">Bình thường ({score})</Badge>;
    return <Badge className="bg-red-600/20 text-red-600">Cảnh báo ({score})</Badge>;
  };

  const toggleSelect = (userId: string) => {
    const next = new Set(selectedUsers);
    if (next.has(userId)) next.delete(userId);
    else next.add(userId);
    setSelectedUsers(next);
  };

  // Filter users by search query
  const filterUsers = (users: TrustUser[]) => {
    let filtered = users;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(u => u.username?.toLowerCase().includes(q) || u.user_id.includes(q));
    }
    filtered = filtered.filter(u => u.trust_score >= trustRange.min && u.trust_score <= trustRange.max);
    return filtered;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <AlertTriangle className="w-6 h-6 mx-auto mb-2 text-red-500" />
            <div className="text-2xl font-bold">{flaggedUsers.length}</div>
            <div className="text-sm text-muted-foreground">Flagged</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Shield className="w-6 h-6 mx-auto mb-2 text-yellow-500" />
            <div className="text-2xl font-bold">{lowTrustUsers.length}</div>
            <div className="text-sm text-muted-foreground">Low Trust</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Fingerprint className="w-6 h-6 mx-auto mb-2 text-purple-500" />
            <div className="text-2xl font-bold">{deviceClusters.length}</div>
            <div className="text-sm text-muted-foreground">Device Clusters</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Wallet className="w-6 h-6 mx-auto mb-2 text-orange-500" />
            <div className="text-2xl font-bold">{suspiciousWallets.length}</div>
            <div className="text-sm text-muted-foreground">Suspicious Wallets</div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filter Bar */}
      <Card>
        <CardContent className="p-4 flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Tìm username hoặc user ID..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="flex-1"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Trust:</span>
            <Input
              type="number"
              value={trustRange.min}
              onChange={e => setTrustRange(prev => ({ ...prev, min: Number(e.target.value) }))}
              className="w-16"
              min={0}
              max={100}
            />
            <span>-</span>
            <Input
              type="number"
              value={trustRange.max}
              onChange={e => setTrustRange(prev => ({ ...prev, max: Number(e.target.value) }))}
              className="w-16"
              min={0}
              max={100}
            />
          </div>
          <Button variant="outline" size="sm" onClick={handleExportCSV} className="gap-1">
            <Download className="w-3 h-3" /> CSV
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleRunAudit}
            disabled={auditRunning}
            className="gap-1"
          >
            <Play className="w-3 h-3" /> {auditRunning ? "Đang chạy..." : "Run Audit"}
          </Button>
        </CardContent>
      </Card>

      <Tabs defaultValue="flagged" className="space-y-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="flagged">🚩 Flagged ({flaggedUsers.length})</TabsTrigger>
          <TabsTrigger value="low-trust">⚠️ Low Trust ({lowTrustUsers.length})</TabsTrigger>
          <TabsTrigger value="clusters">🔗 Clusters ({deviceClusters.length})</TabsTrigger>
          <TabsTrigger value="wallets">💰 Wallets ({suspiciousWallets.length})</TabsTrigger>
          <TabsTrigger value="pending">⏳ Pending ({pendingRewards.length})</TabsTrigger>
          <TabsTrigger value="audit-log">📋 Audit Log ({auditLogs.length})</TabsTrigger>
        </TabsList>

        {/* Flagged Accounts */}
        <TabsContent value="flagged">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                Tài khoản bị flag
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filterUsers(flaggedUsers).length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Không có tài khoản nào bị flag</p>
              ) : (
                <div className="space-y-3">
                  {filterUsers(flaggedUsers).map(user => (
                    <div key={user.user_id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <span className="font-medium">@{user.username || "unknown"}</span>
                        <div className="flex items-center gap-2 mt-1">
                          {getTrustBadge(user.trust_score)}
                          {user.flag_reason && (
                            <span className="text-xs text-muted-foreground">{user.flag_reason}</span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Age: {user.account_age_score} | Engage: {user.engagement_score} | Report: -{user.report_penalty} | FP: -{user.fingerprint_penalty}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleRecalcTrust(user.user_id)}>
                          <RefreshCw className="w-3 h-3" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleUnfreeze(user.user_id)}>
                          <Snowflake className="w-3 h-3 mr-1" /> Unfreeze
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleBanAndBurn(user.user_id)}>
                          <Ban className="w-3 h-3 mr-1" /> Ban
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Low Trust */}
        <TabsContent value="low-trust">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-yellow-500" />
                  Trust Score thấp (&lt;30)
                </CardTitle>
                {selectedUsers.size > 0 && (
                  <Button size="sm" variant="destructive" onClick={handleBulkFreeze}>
                    <Snowflake className="w-3 h-3 mr-1" /> Freeze {selectedUsers.size} users
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {filterUsers(lowTrustUsers).length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Không có user trust thấp</p>
              ) : (
                <div className="space-y-2">
                  {filterUsers(lowTrustUsers).map(user => (
                    <div key={user.user_id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedUsers.has(user.user_id)}
                          onChange={() => toggleSelect(user.user_id)}
                          className="w-4 h-4"
                        />
                        <div>
                          <span className="font-medium">@{user.username || "unknown"}</span>
                          <div className="flex items-center gap-2 mt-1">
                            {getTrustBadge(user.trust_score)}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleRecalcTrust(user.user_id)}>
                          <RefreshCw className="w-3 h-3" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleFreeze(user.user_id)}>
                          <Snowflake className="w-3 h-3 mr-1" /> Freeze
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Device Clusters */}
        <TabsContent value="clusters">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Fingerprint className="w-5 h-5 text-purple-500" />
                Device Clusters (nhiều tài khoản cùng thiết bị)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {deviceClusters.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Không phát hiện cluster nào</p>
              ) : (
                <div className="space-y-4">
                  {deviceClusters.map((cluster, i) => (
                    <div key={i} className="p-4 border rounded-lg bg-muted/30">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-sm">
                          Device: {cluster.device_hash.substring(0, 12)}...
                        </span>
                        <Badge variant="destructive">{cluster.user_count} accounts</Badge>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {cluster.usernames.map((username, j) => (
                          <Badge key={j} variant="outline">@{username}</Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Suspicious Wallets */}
        <TabsContent value="wallets">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-orange-500" />
                Suspicious Wallets (ví trùng giữa các user)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {suspiciousWallets.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Không phát hiện ví đáng ngờ</p>
              ) : (
                <div className="space-y-3">
                  {suspiciousWallets.map((sw, i) => (
                    <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <span className="font-medium">@{sw.username}</span>
                        <div className="text-xs font-mono text-muted-foreground mt-1">
                          {sw.wallet_address?.substring(0, 10)}...{sw.wallet_address?.substring(36)}
                        </div>
                        <div className="text-xs text-red-500 mt-1">
                          Trùng với: {sw.duplicate_users.map(u => `@${u}`).join(", ")}
                        </div>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => handleFreeze(sw.user_id)}>
                        <Snowflake className="w-3 h-3 mr-1" /> Freeze
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pending Rewards */}
        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-blue-500" />
                Pending Rewards (chờ unlock 48h)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pendingRewards.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Không có reward pending</p>
              ) : (
                <div className="space-y-2">
                  {pendingRewards.map(reward => (
                    <div key={reward.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <span className="font-medium">@{reward.username || "unknown"}</span>
                        <div className="text-sm text-muted-foreground">
                          {Number(reward.amount).toLocaleString()} CAMLY • {reward.action_type}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Unlock: {new Date(reward.unlock_at).toLocaleString("vi-VN")}
                        </div>
                      </div>
                      <Badge variant={reward.status === "pending" ? "secondary" : "destructive"}>
                        {reward.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit Log */}
        <TabsContent value="audit-log">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="w-5 h-5 text-muted-foreground" />
                Lịch sử Random Audit
              </CardTitle>
            </CardHeader>
            <CardContent>
              {auditLogs.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Chưa có lần audit nào</p>
              ) : (
                <div className="space-y-3">
                  {auditLogs.map(log => (
                    <div key={log.id} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">
                          {new Date(log.created_at).toLocaleString("vi-VN")}
                        </span>
                        <Badge variant="outline">{log.details?.flagged_count || 0} flagged</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Tổng active: {log.details?.total_active || 0} • Kiểm tra: {log.details?.sample_size || 0}
                      </div>
                      {log.details?.flagged_users?.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {log.details.flagged_users.map((fu: any, i: number) => (
                            <Badge key={i} variant="destructive" className="text-xs">
                              {fu.user_id.substring(0, 8)}... (trust: {fu.trust_score})
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Refresh button */}
      <div className="flex justify-center">
        <Button variant="outline" onClick={loadData} className="gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh Data
        </Button>
      </div>
    </div>
  );
};

export default AntiSybilTab;
