import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ThumbsUp } from 'lucide-react';
import { useLanguage } from '@/i18n/LanguageContext';

const REACTION_TYPES = [
  { type: 'like', icon: '👍', labelKey: 'like' as const, color: '#3b82f6' },
  { type: 'love', icon: '❤️', labelKey: 'reactionLove' as const, color: '#ef4444' },
  { type: 'care', icon: '🥰', labelKey: 'reactionCare' as const, color: '#f97316' },
  { type: 'wow', icon: '😮', labelKey: 'reactionWow' as const, color: '#eab308' },
  { type: 'haha', icon: '😂', labelKey: 'haha' as const, color: '#eab308' },
  { type: 'pray', icon: '🙏', labelKey: 'reactionGratitude' as const, color: '#a855f7' },
];

const VIEWPORT_PADDING = 12; // Safe padding from screen edges

interface ReactionButtonProps {
  postId: string;
  currentUserId: string;
  initialReaction?: string | null;
  likeCount: number;
  onReactionChange: (newCount: number, newReaction: string | null) => void;
}

export const ReactionButton = ({
  postId,
  currentUserId,
  initialReaction = null,
  likeCount,
  onReactionChange,
}: ReactionButtonProps) => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const REACTIONS = REACTION_TYPES.map(r => ({ ...r, label: t(r.labelKey) }));
  const [showReactions, setShowReactions] = useState(false);
  const [currentReaction, setCurrentReaction] = useState<string | null>(initialReaction);
  const [isAnimating, setIsAnimating] = useState(false);
  const [hoveredReaction, setHoveredReaction] = useState<string | null>(null);
  const [swipeSelectedReaction, setSwipeSelectedReaction] = useState<string | null>(null);
  const [menuOffset, setMenuOffset] = useState(0); // Smart offset for viewport alignment
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const longPressTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const isLongPressRef = useRef(false);
  const reactionMenuRef = useRef<HTMLDivElement>(null);
  const buttonContainerRef = useRef<HTMLDivElement>(null);
  const reactionButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const lastHoveredRef = useRef<string | null>(null);

  // Sync với initialReaction khi data được load từ database
  useEffect(() => {
    setCurrentReaction(initialReaction);
  }, [initialReaction]);

  // Smart viewport alignment - calculate offset when menu shows
  useEffect(() => {
    if (showReactions && reactionMenuRef.current && buttonContainerRef.current) {
      const menuRect = reactionMenuRef.current.getBoundingClientRect();
      const buttonRect = buttonContainerRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      
      let offset = 0;
      
      // Check if menu overflows left edge
      if (menuRect.left < VIEWPORT_PADDING) {
        offset = VIEWPORT_PADDING - menuRect.left;
      }
      // Check if menu overflows right edge
      else if (menuRect.right > viewportWidth - VIEWPORT_PADDING) {
        offset = (viewportWidth - VIEWPORT_PADDING) - menuRect.right;
      }
      
      setMenuOffset(offset);
    } else {
      setMenuOffset(0);
    }
  }, [showReactions]);

  // Do not lock body scroll for reaction popup.
  // Body locking here can conflict with route/modal locks and leave feed stuck.

  const clearTimeouts = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  }, []);

  const handleMouseEnter = () => {
    clearTimeouts();
    setShowReactions(true);
  };

  const handleMouseLeave = () => {
    hideTimeoutRef.current = setTimeout(() => {
      setShowReactions(false);
      setHoveredReaction(null);
      setSwipeSelectedReaction(null);
    }, 300);
  };

  // Haptic feedback helper
  const triggerHaptic = useCallback((duration: number = 10) => {
    if (navigator.vibrate) {
      navigator.vibrate(duration);
    }
  }, []);

  // Get reaction at touch position (hit testing)
  const getReactionAtPosition = useCallback((clientX: number, clientY: number): string | null => {
    for (const [type, button] of reactionButtonRefs.current.entries()) {
      const rect = button.getBoundingClientRect();
      // Expand hit area slightly for better touch targeting
      const padding = 5;
      if (
        clientX >= rect.left - padding &&
        clientX <= rect.right + padding &&
        clientY >= rect.top - padding &&
        clientY <= rect.bottom + padding
      ) {
        return type;
      }
    }
    return null;
  }, []);

  // Touch handlers for long-press on mobile
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    isLongPressRef.current = false;
    setSwipeSelectedReaction(null);
    
    longPressTimeoutRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      setShowReactions(true);
      triggerHaptic(50);
    }, 400); // 400ms long press
  }, [triggerHaptic]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    
    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - touchStartRef.current.x);
    const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);
    
    // If long press is active and menu is shown, allow swipe selection
    if (isLongPressRef.current && showReactions) {
      e.preventDefault(); // Prevent scroll while swiping on reactions
      
      const reactionType = getReactionAtPosition(touch.clientX, touch.clientY);
      
      if (reactionType !== lastHoveredRef.current) {
        lastHoveredRef.current = reactionType;
        setHoveredReaction(reactionType);
        setSwipeSelectedReaction(reactionType);
        
        // Haptic feedback when hovering over new reaction
        if (reactionType) {
          triggerHaptic(10);
        }
      }
    } else {
      // Cancel long press if finger moves too much before menu opens
      if (deltaX > 10 || deltaY > 10) {
        clearTimeouts();
      }
    }
  }, [clearTimeouts, showReactions, getReactionAtPosition, triggerHaptic]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    clearTimeouts();
    
    // If we were swiping and have a selected reaction, use it
    if (isLongPressRef.current && swipeSelectedReaction) {
      e.preventDefault();
      triggerHaptic(20);
      handleReaction(swipeSelectedReaction);
      setShowReactions(false);
      setHoveredReaction(null);
      setSwipeSelectedReaction(null);
    } else if (isLongPressRef.current && showReactions) {
      // Long press ended but no reaction selected - keep menu open briefly
      hideTimeoutRef.current = setTimeout(() => {
        setShowReactions(false);
        setHoveredReaction(null);
      }, 2000);
    } else if (!isLongPressRef.current) {
      // Quick tap - toggle like
      handleReaction(currentReaction || 'like');
    }
    
    touchStartRef.current = null;
    lastHoveredRef.current = null;
    isLongPressRef.current = false;
  }, [clearTimeouts, showReactions, currentReaction, swipeSelectedReaction, triggerHaptic]);

  const handleReaction = async (reactionType: string) => {
    if (!currentUserId) {
      toast.error(t('pleaseLoginToReact'), {
        action: { label: t('signIn'), onClick: () => navigate('/auth') }
      });
      return;
    }

    setShowReactions(false);
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 300);

    try {
      if (currentReaction === reactionType) {
        // Remove reaction
        const { error } = await supabase
          .from('reactions')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', currentUserId)
          .is('comment_id', null);

        if (error) throw error;

        setCurrentReaction(null);
        onReactionChange(likeCount - 1, null);
      } else {
        // First check if reaction already exists for this user on this post
        const { data: existingReaction } = await supabase
          .from('reactions')
          .select('id')
          .eq('post_id', postId)
          .eq('user_id', currentUserId)
          .is('comment_id', null)
          .maybeSingle();

        if (existingReaction) {
          // Update existing reaction
          const { error } = await supabase
            .from('reactions')
            .update({ type: reactionType })
            .eq('id', existingReaction.id);

          if (error) throw error;
        } else {
          // Insert new reaction
          const { error } = await supabase
            .from('reactions')
            .insert({
              post_id: postId,
              user_id: currentUserId,
              type: reactionType,
              comment_id: null,
            });

          if (error) throw error;
        }

        const wasNew = !currentReaction;
        setCurrentReaction(reactionType);
        onReactionChange(wasNew ? likeCount + 1 : likeCount, reactionType);
      }
    } catch (error: any) {
      console.error('Reaction error:', error);
      if (error?.message?.includes('permission') || error?.message?.includes('denied') || error?.code === '42501') {
        toast.error(t('systemPaused'), {
          description: t('tryAgain'),
          duration: 5000,
        });
      } else {
        toast.error(t('cannotUpdateReaction'), {
          description: t('tryAgain'),
        });
      }
    }
  };

  const handleReactionSelect = (reactionType: string) => {
    setShowReactions(false);
    setHoveredReaction(null);
    setSwipeSelectedReaction(null);
    triggerHaptic(15);
    handleReaction(reactionType);
  };

  const activeReaction = REACTIONS.find((r) => r.type === currentReaction);

  return (
    <div
      ref={buttonContainerRef}
      className="relative flex-1 select-none"
      style={{ WebkitTouchCallout: 'none' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        onClick={() => handleReaction(currentReaction || 'like')}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={`w-full flex items-center justify-center gap-1.5 sm:gap-2 py-3 min-h-[48px] rounded-lg transition-all hover:bg-secondary active:bg-secondary/80 select-none ${
          currentReaction ? 'text-blue-500' : 'text-muted-foreground'
        } ${isAnimating ? 'scale-110' : ''}`}
        style={{ 
          WebkitTouchCallout: 'none', 
          WebkitUserSelect: 'none',
          touchAction: showReactions ? 'none' : 'auto'
        }}
      >
        {activeReaction ? (
          <>
            <span className="text-lg sm:text-xl transition-transform duration-200 pointer-events-none">{activeReaction.icon}</span>
            <span className="font-semibold text-xs sm:text-sm pointer-events-none" style={{ color: activeReaction.color }}>
              {activeReaction.label}
            </span>
          </>
        ) : (
          <>
            <ThumbsUp className="w-5 h-5 pointer-events-none" />
            <span className="font-semibold text-xs sm:text-sm pointer-events-none">{t('like')}</span>
          </>
        )}
      </button>

      {/* Reactions Popup - Enhanced with swipe-to-select */}
      {showReactions && (
        <>
          {/* Invisible bridge to connect button to popup */}
          <div className="absolute bottom-full left-0 right-0 h-3" />
          <div 
            ref={reactionMenuRef}
            className="absolute bottom-full left-0 mb-2 bg-card rounded-full shadow-2xl border border-border p-2 flex gap-1 z-[9999] select-none"
            style={{ 
              WebkitTouchCallout: 'none',
              touchAction: 'none'
            }}
            onTouchMove={(e) => e.preventDefault()}
          >
            {/* Golden glow effect */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-yellow-400/20 via-amber-300/30 to-yellow-400/20 blur-md -z-10 animate-pulse" />
            
            {REACTIONS.map((reaction, index) => (
              <button
                key={reaction.type}
                ref={(el) => {
                  if (el) reactionButtonRefs.current.set(reaction.type, el);
                }}
                className={`relative w-12 h-12 sm:w-11 sm:h-11 flex items-center justify-center text-2xl sm:text-2xl transition-all duration-150 rounded-full select-none
                  ${(hoveredReaction === reaction.type || swipeSelectedReaction === reaction.type) 
                    ? 'scale-150 -translate-y-4 z-10' 
                    : 'scale-100'}
                  hover:scale-150 hover:-translate-y-4 active:scale-125
                `}
                style={{
                  WebkitTouchCallout: 'none',
                  WebkitUserSelect: 'none',
                  touchAction: 'none',
                  animationDelay: `${index * 50}ms`,
                  animation: 'reaction-pop-in 0.3s ease-out forwards',
                  opacity: 0,
                  transform: 'scale(0) translateY(10px)',
                }}
                onClick={() => handleReactionSelect(reaction.type)}
                onMouseEnter={() => setHoveredReaction(reaction.type)}
                onMouseLeave={() => setHoveredReaction(null)}
                title={reaction.label}
              >
                {/* Golden sparkle effect on hover/swipe */}
                {(hoveredReaction === reaction.type || swipeSelectedReaction === reaction.type) && (
                  <div className="absolute inset-0 rounded-full bg-gradient-to-t from-yellow-400/50 to-transparent animate-pulse" />
                )}
                <span className="relative z-10">{reaction.icon}</span>
                
                {/* Label tooltip on hover/swipe */}
                {(hoveredReaction === reaction.type || swipeSelectedReaction === reaction.type) && (
                  <span className="absolute -top-9 left-1/2 -translate-x-1/2 bg-foreground text-background text-xs px-2.5 py-1.5 rounded-full whitespace-nowrap font-medium shadow-lg">
                    {reaction.label}
                  </span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
      
      {/* CSS for reaction pop-in animation */}
      <style>{`
        @keyframes reaction-pop-in {
          0% {
            opacity: 0;
            transform: scale(0) translateY(10px);
          }
          50% {
            opacity: 1;
            transform: scale(1.2) translateY(-5px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
    </div>
  );
};
