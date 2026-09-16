import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { PostStats, FeedPost } from '../types';

interface FeedPage {
  posts: FeedPost[];
  postStats: Record<string, PostStats>;
  nextCursor: string | null;
}

const POSTS_PER_PAGE = 10;

// Batch fetch all post stats in parallel
const fetchPostStats = async (postIds: string[]): Promise<Record<string, PostStats>> => {
  if (postIds.length === 0) return {};

  try {
    const [reactionsRes, commentsRes, sharesRes] = await Promise.all([
      supabase
        .from('reactions')
        .select('id, user_id, type, post_id')
        .in('post_id', postIds)
        .is('comment_id', null),
      supabase
        .from('comments')
        .select('post_id')
        .in('post_id', postIds),
      supabase
        .from('shared_posts')
        .select('original_post_id')
        .in('original_post_id', postIds),
    ]);

    if (reactionsRes.error) console.error('Reactions fetch error:', reactionsRes.error);
    if (commentsRes.error) console.error('Comments fetch error:', commentsRes.error);
    if (sharesRes.error) console.error('Shares fetch error:', sharesRes.error);

    const stats: Record<string, PostStats> = {};

    postIds.forEach(postId => {
      const postReactions = reactionsRes.data?.filter(r => r.post_id === postId) || [];
      const postComments = commentsRes.data?.filter(c => c.post_id === postId) || [];
      const postShares = sharesRes.data?.filter(s => s.original_post_id === postId) || [];

      stats[postId] = {
        reactions: postReactions.map(r => ({ id: r.id, user_id: r.user_id, type: r.type })),
        commentCount: postComments.length,
        shareCount: postShares.length,
      };
    });

    return stats;
  } catch (error) {
    console.error('Error fetching post stats:', error);
    return postIds.reduce((acc, id) => {
      acc[id] = { reactions: [], commentCount: 0, shareCount: 0 };
      return acc;
    }, {} as Record<string, PostStats>);
  }
};

// Fetch a page of posts with cursor-based pagination
const fetchFeedPage = async (cursor: string | null): Promise<FeedPage> => {
  let query = supabase
    .from('posts')
    .select(`*, profiles!posts_user_id_fkey (username, avatar_url)`)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(POSTS_PER_PAGE + 1);

  if (cursor) {
    query = query.lt('created_at', cursor);
  }

  const { data: posts, error } = await query;

  if (error) throw error;

  const hasMore = (posts?.length || 0) > POSTS_PER_PAGE;
  const postsToReturn = hasMore ? posts?.slice(0, POSTS_PER_PAGE) : posts;

  const postsData: FeedPost[] = (postsToReturn || []).map(post => ({
    ...post,
    media_urls: (post.media_urls as Array<{ url: string; type: 'image' | 'video' }>) || null,
    visibility: post.visibility || 'public',
    post_type: (post as any).post_type || 'text',
    metadata: (post as any).metadata || null,
  }));
  
  const postIds = postsData.map(p => p.id);
  const postStats = await fetchPostStats(postIds);

  const nextCursor = hasMore && postsData.length > 0 
    ? postsData[postsData.length - 1].created_at 
    : null;

  return { posts: postsData, postStats, nextCursor };
};

export const useFeedPosts = () => {
  const queryClient = useQueryClient();

  const query = useInfiniteQuery<FeedPage, Error>({
    queryKey: ['feed-posts'],
    queryFn: ({ pageParam }) => fetchFeedPage(pageParam as string | null),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage: FeedPage) => lastPage.nextCursor ?? undefined,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 2,
  });

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['feed-posts'] });
  }, [queryClient]);

  useEffect(() => {
    const channel = supabase
      .channel('feed-posts-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'posts' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['feed-posts'] });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'posts' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['feed-posts'] });
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'posts' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['feed-posts'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const allPosts = query.data?.pages?.flatMap(page => page.posts) || [];
  const allPostStats = query.data?.pages?.reduce((acc, page) => {
    return { ...acc, ...page.postStats };
  }, {} as Record<string, PostStats>) || {};

  return {
    posts: allPosts,
    postStats: allPostStats,
    isLoading: query.isLoading,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: query.hasNextPage ?? false,
    fetchNextPage: query.fetchNextPage,
    refetch,
  };
};

// Re-export types for convenience
export type { PostStats, FeedPost };
