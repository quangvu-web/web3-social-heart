import { useState, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { MessageCircle, Trash2, Share2, Flag, MoreHorizontal } from 'lucide-react';
import { CommentReactionButton } from './CommentReactionButton';
import { CommentReplyForm } from './CommentReplyForm';
import { CommentMediaViewer } from './CommentMediaViewer';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { formatRelativeTime } from '@/lib/formatters';
import { deleteStreamVideoByUrl, isStreamUrl } from '@/utils/streamHelpers';
import { useLanguage } from '@/i18n/LanguageContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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

interface CommentItemProps {
  comment: Comment;
  postId: string;
  onReplyAdded: () => void;
  onCommentDeleted: () => void;
  level?: number;
}

export const CommentItem = ({ 
  comment, 
  postId, 
  onReplyAdded, 
  onCommentDeleted,
  level = 0 
}: CommentItemProps) => {
  const { t } = useLanguage();
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [showMediaViewer, setShowMediaViewer] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showAllReplies, setShowAllReplies] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);
    };
    fetchUser();
  }, []);

  const handleDelete = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user || user.id !== comment.user_id) {
      toast.error(t('canOnlyDeleteOwnComment'));
      return;
    }

    if (!confirm(t('confirmDeleteComment'))) return;

    setDeleting(true);
    
    // Delete video from Cloudflare Stream first if exists
    if (comment.video_url && isStreamUrl(comment.video_url)) {
      await deleteStreamVideoByUrl(comment.video_url);
    }
    
    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', comment.id);

    if (error) {
      toast.error(t('cannotDeleteComment'));
    } else {
      toast.success(t('commentDeleted'));
      onCommentDeleted();
    }
    setDeleting(false);
  };

  const handleShare = () => {
    const url = `${window.location.origin}/post/${postId}#comment-${comment.id}`;
    navigator.clipboard.writeText(url);
    toast.success(t('commentLinkCopied'));
  };

  const handleReport = () => {
    toast.info(t('reportSent'));
  };

  const mediaUrl = comment.image_url || comment.video_url;
  const mediaType = comment.image_url ? 'image' : 'video';

  const visibleReplies = showAllReplies 
    ? comment.replies 
    : comment.replies?.slice(0, 2);
  const hiddenRepliesCount = (comment.replies?.length || 0) - 2;

  return (
    <div 
      id={`comment-${comment.id}`}
      className={`space-y-2 ${level > 0 ? 'ml-10 pl-3 border-l-2 border-yellow-400/30 hover:border-yellow-400/60 transition-colors duration-300' : ''}`}
    >
      <div className="flex gap-3 group animate-fade-in">
        <Link to={`/profile/${comment.user_id}`}>
          <Avatar className="w-9 h-9 ring-2 ring-primary/20 transition-all duration-300 group-hover:ring-primary/40 shrink-0 cursor-pointer hover:scale-105">
            <AvatarImage 
              src={comment.profiles?.avatar_url} 
              alt={comment.profiles?.username || 'User'} 
              sizeHint="sm" 
            />
            <AvatarFallback className="text-xs bg-gradient-to-br from-primary/30 to-primary/10 text-primary font-semibold">
              {comment.profiles?.username?.[0]?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
        </Link>
        
        <div className="flex-1 space-y-1">
          <div className="bg-muted/60 rounded-2xl px-4 py-2.5 transition-all duration-300 hover:bg-muted/80 group-hover:shadow-sm inline-block max-w-full">
            <div className="flex items-center gap-2 mb-0.5">
              <Link 
                to={`/profile/${comment.user_id}`}
                className="font-semibold text-sm text-primary hover:underline cursor-pointer"
              >
                {comment.profiles?.username || t('anonymous')}
              </Link>
            </div>
            
            <p className="text-sm break-words whitespace-pre-wrap">{comment.content}</p>
            
            {mediaUrl && (
              <div className="mt-2">
                {mediaType === 'image' ? (
                  <img
                    src={mediaUrl}
                    alt="Comment media"
                    className="max-w-[280px] rounded-xl border border-border cursor-pointer hover:opacity-90 transition-all duration-300 hover:shadow-md"
                    onClick={() => setShowMediaViewer(true)}
                  />
                ) : (
                  <video
                    src={mediaUrl}
                    controls
                    className="max-w-[280px] rounded-xl border border-border"
                  />
                )}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 px-2 text-xs">
            <CommentReactionButton 
              commentId={comment.id} 
              onReactionChange={onReplyAdded}
            />
            
            {level < 3 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowReplyForm(!showReplyForm)}
                className="text-xs text-muted-foreground hover:text-primary hover:bg-primary/10 gap-1 h-7 px-2"
              >
                {t('reply')}
              </Button>
            )}
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleShare}
              className="text-xs text-muted-foreground hover:text-primary hover:bg-primary/10 gap-1 h-7 px-2"
            >
              {t('share')}
            </Button>
            
            <span className="text-muted-foreground/60">
              {formatRelativeTime(comment.created_at)}
            </span>

            {/* More options */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-7 h-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                {currentUserId === comment.user_id && (
                  <DropdownMenuItem 
                    onClick={handleDelete}
                    disabled={deleting}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {t('delete')}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={handleReport}>
                  <Flag className="w-4 h-4 mr-2" />
                  {t('report')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Reply Form */}
          {showReplyForm && (
            <div className="animate-fade-in mt-2">
              <CommentReplyForm
                postId={postId}
                parentCommentId={comment.id}
                onReplyAdded={() => {
                  setShowReplyForm(false);
                  onReplyAdded();
                }}
                onCancel={() => setShowReplyForm(false)}
              />
            </div>
          )}

          {/* Replies */}
          {comment.replies && comment.replies.length > 0 && (
            <div className="space-y-2 mt-2 animate-fade-in">
              {!showAllReplies && hiddenRepliesCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAllReplies(true)}
                  className="text-xs text-primary hover:text-primary hover:bg-primary/10 font-medium h-7"
                >
                  <MessageCircle className="w-3.5 h-3.5 mr-1.5" />
                  {t('viewMoreReplies').replace('{count}', String(hiddenRepliesCount))}
                </Button>
              )}
              
              {visibleReplies?.map((reply) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  postId={postId}
                  onReplyAdded={onReplyAdded}
                  onCommentDeleted={onReplyAdded}
                  level={level + 1}
                />
              ))}
              
              {showAllReplies && hiddenRepliesCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAllReplies(false)}
                  className="text-xs text-muted-foreground hover:text-primary hover:bg-primary/10 h-7"
                >
                  {t('hideReplies')}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {mediaUrl && (
        <CommentMediaViewer
          mediaUrl={mediaUrl}
          mediaType={mediaType}
          isOpen={showMediaViewer}
          onClose={() => setShowMediaViewer(false)}
        />
      )}
    </div>
  );
};
