import { useEffect, useState, memo, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { FacebookNavbar } from '@/components/layout/FacebookNavbar';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';
import ScrollToTopButton from '@/components/common/ScrollToTopButton';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2 } from 'lucide-react';
import { useLanguage } from '@/i18n/LanguageContext';
import { useDeviceFingerprint } from '@/hooks/useDeviceFingerprint';

// Module imports
import { FacebookCreatePost } from '../components/post/FacebookCreatePost';
import { FacebookPostCard } from '../components/post/FacebookPostCard';
import { FacebookLeftSidebar } from '../components/sidebar/FacebookLeftSidebar';
import { FacebookRightSidebar } from '../components/sidebar/FacebookRightSidebar';
import { StoriesBar } from '../components/sidebar/StoriesBar';
import { useFeedPosts } from '../hooks/useFeedPosts';

// Lightweight skeleton components
const SidebarSkeleton = memo(() => (
  <div className="space-y-3">
    <div className="fb-card p-4">
      <Skeleton className="h-6 w-32 mb-4" />
      <div className="space-y-2">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
      </div>
    </div>
  </div>
));
SidebarSkeleton.displayName = 'SidebarSkeleton';

const PostSkeleton = memo(() => (
  <div className="fb-card p-4">
    <div className="flex items-center gap-3 mb-4">
      <Skeleton className="w-10 h-10 rounded-full" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
    <Skeleton className="h-4 w-full mb-2" />
    <Skeleton className="h-4 w-3/4 mb-4" />
    <Skeleton className="h-48 w-full rounded-lg" />
  </div>
));
PostSkeleton.displayName = 'PostSkeleton';

const Feed = () => {
  const [currentUserId, setCurrentUserId] = useState('');
  const { t } = useLanguage();
  useDeviceFingerprint(currentUserId || null);
  const { 
    posts, 
    postStats, 
    isLoading, 
    isFetchingNextPage, 
    hasNextPage, 
    fetchNextPage, 
    refetch 
  } = useFeedPosts();

  // Intersection observer for infinite scroll
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const handleObserver = useCallback((entries: IntersectionObserverEntry[]) => {
    const [entry] = entries;
    if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  useEffect(() => {
    const observer = new IntersectionObserver(handleObserver, {
      root: null,
      rootMargin: '200px', // Start loading before reaching the end
      threshold: 0,
    });

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [handleObserver]);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) setCurrentUserId(session.user.id);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setCurrentUserId(session?.user?.id || '');
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <FacebookNavbar />
      
      <main className="pt-12 md:pt-14 pb-20 lg:pb-4">
        <div className="max-w-screen-2xl mx-auto px-0 sm:px-2 md:px-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 sm:gap-2 md:gap-4 py-2 md:py-4">
            {/* Left Sidebar - Hidden on mobile/tablet */}
            <aside className="hidden lg:block lg:col-span-3">
              <div className="sticky top-[72px] max-h-[calc(100vh-88px)] overflow-y-auto pr-2 scrollbar-thin">
                <FacebookLeftSidebar />
              </div>
            </aside>

            {/* Main Feed - Full width on mobile */}
            <div className="col-span-1 lg:col-span-6 w-full px-2 sm:px-0">
              <StoriesBar />

              {currentUserId && <FacebookCreatePost onPostCreated={refetch} />}

              {!currentUserId && (
                <div className="fb-card p-4 mb-4 text-center">
                  <p className="text-muted-foreground">{t('loginToPost')}</p>
                </div>
              )}

              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => <PostSkeleton key={i} />)}
                </div>
              ) : posts.length === 0 ? (
                <div className="fb-card p-8 text-center">
                  <p className="text-muted-foreground">Chưa có bài viết nào</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {posts.map(post => (
                    <FacebookPostCard
                      key={post.id}
                      post={post}
                      currentUserId={currentUserId}
                      onPostDeleted={refetch}
                      initialStats={postStats[post.id]}
                    />
                  ))}

                  <div ref={loadMoreRef} className="py-4">
                    {isFetchingNextPage && (
                      <div className="flex justify-center items-center gap-2 text-muted-foreground">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>{t('loadingMorePosts')}</span>
                      </div>
                    )}
                    {!hasNextPage && posts.length > 0 && (
                      <div className="text-center text-muted-foreground text-sm py-2">
                        {t('noMorePostsMessage')} 🎉
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Right Sidebar - Hidden on mobile/tablet */}
            <aside className="hidden lg:block lg:col-span-3">
              <div className="sticky top-[72px] max-h-[calc(100vh-88px)] overflow-y-auto pl-2 scrollbar-thin">
                <FacebookRightSidebar />
              </div>
            </aside>
          </div>
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />

      {/* Scroll to top button */}
      <ScrollToTopButton />
    </div>
  );
};

export default Feed;
