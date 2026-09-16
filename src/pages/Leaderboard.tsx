import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { FacebookNavbar } from '@/components/layout/FacebookNavbar';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy, Medal, Award, TrendingUp, Users, MessageCircle, Heart, ArrowLeft, Video, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/i18n/LanguageContext';

interface LeaderboardUser {
  id: string;
  username: string;
  avatar_url: string | null;
  full_name: string | null;
  posts_count: number;
  comments_count: number;
  reactions_on_posts: number;
  friends_count: number;
  livestreams_count: number;
  today_reward: number;
  total_reward: number;
}

const Leaderboard = () => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('reward');

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      // Use optimized RPC function V2 with daily limits
      const { data, error } = await supabase.rpc('get_user_rewards_v2', { limit_count: 100 });

      if (error) throw error;

      const usersWithRewards: LeaderboardUser[] = (data || []).map((user: {
        id: string;
        username: string;
        avatar_url: string | null;
        posts_count: number;
        comments_count: number;
        reactions_on_posts: number;
        friends_count: number;
        livestreams_count: number;
        today_reward: number;
        total_reward: number;
      }) => ({
        id: user.id,
        username: user.username,
        avatar_url: user.avatar_url,
        full_name: null,
        posts_count: user.posts_count || 0,
        comments_count: user.comments_count || 0,
        reactions_on_posts: user.reactions_on_posts || 0,
        friends_count: user.friends_count || 0,
        livestreams_count: user.livestreams_count || 0,
        today_reward: user.today_reward || 0,
        total_reward: user.total_reward || 0
      }));

      setUsers(usersWithRewards);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUserClick = (userId: string) => {
    navigate(`/profile/${userId}`);
  };

  const getRankStyle = (rank: number) => {
    if (rank === 1) return 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-white shadow-lg shadow-yellow-200';
    if (rank === 2) return 'bg-gradient-to-r from-gray-300 to-gray-500 text-white shadow-lg shadow-gray-200';
    if (rank === 3) return 'bg-gradient-to-r from-amber-500 to-amber-700 text-white shadow-lg shadow-amber-200';
    return 'bg-gray-100 text-gray-600';
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="w-5 h-5" />;
    if (rank === 2) return <Medal className="w-5 h-5" />;
    if (rank === 3) return <Award className="w-5 h-5" />;
    return null;
  };

  const categories = [
    { value: 'reward', label: t('totalReward'), icon: Trophy },
    { value: 'today', label: t('today'), icon: Calendar },
    { value: 'posts', label: t('posts'), icon: TrendingUp },
    { value: 'friends', label: t('friends'), icon: Users },
    { value: 'comments', label: t('comments'), icon: MessageCircle },
    { value: 'reactions_on_posts', label: t('reactions'), icon: Heart },
    { value: 'livestreams', label: t('liveVideo'), icon: Video },
  ];

  const sortedByCategory = [...users].sort((a, b) => {
    switch (activeCategory) {
      case 'posts': return b.posts_count - a.posts_count;
      case 'friends': return b.friends_count - a.friends_count;
      case 'comments': return b.comments_count - a.comments_count;
      case 'reactions_on_posts': return b.reactions_on_posts - a.reactions_on_posts;
      case 'livestreams': return b.livestreams_count - a.livestreams_count;
      case 'today': return b.today_reward - a.today_reward;
      default: return b.total_reward - a.total_reward;
    }
  });

  return (
    <div className="min-h-screen bg-[#f0f2f5] pb-20 lg:pb-0">
      <FacebookNavbar />
      <main className="pt-14">
        <div className="max-w-5xl mx-auto px-4 py-6">
          {/* Header */}
          <div className="bg-gradient-to-r from-primary to-gold rounded-2xl p-8 mb-6 text-white text-center relative">
            {/* Back Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="absolute top-4 left-4 text-white hover:bg-white/20 rounded-full"
            >
              <ArrowLeft className="w-6 h-6" />
            </Button>
            
            <Trophy className="w-16 h-16 mx-auto mb-4" />
            <h1 className="text-3xl font-bold mb-2">{t('leaderboard')}</h1>
            <p className="text-white/80">{t('leaderboardSubtitle')}</p>
          </div>

          {/* Category Tabs */}
          <div className="bg-white rounded-xl shadow-sm p-2 mb-6 flex gap-2 overflow-x-auto">
            {categories.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setActiveCategory(cat.value)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium whitespace-nowrap transition-all duration-300 border-[0.5px] ${
                  activeCategory === cat.value 
                    ? 'bg-primary text-white border-[#C9A84C]' 
                    : 'hover:bg-gray-100 border-transparent hover:border-[#C9A84C]/40'
                }`}
              >
                <cat.icon className="w-4 h-4" />
                {cat.label}
              </button>
            ))}
          </div>

          {/* Top 3 Podium */}
          {!loading && sortedByCategory.length >= 3 && (
            <div className="grid grid-cols-3 gap-4 mb-6">
              {/* 2nd Place */}
              <div className="bg-white rounded-xl shadow-sm p-6 text-center order-1 mt-8">
                <div className="w-16 h-16 bg-gradient-to-r from-gray-300 to-gray-500 rounded-full flex items-center justify-center mx-auto mb-3 text-white text-2xl font-bold">
                  2
                </div>
                <Avatar 
                  className="w-20 h-20 mx-auto mb-3 ring-4 ring-gray-300 cursor-pointer"
                  onClick={() => handleUserClick(sortedByCategory[1].id)}
                >
                  <AvatarImage src={sortedByCategory[1].avatar_url || ''} />
                  <AvatarFallback>{sortedByCategory[1].username[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <h3 className="font-semibold">{sortedByCategory[1].username}</h3>
                <p className="text-primary font-bold text-lg">
                  {activeCategory === 'reward' 
                    ? `${sortedByCategory[1].total_reward.toLocaleString('vi-VN')} 🪙`
                    : sortedByCategory[1][`${activeCategory}_count` as keyof LeaderboardUser]?.toLocaleString('vi-VN')
                  }
                </p>
              </div>

              {/* 1st Place */}
              <div className="bg-white rounded-xl shadow-lg p-6 text-center order-2 ring-2 ring-yellow-400">
                <div className="w-20 h-20 bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center mx-auto mb-3 text-white">
                  <Trophy className="w-10 h-10" />
                </div>
                <Avatar 
                  className="w-24 h-24 mx-auto mb-3 ring-4 ring-yellow-400 cursor-pointer"
                  onClick={() => handleUserClick(sortedByCategory[0].id)}
                >
                  <AvatarImage src={sortedByCategory[0].avatar_url || ''} />
                  <AvatarFallback>{sortedByCategory[0].username[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <h3 className="font-bold text-lg">{sortedByCategory[0].username}</h3>
                <p className="text-primary font-bold text-xl">
                  {activeCategory === 'reward' 
                    ? `${sortedByCategory[0].total_reward.toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US')} 🪙`
                    : sortedByCategory[0][`${activeCategory}_count` as keyof LeaderboardUser]?.toLocaleString('vi-VN')
                  }
                </p>
              </div>

              {/* 3rd Place */}
              <div className="bg-white rounded-xl shadow-sm p-6 text-center order-3 mt-12">
                <div className="w-14 h-14 bg-gradient-to-r from-amber-500 to-amber-700 rounded-full flex items-center justify-center mx-auto mb-3 text-white text-xl font-bold">
                  3
                </div>
                <Avatar 
                  className="w-16 h-16 mx-auto mb-3 ring-4 ring-amber-500 cursor-pointer"
                  onClick={() => handleUserClick(sortedByCategory[2].id)}
                >
                  <AvatarImage src={sortedByCategory[2].avatar_url || ''} />
                  <AvatarFallback>{sortedByCategory[2].username[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <h3 className="font-semibold text-sm">{sortedByCategory[2].username}</h3>
                <p className="text-primary font-bold">
                  {activeCategory === 'reward' 
                    ? `${sortedByCategory[2].total_reward.toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US')} 🪙`
                    : sortedByCategory[2][`${activeCategory}_count` as keyof LeaderboardUser]?.toLocaleString('vi-VN')
                  }
                </p>
              </div>
            </div>
          )}

          {/* Full Leaderboard */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b">
              <h2 className="font-bold text-lg">{t('fullLeaderboard')}</h2>
            </div>

            {loading ? (
              <div className="p-4 space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))}
              </div>
            ) : (
              <div className="divide-y">
                {sortedByCategory.map((user, index) => {
                  const rank = index + 1;
                  return (
                    <div
                      key={user.id}
                      onClick={() => handleUserClick(user.id)}
                      className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${getRankStyle(rank)}`}>
                        {rank <= 3 ? getRankIcon(rank) : rank}
                      </div>
                      
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={user.avatar_url || ''} />
                        <AvatarFallback>{user.username[0]?.toUpperCase()}</AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{user.username}</p>
                        <div className="flex gap-4 text-xs text-muted-foreground">
                          <span>{user.posts_count} {t('posts').toLowerCase()}</span>
                          <span>{user.friends_count} {t('friends').toLowerCase()}</span>
                          {user.livestreams_count > 0 && <span>{user.livestreams_count} {t('liveVideo').toLowerCase()}</span>}
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <p className="font-bold text-lg text-primary">
                          {activeCategory === 'reward' 
                            ? user.total_reward.toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US')
                            : activeCategory === 'today'
                            ? user.today_reward.toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US')
                            : (user[`${activeCategory}_count` as keyof LeaderboardUser] as number)?.toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US')
                          }
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {activeCategory === 'reward' ? t('camlyCoin') : activeCategory === 'today' ? t('today') : categories.find(c => c.value === activeCategory)?.label}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
      
      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />
    </div>
  );
};

export default Leaderboard;
