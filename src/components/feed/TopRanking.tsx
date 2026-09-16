import { useEffect, useState, memo, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
// Use direct paths for logos to ensure consistency across all environments

interface LeaderboardUser {
  id: string;
  username: string;
  avatar_url: string;
  total_reward: number;
  today_reward: number;
}

export const TopRanking = memo(() => {
  const navigate = useNavigate();
  const [topRewards, setTopRewards] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboards();
  }, []);

  // Optimized: Single RPC call with daily limits (V2)
  const fetchLeaderboards = async () => {
    try {
      const { data, error } = await supabase.rpc("get_user_rewards_v2", { limit_count: 5 });

      if (error) throw error;

      if (data) {
        setTopRewards(
          data.map((user: any) => ({
            id: user.id,
            username: user.username,
            avatar_url: user.avatar_url,
            total_reward: Number(user.total_reward),
            today_reward: Number(user.today_reward) || 0,
          })),
        );
      }
    } catch (error) {
      console.error("Error fetching leaderboards:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUserClick = (userId: string) => {
    navigate(`/profile/${userId}`);
  };

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  const UserRow = ({ user, rank }: { user: LeaderboardUser; rank: number }) => (
    <div
      onClick={() => handleUserClick(user.id)}
      className="relative border-b border-gold/20 last:border-b-0 py-2 first:pt-0 last:pb-0 bg-white/60 hover:bg-white/80 transition-all cursor-pointer"
    >
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-3">
          <span className="text-[#FFD700] font-bold text-lg w-5 text-center">{rank}</span>
          <Avatar className="w-8 h-8 border-2 border-[#D4AF37]/60">
            <AvatarImage src={user.avatar_url} />
            <AvatarFallback className="text-xs bg-[#D4AF37]/10 text-primary">
              {user.username?.[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="text-primary text-sm font-medium truncate max-w-[120px]">{user.username}</span>
        </div>
        <span className="text-[#FFD700] font-bold text-sm">{user.total_reward.toLocaleString("vi-VN")}</span>
      </div>
    </div>
  );

  return (
    <div className="rounded-2xl overflow-hidden border-2 border-gold/60 bg-white/80 backdrop-blur-xl shadow-lg">
      <div className="relative p-3 space-y-2">
        {/* Header with logo */}
        <div className="text-center space-y-1">
          <div className="inline-block">
            <div className="relative">
              <img
                src="/fun-profile-logo-40.webp"
                alt="Fun Profile Web3"
                width={48}
                height={48}
                className="w-12 h-12 mx-auto rounded-full border border-gold/50"
              />
            </div>
          </div>

          <h1 
            className="text-[22px] font-black tracking-wider uppercase"
            style={{
              fontFamily: "'Orbitron', 'Rajdhani', sans-serif",
              background: 'linear-gradient(135deg, #FFD700 0%, #FFEC8B 15%, #FFD700 30%, #FFC125 50%, #FFD700 70%, #FFEC8B 85%, #FFD700 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              filter: 'drop-shadow(0 1px 2px rgba(255, 215, 0, 0.5))',
            }}
          >
            TOP RANKING
          </h1>
        </div>

        {/* Top 5 Users - Single column layout */}
        <div className="grid grid-cols-1 gap-0 rounded-lg border border-gold/30 overflow-hidden">
          {topRewards.map((user, index) => (
            <UserRow key={user.id} user={user} rank={index + 1} />
          ))}
          {topRewards.length === 0 && (
            <div className="text-center py-4 text-muted-foreground text-sm">No data available yet</div>
          )}
        </div>

        {/* View All Button */}
        <Button
          onClick={() => navigate("/leaderboard")}
          className="w-full mt-3 bg-[#1a7d45] hover:bg-[#166534] text-white font-bold transition-all group border border-[#D4AF37]"
        >
          Xem bảng xếp hạng đầy đủ
          <ChevronRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
        </Button>
      </div>
    </div>
  );
});

TopRanking.displayName = "TopRanking";
