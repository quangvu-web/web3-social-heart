import { useEffect, useState, memo, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useLanguage } from '@/i18n/LanguageContext';
import { Video, Search, MoreHorizontal } from 'lucide-react';
import { AppHonorBoard } from './AppHonorBoard';
import { TopRanking } from './TopRanking';
// Use direct paths for logos to ensure consistency across all environments

export const FacebookRightSidebar = memo(() => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [onlineContacts, setOnlineContacts] = useState<any[]>([]);

  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: friendships } = await supabase
      .from('friendships')
      .select('user_id, friend_id')
      .or(`user_id.eq.${session.user.id},friend_id.eq.${session.user.id}`)
      .eq('status', 'accepted')
      .limit(10);

    if (friendships && friendships.length > 0) {
      const friendIds = friendships.map(f => 
        f.user_id === session.user.id ? f.friend_id : f.user_id
      );

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', friendIds);

      setOnlineContacts(profiles || []);
    }
  };

  // Use direct path for logo - consistent across all environments
  const sponsoredLogoUrl = '/fun-profile-logo-128.webp';

  return (
    <div className="space-y-4">
      {/* App-wide Honor Board (Statistics) */}
      <AppHonorBoard />

      {/* Top Ranking - Top 6 Users */}
      <TopRanking />

      {/* Sponsored */}
      <div className="fb-card p-4">
        <h3 className="font-semibold text-muted-foreground mb-3">{t('sponsored')}</h3>
        <div className="flex gap-3 cursor-pointer hover:bg-secondary rounded-lg p-2 -m-2 transition-colors">
          <img
            src={sponsoredLogoUrl}
            alt="Ad"
            width={128}
            height={128}
            className="w-32 h-32 rounded-lg object-cover"
            loading="lazy"
          />
          <div>
            <p className="font-semibold text-sm">FUN Profile - Web3 Social Network</p>
            <p className="text-xs text-muted-foreground">funprofile.io</p>
          </div>
        </div>
      </div>

      {/* Contacts */}
      {onlineContacts.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2 px-2">
            <h3 className="font-semibold text-muted-foreground">{t('contacts')}</h3>
            <div className="flex gap-2">
              <button className="w-8 h-8 rounded-full hover:bg-secondary flex items-center justify-center" aria-label="Video call">
                <Video className="w-4 h-4" />
              </button>
              <button className="w-8 h-8 rounded-full hover:bg-secondary flex items-center justify-center" aria-label={t('search')}>
                <Search className="w-4 h-4" />
              </button>
              <button className="w-8 h-8 rounded-full hover:bg-secondary flex items-center justify-center" aria-label="More options">
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="space-y-1">
            {onlineContacts.map((contact) => (
              <button
                key={contact.id}
                onClick={() => navigate(`/profile/${contact.id}`)}
                className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-secondary transition-colors"
              >
                <div className="relative">
                  <Avatar className="w-9 h-9">
                    <AvatarImage src={contact.avatar_url || ''} />
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {contact.username?.[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-card" />
                </div>
                <span className="font-medium text-sm">{contact.username}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Birthdays */}
      <div className="fb-card p-4">
        <h3 className="font-semibold text-muted-foreground mb-3">{t('birthdays')}</h3>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
            🎂
          </div>
          <p className="text-sm">{t('noBirthdaysToday')}</p>
        </div>
      </div>
    </div>
  );
});

FacebookRightSidebar.displayName = 'FacebookRightSidebar';