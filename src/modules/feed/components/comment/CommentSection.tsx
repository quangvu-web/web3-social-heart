import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { MessageCircle, Send, Smile } from 'lucide-react';
import { z } from 'zod';
import { CommentItem } from './CommentItem';
import { CommentMediaUpload } from './CommentMediaUpload';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { EmojiPicker } from './EmojiPicker';
import { useLanguage } from '@/i18n/LanguageContext';
import { trackFunGameAction } from '@/features/fun-play/trackFunGameAction';

const commentSchema = z.object({
  content: z.string().max(1000, 'Comment cannot exceed 1000 characters'),
});

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  image_url?: string | null;
  video_url?: string | null;
  parent_comment_id?: string | null;
  profiles: {
    username: string;
    avatar_url: string | null;
  };
  replies?: Comment[];
}

interface CommentSectionProps {
  postId: string;
  onCommentAdded?: () => void;
}

export const CommentSection = ({ postId, onCommentAdded }: CommentSectionProps) => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ avatar_url: string | null; username: string } | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [visibleComments, setVisibleComments] = useState(5);

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  // Fetch comments immediately when component mounts
  useEffect(() => {
    fetchComments();
    
    const channel = supabase
      .channel(`comments-${postId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comments',
          filter: `post_id=eq.${postId}`,
        },
        () => {
          fetchComments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [postId]);

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('avatar_url, username')
        .eq('id', user.id)
        .single();
      
      if (profile) {
        setCurrentUser(profile);
      }
    }
  };

  const fetchComments = async () => {
    const { data, error } = await supabase
      .from('comments')
      .select(`
        *,
        profiles (username, avatar_url)
      `)
      .eq('post_id', postId)
      .is('parent_comment_id', null)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error(t('cannotLoadComments'));
      return;
    }

    const commentsWithReplies = await Promise.all(
      (data || []).map(async (comment) => {
        const { data: replies } = await supabase
          .from('comments')
          .select(`
            *,
            profiles (username, avatar_url)
          `)
          .eq('parent_comment_id', comment.id)
          .order('created_at', { ascending: true });

        return {
          ...comment,
          replies: replies || [],
        };
      })
    );

    setComments(commentsWithReplies);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() && !mediaUrl) return;

    const validation = commentSchema.safeParse({ content: newComment.trim() });
    if (!validation.success) {
      toast.error(validation.error.issues[0].message);
      return;
    }

    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      toast.error(t('pleaseLoginToComment'), {
        action: { label: t('login'), onClick: () => navigate('/auth') }
      });
      setLoading(false);
      return;
    }

    const insertData: any = {
      post_id: postId,
      user_id: user.id,
      content: newComment.trim() || '',
    };

    if (mediaUrl) {
      if (mediaType === 'image') {
        insertData.image_url = mediaUrl;
      } else if (mediaType === 'video') {
        insertData.video_url = mediaUrl;
      }
    }

    const { error } = await supabase
      .from('comments')
      .insert(insertData);

    if (error) {
      toast.error(t('cannotPostComment'));
    } else {
      setNewComment('');
      setMediaUrl(null);
      setMediaType(null);
      fetchComments();
      onCommentAdded?.();
      trackFunGameAction('positive_comment_1', {
        source: 'feed_comment',
        post_id: postId,
        has_media: Boolean(mediaUrl),
      });
      toast.success(t('commentPosted'));
    }
    setLoading(false);
  };

  const handleEmojiSelect = (emoji: string) => {
    setNewComment(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  const loadMoreComments = () => {
    setVisibleComments(prev => prev + 10);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Comment Input Box */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex gap-3 items-start">
          <Avatar className="w-10 h-10 ring-2 ring-primary/30 shrink-0">
            <AvatarImage 
              src={currentUser?.avatar_url} 
              alt={currentUser?.username || 'User'} 
              sizeHint="sm" 
            />
            <AvatarFallback className="bg-gradient-to-br from-primary/30 to-primary/10 text-primary font-semibold">
              {currentUser?.username?.[0]?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 space-y-2">
            <div className="relative">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder={t('writeComment')}
                className="w-full min-h-[60px] max-h-[200px] px-4 py-3 bg-white dark:bg-secondary border-2 border-primary/30 rounded-2xl resize-none focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-300 text-sm placeholder:text-muted-foreground/60"
                disabled={loading}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
              />
            </div>

            {/* Media Preview */}
            {mediaUrl && (
              <div className="relative inline-block">
                {mediaType === 'image' ? (
                  <img src={mediaUrl} alt="Preview" className="max-h-32 rounded-xl border-2 border-primary/20" />
                ) : (
                  <video src={mediaUrl} className="max-h-32 rounded-xl border-2 border-primary/20" />
                )}
                <button
                  type="button"
                  onClick={() => { setMediaUrl(null); setMediaType(null); }}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-white rounded-full flex items-center justify-center text-xs hover:bg-destructive/80"
                >
                  ×
                </button>
              </div>
            )}

            {/* Action Bar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <CommentMediaUpload
                  onMediaUploaded={(url, type) => {
                    setMediaUrl(url);
                    setMediaType(type);
                  }}
                  onMediaRemoved={() => {
                    setMediaUrl(null);
                    setMediaType(null);
                  }}
                />
                
                <div className="relative">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="text-yellow-500 hover:text-yellow-600 hover:bg-yellow-500/10"
                  >
                    <Smile className="w-5 h-5" />
                  </Button>
                  {showEmojiPicker && (
                    <div className="absolute bottom-full left-0 mb-2 z-50">
                      <EmojiPicker onEmojiSelect={handleEmojiSelect} />
                    </div>
                  )}
                </div>
              </div>
              
              <Button 
                type="submit" 
                size="sm" 
                disabled={loading || (!newComment.trim() && !mediaUrl)}
                className="bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-white font-semibold px-6 rounded-full shadow-lg shadow-yellow-400/30 hover:shadow-yellow-500/40 transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
              >
                <Send className="w-4 h-4 mr-2" />
                {t('post')}
              </Button>
            </div>
          </div>
        </div>
      </form>

      {/* Comments List */}
      <div className="space-y-3 pl-2">
        {comments.slice(0, visibleComments).map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            postId={postId}
            onReplyAdded={fetchComments}
            onCommentDeleted={fetchComments}
          />
        ))}
        
        {/* Load More Button */}
        {comments.length > visibleComments && (
          <Button
            variant="ghost"
            size="sm"
            onClick={loadMoreComments}
            className="w-full text-primary hover:text-primary hover:bg-primary/10 font-medium"
          >
            {t('loadMoreComments')} ({comments.length - visibleComments})
          </Button>
        )}
        
        {comments.length === 0 && (
          <p className="text-center text-muted-foreground text-sm py-4">
            {t('noComments')} ✨
          </p>
        )}
      </div>
    </div>
  );
};
