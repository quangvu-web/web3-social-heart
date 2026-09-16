import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Heart } from 'lucide-react';
import { toast } from 'sonner';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useLanguage } from '@/i18n/LanguageContext';

// Reaction type definitions - labels will be loaded from translations
const REACTION_TYPES = [
  { type: 'like', emoji: '👍', labelKey: 'like', color: 'text-blue-500' },
  { type: 'love', emoji: '❤️', labelKey: 'reactionLove', color: 'text-red-500' },
  { type: 'care', emoji: '🥰', labelKey: 'reactionCare', color: 'text-orange-500' },
  { type: 'wow', emoji: '😮', labelKey: 'wow', color: 'text-yellow-600' },
  { type: 'haha', emoji: '😂', labelKey: 'haha', color: 'text-yellow-500' },
  { type: 'pray', emoji: '🙏', labelKey: 'gratitude', color: 'text-purple-500' },
];

interface CommentReactionButtonProps {
  commentId: string;
  onReactionChange?: () => void;
}

interface CommentReaction {
  id: string;
  user_id: string;
  type: string;
  profiles: {
    username: string;
    avatar_url: string | null;
  };
}

export const CommentReactionButton = ({ commentId, onReactionChange }: CommentReactionButtonProps) => {
  const { t } = useLanguage();
  const [userReaction, setUserReaction] = useState<string | null>(null);
  const [reactionCounts, setReactionCounts] = useState<Record<string, number>>({});
  const [reactions, setReactions] = useState<CommentReaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const totalReactions = Object.values(reactionCounts).reduce((a, b) => a + b, 0);
  
  // Build reactions with translated labels
  const CHAKRA_REACTIONS = REACTION_TYPES.map(r => ({
    ...r,
    label: t(r.labelKey as any)
  }));

  useEffect(() => {
    fetchReactions();
    
    const channel = supabase
      .channel(`comment-reactions-${commentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reactions',
          filter: `comment_id=eq.${commentId}`,
        },
        () => {
          fetchReactions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [commentId]);

  const fetchReactions = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { data, error } = await supabase
      .from('reactions')
      .select(`
        id,
        user_id,
        type,
        profiles (username, avatar_url)
      `)
      .eq('comment_id', commentId);

    if (!error && data) {
      setReactions(data as CommentReaction[]);
      
      // Count reactions by type
      const counts: Record<string, number> = {};
      data.forEach(r => {
        counts[r.type] = (counts[r.type] || 0) + 1;
      });
      setReactionCounts(counts);
      
      // Find user's reaction
      const userReact = user ? data.find(r => r.user_id === user.id) : null;
      setUserReaction(userReact?.type || null);
    }
  };

  const handleReaction = async (reactionType: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      toast.error(t('pleaseLoginToReact'));
      return;
    }

    setLoading(true);
    setShowReactionPicker(false);

    if (userReaction === reactionType) {
      // Remove reaction
      const { error } = await supabase
        .from('reactions')
        .delete()
        .eq('comment_id', commentId)
        .eq('user_id', user.id);

      if (!error) {
        setUserReaction(null);
        onReactionChange?.();
      }
    } else {
      // Update or insert reaction
      if (userReaction) {
        // Delete existing first
        await supabase
          .from('reactions')
          .delete()
          .eq('comment_id', commentId)
          .eq('user_id', user.id);
      }
      
      const { error } = await supabase
        .from('reactions')
        .insert({
          comment_id: commentId,
          user_id: user.id,
          type: reactionType,
        });

      if (!error) {
        setUserReaction(reactionType);
        onReactionChange?.();
      }
    }

    setLoading(false);
  };

  const handleMouseEnter = () => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    setShowReactionPicker(true);
  };

  const handleMouseLeave = () => {
    hideTimeoutRef.current = setTimeout(() => {
      setShowReactionPicker(false);
    }, 300);
  };

  const currentReaction = userReaction 
    ? CHAKRA_REACTIONS.find(r => r.type === userReaction) 
    : null;

  // Get top 3 reaction types by count
  const topReactions = Object.entries(reactionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([type]) => CHAKRA_REACTIONS.find(r => r.type === type))
    .filter(Boolean);

  return (
    <div className="relative" ref={containerRef}>
      <HoverCard openDelay={200}>
        <HoverCardTrigger asChild>
          <div
            className="inline-flex items-center"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleReaction(userReaction || 'love')}
              disabled={loading}
              className={`text-xs gap-1.5 transition-all duration-300 hover:bg-primary/10 ${
                userReaction 
                  ? currentReaction?.color || 'text-red-500'
                  : 'text-muted-foreground hover:text-primary'
              }`}
            >
              {currentReaction ? (
                <span className="text-base animate-bounce-in">{currentReaction.emoji}</span>
              ) : (
                <Heart className="w-3.5 h-3.5" />
              )}
              {totalReactions > 0 && (
                <span className="font-medium">{totalReactions}</span>
              )}
            </Button>
            
            {/* Top reaction emojis display */}
            {topReactions.length > 0 && (
              <div className="flex -space-x-1 ml-1">
                {topReactions.map((reaction, idx) => (
                  <span 
                    key={reaction?.type} 
                    className="text-sm"
                    style={{ zIndex: 3 - idx }}
                  >
                    {reaction?.emoji}
                  </span>
                ))}
              </div>
            )}
          </div>
        </HoverCardTrigger>
        
        {reactions.length > 0 && (
          <HoverCardContent className="w-64 p-3 bg-card border-primary/20">
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-primary">Reactions</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
                {reactions.map((reaction) => {
                  const reactionInfo = CHAKRA_REACTIONS.find(r => r.type === reaction.type);
                  return (
                    <div key={reaction.id} className="flex items-center gap-2">
                      <span className="text-sm">{reactionInfo?.emoji}</span>
                      <Avatar className="w-5 h-5">
                        <AvatarFallback className="text-xs bg-primary/10">
                          {reaction.profiles?.username?.[0]?.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm truncate">{reaction.profiles?.username || t('anonymous')}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </HoverCardContent>
        )}
      </HoverCard>

      {/* Reaction Picker Popup */}
      {showReactionPicker && (
        <div
          className="absolute bottom-full left-0 mb-2 z-50 animate-scale-in"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div className="flex items-center gap-1 bg-card border-2 border-yellow-400/50 rounded-full px-2 py-1.5 shadow-lg shadow-yellow-400/20">
            {CHAKRA_REACTIONS.map((reaction) => (
              <button
                key={reaction.type}
                onClick={() => handleReaction(reaction.type)}
                disabled={loading}
                className={`p-1.5 rounded-full transition-all duration-200 hover:scale-125 hover:bg-primary/10 ${
                  userReaction === reaction.type ? 'scale-125 bg-primary/20' : ''
                }`}
                title={reaction.label}
              >
                <span className="text-xl">{reaction.emoji}</span>
              </button>
            ))}
          </div>
          {/* Bridge element */}
          <div className="absolute -bottom-2 left-0 w-full h-4" />
        </div>
      )}
    </div>
  );
};
