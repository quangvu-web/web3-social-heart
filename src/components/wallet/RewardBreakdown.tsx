import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Gift, FileText, Heart, MessageCircle, Share2, Users, Video, Coins, CheckCircle, Clock } from 'lucide-react';

export interface RewardStats {
  posts_count: number;
  reactions_on_posts: number;
  comments_count: number;
  shares_count: number;
  friends_count: number;
  livestreams_count: number;
  total_reward: number;
  today_reward: number;
}

interface RewardBreakdownProps {
  stats: RewardStats | null;
  claimedAmount: number;
  isLoading?: boolean;
}

const REWARD_CONFIG = {
  NEW_USER_BONUS: 50000,
  posts: { reward: 10000, icon: FileText, label: 'Đăng bài', emoji: '📝' },
  reactions: { reward: 1000, icon: Heart, label: 'Nhận reaction', emoji: '❤️' },
  comments: { reward: 2000, icon: MessageCircle, label: 'Nhận comment', emoji: '💬' },
  shares: { reward: 10000, icon: Share2, label: 'Được share', emoji: '🔄' },
  friends: { reward: 10000, icon: Users, label: 'Kết bạn', emoji: '👥' },
  livestreams: { reward: 20000, icon: Video, label: 'Livestream', emoji: '📺' },
};

const formatNumber = (num: number) => {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

export const RewardBreakdown = ({ stats, claimedAmount, isLoading }: RewardBreakdownProps) => {
  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/20 dark:to-yellow-950/20 border-amber-200 dark:border-amber-800">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg text-amber-800 dark:text-amber-200">
            <Coins className="w-5 h-5" />
            Chi Tiết Thưởng Của Bạn
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="h-6 bg-amber-200/50 rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return null;
  }

  const postsReward = stats.posts_count * REWARD_CONFIG.posts.reward;
  const reactionsReward = stats.reactions_on_posts * REWARD_CONFIG.reactions.reward;
  const commentsReward = stats.comments_count * REWARD_CONFIG.comments.reward;
  const sharesReward = stats.shares_count * REWARD_CONFIG.shares.reward;
  const friendsReward = stats.friends_count * REWARD_CONFIG.friends.reward;
  const livestreamsReward = stats.livestreams_count * REWARD_CONFIG.livestreams.reward;

  const totalReward = Number(stats.total_reward) || 0;
  const claimable = Math.max(0, totalReward - claimedAmount);

  const breakdownItems = [
    {
      emoji: '🎁',
      label: 'Bonus đăng ký',
      count: null,
      reward: REWARD_CONFIG.NEW_USER_BONUS,
      total: REWARD_CONFIG.NEW_USER_BONUS,
    },
    {
      emoji: REWARD_CONFIG.posts.emoji,
      label: REWARD_CONFIG.posts.label,
      count: stats.posts_count,
      reward: REWARD_CONFIG.posts.reward,
      total: postsReward,
    },
    {
      emoji: REWARD_CONFIG.reactions.emoji,
      label: REWARD_CONFIG.reactions.label,
      count: stats.reactions_on_posts,
      reward: REWARD_CONFIG.reactions.reward,
      total: reactionsReward,
    },
    {
      emoji: REWARD_CONFIG.comments.emoji,
      label: REWARD_CONFIG.comments.label,
      count: stats.comments_count,
      reward: REWARD_CONFIG.comments.reward,
      total: commentsReward,
    },
    {
      emoji: REWARD_CONFIG.shares.emoji,
      label: REWARD_CONFIG.shares.label,
      count: stats.shares_count,
      reward: REWARD_CONFIG.shares.reward,
      total: sharesReward,
    },
    {
      emoji: REWARD_CONFIG.friends.emoji,
      label: REWARD_CONFIG.friends.label,
      count: stats.friends_count,
      reward: REWARD_CONFIG.friends.reward,
      total: friendsReward,
    },
    {
      emoji: REWARD_CONFIG.livestreams.emoji,
      label: REWARD_CONFIG.livestreams.label,
      count: stats.livestreams_count,
      reward: REWARD_CONFIG.livestreams.reward,
      total: livestreamsReward,
    },
  ];

  return (
    <Card className="bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/20 dark:to-yellow-950/20 border-amber-200 dark:border-amber-800">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg text-amber-800 dark:text-amber-200">
          <Coins className="w-5 h-5" />
          Chi Tiết Thưởng Của Bạn
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Breakdown items */}
        <div className="space-y-1.5 text-sm">
          {breakdownItems.map((item, index) => (
            <div
              key={index}
              className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-amber-100/50 dark:hover:bg-amber-900/20 transition-colors"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-base">{item.emoji}</span>
                <span className="text-amber-900 dark:text-amber-100 truncate">
                  {item.label}
                </span>
              </div>
              <div className="flex items-center gap-2 text-right">
                {item.count !== null ? (
                  <span className="text-amber-600 dark:text-amber-400 text-xs whitespace-nowrap">
                    {item.count} × {formatNumber(item.reward)}
                  </span>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400 text-xs">
                    1 lần
                  </span>
                )}
                <span className="font-semibold text-amber-800 dark:text-amber-200 min-w-[80px] text-right">
                  {formatNumber(item.total)} CAMLY
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="border-t border-amber-300 dark:border-amber-700 my-3" />

        {/* Summary */}
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between py-1.5 px-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="text-base">💰</span>
              <span className="font-medium text-amber-900 dark:text-amber-100">TỔNG THƯỞNG</span>
            </div>
            <span className="font-bold text-amber-800 dark:text-amber-200">
              {formatNumber(totalReward)} CAMLY
            </span>
          </div>

          {claimedAmount > 0 && (
            <div className="flex items-center justify-between py-1.5 px-2 rounded-lg">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-green-700 dark:text-green-400">Đã claim</span>
              </div>
              <span className="font-medium text-green-600 dark:text-green-400">
                -{formatNumber(claimedAmount)} CAMLY
              </span>
            </div>
          )}

          <div className="flex items-center justify-between py-2 px-2 bg-gradient-to-r from-yellow-400/20 to-amber-400/20 rounded-lg border border-yellow-400/30">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-yellow-600" />
              <span className="font-medium text-yellow-800 dark:text-yellow-200">Còn claim được</span>
            </div>
            <span className="font-bold text-lg text-yellow-700 dark:text-yellow-300">
              {formatNumber(claimable)} CAMLY
            </span>
          </div>
        </div>

        {/* Today's reward badge */}
        {stats.today_reward > 0 && (
          <div className="mt-3 flex items-center justify-center gap-2 py-2 px-3 bg-green-100 dark:bg-green-900/30 rounded-full text-sm">
            <Gift className="w-4 h-4 text-green-600" />
            <span className="text-green-700 dark:text-green-300">
              Hôm nay: +{formatNumber(stats.today_reward)} CAMLY
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RewardBreakdown;
