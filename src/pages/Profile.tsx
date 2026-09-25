import { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { FacebookNavbar } from '@/components/layout/FacebookNavbar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EditProfile } from '@/components/profile/EditProfile';
import { FacebookPostCard } from '@/components/feed/FacebookPostCard';
import { FacebookCreatePost } from '@/modules/feed/components/post/FacebookCreatePost';
import { FriendRequestButton } from '@/components/friends/FriendRequestButton';
import { FriendsList } from '@/components/friends/FriendsList';
import { CoverHonorBoard } from '@/components/profile/CoverHonorBoard';
import { Button } from '@/components/ui/button';
import { LazyImage } from '@/components/ui/LazyImage';
import { CoverPhotoEditor } from '@/components/profile/CoverPhotoEditor';
import { AvatarEditor } from '@/components/profile/AvatarEditor';
import { MoreHorizontal, MapPin, Briefcase, GraduationCap, Heart, Clock, MessageCircle, Eye, X, Pin, PenSquare } from 'lucide-react';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';
import { useConversations } from '@/hooks/useConversations';
import { toast } from 'sonner';
import { useLanguage } from '@/i18n/LanguageContext';

interface FriendPreview {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
}

const Profile = () => {
  const navigate = useNavigate();
  const { userId, username } = useParams();
  const { t, language } = useLanguage();
  const [profile, setProfile] = useState<any>(null);
  const [allPosts, setAllPosts] = useState<any[]>([]); // Combined and sorted posts
  const [originalPosts, setOriginalPosts] = useState<any[]>([]); // For photos grid
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [friendsCount, setFriendsCount] = useState(0);
  const [friendsPreview, setFriendsPreview] = useState<FriendPreview[]>([]);
  const [activeTab, setActiveTab] = useState('posts'); // Controlled tabs state
  
  const { createDirectConversation } = useConversations(currentUserId);
  
  const handleStartChat = async () => {
    if (!currentUserId || !profile?.id) return;
    try {
      const result = await createDirectConversation.mutateAsync(profile.id);
      if (result) {
        navigate(`/chat/${result.id}`);
      }
    } catch (error) {
      console.error('Error starting chat:', error);
    }
  };
  const [viewAsPublic, setViewAsPublic] = useState(false);

  // Determine if we should show private elements (own profile AND not in View As mode)
  const showPrivateElements = isOwnProfile && !viewAsPublic;

  // Reserved paths that should NOT be treated as usernames
  const reservedPaths = ['auth', 'feed', 'friends', 'wallet', 'about', 'leaderboard', 'admin', 'notifications', 'docs', 'post', 'law-of-light', 'profile'];

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        setCurrentUserId(session.user.id);
      }
      
      // Check if username route is actually a reserved path
      if (username && reservedPaths.includes(username.toLowerCase())) {
        navigate(`/${username}`);
        return;
      }
      
      // If username is provided, look up by username
      if (username) {
        const cleanUsername = username.startsWith('@') ? username.slice(1) : username;
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', cleanUsername)
          .single();
        
        if (profileData) {
          setIsOwnProfile(session ? profileData.id === session.user.id : false);
          fetchProfile(profileData.id, session?.user.id);
        } else {
          setLoading(false);
          setProfile(null);
        }
        return;
      }
      
      let profileId = userId;
      if (!userId) {
        if (session) {
          profileId = session.user.id;
        } else {
          navigate('/auth');
          return;
        }
      }
      
      setIsOwnProfile(session ? profileId === session.user.id : false);
      fetchProfile(profileId, session?.user.id);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setCurrentUserId(session.user.id);
        if (userId) {
          setIsOwnProfile(session.user.id === userId);
        }
      } else {
        setCurrentUserId('');
        setIsOwnProfile(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, userId, username]);

  const fetchProfile = async (profileId: string, authUserId?: string) => {
    try {
      // For own profile, fetch all fields; for others, use limited fields
      // Use authUserId passed directly to avoid stale state issues
      const isViewingOwnProfile = authUserId ? profileId === authUserId : profileId === currentUserId;
      
      const { data, error } = await supabase
        .from('profiles')
        .select(isViewingOwnProfile 
          ? '*' 
          : 'id, username, avatar_url, full_name, bio, cover_url, created_at, soul_level, total_rewards, pinned_post_id')
        .eq('id', profileId)
        .single();

      if (error) throw error;
      setProfile(data);

      // Fetch user's own posts
      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select(`
          *,
          profiles!posts_user_id_fkey (username, avatar_url, full_name),
          reactions (id, user_id, type),
          comments (id)
        `)
        .eq('user_id', profileId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (postsError) {
        console.error('[Profile] Failed to load posts:', postsError);
        throw postsError;
      }

      setOriginalPosts(postsData || []); // Keep for photos grid

      // Fetch shared posts
      const { data: sharedPostsData } = await supabase
        .from('shared_posts')
        .select(`
          *,
          posts:original_post_id!inner (
            *,
            profiles!posts_user_id_fkey (username, avatar_url, full_name),
            reactions (id, user_id, type),
            comments (id)
          )
        `)
        .eq('user_id', profileId)
        .is('posts.deleted_at', null)
        .order('created_at', { ascending: false });

      // Combine and sort all posts by created_at (shared posts use their share time)
      const combinedPosts: any[] = [];
      
      // Add original posts with type marker
      (postsData || []).forEach(post => {
        combinedPosts.push({
          ...post,
          _type: 'original',
          _sortTime: new Date(post.created_at).getTime()
        });
      });
      
      // Add shared posts with type marker (using share time for sorting)
      (sharedPostsData || []).forEach(sharedPost => {
        if (sharedPost.posts) {
          combinedPosts.push({
            ...sharedPost,
            _type: 'shared',
            _sortTime: new Date(sharedPost.created_at).getTime() // Use share time, not original post time
          });
        }
      });
      
      // Sort by time descending (newest first)
      combinedPosts.sort((a, b) => b._sortTime - a._sortTime);
      
      setAllPosts(combinedPosts);

      // Fetch friends count and preview
      const { data: friendsData, count } = await supabase
        .from('friendships')
        .select('user_id, friend_id', { count: 'exact' })
        .or(`user_id.eq.${profileId},friend_id.eq.${profileId}`)
        .eq('status', 'accepted')
        .limit(6);

      setFriendsCount(count || 0);

      // Fetch friends preview (up to 6 friends with their profiles)
      if (friendsData && friendsData.length > 0) {
        // Get the friend IDs (the "other" person in each friendship)
        const friendIds = friendsData.map(f => 
          f.user_id === profileId ? f.friend_id : f.user_id
        );
        
        const { data: friendProfiles } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url')
          .in('id', friendIds)
          .limit(6);
        
        setFriendsPreview(friendProfiles || []);
      } else {
        setFriendsPreview([]);
      }
    } catch (error) {
      console.error('[Profile] Failed to refresh profile:', error);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to scroll to tabs section
  const scrollToTabs = useCallback(() => {
    setTimeout(() => {
      document.getElementById('profile-tabs')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }, []);

  // Navigation helper functions for controlled tabs
  const navigateToTab = useCallback((tab: string) => {
    setActiveTab(tab);
    scrollToTabs();
  }, [scrollToTabs]);

  const handlePostDeleted = () => {
    const profileId = userId || currentUserId;
    if (profileId) {
      fetchProfile(profileId);
    }
  };

  // Handle pin/unpin post
  const handlePinPost = async (postId: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ pinned_post_id: postId })
        .eq('id', currentUserId);
      
      if (error) throw error;
      
      setProfile((prev: any) => ({ ...prev, pinned_post_id: postId }));
      toast.success(t('postPinned'));
    } catch (error) {
      toast.error(t('cannotPinPost'));
    }
  };

  const handleUnpinPost = async () => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ pinned_post_id: null })
        .eq('id', currentUserId);
      
      if (error) throw error;
      
      setProfile((prev: any) => ({ ...prev, pinned_post_id: null }));
      toast.success(t('postUnpinned'));
    } catch (error) {
      toast.error(t('cannotUnpinPost'));
    }
  };

  // Sort posts with pinned post first
  const sortedPosts = useMemo(() => {
    if (!profile?.pinned_post_id) return allPosts;
    
    const pinnedPost = allPosts.find(
      (item) => item._type === 'original' && item.id === profile.pinned_post_id
    );
    
    if (!pinnedPost) return allPosts;
    
    const otherPosts = allPosts.filter(
      (item) => !(item._type === 'original' && item.id === profile.pinned_post_id)
    );
    
    return [pinnedPost, ...otherPosts];
  }, [allPosts, profile?.pinned_post_id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f0f2f5]">
        <FacebookNavbar />
        <main className="pt-14">
          <Skeleton className="h-[350px] w-full" />
        </main>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#f0f2f5]">
        <FacebookNavbar />
        <main className="pt-14">
          <div className="max-w-5xl mx-auto px-4 text-center py-12">
            <p className="text-muted-foreground">{t('profileNotFound')}</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <FacebookNavbar />
      
      {/* View As Banner */}
      {viewAsPublic && (
        <div className="fixed top-14 left-0 right-0 z-50 bg-primary text-primary-foreground py-3 px-4 flex items-center justify-center gap-4 shadow-lg">
          <Eye className="w-5 h-5" />
          <span className="font-medium">{t('viewingAsOther')}</span>
          <Button 
            size="sm" 
            variant="secondary" 
            onClick={() => setViewAsPublic(false)}
            className="ml-2"
          >
            <X className="w-4 h-4 mr-1" />
            {t('exitViewMode')}
          </Button>
        </div>
      )}
      
      <main className={`pb-20 lg:pb-4 ${viewAsPublic ? 'pt-28' : 'pt-14'}`}>
        {/* Cover Photo Section - Facebook 2025 Style */}
        <div className="max-w-[1100px] mx-auto px-0 md:px-4">
          <div className="relative">
            {/* Cover Photo Container with rounded corners */}
            <div className="h-[200px] sm:h-[300px] md:h-[400px] relative overflow-hidden rounded-2xl mx-2 md:mx-0">
              {profile?.cover_url ? (
                <LazyImage 
                  src={profile.cover_url} 
                  alt="Cover" 
                  className="w-full h-full object-cover"
                  transformPreset="cover"
                  priority
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-r from-primary/40 via-gold/30 to-primary/40" />
              )}
              
              {/* Gradient overlay at bottom for better text readability */}
              <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/30 to-transparent" />

              {/* Honor Board moved to profile info section */}

              {/* Edit Cover Button - bottom right, below Honor Board */}
              {showPrivateElements && (
                <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 z-[100] isolate">
                  <CoverPhotoEditor 
                    userId={currentUserId}
                    currentCoverUrl={profile?.cover_url}
                    onCoverUpdated={(newUrl) => setProfile({ ...profile, cover_url: newUrl })}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Profile Info Section - Facebook 2025 Layout */}
          <div className="bg-card border-b border-border shadow-sm md:rounded-b-xl">
            <div className="px-4 md:px-8 py-4 md:py-6">
              {/* Avatar + Info Row */}
              <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
                {/* Avatar - positioned lower, centered in white space */}
                <div className="-mt-2 sm:-mt-4 md:-mt-6 relative z-10 flex justify-center md:justify-start flex-shrink-0">
                  {showPrivateElements ? (
                    <AvatarEditor
                      userId={currentUserId}
                      currentAvatarUrl={profile?.avatar_url}
                      username={profile?.username}
                      onAvatarUpdated={(newUrl) => setProfile({ ...profile, avatar_url: newUrl })}
                      size="xl"
                    />
                  ) : (
                    <div 
                      className="rounded-full p-1"
                      style={{
                        background: 'linear-gradient(135deg, #166534 0%, #22c55e 50%, #16a34a 100%)'
                      }}
                    >
                      <Avatar 
                        className="w-28 h-28 sm:w-32 sm:h-32 md:w-40 md:h-40 border-4 border-white"
                      >
                        <AvatarImage src={profile?.avatar_url} sizeHint="lg" />
                        <AvatarFallback className="text-3xl md:text-4xl bg-primary text-primary-foreground">
                          {profile?.username?.[0]?.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  )}
                </div>

                {/* Name, Friends, Bio, Info - Facebook style inline */}
                <div className="flex-1 text-center md:text-left md:ml-4">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">
                    {profile?.username}
                  </h1>
                  <p className="text-base sm:text-lg text-muted-foreground font-medium">
                    {friendsCount.toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US')} {t('friendsSuffix')}
                  </p>
                  
                  {/* Bio text - full display with wrap */}
                  {profile?.bio && (
                    <p className="text-sm sm:text-base text-muted-foreground mt-1 whitespace-pre-wrap break-words max-w-md">
                      {profile.bio}
                    </p>
                  )}
                  
                  {/* Info badges - all in one horizontal row */}
                  <div className="flex flex-nowrap items-center justify-center md:justify-start gap-x-4 mt-2 text-base sm:text-lg text-muted-foreground">
                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                      <MapPin className="w-5 h-5 flex-shrink-0" />
                      <span>Việt Nam</span>
                    </div>
                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                      <Briefcase className="w-5 h-5 flex-shrink-0" />
                      <span>FUN Ecosystem</span>
                    </div>
                  </div>
                  
                  {/* Friend Avatars Stack - Real friend photos */}
                  {friendsPreview.length > 0 && (
                    <div className="hidden md:flex -space-x-2 mt-3">
                      {friendsPreview.slice(0, 6).map((friend) => (
                        <Avatar 
                          key={friend.id} 
                          className="w-8 h-8 border-2 border-card cursor-pointer hover:z-10 hover:scale-110 transition-transform"
                          onClick={() => navigate(`/@${friend.username}`)}
                        >
                          <AvatarImage src={friend.avatar_url || undefined} sizeHint="sm" />
                          <AvatarFallback className="bg-gradient-to-br from-primary/30 to-gold/30 text-foreground text-xs font-bold">
                            {(friend.full_name || friend.username)?.[0]?.toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                  )}
                </div>

                {/* Honor Board - right aligned, moved down with top margin */}
                <div className="hidden md:flex justify-end mt-4 md:mt-6">
                  <div className="w-full max-w-[600px]">
                    <CoverHonorBoard 
                      userId={profile.id}
                      username={profile?.username}
                      avatarUrl={profile?.avatar_url}
                    />
                  </div>
                </div>

                {/* Action Buttons for other users - Facebook style */}
                {!isOwnProfile && !viewAsPublic && (
                  <div className="flex flex-wrap justify-center md:hidden gap-2 pb-2">
                    <FriendRequestButton userId={profile.id} currentUserId={currentUserId} />
                    <Button 
                      variant="secondary" 
                      className="font-semibold px-4 h-10"
                      onClick={handleStartChat}
                      disabled={createDirectConversation.isPending}
                    >
                      <MessageCircle className="w-4 h-4 mr-2" />
                      {t('sendMessage')}
                    </Button>
                    <Button variant="secondary" size="icon" className="h-10 w-10">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-border px-4 md:px-8">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full" id="profile-tabs">
                <TabsList className="h-auto bg-transparent p-0 border-0 justify-start gap-1 flex overflow-x-auto scrollbar-hide -mb-px">
                  <TabsTrigger 
                    value="posts" 
                    className="px-4 py-4 rounded-t-lg border-b-[3px] border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary hover:bg-muted/50 font-semibold text-base whitespace-nowrap transition-colors"
                  >
                    {t('allPosts')}
                  </TabsTrigger>
                  <TabsTrigger 
                    value="about" 
                    className="px-4 py-4 rounded-t-lg border-b-[3px] border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary hover:bg-muted/50 font-semibold text-base whitespace-nowrap transition-colors"
                  >
                    {t('about')}
                  </TabsTrigger>
                  <TabsTrigger 
                    value="friends" 
                    className="px-4 py-4 rounded-t-lg border-b-[3px] border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary hover:bg-muted/50 font-semibold text-base whitespace-nowrap transition-colors"
                  >
                    {t('friends')}
                  </TabsTrigger>
                  <TabsTrigger 
                    value="photos" 
                    className="px-4 py-4 rounded-t-lg border-b-[3px] border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary hover:bg-muted/50 font-semibold text-base whitespace-nowrap transition-colors"
                  >
                    {t('photos')}
                  </TabsTrigger>
                  <TabsTrigger 
                    value="videos" 
                    className="px-4 py-4 rounded-t-lg border-b-[3px] border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary hover:bg-muted/50 font-semibold text-base whitespace-nowrap transition-colors"
                  >
                    {t('reels')}
                  </TabsTrigger>
                  {showPrivateElements && (
                    <TabsTrigger 
                      value="edit" 
                      className="px-4 py-4 rounded-t-lg border-b-[3px] border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary hover:bg-muted/50 font-semibold text-base whitespace-nowrap transition-colors"
                    >
                      {t('moreOptions')} ▼
                    </TabsTrigger>
                  )}
                  <div className="flex-1" />
                  <Button variant="secondary" size="icon" className="h-10 w-10 my-2 mr-2 flex-shrink-0">
                    <MoreHorizontal className="w-5 h-5" />
                  </Button>
                </TabsList>

                <div className="py-4 px-4 md:px-8">
                  <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                    {/* Left Sidebar - Intro */}
                    <div className="lg:col-span-2 space-y-4">
                      <TabsContent value="posts" className="mt-0 space-y-4">
                        {/* Intro Card - Facebook style */}
                        <div className="bg-card rounded-xl shadow-sm border border-border p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="font-bold text-lg text-foreground">{t('personalInfo')}</h3>
                            {showPrivateElements && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8"
                                onClick={() => navigateToTab('edit')}
                              >
                                <PenSquare className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                          
                          <div className="space-y-3">
                            <div className="flex items-center gap-3 text-foreground">
                              <MapPin className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                              <span>{t('livesIn')} <strong>Việt Nam</strong></span>
                            </div>
                            <div className="flex items-center gap-3 text-foreground">
                              <Briefcase className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                              <span>{t('worksAt')} <strong>FUN Ecosystem</strong></span>
                            </div>
                            <div className="flex items-center gap-3 text-foreground">
                              <GraduationCap className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                              <span>{t('studiesAt')} <strong>Cosmic University</strong></span>
                            </div>
                            <div className="flex items-center gap-3 text-foreground">
                              <Heart className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                              <span>{t('single')}</span>
                            </div>
                            <div className="flex items-center gap-3 text-foreground">
                              <Clock className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                              <span>{t('joinedSince')} {new Date(profile?.created_at).toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US', { month: 'long', year: 'numeric' })}</span>
                            </div>
                          </div>
                          
                          {showPrivateElements && (
                            <Button 
                              variant="secondary" 
                              className="w-full mt-4"
                              onClick={() => navigateToTab('edit')}
                            >
                              {t('editDetails')}
                            </Button>
                          )}
                        </div>

                        {/* Photos Card - Facebook style */}
                        <div className="bg-card rounded-xl shadow-sm border border-border p-4">
                          <div className="flex justify-between items-center mb-3">
                            <h3 className="font-bold text-lg text-foreground">{t('photos')}</h3>
                            <button 
                              className="text-primary hover:underline text-sm font-medium"
                              onClick={() => navigateToTab('photos')}
                            >
                              {t('viewAllPhotos')}
                            </button>
                          </div>
                          <div className="grid grid-cols-3 gap-1 rounded-lg overflow-hidden">
                            {originalPosts.filter(p => p.image_url).slice(0, 9).map((post, i) => (
                              <LazyImage 
                                key={i}
                                src={post.image_url}
                                alt=""
                                className="w-full aspect-square cursor-pointer"
                                onClick={() => navigateToTab('photos')}
                              />
                            ))}
                            {originalPosts.filter(p => p.image_url).length === 0 && (
                              <div className="col-span-3 py-8 text-center text-muted-foreground text-sm">
                                {t('noPhotosYet')}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Friends Card - Facebook style with real data */}
                        <div className="bg-card rounded-xl shadow-sm border border-border p-4">
                          <div className="flex justify-between items-center mb-3">
                            <div>
                              <h3 className="font-bold text-lg text-foreground">{t('friends')}</h3>
                              <p className="text-sm text-muted-foreground">{friendsCount} {t('friendsSuffix')}</p>
                            </div>
                            <button 
                              className="text-primary hover:underline text-sm font-medium"
                              onClick={() => navigateToTab('friends')}
                            >
                              {t('viewAllFriends')}
                            </button>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            {friendsPreview.length > 0 ? (
                              friendsPreview.map((friend) => (
                                <div 
                                  key={friend.id} 
                                  className="text-center cursor-pointer hover:opacity-80 transition-opacity"
                                  onClick={() => navigate(`/@${friend.username}`)}
                                >
                                  <Avatar className="w-full aspect-square rounded-lg mb-1 border-2 border-border overflow-hidden">
                                    <AvatarImage 
                                      src={friend.avatar_url || undefined} 
                                      sizeHint="md"
                                      className="object-cover"
                                    />
                                    <AvatarFallback className="rounded-lg text-lg bg-gradient-to-br from-primary/20 to-gold/20 text-foreground">
                                      {(friend.full_name || friend.username)?.[0]?.toUpperCase() || 'U'}
                                    </AvatarFallback>
                                  </Avatar>
                                  <p className="text-xs text-foreground truncate font-medium">
                                    {friend.full_name || friend.username}
                                  </p>
                                </div>
                              ))
                            ) : (
                              <div className="col-span-3 py-8 text-center text-muted-foreground text-sm">
                                {t('noFriendsYet')}
                              </div>
                            )}
                          </div>
                        </div>
                      </TabsContent>
                    </div>

                    {/* Right Content - Posts */}
                    <div className="lg:col-span-3 space-y-4">
                      <TabsContent value="posts" className="mt-0 space-y-4">
                        {/* Create Post - Facebook style */}
                        {showPrivateElements && currentUserId && (
                          <FacebookCreatePost 
                            onPostCreated={() => {
                              const profileId = userId || currentUserId;
                              if (profileId) {
                                return fetchProfile(profileId, currentUserId);
                              }
                            }}
                          />
                        )}
                        
                        {sortedPosts.length === 0 ? (
                          <div className="bg-card rounded-xl shadow-sm border border-border p-8 text-center text-muted-foreground">
                            {t('noPostsYet')}
                          </div>
                        ) : (
                          sortedPosts.map((item) => {
                            const isPinned = item._type === 'original' && item.id === profile?.pinned_post_id;
                            
                            return item._type === 'shared' ? (
                              <div key={`shared-${item.id}`} className="space-y-2">
                                <div className="flex items-center gap-2 text-sm text-muted-foreground px-2">
                                  <span className="font-semibold text-primary">{t('sharedLabel')}</span>
                                </div>
                                <FacebookPostCard 
                                  post={item.posts} 
                                  currentUserId={currentUserId}
                                  onPostDeleted={handlePostDeleted}
                                />
                              </div>
                            ) : (
                              <div key={item.id} className="space-y-0">
                                {/* Pinned Post Badge */}
                                {isPinned && (
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground px-4 py-2 bg-secondary/50 rounded-t-xl border-b border-border">
                                    <Pin className="w-4 h-4 text-primary" />
                                    <span className="font-medium">{t('pinnedPost')}</span>
                                  </div>
                                )}
                                <FacebookPostCard 
                                  post={item} 
                                  currentUserId={currentUserId}
                                  onPostDeleted={handlePostDeleted}
                                  isPinned={isPinned}
                                  onPinPost={showPrivateElements ? handlePinPost : undefined}
                                  onUnpinPost={showPrivateElements ? handleUnpinPost : undefined}
                                  isOwnProfile={isOwnProfile}
                                  viewAsPublic={viewAsPublic}
                                />
                              </div>
                            );
                          })
                        )}
                      </TabsContent>

                      <TabsContent value="about" className="mt-0">
                        <div className="bg-card rounded-xl shadow-sm border border-border p-6">
                          <h3 className="font-bold text-xl mb-4 text-foreground">{t('about')}</h3>
                          <div className="space-y-4">
                            <div className="flex items-center gap-3 text-foreground">
                              <Briefcase className="w-6 h-6 text-muted-foreground" />
                              <span>{t('worksAt')} <strong>FUN Ecosystem</strong></span>
                            </div>
                            <div className="flex items-center gap-3 text-foreground">
                              <GraduationCap className="w-6 h-6 text-muted-foreground" />
                              <span>{t('studiesAt')} <strong>Cosmic University</strong></span>
                            </div>
                            <div className="flex items-center gap-3 text-foreground">
                              <MapPin className="w-6 h-6 text-muted-foreground" />
                              <span>{t('livesIn')} <strong>Việt Nam</strong></span>
                            </div>
                            <div className="flex items-center gap-3 text-foreground">
                              <Heart className="w-6 h-6 text-muted-foreground" />
                              <span>{t('single')}</span>
                            </div>
                          </div>
                        </div>
                      </TabsContent>

                      <TabsContent value="friends" className="mt-0">
                        <div className="bg-card rounded-xl shadow-sm border border-border p-6">
                          <h3 className="font-bold text-xl mb-4 text-foreground">{t('friends')}</h3>
                          <FriendsList userId={profile.id} />
                        </div>
                      </TabsContent>

                      <TabsContent value="photos" className="mt-0">
                        <div className="bg-card rounded-xl shadow-sm border border-border p-6">
                          <h3 className="font-bold text-xl mb-4 text-foreground">{t('photos')}</h3>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {originalPosts.filter(p => p.image_url).map((post, i) => (
                              <img 
                                key={i}
                                src={post.image_url}
                                alt=""
                                className="w-full aspect-square object-cover rounded-lg"
                              />
                            ))}
                          </div>
                          {originalPosts.filter(p => p.image_url).length === 0 && (
                            <p className="text-center text-muted-foreground py-8">{t('noPhotosYet')}</p>
                          )}
                        </div>
                      </TabsContent>

                      <TabsContent value="videos" className="mt-0">
                        <div className="bg-card rounded-xl shadow-sm border border-border p-6">
                          <h3 className="font-bold text-xl mb-4 text-foreground">{t('reels')}</h3>
                          <div className="grid grid-cols-2 gap-4">
                            {originalPosts.filter(p => p.video_url).map((post, i) => (
                              <video 
                                key={i}
                                src={post.video_url}
                                className="w-full aspect-video object-cover rounded-lg"
                                controls
                              />
                            ))}
                          </div>
                          {originalPosts.filter(p => p.video_url).length === 0 && (
                            <p className="text-center text-muted-foreground py-8">{t('noReelsYet')}</p>
                          )}
                        </div>
                      </TabsContent>

                      {showPrivateElements && (
                        <TabsContent value="edit" className="mt-0">
                          <div className="bg-card rounded-xl shadow-sm border border-border p-6">
                            <EditProfile />
                          </div>
                        </TabsContent>
                      )}
                    </div>
                  </div>
                </div>
              </Tabs>
            </div>
          </div>
        </div>
      </main>
      
      {/* Mobile Bottom Navigation with Honor Board */}
      <MobileBottomNav />
    </div>
  );
};

export default Profile;
