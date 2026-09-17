import { useState, useEffect, memo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LazyImage } from '@/components/ui/LazyImage';
import { Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Story {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  image_url?: string;
}

/**
 * Optimized StoriesBar with lazy loading
 * - Lazy loads story images
 * - Memoized for performance
 */
export const StoriesBar = memo(() => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [stories, setStories] = useState<Story[]>([]);

  useEffect(() => {
    const loadUserFromSession = async (session: any) => {
      if (!session?.user) {
        setCurrentUser(null);
        return;
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();
      // Fallback to the session user so the bar never shows the logged-out state
      setCurrentUser(profile ?? { id: session.user.id, username: session.user.email ?? '', avatar_url: null });
    };

    const fetchCurrentUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      await loadUserFromSession(session);
    };


    const fetchStories = async () => {
      // Fetch recent users who posted as "stories" simulation
      const { data: recentPosts } = await supabase
        .from('posts')
        .select('user_id, profiles!posts_user_id_fkey(id, username, avatar_url)')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(10);

      if (recentPosts) {
        const uniqueUsers = new Map();
        recentPosts.forEach((post: any) => {
          if (post.profiles && !uniqueUsers.has(post.user_id)) {
            uniqueUsers.set(post.user_id, {
              id: post.user_id,
              user_id: post.user_id,
              username: post.profiles.username,
              avatar_url: post.profiles.avatar_url,
            });
          }
        });
        setStories(Array.from(uniqueUsers.values()).slice(0, 5));
      }
    };

    fetchCurrentUser();
    fetchStories();

    // Keep in sync when the session arrives after an OAuth redirect
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      void loadUserFromSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);


  const gradientColors = [
    'from-primary to-gold',
    'from-blue-500 to-purple-500',
    'from-pink-500 to-rose-500',
    'from-orange-500 to-yellow-500',
    'from-teal-500 to-cyan-500',
  ];

  return (
    <div className="fb-card p-4 mb-4">
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {/* Create Story Card */}
        {currentUser && (
          <div className="flex-shrink-0 w-28 h-48 rounded-xl overflow-hidden relative cursor-pointer group">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/60">
              {currentUser.avatar_url ? (
                <LazyImage
                  src={currentUser.avatar_url}
                  alt=""
                  className="w-full h-full"
                  priority
                  transformPreset="thumbnail"
                />
              ) : (
                <div className="w-full h-full bg-secondary" />
              )}
            </div>
            <div className="absolute bottom-0 left-0 right-0 bg-card pt-8 pb-2 px-2 text-center">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center border-4 border-card">
                  <Plus className="w-4 h-4 text-primary-foreground" />
                </div>
              </div>
              <p className="text-xs font-semibold mt-2">Tạo tin</p>
            </div>
          </div>
        )}

        {/* Story Cards */}
        {stories.map((story, index) => (
          <div
            key={story.id}
            onClick={() => navigate(`/profile/${story.user_id}`)}
            className="flex-shrink-0 w-28 h-48 rounded-xl overflow-hidden relative cursor-pointer group"
          >
            <div className={`absolute inset-0 bg-gradient-to-b ${gradientColors[index % gradientColors.length]} opacity-80`} />
            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
            
            {/* User Avatar */}
            <div className="absolute top-3 left-3">
              <Avatar className="w-10 h-10 ring-4 ring-primary">
                <AvatarImage src={story.avatar_url || ''} alt={`Ảnh đại diện của ${story.username}`} />
                <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                  {story.username?.[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>

            {/* Username */}
            <div className="absolute bottom-3 left-3 right-3">
              <p className="text-xs font-semibold text-white truncate">
                {story.username}
              </p>
            </div>
          </div>
        ))}

        {/* Placeholder stories if not enough */}
        {stories.length === 0 && !currentUser && (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            Đăng nhập để xem tin
          </div>
        )}
      </div>
    </div>
  );
});

StoriesBar.displayName = 'StoriesBar';
