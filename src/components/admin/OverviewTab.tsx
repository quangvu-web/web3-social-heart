import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Clock, CheckCircle, Coins, AlertTriangle, ShieldOff } from "lucide-react";

interface OverviewStats {
  totalUsers: number;
  pendingRewards: number;
  approvedRewards: number;
  onChainClaims: number;
  bannedUsers: number;
  suspiciousUsers: number;
}

interface OverviewTabProps {
  stats: OverviewStats;
}

const OverviewTab = ({ stats }: OverviewTabProps) => {
  const statCards = [
    {
      title: "Tổng Users",
      value: stats.totalUsers,
      icon: Users,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10"
    },
    {
      title: "Pending Rewards",
      value: stats.pendingRewards,
      icon: Clock,
      color: "text-yellow-500",
      bgColor: "bg-yellow-500/10"
    },
    {
      title: "Approved Rewards",
      value: stats.approvedRewards,
      icon: CheckCircle,
      color: "text-green-500",
      bgColor: "bg-green-500/10"
    },
    {
      title: "On-chain Claims",
      value: stats.onChainClaims,
      icon: Coins,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10"
    },
    {
      title: "Users Bị Cấm",
      value: stats.bannedUsers,
      icon: ShieldOff,
      color: "text-red-500",
      bgColor: "bg-red-500/10"
    },
    {
      title: "Users Nghi Ngờ",
      value: stats.suspiciousUsers,
      icon: AlertTriangle,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10"
    }
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((stat, index) => (
          <Card key={index} className="relative overflow-hidden">
            <CardHeader className="pb-2">
              <div className={`p-2 rounded-lg ${stat.bgColor} w-fit`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stat.value.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">{stat.title}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="w-5 h-5 text-yellow-500" />
              Hoạt động gần đây
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Chưa có hoạt động nào gần đây.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              Cảnh báo hệ thống
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Không có cảnh báo nào.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default OverviewTab;
